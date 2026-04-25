import * as cron from "node-cron";
import {
  IdnesScraper,
  BezrealitkyScraper,
  SrealityScraper,
  BazosScraper,
  OkDrazbyScraper,
  ExDrazbyScraper,
} from "./scrapers";
import { TelegramService } from "./telegram-service";
import type { Property, PropertyWithPriceChange, ScrapeResult } from "./types";
import {
  expandSharedScrape,
  getEnabledScrapes,
  getScraperTypes,
  buildUrlForScrape,
  logActiveScrapes,
  type ScrapeConfig,
  type ScraperType,
  type StoredSharedScrapeConfig,
} from "./scrape-configs";
import {
  initializeSupabase,
  isSupabaseAvailable,
  loadScrapes,
  processProperties,
} from "./db";
import { filterPropertiesByTitleBlacklist } from "./property-filters";

export interface PreviewScrapeItem {
  title: string;
  price: string;
  location: string;
  area?: string;
  rooms: string;
  source?: string;
  sourceId?: string;
  url: string;
}

export interface PreviewScrapeResult {
  id: string;
  label: string;
  type: ScraperType;
  url: string;
  returnedCount: number;
  filteredOutCount: number;
  properties: PreviewScrapeItem[];
  error?: string;
}

type ScraperInstance =
  | IdnesScraper
  | BezrealitkyScraper
  | SrealityScraper
  | BazosScraper
  | OkDrazbyScraper
  | ExDrazbyScraper;

export class PropertyScheduler {
  private scrapers: Map<ScraperType, ScraperInstance> = new Map();
  private scrapes: ScrapeConfig[] = [];
  private telegram: TelegramService;
  private dbAvailable: boolean = false;

  constructor(telegramToken: string, chatId: string) {
    this.telegram = new TelegramService(telegramToken, chatId);
  }

  async initialize(): Promise<void> {
    // Initialize database connection
    this.dbAvailable = await initializeSupabase();
    if (this.dbAvailable) {
      console.log("✅ Database persistence enabled");
    } else {
      throw new Error(
        "Database persistence is required because scrape configs are stored in Supabase",
      );
    }

    this.scrapes = await loadScrapes();

    const enabledScrapes = getEnabledScrapes(this.scrapes);
    if (enabledScrapes.length === 0) {
      throw new Error("No enabled scrape configs found in database");
    }

    const neededScrapers = getScraperTypes(enabledScrapes);

    await Promise.all(
      Array.from(neededScrapers).map((scraperType) =>
        this.ensureScraper(scraperType),
      ),
    );

    const scraperNames = Array.from(neededScrapers)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(", ");
    console.log(`✅ Initialized scrapers (${scraperNames})`);

    const connected = await this.telegram.testConnection();
    if (!connected) {
      throw new Error("Failed to connect to Telegram");
    }
    console.log("✅ Telegram connected");

    // Log all active scrape URLs
    logActiveScrapes(this.scrapes);
  }

  startScheduler(): void {
    // Run scrapes every 10 minutes
    cron.schedule(
      "*/10 * * * *",
      async () => {
        console.log("🔄 Starting scheduled property scrape...");
        await this.runScrape();
      },
      {
        timezone: "Europe/Prague",
      }
    );

    console.log("⏰ Scheduler started - scraping every 10 minutes");
  }

  async runScrape(): Promise<void> {
    await this.runScrapes(getEnabledScrapes(this.scrapes), "scheduled");
  }

  async reloadScrapes(): Promise<void> {
    this.scrapes = await loadScrapes();
    const neededScrapers = getScraperTypes(getEnabledScrapes(this.scrapes));

    await Promise.all(
      Array.from(neededScrapers).map((scraperType) =>
        this.ensureScraper(scraperType),
      ),
    );

    logActiveScrapes(this.scrapes);
  }

