import { getSupabase, isSupabaseAvailable } from "./supabase";
import {
  createStoredScrapeKey,
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

function rowToStoredConfig(row: DbScrapeConfigRow): StoredSharedScrapeConfig {
  return validateStoredSharedScrapeConfig(
    {
      key: row.key,
      label: row.label,
      enabled: row.enabled ?? undefined,
      scrapers: row.scrapers ?? undefined,
      search: row.search,
      overrides: row.overrides ?? undefined,
    },
    `scrape config "${row.key}"`,
  );
}

function toDbRow(config: StoredSharedScrapeConfig): {
  key: string;
  label: string;
  enabled: boolean;
  scrapers: string[] | null;
  search: unknown;
  overrides: unknown;
} {
  const validated = validateStoredSharedScrapeConfig(
    {
      ...config,
      key: config.key || createStoredScrapeKey(config.label),
    },
    "scrape config",
  );

  return {
    key: validated.key,
    label: validated.label,
    enabled: validated.enabled ?? true,
    scrapers: validated.scrapers ?? null,
    search: validated.search,
    overrides: validated.overrides ?? null,
  };
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

  return (data as DbScrapeConfigRow[]).map(rowToStoredConfig);
}

export async function getStoredSharedScrapeConfig(
  key: string,
): Promise<StoredSharedScrapeConfig | null> {
  if (!isSupabaseAvailable()) {
    throw new Error("Supabase is not available; cannot load scrape config");
  }

  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from("scrape_configs")
    .select("id,key,label,enabled,scrapers,search,overrides,created_at,updated_at")
    .eq("key", key)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new Error(`Failed to load scrape config: ${error.message}`);
  }

  return rowToStoredConfig(data as DbScrapeConfigRow);
}

export async function createStoredSharedScrapeConfig(
  config: StoredSharedScrapeConfig,
): Promise<StoredSharedScrapeConfig> {
  if (!isSupabaseAvailable()) {
    throw new Error("Supabase is not available; cannot create scrape config");
  }

  const supabase = getSupabase()!;
  const row = toDbRow(config);
  const { data, error } = await supabase
    .from("scrape_configs")
    .insert(row)
    .select("id,key,label,enabled,scrapers,search,overrides,created_at,updated_at")
    .single();

  if (error) {
    throw new Error(`Failed to create scrape config: ${error.message}`);
  }

  return rowToStoredConfig(data as DbScrapeConfigRow);
}

export async function updateStoredSharedScrapeConfig(
  key: string,
  config: StoredSharedScrapeConfig,
): Promise<StoredSharedScrapeConfig> {
  if (!isSupabaseAvailable()) {
    throw new Error("Supabase is not available; cannot update scrape config");
  }

  const supabase = getSupabase()!;
  const row = toDbRow({ ...config, key: config.key || key });
  const { data, error } = await supabase
    .from("scrape_configs")
    .update({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .eq("key", key)
    .select("id,key,label,enabled,scrapers,search,overrides,created_at,updated_at")
    .single();

  if (error) {
    throw new Error(`Failed to update scrape config: ${error.message}`);
  }

  return rowToStoredConfig(data as DbScrapeConfigRow);
}

export async function deleteStoredSharedScrapeConfig(key: string): Promise<void> {
  if (!isSupabaseAvailable()) {
    throw new Error("Supabase is not available; cannot delete scrape config");
  }

  const supabase = getSupabase()!;
  const { error } = await supabase.from("scrape_configs").delete().eq("key", key);

  if (error) {
    throw new Error(`Failed to delete scrape config: ${error.message}`);
  }
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
