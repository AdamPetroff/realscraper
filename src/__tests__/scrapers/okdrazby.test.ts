import { describe, expect, it } from "vitest";
import { OkDrazbyScraper } from "../../scrapers/OkDrazbyScraper";

describe("OkDrazbyScraper", () => {
  it("parses rendered auction cards and embedded auction metadata", () => {
    const scraper = new OkDrazbyScraper();
    const html = `
      <html>
        <body>
          <div class="AuctionsList_auctionContentContainer__uUj_A">
            <div class="AuctionsList_gridImageContainer__fuXA3">
              <a class="AuctionsList_gridImage__4xJDC" href="/drazba/12345-byt-2-plus-1-brno">
                <img src="https://cdn.example.test/auction-12345.jpg" />
              </a>
            </div>
            <a class="AuctionsList_auctionName__SCepP" href="/drazba/12345-byt-2-plus-1-brno">
              Byt 2+1 Brno, 64 m2
            </a>
            <div>Brno-město</div>
            <div class="AuctionsList_auctionPriceContainer__f5UQ4">
              <div class="AuctionsList_auctionPrice__TwYNr">4 250 000 Kč</div>
            </div>
          </div>
          <script>
            self.__next_f.push([1,"{\\"auction\\":{\\"id\\":12345,\\"name\\":\\"Byt 2+1 Brno, 64 m2\\",\\"shortDesc\\":\\"<p>Zrekonstruovaný <strong>byt</strong></p>\\",\\"lowestSubmission\\":4250000,\\"categoryCode\\":\\"apartments\\",\\"county\\":\\"Brno-město\\",\\"region\\":\\"Jihomoravský kraj\\"}}"]);
          </script>
        </body>
      </html>
    `;

    const properties = scraper.parsePropertiesFromHtml(
      html,
      "https://okdrazby.cz/drazby/nemovity/byty/2-plus-1/brno-mesto",
    );

    expect(properties).toHaveLength(1);
    expect(properties[0]).toMatchObject({
      title: "Byt 2+1 Brno, 64 m2",
      price: "4 250 000 Kč",
      location: "Brno-město, Jihomoravský kraj",
      district: "Brno-město",
      region: "Jihomoravský kraj",
      area: "64",
      priceNumeric: 4250000,
      pricePerSqm: 66406,
      rooms: "2+1",
      url: "https://okdrazby.cz/drazba/12345-byt-2-plus-1-brno",
      description: "Zrekonstruovaný byt",
      source: "okdrazby",
      sourceId: "12345",
      propertyType: "apartment",
    });
    expect(properties[0].images).toEqual(["https://cdn.example.test/auction-12345.jpg"]);
  });
});
