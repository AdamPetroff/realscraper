import { describe, expect, it } from "vitest";
import { SrealityScraper } from "../../scrapers/SrealityScraper";

describe("SrealityScraper land support", () => {
  it("does not populate rooms from land subtype labels", () => {
    const scraper = new SrealityScraper();

    const property = (scraper as any).transformEstate({
      id: 123,
      name: "Prodej stavební parcely 1 024 m²",
      locality: {
        city: "Olomouc",
        citySeoName: "olomouc",
        region: "Olomoucký kraj",
      },
      priceCzk: 1_536_000,
      priceCzkPerSqM: 1500,
      surface: 1024,
      categoryTypeCb: { name: "prodej" },
      categoryMainCb: { name: "pozemky" },
      categorySubCb: { name: "Stavební parcela" },
    });

    expect(property).toMatchObject({
      title: "Prodej stavební parcely 1 024 m²",
      location: "Olomouc",
      area: "1024",
      rooms: "",
      pricePerSqm: 1500,
      source: "sreality",
      sourceId: "123",
    });
    expect(property.price).toMatch(/1\s*536\s*000 Kč/u);
    expect(property.url).toContain("/detail/prodej/pozemek/stavebni-parcela/");
  });

  it("builds canonical house detail URLs with ASCII singular slugs", () => {
    const scraper = new SrealityScraper();

    const property = (scraper as any).transformEstate({
      id: 4011086668,
      name: "Prodej rodinného domu",
      locality: {
        city: "Džbél",
        citySeoName: "dzbel",
        cityPart: "Džbél",
        cityPartSeoName: "dzbel-",
      },
      priceCzk: 4_500_000,
      categoryTypeCb: { name: "prodej" },
      categoryMainCb: { name: "domy" },
      categorySubCb: { name: "Rodinný" },
    });

    expect(property?.url).toBe(
      "https://www.sreality.cz/detail/prodej/dum/rodinny/dzbel-dzbel-/4011086668"
    );
  });
});
