import * as cron from "node-cron";
import {
  IdnesScraper,
  BezrealitkyScraper,
  SrealityScraper,
  BazosScraper,
} from "./scrapers";
import { TelegramService } from "./telegram-service";
import {
  DEFAULT_BEZREALITKY_CONFIG,
  DEFAULT_IDNES_CONFIG,
  DEFAULT_SREALITY_CONFIG,
  DEFAULT_BAZOS_CONFIG,
  buildIdnesUrl,
  buildBezrealitkyUrl,
  buildSrealityUrl,
  buildBazosUrl,
  type IdnesScraperConfig,
  type BezrealitkyScraperConfig,
  type SrealityScraperConfig,
  type BazosScraperConfig,
} from "./config";
import type { Property } from "./types";

export class PropertyScheduler {
  private idnesScraper: IdnesScraper;
  private bezrealitkyScraper: BezrealitkyScraper;
  private srealityScraper: SrealityScraper;
  private bazosScraper: BazosScraper;
  private telegram: TelegramService;
  private config: IdnesScraperConfig;
  private bezrealitkyConfig: BezrealitkyScraperConfig;
  private srealityConfig: SrealityScraperConfig;
  private bazosConfig: BazosScraperConfig;

  constructor(telegramToken: string, chatId: string) {
    this.telegram = new TelegramService(telegramToken, chatId);
    this.idnesScraper = new IdnesScraper();
    this.bezrealitkyScraper = new BezrealitkyScraper();
    this.srealityScraper = new SrealityScraper({}, this.telegram);
    this.bazosScraper = new BazosScraper();
    this.config = {
      ...DEFAULT_IDNES_CONFIG,
      articleAge: "1", // Only get properties from last 1 day
    };
    this.bezrealitkyConfig = {
      ...DEFAULT_BEZREALITKY_CONFIG,
      newOnly: true,
    };
    this.srealityConfig = {
      ...DEFAULT_SREALITY_CONFIG,
    };
    this.bazosConfig = {
      ...DEFAULT_BAZOS_CONFIG,
      recentOnly: true, // Only listings from today
    };
  }

  async initialize(): Promise<void> {
    await this.idnesScraper.initialize();
    await this.bezrealitkyScraper.initialize();
    await this.srealityScraper.initialize();
    await this.bazosScraper.initialize();
    console.log(
      "✅ Initialized scrapers (IDNES, Bezrealitky, Sreality & Bazos)"
    );

    const connected = await this.telegram.testConnection();
    if (!connected) {
      throw new Error("Failed to connect to Telegram");
    }
    console.log("✅ Telegram connected");
  }

  startScheduler(): void {
    // Main daily scrape at 6 PM (IDNES, Bezrealitky, Sreality)
    cron.schedule(
      "0 18 * * *",
      async () => {
        console.log(
          "🕕 Starting combined daily property scraping at 6 PM (Prague time)..."
        );
        await this.runDailyScrape();
      },
      {
        timezone: "Europe/Prague", // Czech timezone
      }
    );

    // Bazos scrape at 23:50 (end of day to catch all today's listings)
    cron.schedule(
      "50 23 * * *",
      async () => {
        console.log(
          "🌙 Starting Bazos property scraping at 23:50 (Prague time)..."
        );
        await this.runBazosScrape();
      },
      {
        timezone: "Europe/Prague", // Czech timezone
      }
    );

    console.log(
      "⏰ Scheduler started - jobs scheduled for 6:00 PM and 11:50 PM (Prague time)"
    );
  }

