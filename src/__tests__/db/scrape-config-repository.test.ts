import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeSupabase,
  getSupabase,
  initializeSupabase,
} from "../../db/supabase";
import {
  listStoredSharedScrapeConfigs,
  loadScrapes,
  seedScrapeConfigs,
} from "../../db/scrape-config-repository";
import { type StoredSharedScrapeConfig } from "../../scrape-configs";

const TEST_PREFIX = `test_scrape_config_${Date.now()}`;

describe("Scrape Config Repository - Database Integration Tests", () => {
  let dbAvailable = false;

  beforeAll(async () => {
    const dotenv = await import("dotenv");
    dotenv.config();

    dbAvailable = await initializeSupabase();
  });

  afterAll(async () => {
    if (dbAvailable) {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from("scrape_configs").delete().like("key", `${TEST_PREFIX}%`);
      }
    }

    closeSupabase();
  });

  it("seeds and lists stored scrape configs", async () => {
    if (!dbAvailable) return;

    const configs: StoredSharedScrapeConfig[] = [
      {
        key: `${TEST_PREFIX}_idnes`,
        label: `${TEST_PREFIX} IDNES`,
        scrapers: ["idnes"],
        search: {
          offerType: "sale",
          propertyKind: "land",
          location: {
            label: "Olomouc ≤10 km",
            idnesCity: "olomouc",
          },
          priceMax: 2_000_000,
          ownership: "personal",
          freshness: "week",
        },
        overrides: {
          idnes: {
            landSubtype: "stavebni-pozemek",
          },
        },
      },
    ];

    await seedScrapeConfigs(configs);
    const stored = await listStoredSharedScrapeConfigs();

    expect(stored.some((config) => config.key === `${TEST_PREFIX}_idnes`)).toBe(true);
  });

  it("loads resolved scrapes from stored configs", async () => {
    if (!dbAvailable) return;

    const configs: StoredSharedScrapeConfig[] = [
      {
        key: `${TEST_PREFIX}_exdrazby`,
        label: `${TEST_PREFIX} ExDrazby`,
        scrapers: ["exdrazby"],
        search: {
          offerType: "sale",
          propertyKind: "land",
          location: {
            label: "Regions",
            exdrazby: {
              regionIds: [11, 12],
            },
          },
        },
        overrides: {
          exdrazby: {
            status: "prepared",
            mainCategoryId: 1,
            subcategoryIds: [3, 4],
            perPage: 100,
          },
        },
      },
    ];

    await seedScrapeConfigs(configs);
    const scrapes = await loadScrapes();

    const exdrazbyScrape = scrapes.find(
      (scrape) => scrape.id === `exdrazby-${TEST_PREFIX}-exdrazby`,
    );

    expect(exdrazbyScrape).toBeDefined();
    expect(exdrazbyScrape?.type).toBe("exdrazby");
  });
});
