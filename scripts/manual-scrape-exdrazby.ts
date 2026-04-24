import { ExDrazbyScraper } from "../src/scrapers/ExDrazbyScraper";
import { buildExDrazbyUrl, type ExDrazbyScraperConfig } from "../src/config";
import {
  getDefaultScrapeConfig,
  getScrapeConfigById,
  logPropertySummary,
  runManualScrape,
  type ParsedManualScrapeArgs,
} from "./manual-scrape-utils";

function getDefaultExDrazbyConfig(): ExDrazbyScraperConfig {
  return getDefaultScrapeConfig("exdrazby");
}

function getExDrazbyConfigById(id: string): ExDrazbyScraperConfig {
  return getScrapeConfigById(id, "exdrazby");
}

function resolveTarget(args: ParsedManualScrapeArgs): {
  url: string;
  scrapeId?: string;
} {
  if (args.scrapeId) {
    return {
      scrapeId: args.scrapeId,
      url: buildExDrazbyUrl(getExDrazbyConfigById(args.scrapeId)),
    };
  }

  if (args.urlArg) {
    return {
      url: args.urlArg,
    };
  }

  return {
    url: buildExDrazbyUrl(getDefaultExDrazbyConfig()),
  };
}

async function main(): Promise<void> {
  await runManualScrape({
    sourceName: "ExDrazby",
    errorLabel: "ExDrazby",
    createScraper: () => new ExDrazbyScraper(),
    initialize: (scraper) => scraper.initialize(),
    resolveTarget,
    scrape: (scraper, target) => scraper.scrapeProperties(target.url),
    close: (scraper) => scraper.close(),
    logTarget: (target) => {
      console.log("Initializing ExDrazby scraper...");
      console.log(`\nScraping URL: ${target.url}`);
      if (target.scrapeId) {
        console.log(`Scrape ID: ${target.scrapeId}`);
      }
    },
    logProperty: (property, index) =>
      logPropertySummary(property, index, {
        detail: "default",
      }),
    successMessage: (count) => `Successfully scraped ${count} properties`,
  });
}

if (require.main === module) {
  main();
}
