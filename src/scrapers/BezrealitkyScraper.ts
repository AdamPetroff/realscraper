import * as cheerio from "cheerio";
import { Property, type PropertyType } from "../types";
import { ScrapeOptions } from "./scraper.interface";
import { extractLocationMetadata } from "./location-metadata";

type ApolloCache = Record<string, any>;

const DISPOSITION_MAP: Record<string, string> = {
  DISP_1_1: "1+1",
  DISP_1_KK: "1+kk",
  DISP_2_1: "2+1",
  DISP_2_KK: "2+kk",
  DISP_3_1: "3+1",
  DISP_3_KK: "3+kk",
  DISP_4_1: "4+1",
  DISP_4_KK: "4+kk",
  DISP_5_1: "5+1",
  DISP_5_KK: "5+kk",
  DISP_6_1: "6+1",
  DISP_6_KK: "6+kk",
};

export class BezrealitkyScraper {
  constructor(private readonly defaultOptions: ScrapeOptions = {}) {}

  async initialize(): Promise<void> {
    // No initialization needed for fetch-based scraper
  }

  private getHeaders(): Record<string, string> {
    return {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
    };
  }

  async scrapeProperties(
    url: string,
    options?: ScrapeOptions
  ): Promise<Property[]> {
    const effectiveOptions: ScrapeOptions = {
      ...this.defaultOptions,
      ...options,
    };

    console.log(`BezrealitkyScraper: Fetching URL: ${url}`);

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(
          `BezrealitkyScraper: Request failed with status ${response.status}`
        );
        throw new Error(`Request failed: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const scriptContent = $("#__NEXT_DATA__").html();

      if (!scriptContent) {
        console.warn("BezrealitkyScraper: __NEXT_DATA__ not found in page.");
        return [];
      }

      let apolloCache: ApolloCache | undefined;

      try {
        const data = JSON.parse(scriptContent);
        apolloCache = data?.props?.pageProps?.apolloCache as ApolloCache;
      } catch (error) {
        console.error(
          "BezrealitkyScraper: Failed to parse __NEXT_DATA__ JSON",
          error
        );
        return [];
      }

      if (!apolloCache) {
        console.warn(
          "BezrealitkyScraper: apolloCache missing in __NEXT_DATA__"
        );
        return [];
      }

      const advertRefs = this.extractAdvertRefs(apolloCache);

      if (advertRefs.length === 0) {
        console.warn(
          "BezrealitkyScraper: No advert references found in cache."
        );
        return [];
      }

      const properties: Property[] = [];
      const newOnly = effectiveOptions.newOnly ?? false;

      for (const ref of advertRefs) {
        const advert = apolloCache[ref];
        if (!advert) {
          continue;
        }

        const property = this.transformAdvert(advert, apolloCache);
        if (property) {
          if (newOnly && !property.isNew) {
            continue;
          }
          properties.push(property);
        }
      }

      console.log(`BezrealitkyScraper: Found ${properties.length} properties`);
      return properties;
    } catch (error) {
      console.error("BezrealitkyScraper: Error fetching properties:", error);
      throw error;
    }
  }

  private extractAdvertRefs(apolloCache: ApolloCache): string[] {
    const rootQuery = apolloCache["ROOT_QUERY"];

    if (!rootQuery) {
      return [];
    }

    const refs = new Set<string>();

    Object.entries(rootQuery).forEach(([key, value]) => {
      if (
        !key.startsWith("listAdverts") ||
        !value ||
        typeof value !== "object"
      ) {
        return;
      }

      const list = (value as { list?: Array<{ __ref?: string }> }).list;

      if (!Array.isArray(list)) {
        return;
      }

      list.forEach((item) => {
        if (
          item &&
          typeof item === "object" &&
          typeof item.__ref === "string"
        ) {
          refs.add(item.__ref);
        }
      });
    });

    return Array.from(refs);
  }

  private transformAdvert(
    advert: any,
    apolloCache: ApolloCache
  ): Property | null {
    if (!advert) {
      return null;
    }

    const imageAltTextKey = 'imageAltText({"locale":"CS"})';
    const addressKey = 'address({"locale":"CS"})';
    const tagsKey = 'tags({"locale":"CS"})';
    const publicImagesKey = 'publicImages({"limit":3})';

    const title: string = advert[imageAltTextKey] || advert.uri || "";
    const location: string = advert[addressKey] || "";
    const priceNumber: number | undefined =
      typeof advert.price === "number" ? advert.price : undefined;
    const chargesNumber: number | undefined =
      typeof advert.charges === "number" ? advert.charges : undefined;
    const currency: string = advert.currency || "CZK";
    const disposition: string = advert.disposition || "";
    const uri: string = advert.uri || "";

    const price = this.formatPrice(priceNumber, chargesNumber, currency);
    const areaValue = this.resolveAreaValue(advert.surface);
    const area = this.formatArea(areaValue);
    const pricePerSqm = this.resolvePricePerSqm(advert, priceNumber, areaValue);
    const rooms = this.formatRooms(disposition);
    const description = this.formatDescription(advert[tagsKey]);
    const url = this.buildListingUrl(uri);
    const images = this.extractImages(advert[publicImagesKey], apolloCache);
    const isNew = this.detectIsNew(advert);
    const { district, region } = extractLocationMetadata(location);

    if (!title || !price || !url) {
      return null;
    }

    const property: Property = {
      title,
      price,
      location,
      district,
      region,
      area,
      rooms,
      url,
      description,
      isNew,
      // Database identification fields
      source: "bezrealitky",
      sourceId: uri, // Use URI as the unique identifier
      priceNumeric: priceNumber,
      pricePerSqm,
      propertyType: this.resolvePropertyType(uri, title),
    };

    if (images.length > 0) {
      property.images = images;
    }

    return property;
  }

  private detectIsNew(advert: any): boolean {
    if (advert?.isNew === true) {
      return true;
    }

    const tagsKey = 'tags({"locale":"CS"})';
    const tagsValue = advert?.[tagsKey];

    if (Array.isArray(tagsValue) && tagsValue.some((tag) => tag === "Nový")) {
      return true;
    }

    return false;
  }

  private resolvePropertyType(
    uri: string,
    title: string,
  ): PropertyType | undefined {
    const haystack = `${uri} ${title}`.toLowerCase();

    if (haystack.includes("pozem")) {
      return "land";
    }

    if (haystack.includes("domu") || haystack.includes("dum")) {
      return "house";
    }

    if (haystack.includes("bytu") || haystack.includes("byt")) {
      return "apartment";
    }

    return undefined;
  }

  private formatPrice(
    price?: number,
    charges?: number,
    currency: string = "CZK"
  ): string {
    if (!price) {
      return "";
    }

    const formatter = new Intl.NumberFormat("cs-CZ");
    const formattedPrice = `${formatter.format(price)} ${currency}`;

    if (charges && charges > 0) {
      return `${formattedPrice} + ${formatter.format(charges)} ${currency}`;
    }

    return formattedPrice;
  }

  private resolveAreaValue(surface?: number): number | undefined {
    if (!surface || surface <= 0 || !Number.isFinite(surface)) {
      return undefined;
    }
    return surface;
  }

  private formatArea(surface?: number): string | undefined {
    if (typeof surface !== "number" || surface <= 0) {
      return undefined;
    }
    return Number.isInteger(surface)
      ? surface.toString()
      : surface.toFixed(1).replace(/\.0$/, "");
  }

  private resolvePricePerSqm(
    advert: any,
    priceNumber?: number,
    areaValue?: number
  ): number | undefined {
    const candidateKeys = [
      "pricePerSqm",
      "pricePerM2",
      "pricePerMeter",
      "pricePerSquareMeter",
      "price_per_sqm",
    ];

    for (const key of candidateKeys) {
      const value = advert?.[key];
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return Math.round(value);
      }
    }

    if (
      typeof priceNumber === "number" &&
      Number.isFinite(priceNumber) &&
      priceNumber > 0 &&
      typeof areaValue === "number" &&
      Number.isFinite(areaValue) &&
      areaValue > 0
    ) {
      return Math.round(priceNumber / areaValue);
    }

    return undefined;
  }

  private formatRooms(disposition: string): string {
    if (!disposition) {
      return "";
    }
    return (
      DISPOSITION_MAP[disposition] ||
      disposition.replace("DISP_", "").replace("_", "+")
    );
  }

  private formatDescription(tags: unknown): string | undefined {
    if (!Array.isArray(tags)) {
      return undefined;
    }
    return tags.filter((tag) => typeof tag === "string").join(" • ");
  }

  private buildListingUrl(uri?: string): string {
    if (!uri) {
      return "";
    }
    if (uri.startsWith("http")) {
      return uri;
    }
    return `https://www.bezrealitky.cz/nemovitosti-byty-domy/${uri}`;
  }

  private extractImages(
    imageRefs: unknown,
    apolloCache: ApolloCache
  ): string[] {
    if (!Array.isArray(imageRefs)) {
      return [];
    }

    const images: string[] = [];

    imageRefs.forEach((item) => {
      if (!item || typeof item !== "object" || typeof item.__ref !== "string") {
        return;
      }

      const image = apolloCache[item.__ref];
      if (!image) {
        return;
      }

      const mainUrl = image['url({"filter":"RECORD_MAIN"})'];
      const thumbUrl = image['url({"filter":"RECORD_THUMB"})'];

      if (typeof mainUrl === "string") {
        images.push(mainUrl);
      } else if (typeof thumbUrl === "string") {
        images.push(thumbUrl);
      }
    });

    return images;
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}
