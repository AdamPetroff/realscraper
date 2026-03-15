import { SrealityScraper } from "../src/scrapers/SrealityScraper";
import { buildSrealityUrl, type SrealityScraperConfig } from "../src/config";
import { Property } from "../src/types";
import {
  SCRAPES,
  getScrapeById,
  type SrealityScrapeConfig,
} from "../src/scrape-configs";

function getDefaultSrealityConfig(): SrealityScraperConfig {
  const scrape = SCRAPES.find(
    (entry): entry is SrealityScrapeConfig => entry.type === "sreality",
  );

  if (!scrape) {
    throw new Error("No Sreality scrape config found in SCRAPES");
  }

  return { ...scrape.config, age: "tyden" };
}

function getSrealityConfigById(id: string): SrealityScraperConfig {
  const scrape = getScrapeById(id);

  if (!scrape) {
    throw new Error(`Unknown scrape ID "${id}"`);
  }

  if (scrape.type !== "sreality") {
    throw new Error(`Scrape ID "${id}" is for ${scrape.type}, not sreality`);
  }

  return { ...scrape.config, age: "dnes" };
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
    }`,
  );
  console.log(`Rooms: ${property.rooms || "N/A"}`);
  console.log(`URL: ${property.url || "N/A"}`);
  console.log(`Images: ${property.images?.length || 0}`);
  console.log(`Image 1: ${property.images?.[0] || "N/A"}`);
  if (property.description) {
    console.log(
      `Description: ${property.description.substring(0, 100)}${
        property.description.length > 100 ? "..." : ""
      }`,
    );
  }
  console.log(`Is New: ${property.isNew ? "Yes" : "No"}`);
}

function parseCli(): { url: string; options: { newOnly?: boolean } } {
  const rawArgs = process.argv.slice(2);
  const idFlagIndex = rawArgs.indexOf("--id");
  const idFromFlag = idFlagIndex >= 0 ? rawArgs[idFlagIndex + 1] : undefined;
  const positionalArg = rawArgs.find((arg) => !arg.startsWith("--"));
  const scrapeId =
    idFromFlag ??
    (positionalArg && getScrapeById(positionalArg) ? positionalArg : undefined);
  const urlArg =
    positionalArg && scrapeId !== positionalArg ? positionalArg : undefined;

  if (scrapeId) {
    const config = getSrealityConfigById(scrapeId);
    return {
      url: buildSrealityUrl(config),
      options: {
        newOnly: config.newOnly,
      },
    };
  }

  if (urlArg) {
    return {
      url: urlArg,
      options: {
        newOnly: rawArgs.includes("--new-only"),
      },
    };
  }

  const config: SrealityScraperConfig = {
    ...getDefaultSrealityConfig(),
    age: "tyden",
  };

  return {
    url: buildSrealityUrl(config),
    options: {
      newOnly: config.newOnly,
    },
  };
}

async function main(): Promise<void> {
  const scraper = new SrealityScraper();

  try {
    console.log("Initializing Sreality scraper...");
    await scraper.initialize();
    const { url, options } = parseCli();
    console.log(`\nScraping URL: ${url}`);

    const properties = await scraper.scrapeProperties(url, options);

    console.log(`\n🏠 Found ${properties.length} properties:`);

    if (properties.length === 0) {
      console.log("No properties found. This might mean:");
      console.log("- The website structure has changed");
      console.log("- The search criteria are too restrictive");
      console.log(
        "- The website requires additional authentication or has anti-bot measures",
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
