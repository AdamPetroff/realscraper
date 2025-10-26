import { BezrealitkyScraper } from "../src/scrapers";
import { DEFAULT_BEZREALITKY_URL } from "../src/config";
import { Property } from "../src/types";
import { ScrapeOptions } from "../src/scrapers/scraper.interface";

async function logProperty(property: Property, index: number): Promise<void> {
  console.log(`\n=== Bezrealitky Property ${index + 1} ===`);
  console.log(`Title: ${property.title || "N/A"}`);
  console.log(`Price: ${property.price || "N/A"}`);
  console.log(`Location: ${property.location || "N/A"}`);
  console.log(`Area: ${property.area || "N/A"}`);
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
  const urlArg = rawArgs.find((arg) => !arg.startsWith("--"));
  const targetUrl =
    urlArg || process.env.BEZREALITKY_URL || DEFAULT_BEZREALITKY_URL;

  if (
    rawArgs.includes("--new-only") ||
    process.env.BEZREALITKY_NEW_ONLY === "true"
  ) {
    options.newOnly = true;
  }

  return { url: targetUrl, options };
}

async function main(): Promise<void> {
  const { url: targetUrl, options } = parseCli();
  const scraper = new BezrealitkyScraper();

  try {
    console.log("Initializing Bezrealitky scraper...");
    await scraper.initialize();

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
        "\nTry adjusting the search parameters via the URL or BEZREALITKY_URL env variable."
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
  } finally {
    await scraper.close();
  }
}

if (require.main === module) {
  main();
}
