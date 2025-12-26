import * as cron from "node-cron";
import {
  IdnesScraper,
  BezrealitkyScraper,
  SrealityScraper,
  BazosScraper,
} from "./scrapers";
import { TelegramService } from "./telegram-service";
import type { Property } from "./types";
import {
  DAILY_SCRAPES,
  NIGHTLY_SCRAPES,
  getEnabledScrapes,
  getScraperTypes,
  buildUrlForScrape,
  logActiveScrapes,
  type ScrapeConfig,
  type ScraperType,
} from "./scrape-configs";

type ScraperInstance =
  | IdnesScraper
  | BezrealitkyScraper
  | SrealityScraper
  | BazosScraper;

export class PropertyScheduler {
  private scrapers: Map<ScraperType, ScraperInstance> = new Map();
  private telegram: TelegramService;

  constructor(telegramToken: string, chatId: string) {
    this.telegram = new TelegramService(telegramToken, chatId);
  }

  async initialize(): Promise<void> {
    // Determine which scrapers we need based on enabled configs
    const allScrapes = [
      ...getEnabledScrapes(DAILY_SCRAPES),
      ...getEnabledScrapes(NIGHTLY_SCRAPES),
    ];
    const neededScrapers = getScraperTypes(allScrapes);

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
    // Main daily scrape at 6 PM
    cron.schedule(
      "0 18 * * *",
      async () => {
        console.log(
          "🕕 Starting combined daily property scraping at 6 PM (Prague time)..."
        );
        await this.runDailyScrape();
      },
      {
        timezone: "Europe/Prague",
      }
    );

    // Nightly scrape at 23:50 (end of day to catch all today's listings)
    cron.schedule(
      "50 23 * * *",
      async () => {
        console.log(
          "🌙 Starting nightly property scraping at 23:50 (Prague time)..."
        );
        await this.runNightlyScrape();
      },
      {
        timezone: "Europe/Prague",
      }
    );

    // Nightly scrape at 0:10 (after midnight to catch late-night/midnight listings)
    cron.schedule(
      "10 0 * * *",
      async () => {
        console.log(
          "🌅 Starting nightly property scraping at 0:10 (Prague time)..."
        );
        await this.runNightlyScrape();
      },
      {
        timezone: "Europe/Prague",
      }
    );

    console.log(
      "⏰ Scheduler started - jobs scheduled for 6:00 PM, 11:50 PM, and 0:10 AM (Prague time)"
    );
  }

  async runDailyScrape(): Promise<void> {
    await this.runScrapes(getEnabledScrapes(DAILY_SCRAPES), "daily");
  }

  async runNightlyScrape(): Promise<void> {
    await this.runScrapes(getEnabledScrapes(NIGHTLY_SCRAPES), "nightly");
  }

  private async runScrapes(
    scrapes: ScrapeConfig[],
    jobName: string
  ): Promise<void> {
    try {
      // Collect all scrape results
      const scrapeResults: Array<{ label: string; properties: Property[] }> =
        [];
      for (const scrape of scrapes) {
        const properties = await this.executeScrape(scrape);
        scrapeResults.push({ label: scrape.label, properties });
      }

      // Send combined summary message
      await this.telegram.sendCombinedPropertiesUpdate(scrapeResults);

      console.log(`✅ ${jobName} scrape completed successfully`);
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

  private async executeScrape(scrape: ScrapeConfig): Promise<Property[]> {
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
          return [];
      }

      console.log(
        `📊 [${label}] ${type} returned ${properties.length} properties`
      );
      return properties;
    } catch (error) {
      console.error(`❌ [${label}] Error during ${type} scrape:`, error);
      return [];
    }
  }

  // For testing - run scrape immediately
  async runManualScrape(): Promise<void> {
    console.log("🔍 Running manual scrape...");
    await this.runDailyScrape();
    await this.runNightlyScrape();
  }

  async close(): Promise<void> {
    const closePromises = Array.from(this.scrapers.values()).map((scraper) =>
      scraper.close()
    );
    await Promise.all(closePromises);
    console.log("✅ Scheduler closed");
  }
}
