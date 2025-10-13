import * as cron from "node-cron";
import { RealityScraper } from "./scraper";
import { TelegramService } from "./telegram-service";
import { DEFAULT_CONFIG, buildUrl, ScraperConfig } from "./config";

export class PropertyScheduler {
  private scraper: RealityScraper;
  private telegram: TelegramService;
  private config: ScraperConfig;

  constructor(
    telegramToken: string,
    chatId: string,
    config?: Partial<ScraperConfig>
  ) {
    this.scraper = new RealityScraper();
    this.telegram = new TelegramService(telegramToken, chatId);
    this.config = {
      ...DEFAULT_CONFIG,
      articleAge: "1", // Only get properties from last 1 day
      ...config,
    };
  }

  async initialize(): Promise<void> {
    await this.scraper.initialize();
    console.log("✅ Scraper initialized");

    const connected = await this.telegram.testConnection();
    if (!connected) {
      throw new Error("Failed to connect to Telegram");
    }
    console.log("✅ Telegram connected");
  }

  startScheduler(): void {
    // Schedule for 6 PM every day (18:00) - default price range
    cron.schedule(
      "0 18 * * *",
      async () => {
        console.log(
          "🕕 Starting daily property scraping at 6 PM (3-6M CZK)..."
        );
        await this.runDailyScrape();
      },
      {
        timezone: "Europe/Prague", // Czech timezone
      }
    );

    // Schedule for 6:05 PM every day (18:05) - higher price range 6-8M CZK
    cron.schedule(
      "1 18 * * *",
      async () => {
        console.log(
          "🕕 Starting daily property scraping at 6:05 PM (6-8M CZK)..."
        );
        await this.runDailyScrape(
          {
            priceMin: 6000000,
            priceMax: 8000000,
            rooms: "2k|21|3k|31",
            areaMin: 50,
          },
          "6-8M CZK"
        );
      },
      {
        timezone: "Europe/Prague", // Czech timezone
      }
    );

    console.log(
      "⏰ Scheduler started - jobs scheduled for 6:00 PM (3-6M CZK) and 6:05 PM (6-8M CZK) (Prague time)"
    );
  }

  async runDailyScrape(
    configOverride?: Partial<ScraperConfig>,
    contextLabel = "default"
  ): Promise<void> {
    try {
      const effectiveConfig: ScraperConfig = {
        ...this.config,
        ...configOverride,
      };

      const url = buildUrl(effectiveConfig);
      console.log(`🔍 [${contextLabel}] Scraping URL: ${url}`);

      const properties = await this.scraper.scrapeProperties(url);
      console.log(
        `📊 [${contextLabel}] Found ${properties.length} properties from last day`
      );

      await this.telegram.sendPropertiesUpdate(properties);

      console.log(`✅ [${contextLabel}] Daily scrape completed successfully`);
    } catch (error) {
      console.error(`❌ [${contextLabel}] Error during daily scrape:`, error);

      try {
        await this.telegram.sendMessage(
          "❌ Error occurred during daily property scraping. Please check the logs."
        );
      } catch (telegramError) {
        console.error(
          `❌ [${contextLabel}] Failed to send error notification:`,
          telegramError
        );
      }
    }
  }

  // For testing - run scrape immediately
  async runManualScrape(): Promise<void> {
    console.log("🔍 Running manual scrape...");
    await this.runDailyScrape();
  }

  async close(): Promise<void> {
    await this.scraper.close();
    console.log("✅ Scheduler closed");
  }
}
