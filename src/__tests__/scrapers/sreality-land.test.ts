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

  it("filters parsed results by total price range when options are provided", () => {
    const scraper = new SrealityScraper();

    const properties = (scraper as any).parseResponse(
      {
        pageProps: {
          dehydratedState: {
            queries: [
              {
                state: {
                  data: {
                    results: [
                      {
                        id: 1,
                        name: "Prodej stavební parcely 1 000 m²",
                        locality: {
                          city: "Olomouc",
                          citySeoName: "olomouc",
                        },
                        priceCzk: 1_900_000,
                        categoryTypeCb: { name: "prodej" },
                        categoryMainCb: { name: "pozemky" },
                        categorySubCb: { name: "Stavební parcela" },
                      },
                      {
                        id: 2,
                        name: "Prodej stavební parcely 2 000 m²",
                        locality: {
                          city: "Olomouc",
                          citySeoName: "olomouc",
                        },
                        priceCzk: 2_400_000,
                        categoryTypeCb: { name: "prodej" },
                        categoryMainCb: { name: "pozemky" },
                        categorySubCb: { name: "Stavební parcela" },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
      { priceMax: 2_000_000 }
    );

    expect(properties).toHaveLength(1);
    expect(properties[0].sourceId).toBe("1");
  });
});
