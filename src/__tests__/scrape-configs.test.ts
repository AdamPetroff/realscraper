import { describe, expect, it } from "vitest";
import { SCRAPES, getScrapeById, buildUrlForScrape } from "../scrape-configs";

describe("shared scrape expansion", () => {
  it("builds the IDNES land scrape from typed config", () => {
    const scrape = getScrapeById("idnes-land-2m-czk-olomouc-10-km");

    expect(scrape).toBeDefined();
    expect(scrape?.type).toBe("idnes");
    expect(buildUrlForScrape(scrape!)).toBe(
      "https://reality.idnes.cz/s/pozemky/stavebni-pozemek/cena-do-2000000/olomouc/?s-rd=4&s-qc%5Bownership%5D=personal&s-qc%5BarticleAge%5D=7"
    );
  });

  it("still expands to include the IDNES land scrape", () => {
    expect(
      SCRAPES.some(
        (scrape) =>
          scrape.type === "idnes" &&
          scrape.label === "IDNES Land (<=2M CZK) Olomouc <=10 km"
      )
    ).toBe(true);
  });

  it("builds the IDNES house scrape from typed config", () => {
    const scrape = getScrapeById("idnes-house-5-10m-czk-olomouc-10-km");

    expect(scrape).toBeDefined();
    expect(scrape?.type).toBe("idnes");
    expect(buildUrlForScrape(scrape!)).toBe(
      "https://reality.idnes.cz/s/prodej/domy/cena-nad-5000000-do-10000000/olomoucky-kraj/?s-qc%5BsubtypeHouse%5D=house%7Cturn-key&s-qc%5BroomCount%5D=3&s-rd=3&s-qc%5BusableAreaMin%5D=36&s-qc%5Bownership%5D=personal&s-qc%5Bcondition%5D=new%7Cproject%7Cunder-construction%7Cgood-condition%7Cmaintained%7Cafter-reconstruction&s-qc%5Bmaterial%5D=brick%7Cwood%7Cstone%7Cskeleton%7Cprefab%7Cmixed&s-qc%5BarticleAge%5D=1"
    );
  });

  it("still expands to include the house scrapes", () => {
    expect(
      SCRAPES.some(
        (scrape) =>
          scrape.type === "sreality" &&
          scrape.label === "Sreality House (5-10M CZK) Olomouc <=10 km"
      )
    ).toBe(true);
    expect(
      SCRAPES.some(
        (scrape) =>
          scrape.type === "bezrealitky" &&
          scrape.label === "Bezrealitky House (5-10M CZK) Olomouc <=10 km"
      )
    ).toBe(true);
    expect(
      SCRAPES.some(
        (scrape) =>
          scrape.type === "bazos" &&
          scrape.label === "Bazos House (5-10M CZK) Olomouc <=10 km"
      )
    ).toBe(true);
    expect(
      SCRAPES.some(
        (scrape) =>
          scrape.type === "okdrazby" &&
          scrape.label === "OkDrazby House (5-10M CZK) Olomouc <=10 km"
      )
    ).toBe(true);
  });

  it("builds the OkDrazby apartment scrape from typed config", () => {
    const scrape = getScrapeById("okdrazby-3-6m-czk-brno");

    expect(scrape).toBeDefined();
    expect(scrape?.type).toBe("okdrazby");
    expect(buildUrlForScrape(scrape!)).toBe(
      "https://okdrazby.cz/drazby/nemovity/byty/2-plus-1/brno-mesto?subcategoryIds=59&locationIds=11"
    );
  });

  it("builds the OkDrazby building-land scrape across the requested regions", () => {
    const scrape = getScrapeById(
      "okdrazby-building-land-jihomoravsky-olomoucky-zlinsky-kraj",
    );

    expect(scrape).toBeDefined();
    expect(scrape?.type).toBe("okdrazby");
    expect(buildUrlForScrape(scrape!)).toBe(
      "https://okdrazby.cz/drazby/nemovity/pozemky/pozemky-k-bydleni/jihomoravsky-kraj?categoryIds=9%2C11&subcategoryIds=42%2C43%2C44%2C45%2C46%2C48%2C47%2C56%2C57%2C58%2C59%2C60%2C61%2C62%2C63%2C64%2C65%2C66%2C67%2C68&locationIds=12%2C14"
    );
  });

  it("builds the ExDrazby scrape across the requested regions", () => {
    const scrape = getScrapeById(
      "exdrazby-building-land-houses-flats-jihomoravsky-olomoucky-zlinsky-kraj",
    );

    expect(scrape).toBeDefined();
    expect(scrape?.type).toBe("exdrazby");
    expect(buildUrlForScrape(scrape!)).toBe(
      "https://exdrazby.cz/drazby-aukce/pripravene?page=1&perPage=100&title=&priceTo=&priceFrom=&mainCategory=1&auctionType=&subCategories=3&subCategories=4&subCategories=7&regions=11&regions=12&regions=13"
    );
  });
});
