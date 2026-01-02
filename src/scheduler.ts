import * as cron from "node-cron";
import {
  IdnesScraper,
  BezrealitkyScraper,
  SrealityScraper,
  BazosScraper,
} from "./scrapers";
import { TelegramService } from "./telegram-service";
import type { Property, PropertyWithPriceChange, ScrapeResult } from "./types";
import {
  SCRAPES,
  getEnabledScrapes,
  getScraperTypes,
  buildUrlForScrape,
  logActiveScrapes,
  type ScrapeConfig,
  type ScraperType,
} from "./scrape-configs";
import {
  initializeSupabase,
  isSupabaseAvailable,
  processProperties,
} from "./db";

type ScraperInstance =
  | IdnesScraper
  | BezrealitkyScraper
  | SrealityScraper
  | BazosScraper;

export class PropertyScheduler {
  private scrapers: Map<ScraperType, ScraperInstance> = new Map();
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
      console.log("⚠️ Running without database persistence (all properties will be notified)");
    }

    // Determine which scrapers we need based on enabled configs
    const enabledScrapes = getEnabledScrapes(SCRAPES);
    const neededScrapers = getScraperTypes(enabledScrapes);

    // Initialize only the scrapers we need
    const initPromises: Promise<void>[] = [];

    if (neededScrapers.has("idnes")) {
      const scraper = new IdnesScraper();
      this.scrapers.set("idnes", scraper);
      initPromises.push(scraper.initialize());
    }

    if (neededScrapers.has("bezrealitky")) {
      const scraper = new BezrealitkyScraper();
      this.scrapers.set("bezrealitky", scraper);
      initPromises.push(scraper.initialize());
    }

    if (neededScrapers.has("sreality")) {
      const scraper = new SrealityScraper({}, this.telegram);
      this.scrapers.set("sreality", scraper);
      initPromises.push(scraper.initialize());
    }

    if (neededScrapers.has("bazos")) {
      const scraper = new BazosScraper();
      this.scrapers.set("bazos", scraper);
      initPromises.push(scraper.initialize());
    }

    await Promise.all(initPromises);

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
    logActiveScrapes();
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
    await this.runScrapes(getEnabledScrapes(SCRAPES), "scheduled");
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