  async runPreviewScrape(
    sharedConfig: StoredSharedScrapeConfig,
    scraperType?: ScraperType,
  ): Promise<PreviewScrapeResult[]> {
    const scrapes = expandSharedScrape(sharedConfig).filter(
      (scrape) => !scraperType || scrape.type === scraperType,
    );

    if (scraperType && scrapes.length === 0) {
      throw new Error(`Scrape config does not expand to scraper "${scraperType}"`);
    }

    const results: PreviewScrapeResult[] = [];
    for (const scrape of scrapes) {
      await this.ensureScraper(scrape.type);
      results.push(await this.executePreviewScrape(scrape));
    }

    return results;
  }

  private async runScrapes(
    scrapes: ScrapeConfig[],
    jobName: string
  ): Promise<void> {
    try {
      // Collect all scrape results
      const scrapeResults: ScrapeResult[] = [];
      for (const scrape of scrapes) {
        const result = await this.executeScrape(scrape);
        scrapeResults.push(result);
      }

      // Calculate totals
      const totalNew = scrapeResults.reduce((sum, r) => sum + r.newCount, 0);
      const totalPriceChanges = scrapeResults.reduce((sum, r) => sum + r.priceChangeCount, 0);
      const totalSkipped = scrapeResults.reduce((sum, r) => sum + r.skippedCount, 0);
      
      // Only send Telegram message if there are new properties or price changes
      if (totalNew > 0 || totalPriceChanges > 0) {
        await this.telegram.sendCombinedPropertiesUpdate(scrapeResults);
      }

      // Log summary
      console.log(
        `✅ ${jobName} scrape completed: ${totalNew} new, ${totalPriceChanges} price changes, ${totalSkipped} skipped`
      );
    } catch (error) {
      console.error(`❌ Error during ${jobName} scrape:`, error);

      try {
        await this.telegram.sendMessage(
          `❌ Error occurred during ${jobName} property scraping. Please check the logs.`
        );
      } catch (telegramError) {
        console.error("❌ Failed to send error notification:", telegramError);
      }
    }
  }

  private async executeScrape(scrape: ScrapeConfig): Promise<ScrapeResult> {
    const { type, label, config } = scrape;
    const url = buildUrlForScrape(scrape);

    try {
      console.log(`🔍 [${label}] Scraping ${type} URL: ${url}`);

      let properties: Property[];
      await this.ensureScraper(type);

      switch (type) {
        case "idnes": {
          const scraper = this.scrapers.get("idnes") as IdnesScraper;
          properties = await scraper.scrapeProperties(url);
          break;
        }

        case "bezrealitky": {
          const scraper = this.scrapers.get(
            "bezrealitky"
          ) as BezrealitkyScraper;
          properties = await scraper.scrapeProperties(url, {
            newOnly: false,
          });
          break;
        }

        case "sreality": {
          const scraper = this.scrapers.get("sreality") as SrealityScraper;
          properties = await scraper.scrapeProperties(url, {
            newOnly: config.newOnly,
          });
          break;
        }

        case "bazos": {
          const scraper = this.scrapers.get("bazos") as BazosScraper;
          properties = await scraper.scrapeProperties(url, {
            newOnly: config.recentOnly,
          });
          break;
        }

        case "okdrazby": {
          const scraper = this.scrapers.get("okdrazby") as OkDrazbyScraper;
          properties = await scraper.scrapeProperties(url);
          break;
        }

        case "exdrazby": {
          const scraper = this.scrapers.get("exdrazby") as ExDrazbyScraper;
          properties = await scraper.scrapeProperties(url);
          break;
        }

        default:
          console.warn(`⚠️ Unknown scraper type: ${type}`);
          return {
            label,
            properties: [],
            newCount: 0,
            priceChangeCount: 0,
            skippedCount: 0,
          };
      }

      console.log(
        `📊 [${label}] ${type} returned ${properties.length} properties`
      );

      const { filteredProperties, filteredOutCount } =
        filterPropertiesByTitleBlacklist(properties);
      properties = filteredProperties;

      if (filteredOutCount > 0) {
        console.log(
          `🚫 [${label}] Filtered ${filteredOutCount} properties by title blacklist`
        );
      }

      // Process properties through database (if available)
      const { results, newCount, priceChangeCount, skippedCount } = 
        await processProperties(properties);

      console.log(
        `📊 [${label}] After dedup: ${newCount} new, ${priceChangeCount} price changes, ${skippedCount} skipped`
      );

      return {
        label,
        properties: results,
        newCount,
        priceChangeCount,
        skippedCount,
      };
    } catch (error) {
      console.error(`❌ [${label}] Error during ${type} scrape:`, error);
      return {
        label,
        properties: [],
        newCount: 0,
        priceChangeCount: 0,
        skippedCount: 0,
      };
    }
  }

