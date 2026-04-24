import { SrealityScraper } from "../src/scrapers/SrealityScraper";
import { buildSrealityUrl, type SrealityScraperConfig } from "../src/config";
import type { ScrapeConfig } from "../src/scrape-configs";
import {
  getDefaultScrapeConfig,
  getScrapeConfigById,
  logPropertySummary,
  runManualScrape,
  type ParsedManualScrapeArgs,
} from "./manual-scrape-utils";

function getDefaultSrealityConfig(scrapes: ScrapeConfig[]): SrealityScraperConfig {
  return {
    ...getDefaultScrapeConfig(scrapes, "sreality"),
    age: "tyden",
  };
}

function getSrealityConfigById(
  scrapes: ScrapeConfig[],
  id: string,
): SrealityScraperConfig {
  return {
    ...getScrapeConfigById(scrapes, id, "sreality"),
    age: "dnes",
  };
}

function resolveTarget(
  args: ParsedManualScrapeArgs,
  scrapes: ScrapeConfig[],
): {
  url: string;
  options: { newOnly?: boolean };
} {
  if (args.scrapeId) {
    const config = getSrealityConfigById(scrapes, args.scrapeId);

    return {
      url: buildSrealityUrl(config),
      options: {
        newOnly: config.newOnly,
      },
    };
  }

  if (args.urlArg) {
    return {
      url: args.urlArg,
      options: {
        newOnly: args.rawArgs.includes("--new-only"),
      },
    };
  }

  const config = getDefaultSrealityConfig(scrapes);

  return {
    url: buildSrealityUrl(config),
    options: {
      newOnly: config.newOnly,
    },
  };
}

async function main(): Promise<void> {
  await runManualScrape({
    sourceName: "Sreality",
    errorLabel: "Sreality",
    createScraper: () => new SrealityScraper(),
    initialize: (scraper) => scraper.initialize(),
    resolveTarget,
    scrape: (scraper, target) =>
      scraper.scrapeProperties(target.url, target.options),
    close: (scraper) => scraper.close(),
    logTarget: (target) => {
      console.log("Initializing Sreality scraper...");
      console.log(`\nScraping URL: ${target.url}`);
    },
    emptyState: [
      "No properties found. This might mean:",
      "- The website structure has changed",
      "- The search criteria are too restrictive",
      "- The website requires additional authentication or has anti-bot measures",
    ],
    successMessage: (count) => `Successfully scraped ${count} properties`,
    logProperty: (property, index) =>
      logPropertySummary(property, index, {
        detail: "short",
      }),
  });
}

if (require.main === module) {
  main();
}
