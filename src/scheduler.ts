import * as cron from 'node-cron';
import { RealityScraper } from './scraper';
import { TelegramService } from './telegram-service';
import { DEFAULT_CONFIG, buildUrl, ScraperConfig } from './config';

export class PropertyScheduler {
  private scraper: RealityScraper;
  private telegram: TelegramService;
  private config: ScraperConfig;

  constructor(telegramToken: string, chatId: string, config?: Partial<ScraperConfig>) {
    this.scraper = new RealityScraper();
    this.telegram = new TelegramService(telegramToken, chatId);
    this.config = {
      ...DEFAULT_CONFIG,
      articleAge: "1", // Only get properties from last 1 day
      ...config
    };
  }

  async initialize(): Promise<void> {
    await this.scraper.initialize();
    console.log('✅ Scraper initialized');
    
    const connected = await this.telegram.testConnection();
    if (!connected) {
      throw new Error('Failed to connect to Telegram');
    }
    console.log('✅ Telegram connected');
  }

  startScheduler(): void {
    // Schedule for 6 PM every day (18:00)
    cron.schedule('0 18 * * *', async () => {
      console.log('🕕 Starting daily property scraping at 6 PM...');
      await this.runDailyScrape();
    }, {
      timezone: 'Europe/Prague' // Czech timezone
    });

    console.log('⏰ Scheduler started - will run daily at 6 PM (Prague time)');
  }

  async runDailyScrape(): Promise<void> {
    try {
      const url = buildUrl(this.config);
      console.log(`🔍 Scraping URL: ${url}`);
      
      const properties = await this.scraper.scrapeProperties(url);
      console.log(`📊 Found ${properties.length} properties from last day`);
      
      await this.telegram.sendPropertiesUpdate(properties);
      
      console.log('✅ Daily scrape completed successfully');
    } catch (error) {
      console.error('❌ Error during daily scrape:', error);
      
      try {
        await this.telegram.sendMessage('❌ Error occurred during daily property scraping. Please check the logs.');
      } catch (telegramError) {
        console.error('❌ Failed to send error notification:', telegramError);
      }
    }
  }

  // For testing - run scrape immediately
  async runManualScrape(): Promise<void> {
    console.log('🔍 Running manual scrape...');
    await this.runDailyScrape();
  }

  async close(): Promise<void> {
    await this.scraper.close();
    console.log('✅ Scheduler closed');
  }
}