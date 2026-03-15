import * as cheerio from "cheerio";
import type { Property } from "../types";
import type { PropertyType } from "../types";
import type { TelegramService } from "../telegram-service";
import type { ScrapeOptions } from "./scraper.interface";

type SrealityScrapeOptions = ScrapeOptions & {
  newOnly?: boolean;
};

interface SrealityLocality {
  city?: string;
  citySeoName?: string;
  cityPart?: string;
  cityPartSeoName?: string;
  district?: string;
  region?: string;
  street?: string;
}

interface SrealityEstate {
  id: number;
  name?: string;
  locality?: SrealityLocality;
  priceCzk?: number;
  priceSummaryCzk?: number;
  priceCzkPerSqM?: number;
  surface?: number;
  usableArea?: number;
  categoryTypeCb?: { name?: string; value?: number };
  categoryMainCb?: { name?: string; value?: number };
  categorySubCb?: { name?: string; value?: number };
  images?: Array<{ url?: string }>;
  watchdogBadge?: string;
  discountShow?: boolean;
}

interface SrealityApiResponse {
  pageProps?: {
    total?: number;
    dehydratedState?: {
      queries?: Array<{
        state?: {
          data?: {
            results?: SrealityEstate[];
            pagination?: { page: number; limit: number; total: number };
          };
        };
      }>;
    };
  };
}

export class SrealityScraper {
  private buildId: string | null = null;

