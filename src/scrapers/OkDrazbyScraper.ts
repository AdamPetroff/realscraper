import * as cheerio from "cheerio";
import { Property, type PropertyType } from "../types";
import { ScrapeOptions } from "./scraper.interface";

interface OkDrazbyAuctionDetail {
  id: number;
  name?: string;
  shortDesc?: string | null;
  lowestSubmission?: number | null;
  categoryCode?: string | null;
  county?: string | null;
  region?: string | null;
}

const OK_DRAZBY_BASE_URL = "https://okdrazby.cz";

export class OkDrazbyScraper {
  constructor(private readonly defaultOptions: ScrapeOptions = {}) {}

  async initialize(): Promise<void> {
    // No initialization needed for fetch-based scraper
  }

  private getHeaders(): Record<string, string> {
    return {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: OK_DRAZBY_BASE_URL,
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "same-origin",
    };
  }

  async scrapeProperties(
    url: string,
    options?: ScrapeOptions,
  ): Promise<Property[]> {
    const resolvedOptions = {
      ...this.defaultOptions,
      ...options,
    };

    if (resolvedOptions.newOnly) {
      console.log(
        "OkDrazbyScraper: newOnly is not supported for this source, scraping all matched auctions",
      );
    }

    console.log(`OkDrazbyScraper: Fetching URL: ${url}`);

    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      console.error(
        `OkDrazbyScraper: Request failed with status ${response.status}`,
      );
      throw new Error(`Request failed: ${response.status}`);
    }

