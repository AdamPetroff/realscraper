import { BezrealitkyScraper } from "../src/scrapers";
import {
  DEFAULT_BEZREALITKY_CONFIG,
  BezrealitkyScraperConfig,
  buildBezrealitkyUrl,
} from "../src/config";
import { Property } from "../src/types";
import { ScrapeOptions } from "../src/scrapers/scraper.interface";
import {
  SCRAPES,
  getScrapeById,
  type BezrealitkyScrapeConfig,
} from "../src/scrape-configs";

function getDefaultBezrealitkyConfig(): BezrealitkyScraperConfig {
  const scrape = SCRAPES.find(
    (entry): entry is BezrealitkyScrapeConfig => entry.type === "bezrealitky"
  );

  if (!scrape) {
    throw new Error("No Bezrealitky scrape config found in SCRAPES");
  }

  return { ...scrape.config, newOnly: false };
}

function getBezrealitkyConfigById(id: string): BezrealitkyScraperConfig {
  const scrape = getScrapeById(id);

  if (!scrape) {
    throw new Error(`Unknown scrape ID "${id}"`);
  }

  if (scrape.type !== "bezrealitky") {
    throw new Error(
      `Scrape ID "${id}" is for ${scrape.type}, not bezrealitky`
    );
  }

  return { ...scrape.config, newOnly: false };
}

async function logProperty(property: Property, index: number): Promise<void> {
  console.log(`\n=== Bezrealitky Property ${index + 1} ===`);
  console.log(`Title: ${property.title || "N/A"}`);
  console.log(`Price: ${property.price || "N/A"}`);
  console.log(`Location: ${property.location || "N/A"}`);
  console.log(`District (Okres): ${property.district || "N/A"}`);
  console.log(`Region (Kraj): ${property.region || "N/A"}`);
  console.log(`Area: ${property.area || "N/A"}`);
  console.log(
    `Price per m²: ${
      typeof property.pricePerSqm === "number"
        ? `${new Intl.NumberFormat("cs-CZ").format(property.pricePerSqm)} Kč/m²`
        : "N/A"
    }`
  );
  console.log(`Rooms: ${property.rooms || "N/A"}`);
  console.log(`URL: ${property.url || "N/A"}`);
  if (property.description) {
    console.log(`Description: ${property.description}`);
  }
  if (property.images?.length) {
    console.log(`Images (${property.images.length}):`);
    property.images.slice(0, 5).forEach((image, imageIndex) => {
      console.log(`  ${imageIndex + 1}. ${image}`);
    });
    if (property.images.length > 5) {
      console.log(`  ...and ${property.images.length - 5} more`);
    }
  }
}

function parseCli(): { url: string; options: ScrapeOptions } {
  const rawArgs = process.argv.slice(2);

  const options: ScrapeOptions = {};
  const idFlagIndex = rawArgs.indexOf("--id");
  const idFromFlag =
    idFlagIndex >= 0 ? rawArgs[idFlagIndex + 1] : undefined;
  const positionalArg = rawArgs.find((arg) => !arg.startsWith("--"));
  const scrapeId =
    idFromFlag ?? (positionalArg && getScrapeById(positionalArg) ? positionalArg : undefined);

  const urlArg = positionalArg && scrapeId !== positionalArg ? positionalArg : undefined;

  let targetUrl: string;
  if (scrapeId) {
    const config = getBezrealitkyConfigById(scrapeId);
    targetUrl = buildBezrealitkyUrl(config);
    options.newOnly = config.newOnly;
  } else if (urlArg) {
    targetUrl = urlArg;
  } else {
    const config: BezrealitkyScraperConfig = {
      ...getDefaultBezrealitkyConfig(),
    };
    targetUrl = buildBezrealitkyUrl(config);
    options.newOnly = config.newOnly;
  }

  if (
    rawArgs.includes("--new-only") ||
    process.env.BEZREALITKY_NEW_ONLY === "true"
  ) {
    options.newOnly = true;
  } else if (typeof options.newOnly !== "boolean") {
    options.newOnly = DEFAULT_BEZREALITKY_CONFIG.newOnly || false;
  }

  return { url: targetUrl, options };
}

async function main(): Promise<void> {
  const { url: targetUrl, options } = parseCli();
  const scraper = new BezrealitkyScraper();

  try {
    console.log("Starting Bezrealitky scraper (using native fetch)...");
    console.log(`\nScraping URL: ${targetUrl}`);

    const properties = await scraper.scrapeProperties(targetUrl, options);

    console.log(`\n🏠 Found ${properties.length} properties on Bezrealitky:`);

    if (properties.length === 0) {
      console.log("No properties found. This might mean:");
      console.log("- The website structure has changed");
      console.log("- The search criteria are too restrictive");
      console.log(
        "- The website requires additional authentication or has anti-bot measures"
      );
      console.log(
        "\nTry adjusting the search parameters via the URL argument or BEZREALITKY_* env variables."
      );
      console.log(
        "Available env vars: BEZREALITKY_DISPOSITIONS, BEZREALITKY_PRICE_FROM, BEZREALITKY_PRICE_TO, etc."
      );
    } else {
      for (let i = 0; i < properties.length; i++) {
        await logProperty(properties[i], i);
      }

      console.log(
        `\n✅ Successfully scraped ${properties.length} properties from Bezrealitky`
      );
    }
  } catch (error) {
    console.error("❌ Error running Bezrealitky scraper:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
