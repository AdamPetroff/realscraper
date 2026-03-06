import dotenv from "dotenv";
import { getSupabase, initializeSupabase, isSupabaseAvailable } from "../src/db";

interface IdnesPropertyRow {
  id: string;
  title: string | null;
  area: string | null;
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

function parseAreaFromTitle(title: string | null): string | null {
  if (!title) return null;

  // Match e.g. "50 m²", "50m²", "50,5 m²", "50.5 m2"
  // Avoid trailing \b here: it does not match reliably after superscript "²".
  const match = title.match(/(\d+(?:[.,]\d+)?)\s*m(?:²|2)/i);
  if (!match) return null;

  const parsed = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Number.isInteger(parsed)
    ? parsed.toString()
    : parsed.toFixed(2).replace(/\.?0+$/, "");
}

async function main(): Promise<void> {
  dotenv.config();
  const { dryRun, batchSize } = parseArgs();

  console.log("Starting idnes area backfill from title...");
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
  let totalParsed = 0;
  let totalUpdated = 0;
  let totalSkippedUnparseable = 0;
  let totalFailed = 0;

  while (true) {
    const { data, error } = await supabase
      .from("properties")
      .select("id, title, area")
      .eq("source", "idnes")
      .is("area", null)
      .order("id", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      throw new Error(
        `Failed to fetch idnes properties batch at offset ${offset}: ${error.message}`
      );
    }

    const rows = (data || []) as IdnesPropertyRow[];
    if (rows.length === 0) {
      break;
    }

    totalScanned += rows.length;
    const updates: Array<{ id: string; area: string }> = [];

    for (const row of rows) {
      const parsedArea = parseAreaFromTitle(row.title);
      if (!parsedArea) {
        totalSkippedUnparseable++;
        continue;
      }

      totalParsed++;
      updates.push({ id: row.id, area: parsedArea });
    }

    if (dryRun) {
      totalUpdated += updates.length;
    } else {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from("properties")
          .update({
            area: update.area,
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
      `Processed ${totalScanned} rows so far (${updates.length} ${dryRun ? "would be updated" : "updated in this batch"})`
    );

    offset += rows.length;
    if (rows.length < batchSize) {
      break;
    }
  }

  console.log("\nBackfill finished.");
  console.log(`- Scanned rows: ${totalScanned}`);
  console.log(`- Parsed area from title: ${totalParsed}`);
  console.log(`- ${dryRun ? "Would update" : "Updated"} rows: ${totalUpdated}`);
  console.log(`- Skipped (area not parseable from title): ${totalSkippedUnparseable}`);
  if (!dryRun) {
    console.log(`- Failed updates: ${totalFailed}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Idnes area backfill script failed:", error);
    process.exit(1);
  });
}
