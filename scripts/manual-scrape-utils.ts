import { DEFAULT_MORTGAGE_ESTIMATE_CONFIG } from "../src/config";
import { formatMonthlyMortgageEstimate } from "../src/mortgage-estimate";
import type { Property } from "../src/types";
import { SCRAPES, getScrapeById, type ScrapeConfig, type ScraperType } from "../src/scrape-configs";

type PropertyDetailMode = "default" | "short" | "long";
type ScrapeConfigFor<TType extends ScraperType> = Extract<ScrapeConfig, { type: TType }> extends {
  config: infer TConfig;
}
  ? TConfig
  : never;

interface PropertyLogOptions {
  header?: string;
  detail?: PropertyDetailMode;
  imageLimit?: number;
  descriptionLimit?: number;
}

export interface ParsedManualScrapeArgs {
  rawArgs: string[];
  scrapeId?: string;
  urlArg?: string;
}

interface RunManualScrapeOptions<TScraper, TOptions> {
  sourceName: string;
  createScraper: () => TScraper;
  resolveTarget: (args: ParsedManualScrapeArgs) => {
    url: string;
    options?: TOptions;
    scrapeId?: string;
    config?: unknown;
  };
  initialize?: (scraper: TScraper) => Promise<void>;
  scrape: (
    scraper: TScraper,
    target: { url: string; options?: TOptions; scrapeId?: string; config?: unknown },
  ) => Promise<Property[]>;
  close?: (scraper: TScraper) => Promise<void>;
  logTarget?: (target: {
    url: string;
    options?: TOptions;
    scrapeId?: string;
    config?: unknown;
  }) => void;
  emptyState?: string[];
  successMessage?: (count: number) => string;
  logProperty?: (property: Property, index: number) => void | Promise<void>;
  errorLabel?: string;
}

export function parseManualScrapeArgs(rawArgs = process.argv.slice(2)): ParsedManualScrapeArgs {
  const idFlagIndex = rawArgs.indexOf("--id");
  const idFromFlag = idFlagIndex >= 0 ? rawArgs[idFlagIndex + 1] : undefined;
  const positionalArg = rawArgs.find((arg) => !arg.startsWith("--"));
  const positionalScrape = positionalArg && getScrapeById(positionalArg) ? positionalArg : undefined;
  const scrapeId = idFromFlag ?? positionalScrape;
  const urlArg = positionalArg && positionalArg !== scrapeId ? positionalArg : undefined;

  return {
    rawArgs,
    scrapeId,
    urlArg,
  };
}

export function getDefaultScrapeConfig<TType extends ScraperType>(
  type: TType,
): ScrapeConfigFor<TType> {
  const scrape = SCRAPES.find(
    (entry): entry is Extract<ScrapeConfig, { type: TType }> => entry.type === type,
  );

  if (!scrape) {
    throw new Error(`No ${type} scrape config found in SCRAPES`);
  }

  return { ...scrape.config } as ScrapeConfigFor<TType>;
}

export function getScrapeConfigById<TType extends ScraperType>(
  id: string,
  expectedType: TType,
): ScrapeConfigFor<TType> {
  const scrape = getScrapeById(id);

  if (!scrape) {
    throw new Error(`Unknown scrape ID "${id}"`);
  }

  if (scrape.type !== expectedType) {
    throw new Error(`Scrape ID "${id}" is for ${scrape.type}, not ${expectedType}`);
  }

  return { ...scrape.config } as ScrapeConfigFor<TType>;
}

export function logPropertySummary(
  property: Property,
  index: number,
  options: PropertyLogOptions = {},
): void {
  const detail = options.detail ?? "default";
  const imageLimit = options.imageLimit ?? (detail === "long" ? 5 : 1);
  const descriptionLimit =
    options.descriptionLimit ??
    (detail === "short" ? 100 : detail === "default" ? 150 : undefined);

  console.log(`\n=== ${options.header ?? "Property"} ${index + 1} ===`);
  console.log(`Title: ${property.title || "N/A"}`);
  console.log(`Price: ${property.price || "N/A"}`);
  console.log(`Location: ${property.location || "N/A"}`);
  console.log(`District (Okres): ${property.district || "N/A"}`);
  console.log(`Region (Kraj): ${property.region || "N/A"}`);
  console.log(`Area: ${property.area || "N/A"}`);
  console.log(`Price per m²: ${formatPricePerSqm(property.pricePerSqm)}`);
  console.log(
    `Mortgage estimate: ${formatMortgageEstimate(property) ?? "N/A"}`
  );
  console.log(`Rooms: ${property.rooms || "N/A"}`);
  console.log(`URL: ${property.url || "N/A"}`);

  if (typeof property.isNew === "boolean") {
    console.log(`Is New: ${property.isNew ? "Yes" : "No"}`);
  }

  if (property.description) {
    console.log(`Description: ${truncate(property.description, descriptionLimit)}`);
  }

  if (property.images?.length) {
    if (detail === "default") {
      console.log(`Images: ${property.images.length}`);
      console.log(`Image 1: ${property.images[0] || "N/A"}`);
      return;
    }

    console.log(`Images (${property.images.length}):`);
    property.images.slice(0, imageLimit).forEach((image, imageIndex) => {
      console.log(`  ${imageIndex + 1}. ${image}`);
    });

    if (property.images.length > imageLimit) {
      console.log(`  ...and ${property.images.length - imageLimit} more`);
    }
  }
}

export function logNoProperties(lines: string[]): void {
  for (const line of lines) {
    console.log(line);
  }
}

export async function runManualScrape<TScraper, TOptions = undefined>(
  options: RunManualScrapeOptions<TScraper, TOptions>,
): Promise<void> {
  const scraper = options.createScraper();

  try {
    if (options.initialize) {
      await options.initialize(scraper);
    }

    const target = options.resolveTarget(parseManualScrapeArgs());
    options.logTarget?.(target);

    const properties = await options.scrape(scraper, target);
    console.log(`\n🏠 Found ${properties.length} properties${options.sourceName ? ` on ${options.sourceName}` : ""}:`);

    if (properties.length === 0) {
      logNoProperties(options.emptyState ?? ["No properties found."]);
      return;
    }

    for (let i = 0; i < properties.length; i += 1) {
      await options.logProperty?.(properties[i], i);
    }

    console.log(
      `\n✅ ${options.successMessage?.(properties.length) ?? `Successfully scraped ${properties.length} properties from ${options.sourceName}`}`,
    );
  } catch (error) {
    console.error(`❌ Error running ${options.errorLabel ?? options.sourceName} scraper:`, error);
    process.exit(1);
  } finally {
    if (options.close) {
      await options.close(scraper);
    }
  }
}

function formatPricePerSqm(pricePerSqm?: number): string {
  if (typeof pricePerSqm !== "number") {
    return "N/A";
  }

  return `${new Intl.NumberFormat("cs-CZ").format(pricePerSqm)} Kč/m²`;
}

function formatMortgageEstimate(property: Property): string | undefined {
  return formatMonthlyMortgageEstimate(
    property,
    DEFAULT_MORTGAGE_ESTIMATE_CONFIG
  );
}

function truncate(value: string, maxLength?: number): string {
  if (!maxLength || value.length <= maxLength) {
    return value;
  }

  return `${value.substring(0, maxLength)}...`;
}
