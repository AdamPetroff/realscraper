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
  const expectedIdnesMonthArticleAge = (() => {
    const now = new Date();
    const daysInCurrentMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();

    return daysInCurrentMonth >= 31 ? "31" : "30";
  })();

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

  it("maps IDNES month freshness to the current month length", () => {
    const config: IdnesScraperConfig = {
      propertyKind: "land",
      city: "olomouc",
      landSubtype: "stavebni-pozemek",
      priceMax: 2_000_000,
      freshness: "month",
    };

    expect(buildIdnesUrl(config)).toContain(
      `s-qc%5BarticleAge%5D=${expectedIdnesMonthArticleAge}`
    );
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

  it("builds a Sreality house URL", () => {
    const config: SrealityScraperConfig = {
      offerType: "prodej",
      category: "domy",
      locationSlug: "olomoucky-kraj",
      age: "mesic",
      priceMin: 5_149_427,
      priceMax: 10_250_945,
      areaMin: 50,
    };

    expect(buildSrealityUrl(config)).toBe(
      "https://www.sreality.cz/hledani/prodej/domy/olomoucky-kraj?cena-od=5149427&cena-do=10250945&plocha-od=50&stari=mesic"
    );
  });

  it("builds an IDNES house URL", () => {
    const config: IdnesScraperConfig = {
      propertyKind: "house",
      city: "olomoucky-kraj",
      priceMin: 3_000_000,
      priceMax: 10_000_000,
      houseSubtype: "house|turn-key",
      roomCount: 3,
      areaMin: 36,
      ownership: "personal",
      condition:
        "new|project|under-construction|good-condition|maintained|after-reconstruction",
      material: "brick|wood|stone|skeleton|prefab|mixed",
      freshness: "month",
    };

    expect(buildIdnesUrl(config)).toBe(
      `https://reality.idnes.cz/s/prodej/domy/cena-nad-3000000-do-10000000/olomoucky-kraj/?s-qc%5BsubtypeHouse%5D=house%7Cturn-key&s-qc%5BroomCount%5D=3&s-rd=3&s-qc%5BusableAreaMin%5D=36&s-qc%5Bownership%5D=personal&s-qc%5Bcondition%5D=new%7Cproject%7Cunder-construction%7Cgood-condition%7Cmaintained%7Cafter-reconstruction&s-qc%5Bmaterial%5D=brick%7Cwood%7Cstone%7Cskeleton%7Cprefab%7Cmixed&s-qc%5BarticleAge%5D=${expectedIdnesMonthArticleAge}`
    );
  });

  it("builds a Bezrealitky house URL without apartment dispositions", () => {
    const config: BezrealitkyScraperConfig = {
      estateType: "DUM",
      offerType: "PRODEJ",
      location: "exact",
      osmValue: "Olomouc, Olomoucký kraj, Střední Morava, Česko",
      priceFrom: 0,
      priceTo: 10_000_000,
      regionOsmIds: "R441579",
      currency: "CZK",
    };

    expect(buildBezrealitkyUrl(config)).toBe(
      "https://www.bezrealitky.cz/vyhledat?estateType=DUM&location=exact&offerType=PRODEJ&osm_value=Olomouc%2C+Olomouck%C3%BD+kraj%2C+St%C5%99edn%C3%AD+Morava%2C+%C4%8Cesko&priceFrom=0&priceTo=10000000&regionOsmIds=R441579&currency=CZK"
    );
  });

  it("builds a Bazos house URL from propertyKind", () => {
    expect(
      buildBazosUrl({
        locationCode: "77900",
        radiusKm: 10,
        offerType: "prodam",
        propertyKind: "house",
        priceMin: 4_000_000,
        priceMax: 10_000_000,
      })
    ).toBe(
      "https://reality.bazos.cz/dum/?hledat=&rubriky=reality&hlokalita=77900&humkreis=10&cenaod=4000000&cenado=10000000&Submit=Hledat&order=&crp=&kitx=ano"
    );
  });
});
