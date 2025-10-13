import "dotenv/config";
import { PropertyScheduler } from "./scheduler";
import { ScraperConfig } from "./config";

async function main(): Promise<void> {
  // Validate environment variables
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!telegramToken) {
    console.error("❌ TELEGRAM_BOT_TOKEN environment variable is required");
    process.exit(1);
  }

  if (!chatId) {
    console.error("❌ TELEGRAM_CHAT_ID environment variable is required");
    process.exit(1);
  }

  // Optional: Override default config with environment variables
  const config: Partial<ScraperConfig> = {
    priceMin: process.env.PRICE_MIN
      ? parseInt(process.env.PRICE_MIN)
      : undefined,
    priceMax: process.env.PRICE_MAX
      ? parseInt(process.env.PRICE_MAX)
      : undefined,
    city: process.env.CITY || undefined,
    rooms: process.env.ROOMS || undefined,
    areaMin: process.env.AREA_MIN ? parseInt(process.env.AREA_MIN) : undefined,
    ownership: process.env.OWNERSHIP || undefined,
    material: process.env.MATERIAL || undefined,
    roomCount: process.env.ROOM_COUNT
      ? parseInt(process.env.ROOM_COUNT)
      : undefined,
  };

  // Remove undefined values
  const cleanConfig = Object.fromEntries(
    Object.entries(config).filter(([_, value]) => value !== undefined)
  ) as Partial<ScraperConfig>;

  console.log("🚀 Starting Reality Scraper Bot...");
  console.log("Configuration:", {
    telegramToken: "***" + telegramToken.slice(-4),
    chatId,
    config: cleanConfig,
  });

  const scheduler = new PropertyScheduler(telegramToken, chatId, cleanConfig);

  try {
    await scheduler.initialize();

    // Check if we should run immediately (for testing)
    const runNow = process.env.RUN_NOW === "true";
    if (runNow) {
      console.log("🔍 RUN_NOW=true detected, running immediate scrape...");
      await scheduler.runManualScrape();
    }

    // Start the scheduler
    scheduler.startScheduler();

    console.log("✅ Bot is running. Press Ctrl+C to stop.");

    // Keep the process running
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down gracefully...");
      await scheduler.close();
      process.exit(0);
    });

    // Keep process alive
    setInterval(() => {
      // Just to keep the process running
    }, 60000);
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    await scheduler.close();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
