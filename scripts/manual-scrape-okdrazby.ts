import { OkDrazbyScraper } from "../src/scrapers/OkDrazbyScraper";
import {
  buildOkDrazbyUrl,
  type OkDrazbyScraperConfig,
} from "../src/config";
import { Property } from "../src/types";
import {
  SCRAPES,
  getScrapeById,
  type OkDrazbyScrapeConfig,
} from "../src/scrape-configs";

function getDefaultOkDrazbyConfig(): OkDrazbyScraperConfig {
  const scrape = SCRAPES.find(
    (entry): entry is OkDrazbyScrapeConfig => entry.type === "okdrazby",
  );

  if (!scrape) {
    throw new Error("No OkDrazby scrape config found in SCRAPES");
  }

  return { ...scrape.config };
}

function getOkDrazbyConfigById(id: string): OkDrazbyScraperConfig {
  const scrape = getScrapeById(id);

  if (!scrape) {
    throw new Error(`Unknown scrape ID "${id}"`);
  }

  if (scrape.type !== "okdrazby") {
    throw new Error(`Scrape ID "${id}" is for ${scrape.type}, not okdrazby`);
  }

  return { ...scrape.config };
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
}

function parseCli(): { url: string; scrapeId?: string } {
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
    return {
      scrapeId,
      url: buildOkDrazbyUrl(getOkDrazbyConfigById(scrapeId)),
    };
  }

  if (urlArg) {
    return {
      url: urlArg,
    };
  }

  return {
    url: buildOkDrazbyUrl(getDefaultOkDrazbyConfig()),
  };
}

async function main(): Promise<void> {
  const scraper = new OkDrazbyScraper();

  try {
    console.log("Initializing OkDrazby scraper...");
    await scraper.initialize();

    const { url, scrapeId } = parseCli();
    console.log(`\nScraping URL: ${url}`);
    if (scrapeId) {
      console.log(`Scrape ID: ${scrapeId}`);
    }

    const properties = await scraper.scrapeProperties(url);

    console.log(`\n🏠 Found ${properties.length} properties:`);

    if (properties.length === 0) {
      console.log("No properties found. This might mean:");
      console.log("- The website structure has changed");
      console.log("- The search criteria are too restrictive");
      console.log(
        "- The website requires additional authentication or has anti-bot measures",
      );
    } else {
      for (let i = 0; i < properties.length; i += 1) {
        await logProperty(properties[i], i);
      }

      console.log(`\n✅ Successfully scraped ${properties.length} properties`);
    }
  } catch (error) {
    console.error("❌ Error running OkDrazby scraper:", error);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}
