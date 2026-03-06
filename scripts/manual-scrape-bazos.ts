import { BazosScraper } from "../src/scrapers/BazosScraper";
import {
  buildBazosUrl,
  type BazosScraperConfig,
} from "../src/config";
import { Property } from "../src/types";
import { SCRAPES, type BazosScrapeConfig } from "../src/scrape-configs";

function getDefaultBazosConfig(): BazosScraperConfig {
  const scrape = SCRAPES.find(
    (entry): entry is BazosScrapeConfig => entry.type === "bazos"
  );

  if (!scrape) {
    throw new Error("No Bazos scrape config found in SCRAPES");
  }

  return { ...scrape.config, recentOnly: false };
}

async function logProperty(property: Property, index: number): Promise<void> {
  console.log(`\n=== Bazos Property ${index + 1} ===`);
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
  console.log(`From today: ${property.isNew ? "Yes" : "No"}`);
  if (property.description) {
    console.log(
      `Description: ${property.description.substring(0, 150)}${
        property.description.length > 150 ? "..." : ""
      }`
    );
  }
  if (property.images?.length) {
    console.log(`Images (${property.images.length}):`);
    property.images.slice(0, 3).forEach((image, imageIndex) => {
      console.log(`  ${imageIndex + 1}. ${image}`);
    });
    if (property.images.length > 3) {
      console.log(`  ...and ${property.images.length - 3} more`);
    }
  }
}

function parseCli(): { url: string; includeAll: boolean } {
  const rawArgs = process.argv.slice(2);

  // --all flag to include all listings, not just recent ones
  const includeAll = rawArgs.includes("--all");

  // Allow custom URL as first argument
  const urlArg = rawArgs.find((arg) => !arg.startsWith("--"));

  let targetUrl: string;
  if (urlArg) {
    targetUrl = urlArg;
  } else {
    // Build URL from config (with optional env overrides)
    const config: BazosScraperConfig = {
      ...getDefaultBazosConfig(),
      ...(process.env.BAZOS_LOCATION_CODE
        ? { locationCode: process.env.BAZOS_LOCATION_CODE }
        : {}),
      ...(process.env.BAZOS_RADIUS_KM
        ? { radiusKm: parseInt(process.env.BAZOS_RADIUS_KM) }
        : {}),
      ...(process.env.BAZOS_PRICE_MIN
        ? { priceMin: parseInt(process.env.BAZOS_PRICE_MIN) }
        : {}),
      ...(process.env.BAZOS_PRICE_MAX
        ? { priceMax: parseInt(process.env.BAZOS_PRICE_MAX) }
        : {}),
    };
    targetUrl = buildBazosUrl(config);
  }

  return { url: targetUrl, includeAll };
}

async function main(): Promise<void> {
  const { url: targetUrl, includeAll } = parseCli();
  const scraper = new BazosScraper();

  try {
    console.log("Starting Bazos.cz scraper (using native fetch)...");
    console.log(`\nScraping URL: ${targetUrl}`);
    console.log(`Mode: ${includeAll ? "All listings" : "Today only"}`);

    // Pass newOnly: false if --all flag is used
    const properties = await scraper.scrapeProperties(targetUrl, {
      newOnly: !includeAll,
    });

    console.log(`\n🏠 Found ${properties.length} properties on Bazos.cz:`);

    if (properties.length === 0) {
      console.log("No properties found. This might mean:");
      console.log("- No listings from today (try --all flag to see all)");
      console.log("- The website structure has changed");
      console.log("- The search criteria are too restrictive");
      console.log(
        "\nTry adjusting the search parameters via the URL argument or BAZOS_* env variables."
      );
      console.log(
        "Available env vars: BAZOS_LOCATION_CODE, BAZOS_RADIUS_KM, BAZOS_PRICE_MIN, BAZOS_PRICE_MAX"
      );
      console.log("Flags: --all (include all listings, not just recent)");
    } else {
      for (let i = 0; i < properties.length; i++) {
        await logProperty(properties[i], i);
      }

      console.log(
        `\n✅ Successfully scraped ${properties.length} properties from Bazos.cz`
      );
    }
  } catch (error) {
    console.error("❌ Error running Bazos scraper:", error);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}

