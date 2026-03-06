import { BezrealitkyScraper } from "../src/scrapers";
import {
  DEFAULT_BEZREALITKY_CONFIG,
  BezrealitkyScraperConfig,
  buildBezrealitkyUrl,
} from "../src/config";
import { Property } from "../src/types";
import { ScrapeOptions } from "../src/scrapers/scraper.interface";

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

  // Allow custom URL as first argument for backward compatibility
  const urlArg = rawArgs.find((arg) => !arg.startsWith("--"));

  let targetUrl: string;
  if (urlArg) {
    targetUrl = urlArg;
  } else {
    // Build URL from config (with optional env overrides)
    const config: BezrealitkyScraperConfig = {
      ...DEFAULT_BEZREALITKY_CONFIG,
      newOnly: false,
      priceFrom: 0,
      priceTo: 10_000_000
    };
    targetUrl = buildBezrealitkyUrl(config);
  }

  if (
    rawArgs.includes("--new-only") ||
    process.env.BEZREALITKY_NEW_ONLY === "true"
  ) {
    options.newOnly = true;
  } else {
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
