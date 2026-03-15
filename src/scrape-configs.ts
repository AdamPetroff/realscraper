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
const ALL_SCRAPERS: ScraperType[] = [
  "idnes",
  "bezrealitky",
  "sreality",
  "bazos",
];

export interface ScrapeLocationConfig {
  label: string;
  idnesCity?: string;
  srealityLocationSlug?: string;
  bezrealitky?: {
    osmValue: string;
    regionOsmIds: string;
    location?: string;
  };
  bazos?: {
    locationCode: string;
    radiusKm?: number;
  };
}

export type SharedOfferType = "sale" | "rent";
export type SharedPropertyKind = "apartment" | "land" | "house";
export type SharedFreshness = "today" | "week" | "month";
export type SharedOwnership = "personal";

export interface SharedScrapeSearchConfig {
  offerType: SharedOfferType;
  propertyKind: SharedPropertyKind;
  location: ScrapeLocationConfig;
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  pricePerSqmMin?: number;
  pricePerSqmMax?: number;
  roomLayouts?: string[];
  roomCountMin?: number;
  ownership?: SharedOwnership;
  onlyNew?: boolean;
  freshness?: SharedFreshness;
}

interface BaseSharedScrapeConfig {
  label: string;
  enabled?: boolean;
  scrapers?: ScraperType[];
  search: SharedScrapeSearchConfig;
  overrides?: Partial<{
    idnes: Partial<IdnesScraperConfig>;
    bezrealitky: Partial<BezrealitkyScraperConfig>;
    sreality: Partial<SrealityScraperConfig>;
    bazos: Partial<BazosScraperConfig>;
  }>;
}

export type SharedScrapeConfig = BaseSharedScrapeConfig;

interface BaseResolvedScrapeConfig {
  id: string;
  label: string;
  enabled?: boolean;
}

export interface IdnesScrapeConfig extends BaseResolvedScrapeConfig {
  type: "idnes";
  config: IdnesScraperConfig;
}

export interface BezrealitkyScrapeConfig extends BaseResolvedScrapeConfig {
  type: "bezrealitky";
  config: BezrealitkyScraperConfig;
}

export interface SrealityScrapeConfig extends BaseResolvedScrapeConfig {
  type: "sreality";
  config: SrealityScraperConfig;
}

export interface BazosScrapeConfig extends BaseResolvedScrapeConfig {
  type: "bazos";
  config: BazosScraperConfig;
}

export type ScrapeConfig =
  | IdnesScrapeConfig
  | BezrealitkyScrapeConfig
  | SrealityScrapeConfig
  | BazosScrapeConfig;

// ============================================================================
// Shared Definitions
// ============================================================================

const APARTMENT_LAYOUTS = ["2+1", "2+kk", "3+1", "3+kk"];
const IDNES_ALL_MATERIALS = [
  "brick",
  "wood",
  "stone",
  "skeleton",
  "prefab",
  "mixed",
];
const IDNES_ALL_HOUSE_CONDITIONS = [
  "new",
  "project",
  "under-construction",
  "good-condition",
  "maintained",
  "after-reconstruction",
];

