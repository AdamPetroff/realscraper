import { BazosScraper } from "../src/scrapers/BazosScraper";
import { buildBazosUrl, type BazosScraperConfig } from "../src/config";
import type { ScrapeConfig } from "../src/scrape-configs";
import {
  getDefaultScrapeConfig,
  getScrapeConfigById,
  logPropertySummary,
  runManualScrape,
  type ParsedManualScrapeArgs,
} from "./manual-scrape-utils";

function getDefaultBazosConfig(scrapes: ScrapeConfig[]): BazosScraperConfig {
  return {
    ...getDefaultScrapeConfig(scrapes, "bazos"),
    recentOnly: false,
  };
}

function getBazosConfigById(
  scrapes: ScrapeConfig[],
  id: string,
): BazosScraperConfig {
  return {
    ...getScrapeConfigById(scrapes, id, "bazos"),
    recentOnly: false,
  };
}

function resolveTarget(
  args: ParsedManualScrapeArgs,
  scrapes: ScrapeConfig[],
): {
  url: string;
  options: { newOnly: boolean };
} {
  const includeAll = args.rawArgs.includes("--all");

  if (args.scrapeId) {
    return {
      url: buildBazosUrl(getBazosConfigById(scrapes, args.scrapeId)),
      options: { newOnly: !includeAll },
    };
  }

  if (args.urlArg) {
    return {
      url: args.urlArg,
      options: { newOnly: !includeAll },
    };
  }

  const config: BazosScraperConfig = {
    ...getDefaultBazosConfig(scrapes),
    ...(process.env.BAZOS_LOCATION_CODE
      ? { locationCode: process.env.BAZOS_LOCATION_CODE }
      : {}),
    ...(process.env.BAZOS_RADIUS_KM
      ? { radiusKm: parseInt(process.env.BAZOS_RADIUS_KM, 10) }
      : {}),
    ...(process.env.BAZOS_PRICE_MIN
      ? { priceMin: parseInt(process.env.BAZOS_PRICE_MIN, 10) }
      : {}),
    ...(process.env.BAZOS_PRICE_MAX
      ? { priceMax: parseInt(process.env.BAZOS_PRICE_MAX, 10) }
      : {}),
  };

  return {
    url: buildBazosUrl(config),
    options: { newOnly: !includeAll },
  };
}

async function main(): Promise<void> {
  await runManualScrape({
    sourceName: "Bazos.cz",
    errorLabel: "Bazos",
    createScraper: () => new BazosScraper(),
    resolveTarget,
    scrape: (scraper, target) =>
      scraper.scrapeProperties(target.url, target.options),
    close: (scraper) => scraper.close(),
    logTarget: (target) => {
      console.log("Starting Bazos.cz scraper (using native fetch)...");
      console.log(`\nScraping URL: ${target.url}`);
      console.log(`Mode: ${target.options?.newOnly ? "Today only" : "All listings"}`);
    },
    emptyState: [
      "No properties found. This might mean:",
      "- No listings from today (try --all flag to see all)",
      "- The website structure has changed",
      "- The search criteria are too restrictive",
      "",
      "Try adjusting the search parameters via the URL argument or BAZOS_* env variables.",
      "Available env vars: BAZOS_LOCATION_CODE, BAZOS_RADIUS_KM, BAZOS_PRICE_MIN, BAZOS_PRICE_MAX",
      "Flags: --all (include all listings, not just recent)",
    ],
    logProperty: (property, index) =>
      logPropertySummary(property, index, {
        header: "Bazos Property",
        detail: "long",
        imageLimit: 3,
        descriptionLimit: 150,
      }),
  });
}

if (require.main === module) {
  main();
}
