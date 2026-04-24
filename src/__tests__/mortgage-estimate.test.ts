import { describe, expect, it } from "vitest";
import { DEFAULT_MORTGAGE_ESTIMATE_CONFIG } from "../config";
import {
  calculateMonthlyMortgagePayment,
  canEstimateMortgage,
  formatMonthlyMortgageEstimate,
} from "../mortgage-estimate";
import { TelegramService } from "../telegram-service";
import type { Property } from "../types";

function createProperty(overrides: Partial<Property> = {}): Property {
  return {
    title: "Byt 2+kk",
    price: "5 000 000 Kč",
    location: "Olomouc",
    rooms: "2+kk",
    url: "https://example.com/property",
    source: "sreality",
    sourceId: "listing-1",
    priceNumeric: 5_000_000,
    propertyType: "apartment",
    ...overrides,
  };
}

describe("mortgage estimate helpers", () => {
  it("calculates the default monthly payment", () => {
    expect(
      Math.round(
        calculateMonthlyMortgagePayment(
          5_000_000,
          DEFAULT_MORTGAGE_ESTIMATE_CONFIG
        ) ?? 0
      )
    ).toBe(23339);
  });

  it("formats the monthly payment in CZK", () => {
    expect(formatMonthlyMortgageEstimate(createProperty())).toBe(
      "23\u00a0339 Kč/měs."
    );
  });

  it("rejects invalid prices and auction sources", () => {
    expect(canEstimateMortgage(createProperty({ priceNumeric: undefined }))).toBe(
      false
    );
    expect(canEstimateMortgage(createProperty({ priceNumeric: 0 }))).toBe(false);
    expect(
      canEstimateMortgage(createProperty({ source: "okdrazby" }))
    ).toBe(false);
    expect(
      canEstimateMortgage(createProperty({ source: "exdrazby" }))
    ).toBe(false);
  });

  it("returns undefined for invalid mortgage config", () => {
    expect(
      calculateMonthlyMortgagePayment(5_000_000, {
        ...DEFAULT_MORTGAGE_ESTIMATE_CONFIG,
        financedShare: 1.1,
      })
    ).toBeUndefined();
  });
});

describe("TelegramService mortgage caption formatting", () => {
  it("includes the mortgage estimate for standard sale listings", () => {
    const service = new TelegramService("token", "chat-id");
    const caption = service["formatPropertyCaption"](createProperty(), 0);

    expect(caption).toContain("🏦 23\u00a0339 Kč/měs.");
  });

  it("omits the mortgage estimate for auction listings", () => {
    const service = new TelegramService("token", "chat-id");
    const caption = service["formatPropertyCaption"](
      createProperty({ source: "okdrazby" }),
      0
    );

    expect(caption).not.toContain("🏦");
  });

  it("omits the mortgage estimate when only formatted price text exists", () => {
    const service = new TelegramService("token", "chat-id");
    const caption = service["formatPropertyCaption"](
      createProperty({ priceNumeric: undefined }),
      0
    );

    expect(caption).not.toContain("🏦");
  });
});
