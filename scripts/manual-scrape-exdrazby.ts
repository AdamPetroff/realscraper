import { ExDrazbyScraper } from "../src/scrapers/ExDrazbyScraper";
import {
  buildExDrazbyUrl,
  type ExDrazbyScraperConfig,
} from "../src/config";
import { Property } from "../src/types";
import {
  SCRAPES,
  getScrapeById,
  type ExDrazbyScrapeConfig,
} from "../src/scrape-configs";

function getDefaultExDrazbyConfig(): ExDrazbyScraperConfig {
  const scrape = SCRAPES.find(
    (entry): entry is ExDrazbyScrapeConfig => entry.type === "exdrazby",
  );

  if (!scrape) {
    throw new Error("No ExDrazby scrape config found in SCRAPES");
  }

  return { ...scrape.config };
}

function getExDrazbyConfigById(id: string): ExDrazbyScraperConfig {
  const scrape = getScrapeById(id);

  if (!scrape) {
    throw new Error(`Unknown scrape ID "${id}"`);
  }

  if (scrape.type !== "exdrazby") {
    throw new Error(`Scrape ID "${id}" is for ${scrape.type}, not exdrazby`);
  }

  return { ...scrape.config };
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
      url: buildExDrazbyUrl(getExDrazbyConfigById(scrapeId)),
    };
  }

  if (urlArg) {
    return { url: urlArg };
  }

  return {
    url: buildExDrazbyUrl(getDefaultExDrazbyConfig()),
  };
}

function logProperty(property: Property, index: number): void {
  console.log(`\n=== Property ${index + 1} ===`);
  console.log(`Title: ${property.title || "N/A"}`);
  console.log(`Price: ${property.price || "N/A"}`);
  console.log(`Location: ${property.location || "N/A"}`);
  console.log(`District (Okres): ${property.district || "N/A"}`);
  console.log(`Region (Kraj): ${property.region || "N/A"}`);
  console.log(`Rooms: ${property.rooms || "N/A"}`);
  console.log(`URL: ${property.url || "N/A"}`);
  console.log(`Images: ${property.images?.length || 0}`);
  console.log(`Image 1: ${property.images?.[0] || "N/A"}`);
}

async function main(): Promise<void> {
  const scraper = new ExDrazbyScraper();

  try {
    console.log("Initializing ExDrazby scraper...");
    await scraper.initialize();

    const { url, scrapeId } = parseCli();
    console.log(`\nScraping URL: ${url}`);
    if (scrapeId) {
      console.log(`Scrape ID: ${scrapeId}`);
    }

    const properties = await scraper.scrapeProperties(url);

    console.log(`\n🏠 Found ${properties.length} properties:`);

    if (properties.length === 0) {
      console.log("No properties found.");
      return;
    }

    for (let i = 0; i < properties.length; i += 1) {
      logProperty(properties[i], i);
    }

    console.log(`\n✅ Successfully scraped ${properties.length} properties`);
  } catch (error) {
    console.error("❌ Error running ExDrazby scraper:", error);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}