  async runDailyScrape(): Promise<void> {
    try {
      const defaultLabel = "IDNES (3-6M CZK)";
      const highRangeLabel = "IDNES (6-8M CZK)";
      const bezrealitkyLabel = "Bezrealitky (≤6M CZK)";
      const srealityLabel = "Sreality (≤6M CZK)";

      const defaultIdnesProperties = await this.scrapeIdnes(
        this.config,
        defaultLabel
      );
      await this.telegram.sendPropertiesUpdate(
        defaultIdnesProperties,
        defaultLabel
      );

      const highRangeConfig: IdnesScraperConfig = {
        ...this.config,
        priceMin: 6000000,
        priceMax: 8000000,
        rooms: "2k|21|3k|31",
        areaMin: 50,
      };

      const highRangeIdnesProperties = await this.scrapeIdnes(
        highRangeConfig,
        highRangeLabel
      );
      await this.telegram.sendPropertiesUpdate(
        highRangeIdnesProperties,
        highRangeLabel
      );

      const bezrealitkyProperties = await this.scrapeBezrealitky(
        bezrealitkyLabel,
        this.bezrealitkyConfig
      );
      await this.telegram.sendPropertiesUpdate(
        bezrealitkyProperties,
        bezrealitkyLabel
      );

      const srealityProperties = await this.scrapeSreality(
        srealityLabel,
        this.srealityConfig
      );
      await this.telegram.sendPropertiesUpdate(
        srealityProperties,
        srealityLabel
      );

      console.log("✅ Combined daily scrape completed successfully");
    } catch (error) {
      console.error("❌ Error during combined daily scrape:", error);

      try {
        await this.telegram.sendMessage(
          "❌ Error occurred during daily property scraping. Please check the logs."
        );
      } catch (telegramError) {
        console.error("❌ Failed to send error notification:", telegramError);
      }
    }
  }

  async runBazosScrape(): Promise<void> {
    try {
      const bazosLabel = "Bazos (≤7M CZK)";

      const bazosProperties = await this.scrapeBazos(
        bazosLabel,
        this.bazosConfig
      );
      await this.telegram.sendPropertiesUpdate(bazosProperties, bazosLabel);

      console.log("✅ Bazos nightly scrape completed successfully");
    } catch (error) {
      console.error("❌ Error during Bazos nightly scrape:", error);

      try {
        await this.telegram.sendMessage(
          "❌ Error occurred during Bazos property scraping. Please check the logs."
        );
      } catch (telegramError) {
        console.error("❌ Failed to send error notification:", telegramError);
      }
    }
  }

  // For testing - run scrape immediately
  async runManualScrape(): Promise<void> {
    console.log("🔍 Running manual scrape...");
    await this.runDailyScrape();
    await this.runBazosScrape();
  }

  private async scrapeIdnes(
    config: IdnesScraperConfig,
    label: string
  ): Promise<Property[]> {
    const idnesUrl = buildIdnesUrl(config);
    console.log(`🔍 [${label}] Scraping IDNES URL: ${idnesUrl}`);
    const properties = await this.idnesScraper.scrapeProperties(idnesUrl);
    console.log(`📊 [${label}] IDNES returned ${properties.length} properties`);
    return properties;
  }

  private async scrapeBezrealitky(
    label: string,
    config: BezrealitkyScraperConfig
  ): Promise<Property[]> {
    try {
      console.log(`🔍 [${label}] Scraping Bezrealitky URL`);
      const properties = await this.bezrealitkyScraper.scrapeProperties(
        buildBezrealitkyUrl(config),
        {
          newOnly: config.newOnly,
        }
      );
      console.log(
        `📊 [${label}] Bezrealitky returned ${properties.length} properties`
      );
      return properties;
    } catch (error) {
      console.error(`❌ [${label}] Error during Bezrealitky scrape:`, error);
      return [];
    }
  }

  private async scrapeSreality(
    label: string,
    config: SrealityScraperConfig
  ): Promise<Property[]> {
    try {
      const url = buildSrealityUrl(config);
      console.log(`🔍 [${label}] Scraping Sreality URL: ${url}`);
      const properties = await this.srealityScraper.scrapeProperties(url, {
        newOnly: config.newOnly,
      });
      console.log(
        `📊 [${label}] Sreality returned ${properties.length} properties`
      );
      return properties;
    } catch (error) {
      console.error(`❌ [${label}] Error during Sreality scrape:`, error);
      return [];
    }
  }

  private async scrapeBazos(
    label: string,
    config: BazosScraperConfig
  ): Promise<Property[]> {
    try {
      const url = buildBazosUrl(config);
      console.log(`🔍 [${label}] Scraping Bazos URL: ${url}`);
      const properties = await this.bazosScraper.scrapeProperties(url, {
        newOnly: config.recentOnly,
      });
      console.log(
        `📊 [${label}] Bazos returned ${properties.length} properties`
      );
      return properties;
    } catch (error) {
      console.error(`❌ [${label}] Error during Bazos scrape:`, error);
      return [];
    }
  }

  async close(): Promise<void> {
    await this.idnesScraper.close();
    await this.bezrealitkyScraper.close();
    await this.srealityScraper.close();
    await this.bazosScraper.close();
    console.log("✅ Scheduler closed");
  }
}
