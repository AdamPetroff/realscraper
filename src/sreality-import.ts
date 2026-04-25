import {
  createStoredScrapeKey,
  expandSharedScrape,
  findKnownLocationForSrealityImport,
  type ScrapeLocationConfig,
  type ScraperType,
  type SharedFreshness,
  type SharedOfferType,
  type SharedPropertyKind,
  type SharedScrapeSearchConfig,
  type StoredSharedScrapeConfig,
} from "./scrape-configs";

export interface SrealityImportResult {
  draftConfig: StoredSharedScrapeConfig;
  mode: "all-sites" | "sreality-only";
  warnings: string[];
}

const SUPPORTED_QUERY_KEYS = new Set([
  "velikost",
  "vlastnictvi",
  "cena-od",
  "cena-do",
  "plocha-od",
  "plocha-do",
  "stari",
  "strana",
  "za-m2",
  "region",
  "region-id",
  "region-typ",
  "vzdalenost",
]);

const SUPPORTED_SALE_SCRAPERS: ScraperType[] = [
  "idnes",
  "bezrealitky",
  "sreality",
  "bazos",
  "okdrazby",
];

const SUPPORTED_RENT_SCRAPERS: ScraperType[] = [
  "idnes",
  "bezrealitky",
  "sreality",
  "bazos",
];

export function importStoredScrapeConfigFromSrealityUrl(input: {
  name: string;
  url: string;
}): SrealityImportResult {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Import name is required");
  }

  const parsedUrl = parseSrealityUrl(input.url);
  const warnings: string[] = [];

  const propertyKind = parsePropertyKind(parsedUrl.categoryPath);
  const offerType = parseOfferType(parsedUrl.offerType);
  const mappedLocation = findKnownLocationForSrealityImport(
    parsedUrl.locationSlug,
    propertyKind,
  );

  const search: SharedScrapeSearchConfig = {
    offerType,
    propertyKind,
    location:
      mappedLocation ??
      createSrealityOnlyLocation(parsedUrl.locationSlug, propertyKind),
    onlyNew: false,
  };

  const srealityOverrideExtraParams: Record<string, string | number | boolean> = {};
  const ignoredQueryKeys = new Set<string>();

  for (const [key, rawValue] of parsedUrl.searchParams.entries()) {
    switch (key) {
      case "velikost": {
        if (propertyKind !== "apartment") {
          warnings.push(`Ignored apartment-only filter "${key}" for ${propertyKind}.`);
          ignoredQueryKeys.add(key);
          break;
        }
        const sizes = rawValue
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (sizes.length > 0) {
          search.roomLayouts = sizes;
        }
        break;
      }
      case "vlastnictvi": {
        if (rawValue === "osobni") {
          search.ownership = "personal";
        } else {
          warnings.push(`Unsupported ownership "${rawValue}" kept only for Sreality.`);
          srealityOverrideExtraParams[key] = rawValue;
        }
        break;
      }
      case "cena-od": {
        if (propertyKind === "land" && parsedUrl.searchParams.get("za-m2") === "1") {
          search.pricePerSqmMin = parsePositiveInteger(rawValue, key);
        } else {
          search.priceMin = parsePositiveInteger(rawValue, key);
        }
        break;
      }
      case "cena-do": {
        if (propertyKind === "land" && parsedUrl.searchParams.get("za-m2") === "1") {
          search.pricePerSqmMax = parsePositiveInteger(rawValue, key);
        } else {
          search.priceMax = parsePositiveInteger(rawValue, key);
        }
        break;
      }
      case "plocha-od":
        search.areaMin = parsePositiveInteger(rawValue, key);
        break;
      case "plocha-do":
        search.areaMax = parsePositiveInteger(rawValue, key);
        break;
      case "stari": {
        const freshness = parseFreshness(rawValue);
        if (freshness) {
          search.freshness = freshness;
        } else {
          warnings.push(`Unsupported freshness "${rawValue}" was ignored.`);
          ignoredQueryKeys.add(key);
        }
        break;
      }
      case "strana":
        warnings.push('Ignored paging filter "strana".');
        ignoredQueryKeys.add(key);
        break;
      case "za-m2":
        if (!(propertyKind === "land" && rawValue === "1")) {
          warnings.push(`Unsupported price-mode filter "${rawValue}" kept only for Sreality.`);
          srealityOverrideExtraParams[key] = rawValue;
        }
        break;
      default:
        if (SUPPORTED_QUERY_KEYS.has(key)) {
          srealityOverrideExtraParams[key] = coerceOverrideValue(rawValue);
          warnings.push(`Filter "${key}" is kept only for Sreality.`);
        } else {
          ignoredQueryKeys.add(key);
          warnings.push(`Unsupported filter "${key}" was ignored.`);
        }
        break;
    }
  }

  const mode = mappedLocation ? "all-sites" : "sreality-only";
  if (mode === "sreality-only") {
    warnings.push(
      "Location is not mapped for the other websites, so this import will save as Sreality-only.",
    );
  }

  const overrides =
    Object.keys(srealityOverrideExtraParams).length > 0
      ? {
          sreality: {
            extraParams: srealityOverrideExtraParams,
          },
        }
      : undefined;

  const candidateConfig: StoredSharedScrapeConfig = {
    key: createStoredScrapeKey(name),
    label: name,
    enabled: true,
    scrapers:
      mode === "sreality-only"
        ? ["sreality"]
        : offerType === "sale"
          ? SUPPORTED_SALE_SCRAPERS.filter((scraper) =>
              scraper === "okdrazby" ? Boolean(search.location.okdrazby) : true,
            )
          : SUPPORTED_RENT_SCRAPERS,
    search,
    overrides,
  };

  const scrapers = candidateConfig.scrapers?.filter((scraper) => {
    const compatible = canExpandScraper({
      ...candidateConfig,
      scrapers: [scraper],
    });

    if (!compatible) {
      warnings.push(`Skipped ${scraper} because the imported filters do not map cleanly.`);
    }

    return compatible;
  });

  return {
    mode,
    warnings: dedupeWarnings(warnings),
    draftConfig: {
      ...candidateConfig,
      scrapers,
    },
  };
}

