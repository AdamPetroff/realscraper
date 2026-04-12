import { describe, expect, it } from "vitest";
import {
  buildIdnesUrl,
  buildBezrealitkyUrl,
  buildSrealityUrl,
  buildBazosUrl,
  buildOkDrazbyUrl,
  buildExDrazbyUrl,
  type IdnesScraperConfig,
  type BezrealitkyScraperConfig,
  type SrealityScraperConfig,
  type OkDrazbyScraperConfig,
  type ExDrazbyScraperConfig,
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

  it("builds an OkDrazby apartment URL with path slugs and remaining ids", () => {
    const config: OkDrazbyScraperConfig = {
      propertyKind: "apartment",
      countyIds: [24],
      regionIds: [11, 1],
      roomLayouts: ["2+1", "2+kk", "3+1"],
      extraCategoryIds: [9, 10],
    };

    expect(buildOkDrazbyUrl(config)).toBe(
      "https://okdrazby.cz/drazby/nemovity/byty/2-plus-1/brno-mesto?categoryIds=9%2C10&subcategoryIds=59%2C60&locationIds=11%2C1"
    );
  });

  it("builds an OkDrazby house URL with all house subtypes by default", () => {
    const config: OkDrazbyScraperConfig = {
      propertyKind: "house",
      regionIds: [12],
    };

    expect(buildOkDrazbyUrl(config)).toBe(
      "https://okdrazby.cz/drazby/nemovity/domy/chalupa/olomoucky-kraj?subcategoryIds=43%2C44%2C45%2C46%2C48%2C47"
    );
  });

  it("builds an OkDrazby land URL with all land subtypes by default", () => {
    const config: OkDrazbyScraperConfig = {
      propertyKind: "land",
      regionIds: [12],
    };

    expect(buildOkDrazbyUrl(config)).toBe(
      "https://okdrazby.cz/drazby/nemovity/pozemky/lesy/olomoucky-kraj?subcategoryIds=50%2C51%2C52%2C55%2C53%2C85%2C86"
    );
  });

  it("builds an OkDrazby land URL for a specific subtype across regions", () => {
    const config: OkDrazbyScraperConfig = {
      propertyKind: "land",
      regionIds: [11, 12, 14],
      subcategoryIds: [53],
    };

    expect(buildOkDrazbyUrl(config)).toBe(
      "https://okdrazby.cz/drazby/nemovity/pozemky/pozemky-k-bydleni/jihomoravsky-kraj?locationIds=12%2C14"
    );
  });

  it("builds an ExDrazby URL with repeated category and region filters", () => {
    const config: ExDrazbyScraperConfig = {
      status: "prepared",
      mainCategoryId: 1,
      subcategoryIds: [3, 4, 7],
      regionIds: [11, 12, 13],
      perPage: 100,
    };

    expect(buildExDrazbyUrl(config)).toBe(
      "https://exdrazby.cz/drazby-aukce/pripravene?page=1&perPage=100&title=&priceTo=&priceFrom=&mainCategory=1&auctionType=&subCategories=3&subCategories=4&subCategories=7&regions=11&regions=12&regions=13"
    );
  });
});
