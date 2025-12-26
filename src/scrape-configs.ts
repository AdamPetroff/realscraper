import {
  type IdnesScraperConfig,
  type BezrealitkyScraperConfig,
  type SrealityScraperConfig,
  type BazosScraperConfig,
  buildIdnesUrl,
  buildBezrealitkyUrl,
  buildSrealityUrl,
  buildBazosUrl,
} from "./config";

// ============================================================================
// Scraper Configuration Types
// ============================================================================

export type ScraperType = "idnes" | "bezrealitky" | "sreality" | "bazos";

interface BaseScrapeConfig {
  label: string;
  enabled?: boolean; // defaults to true
}

export interface IdnesScrapeConfig extends BaseScrapeConfig {
  type: "idnes";
  config: IdnesScraperConfig;
}

export interface BezrealitkyScrapeConfig extends BaseScrapeConfig {
  type: "bezrealitky";
  config: BezrealitkyScraperConfig;
}

export interface SrealityScrapeConfig extends BaseScrapeConfig {
  type: "sreality";
  config: SrealityScraperConfig;
}

export interface BazosScrapeConfig extends BaseScrapeConfig {
  type: "bazos";
  config: BazosScraperConfig;
}

export type ScrapeConfig =
  | IdnesScrapeConfig
  | BezrealitkyScrapeConfig
  | SrealityScrapeConfig
  | BazosScrapeConfig;

// ============================================================================
// Daily Scrape Configurations (6 PM)
// ============================================================================
// Add, remove, or modify entries here to change what gets scraped daily.

export const DAILY_SCRAPES: ScrapeConfig[] = [
  // IDNES: Default 3-6M CZK range
  {
    type: "idnes",
    label: "IDNES (3-6M CZK) Brno",
    config: {
      priceMin: 3000000,
      priceMax: 6000000,
      city: "brno",
      rooms: "2k|21",
      areaMin: 36,
      ownership: "personal",
      material: "brick|wood|stone|skeleton|prefab|mixed",
      roomCount: 3,
      articleAge: "1", // Only get properties from last 1 day
    },
  },
  {
    type: "idnes",
    label: "IDNES (3-6M CZK) Břeclav",
    config: {
      priceMin: 3000000,
      priceMax: 6000000,
      city: "breclav",
      rooms: "2k|21",
      areaMin: 36,
      ownership: "personal",
      material: "brick|wood|stone|skeleton|prefab|mixed",
      roomCount: 3,
      articleAge: "1", // Only get properties from last 1 day
    },
  },
  {
    type: "idnes",
    label: "IDNES (3-6M CZK) Hodonín",
    config: {
      priceMin: 3000000,
      priceMax: 6000000,
      city: "hodonin",
      rooms: "2k|21",
      areaMin: 36,
      ownership: "personal",
      material: "brick|wood|stone|skeleton|prefab|mixed",
      roomCount: 3,
      articleAge: "1", // Only get properties from last 1 day
    },
  },

  // IDNES: Higher price range 6-8M CZK
  {
    type: "idnes",
    label: "IDNES (6-8M CZK)",
    config: {
      city: "brno",
      ownership: "personal",
      material: "brick|wood|stone|skeleton|prefab|mixed",
      roomCount: 3,
      articleAge: "1",
      priceMin: 6_000_000,
      priceMax: 8_000_000,
      rooms: "2k|21|3k|31",
      areaMin: 50,
    },
  },

  // Bezrealitky: Up to 6M CZK
  {
    type: "bezrealitky",
    label: "Bezrealitky (≤6M CZK)",
    config: {
      dispositions: ["DISP_2_1", "DISP_2_KK", "DISP_3_1", "DISP_3_KK"],
      estateType: "BYT",
      offerType: "PRODEJ",
      location: "exact",
      osmValue: "Brno-město, Jihomoravský kraj, Jihovýchod, Česko",
      regionOsmIds: "R442273",
      priceFrom: 3_000_000,
      priceTo: 6_000_000,
      currency: "CZK",
      newOnly: true,
    },
  },

  // Sreality: Up to 6M CZK
  {
    type: "sreality",
    label: "Sreality (≤6M CZK)",
    config: {
      offerType: "prodej",
      category: "byty",
      locationSlug: "brno",
      sizes: ["2+1", "2+kk", "3+1", "3+kk"],
      ownership: "osobni",
      age: "dnes",
      priceMax: 6_000_000,
      newOnly: false,
    },
  },
  {
    type: "sreality",
    label: "Sreality (Breclav, Hodonín, ≤6M CZK)",
    config: {
      offerType: "prodej",
      category: "byty",
      locationSlug: "breclav,hodonin",
      sizes: ["2+1", "2+kk", "3+1", "3+kk"],
      ownership: "osobni",
      age: "dnes",
      priceMax: 6_000_000,
      newOnly: false,
    },
  },

  // Sreality: Up to 6M CZK
  {
    type: "sreality",
    label: "Sreality (6-8M CZK)",
    config: {
      offerType: "prodej",
      category: "byty",
      locationSlug: "brno",
      sizes: ["2+1", "2+kk", "3+1", "3+kk"],
      ownership: "osobni",
      age: "dnes",
      priceMin: 6_000_000,
      priceMax: 8_000_000,
      newOnly: false,
    },
  },
  {
    type: "sreality",
    label: "Sreality (Breclav, Hodonín, ≤6M CZK)",
    config: {
      offerType: "prodej",
      category: "byty",
      locationSlug: "breclav,hodonin",
      sizes: ["2+1", "2+kk", "3+1", "3+kk"],
      ownership: "osobni",
      age: "dnes",
      priceMin: 6_000_000,
      priceMax: 8_000_000,
      newOnly: false,
    },
  },
];

