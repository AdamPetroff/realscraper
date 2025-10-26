export interface IdnesScraperConfig {
  priceMin: number;
  priceMax: number;
  city: string;
  rooms: string; // e.g., "2k|21" for 2+kk or 2+1
  areaMin: number;
  ownership: string; // e.g., "personal"
  material: string; // e.g., "brick|wood|stone|skeleton|prefab|mixed"
  roomCount: number; // s-rd parameter
  articleAge?: string; // 1 / 7 / 31
}

export const DEFAULT_IDNES_CONFIG: IdnesScraperConfig = {
  priceMin: 3000000,
  priceMax: 6000000,
  city: "brno",
  rooms: "2k|21",
  areaMin: 36,
  ownership: "personal",
  material: "brick|wood|stone|skeleton|prefab|mixed",
  roomCount: 3,
  articleAge: "1", // Properties from last 1 day
};

export interface BezrealitkyScraperConfig {
  newOnly?: boolean;
  dispositions: string[]; // e.g., ["DISP_2_1", "DISP_2_KK", "DISP_3_1", "DISP_3_KK"]
  estateType: string; // e.g., "BYT"
  offerType: string; // e.g., "PRODEJ"
  location: string; // e.g., "exact"
  osmValue: string; // e.g., "Brno-město, Jihomoravský kraj, Jihovýchod, Česko"
  regionOsmIds: string; // e.g., "R442273"
  priceFrom: number;
  priceTo: number;
  currency: string; // e.g., "CZK"
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
};

export function buildBezrealitkyUrl(config: BezrealitkyScraperConfig): string {
  const baseUrl = "https://www.bezrealitky.cz/vyhledat";
  const params = new URLSearchParams();

  // Add disposition parameters (can have multiple)
  config.dispositions.forEach((disp) => {
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

  return `${baseUrl}?${params.toString()}`;
}

// Keep for backward compatibility
export const DEFAULT_BEZREALITKY_URL = buildBezrealitkyUrl(
  DEFAULT_BEZREALITKY_CONFIG
);

export function buildIdnesUrl(config: IdnesScraperConfig): string {
  const baseUrl = "https://reality.idnes.cz/s/prodej/byty";
  const priceRange = `cena-nad-${config.priceMin}-do-${config.priceMax}`;

  const params = new URLSearchParams({
    "s-rd": config.roomCount.toString(),
    "s-qc[subtypeFlat]": config.rooms,
    "s-qc[usableAreaMin]": config.areaMin.toString(),
    "s-qc[ownership]": config.ownership,
    "s-qc[material]": config.material,
    ...(config.articleAge ? { "s-qc[articleAge]": config.articleAge } : {}),
  });

  return `${baseUrl}/${priceRange}/${config.city}/?${params.toString()}`;
}
