import {
  getOkDrazbyCategoryById,
  getOkDrazbyChildCategories,
  getOkDrazbyCountyById,
  getOkDrazbyRegionById,
} from "./ok-drazby-metadata";

type IdnesFreshness = "today" | "week" | "month";

export interface MortgageEstimateConfig {
  annualInterestRatePercent: number;
  financedShare: number;
  loanTermYears: number;
}

export const DEFAULT_MORTGAGE_ESTIMATE_CONFIG: MortgageEstimateConfig = {
  annualInterestRatePercent: 4.7,
  financedShare: 0.9,
  loanTermYears: 30,
};

export interface IdnesApartmentScraperConfig {
  propertyKind: "apartment";
  priceMin: number;
  priceMax: number;
  city: string;
  rooms: string; // e.g., "2k|21" for 2+kk or 2+1
  areaMin: number;
  ownership: string; // e.g., "personal"
  material: string; // e.g., "brick|wood|stone|skeleton|prefab|mixed"
  roomCount: number; // s-rd parameter
  freshness?: IdnesFreshness;
}

export interface IdnesLandScraperConfig {
  propertyKind: "land";
  city: string;
  landSubtype: string; // e.g. "stavebni-pozemek"
  priceMin?: number;
  priceMax?: number;
  ownership?: string; // e.g., "personal"
  roomCount?: number; // maps to s-rd when present
  freshness?: IdnesFreshness;
}

export interface IdnesHouseScraperConfig {
  propertyKind: "house";
  city: string;
  priceMin?: number;
  priceMax?: number;
  houseSubtype?: string; // e.g. "house|turn-key"
  roomCount?: number; // maps to both s-rd and s-qc[roomCount]
  areaMin?: number;
  ownership?: string; // e.g. "personal"
  condition?: string; // e.g. "new|project|under-construction"
  material?: string; // e.g. "brick|wood|stone|skeleton|prefab|mixed"
  freshness?: IdnesFreshness;
}

export type IdnesScraperConfig =
  | IdnesApartmentScraperConfig
  | IdnesLandScraperConfig
  | IdnesHouseScraperConfig;

function toIdnesArticleAge(
  freshness?: IdnesFreshness,
): "1" | "7" | "30" | "31" | undefined {
  switch (freshness) {
    case "today":
      return "1";
    case "week":
      return "7";
    case "month": {
      const now = new Date();
      const daysInCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
      ).getDate();
      return daysInCurrentMonth >= 31 ? "31" : "30";
    }
    default:
      return undefined;
  }
}

export interface BezrealitkyScraperConfig {
  newOnly?: boolean;
  dispositions?: string[]; // e.g., ["DISP_2_1", "DISP_2_KK", "DISP_3_1", "DISP_3_KK"]
  estateType: string; // e.g., "BYT"
  offerType: string; // e.g., "PRODEJ"
  location: string; // e.g., "exact"
  osmValue: string; // e.g., "Brno-město, Jihomoravský kraj, Jihovýchod, Česko"
  regionOsmIds: string; // e.g., "R442273"
  priceFrom: number;
  priceTo: number;
  currency: string; // e.g., "CZK"
  landType?: string; // e.g., "STAVEBNI"
  extraParams?: Record<string, string | number | boolean>;
}

export const DEFAULT_BEZREALITKY_CONFIG: BezrealitkyScraperConfig = {
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
};

export function buildBezrealitkyUrl(config: BezrealitkyScraperConfig): string {
  const baseUrl = "https://www.bezrealitky.cz/vyhledat";
  const params = new URLSearchParams();

  // Add disposition parameters (can have multiple)
  config.dispositions?.forEach((disp) => {
    params.append("disposition", disp);
  });

  // Add other parameters
  params.append("estateType", config.estateType);
  params.append("location", config.location);
  params.append("offerType", config.offerType);
  params.append("osm_value", config.osmValue);
  params.append("priceFrom", config.priceFrom.toString());
  params.append("priceTo", config.priceTo.toString());
  params.append("regionOsmIds", config.regionOsmIds);
  params.append("currency", config.currency);
  if (config.landType) {
    params.append("landType", config.landType);
  }
  if (config.extraParams) {
    Object.entries(config.extraParams).forEach(([key, value]) => {
      params.append(key, String(value));
    });
  }

  return `${baseUrl}?${params.toString()}`;
}

