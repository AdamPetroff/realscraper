import dotenv from "dotenv";
import { getSupabase, initializeSupabase, isSupabaseAvailable } from "../src/db";

interface PropertyRow {
  source: string;
  price_per_sqm: number | null;
}

interface SourceStats {
  source: string;
  count: number;
  averagePricePerSqm: number;
}

async function main(): Promise<void> {
  dotenv.config();

  console.log("Calculating average price per m2 by source...");

  const connected = await initializeSupabase();
  if (!connected || !isSupabaseAvailable()) {
    throw new Error("Supabase is not available. Check SUPABASE_* env vars.");
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client not initialized.");
  }

  const { data, error } = await supabase
    .from("properties")
    .select("source, price_per_sqm")
    .not("price_per_sqm", "is", null);

  if (error) {
    throw new Error(`Failed to fetch properties: ${error.message}`);
  }

  const rows = (data || []) as PropertyRow[];
  if (rows.length === 0) {
    console.log("No properties with price_per_sqm found.");
    return;
  }

  const sumsBySource = new Map<string, { sum: number; count: number }>();

  for (const row of rows) {
    if (typeof row.price_per_sqm !== "number" || !Number.isFinite(row.price_per_sqm)) {
      continue;
    }

    const current = sumsBySource.get(row.source) || { sum: 0, count: 0 };
    current.sum += row.price_per_sqm;
    current.count += 1;
    sumsBySource.set(row.source, current);
  }

  const stats: SourceStats[] = Array.from(sumsBySource.entries())
    .map(([source, values]) => ({
      source,
      count: values.count,
      averagePricePerSqm: Math.round(values.sum / values.count),
    }))
    .sort((a, b) => a.source.localeCompare(b.source));

  console.log("\nAverage price per m2 by source:");
  for (const stat of stats) {
    console.log(
      `- ${stat.source}: ${stat.averagePricePerSqm.toLocaleString("cs-CZ")} CZK/m2 (${stat.count} properties)`
    );
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
}
