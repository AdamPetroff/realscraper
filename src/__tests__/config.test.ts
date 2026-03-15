import { describe, expect, it } from "vitest";
import {
  buildIdnesUrl,
  buildBezrealitkyUrl,
  buildSrealityUrl,
  buildBazosUrl,
  type IdnesScraperConfig,
  type BezrealitkyScraperConfig,
  type SrealityScraperConfig,
} from "../config";

describe("config url builders", () => {
  it("builds a Sreality land search URL with extra filters", () => {
    const config: SrealityScraperConfig = {
      offerType: "prodej",
      category: "pozemky/stavebni-parcely",
      locationSlug: "olomoucky-kraj",
      extraParams: {
        "cena-od": 500,
        "cena-do": 2000,
        region: "Olomouc",
        "region-id": 1,
        "region-typ": "municipality",
        vzdalenost: 10,
        "za-m2": 1,
      },
    };

    expect(buildSrealityUrl(config)).toBe(
      "https://www.sreality.cz/hledani/prodej/pozemky/stavebni-parcely/olomoucky-kraj?cena-od=500&cena-do=2000&region=Olomouc&region-id=1&region-typ=municipality&vzdalenost=10&za-m2=1"
    );
  });

  it("builds a Bezrealitky land search URL without apartment dispositions", () => {
    const config: BezrealitkyScraperConfig = {
      estateType: "POZEMEK",
      offerType: "PRODEJ",
      location: "exact",
      osmValue: "Olomouc, Olomoucký kraj, Střední Morava, Česko",
      priceFrom: 0,
      priceTo: 2_000_000,
      regionOsmIds: "R441579",
      currency: "CZK",
      landType: "STAVEBNI",
    };

    expect(buildBezrealitkyUrl(config)).toBe(
      "https://www.bezrealitky.cz/vyhledat?estateType=POZEMEK&location=exact&offerType=PRODEJ&osm_value=Olomouc%2C+Olomouck%C3%BD+kraj%2C+St%C5%99edn%C3%AD+Morava%2C+%C4%8Cesko&priceFrom=0&priceTo=2000000&regionOsmIds=R441579&currency=CZK&landType=STAVEBNI"
    );
  });

  it("builds an IDNES land URL from freshness", () => {
    const config: IdnesScraperConfig = {
      propertyKind: "land",
      city: "olomouc",
      landSubtype: "stavebni-pozemek",
      priceMax: 2_000_000,
      ownership: "personal",
      roomCount: 4,
      freshness: "week",
    };

    expect(buildIdnesUrl(config)).toBe(
      "https://reality.idnes.cz/s/pozemky/stavebni-pozemek/cena-do-2000000/olomouc/?s-rd=4&s-qc%5Bownership%5D=personal&s-qc%5BarticleAge%5D=7"
    );
  });

  it("maps IDNES month freshness to articleAge=30", () => {
    const config: IdnesScraperConfig = {
      propertyKind: "land",
      city: "olomouc",
      landSubtype: "stavebni-pozemek",
      priceMax: 2_000_000,
      freshness: "month",
    };

    expect(buildIdnesUrl(config)).toContain("s-qc%5BarticleAge%5D=30");
  });

  it("builds a Bazos land URL from propertyKind", () => {
    expect(
      buildBazosUrl({
        locationCode: "77900",
        radiusKm: 10,
        offerType: "prodam",
        propertyKind: "land",
        priceMax: 2_000_000,
      })
    ).toBe(
      "https://reality.bazos.cz/prodam/pozemek/?hledat=&rubriky=reality&hlokalita=77900&humkreis=10&cenaod=&cenado=2000000&Submit=Hledat&order=&crp=&kitx=ano"
    );
  });
});
