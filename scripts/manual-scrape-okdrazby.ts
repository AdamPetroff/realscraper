import { OkDrazbyScraper } from "../src/scrapers/OkDrazbyScraper";
import { buildOkDrazbyUrl, type OkDrazbyScraperConfig } from "../src/config";
import {
  getDefaultScrapeConfig,
  getScrapeConfigById,
  logPropertySummary,
  runManualScrape,
  type ParsedManualScrapeArgs,
} from "./manual-scrape-utils";

function getDefaultOkDrazbyConfig(): OkDrazbyScraperConfig {
  return getDefaultScrapeConfig("okdrazby");
}

function getOkDrazbyConfigById(id: string): OkDrazbyScraperConfig {
  return getScrapeConfigById(id, "okdrazby");
}

function resolveTarget(args: ParsedManualScrapeArgs): {
  url: string;
  scrapeId?: string;
} {
  if (args.scrapeId) {
    return {
      scrapeId: args.scrapeId,
      url: buildOkDrazbyUrl(getOkDrazbyConfigById(args.scrapeId)),
    };
  }

  if (args.urlArg) {
    return {
      url: args.urlArg,
    };
  }

  return {
    url: buildOkDrazbyUrl(getDefaultOkDrazbyConfig()),
  };
}

async function main(): Promise<void> {
  await runManualScrape({
    sourceName: "OkDrazby",
    errorLabel: "OkDrazby",
    createScraper: () => new OkDrazbyScraper(),
    initialize: (scraper) => scraper.initialize(),
    resolveTarget,
    scrape: (scraper, target) => scraper.scrapeProperties(target.url),
    close: (scraper) => scraper.close(),
    logTarget: (target) => {
      console.log("Initializing OkDrazby scraper...");
      console.log(`\nScraping URL: ${target.url}`);
      if (target.scrapeId) {
        console.log(`Scrape ID: ${target.scrapeId}`);
      }
    },
    emptyState: [
      "No properties found. This might mean:",
      "- The website structure has changed",
      "- The search criteria are too restrictive",
      "- The website requires additional authentication or has anti-bot measures",
    ],
    logProperty: (property, index) =>
      logPropertySummary(property, index, {
        detail: "short",
      }),
    successMessage: (count) => `Successfully scraped ${count} properties`,
  });
}

if (require.main === module) {
  main();
}
