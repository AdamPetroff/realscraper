import { BezrealitkyScraper } from "../src/scrapers";
import {
  DEFAULT_BEZREALITKY_CONFIG,
  type BezrealitkyScraperConfig,
  buildBezrealitkyUrl,
} from "../src/config";
import { type ScrapeOptions } from "../src/scrapers/scraper.interface";
import {
  getDefaultScrapeConfig,
  getScrapeConfigById,
  logPropertySummary,
  runManualScrape,
  type ParsedManualScrapeArgs,
} from "./manual-scrape-utils";

function getDefaultBezrealitkyConfig(): BezrealitkyScraperConfig {
  return {
    ...getDefaultScrapeConfig("bezrealitky"),
    newOnly: false,
  };
}

function getBezrealitkyConfigById(id: string): BezrealitkyScraperConfig {
  return {
    ...getScrapeConfigById(id, "bezrealitky"),
    newOnly: false,
  };
}

function resolveTarget(args: ParsedManualScrapeArgs): {
  url: string;
  options: ScrapeOptions;
} {
  const options: ScrapeOptions = {};

  if (args.scrapeId) {
    const config = getBezrealitkyConfigById(args.scrapeId);
    options.newOnly = config.newOnly;

    return {
      url: buildBezrealitkyUrl(config),
      options,
    };
  }

  if (args.urlArg) {
    if (
      args.rawArgs.includes("--new-only") ||
      process.env.BEZREALITKY_NEW_ONLY === "true"
    ) {
      options.newOnly = true;
    } else {
      options.newOnly = DEFAULT_BEZREALITKY_CONFIG.newOnly || false;
    }

    return {
      url: args.urlArg,
      options,
    };
  }

  const config = getDefaultBezrealitkyConfig();
  options.newOnly = config.newOnly;

  if (
    args.rawArgs.includes("--new-only") ||
    process.env.BEZREALITKY_NEW_ONLY === "true"
  ) {
    options.newOnly = true;
  } else if (typeof options.newOnly !== "boolean") {
    options.newOnly = DEFAULT_BEZREALITKY_CONFIG.newOnly || false;
  }

  return {
    url: buildBezrealitkyUrl(config),
    options,
  };
}

async function main(): Promise<void> {
  await runManualScrape({
    sourceName: "Bezrealitky",
    errorLabel: "Bezrealitky",
    createScraper: () => new BezrealitkyScraper(),
    resolveTarget,
    scrape: (scraper, target) =>
      scraper.scrapeProperties(target.url, target.options),
    logTarget: (target) => {
      console.log("Starting Bezrealitky scraper (using native fetch)...");
      console.log(`\nScraping URL: ${target.url}`);
    },
    emptyState: [
      "No properties found. This might mean:",
      "- The website structure has changed",
      "- The search criteria are too restrictive",
      "- The website requires additional authentication or has anti-bot measures",
      "",
      "Try adjusting the search parameters via the URL argument or BEZREALITKY_* env variables.",
      "Available env vars: BEZREALITKY_DISPOSITIONS, BEZREALITKY_PRICE_FROM, BEZREALITKY_PRICE_TO, etc.",
    ],
    logProperty: (property, index) =>
      logPropertySummary(property, index, {
        header: "Bezrealitky Property",
        detail: "long",
      }),
  });
}

if (require.main === module) {
  main();
}
