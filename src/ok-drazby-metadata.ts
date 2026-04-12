import { readFileSync } from "fs";
import path from "path";

interface OkDrazbyCategory {
  id: number;
  categoryCode: string;
  category: string;
  urlSlug: string;
  level: number;
  parentCategoryId: number | null;
}

interface OkDrazbyLocation {
  id: number;
  name: string;
  parentLocationId: number | null;
  parentLocationName: string | null;
  urlSlug: string;
}

interface OkDrazbyMetadataPayload {
  portalParameters: {
    categories: OkDrazbyCategory[];
    regions: OkDrazbyLocation[];
    counties: OkDrazbyLocation[];
  };
  cdnUrl?: string;
}

let metadataCache: OkDrazbyMetadataPayload | null = null;

function loadMetadata(): OkDrazbyMetadataPayload {
  if (metadataCache) {
    return metadataCache;
  }

  const metadataPath = path.resolve(__dirname, "../ok-drazby-categories-map.json");
  metadataCache = JSON.parse(
    readFileSync(metadataPath, "utf8"),
  ) as OkDrazbyMetadataPayload;

  return metadataCache;
}

export function getOkDrazbyCategories(): OkDrazbyCategory[] {
  return loadMetadata().portalParameters.categories;
}

export function getOkDrazbyCategoryById(
  id: number,
): OkDrazbyCategory | undefined {
  return getOkDrazbyCategories().find((category) => category.id === id);
}

export function getOkDrazbyChildCategories(parentId: number): OkDrazbyCategory[] {
  return getOkDrazbyCategories().filter(
    (category) => category.parentCategoryId === parentId,
  );
}

export function getOkDrazbyRegions(): OkDrazbyLocation[] {
  return loadMetadata().portalParameters.regions;
}

export function getOkDrazbyRegionById(id: number): OkDrazbyLocation | undefined {
  return getOkDrazbyRegions().find((region) => region.id === id);
}

export function getOkDrazbyCounties(): OkDrazbyLocation[] {
  return loadMetadata().portalParameters.counties;
}

export function getOkDrazbyCountyById(id: number): OkDrazbyLocation | undefined {
  return getOkDrazbyCounties().find((county) => county.id === id);
}

export function getOkDrazbyCdnUrl(): string | undefined {
  return loadMetadata().cdnUrl;
}
