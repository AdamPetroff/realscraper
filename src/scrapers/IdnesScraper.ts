import * as cheerio from "cheerio";
import { Property } from "../types";
import { BaseScraper } from "./BaseScraper";
import { ScrapeOptions } from "./scraper.interface";

export class IdnesScraper extends BaseScraper {
  async scrapeProperties(
    url: string,
    _options?: ScrapeOptions
  ): Promise<Property[]> {
    if (!this.browser) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    const page = await this.getPage(url);

    try {
      const html = await page.content();
      const $ = cheerio.load(html);

      const properties: Property[] = [];

      const propertySelector = ".c-products__item";
      const items = $(propertySelector);

      if (items.length > 0) {
        console.log(
          `Found ${items.length} properties using selector: ${propertySelector}`
        );

        items.each((_, element) => {
          const $item = $(element);

          const property: Property = {
            title: this.extractText($item, [".c-products__title"]),
            price: this.extractText($item, [".c-products__price"]),
            location: this.extractText($item, [".c-products__info"]),
            area: this.extractText($item, [".c-products__info .floor-area"]),
            rooms: this.extractText($item, [".c-products__info .rooms"]),
            url: this.extractUrl($item, url),
            description: this.extractText($item, [".c-products__description"]),
            images: this.extractImages($item, ["img"], $),
          };

          if (!property.area) {
            // if area not found use the last part of location ("{street}, {area}")
            property.area = property.location.split(",").pop()?.trim();
          }

          if (property.title && property.price) {
            properties.push(property);
          }
        });
      } else {
        console.log(`No properties found with selector: ${propertySelector}`);
      }

      return properties;
    } catch (error) {
      console.error("Error scraping properties:", error);
      throw error;
    } finally {
      await page.close();
    }
  }
}
