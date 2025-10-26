import { Property } from "../types";

export interface IScraper {
  scrapeProperties(url: string): Promise<Property[]>;
}
