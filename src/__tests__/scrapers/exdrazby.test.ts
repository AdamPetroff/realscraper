import { describe, expect, it } from "vitest";
import { ExDrazbyScraper } from "../../scrapers/ExDrazbyScraper";

describe("ExDrazbyScraper", () => {
  it("maps API auctions into Property objects", () => {
    const scraper = new ExDrazbyScraper();
    const properties = scraper.parsePropertiesFromApiResponse({
      data: [
        {
          id: 25771,
          title: "Dražba rodinného domu v Trmicích",
          minimalBid: 510000,
          auctionCategory: {
            id: 4,
            title: "Rodinný dům",
            parentTitle: "Nemovitosti",
          },
          auctionAddress: {
            city: "Trmice",
            district: {
              name: "Ústí nad Labem",
            },
            region: {
              name: "Ústecký kraj",
            },
          },
          auctionMedia: [
            {
              url: "https://exdrazby.cz/media/25771.jpg",
            },
          ],
        },
      ],
      total: 1,
    });

    expect(properties).toHaveLength(1);
    expect(properties[0]).toMatchObject({
      title: "Dražba rodinného domu v Trmicích",
      price: "510 000 Kč",
      location: "Trmice, Ústí nad Labem, Ústecký kraj",
      district: "Ústí nad Labem",
      region: "Ústecký kraj",
      rooms: "",
      url: "https://exdrazby.cz/drazba/25771",
      source: "exdrazby",
      sourceId: "25771",
      priceNumeric: 510000,
      propertyType: "house",
      images: ["https://exdrazby.cz/media/25771.jpg"],
    });
  });
});
