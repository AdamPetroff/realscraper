import "dotenv/config";
import { PropertyScheduler } from "./scheduler";

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

  console.log("🚀 Starting Reality Scraper Bot...");
  console.log("Configuration:", {
    telegramToken: "***" + telegramToken.slice(-4),
    chatId,
  });

  const scheduler = new PropertyScheduler(telegramToken, chatId);

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
