import * as cheerio from "cheerio";
import type { Property } from "../types";
import type { ScrapeOptions } from "./scraper.interface";
import { extractLocationMetadata } from "./location-metadata";

export class BazosScraper {
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
      "Accept-Language": "cs,en-US;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
    };
  }

  /**
   * Check if a date string (format: "[DD.MM. YYYY]") is from today.
   * The scraper runs at 23:50 to catch all listings from the current day.
   */
  private isFromToday(dateStr: string): boolean {
    // Extract date from format like "[11.12. 2025]" or "- [11.12. 2025]"
    const match = dateStr.match(/\[(\d{1,2})\.(\d{1,2})\.\s*(\d{4})\]/);
    if (!match) {
      return false;
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // JavaScript months are 0-indexed
    const year = parseInt(match[3], 10);

    const listingDate = new Date(year, month, day);
    listingDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if the listing date is today
    return listingDate.getTime() === today.getTime();
  }

  async scrapeProperties(
    url: string,
    options?: ScrapeOptions
  ): Promise<Property[]> {
    const effectiveOptions: ScrapeOptions = {
      ...this.defaultOptions,
      ...options,
    };

    console.log(`BazosScraper: Fetching URL: ${url}`);

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.error(
          `BazosScraper: Request failed with status ${response.status}`
        );
        throw new Error(`Request failed: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const properties: Property[] = [];

      // Each listing is in a div that contains the listing info
      // Based on the HTML structure, listings appear in a table-like structure
      $("div.inzeraty").each((_, element) => {
        const $item = $(element);
        const property = this.parseListingItem($item, $);
        
        if (property) {
          properties.push(property);
        }
      });

      // Filter by date if newOnly is enabled (default behavior for this scraper)
      const filteredProperties = effectiveOptions.newOnly === false
        ? properties
        : properties.filter((p) => p.isNew);

      console.log(
        `BazosScraper: Found ${properties.length} total listings, ${filteredProperties.length} from today`
      );
      return filteredProperties;
    } catch (error) {
      console.error("BazosScraper: Error fetching properties:", error);
      throw error;
    }
  }

  private parseListingItem(
    $item: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): Property | null {
    try {
      // Find the title link - it's in h2.nadpis a
      const $titleLink = $item.find("h2.nadpis a").first();
      const title = $titleLink.text().trim();
      const relativeUrl = $titleLink.attr("href");

      if (!title || !relativeUrl) {
        return null;
      }

      // Build full URL
      const propertyUrl = relativeUrl.startsWith("http")
        ? relativeUrl
        : `https://reality.bazos.cz${relativeUrl}`;

      // Find the price - it's in div.inzeratycena
      const priceText = $item.find("div.inzeratycena").text().trim();
      const price = this.formatPrice(priceText);
      const priceNumeric = this.parseNumericPrice(priceText);

      // The date is shown in span.velikost10 element
      // It appears as text like "- [11.12. 2025]" or "- TOP - [11.12. 2025]"
      const dateSpan = $item.find("span.velikost10").text();
      const dateMatch = dateSpan.match(/\[(\d{1,2}\.\d{1,2}\.\s*\d{4})\]/);
      const dateStr = dateMatch ? dateMatch[0] : "";
      
      // Check if listing is from today
      const isNew = this.isFromToday(dateStr);

      // Find description text - it's in div.popis
      const descriptionEl = $item.find("div.popis");
      const description = descriptionEl.text().trim();

      // Extract location from div.inzeratylok
      // The HTML has city and postal code separated by <br>, convert to readable format
      const locationEl = $item.find("div.inzeratylok");
      // Replace br with separator and clean up
      const locationHtml = locationEl.html() || "";
      const location = locationHtml
        .replace(/<br\s*\/?>/gi, ", ")
        .replace(/<[^>]+>/g, "")
        .trim();
      const { district, region } = extractLocationMetadata(
        location,
        title,
        description
      );

      // Extract image
      const $img = $item.find("img.obrazek").first();
      const imgSrc = $img.attr("src");
      const images: string[] = [];
      
      if (imgSrc && !imgSrc.includes("empty.gif")) {
        // Convert thumbnail to larger image if possible
        const fullImageUrl = imgSrc.startsWith("//")
          ? `https:${imgSrc}`
          : imgSrc.startsWith("http")
          ? imgSrc
          : `https://reality.bazos.cz${imgSrc}`;
        images.push(fullImageUrl);
      }

      // Try to extract area from title or description
      const areaValue = this.extractAreaValue(title) || this.extractAreaValue(description);
      const area = this.formatArea(areaValue);

      // Try to extract rooms from title
      const rooms = this.extractRooms(title);

      const property: Property = {
        title,
        price,
        location,
        district,
        region,
        area,
        rooms,
        url: propertyUrl,
        description: description.length > 200 
          ? description.substring(0, 200) + "..." 
          : description,
        isNew,
        // Database identification fields
        source: "bazos",
        sourceId: this.extractIdFromUrl(propertyUrl),
        priceNumeric,
        pricePerSqm: this.resolvePricePerSqm(priceNumeric, areaValue),
      };

      if (images.length > 0) {
        property.images = images;
      }

      return property;
    } catch (error) {
      console.error("BazosScraper: Error parsing listing item:", error);
      return null;
    }
  }

  /**
   * Extract property ID from Bazos URL.
   * Example: https://reality.bazos.cz/inzerat/12345678/... → "12345678"
   */
  private extractIdFromUrl(url: string): string | undefined {
    if (!url) return undefined;

    // Pattern: /inzerat/{id}/... 
    const match = url.match(/\/inzerat\/(\d+)\//);
    if (match) {
      return match[1];
    }

    // Fallback: try to extract any long numeric sequence from the URL
    const numericMatch = url.match(/(\d{6,})/);
    return numericMatch ? numericMatch[1] : undefined;
  }

  /**
   * Parse numeric price from formatted price string.
   * Example: "3 500 000 Kč" → 3500000
   */
  private parseNumericPrice(priceText: string): number | undefined {
    if (!priceText) return undefined;

    // Handle special cases
    if (priceText.toLowerCase() === "zdarma") return 0;
    if (priceText.toLowerCase().includes("vyžádání")) return undefined;

    // Remove all non-digit characters
    const cleaned = priceText.replace(/[^\d]/g, "");
    const num = parseInt(cleaned, 10);

    return isNaN(num) ? undefined : num;
  }

  private formatPrice(priceText: string): string {
    // Clean up price text - remove extra whitespace and format
    const cleaned = priceText.replace(/\s+/g, " ").trim();
    
    // If it's "Zdarma" or similar, return as-is
    if (cleaned.toLowerCase() === "zdarma" || !cleaned) {
      return cleaned || "Na vyžádání";
    }

    // Extract numeric value and format
    const match = cleaned.match(/([\d\s]+)\s*(Kč|CZK)?/i);
    if (match) {
      const numStr = match[1].replace(/\s/g, "");
      const num = parseInt(numStr, 10);
      if (!isNaN(num)) {
        const formatter = new Intl.NumberFormat("cs-CZ");
        return `${formatter.format(num)} Kč`;
      }
    }

    return cleaned;
  }

  private extractAreaValue(text: string): number | undefined {
    // Look for patterns like "60m2", "60 m²", "60m²", "60 m2"
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i);
    if (!match) return undefined;
    const area = Number.parseFloat(match[1].replace(",", "."));
    if (!Number.isFinite(area) || area <= 0) return undefined;
    return area;
  }

  private formatArea(area?: number): string | undefined {
    if (typeof area !== "number" || area <= 0) return undefined;
    return Number.isInteger(area)
      ? area.toString()
      : area.toFixed(1).replace(/\.0$/, "");
  }

  private resolvePricePerSqm(
    priceNumeric?: number,
    area?: number
  ): number | undefined {
    if (
      typeof priceNumeric !== "number" ||
      !Number.isFinite(priceNumeric) ||
      priceNumeric <= 0 ||
      typeof area !== "number" ||
      !Number.isFinite(area) ||
      area <= 0
    ) {
      return undefined;
    }

    return Math.round(priceNumeric / area);
  }

  private extractRooms(text: string): string {
    // Look for patterns like "2+1", "2+kk", "1+1", "3+kk"
    const match = text.match(/(\d+)\s*\+\s*(kk|\d+)/i);
    return match ? `${match[1]}+${match[2].toLowerCase()}` : "";
  }

  async close(): Promise<void> {
    // No resources to clean up
  }
}
