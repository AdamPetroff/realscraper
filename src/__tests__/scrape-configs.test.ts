import { describe, expect, it } from "vitest";
import { SCRAPES, getScrapeById, buildUrlForScrape } from "../scrape-configs";

describe("shared scrape expansion", () => {
  const expectedIdnesMonthArticleAge = (() => {
    const now = new Date();
    const daysInCurrentMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();

    return daysInCurrentMonth >= 31 ? "31" : "30";
  })();

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
      `https://reality.idnes.cz/s/prodej/domy/cena-nad-5000000-do-10000000/olomoucky-kraj/?s-qc%5BsubtypeHouse%5D=house%7Cturn-key&s-qc%5BroomCount%5D=3&s-rd=3&s-qc%5BusableAreaMin%5D=36&s-qc%5Bownership%5D=personal&s-qc%5Bcondition%5D=new%7Cproject%7Cunder-construction%7Cgood-condition%7Cmaintained%7Cafter-reconstruction&s-qc%5Bmaterial%5D=brick%7Cwood%7Cstone%7Cskeleton%7Cprefab%7Cmixed&s-qc%5BarticleAge%5D=${expectedIdnesMonthArticleAge}`
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
  });
});