// ============================================================================
// Nightly Scrape Configurations (11:50 PM & 0:10 AM)
// ============================================================================
// Bazos listings are scraped at the end of the day to catch all daily posts.

export const NIGHTLY_SCRAPES: ScrapeConfig[] = [
  // Bazos: Up to 7M CZK
  {
    type: "bazos",
    label: "Bazos (≤7M CZK) Brno",
    config: {
      locationCode: "60200", // Brno-město
      radiusKm: 10,
      offerType: "prodam",
      propertyType: "byt",
      priceMax: 7_000_000,
      recentOnly: true, // Only listings from today
    },
  },
  {
    type: "bazos",
    label: "Bazos (≤7M CZK) Břeclav",
    config: {
      locationCode: "69002", // Breclav
      radiusKm: 10,
      offerType: "prodam",
      propertyType: "byt",
      priceMax: 7_000_000,
      recentOnly: true, // Only listings from today
    },
  },
  {
    type: "bazos",
    label: "Bazos (≤7M CZK)",
    config: {
      locationCode: "69501", // Hodonín
      radiusKm: 10,
      offerType: "prodam",
      propertyType: "byt",
      priceMax: 7_000_000,
      recentOnly: true, // Only listings from today
    },
  },
];

// ============================================================================
// Helpers
// ============================================================================

export function getEnabledScrapes(scrapes: ScrapeConfig[]): ScrapeConfig[] {
  return scrapes.filter((s) => s.enabled !== false);
}

export function getScraperTypes(scrapes: ScrapeConfig[]): Set<ScraperType> {
  return new Set(scrapes.map((s) => s.type));
}

export function buildUrlForScrape(scrape: ScrapeConfig): string {
  switch (scrape.type) {
    case "idnes":
      return buildIdnesUrl(scrape.config);
    case "bezrealitky":
      return buildBezrealitkyUrl(scrape.config);
    case "sreality":
      return buildSrealityUrl(scrape.config);
    case "bazos":
      return buildBazosUrl(scrape.config);
  }
}

export function logActiveScrapes(): void {
  const dailyScrapes = getEnabledScrapes(DAILY_SCRAPES);
  const nightlyScrapes = getEnabledScrapes(NIGHTLY_SCRAPES);

  console.log("\n📋 Active scrape configurations:");
  console.log("─".repeat(60));

  if (dailyScrapes.length > 0) {
    console.log("\n🌅 Daily scrapes (6 PM):");
    for (const scrape of dailyScrapes) {
      console.log(`  • ${scrape.label}`);
      console.log(`    ${buildUrlForScrape(scrape)}`);
    }
  }

  if (nightlyScrapes.length > 0) {
    console.log("\n🌙 Nightly scrapes (11:50 PM & 0:10 AM):");
    for (const scrape of nightlyScrapes) {
      console.log(`  • ${scrape.label}`);
      console.log(`    ${buildUrlForScrape(scrape)}`);
    }
  }

  console.log("\n" + "─".repeat(60) + "\n");
}
