import { IdnesScraper } from "../src/scrapers/IdnesScraper";
import { buildIdnesUrl, type IdnesScraperConfig } from "../src/config";
import {
  getDefaultScrapeConfig,
  getScrapeConfigById,
  logPropertySummary,
  runManualScrape,
  type ParsedManualScrapeArgs,
} from "./manual-scrape-utils";

function getDefaultIdnesConfig(): IdnesScraperConfig {
  return getDefaultScrapeConfig("idnes");
}

function getIdnesConfigById(id: string): IdnesScraperConfig {
  return getScrapeConfigById(id, "idnes");
}

function resolveTarget(args: ParsedManualScrapeArgs): {
  url: string;
  scrapeId?: string;
  config?: IdnesScraperConfig;
} {
  if (args.urlArg) {
    return {
      url: args.urlArg,
      scrapeId: args.scrapeId,
    };
  }

  const config = args.scrapeId
    ? getIdnesConfigById(args.scrapeId)
    : getDefaultIdnesConfig();

  return {
    url: buildIdnesUrl(config),
    scrapeId: args.scrapeId,
    config,
  };
}

function logSearchParameters(config: IdnesScraperConfig | undefined): void {
  if (!config) {
    console.log("Search parameters: direct URL");
    return;
  }

  if (config.propertyKind === "land") {
    console.log(`Search parameters:
      - Property kind: land
      - City: ${config.city}
      - Land subtype: ${config.landSubtype}
      - Price min: ${typeof config.priceMin === "number" ? config.priceMin.toLocaleString() : "N/A"} CZK
      - Price max: ${typeof config.priceMax === "number" ? config.priceMax.toLocaleString() : "N/A"} CZK
      - Ownership: ${config.ownership || "N/A"}
      - Room count filter: ${typeof config.roomCount === "number" ? config.roomCount : "N/A"}
      ${config.freshness ? `- Freshness: ${config.freshness}` : ""}
    `);
    return;
  }

  if (config.propertyKind === "house") {
    console.log(`Search parameters:
      - Property kind: house
      - City/region: ${config.city}
      - House subtype: ${config.houseSubtype || "N/A"}
      - Price min: ${typeof config.priceMin === "number" ? config.priceMin.toLocaleString() : "N/A"} CZK
      - Price max: ${typeof config.priceMax === "number" ? config.priceMax.toLocaleString() : "N/A"} CZK
      - Min room count: ${typeof config.roomCount === "number" ? config.roomCount : "N/A"}
      - Min area: ${typeof config.areaMin === "number" ? config.areaMin : "N/A"} m²
      - Ownership: ${config.ownership || "N/A"}
      - Condition: ${config.condition || "N/A"}
      - Materials: ${config.material || "N/A"}
      ${config.freshness ? `- Freshness: ${config.freshness}` : ""}
    `);
    return;
  }

  console.log(`Search parameters:
      - Property kind: apartment
      - Price range: ${config.priceMin.toLocaleString()} - ${config.priceMax.toLocaleString()} CZK
      - City: ${config.city}
      - Rooms: ${config.rooms}
      - Min area: ${config.areaMin} m²
      - Ownership: ${config.ownership}
      - Materials: ${config.material}
      - Room count filter: ${config.roomCount}
      ${config.freshness ? `- Freshness: ${config.freshness}` : ""}
    `);
}

async function main(): Promise<void> {
  await runManualScrape({
    sourceName: "IDNES",
    errorLabel: "IDNES",
    createScraper: () => new IdnesScraper(),
    initialize: (scraper) => scraper.initialize(),
    resolveTarget,
    scrape: (scraper, target) => scraper.scrapeProperties(target.url),
    close: (scraper) => scraper.close(),
    logTarget: (target) => {
      console.log("Initializing scraper...");
      console.log(`\nScraping URL: ${target.url}`);
      if (target.scrapeId) {
        console.log(`Scrape ID: ${target.scrapeId}`);
      }
      logSearchParameters(target.config as IdnesScraperConfig | undefined);
    },
    emptyState: [
      "No properties found. This might mean:",
      "- The website structure has changed",
      "- The search criteria are too restrictive",
      "- The website requires additional authentication or has anti-bot measures",
      "",
      "Try adjusting the search parameters in the config object.",
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
