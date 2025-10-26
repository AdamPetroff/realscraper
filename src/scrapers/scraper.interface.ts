import { Property } from "../types";

export interface ScrapeOptions {
  newOnly?: boolean;
}

export interface IScraper {
  scrapeProperties(url: string, options?: ScrapeOptions): Promise<Property[]>;
}
