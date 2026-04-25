import { describe, expect, it } from "vitest";
import { importStoredScrapeConfigFromSrealityUrl } from "../sreality-import";

describe("Sreality import", () => {
  it("imports a known apartment sale URL as an all-sites scrape", () => {
    const result = importStoredScrapeConfigFromSrealityUrl({
      name: "Imported Brno",
      url: "https://www.sreality.cz/hledani/prodej/byty/brno?velikost=2%2Bkk,2%2B1&vlastnictvi=osobni&cena-od=3000000&cena-do=6000000&plocha-od=45&stari=dnes",
    });

    expect(result.mode).toBe("all-sites");
    expect(result.draftConfig.scrapers).toEqual([
      "idnes",
      "bezrealitky",
      "sreality",
      "bazos",
      "okdrazby",
    ]);
    expect(result.draftConfig.search).toMatchObject({
      offerType: "sale",
      propertyKind: "apartment",
      priceMin: 3000000,
      priceMax: 6000000,
      areaMin: 45,
      roomLayouts: ["2+kk", "2+1"],
      ownership: "personal",
      freshness: "today",
      location: {
        label: "Brno",
        srealityLocationSlug: "brno",
      },
    });
  });

  it("imports an unknown location as a Sreality-only scrape", () => {
    const result = importStoredScrapeConfigFromSrealityUrl({
      name: "Imported Prague",
      url: "https://www.sreality.cz/hledani/prodej/byty/praha-7?cena-do=7000000",
    });

    expect(result.mode).toBe("sreality-only");
    expect(result.draftConfig.scrapers).toEqual(["sreality"]);
    expect(result.warnings).toContain(
      "Location is not mapped for the other websites, so this import will save as Sreality-only.",
    );
  });

  it("keeps Sreality-only filters as override warnings when needed", () => {
    const result = importStoredScrapeConfigFromSrealityUrl({
      name: "Imported Land",
      url: "https://www.sreality.cz/hledani/prodej/pozemky/stavebni-parcely/olomoucky-kraj?cena-od=500&cena-do=2000&za-m2=1&region=Olomouc&region-id=1&region-typ=municipality&vzdalenost=10",
    });

    expect(result.draftConfig.search).toMatchObject({
      propertyKind: "land",
      pricePerSqmMin: 500,
      pricePerSqmMax: 2000,
    });
    expect(result.draftConfig.overrides).toMatchObject({
      sreality: {
        extraParams: {
          region: "Olomouc",
          "region-id": 1,
          "region-typ": "municipality",
          vzdalenost: 10,
        },
      },
    });
    expect(result.warnings).toContain('Filter "region" is kept only for Sreality.');
  });

  it("imports generic pozemky URLs as land searches", () => {
    const result = importStoredScrapeConfigFromSrealityUrl({
      name: "Imported Zlin Land",
      url: "https://www.sreality.cz/hledani/prodej/pozemky/zlinsky-kraj?cena-do=2500000",
    });

    expect(result.draftConfig.search).toMatchObject({
      offerType: "sale",
      propertyKind: "land",
      priceMax: 2500000,
      location: {
        srealityLocationSlug: "zlinsky-kraj",
      },
    });
  });

  it("rejects non-sreality URLs", () => {
    expect(() =>
      importStoredScrapeConfigFromSrealityUrl({
        name: "Invalid",
        url: "https://example.com/hledani/prodej/byty/brno",
      }),
    ).toThrow("Only Sreality URLs can be imported");
  });
});
