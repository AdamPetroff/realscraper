import { SCRAPES, buildUrlForScrape, getEnabledScrapes } from "../src/scrape-configs";

function main(): void {
  console.log("\n🔗 All Defined Scrape URLs");
  console.log("═".repeat(80));

  const enabledScrapes = getEnabledScrapes(SCRAPES);
  const disabledScrapes = SCRAPES.filter((s) => s.enabled === false);

  // Group by type
  const byType = new Map<string, typeof SCRAPES>();
  for (const scrape of SCRAPES) {
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
  console.log(`   Total:    ${SCRAPES.length} scrapes`);
  console.log(`   Enabled:  ${enabledScrapes.length}`);
  console.log(`   Disabled: ${disabledScrapes.length}`);
  console.log();
}

main();
