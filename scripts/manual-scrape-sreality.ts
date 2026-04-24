import { SrealityScraper } from "../src/scrapers/SrealityScraper";
import { buildSrealityUrl, type SrealityScraperConfig } from "../src/config";
import {
  getDefaultScrapeConfig,
  getScrapeConfigById,
  logPropertySummary,
  runManualScrape,
  type ParsedManualScrapeArgs,
} from "./manual-scrape-utils";

function getDefaultSrealityConfig(): SrealityScraperConfig {
  return {
    ...getDefaultScrapeConfig("sreality"),
    age: "tyden",
  };
}

function getSrealityConfigById(id: string): SrealityScraperConfig {
  return {
    ...getScrapeConfigById(id, "sreality"),
    age: "dnes",
  };
}

function resolveTarget(args: ParsedManualScrapeArgs): {
  url: string;
  options: { newOnly?: boolean };
} {
  if (args.scrapeId) {
    const config = getSrealityConfigById(args.scrapeId);

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

  const config = getDefaultSrealityConfig();

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
