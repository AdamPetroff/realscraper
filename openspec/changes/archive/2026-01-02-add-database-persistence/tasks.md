## 1. Database Setup

- [x] 1.1 Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.example` with placeholders
- [x] 1.2 Create Supabase migration for `properties` table
- [x] 1.3 Create Supabase migration for `price_history` table
- [x] 1.4 Add `@supabase/supabase-js` package dependency to `package.json`

## 2. Database Service Layer

- [x] 2.1 Create `src/db/supabase.ts` with Supabase client initialization
- [x] 2.2 Create `src/db/property-repository.ts` with CRUD operations:
  - `findBySourceAndId(source, sourceId)`
  - `upsertProperty(property)`
  - `recordPriceChange(propertyId, oldPrice, newPrice)`
- [x] 2.3 Create `src/db/index.ts` barrel export

## 3. Type Updates

- [x] 3.1 Add `sourceId` and `source` fields to `Property` interface in `src/types.ts`
- [x] 3.2 Create `PropertyWithPriceChange` type for return values with price delta info
- [x] 3.3 Add `ScrapeResult` type to encapsulate properties + metadata

## 4. Scraper ID Extraction

- [x] 4.1 Update `SrealityScraper` to extract `estate.id` as `sourceId`
- [x] 4.2 Update `BezrealitkyScraper` to extract `uri` as `sourceId`
- [x] 4.3 Update `IdnesScraper` to extract ID from URL as `sourceId`
- [x] 4.4 Update `BazosScraper` to extract ID from URL as `sourceId`

## 5. Scheduler Integration

- [x] 5.1 Initialize database connection in `PropertyScheduler.initialize()`
- [x] 5.2 Update `executeScrape()` to filter properties through database:
  - Skip if exists and price unchanged
  - Mark as price change if price differs
  - Insert new properties
- [x] 5.3 Update `runScrapes()` to handle `PropertyWithPriceChange` results
- [x] 5.4 Add graceful fallback if database is unavailable

## 6. Telegram Notification Updates

- [x] 6.1 Update `TelegramService` to format price change notifications
- [x] 6.2 Show old price, new price, and percentage change for updated properties

## 7. Testing

- [x] 7.1 Create `src/__tests__/db/property-repository.test.ts`
  - Test insert, find, update operations
  - Test price history recording
- [x] 7.2 Create `src/__tests__/scrapers/id-extraction.test.ts`
  - Test ID extraction for each scraper type
- [x] 7.3 Create `src/__tests__/scheduler/deduplication.test.ts`
  - Test property filtering logic
  - Test price change detection
- [x] 7.4 Add test script to `package.json`
- [x] 7.5 Add test dependencies (vitest)

## 8. Documentation & Deployment

- [x] 8.1 Update README with database setup instructions
- [ ] 8.2 Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Fly.io secrets
- [x] 8.3 Run migration on Supabase production
