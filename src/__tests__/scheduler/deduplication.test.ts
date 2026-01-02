import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Property, PropertyWithPriceChange, ScrapeResult } from "../../types";

/**
 * Tests for the deduplication and price change detection logic.
 * These tests mock the database layer to test the business logic in isolation.
 */

// Mock the database module
vi.mock("../../db/supabase", () => ({
  isSupabaseAvailable: vi.fn(),
  getSupabase: vi.fn(),
  initializeSupabase: vi.fn(),
  closeSupabase: vi.fn(),
}));

// Import after mocking
import * as supabaseModule from "../../db/supabase";
import { processProperty, processProperties } from "../../db/property-repository";

// Helper to create test properties
function createProperty(overrides: Partial<Property> = {}): Property {
  return {
    title: "Test Property",
    price: "3 500 000 Kč",
    location: "Praha",
    rooms: "3+kk",
    url: "https://example.com/property/1",
    source: "idnes",
    sourceId: "12345678",
    priceNumeric: 3500000,
    ...overrides,
  };
}

// Create a properly chainable mock for Supabase
function createMockSupabase() {
  const mockChain: any = {
    data: null,
    error: null,
  };

  const chainMethods = {
    from: vi.fn(() => chainMethods),
    select: vi.fn(() => chainMethods),
    insert: vi.fn(() => chainMethods),
    update: vi.fn(() => chainMethods),
    upsert: vi.fn(() => chainMethods),
    eq: vi.fn(() => chainMethods),
    like: vi.fn(() => chainMethods),
    limit: vi.fn(() => chainMethods),
    single: vi.fn(() => Promise.resolve({ data: mockChain.data, error: mockChain.error })),
  };

  return {
    ...chainMethods,
    _setResult: (data: any, error: any = null) => {
      mockChain.data = data;
      mockChain.error = error;
    },
    _reset: () => {
      mockChain.data = null;
      mockChain.error = null;
    },
  };
}

describe("Deduplication Logic", () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    vi.mocked(supabaseModule.isSupabaseAvailable).mockReturnValue(true);
    vi.mocked(supabaseModule.getSupabase).mockReturnValue(mockSupabase as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processProperty - New Property", () => {
    it("should return property as new when not found in database", async () => {
      // First call: property not found
      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })
        // Second call: upsert success
        .mockResolvedValueOnce({ data: { id: "uuid-123" }, error: null });

      const property = createProperty();
      const result = await processProperty(property);

      expect(result).toBeTruthy();
      expect(result?.isPriceChange).toBe(false);
      expect(result?.title).toBe(property.title);
    });

    it("should return property as new when DB is unavailable", async () => {
      vi.mocked(supabaseModule.isSupabaseAvailable).mockReturnValue(false);

      const property = createProperty();
      const result = await processProperty(property);

      expect(result).toBeTruthy();
      expect(result?.isPriceChange).toBe(false);
    });

    it("should return property as new when source/sourceId missing", async () => {
      const property = createProperty({ source: undefined, sourceId: undefined });
      const result = await processProperty(property);

      expect(result).toBeTruthy();
      expect(result?.isPriceChange).toBe(false);
    });
  });

  describe("processProperty - Existing Property (No Change)", () => {
    it("should return null when property exists with same price", async () => {
      const existingProperty = {
        id: "uuid-123",
        source: "idnes",
        source_id: "12345678",
        price_numeric: 3500000,
        price_formatted: "3 500 000 Kč",
      };

      // Mock: property found
      mockSupabase.single.mockResolvedValueOnce({
        data: existingProperty,
        error: null,
      });

      const property = createProperty({ priceNumeric: 3500000 });
      const result = await processProperty(property);

      expect(result).toBeNull();
    });

    it("should call update when price is unchanged", async () => {
      const existingProperty = {
        id: "uuid-123",
        source: "idnes",
        source_id: "12345678",
        price_numeric: 3500000,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: existingProperty,
        error: null,
      });

      const property = createProperty({ priceNumeric: 3500000 });
      await processProperty(property);

      expect(mockSupabase.from).toHaveBeenCalledWith("properties");
      expect(mockSupabase.update).toHaveBeenCalled();
    });
  });

  describe("processProperty - Price Change Detection", () => {
    it("should detect price decrease", async () => {
      const existingProperty = {
        id: "uuid-123",
        source: "idnes",
        source_id: "12345678",
        price_numeric: 4000000,
        price_formatted: "4 000 000 Kč",
      };

      // Mock: property found, then record price change, then update price
      mockSupabase.single.mockResolvedValueOnce({
        data: existingProperty,
        error: null,
      });

      const property = createProperty({
        price: "3 600 000 Kč",
        priceNumeric: 3600000,
      });

      const result = await processProperty(property);

      expect(result).toBeTruthy();
      expect(result?.isPriceChange).toBe(true);
      expect(result?.previousPrice).toBe("4 000 000 Kč");
      expect(result?.previousPriceNumeric).toBe(4000000);
      expect(result?.priceChangePercent).toBe(-10); // 10% decrease
    });

    it("should detect price increase", async () => {
      const existingProperty = {
        id: "uuid-123",
        source: "idnes",
        source_id: "12345678",
        price_numeric: 3000000,
        price_formatted: "3 000 000 Kč",
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: existingProperty,
        error: null,
      });

      const property = createProperty({
        price: "3 300 000 Kč",
        priceNumeric: 3300000,
      });

      const result = await processProperty(property);

      expect(result?.isPriceChange).toBe(true);
      expect(result?.priceChangePercent).toBe(10); // 10% increase
    });

    it("should skip comparison when old price is null", async () => {
      const existingProperty = {
        id: "uuid-123",
        source: "idnes",
        source_id: "12345678",
        price_numeric: null,
        price_formatted: "Na vyžádání",
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: existingProperty,
        error: null,
      });

      const property = createProperty({ priceNumeric: 3500000 });
      const result = await processProperty(property);

      expect(result).toBeNull(); // Skip - can't compare
    });

    it("should skip comparison when new price is null/undefined", async () => {
      const existingProperty = {
        id: "uuid-123",
        source: "idnes",
        source_id: "12345678",
        price_numeric: 3500000,
        price_formatted: "3 500 000 Kč",
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: existingProperty,
        error: null,
      });

      const property = createProperty({ priceNumeric: undefined });
      const result = await processProperty(property);

      expect(result).toBeNull(); // Skip - can't compare
    });
  });

  describe("processProperties - Batch Processing", () => {
    it("should process multiple properties and count correctly", async () => {
      // Property 1: new (not found, then upsert)
      mockSupabase.single
        .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })
        .mockResolvedValueOnce({ data: { id: "uuid-1" }, error: null });

      // Property 2: existing, same price (skip)
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "uuid-2", price_numeric: 2000000 },
        error: null,
      });

      // Property 3: existing, price changed
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "uuid-3",
          price_numeric: 5000000,
          price_formatted: "5 000 000 Kč",
        },
        error: null,
      });

      const properties = [
        createProperty({ sourceId: "new-1" }),
        createProperty({ sourceId: "existing-same", priceNumeric: 2000000 }),
        createProperty({
          sourceId: "existing-changed",
          priceNumeric: 4500000,
        }),
      ];

      const result = await processProperties(properties);

      expect(result.newCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.priceChangeCount).toBe(1);
      expect(result.results.length).toBe(2); // new + price change
    });

    it("should return all as new when DB unavailable", async () => {
      vi.mocked(supabaseModule.isSupabaseAvailable).mockReturnValue(false);

      const properties = [
        createProperty({ sourceId: "1" }),
        createProperty({ sourceId: "2" }),
        createProperty({ sourceId: "3" }),
      ];

      const result = await processProperties(properties);

      expect(result.newCount).toBe(3);
      expect(result.skippedCount).toBe(0);
      expect(result.priceChangeCount).toBe(0);
      expect(result.results.length).toBe(3);
    });
  });
});