const LOCATIONS = {
  brno: {
    label: "Brno",
    idnesCity: "brno",
    srealityLocationSlug: "brno",
    bezrealitky: {
      osmValue: "Brno-město, Jihomoravský kraj, Jihovýchod, Česko",
      regionOsmIds: "R442273",
    },
    bazos: {
      locationCode: "60200",
      radiusKm: 10,
    },
  },
  breclav: {
    label: "Břeclav",
    idnesCity: "breclav",
    bazos: {
      locationCode: "69002",
      radiusKm: 10,
    },
  },
  hodonin: {
    label: "Hodonín",
    idnesCity: "hodonin",
    bazos: {
      locationCode: "69501",
      radiusKm: 10,
    },
  },
  breclavHodonin: {
    label: "Břeclav, Hodonín",
    srealityLocationSlug: "breclav,hodonin",
  },
  olomoucApartment: {
    label: "Olomouc",
    idnesCity: "olomouc",
    srealityLocationSlug: "olomouc",
    bezrealitky: {
      osmValue: "Olomouc, okres Olomouc, Olomoucký kraj, Střední Morava, Česko",
      regionOsmIds: "R437057",
    },
    bazos: {
      locationCode: "77900",
      radiusKm: 10,
    },
  },
  olomoucLand: {
    label: "Olomouc ≤10 km",
    idnesCity: "olomouc",
    srealityLocationSlug: "olomoucky-kraj",
    bezrealitky: {
      osmValue: "Olomouc, Olomoucký kraj, Střední Morava, Česko",
      regionOsmIds: "R441579",
    },
    bazos: {
      locationCode: "77900",
      radiusKm: 10,
    },
  },
  olomoucHouse: {
    label: "Olomouc ≤10 km",
    idnesCity: "olomoucky-kraj",
    srealityLocationSlug: "olomoucky-kraj",
    bezrealitky: {
      osmValue: "Olomouc, Olomoucký kraj, Střední Morava, Česko",
      regionOsmIds: "R441579",
    },
    bazos: {
      locationCode: "77900",
      radiusKm: 10,
    },
  },
} satisfies Record<string, ScrapeLocationConfig>;

export const SHARED_SCRAPES: SharedScrapeConfig[] = [
  {
    label: "(3-6M CZK) Brno",
    search: {
      offerType: "sale",
      propertyKind: "apartment",
      location: LOCATIONS.brno,
      priceMin: 3_000_000,
      priceMax: 6_000_000,
      areaMin: 36,
      roomLayouts: ["2+1", "2+kk"],
      ownership: "personal",
      onlyNew: false,
      freshness: "today",
    },
    overrides: {
      bezrealitky: {
        newOnly: true,
      },
    },
  },
  {
    label: "(3-6M CZK) Olomouc",
    search: {
      offerType: "sale",
      propertyKind: "apartment",
      location: LOCATIONS.olomoucApartment,
      priceMin: 3_000_000,
      priceMax: 6_000_000,
      areaMin: 36,
      roomLayouts: ["2+1", "2+kk"],
      ownership: "personal",
      onlyNew: false,
      freshness: "today",
    },
    overrides: {
      bezrealitky: {
        newOnly: true,
      },
      bazos: {
        priceMax: 7_000_000,
      },
    },
  },
  {
    label: "(6-8M CZK) Brno",
    scrapers: ["idnes", "sreality"],
    search: {
      offerType: "sale",
      propertyKind: "apartment",
      location: LOCATIONS.brno,
      priceMin: 6_000_000,
      priceMax: 8_000_000,
      areaMin: 50,
      roomLayouts: APARTMENT_LAYOUTS,
      ownership: "personal",
      onlyNew: false,
      freshness: "today",
    },
  },
  {
    label: "(6-8M CZK) Olomouc",
    scrapers: ["idnes", "sreality"],
    search: {
      offerType: "sale",
      propertyKind: "apartment",
      location: LOCATIONS.olomoucApartment,
      priceMin: 6_000_000,
      priceMax: 8_000_000,
      areaMin: 50,
      roomLayouts: APARTMENT_LAYOUTS,
      ownership: "personal",
      onlyNew: false,
      freshness: "today",
    },
  },
  {
    label: "Land (<=2M CZK) Olomouc <=10 km",
    search: {
      offerType: "sale",
      propertyKind: "land",
      location: LOCATIONS.olomoucLand,
      priceMin: 0,
      priceMax: 2_000_000,
      ownership: "personal",
      onlyNew: false,
      freshness: "week",
      pricePerSqmMin: 500,
      pricePerSqmMax: 2_000,
    },
    overrides: {
      bezrealitky: {
        newOnly: true,
      },
      sreality: {
        extraParams: {
          region: "Olomouc",
          "region-id": 1,
          "region-typ": "municipality",
          vzdalenost: 10,
          "za-m2": 1,
        },
      },
    },
  },
  {
    label: "House (5-10M CZK) Olomouc <=10 km",
    search: {
      offerType: "sale",
      propertyKind: "house",
      location: LOCATIONS.olomoucHouse,
      priceMin: 5_000_000,
      priceMax: 10_000_000,
      ownership: "personal",
      onlyNew: false,
      freshness: "month",
    },
    overrides: {
      idnes: {
        propertyKind: "house",
        houseSubtype: "house|turn-key",
        roomCount: 3,
        areaMin: 36,
        condition: IDNES_ALL_HOUSE_CONDITIONS.join("|"),
        material: IDNES_ALL_MATERIALS.join("|"),
      },
      bezrealitky: {
        priceFrom: 5_000_000,
        priceTo: 10_000_000,
      },
      sreality: {
        areaMin: 50,
      },
    },
  },
];