  constructor(
    private readonly defaultOptions: SrealityScrapeOptions = {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private readonly telegramService?: TelegramService
  ) {}

  async initialize(): Promise<void> {
    // Fetch build ID from the main page
    await this.fetchBuildId();
  }

  private async fetchBuildId(): Promise<void> {
    try {
      const response = await fetch(
        "https://www.sreality.cz/hledani/prodej/byty",
        {
          headers: this.getHeaders(),
        }
      );

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract build ID from __NEXT_DATA__
      const nextDataScript = $("#__NEXT_DATA__").html();
      if (nextDataScript) {
        const data = JSON.parse(nextDataScript);
        this.buildId = data.buildId;
        console.log(`SrealityScraper: Found build ID: ${this.buildId}`);
        return;
      }

      // Fallback: try to find it in script tags
      const scripts = $('script[src*="/_next/static/"]').toArray();
      for (const script of scripts) {
        const src = $(script).attr("src");
        if (src) {
          const match = src.match(/\/_next\/static\/([^/]+)\//);
          if (match) {
            this.buildId = match[1];
            console.log(
              `SrealityScraper: Found build ID from script: ${this.buildId}`
            );
            return;
          }
        }
      }

      console.warn(
        "SrealityScraper: Could not extract build ID, will try without it"
      );
    } catch (error) {
      console.error("SrealityScraper: Failed to fetch build ID:", error);
    }
  }

  private getHeaders(referer?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      "x-nextjs-data": "1",
      Connection: "keep-alive",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
    };

    if (referer) {
      headers.Referer = referer;
    }

    return headers;
  }

  async scrapeProperties(
    url: string,
    options?: SrealityScrapeOptions
  ): Promise<Property[]> {
    const effectiveOptions: SrealityScrapeOptions = {
      ...this.defaultOptions,
      ...options,
    };

    // Ensure we have a build ID
    if (!this.buildId) {
      await this.fetchBuildId();
    }

    // Convert user URL to API URL
    const apiUrl = this.convertToApiUrl(url);
    console.log(`SrealityScraper: Fetching API URL: ${apiUrl}`);

    try {
      const response = await fetch(apiUrl, {
        headers: this.getHeaders(url),
      });

      if (!response.ok) {
        console.error(
          `SrealityScraper: API request failed with status ${response.status}`
        );
        // Try to refetch build ID and retry once
        if (response.status === 404 && this.buildId) {
          console.log("SrealityScraper: Retrying with fresh build ID...");
          this.buildId = null;
          await this.fetchBuildId();
          const retryUrl = this.convertToApiUrl(url);
          const retryResponse = await fetch(retryUrl, {
            headers: this.getHeaders(url),
          });
          if (!retryResponse.ok) {
            throw new Error(`API request failed: ${retryResponse.status}`);
          }
          return this.parseResponse(
            await retryResponse.json(),
            effectiveOptions
          );
        }
        throw new Error(`API request failed: ${response.status}`);
      }

      const data: SrealityApiResponse = await response.json();
      return this.parseResponse(data, effectiveOptions);
    } catch (error) {
      console.error("SrealityScraper: Error fetching properties:", error);
      throw error;
    }
  }

  private convertToApiUrl(userUrl: string): string {
    const url = new URL(userUrl);
    const pathname = url.pathname; // e.g., /hledani/prodej/byty/brno
    const searchParams = url.searchParams;

    // Extract slug parts from pathname
    const pathParts = pathname.split("/").filter(Boolean); // ['hledani', 'prodej', 'byty', 'brno']

    // Build the API URL
    // Format: /_next/data/{buildId}/cs{pathname}.json?{params}&slug=...&slug=...
    const buildIdPart = this.buildId || "1.0.425"; // fallback version

    // Add slug parameters for each path part after 'hledani'
    const slugParts = pathParts.slice(1); // ['prodej', 'byty', 'brno']
    slugParts.forEach((slug) => {
      searchParams.append("slug", slug);
    });

    const apiUrl = `https://www.sreality.cz/_next/data/${buildIdPart}/cs${pathname}.json?${searchParams.toString()}`;
    return apiUrl;
  }

  private parseResponse(
    data: SrealityApiResponse,
    options: SrealityScrapeOptions
  ): Property[] {
    const newOnly = options.newOnly ?? false;
    const properties: Property[] = [];

    // Extract estates from dehydratedState.queries[].state.data.results
    const queries = data.pageProps?.dehydratedState?.queries || [];
    let estates: SrealityEstate[] = [];

    for (const query of queries) {
      const results = query.state?.data?.results;
      if (Array.isArray(results) && results.length > 0) {
        estates = results;
        break;
      }
    }

    console.log(
      `SrealityScraper: Found ${estates.length} estates in API response`
    );

    for (const estate of estates) {
      const property = this.transformEstate(estate);
      if (!property) continue;

      if (newOnly && !property.isNew) {
        continue;
      }

      properties.push(property);
    }

    return properties;
  }

  private transformEstate(estate: SrealityEstate): Property | null {
    const title = estate.name || "";
    const locality = estate.locality || {};

    // Build location string
    const locationParts: string[] = [];
    if (locality.street) locationParts.push(locality.street);
    if (locality.cityPart) locationParts.push(locality.cityPart);
    if (locality.city) locationParts.push(locality.city);
    const location = locationParts.join(", ");

    // Handle price
    const priceValue = estate.priceSummaryCzk || estate.priceCzk;
    const price = priceValue ? this.formatPrice(priceValue) : "";

    // Build URL: https://www.sreality.cz/detail/prodej/byt/2+kk/brno-kralovo-pole/1889518412
    const url = this.buildListingUrl(estate);

    if (!title || !price || !url) {
      return null;
    }

    // Extract area and rooms
    const areaSqm = this.resolveAreaSqm(estate, title);
    const area = areaSqm ? this.formatArea(areaSqm) : undefined;
    const rooms = this.resolveRooms(estate, title);
    const pricePerSqm = this.resolvePricePerSqm(estate, priceValue, areaSqm);

    // Extract images
    const images: string[] = [];
    if (estate.images) {
      for (const img of estate.images) {
        if (img.url) {
          images.push(
            img.url.startsWith("//")
              ? `https:${img.url}?fl=res,1200,1200,1|wrm,/watermark/sreality.png,10|shr,,20|webp,80`
              : img.url
          );
        }
      }
    }

    // Check if new (watchdogBadge indicates new listings)
    const isNew = estate.watchdogBadge === "new" || false;

    const property: Property = {
      title,
      price,
      location,
      district: locality.district,
      region: locality.region,
      area,
      rooms,
      url,
      isNew,
      // Database identification fields
      source: "sreality",
      sourceId: String(estate.id),
      priceNumeric: priceValue || undefined,
      pricePerSqm,
      propertyType: this.resolvePropertyType(estate),
    };

    if (images.length > 0) {
      property.images = images;
    }

    return property;
  }

  private buildListingUrl(estate: SrealityEstate): string {
    if (!estate.id) return "";

    const locality = estate.locality || {};
    const categoryType = estate.categoryTypeCb?.name?.toLowerCase() || "prodej";
    let categoryMainRaw = estate.categoryMainCb?.name?.toLowerCase() || "byt";
    const categoryMain = categoryMainRaw === "byty" ? "byt" : categoryMainRaw;

    // Build location part of URL
    let locationSlug = "";
    if (locality.citySeoName) {
      locationSlug = locality.citySeoName;
      if (locality.cityPartSeoName) {
        locationSlug += `-${locality.cityPartSeoName}`;
      }
    }

    // Map category sub to URL format (e.g., "2+kk" stays as is)
    const categorySubName = estate.categorySubCb?.name || "";
    const categorySubSlug = categorySubName.toLowerCase();

    // Format: /detail/prodej/byt/2-kk/brno-kralovo-pole/1889518412
    return `https://www.sreality.cz/detail/${categoryType}/${categoryMain}/${categorySubSlug}/${locationSlug}/${estate.id}`;
  }

  private resolvePropertyType(estate: SrealityEstate): PropertyType | undefined {
    const categoryMain = estate.categoryMainCb?.name?.toLowerCase();

    if (categoryMain === "byty" || categoryMain === "byt") {
      return "apartment";
    }

    if (categoryMain === "pozemky" || categoryMain === "pozemek") {
      return "land";
    }

    if (categoryMain === "domy" || categoryMain === "dum") {
      return "house";
    }

    return undefined;
  }

  private formatPrice(price: number, currency: string = "Kč"): string {
    const formatter = new Intl.NumberFormat("cs-CZ");
    return `${formatter.format(price)} ${currency}`;
  }

  private extractArea(title: string): string | undefined {
    const match = title.match(/(\d+(?:[.,]\d+)?)\s*m²?/i);
    return match ? match[1].replace(",", ".") : undefined;
  }

  private parseAreaValue(area?: string): number | undefined {
    if (!area) return undefined;
    const match = area.match(/(\d+(?:[.,]\d+)?)/);
    if (!match) return undefined;
    const parsed = Number.parseFloat(match[1].replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return parsed;
  }

  private resolveAreaSqm(estate: SrealityEstate, title: string): number | undefined {
    const numericCandidates = [estate.surface, estate.usableArea];
    for (const candidate of numericCandidates) {
      if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
        return candidate;
      }
    }

    const areaFromTitle = this.extractArea(title);
    return this.parseAreaValue(areaFromTitle);
  }

  private formatArea(areaSqm: number): string {
    const normalized = Number.isInteger(areaSqm)
      ? areaSqm.toString()
      : areaSqm.toFixed(1).replace(/\.0$/, "");
    return normalized;
  }

  private resolvePricePerSqm(
    estate: SrealityEstate,
    priceValue?: number,
    areaSqm?: number
  ): number | undefined {
    if (typeof estate.priceCzkPerSqM === "number" && estate.priceCzkPerSqM > 0) {
      return Math.round(estate.priceCzkPerSqM);
    }
    if (typeof priceValue === "number" && typeof areaSqm === "number" && areaSqm > 0) {
      return Math.round(priceValue / areaSqm);
    }
    return undefined;
  }

  private extractRooms(title: string): string {
    const match = title.match(/(\d+\s*\+\s*(?:kk|\d+))/i);
    return match ? match[1].replace(/\s+/g, "") : "";
  }

  private resolveRooms(estate: SrealityEstate, title: string): string {
    const titleRooms = this.extractRooms(title);
    if (titleRooms) {
      return titleRooms;
    }

    const categorySubName = estate.categorySubCb?.name;
    if (!categorySubName) {
      return "";
    }

    return this.extractRooms(categorySubName);
  }

  async close(): Promise<void> {
    // No browser to close - just reset state
    this.buildId = null;
  }
}
