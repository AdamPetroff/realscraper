import "dotenv/config";
import { PropertyScheduler } from "./scheduler";
import { startWebServer } from "./web/server";

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
  const port = parsePort(process.env.PORT);
  let webServer: Awaited<ReturnType<typeof startWebServer>> | undefined;

  try {
    webServer = await startWebServer(port, "0.0.0.0", scheduler);
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

    const shutdown = async () => {
      console.log("\n🛑 Shutting down gracefully...");
      if (webServer) {
        await new Promise<void>((resolve) => {
          webServer?.close(() => resolve());
        });
      }
      await scheduler.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Keep process alive
    setInterval(() => {
      // Just to keep the process running
    }, 60000);
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    if (webServer) {
      await new Promise<void>((resolve) => {
        webServer?.close(() => resolve());
      });
    }
    await scheduler.close();
    process.exit(1);
  }
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "3000");

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
}

if (require.main === module) {
  main();
}