function parseSrealityUrl(input: string): {
  offerType: string;
  categoryPath: string;
  locationSlug: string;
  searchParams: URLSearchParams;
} {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error("Import URL must be a valid absolute URL");
  }

  if (parsed.hostname !== "www.sreality.cz" && parsed.hostname !== "sreality.cz") {
    throw new Error("Only Sreality URLs can be imported");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 4 || segments[0] !== "hledani") {
    throw new Error("Sreality URL must match /hledani/{offer}/{category}/{location}");
  }

  const offerType = segments[1];
  const remainder = segments.slice(2);
  const categoryInfo = parseCategorySegments(remainder);

  return {
    offerType,
    categoryPath: categoryInfo.categoryPath,
    locationSlug: categoryInfo.locationSlug,
    searchParams: parsed.searchParams,
  };
}

function parseCategorySegments(segments: string[]): {
  categoryPath: string;
  locationSlug: string;
} {
  if (segments[0] === "byty" || segments[0] === "domy") {
    const locationSlug = segments.slice(1).join("/");
    if (!locationSlug) {
      throw new Error("Sreality URL is missing the location slug");
    }

    return {
      categoryPath: segments[0],
      locationSlug,
    };
  }

  if (segments[0] === "pozemky") {
    if (segments[1] === "stavebni-parcely") {
      const locationSlug = segments.slice(2).join("/");
      if (!locationSlug) {
        throw new Error("Sreality URL is missing the location slug");
      }

      return {
        categoryPath: "pozemky/stavebni-parcely",
        locationSlug,
      };
    }

    const locationSlug = segments.slice(1).join("/");
    if (!locationSlug) {
      throw new Error("Sreality URL is missing the location slug");
    }

    return {
      categoryPath: "pozemky",
      locationSlug,
    };
  }

  throw new Error(`Unsupported Sreality category path "${segments.join("/")}"`);
}

function parseOfferType(value: string): SharedOfferType {
  if (value === "prodej") {
    return "sale";
  }
  if (value === "pronajem") {
    return "rent";
  }

  throw new Error(`Unsupported Sreality offer type "${value}"`);
}

function parsePropertyKind(categoryPath: string): SharedPropertyKind {
  if (categoryPath === "byty") {
    return "apartment";
  }
  if (categoryPath === "domy") {
    return "house";
  }
  if (categoryPath === "pozemky/stavebni-parcely" || categoryPath === "pozemky") {
    return "land";
  }

  throw new Error(`Unsupported Sreality category "${categoryPath}"`);
}

function parsePositiveInteger(value: string, key: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid numeric value for "${key}"`);
  }

  return Math.round(parsed);
}

function parseFreshness(value: string): SharedFreshness | undefined {
  switch (value) {
    case "dnes":
      return "today";
    case "tyden":
      return "week";
    case "mesic":
      return "month";
    default:
      return undefined;
  }
}

function createSrealityOnlyLocation(
  locationSlug: string,
  propertyKind: SharedPropertyKind,
): ScrapeLocationConfig {
  return {
    label: humanizeLocationLabel(locationSlug, propertyKind),
    srealityLocationSlug: locationSlug,
  };
}

function humanizeLocationLabel(
  locationSlug: string,
  propertyKind: SharedPropertyKind,
): string {
  const base = locationSlug
    .split("/")
    .map((segment) =>
      segment
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    )
    .join(", ");

  return base || propertyKind;
}

function coerceOverrideValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;

  const numeric = Number(value);
  if (value !== "" && Number.isFinite(numeric)) {
    return numeric;
  }

  return value;
}

function dedupeWarnings(warnings: string[]): string[] {
  return [...new Set(warnings)];
}

function canExpandScraper(config: StoredSharedScrapeConfig): boolean {
  try {
    return expandSharedScrape(config).length > 0;
  } catch {
    return false;
  }
}