export function buildIdnesUrl(config: IdnesScraperConfig): string {
  if (config.propertyKind === "land") {
    const baseUrl = `https://reality.idnes.cz/s/pozemky/${config.landSubtype}`;
    const priceRange =
      typeof config.priceMin === "number" && typeof config.priceMax === "number"
        ? `cena-nad-${config.priceMin}-do-${config.priceMax}`
        : typeof config.priceMax === "number"
          ? `cena-do-${config.priceMax}`
          : typeof config.priceMin === "number"
            ? `cena-nad-${config.priceMin}`
            : "";

    const pathname = [baseUrl, priceRange, config.city].filter(Boolean).join("/");
    const params = new URLSearchParams();

    if (typeof config.roomCount === "number") {
      params.set("s-rd", config.roomCount.toString());
    }
    if (config.ownership) {
      params.set("s-qc[ownership]", config.ownership);
    }
    const articleAge = toIdnesArticleAge(config.freshness);
    if (articleAge) {
      params.set("s-qc[articleAge]", articleAge);
    }

    const query = params.toString();
    return query ? `${pathname}/?${query}` : `${pathname}/`;
  }

  if (config.propertyKind === "house") {
    const baseUrl = "https://reality.idnes.cz/s/prodej/domy";
    const priceRange =
      typeof config.priceMin === "number" && typeof config.priceMax === "number"
        ? `cena-nad-${config.priceMin}-do-${config.priceMax}`
        : typeof config.priceMax === "number"
          ? `cena-do-${config.priceMax}`
          : typeof config.priceMin === "number"
            ? `cena-nad-${config.priceMin}`
            : "";

    const pathname = [baseUrl, priceRange, config.city].filter(Boolean).join("/");
    const params = new URLSearchParams();

    if (config.houseSubtype) {
      params.set("s-qc[subtypeHouse]", config.houseSubtype);
    }
    if (typeof config.roomCount === "number") {
      params.set("s-qc[roomCount]", config.roomCount.toString());
      params.set("s-rd", config.roomCount.toString());
    }
    if (typeof config.areaMin === "number") {
      params.set("s-qc[usableAreaMin]", config.areaMin.toString());
    }
    if (config.ownership) {
      params.set("s-qc[ownership]", config.ownership);
    }
    if (config.condition) {
      params.set("s-qc[condition]", config.condition);
    }
    if (config.material) {
      params.set("s-qc[material]", config.material);
    }
    const articleAge = toIdnesArticleAge(config.freshness);
    if (articleAge) {
      params.set("s-qc[articleAge]", articleAge);
    }

    const query = params.toString();
    return query ? `${pathname}/?${query}` : `${pathname}/`;
  }

  const baseUrl = "https://reality.idnes.cz/s/prodej/byty";
  const priceRange = `cena-nad-${config.priceMin}-do-${config.priceMax}`;

  const params = new URLSearchParams({
    "s-rd": config.roomCount.toString(),
    "s-qc[subtypeFlat]": config.rooms,
    "s-qc[usableAreaMin]": config.areaMin.toString(),
    "s-qc[ownership]": config.ownership,
    "s-qc[material]": config.material,
    ...(toIdnesArticleAge(config.freshness)
      ? { "s-qc[articleAge]": toIdnesArticleAge(config.freshness)! }
      : {}),
  });

  return `${baseUrl}/${priceRange}/${config.city}/?${params.toString()}`;
}

export interface SrealityScraperConfig {
  offerType: string; // e.g., "prodej" or "pronajem"
  category: string; // e.g., "byty"
  locationSlug: string; // e.g., "brno" or "jihomoravsky-kraj/brno"
  sizes?: string[]; // e.g., ["2+1", "2+kk", "3+1", "3+kk"]
  ownership?: string; // e.g., "osobni"
  age?: "dnes" | "tyden" | "mesic"; // e.g., "den", "tyden", "mesic"
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  page?: number;
  newOnly?: boolean;
  extraParams?: Record<string, string | number | boolean>;
}