    const html = await response.text();
    return this.parsePropertiesFromHtml(html, url);
  }

  parsePropertiesFromHtml(html: string, sourceUrl: string): Property[] {
    const $ = cheerio.load(html);
    const auctionDetails = this.extractAuctionDetails(html);
    const properties: Property[] = [];

    $(".AuctionsList_auctionContentContainer__uUj_A").each((_, element) => {
      const $item = $(element);
      const link = $item.find('a[href^="/drazba/"]').first().attr("href");

      if (!link) {
        return;
      }

      const sourceId = this.extractIdFromUrl(link);
      if (!sourceId) {
        return;
      }

      const detail = auctionDetails.get(sourceId);
      const title = this.normalizeWhitespace(
        $item.find(".AuctionsList_auctionName__SCepP").first().text(),
      );
      const priceText = this.normalizeWhitespace(
        $item.find(".AuctionsList_auctionPrice__TwYNr").first().text(),
      );
      const priceNumeric =
        this.parseNumericPrice(priceText) ??
        (typeof detail?.lowestSubmission === "number"
          ? detail.lowestSubmission
          : undefined);
      const locationText = this.normalizeWhitespace(
        $item.find(".AuctionsList_auctionName__SCepP").first().nextAll("div").first().text(),
      );
      const district = detail?.county
        ? this.normalizeWhitespace(detail.county)
        : locationText || undefined;
      const region =
        detail?.region && detail.region !== detail.county
          ? this.normalizeWhitespace(detail.region)
          : detail?.region
            ? this.normalizeWhitespace(detail.region)
            : undefined;
      const areaValue =
        this.parseAreaValue(title) ?? this.parseAreaValue(detail?.shortDesc ?? "");
      const property: Property = {
        title,
        price:
          priceText ||
          (typeof priceNumeric === "number"
            ? `${new Intl.NumberFormat("cs-CZ").format(priceNumeric)} Kč`
            : ""),
        location: this.composeLocation(district, region, locationText),
        district,
        region,
        area: this.formatArea(areaValue),
        rooms: this.extractRooms(title) ?? "",
        url: new URL(link, sourceUrl).toString(),
        description: this.stripHtml(detail?.shortDesc),
        images: this.extractImages($item, sourceId),
        source: "okdrazby",
        sourceId,
        priceNumeric,
        pricePerSqm: this.resolvePricePerSqm(priceNumeric, areaValue),
        propertyType: this.resolvePropertyType(detail?.categoryCode, title),
      };

      if (property.title && property.price && property.url) {
        properties.push(property);
      }
    });

    return properties;
  }

  private extractAuctionDetails(html: string): Map<string, OkDrazbyAuctionDetail> {
    const details = new Map<string, OkDrazbyAuctionDetail>();
    for (const source of [html, html.replace(/\\"/g, '"')]) {
      const marker = '"auction":{';
      let cursor = 0;

      while (cursor >= 0 && cursor < source.length) {
        const markerIndex = source.indexOf(marker, cursor);
        if (markerIndex < 0) {
          break;
        }

        const objectStart = markerIndex + marker.length - 1;
        const objectEnd = this.findBalancedObjectEnd(source, objectStart);

        if (objectEnd < 0) {
          break;
        }

        const json = source.slice(objectStart, objectEnd + 1);
        try {
          const parsed = JSON.parse(json) as OkDrazbyAuctionDetail;
          if (typeof parsed.id === "number") {
            details.set(String(parsed.id), parsed);
          }
        } catch {
          // Ignore malformed snippets and continue with the DOM-only data.
        }

        cursor = objectEnd + 1;
      }
    }

    return details;
  }

  private findBalancedObjectEnd(source: string, startIndex: number): number {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < source.length; index += 1) {
      const char = source[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === "\\") {
          escaped = true;
          continue;
        }

        if (char === '"') {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{") {
        depth += 1;
        continue;
      }

      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
      }
    }

    return -1;
  }

  private extractIdFromUrl(url: string): string | undefined {
    return url.match(/\/drazba\/(\d+)(?:-|\/|$)/)?.[1];
  }

  private extractImages(
    $item: cheerio.Cheerio<any>,
    sourceId: string,
  ): string[] | undefined {
    const images = $item
      .find("img")
      .map((_, element) => {
        const src = element.attribs.src;
        return src && src.startsWith("http") ? src : undefined;
      })
      .get()
      .filter((value): value is string => Boolean(value));

    if (images.length > 0) {
      return [...new Set(images)];
    }

    return [
      `https://d1ws838f4e5d65.cloudfront.net/api/v1/portal/auctions/${sourceId}/images/main/preview`,
    ];
  }

  private parseNumericPrice(priceText: string): number | undefined {
    if (!priceText) {
      return undefined;
    }

    const match = priceText.match(/(\d[\d\s\u00a0.,]*)/);
    if (!match) {
      return undefined;
    }

    const normalized = match[1].replace(/[^\d]/g, "");
    const value = Number.parseInt(normalized, 10);
    return Number.isFinite(value) ? value : undefined;
  }

  private parseAreaValue(value: string): number | undefined {
    const match = value.match(/(\d+(?:[.,]\d+)?)\s*m(?:2|²)/i);
    if (!match) {
      return undefined;
    }

    const parsed = Number.parseFloat(match[1].replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  private formatArea(area?: number): string | undefined {
    if (typeof area !== "number") {
      return undefined;
    }

    return Number.isInteger(area)
      ? String(area)
      : area.toFixed(1).replace(/\.0$/, "");
  }

  private resolvePricePerSqm(
    price?: number,
    area?: number,
  ): number | undefined {
    if (
      typeof price !== "number" ||
      typeof area !== "number" ||
      !Number.isFinite(price) ||
      !Number.isFinite(area) ||
      price <= 0 ||
      area <= 0
    ) {
      return undefined;
    }

    return Math.round(price / area);
  }

  private stripHtml(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }

    const text = cheerio.load(`<div>${value}</div>`)("div").text();
    const normalized = this.normalizeWhitespace(text);
    return normalized || undefined;
  }

  private extractRooms(title: string): string | undefined {
    return title.match(/\b\d+\+(?:kk|\d)\b/i)?.[0];
  }

  private resolvePropertyType(
    categoryCode?: string | null,
    title?: string,
  ): PropertyType | undefined {
    switch (categoryCode) {
      case "apartments":
        return "apartment";
      case "houses":
        return "house";
      case "land":
        return "land";
      default:
        if (title?.match(/\b\d+\+(?:kk|\d)\b/i)) {
          return "apartment";
        }
        if (title?.match(/\bpozem(?:ek|ky)\b/i)) {
          return "land";
        }
        if (title?.match(/\b(d[uů]m|vila|chalupa|chata)\b/i)) {
          return "house";
        }
        return undefined;
    }
  }

  private composeLocation(
    district?: string,
    region?: string,
    fallback?: string,
  ): string {
    if (district && region && district !== region) {
      return `${district}, ${region}`;
    }

    if (district) {
      return district;
    }

    if (region) {
      return region;
    }

    return fallback || "";
  }

  private normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}
