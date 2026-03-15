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
});
