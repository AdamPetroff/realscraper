import { IdnesScraper } from "../src/scrapers/IdnesScraper";
import {
  buildIdnesUrl,
  type IdnesScraperConfig,
} from "../src/config";
import { Property } from "../src/types";
import {
  SCRAPES,
  getScrapeById,
  type IdnesScrapeConfig,
} from "../src/scrape-configs";

function getDefaultIdnesConfig(): IdnesScraperConfig {
  const scrape = SCRAPES.find(
    (entry): entry is IdnesScrapeConfig => entry.type === "idnes"
  );

  if (!scrape) {
    throw new Error("No IDNES scrape config found in SCRAPES");
  }

  return { ...scrape.config, freshness: "week" };
}

function getIdnesConfigById(id: string): IdnesScraperConfig {
  const scrape = getScrapeById(id);

  if (!scrape) {
    throw new Error(`Unknown scrape ID "${id}"`);
  }

  if (scrape.type !== "idnes") {
    throw new Error(`Scrape ID "${id}" is for ${scrape.type}, not idnes`);
  }

  return { ...scrape.config, freshness: "week" };
}

async function logProperty(property: Property, index: number): Promise<void> {
  console.log(`\n=== Property ${index + 1} ===`);
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
  console.log(`Images: ${property.images?.length || 0}`);
  console.log(`Image 1: ${property.images?.[0] || "N/A"}`);
  if (property.description) {
    console.log(
      `Description: ${property.description.substring(0, 100)}${
        property.description.length > 100 ? "..." : ""
      }`
    );
  }
}

async function main(): Promise<void> {
  const scraper = new IdnesScraper();

  try {
    console.log("Initializing scraper...");
    await scraper.initialize();
    const rawArgs = process.argv.slice(2);
    const idFlagIndex = rawArgs.indexOf("--id");
    const idFromFlag =
      idFlagIndex >= 0 ? rawArgs[idFlagIndex + 1] : undefined;
    const positionalArg = rawArgs.find((arg) => !arg.startsWith("--"));
    const scrapeId =
      idFromFlag ?? (positionalArg && getScrapeById(positionalArg) ? positionalArg : undefined);

    const config: IdnesScraperConfig = {
      ...(scrapeId ? getIdnesConfigById(scrapeId) : getDefaultIdnesConfig()),
    };

    const url = buildIdnesUrl(config);
    console.log(`\nScraping URL: ${url}`);
    if (scrapeId) {
      console.log(`Scrape ID: ${scrapeId}`);
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
    } else {
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
      console.log(properties);
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
