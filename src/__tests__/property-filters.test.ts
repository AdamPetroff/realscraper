import { describe, expect, it } from "vitest";
import {
  filterPropertiesByTitleBlacklist,
  isBlacklistedPropertyTitle,
} from "../property-filters";
import type { Property } from "../types";

function createProperty(title: string): Property {
  return {
    title,
    price: "3 500 000 Kč",
    location: "Praha",
    rooms: "2+kk",
    url: "https://example.com/property/1",
  };
}

describe("property title blacklist", () => {
  it("should mark titles containing blacklisted phrase as blacklisted", () => {
    expect(
      isBlacklistedPropertyTitle("Skvela nabidka: ZLATÁ a VIP clenstvi")
    ).toBe(true);
    expect(
      isBlacklistedPropertyTitle(
        "Správa sítí: Facebooku & Instagramu – kompletně, ihned"
      )
    ).toBe(true);
    expect(
      isBlacklistedPropertyTitle("Dražba podílu 1/2 na rodinném domě")
    ).toBe(true);
  });

  it("should filter out blacklisted titles and keep valid listings", () => {
    const properties: Property[] = [
      createProperty("Byt 2+kk Praha"),
      createProperty("Exkluzivne: ZLATÁ a VIP"),
      createProperty(
        "Správa sítí: Facebooku & Instagramu – kompletně pro vas"
      ),
      createProperty("Dražba podílu 1/4 na bytě v Brně"),
      createProperty("Byt 3+1 Brno"),
    ];

    const result = filterPropertiesByTitleBlacklist(properties);

    expect(result.filteredOutCount).toBe(3);
    expect(result.filteredProperties).toHaveLength(2);
    expect(result.filteredProperties.map((property) => property.title)).toEqual(
      ["Byt 2+kk Praha", "Byt 3+1 Brno"]
    );
  });
});
