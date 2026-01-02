# Change: Add Database Persistence for Scraped Properties

## Why
Currently, all properties are scraped fresh each run and sent to Telegram without any deduplication. This results in repeated notifications for the same properties. By introducing database persistence, we can track which properties have already been seen, detect price changes, and only notify users about truly new or updated listings.

## What Changes
- **ADDED**: Supabase SDK integration via `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables
- **ADDED**: Database migrations for `properties` and `price_history` tables
- **ADDED**: `PropertyRepository` for property persistence operations (check existence, insert, update prices)
- **ADDED**: Property ID extraction in all scrapers (idnes, bezrealitky, sreality, bazos)
- **MODIFIED**: `Property` type to include `sourceId` (external ID from source site) and `source` (scraper type)
- **MODIFIED**: Scraper workflow to skip known properties (unless price changed)
- **MODIFIED**: Return value includes price change information for notifications
- **ADDED**: Test suite verifying database operations and scraper deduplication logic

## Impact
- Affected specs: `property-persistence`, `scraper-property-ids` (new capabilities)
- Affected code:
  - `src/types.ts` - Extended Property interface
  - `src/scrapers/*.ts` - Add ID extraction to all scrapers
  - `src/scheduler.ts` - Integrate database checks
  - `src/db/` - New database service module (Supabase client + repository)
  - `supabase/migrations/` - New migration files
  - `.env.example` - Add Supabase environment variables
  - `package.json` - Add @supabase/supabase-js dependency