describe("Price Change Percentage Calculation", () => {
  it("should calculate 10% decrease correctly", () => {
    const oldPrice = 4000000;
    const newPrice = 3600000;
    const percent = ((newPrice - oldPrice) / oldPrice) * 100;
    expect(Math.round(percent * 10) / 10).toBe(-10);
  });

  it("should calculate 10% increase correctly", () => {
    const oldPrice = 3000000;
    const newPrice = 3300000;
    const percent = ((newPrice - oldPrice) / oldPrice) * 100;
    expect(Math.round(percent * 10) / 10).toBe(10);
  });

  it("should calculate 50% decrease correctly", () => {
    const oldPrice = 6000000;
    const newPrice = 3000000;
    const percent = ((newPrice - oldPrice) / oldPrice) * 100;
    expect(Math.round(percent * 10) / 10).toBe(-50);
  });

  it("should handle small percentage changes", () => {
    const oldPrice = 3500000;
    const newPrice = 3465000; // 1% decrease
    const percent = ((newPrice - oldPrice) / oldPrice) * 100;
    expect(Math.round(percent * 10) / 10).toBe(-1);
  });
});

describe("ScrapeResult Type Verification", () => {
  it("should match expected ScrapeResult structure", () => {
    const result: ScrapeResult = {
      label: "Test Scraper",
      properties: [
        {
          title: "Test",
          price: "3 000 000 Kč",
          location: "Praha",
          rooms: "2+kk",
          url: "https://example.com",
          isPriceChange: false,
        },
      ],
      newCount: 1,
      priceChangeCount: 0,
      skippedCount: 0,
    };

    expect(result.label).toBe("Test Scraper");
    expect(result.properties.length).toBe(1);
    expect(result.newCount).toBe(1);
  });

  it("should include price change info when isPriceChange is true", () => {
    const property: PropertyWithPriceChange = {
      title: "Test",
      price: "2 700 000 Kč",
      location: "Praha",
      rooms: "2+kk",
      url: "https://example.com",
      isPriceChange: true,
      previousPrice: "3 000 000 Kč",
      previousPriceNumeric: 3000000,
      priceChangePercent: -10,
    };

    expect(property.isPriceChange).toBe(true);
    expect(property.previousPrice).toBe("3 000 000 Kč");
    expect(property.priceChangePercent).toBe(-10);
  });
});
