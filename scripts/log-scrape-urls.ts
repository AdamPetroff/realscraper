import "dotenv/config";
import {
  initializeSupabase,
  closeSupabase,
  loadScrapes,
} from "../src/db";
import { buildUrlForScrape, getEnabledScrapes } from "../src/scrape-configs";

async function main(): Promise<void> {
  const dbAvailable = await initializeSupabase();
  if (!dbAvailable) {
    throw new Error("Supabase is not available");
  }

  const scrapes = await loadScrapes();

  console.log("\n🔗 All Defined Scrape URLs");
  console.log("═".repeat(80));

  const enabledScrapes = getEnabledScrapes(scrapes);
  const disabledScrapes = scrapes.filter((s) => s.enabled === false);

  // Group by type
  const byType = new Map<string, typeof scrapes>();
  for (const scrape of scrapes) {
    const list = byType.get(scrape.type) || [];
    list.push(scrape);
    byType.set(scrape.type, list);
  }

  for (const [type, scrapes] of byType) {
    console.log(`\n📌 ${type.toUpperCase()} (${scrapes.length} configs)`);
    console.log("─".repeat(80));

    for (const scrape of scrapes) {
      const status = scrape.enabled === false ? "❌ DISABLED" : "✅";
      console.log(`\n  ${status} ${scrape.label}`);
      console.log(`     id: ${scrape.id}`);
      console.log(`     ${buildUrlForScrape(scrape)}`);
    }
  }

  console.log("\n" + "═".repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   Total:    ${scrapes.length} scrapes`);
  console.log(`   Enabled:  ${enabledScrapes.length}`);
  console.log(`   Disabled: ${disabledScrapes.length}`);
  console.log();
}

main()
  .catch((error) => {
    console.error("❌ Failed to log scrape URLs:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeSupabase();
  });
