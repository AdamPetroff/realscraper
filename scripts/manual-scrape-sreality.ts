import { SrealityScraper } from "../src/scrapers/SrealityScraper";
import {
  DEFAULT_SREALITY_CONFIG,
  buildSrealityUrl,
  SrealityScraperConfig,
} from "../src/config";
import { Property } from "../src/types";

async function logProperty(property: Property, index: number): Promise<void> {
  console.log(`\n=== Property ${index + 1} ===`);
  console.log(`Title: ${property.title || "N/A"}`);
  console.log(`Price: ${property.price || "N/A"}`);
  console.log(`Location: ${property.location || "N/A"}`);
  console.log(`Area: ${property.area || "N/A"}`);
  console.log(`Rooms: ${property.rooms || "N/A"}`);
  console.log(`URL: ${property.url || "N/A"}`);
  console.log(`Images: ${property.images?.length || 0}`);
  console.log(`Image 1: ${property.images?.[0] || "N/A"}`);
  if (property.description) {
    console.log(
      `Description: ${property.description.substring(0, 100)}${
        property.description.length > 100 ? "..." : ""
      }`
    );
  }
  console.log(`Is New: ${property.isNew ? "Yes" : "No"}`);
}

async function main(): Promise<void> {
  const scraper = new SrealityScraper();

  try {
    console.log("Initializing Sreality scraper...");
    await scraper.initialize();

    const config: SrealityScraperConfig = {
      ...DEFAULT_SREALITY_CONFIG,
      // You can override default config here for testing
      // e.g., priceMax: 7000000,
      // locationSlug: "praha",
    };

    const url = buildSrealityUrl(config);
    console.log(`\nScraping URL: ${url}`);
    console.log("Search parameters:", config);

    const properties = await scraper.scrapeProperties(url, {
      newOnly: config.newOnly,
    });

    console.log(`\n🏠 Found ${properties.length} properties:`);

    if (properties.length === 0) {
      console.log("No properties found. This might mean:");
      console.log("- The website structure has changed");
      console.log("- The search criteria are too restrictive");
      console.log(
        "- The website requires additional authentication or has anti-bot measures"
      );
    } else {
      for (let i = 0; i < properties.length; i++) {
        await logProperty(properties[i], i);
      }
      console.log(`\n✅ Successfully scraped ${properties.length} properties`);
    }
  } catch (error) {
    console.error("❌ Error running Sreality scraper:", error);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}
