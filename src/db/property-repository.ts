import { getSupabase, isSupabaseAvailable } from "./supabase";
import type { Property, PropertyWithPriceChange, ScraperSource } from "../types";

export interface DbProperty {
  id: string;
  source: string;
  source_id: string;
  title: string | null;
  location: string | null;
  district: string | null;
  region: string | null;
  area: string | null;
  rooms: string | null;
  url: string;
  price_formatted: string | null;
  price_numeric: number | null;
  price_per_sqm: number | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

function normalizeAreaForDb(area?: string): string | null {
  if (!area) {
    return null;
  }

  const match = area.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) {
    return null;
  }

  const value = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Find a property by source and sourceId.
 */
export async function findBySourceAndId(
  source: ScraperSource,
  sourceId: string
): Promise<DbProperty | null> {
  if (!isSupabaseAvailable()) {
    return null;
  }

  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("source", source)
    .eq("source_id", sourceId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("Error finding property:", error.message);
    return null;
  }

  return data as DbProperty;
}

/**
 * Insert or update a property in the database.
 * Returns the property ID if successful.
 */
export async function upsertProperty(property: Property): Promise<string | null> {
  if (!isSupabaseAvailable()) {
    return null;
  }

  if (!property.source || !property.sourceId) {
    console.warn("Cannot upsert property without source and sourceId");
    return null;
  }

  const supabase = getSupabase()!;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("properties")
    .upsert(
      {
        source: property.source,
        source_id: property.sourceId,
        title: property.title,
        location: property.location,
        district: property.district || null,
        region: property.region || null,
        area: normalizeAreaForDb(property.area),
        rooms: property.rooms || null,
        url: property.url,
        price_formatted: property.price,
        price_numeric: property.priceNumeric || null,
        price_per_sqm: property.pricePerSqm || null,
        last_seen_at: now,
        updated_at: now,
      },
      {
        onConflict: "source,source_id",
        ignoreDuplicates: false,
      }
    )
    .select("id")
    .single();

  if (error) {
    console.error("Error upserting property:", error.message);
    return null;
  }

  return data?.id || null;
}

/**
 * Record a price change in the price_history table.
 */
export async function recordPriceChange(
  propertyId: string,
  priceFormatted: string,
  priceNumeric: number | null
): Promise<boolean> {
  if (!isSupabaseAvailable()) {
    return false;
  }

  const supabase = getSupabase()!;
  const { error } = await supabase.from("price_history").insert({
    property_id: propertyId,
    price_formatted: priceFormatted,
    price_numeric: priceNumeric,
  });

  if (error) {
    console.error("Error recording price change:", error.message);
    return false;
  }

  return true;
}

/**
 * Update the price of an existing property.
 */
export async function updatePropertyPrice(
  propertyId: string,
  priceFormatted: string,
  priceNumeric: number | null
): Promise<boolean> {
  if (!isSupabaseAvailable()) {
    return false;
  }

  const supabase = getSupabase()!;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("properties")
    .update({
      price_formatted: priceFormatted,
      price_numeric: priceNumeric,
      last_seen_at: now,
      updated_at: now,
    })
    .eq("id", propertyId);

  if (error) {
    console.error("Error updating property price:", error.message);
    return false;
  }

  return true;
}

/**
 * Process a scraped property against the database.
 * Returns a PropertyWithPriceChange with price delta info if applicable.
 * Returns null if the property should be skipped (exists with same price).
 */
export async function processProperty(
  property: Property
): Promise<PropertyWithPriceChange | null> {
  if (!isSupabaseAvailable()) {
    // Fallback: return all properties as new when DB unavailable
    return {
      ...property,
      isPriceChange: false,
    };
  }

  if (!property.source || !property.sourceId) {
    // Properties without IDs are treated as new
    return {
      ...property,
      isPriceChange: false,
    };
  }

  const existing = await findBySourceAndId(property.source, property.sourceId);

  if (!existing) {
    // New property - insert and return
    await upsertProperty(property);
    return {
      ...property,
      isPriceChange: false,
    };
  }

  // Property exists - check for price change
  const oldPrice = existing.price_numeric;
  const newPrice = property.priceNumeric ?? null;

  // If we can't compare prices (one or both null), just update last_seen
  if (oldPrice === null || newPrice === null || oldPrice === newPrice) {
    // Update last_seen_at timestamp
    const supabase = getSupabase()!;
    await supabase
      .from("properties")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", existing.id);

    // Skip notification - price unchanged or not comparable
    return null;
  }

  // Price has changed!
  const priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;

  // Record the price change in history
  await recordPriceChange(existing.id, property.price, newPrice);

  // Update the property with new price
  await updatePropertyPrice(existing.id, property.price, newPrice);

  return {
    ...property,
    isPriceChange: true,
    previousPrice: existing.price_formatted || undefined,
    previousPriceNumeric: oldPrice,
    priceChangePercent: Math.round(priceChangePercent * 10) / 10, // Round to 1 decimal
  };
}

/**
 * Process multiple properties and return only new/changed ones.
 */
export async function processProperties(
  properties: Property[]
): Promise<{
  results: PropertyWithPriceChange[];
  newCount: number;
  priceChangeCount: number;
  skippedCount: number;
}> {
  const results: PropertyWithPriceChange[] = [];
  let newCount = 0;
  let priceChangeCount = 0;
  let skippedCount = 0;

  for (const property of properties) {
    const processed = await processProperty(property);
    if (processed) {
      results.push(processed);
      if (processed.isPriceChange) {
        priceChangeCount++;
      } else {
        newCount++;
      }
    } else {
      skippedCount++;
    }
  }

  return { results, newCount, priceChangeCount, skippedCount };
}
