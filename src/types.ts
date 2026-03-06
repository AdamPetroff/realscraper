export type ScraperSource = "idnes" | "bezrealitky" | "sreality" | "bazos";

export interface Property {
  title: string;
  price: string;
  location: string;
  area?: string;
  pricePerSqm?: number;
  rooms: string;
  url: string;
  description?: string;
  images?: string[];
  isNew?: boolean;
  // Database identification fields
  source?: ScraperSource;
  sourceId?: string;
  priceNumeric?: number;
}

export interface PropertyWithPriceChange extends Property {
  // Price change information (only present when price has changed)
  previousPrice?: string;
  previousPriceNumeric?: number;
  priceChangePercent?: number;
  isPriceChange: boolean;
}

export interface ScrapeResult {
  label: string;
  properties: PropertyWithPriceChange[];
  newCount: number;
  priceChangeCount: number;
  skippedCount: number;
}
