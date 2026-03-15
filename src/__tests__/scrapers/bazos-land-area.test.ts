import { describe, expect, it } from "vitest";
import { BazosScraper } from "../../scrapers/BazosScraper";

describe("BazosScraper land area parsing", () => {
  it("parses thousand-grouped area values used by land listings", () => {
    const scraper = new BazosScraper();

    expect((scraper as any).extractAreaValue("Prodej podílu 1/6 pole 1 273 m²")).toBe(
      1273
    );
    expect((scraper as any).extractAreaValue("Prodej lesy, 6 823 m2 - Bělkovice-Lašťany")).toBe(
      6823
    );
    expect((scraper as any).extractAreaValue("Prodej pozemku o výměře 1.888 m2 v Olomouci")).toBe(
      1888
    );
  });
});