export function buildSrealityUrl(config: SrealityScraperConfig): string {
  const sanitizedLocation = config.locationSlug.replace(/^\/+|\/+$/g, "");
  const baseUrl = `https://www.sreality.cz/hledani/${config.offerType}/${config.category}/${sanitizedLocation}`;

  const params = new URLSearchParams();

  if (config.sizes && config.sizes.length > 0) {
    params.set("velikost", config.sizes.join(","));
  }

  if (config.ownership) {
    params.set("vlastnictvi", config.ownership);
  }

  if (typeof config.priceMin === "number") {
    params.set("cena-od", config.priceMin.toString());
  }

  if (typeof config.priceMax === "number") {
    params.set("cena-do", config.priceMax.toString());
  }

  if (typeof config.areaMin === "number") {
    params.set("plocha-od", config.areaMin.toString());
  }

  if (typeof config.areaMax === "number") {
    params.set("plocha-do", config.areaMax.toString());
  }

  if (config.age) {
    params.set("stari", config.age);
  }

  if (typeof config.page === "number" && config.page > 1) {
    params.set("strana", config.page.toString());
  }

  if (config.extraParams) {
    Object.entries(config.extraParams).forEach(([key, value]) => {
      params.set(key, String(value));
    });
  }

  const query = params.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

// ============================================================================
// OkDrazby.cz Configuration
// ============================================================================

export interface OkDrazbyScraperConfig {
  propertyKind: "apartment" | "land" | "house";
  regionIds: number[];
  countyIds?: number[];
  statuses?: string[];
  nameOrNumber?: string;
  isInOverbid?: boolean;
  roomLayouts?: string[];
  subcategoryIds?: number[];
  extraCategoryIds?: number[];
  extraSubcategoryIds?: number[];
}

const OK_DRAZBY_ROOT_CATEGORY_ID = 2;
const OK_DRAZBY_CATEGORY_BY_KIND: Record<
  OkDrazbyScraperConfig["propertyKind"],
  number
> = {
  apartment: 11,
  house: 9,
  land: 10,
};

const OK_DRAZBY_ROOM_LAYOUT_TO_SUBCATEGORY_ID: Record<string, number> = {
  "1+1": 56,
  "1+kk": 57,
  "2+1": 58,
  "2+kk": 59,
  "3+1": 60,
  "3+kk": 61,
  "4+1": 62,
  "4+kk": 63,
  "5+1": 64,
  "5+kk": 65,
  "6 a více": 66,
  atypical: 67,
  pokoj: 68,
};

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isInteger(value)))];
}

function getOkDrazbySubcategoryIds(
  config: OkDrazbyScraperConfig,
  categoryId: number,
): number[] {
  if (config.subcategoryIds && config.subcategoryIds.length > 0) {
    return uniqueNumbers(config.subcategoryIds);
  }

  const defaultIds =
    config.propertyKind === "apartment"
      ? (config.roomLayouts ?? [])
          .map((layout) => OK_DRAZBY_ROOM_LAYOUT_TO_SUBCATEGORY_ID[layout])
          .filter((value): value is number => typeof value === "number")
      : getOkDrazbyChildCategories(categoryId).map((category) => category.id);

  return uniqueNumbers([...(defaultIds ?? []), ...(config.extraSubcategoryIds ?? [])]);
}

function getOkDrazbyLocationPathSlug(
  countyIds: number[],
  regionIds: number[],
): { slug?: string; selectedId?: number } {
  const firstCountyId = countyIds[0];
  if (typeof firstCountyId === "number") {
    const county = getOkDrazbyCountyById(firstCountyId);
    if (county) {
      return {
        slug: county.urlSlug,
        selectedId: county.id,
      };
    }
  }

  const firstRegionId = regionIds[0];
  if (typeof firstRegionId === "number") {
    const region = getOkDrazbyRegionById(firstRegionId);
    if (region) {
      return {
        slug: region.urlSlug,
        selectedId: region.id,
      };
    }
  }

  return {};
}

export function buildOkDrazbyUrl(config: OkDrazbyScraperConfig): string {
  const categoryId = OK_DRAZBY_CATEGORY_BY_KIND[config.propertyKind];
  const categoryIds = uniqueNumbers([categoryId, ...(config.extraCategoryIds ?? [])]);
  const subcategoryIds = getOkDrazbySubcategoryIds(config, categoryId);
  const locationIds = uniqueNumbers([...(config.countyIds ?? []), ...config.regionIds]);

  const propertyRoot = getOkDrazbyCategoryById(OK_DRAZBY_ROOT_CATEGORY_ID);
  const firstCategory = getOkDrazbyCategoryById(categoryIds[0]);
  const firstSubcategory =
    typeof subcategoryIds[0] === "number"
      ? getOkDrazbyCategoryById(subcategoryIds[0])
      : undefined;
  const { slug: locationSlug, selectedId: selectedLocationId } =
    getOkDrazbyLocationPathSlug(config.countyIds ?? [], config.regionIds);

  if (!propertyRoot || !firstCategory) {
    throw new Error("OkDrazby metadata is missing the selected root/category");
  }

  const pathSegments = [
    "https://okdrazby.cz/drazby",
    propertyRoot.urlSlug,
    firstCategory.urlSlug,
    firstSubcategory?.urlSlug,
    locationSlug,
  ].filter(Boolean);

  const params = new URLSearchParams();
  const remainingCategoryIds = categoryIds.slice(1);
  const remainingSubcategoryIds = subcategoryIds.slice(1);
  const remainingLocationIds = locationIds.filter((id) => id !== selectedLocationId);

  if (remainingCategoryIds.length > 0) {
    params.set("categoryIds", remainingCategoryIds.join(","));
  }

  if (remainingSubcategoryIds.length > 0) {
    params.set("subcategoryIds", remainingSubcategoryIds.join(","));
  }

  if (remainingLocationIds.length > 0) {
    params.set("locationIds", remainingLocationIds.join(","));
  }

  const query = params.toString();
  return query ? `${pathSegments.join("/")}?${query}` : pathSegments.join("/");
}

