import { ExDrazbyScraper } from "../src/scrapers/ExDrazbyScraper";
import { buildExDrazbyUrl, type ExDrazbyScraperConfig } from "../src/config";
import type { ScrapeConfig } from "../src/scrape-configs";
import {
  getDefaultScrapeConfig,
  getScrapeConfigById,
  logPropertySummary,
  runManualScrape,
  type ParsedManualScrapeArgs,
} from "./manual-scrape-utils";

function getDefaultExDrazbyConfig(
  scrapes: ScrapeConfig[],
): ExDrazbyScraperConfig {
  return getDefaultScrapeConfig(scrapes, "exdrazby");
}

function getExDrazbyConfigById(
  scrapes: ScrapeConfig[],
  id: string,
): ExDrazbyScraperConfig {
  return getScrapeConfigById(scrapes, id, "exdrazby");
}

function resolveTarget(
  args: ParsedManualScrapeArgs,
  scrapes: ScrapeConfig[],
): {
  url: string;
  scrapeId?: string;
} {
  if (args.scrapeId) {
    return {
      scrapeId: args.scrapeId,
      url: buildExDrazbyUrl(getExDrazbyConfigById(scrapes, args.scrapeId)),
    };
  }

  if (args.urlArg) {
    return {
      url: args.urlArg,
    };
  }

  return {
    url: buildExDrazbyUrl(getDefaultExDrazbyConfig(scrapes)),
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
