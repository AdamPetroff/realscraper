import { loadScrapes } from "../src/db";
import { logPropertySummary } from "../src/property-log";
import type { Property } from "../src/types";
import {
  getScrapeById,
  type ScrapeConfig,
  type ScraperType,
} from "../src/scrape-configs";

type ScrapeConfigFor<TType extends ScraperType> = Extract<ScrapeConfig, { type: TType }> extends {
  config: infer TConfig;
}
  ? TConfig
  : never;

export interface ParsedManualScrapeArgs {
  rawArgs: string[];
  scrapeId?: string;
  urlArg?: string;
}

interface RunManualScrapeOptions<TScraper, TOptions> {
  sourceName: string;
  createScraper: () => TScraper;
  resolveTarget: (args: ParsedManualScrapeArgs, scrapes: ScrapeConfig[]) => {
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

export { logPropertySummary };

export function parseManualScrapeArgs(
  scrapes: ScrapeConfig[],
  rawArgs = process.argv.slice(2),
): ParsedManualScrapeArgs {
  const idFlagIndex = rawArgs.indexOf("--id");
  const idFromFlag = idFlagIndex >= 0 ? rawArgs[idFlagIndex + 1] : undefined;
  const positionalArg = rawArgs.find((arg) => !arg.startsWith("--"));
  const positionalScrape =
    positionalArg && getScrapeById(scrapes, positionalArg) ? positionalArg : undefined;
  const scrapeId = idFromFlag ?? positionalScrape;
  const urlArg = positionalArg && positionalArg !== scrapeId ? positionalArg : undefined;

  return {
    rawArgs,
    scrapeId,
    urlArg,
  };
}

export function getDefaultScrapeConfig<TType extends ScraperType>(
  scrapes: ScrapeConfig[],
  type: TType,
): ScrapeConfigFor<TType> {
  const scrape = scrapes.find(
    (entry): entry is Extract<ScrapeConfig, { type: TType }> => entry.type === type,
  );

  if (!scrape) {
    throw new Error(`No ${type} scrape config found in loaded scrapes`);
  }

  return { ...scrape.config } as ScrapeConfigFor<TType>;
}

export function getScrapeConfigById<TType extends ScraperType>(
  scrapes: ScrapeConfig[],
  id: string,
  expectedType: TType,
): ScrapeConfigFor<TType> {
  const scrape = getScrapeById(scrapes, id);

  if (!scrape) {
    throw new Error(`Unknown scrape ID "${id}"`);
  }

  if (scrape.type !== expectedType) {
    throw new Error(`Scrape ID "${id}" is for ${scrape.type}, not ${expectedType}`);
  }

  return { ...scrape.config } as ScrapeConfigFor<TType>;
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

    const scrapes = await loadScrapes();
    const target = options.resolveTarget(parseManualScrapeArgs(scrapes), scrapes);
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