// ============================================================================
// Expansion Helpers
// ============================================================================

function resolveScrapers(scrape: SharedScrapeConfig): ScraperType[] {
  return scrape.scrapers && scrape.scrapers.length > 0
    ? scrape.scrapers
    : ALL_SCRAPERS;
}

function titlePrefix(type: ScraperType): string {
  switch (type) {
    case "idnes":
      return "IDNES";
    case "bezrealitky":
      return "Bezrealitky";
    case "sreality":
      return "Sreality";
    case "bazos":
      return "Bazos";
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function createScrapeId(type: ScraperType, label: string): string {
  return `${type}-${slugify(label)}`;
}

function toIdnesRooms(layouts?: string[]): string | undefined {
  if (!layouts || layouts.length === 0) return undefined;

  const mapping: Record<string, string> = {
    "1+1": "11",
    "1+kk": "1k",
    "2+1": "21",
    "2+kk": "2k",
    "3+1": "31",
    "3+kk": "3k",
    "4+1": "41",
    "4+kk": "4k",
  };

  const idnesRooms = layouts
    .map((layout) => mapping[layout])
    .filter((value): value is string => Boolean(value));

  return idnesRooms.length > 0 ? idnesRooms.join("|") : undefined;
}

function toBezrealitkyDispositions(layouts?: string[]): string[] | undefined {
  if (!layouts || layouts.length === 0) return undefined;

  const mapping: Record<string, string> = {
    "1+1": "DISP_1_1",
    "1+kk": "DISP_1_KK",
    "2+1": "DISP_2_1",
    "2+kk": "DISP_2_KK",
    "3+1": "DISP_3_1",
    "3+kk": "DISP_3_KK",
    "4+1": "DISP_4_1",
    "4+kk": "DISP_4_KK",
  };

  const dispositions = layouts
    .map((layout) => mapping[layout])
    .filter((value): value is string => Boolean(value));

  return dispositions.length > 0 ? dispositions : undefined;
}

function toSrealityAge(
  freshness?: SharedFreshness,
): SrealityScraperConfig["age"] | undefined {
  switch (freshness) {
    case "today":
      return "dnes";
    case "week":
      return "tyden";
    case "month":
      return "mesic";
    default:
      return undefined;
  }
}

function toSrealityOfferType(
  offerType: SharedOfferType,
): SrealityScraperConfig["offerType"] {
  return offerType === "sale" ? "prodej" : "pronajem";
}

function toBezrealitkyOfferType(offerType: SharedOfferType): string {
  return offerType === "sale" ? "PRODEJ" : "PRONAJEM";
}

function toBazosOfferType(
  offerType: SharedOfferType,
): BazosScraperConfig["offerType"] {
  return offerType === "sale" ? "prodam" : "pronajmu";
}

function createIdnesConfig(scrape: SharedScrapeConfig): IdnesScrapeConfig {
  const { search } = scrape;

  let config: IdnesScraperConfig;

  if (search.propertyKind === "land") {
    const base: IdnesScraperConfig = {
      propertyKind: "land",
      city: search.location.idnesCity ?? "olomouc",
      landSubtype: "stavebni-pozemek",
      priceMin:
        typeof search.priceMin === "number" && search.priceMin > 0
          ? search.priceMin
          : undefined,
      priceMax: search.priceMax,
      ownership: search.ownership === "personal" ? "personal" : undefined,
      roomCount: 4,
      freshness: search.freshness,
    };

    config = {
      ...base,
      ...scrape.overrides?.idnes,
    } as IdnesScraperConfig;
  } else if (search.propertyKind === "house") {
    const base: IdnesScraperConfig = {
      propertyKind: "house",
      city: search.location.idnesCity ?? "olomoucky-kraj",
      priceMin:
        typeof search.priceMin === "number" && search.priceMin > 0
          ? search.priceMin
          : undefined,
      priceMax: search.priceMax,
      roomCount: search.roomCountMin,
      areaMin: search.areaMin,
      ownership: search.ownership === "personal" ? "personal" : undefined,
      freshness: search.freshness,
    };

    config = {
      ...base,
      ...scrape.overrides?.idnes,
    } as IdnesScraperConfig;
  } else {
    const rooms = toIdnesRooms(search.roomLayouts);

    if (
      typeof search.priceMin !== "number" ||
      typeof search.priceMax !== "number" ||
      typeof search.areaMin !== "number" ||
      !search.location.idnesCity ||
      !rooms ||
      search.ownership !== "personal"
    ) {
      throw new Error(
        `IDNES apartment mapping requires full apartment inputs for "${scrape.label}"`,
      );
    }

    const base: IdnesScraperConfig = {
      propertyKind: "apartment",
      priceMin: search.priceMin,
      priceMax: search.priceMax,
      city: search.location.idnesCity,
      rooms,
      areaMin: search.areaMin,
      ownership: "personal",
      material: IDNES_ALL_MATERIALS.join("|"),
      roomCount: 3,
      freshness: search.freshness,
    };

    config = {
      ...base,
      ...scrape.overrides?.idnes,
    } as IdnesScraperConfig;
  }

  return {
    id: createScrapeId("idnes", scrape.label),
    type: "idnes",
    label: `${titlePrefix("idnes")} ${scrape.label}`,
    enabled: scrape.enabled,
    config,
  };
}

function createBezrealitkyConfig(
  scrape: SharedScrapeConfig,
): BezrealitkyScrapeConfig {
  const { search } = scrape;
  const location = search.location.bezrealitky;

  if (!location) {
    throw new Error(
      `Bezrealitky mapping requires bezrealitky location data for "${scrape.label}"`,
    );
  }

  const base: BezrealitkyScraperConfig =
    search.propertyKind === "land"
      ? {
          estateType: "POZEMEK",
          offerType: toBezrealitkyOfferType(search.offerType),
          location: location.location ?? "exact",
          osmValue: location.osmValue,
          regionOsmIds: location.regionOsmIds,
          priceFrom: search.priceMin ?? 0,
          priceTo: search.priceMax ?? 0,
          currency: "CZK",
          landType: "STAVEBNI",
          newOnly: search.onlyNew,
        }
      : search.propertyKind === "house"
        ? {
            estateType: "DUM",
            offerType: toBezrealitkyOfferType(search.offerType),
            location: location.location ?? "exact",
            osmValue: location.osmValue,
            regionOsmIds: location.regionOsmIds,
            priceFrom: search.priceMin ?? 0,
            priceTo: search.priceMax ?? 0,
            currency: "CZK",
            newOnly: search.onlyNew,
          }
      : {
          dispositions: toBezrealitkyDispositions(search.roomLayouts),
          estateType: "BYT",
          offerType: toBezrealitkyOfferType(search.offerType),
          location: location.location ?? "exact",
          osmValue: location.osmValue,
          regionOsmIds: location.regionOsmIds,
          priceFrom: search.priceMin ?? 0,
          priceTo: search.priceMax ?? 0,
          currency: "CZK",
          newOnly: search.onlyNew,
        };

  return {
    id: createScrapeId("bezrealitky", scrape.label),
    type: "bezrealitky",
    label: `${titlePrefix("bezrealitky")} ${scrape.label}`,
    enabled: scrape.enabled,
    config: {
      ...base,
      ...scrape.overrides?.bezrealitky,
    },
  };
}

function createSrealityConfig(
  scrape: SharedScrapeConfig,
): SrealityScrapeConfig {
  const { search } = scrape;
  const locationSlug = search.location.srealityLocationSlug;

  if (!locationSlug) {
    throw new Error(
      `Sreality mapping requires srealityLocationSlug for "${scrape.label}"`,
    );
  }

  const base: SrealityScraperConfig =
    search.propertyKind === "land"
      ? {
          offerType: toSrealityOfferType(search.offerType),
          category: "pozemky/stavebni-parcely",
          locationSlug,
          age: toSrealityAge(search.freshness),
          newOnly: search.onlyNew,
          extraParams: {
            ...(typeof search.pricePerSqmMin === "number"
              ? { "cena-od": search.pricePerSqmMin }
              : {}),
            ...(typeof search.pricePerSqmMax === "number"
              ? { "cena-do": search.pricePerSqmMax }
              : {}),
          },
        }
      : search.propertyKind === "house"
        ? {
            offerType: toSrealityOfferType(search.offerType),
            category: "domy",
            locationSlug,
            age: toSrealityAge(search.freshness),
            priceMin: search.priceMin,
            priceMax: search.priceMax,
            areaMin: search.areaMin,
            areaMax: search.areaMax,
            newOnly: search.onlyNew,
          }
      : {
          offerType: toSrealityOfferType(search.offerType),
          category: "byty",
          locationSlug,
          sizes: search.roomLayouts,
          ownership: search.ownership === "personal" ? "osobni" : undefined,
          age: toSrealityAge(search.freshness),
          priceMin: search.priceMin,
          priceMax: search.priceMax,
          areaMin: search.areaMin,
          areaMax: search.areaMax,
          newOnly: search.onlyNew,
        };

  return {
    id: createScrapeId("sreality", scrape.label),
    type: "sreality",
    label: `${titlePrefix("sreality")} ${scrape.label}`,
    enabled: scrape.enabled,
    config: {
      ...base,
      ...scrape.overrides?.sreality,
      extraParams: {
        ...base.extraParams,
        ...scrape.overrides?.sreality?.extraParams,
      },
    },
  };
}

function createBazosConfig(scrape: SharedScrapeConfig): BazosScrapeConfig {
  const { search } = scrape;
  const location = search.location.bazos;

  if (!location) {
    throw new Error(
      `Bazos mapping requires bazos location data for "${scrape.label}"`,
    );
  }

  const base: BazosScraperConfig = {
    locationCode: location.locationCode,
    radiusKm: location.radiusKm ?? 10,
    offerType: toBazosOfferType(search.offerType),
    propertyKind: search.propertyKind,
    priceMin: search.priceMin,
    priceMax: search.priceMax,
    recentOnly: search.onlyNew,
  };

  return {
    id: createScrapeId("bazos", scrape.label),
    type: "bazos",
    label: `${titlePrefix("bazos")} ${scrape.label}`,
    enabled: scrape.enabled,
    config: {
      ...base,
      ...scrape.overrides?.bazos,
    },
  };
}

function expandSharedScrape(shared: SharedScrapeConfig): ScrapeConfig[] {
  const scrapes: ScrapeConfig[] = [];

  for (const type of resolveScrapers(shared)) {
    switch (type) {
      case "idnes":
        scrapes.push(createIdnesConfig(shared));
        break;
      case "bezrealitky":
        scrapes.push(createBezrealitkyConfig(shared));
        break;
      case "sreality":
        scrapes.push(createSrealityConfig(shared));
        break;
      case "bazos":
        scrapes.push(createBazosConfig(shared));
        break;
    }
  }

  return scrapes;
}

export const SCRAPES: ScrapeConfig[] =
  SHARED_SCRAPES.flatMap(expandSharedScrape);

// ============================================================================
// Helpers
// ============================================================================

export function getEnabledScrapes(scrapes: ScrapeConfig[]): ScrapeConfig[] {
  return scrapes.filter((s) => s.enabled !== false);
}

export function getScraperTypes(scrapes: ScrapeConfig[]): Set<ScraperType> {
  return new Set(scrapes.map((s) => s.type));
}

export function getScrapeById(id: string): ScrapeConfig | undefined {
  return SCRAPES.find((scrape) => scrape.id === id);
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
    console.log(`  • ${scrape.label} [${scrape.id}]`);
    console.log(`    ${buildUrlForScrape(scrape)}`);
  }

  console.log("\n" + "─".repeat(60) + "\n");
}
