import * as cheerio from "cheerio";
import { Property } from "../types";
import { ScrapeOptions } from "./scraper.interface";

export class IdnesScraper {
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
    _options?: ScrapeOptions
  ): Promise<Property[]> {
    console.log(`IdnesScraper: Fetching URL: ${url}`);

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(
          `IdnesScraper: Request failed with status ${response.status}`
        );
        throw new Error(`Request failed: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const properties: Property[] = [];

      const propertySelector = ".c-products__item";
      const items = $(propertySelector);

      if (items.length > 0) {
        console.log(
          `IdnesScraper: Found ${items.length} properties using selector: ${propertySelector}`
        );

        items.each((_, element) => {
          const $item = $(element);
          const propertyUrl = this.extractUrl($item, url);
          const priceText = this.extractText($item, [".c-products__price"]);
          const priceNumeric = this.parseNumericPrice(priceText);
          const areaText = this.extractText($item, [".c-products__info .floor-area"]);
          const areaValue =
            this.parseAreaValue(areaText) ||
            this.parseAreaValue(this.extractText($item, [".c-products__title"]));

          const property: Property = {
            title: this.extractText($item, [".c-products__title"]),
            price: priceText,
            location: this.extractText($item, [".c-products__info"]),
            area: this.formatAreaValue(areaValue),
            rooms: this.extractText($item, [".c-products__info .rooms"]),
            url: propertyUrl,
            description: this.extractText($item, [".c-products__description"]),
            images: this.extractImages($item, ["img"], $),
            // Database identification fields
            source: "idnes",
            sourceId: this.extractIdFromUrl(propertyUrl),
            priceNumeric,
            pricePerSqm: this.resolvePricePerSqm(priceNumeric, areaValue),
          };

          if (property.title && property.price) {
            properties.push(property);
          }
        });
      } else {
        console.log(
          `IdnesScraper: No properties found with selector: ${propertySelector}`
        );
      }

      return properties;
    } catch (error) {
      console.error("IdnesScraper: Error scraping properties:", error);
      throw error;
    }
  }

  /**
   * Extract property ID from Idnes URL.
   * Example: https://reality.idnes.cz/detail/prodej/byt/brno/695aab879a10a9efb00b440c/ → "695aab879a10a9efb00b440c"
   * Legacy:  https://reality.idnes.cz/detail/prodej/byt/brno/12345678/ → "12345678"
   */
  private extractIdFromUrl(url: string): string | undefined {
    if (!url) return undefined;

    // Pattern 1: /detail/{type}/{property_type}/{location}/{id}/
    // The ID can be alphanumeric (24-char hex like MongoDB ObjectId) or numeric
    const detailMatch = url.match(
      /\/detail\/[^/]+\/[^/]+\/[^/]+\/([a-f0-9]+)\/?(?:\?|$)/i
    );
    if (detailMatch) {
      return detailMatch[1];
    }

    // Pattern 2: Legacy numeric ID at end of URL
    const numericEndMatch = url.match(/\/(\d+)\/?(?:\?|$)/);
    if (numericEndMatch) {
      return numericEndMatch[1];
    }

    // Fallback: try to extract any long alphanumeric sequence from the URL
    const alphanumericMatch = url.match(/([a-f0-9]{24})/i);
    if (alphanumericMatch) {
      return alphanumericMatch[1];
    }

    // Last resort: try to extract any long numeric sequence
    const numericMatch = url.match(/(\d{6,})/);
    return numericMatch ? numericMatch[1] : undefined;
  }

  /**
   * Parse numeric price from formatted price string.
   * Example: "3 500 000 Kč" → 3500000
   */
  private parseNumericPrice(priceText: string): number | undefined {
    if (!priceText) return undefined;

    // Remove all non-digit characters except for decimal separators
    const cleaned = priceText.replace(/[^\d]/g, "");
    const num = parseInt(cleaned, 10);

    return isNaN(num) ? undefined : num;
  }

  private parseAreaValue(areaText?: string): number | undefined {
    if (!areaText) return undefined;
    const match = areaText.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i);
    if (!match) return undefined;
    const value = Number.parseFloat(match[1].replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return undefined;
    return value;
  }

  private formatAreaValue(area?: number): string | undefined {
    if (typeof area !== "number" || area <= 0) return undefined;
    return Number.isInteger(area)
      ? area.toString()
      : area.toFixed(1).replace(/\.0$/, "");
  }

  private resolvePricePerSqm(
    price?: number,
    area?: number
  ): number | undefined {
    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price <= 0 ||
      typeof area !== "number" ||
      !Number.isFinite(area) ||
      area <= 0
    ) {
      return undefined;
    }
    return Math.round(price / area);
  }

  private extractText(
    $item: cheerio.Cheerio<any>,
    selectors: string[]
  ): string {
    for (const selector of selectors) {
      const text = $item.find(selector).first().text().trim();
      if (text) {
        return text;
      }
    }
    return "";
  }

  private extractUrl($item: cheerio.Cheerio<any>, baseUrl: string): string {
    const link = $item.find("a").first().attr("href");
    if (!link) return "";

    if (link.startsWith("http")) {
      return link;
    } else if (link.startsWith("/")) {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${link}`;
    }
    return link;
  }

  private extractImages(
    $item: cheerio.Cheerio<any>,
    selectors: string[],
    $: cheerio.CheerioAPI
  ): string[] {
    const images: string[] = [];
    for (const selector of selectors) {
      $item.find(selector).each((_, element) => {
        const src = $(element).attr("data-src");
        if (src && src.startsWith("http")) {
          images.push(src);
        }
      });
    }
    return images;
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}
