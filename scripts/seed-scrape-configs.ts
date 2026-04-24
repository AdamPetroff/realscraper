import "dotenv/config";
import { initializeSupabase, closeSupabase, seedScrapeConfigs } from "../src/db";

async function main(): Promise<void> {
  const dbAvailable = await initializeSupabase();

  if (!dbAvailable) {
    throw new Error("Supabase is not available");
  }

  const count = await seedScrapeConfigs();
  console.log(`✅ Seeded ${count} scrape configs`);
}

main()
  .catch((error) => {
    console.error("❌ Failed to seed scrape configs:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeSupabase();
  });
