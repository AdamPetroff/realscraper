export {
  initializeSupabase,
  getSupabase,
  isSupabaseAvailable,
  closeSupabase,
} from "./supabase";

export {
  findBySourceAndId,
  upsertProperty,
  recordPriceChange,
  updatePropertyPrice,
  processProperty,
  processProperties,
} from "./property-repository";

export {
  createStoredSharedScrapeConfig,
  deleteStoredSharedScrapeConfig,
  getStoredSharedScrapeConfig,
  listStoredSharedScrapeConfigs,
  loadScrapes,
  seedScrapeConfigs,
  updateStoredSharedScrapeConfig,
} from "./scrape-config-repository";

export type { DbProperty } from "./property-repository";
export type { DbScrapeConfigRow } from "./scrape-config-repository";
