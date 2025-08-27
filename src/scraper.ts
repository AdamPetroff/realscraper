import puppeteer, { Browser, Page } from "puppeteer";
import * as cheerio from "cheerio";
import { Property } from "./types";

export class RealityScraper {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true, // Set to false for debugging, change to true for production
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=VizDisplayCompositor",
      ],
    });
  }

  async scrapeProperties(url: string): Promise<Property[]> {
    if (!this.browser) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    const page: Page = await this.browser.newPage();

    try {
      // Set a realistic user agent
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      await page.setViewport({ width: 1920, height: 1080 });

      // Remove automation indicators
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined,
        });
      });

      console.log(`Navigating to: ${url}`);

      // Try to navigate with multiple fallback strategies
      try {
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
      } catch (error) {
        console.log(
          "First navigation attempt failed, trying with networkidle0..."
        );
        await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: 60000,
        });
      }

      // Wait for content to load
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const html = await page.content();
      const $ = cheerio.load(html);

      const properties: Property[] = [];

      // Common selectors for Czech real estate sites
      const propertySelectors = [
        ".c-products__item", // Common pattern
        ".product-item",
        ".listing-item",
        ".property-item",
        '[data-testid="property-item"]',
        ".offer-item",
        ".ad-item",
      ];

      let foundProperties = false;

      for (const selector of propertySelectors) {
        const items = $(selector);
        if (items.length > 0) {
          console.log(
            `Found ${items.length} properties using selector: ${selector}`
          );
          foundProperties = true;

          // Debug: log structure of first item
          if (items.length > 0) {
            const firstItem = $(items[0]);
            console.log("\nDEBUG: Structure of first property item:");
            console.log("Classes:", firstItem.attr("class"));
            console.log(
              "HTML snippet:",
              firstItem.html()?.substring(0, 500) + "..."
            );
          }

          items.each((_, element) => {
            const $item = $(element);

            const property: Property = {
              title: this.extractText($item, [
                ".c-products__title",
                ".c-products__title a",
                ".product-title",
                ".listing-title",
                ".property-title",
                "h2",
                "h3",
                ".title",
              ]),
              price: this.extractText($item, [
                ".c-products__price",
                ".c-products__price .price",
                ".price",
                ".product-price",
                ".listing-price",
                ".property-price",
              ]),
              location: this.extractText($item, [
                ".c-products__info",
                ".c-products__locality",
                ".locality",
                ".product-location",
                ".location",
                ".address",
              ]),
              area: this.extractText($item, [
                ".c-products__info .floor-area",
                ".c-products__area",
                ".floor-area",
                ".area",
                ".size",
              ]),
              rooms: this.extractText($item, [
                ".c-products__info .rooms",
                ".c-products__rooms",
                ".rooms",
                ".room-count",
              ]),
              url: this.extractUrl($item, url),
              description: this.extractText($item, [
                ".c-products__desc",
                ".c-products__description",
                ".description",
                ".product-description",
              ]),
            };

            if (!property.area) {
              // if area not found use the last part of location ("{street}, {area}")
              property.area = property.location.split(",").pop()?.trim();
            }

            if (property.title === "prodej" || property.price) {
              properties.push(property);
            }
          });
          break; // Stop after finding properties with first working selector
        }
      }

      if (!foundProperties) {
        console.log(
          "No properties found with known selectors. Attempting to find any listing-like elements..."
        );

        // Fallback: look for any elements that might contain property data
        const fallbackElements = $(
          '[class*="item"], [class*="product"], [class*="listing"], [class*="offer"], [class*="ad"]'
        );

        console.log(
          `Found ${fallbackElements.length} potential property elements`
        );

        if (fallbackElements.length > 0) {
          // Log the first few elements for debugging
          fallbackElements.slice(0, 3).each((index, element) => {
            console.log(`Element ${index}:`, $(element).attr("class"));
            console.log("Text content:", $(element).text().substring(0, 200));
          });
        }
      }

      return properties;
    } catch (error) {
      console.error("Error scraping properties:", error);
      throw error;
    } finally {
      await page.close();
    }
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

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