  private async executePreviewScrape(
    scrape: ScrapeConfig,
  ): Promise<PreviewScrapeResult> {
    const { type, label, config } = scrape;
    const url = buildUrlForScrape(scrape);

    try {
      console.log(`🔎 [preview:${label}] Scraping ${type} URL: ${url}`);

      let properties: Property[];

      switch (type) {
        case "idnes": {
          const scraper = this.scrapers.get("idnes") as IdnesScraper;
          properties = await scraper.scrapeProperties(url);
          break;
        }

        case "bezrealitky": {
          const scraper = this.scrapers.get(
            "bezrealitky"
          ) as BezrealitkyScraper;
          properties = await scraper.scrapeProperties(url, {
            newOnly: false,
          });
          break;
        }

        case "sreality": {
          const scraper = this.scrapers.get("sreality") as SrealityScraper;
          properties = await scraper.scrapeProperties(url, {
            newOnly: false,
          });
          break;
        }

        case "bazos": {
          const scraper = this.scrapers.get("bazos") as BazosScraper;
          properties = await scraper.scrapeProperties(url, {
            newOnly: false,
          });
          break;
        }

        case "okdrazby": {
          const scraper = this.scrapers.get("okdrazby") as OkDrazbyScraper;
          properties = await scraper.scrapeProperties(url);
          break;
        }

        case "exdrazby": {
          const scraper = this.scrapers.get("exdrazby") as ExDrazbyScraper;
          properties = await scraper.scrapeProperties(url);
          break;
        }
      }

      const returnedCount = properties.length;
      const { filteredProperties, filteredOutCount } =
        filterPropertiesByTitleBlacklist(properties);

      return {
        id: scrape.id,
        label,
        type,
        url,
        returnedCount,
        filteredOutCount,
        properties: filteredProperties.map((property) => ({
          title: property.title,
          price: property.price,
          location: property.location,
          area: property.area,
          rooms: property.rooms,
          source: property.source,
          sourceId: property.sourceId,
          url: property.url,
        })),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown preview scrape error";
      console.error(`❌ [preview:${label}] Error during ${type} scrape:`, error);

      return {
        id: scrape.id,
        label,
        type,
        url,
        returnedCount: 0,
        filteredOutCount: 0,
        properties: [],
        error: message,
      };
    }
  }

  private async ensureScraper(type: ScraperType): Promise<void> {
    if (this.scrapers.has(type)) {
      return;
    }

    let scraper: ScraperInstance;

    switch (type) {
      case "idnes":
        scraper = new IdnesScraper();
        break;
      case "bezrealitky":
        scraper = new BezrealitkyScraper();
        break;
      case "sreality":
        scraper = new SrealityScraper({}, this.telegram);
        break;
      case "bazos":
        scraper = new BazosScraper();
        break;
      case "okdrazby":
        scraper = new OkDrazbyScraper();
        break;
      case "exdrazby":
        scraper = new ExDrazbyScraper();
        break;
    }

    this.scrapers.set(type, scraper);
    await scraper.initialize();
  }

  // For testing - run scrape immediately
  async runManualScrape(): Promise<void> {
    console.log("🔍 Running manual scrape...");
    await this.runScrape();
  }

  async close(): Promise<void> {
    const closePromises = Array.from(this.scrapers.values()).map((scraper) =>
      scraper.close()
    );
    await Promise.all(closePromises);
    console.log("✅ Scheduler closed");
  }
}
