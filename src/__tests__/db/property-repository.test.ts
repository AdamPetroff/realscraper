import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeSupabase,
  closeSupabase,
  isSupabaseAvailable,
  getSupabase,
} from "../../db/supabase";
import {
  findBySourceAndId,
  upsertProperty,
  recordPriceChange,
  updatePropertyPrice,
  processProperty,
  processProperties,
} from "../../db/property-repository";
import type { Property } from "../../types";

// Test properties with unique IDs to avoid conflicts
const TEST_PREFIX = `test_${Date.now()}`;

function createTestProperty(overrides: Partial<Property> = {}): Property {
  return {
    title: "Test Property",
    price: "3 500 000 Kč",
    location: "Praha, Vinohrady",
    area: "75 m²",
    rooms: "3+kk",
    url: "https://example.com/property/123",
    source: "idnes",
    sourceId: `${TEST_PREFIX}_${Math.random().toString(36).substr(2, 9)}`,
    priceNumeric: 3500000,
    ...overrides,
  };
}

describe("Property Repository - Database Integration Tests", () => {
  let dbAvailable = false;

  beforeAll(async () => {
    // Load env vars
    const dotenv = await import("dotenv");
    dotenv.config();

    dbAvailable = await initializeSupabase();
    console.log(`Database available: ${dbAvailable}`);
  });

  afterAll(async () => {
    // Clean up test data if DB is available
    if (dbAvailable) {
      const supabase = getSupabase();
      if (supabase) {
        await supabase
          .from("properties")
          .delete()
          .like("source_id", `${TEST_PREFIX}%`);
      }
    }
    closeSupabase();
  });

  describe("when database is available", () => {
    beforeEach(() => {
      if (!dbAvailable) {
        console.log("Skipping - database not available");
      }
    });

    it("should initialize Supabase connection", () => {
      if (!dbAvailable) return;
      expect(isSupabaseAvailable()).toBe(true);
    });

    describe("upsertProperty", () => {
      it("should insert a new property and return its ID", async () => {
        if (!dbAvailable) return;

        const property = createTestProperty();
        const id = await upsertProperty(property);

        expect(id).toBeTruthy();
        expect(typeof id).toBe("string");
      });

      it("should update an existing property on conflict", async () => {
        if (!dbAvailable) return;

        const sourceId = `${TEST_PREFIX}_upsert_test`;
        const property = createTestProperty({
          sourceId,
          title: "Original Title",
        });

        // Insert first time
        const id1 = await upsertProperty(property);
        expect(id1).toBeTruthy();

        // Update with new title
        const updatedProperty = { ...property, title: "Updated Title" };
        const id2 = await upsertProperty(updatedProperty);

        // Should return the same ID (update, not insert)
        expect(id2).toBe(id1);
      });

      it("should return null for property without source/sourceId", async () => {
        if (!dbAvailable) return;

        const property = createTestProperty({
          source: undefined,
          sourceId: undefined,
        });

        const id = await upsertProperty(property);
        expect(id).toBeNull();
      });
    });

    describe("findBySourceAndId", () => {
      it("should find an existing property", async () => {
        if (!dbAvailable) return;

        const sourceId = `${TEST_PREFIX}_find_test`;
        const property = createTestProperty({ sourceId, source: "idnes" });

        await upsertProperty(property);

        const found = await findBySourceAndId("idnes", sourceId);

        expect(found).toBeTruthy();
        expect(found?.source).toBe("idnes");
        expect(found?.source_id).toBe(sourceId);
        expect(found?.title).toBe(property.title);
        expect(found?.price_numeric).toBe(property.priceNumeric);
      });

      it("should return null for non-existent property", async () => {
        if (!dbAvailable) return;

        const found = await findBySourceAndId("idnes", "non_existent_id_12345");
        expect(found).toBeNull();
      });
    });

    describe("recordPriceChange", () => {
      it("should record a price change in history", async () => {
        if (!dbAvailable) return;

        const sourceId = `${TEST_PREFIX}_price_history`;
        const property = createTestProperty({ sourceId });

        const propertyId = await upsertProperty(property);
        expect(propertyId).toBeTruthy();

        const success = await recordPriceChange(
          propertyId!,
          "4 000 000 Kč",
          4000000
        );

        expect(success).toBe(true);

        // Verify the price history was recorded
        const supabase = getSupabase();
        const { data } = await supabase!
          .from("price_history")
          .select("*")
          .eq("property_id", propertyId)
          .single();

        expect(data).toBeTruthy();
        expect(data?.price_numeric).toBe(4000000);
        expect(data?.price_formatted).toBe("4 000 000 Kč");
      });
    });

    describe("updatePropertyPrice", () => {
      it("should update the property price", async () => {
        if (!dbAvailable) return;

        const sourceId = `${TEST_PREFIX}_update_price`;
        const property = createTestProperty({
          sourceId,
          priceNumeric: 3000000,
        });

        const propertyId = await upsertProperty(property);
        expect(propertyId).toBeTruthy();

        const success = await updatePropertyPrice(
          propertyId!,
          "3 200 000 Kč",
          3200000
        );

        expect(success).toBe(true);

        // Verify the update
        const found = await findBySourceAndId("idnes", sourceId);
        expect(found?.price_numeric).toBe(3200000);
        expect(found?.price_formatted).toBe("3 200 000 Kč");
      });
    });

    describe("processProperty", () => {
      it("should return new property with isPriceChange=false", async () => {
        if (!dbAvailable) return;

        const property = createTestProperty();

        const result = await processProperty(property);

        expect(result).toBeTruthy();
        expect(result?.isPriceChange).toBe(false);
        expect(result?.title).toBe(property.title);
      });

      it("should return null for existing property with same price", async () => {
        if (!dbAvailable) return;

        const sourceId = `${TEST_PREFIX}_same_price`;
        const property = createTestProperty({
          sourceId,
          priceNumeric: 5000000,
        });

        // First insert
        await processProperty(property);

        // Process again with same price
        const result = await processProperty(property);

        expect(result).toBeNull();
      });

      it("should detect price change and return property with change info", async () => {
        if (!dbAvailable) return;

        const sourceId = `${TEST_PREFIX}_price_change`;
        const property = createTestProperty({
          sourceId,
          price: "5 000 000 Kč",
          priceNumeric: 5000000,
        });

        // First insert
        await processProperty(property);

        // Process with new price
        const updatedProperty = {
          ...property,
          price: "4 500 000 Kč",
          priceNumeric: 4500000,
        };

        const result = await processProperty(updatedProperty);

        expect(result).toBeTruthy();
        expect(result?.isPriceChange).toBe(true);
        expect(result?.previousPrice).toBe("5 000 000 Kč");
        expect(result?.previousPriceNumeric).toBe(5000000);
        expect(result?.priceChangePercent).toBe(-10); // 10% decrease
      });

      it("should handle price increase correctly", async () => {
        if (!dbAvailable) return;

        const sourceId = `${TEST_PREFIX}_price_increase`;
        const property = createTestProperty({
          sourceId,
          priceNumeric: 4000000,
        });

        await processProperty(property);

        const updatedProperty = {
          ...property,
          price: "4 400 000 Kč",
          priceNumeric: 4400000,
        };

        const result = await processProperty(updatedProperty);

        expect(result?.isPriceChange).toBe(true);
        expect(result?.priceChangePercent).toBe(10); // 10% increase
      });
    });

    describe("processProperties", () => {
      it("should process multiple properties and return stats", async () => {
        if (!dbAvailable) return;

        const properties: Property[] = [
          createTestProperty({ sourceId: `${TEST_PREFIX}_batch_1` }),
          createTestProperty({ sourceId: `${TEST_PREFIX}_batch_2` }),
          createTestProperty({ sourceId: `${TEST_PREFIX}_batch_3` }),
        ];

        const result = await processProperties(properties);

        expect(result.results.length).toBe(3);
        expect(result.newCount).toBe(3);
        expect(result.priceChangeCount).toBe(0);
        expect(result.skippedCount).toBe(0);
      });

      it("should correctly count skipped and price-changed properties", async () => {
        if (!dbAvailable) return;

        // First, insert properties
        const sourceId1 = `${TEST_PREFIX}_batch_rerun_1`;
        const sourceId2 = `${TEST_PREFIX}_batch_rerun_2`;

        const initialProperties: Property[] = [
          createTestProperty({ sourceId: sourceId1, priceNumeric: 1000000 }),
          createTestProperty({ sourceId: sourceId2, priceNumeric: 2000000 }),
        ];

        await processProperties(initialProperties);

        // Now re-process with one unchanged, one changed, one new
        const rerunProperties: Property[] = [
          createTestProperty({ sourceId: sourceId1, priceNumeric: 1000000 }), // same
          createTestProperty({ sourceId: sourceId2, priceNumeric: 2200000 }), // changed
          createTestProperty({ sourceId: `${TEST_PREFIX}_batch_new` }), // new
        ];

        const result = await processProperties(rerunProperties);

        expect(result.newCount).toBe(1);
        expect(result.priceChangeCount).toBe(1);
        expect(result.skippedCount).toBe(1);
        expect(result.results.length).toBe(2); // new + changed
      });
    });
  });

  describe("when database is not available", () => {
    it("should return all properties as new when DB unavailable", async () => {
      // Temporarily close Supabase
      closeSupabase();

      const property = createTestProperty();
      const result = await processProperty(property);

      expect(result).toBeTruthy();
      expect(result?.isPriceChange).toBe(false);

      // Restore if it was available
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        await initializeSupabase();
      }
    });
  });
});
