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
// Scrape Configurations (runs every 10 minutes)
// ============================================================================
// Add, remove, or modify entries here to change what gets scraped.

export const SCRAPES: ScrapeConfig[] = [
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
      articleAge: "1",
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
      articleAge: "1",
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
      articleAge: "1",
    },
  },
  {
    type: "idnes",
    label: "IDNES (3-6M CZK) Olomouc",
    config: {
      priceMin: 3000000,
      priceMax: 6000000,
      city: "olomouc",
      rooms: "2k|21",
      areaMin: 36,
      ownership: "personal",
      material: "brick|wood|stone|skeleton|prefab|mixed",
      roomCount: 3,
      articleAge: "1",
    },
  },

  // IDNES: Higher price range 6-8M CZK
  {
    type: "idnes",
    label: "IDNES (6-8M CZK) Brno",
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
  {
    type: "idnes",
    label: "IDNES (6-8M CZK) Olomouc",
    config: {
      city: "olomouc",
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
    label: "Bezrealitky (≤6M CZK) Brno",
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
  {
    type: "bezrealitky",
    label: "Bezrealitky (≤6M CZK) Olomouc",
    config: {
      dispositions: ["DISP_2_1", "DISP_2_KK", "DISP_3_1", "DISP_3_KK"],
      estateType: "BYT",
      offerType: "PRODEJ",
      location: "exact",
      osmValue: "Olomouc, okres Olomouc, Olomoucký kraj, Střední Morava, Česko",
      regionOsmIds: "R437057",
      priceFrom: 3_000_000,
      priceTo: 6_000_000,
      currency: "CZK",
      newOnly: true,
    },
  },

  // Sreality: Up to 6M CZK
  {
    type: "sreality",
    label: "Sreality (≤6M CZK) Brno",
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
    label: "Sreality (≤6M CZK) Břeclav, Hodonín",
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
  {
    type: "sreality",
    label: "Sreality (≤6M CZK) Olomouc",
    config: {
      offerType: "prodej",
      category: "byty",
      locationSlug: "olomouc",
      sizes: ["2+1", "2+kk", "3+1", "3+kk"],
      ownership: "osobni",
      age: "dnes",
      priceMax: 6_000_000,
      newOnly: false,
    },
  },

  // Sreality: 6-8M CZK
  {
    type: "sreality",
    label: "Sreality (6-8M CZK) Brno",
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
    label: "Sreality (6-8M CZK) Břeclav, Hodonín",
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
  {
    type: "sreality",
    label: "Sreality (6-8M CZK) Olomouc",
    config: {
      offerType: "prodej",
      category: "byty",
      locationSlug: "olomouc",
      sizes: ["2+1", "2+kk", "3+1", "3+kk"],
      ownership: "osobni",
      age: "dnes",
      priceMin: 6_000_000,
      priceMax: 8_000_000,
      newOnly: false,
    },
  },

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
      recentOnly: true,
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
      recentOnly: true,
    },
  },
  {
    type: "bazos",
    label: "Bazos (≤7M CZK) Hodonín",
    config: {
      locationCode: "69501", // Hodonín
      radiusKm: 10,
      offerType: "prodam",
      propertyType: "byt",
      priceMax: 7_000_000,
      recentOnly: true,
    },
  },
  {
    type: "bazos",
    label: "Bazos (≤7M CZK) Olomouc",
    config: {
      locationCode: "77900", // Olomouc
      radiusKm: 10,
      offerType: "prodam",
      propertyType: "byt",
      priceMax: 7_000_000,
      recentOnly: true,
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
  const scrapes = getEnabledScrapes(SCRAPES);

  console.log("\n📋 Active scrape configurations (runs every 10 minutes):");
  console.log("─".repeat(60));

  for (const scrape of scrapes) {
    console.log(`  • ${scrape.label}`);
    console.log(`    ${buildUrlForScrape(scrape)}`);
  }

  console.log("\n" + "─".repeat(60) + "\n");
}
