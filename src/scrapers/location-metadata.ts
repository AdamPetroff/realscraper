type LocationMetadata = {
  district?: string;
  region?: string;
};

type CityMapping = {
  district: string;
  region: string;
};

const CITY_MAPPING: Record<string, CityMapping> = {
  brno: { district: "Brno-město", region: "Jihomoravský kraj" },
  modrice: { district: "Brno-venkov", region: "Jihomoravský kraj" },
  rosice: { district: "Brno-venkov", region: "Jihomoravský kraj" },
  breclav: { district: "Břeclav", region: "Jihomoravský kraj" },
  hodonin: { district: "Hodonín", region: "Jihomoravský kraj" },
  olomouc: { district: "Olomouc", region: "Olomoucký kraj" },
};

const DISTRICT_PATTERN = /\bokres\s+([^,;]+)/i;
const REGION_PATTERN = /([A-Za-zÀ-ž][^,;]*\bkraj)\b/i;

export function extractLocationMetadata(...inputs: Array<string | undefined>): LocationMetadata {
  const values = inputs
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (values.length === 0) {
    return {};
  }

  let district = extractDistrictFromText(values);
  let region = extractRegionFromText(values);

  if (!district || !region) {
    const city = extractCityCandidate(values);
    if (city) {
      const mapping = CITY_MAPPING[normalizeKey(city)];
      if (mapping) {
        district = district || mapping.district;
        region = region || mapping.region;
      }
    }
  }

  return { district, region };
}

function extractDistrictFromText(values: string[]): string | undefined {
  for (const value of values) {
    const match = value.match(DISTRICT_PATTERN);
    if (match?.[1]) {
      return cleanup(match[1]);
    }
  }
  return undefined;
}

function extractRegionFromText(values: string[]): string | undefined {
  for (const value of values) {
    const match = value.match(REGION_PATTERN);
    if (match?.[1]) {
      return cleanup(match[1]);
    }
  }
  return undefined;
}

function extractCityCandidate(values: string[]): string | undefined {
  for (const value of values) {
    const tokens = value
      .split(",")
      .map((token) => cleanup(token))
      .filter(Boolean);

    for (const token of tokens) {
      if (/\d{3}\s?\d{2}/.test(token)) {
        continue;
      }
      if (token.includes(" - ")) {
        return cleanup(token.split(" - ")[0]);
      }
    }

    for (const token of tokens) {
      if (/\d{3}\s?\d{2}/.test(token)) {
        continue;
      }
      if (CITY_MAPPING[normalizeKey(token)]) {
        return token;
      }
    }

    for (const token of tokens) {
      if (/\d{3}\s?\d{2}/.test(token)) {
        continue;
      }
      return token;
    }
  }
  return undefined;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function cleanup(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
