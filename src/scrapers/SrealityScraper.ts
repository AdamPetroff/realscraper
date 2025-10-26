import * as cheerio from "cheerio";
import { Page } from "puppeteer";
import { Property } from "../types";
import { BaseScraper } from "./BaseScraper";
import { ScrapeOptions } from "./scraper.interface";

type SrealityScrapeOptions = ScrapeOptions & {
  newOnly?: boolean;
};

export class SrealityScraper extends BaseScraper {
  constructor(private readonly defaultOptions: SrealityScrapeOptions = {}) {
    super();
  }

  async scrapeProperties(
    url: string,
    options?: SrealityScrapeOptions
  ): Promise<Property[]> {
    if (!this.browser) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    const effectiveOptions: SrealityScrapeOptions = {
      ...this.defaultOptions,
      ...options,
    };

    const page = await this.getPage(url);

    try {
      await this.handleCookieConsent(page);
      await page
        .waitForSelector("li[id^='estate-list-item-']", { timeout: 15000 })
        .catch(() => {
          console.log(
            "SrealityScraper: Timeout waiting for estate list item selector"
          );
        });

      const html = await page.content();
      const $ = cheerio.load(html);

      const properties: Property[] = [];
      const newOnly = effectiveOptions.newOnly ?? false;

      const items = $("li[id^='estate-list-item-']");
      console.log(`SrealityScraper: Found ${items.length} properties`);

      items.each((_, element) => {
        const $item = $(element);

        const title = this.extractTitle($item);
        const price = this.extractPrice($item);
        const location = this.extractLocation($item);
        const area = this.extractArea($item);
        const rooms = this.extractRooms($item);
        const listingUrl = this.extractPropertyUrl($item);
        const description = this.extractDescription($item);
        const images = this.extractPropertyImages($item, $);
        const isNew = this.detectIsNew($item);

        if (!title || !price || !listingUrl) {
          return;
        }

        if (newOnly && !isNew) {
          return;
        }

        const property: Property = {
          title,
          price,
          location,
          area,
          rooms,
          url: listingUrl,
          description,
          isNew,
        };

        if (images.length > 0) {
          property.images = images;
        }

        properties.push(property);
      });

      return properties;
    } finally {
      // await page.close();
    }
  }

  private async handleCookieConsent(page: Page): Promise<void> {
    try {
      const consentButton = await page.$("aria/Souhlasím");

      if (!consentButton) {
        console.log("SrealityScraper: Cookie consent button not found.");
        return;
      }

      await consentButton?.click();

      console.log(
        "SrealityScraper: Clicked cookie consent button in shadow DOM."
      );
      await this.delay(2000); // Wait for content to reload
    } catch (error) {
      console.warn("SrealityScraper: Failed to handle cookie consent", error);
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractTitle($item: cheerio.Cheerio<any>): string {
    const inlineTitle = $item.find("a p").first().text().trim();
    if (inlineTitle) {
      return inlineTitle;
    }

    const selectors = [
      ".name",
      ".title",
      "h2",
      ".property__title",
      'span[class*="name"]',
      "p.css-d7upve",
    ];
    return this.extractText($item, selectors);
  }

  private extractPrice($item: cheerio.Cheerio<any>): string {
    const inlinePrice = $item.find("p.css-ca9wwd").first().text().trim();
    if (inlinePrice) {
      return inlinePrice.replace(/\s+/g, " ");
    }

    const selectors = [
      ".price",
      ".norm-price",
      'span[class*="price"]',
      ".property__price",
    ];
    const priceText = this.extractText($item, selectors);
    if (!priceText) {
      return "";
    }
    return priceText.replace(/\s+/g, " ").trim();
  }

  private extractLocation($item: cheerio.Cheerio<any>): string {
    const inlineLocation = $item.find("a p").eq(1).text().trim();
    if (inlineLocation) {
      return inlineLocation;
    }

    const selectors = [
      ".locality",
      ".location",
      'span[class*="locality"]',
      ".property__location",
    ];
    return this.extractText($item, selectors);
  }

  private extractArea($item: cheerio.Cheerio<any>): string | undefined {
    const sourceText =
      this.extractTitle($item) || $item.find("a p").text() || $item.text();
    const match = sourceText.match(/(\d+(?:[.,]\d+)?)\s*m²?/i);
    if (!match) {
      return undefined;
    }
    return `${match[1]} m²`;
  }

  private extractRooms($item: cheerio.Cheerio<any>): string {
    const title = this.extractTitle($item);
    const dispositionMatch = title.match(/\d+\s*\+(?:\s*kk|\s*\d)/i);
    if (dispositionMatch) {
      return dispositionMatch[0].replace(/\s+/g, "");
    }

    const selectors = [
      ".layout",
      ".disposition",
      'span[class*="layout"]',
      'span[class*="disposition"]',
    ];
    return this.extractText($item, selectors);
  }

  private extractDescription($item: cheerio.Cheerio<any>): string | undefined {
    const selectors = [
      ".description",
      ".perex",
      'span[class*="description"]',
      ".property__description",
    ];
    const desc = this.extractText($item, selectors);
    return desc || undefined;
  }

  private extractPropertyUrl($item: cheerio.Cheerio<any>): string {
    const link = $item.find("a").first().attr("href");
    if (!link) {
      return "";
    }

    if (link.startsWith("http")) {
      return link;
    }

    if (link.startsWith("/")) {
      return `https://www.sreality.cz${link}`;
    }

    return link;
  }

  private extractPropertyImages(
    $item: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI
  ): string[] {
    const images: string[] = [];

    $item.find("img").each((_, img) => {
      const src =
        $(img).attr("src") ||
        $(img).attr("data-src") ||
        $(img).attr("data-lazy-src");
      const normalized = this.normalizeImageUrl(src);
      if (normalized) {
        images.push(normalized);
      }
    });

    $item.find('[style*="background-image"]').each((_, element) => {
      const style = $(element).attr("style");
      if (!style) {
        return;
      }

      const match = style.match(/url\(['"]?(https?:\/\/[^'"\s)]+)/i);
      if (match) {
        images.push(match[1]);
      }
    });

    return Array.from(new Set(images));
  }

  private detectIsNew($item: cheerio.Cheerio<any>): boolean {
    const text = $item.text().toLowerCase();
    if (text.includes("nový") || text.includes("new")) {
      return true;
    }

    const labelText = $item
      .find("[data-testid='label-default'], [class*='label'], span")
      .toArray()
      .map((el) => cheerio.load(el).root().text().trim().toLowerCase());

    if (labelText.some((value) => value.includes("novink"))) {
      return true;
    }

    return $item.find('[class*="new"]').length > 0;
  }

  private normalizeImageUrl(src?: string): string | undefined {
    if (!src) {
      return undefined;
    }

    if (src.startsWith("http")) {
      return src;
    }

    if (src.startsWith("//")) {
      return `https:${src}`;
    }

    return undefined;
  }
}
