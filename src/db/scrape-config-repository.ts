import { getSupabase, isSupabaseAvailable } from "./supabase";
import {
  DEFAULT_STORED_SHARED_SCRAPE_CONFIGS,
  expandSharedScrapes,
  type ScrapeConfig,
  type StoredSharedScrapeConfig,
  validateStoredSharedScrapeConfig,
} from "../scrape-configs";

export interface DbScrapeConfigRow {
  id: string;
  key: string;
  label: string;
  enabled: boolean | null;
  scrapers: string[] | null;
  search: unknown;
  overrides: unknown;
  created_at: string;
  updated_at: string;
}

export async function listStoredSharedScrapeConfigs(): Promise<
  StoredSharedScrapeConfig[]
> {
  if (!isSupabaseAvailable()) {
    throw new Error("Supabase is not available; cannot load scrape configs");
  }

  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("scrape_configs")
    .select("id,key,label,enabled,scrapers,search,overrides,created_at,updated_at")
    .order("key", { ascending: true });

  if (error) {
    throw new Error(`Failed to load scrape configs: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error("No scrape configs found in database");
  }

  return (data as DbScrapeConfigRow[]).map((row) =>
    validateStoredSharedScrapeConfig(
      {
        key: row.key,
        label: row.label,
        enabled: row.enabled ?? undefined,
        scrapers: row.scrapers ?? undefined,
        search: row.search,
        overrides: row.overrides ?? undefined,
      },
      `scrape config "${row.key}"`,
    ),
  );
}

export async function loadScrapes(): Promise<ScrapeConfig[]> {
  const sharedConfigs = await listStoredSharedScrapeConfigs();
  const scrapes = expandSharedScrapes(sharedConfigs);

  if (scrapes.length === 0) {
    throw new Error("Scrape config expansion produced no scrapes");
  }

  return scrapes;
}

export async function seedScrapeConfigs(
  configs: StoredSharedScrapeConfig[] = DEFAULT_STORED_SHARED_SCRAPE_CONFIGS,
): Promise<number> {
  if (!isSupabaseAvailable()) {
    throw new Error("Supabase is not available; cannot seed scrape configs");
  }

  if (configs.length === 0) {
    return 0;
  }

  const supabase = getSupabase()!;
  const rows = configs.map((config) => ({
    key: config.key,
    label: config.label,
    enabled: config.enabled ?? true,
    scrapers: config.scrapers ?? null,
    search: config.search,
    overrides: config.overrides ?? null,
  }));

  const { error } = await supabase.from("scrape_configs").upsert(rows, {
    onConflict: "key",
    ignoreDuplicates: false,
  });

  if (error) {
    throw new Error(`Failed to seed scrape configs: ${error.message}`);
  }

  return rows.length;
}
