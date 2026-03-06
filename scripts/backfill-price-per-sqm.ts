import dotenv from "dotenv";
import { getSupabase, initializeSupabase, isSupabaseAvailable } from "../src/db";

interface PropertyRow {
  id: string;
  area: string | null;
  price_numeric: number | null;
  price_per_sqm: number | null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const batchSizeArg = args.find((arg) => arg.startsWith("--batch-size="));
  const batchSizeValue = batchSizeArg
    ? Number.parseInt(batchSizeArg.split("=")[1], 10)
    : Number.parseInt(process.env.BACKFILL_BATCH_SIZE || "500", 10);

  return {
    dryRun,
    batchSize:
      Number.isFinite(batchSizeValue) && batchSizeValue > 0 ? batchSizeValue : 500,
  };
}

function parseArea(area: string | null): number | null {
  if (!area) return null;
  const match = area.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function computePricePerSqm(
  priceNumeric: number | null,
  area: string | null
): number | null {
  if (!priceNumeric || priceNumeric <= 0) return null;
  const parsedArea = parseArea(area);
  if (!parsedArea) return null;
  return Math.round(priceNumeric / parsedArea);
}

async function main(): Promise<void> {
  dotenv.config();
  const { dryRun, batchSize } = parseArgs();

  console.log("Starting backfill for properties.price_per_sqm...");
  console.log(
    `Mode: ${dryRun ? "DRY RUN (no writes)" : "WRITE"} | Batch size: ${batchSize}`
  );

  const connected = await initializeSupabase();
  if (!connected || !isSupabaseAvailable()) {
    throw new Error("Supabase is not available. Check SUPABASE_* env vars.");
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase client not initialized.");
  }

  let offset = 0;
  let totalScanned = 0;
  let totalComputable = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  let totalSkippedMissingData = 0;
  let totalFailed = 0;

  while (true) {
    const { data, error } = await supabase
      .from("properties")
      .select("id, area, price_numeric, price_per_sqm")
      .order("id", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch properties batch at offset ${offset}: ${error.message}`);
    }

    const rows = (data || []) as PropertyRow[];
    if (rows.length === 0) {
      break;
    }

    totalScanned += rows.length;
    const updates: Array<{ id: string; pricePerSqm: number }> = [];

    for (const row of rows) {
      const computed = computePricePerSqm(row.price_numeric, row.area);
      if (computed === null) {
        totalSkippedMissingData++;
        continue;
      }

      totalComputable++;
      if (row.price_per_sqm === computed) {
        totalUnchanged++;
        continue;
      }

      updates.push({ id: row.id, pricePerSqm: computed });
    }

    if (dryRun) {
      totalUpdated += updates.length;
    } else {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from("properties")
          .update({
            price_per_sqm: update.pricePerSqm,
            updated_at: new Date().toISOString(),
          })
          .eq("id", update.id);

        if (updateError) {
          totalFailed++;
          console.error(`Failed to update property ${update.id}: ${updateError.message}`);
        } else {
          totalUpdated++;
        }
      }
    }

    console.log(
      `Processed ${totalScanned} rows so far (${updates.length} ${dryRun ? "would be updated" : "updates in this batch"})`
    );

    offset += rows.length;
    if (rows.length < batchSize) {
      break;
    }
  }

  console.log("\nBackfill finished.");
  console.log(`- Scanned rows: ${totalScanned}`);
  console.log(`- Computable rows: ${totalComputable}`);
  console.log(`- ${dryRun ? "Would update" : "Updated"} rows: ${totalUpdated}`);
  console.log(`- Unchanged rows: ${totalUnchanged}`);
  console.log(`- Skipped (missing/invalid area or price): ${totalSkippedMissingData}`);
  if (!dryRun) {
    console.log(`- Failed updates: ${totalFailed}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Backfill script failed:", error);
    process.exit(1);
  });
}
