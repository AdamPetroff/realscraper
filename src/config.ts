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

export const DEFAULT_BEZREALITKY_URL =
  "https://www.bezrealitky.cz/vyhledat?disposition=DISP_2_1&disposition=DISP_2_KK&disposition=DISP_3_1&disposition=DISP_3_KK&estateType=BYT&location=exact&offerType=PRODEJ&osm_value=Brno-m%C4%9Bsto,+Jihomoravsk%C3%BD+kraj,+Jihov%C3%BDchod,+%C4%8Cesko&priceFrom=3000000&priceTo=7000000&regionOsmIds=R442273&currency=CZK";

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
