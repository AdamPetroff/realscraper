import { RealityScraper } from "../src/scraper";
import { DEFAULT_CONFIG, buildUrl, ScraperConfig } from "../src/config";
import { Property } from "../src/types";

async function logProperty(property: Property, index: number): Promise<void> {
  console.log(`\n=== Property ${index + 1} ===`);
  console.log(`Title: ${property.title || "N/A"}`);
  console.log(`Price: ${property.price || "N/A"}`);
  console.log(`Location: ${property.location || "N/A"}`);
  console.log(`Area: ${property.area || "N/A"}`);
  console.log(`Rooms: ${property.rooms || "N/A"}`);
  console.log(`URL: ${property.url || "N/A"}`);
  if (property.description) {
    console.log(
      `Description: ${property.description.substring(0, 100)}${
        property.description.length > 100 ? "..." : ""
      }`
    );
  }
}

async function main(): Promise<void> {
  const scraper = new RealityScraper();

  try {
    console.log("Initializing scraper...");
    await scraper.initialize();

    // You can modify these constants to adjust the search parameters
    const config: ScraperConfig = {
      ...DEFAULT_CONFIG,
      // Uncomment and modify any of these to override defaults:
      // priceMin: 2000000,
      // priceMax: 5000000,
      // city: "praha",
      // rooms: "3k|31",
      // areaMin: 50,
      // roomCount: 4
    };

    const url = buildUrl(config);
    console.log(`\nScraping URL: ${url}`);
    console.log(`Search parameters:
      - Price range: ${config.priceMin.toLocaleString()} - ${config.priceMax.toLocaleString()} CZK
      - City: ${config.city}
      - Rooms: ${config.rooms}
      - Min area: ${config.areaMin} m²
      - Ownership: ${config.ownership}
      - Materials: ${config.material}
      - Room count filter: ${config.roomCount}
      ${config.articleAge ? `- Article age: ${config.articleAge}` : ""}
    `);

    const properties = await scraper.scrapeProperties(url);

    console.log(`\n🏠 Found ${properties.length} properties:`);

    if (properties.length === 0) {
      console.log("No properties found. This might mean:");
      console.log("- The website structure has changed");
      console.log("- The search criteria are too restrictive");
      console.log(
        "- The website requires additional authentication or has anti-bot measures"
      );
      console.log(
        "\nTry adjusting the search parameters in the config object."
      );
    } else {
      for (let i = 0; i < properties.length; i++) {
        await logProperty(properties[i], i);
      }

      console.log(`\n✅ Successfully scraped ${properties.length} properties`);
    }
  } catch (error) {
    console.error("❌ Error running scraper:", error);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}