// ============================================================================
// Exdrazby.cz Configuration
// ============================================================================

export interface ExDrazbyScraperConfig {
  status: "prepared" | "ongoing" | "ended";
  mainCategoryId?: number;
  subcategoryIds?: number[];
  regionIds?: number[];
  districtIds?: number[];
  auctionType?: string;
  page?: number;
  perPage?: number;
  title?: string;
  priceFrom?: number;
  priceTo?: number;
}

const EX_DRAZBY_STATUS_TO_PATH: Record<ExDrazbyScraperConfig["status"], string> =
  {
    prepared: "pripravene",
    ongoing: "probihajici",
    ended: "ukoncene",
  };

export function buildExDrazbyUrl(config: ExDrazbyScraperConfig): string {
  const baseUrl = `https://exdrazby.cz/drazby-aukce/${
    EX_DRAZBY_STATUS_TO_PATH[config.status]
  }`;
  const params = new URLSearchParams();

  params.set("page", String(config.page ?? 1));
  params.set("perPage", String(config.perPage ?? 100));
  params.set("title", config.title ?? "");
  params.set(
    "priceTo",
    typeof config.priceTo === "number" ? String(config.priceTo) : "",
  );
  params.set(
    "priceFrom",
    typeof config.priceFrom === "number" ? String(config.priceFrom) : "",
  );
  params.set(
    "mainCategory",
    typeof config.mainCategoryId === "number" ? String(config.mainCategoryId) : "",
  );
  params.set("auctionType", config.auctionType ?? "");

  for (const subcategoryId of config.subcategoryIds ?? []) {
    params.append("subCategories", String(subcategoryId));
  }

  for (const regionId of config.regionIds ?? []) {
    params.append("regions", String(regionId));
  }

  for (const districtId of config.districtIds ?? []) {
    params.append("districts", String(districtId));
  }

  return `${baseUrl}?${params.toString()}`;
}

// ============================================================================
// Bazos.cz Configuration
// ============================================================================

export interface BazosScraperConfig {
  /**
   * Location code (hlokalita parameter).
   * 60200 = Brno-město area code
   * 69501 = Hodonín area code
   * 69002 = Břeclav area code
   */
  locationCode: string;

  /**
   * Search radius in km around the location (humkreis parameter)
   */
  radiusKm: number;

  /**
   * Minimum price filter (cenaod parameter). Empty string for no minimum.
   */
  priceMin?: number;

  /**
   * Maximum price filter (cenado parameter). Empty string for no maximum.
   */
  priceMax?: number;

  /**
   * Category type: "prodam" (for sale) or "pronajmu" (for rent)
   */
  offerType: "prodam" | "pronajmu";

  /**
   * Property kind mapped by the builder to the site-specific slug.
   */
  propertyKind: "apartment" | "land" | "house";

  /**
   * Whether to only include listings from today/yesterday (last ~24h)
   * Since bazos shows date but not time, we match today and yesterday's dates
   */
  recentOnly?: boolean;
}

export function buildBazosUrl(config: BazosScraperConfig): string {
  const baseUrl =
    config.propertyKind === "land"
      ? `https://reality.bazos.cz/${config.offerType}/pozemek/`
      : config.propertyKind === "house"
        ? "https://reality.bazos.cz/dum/"
        : `https://reality.bazos.cz/${config.offerType}/byt/`;

  const params = new URLSearchParams();
  params.set("hledat", "");
  params.set("rubriky", "reality");
  params.set("hlokalita", config.locationCode);
  params.set("humkreis", config.radiusKm.toString());
  params.set("cenaod", config.priceMin?.toString() || "");
  params.set("cenado", config.priceMax?.toString() || "");
  params.set("Submit", "Hledat");
  params.set("order", "");
  params.set("crp", "");
  params.set("kitx", "ano");

  return `${baseUrl}?${params.toString()}`;
}
