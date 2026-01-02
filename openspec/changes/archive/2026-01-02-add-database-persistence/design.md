## Context

The real estate scraper currently processes all listings fresh each run, sending Telegram notifications for every scraped property. Users receive duplicate notifications for the same properties across multiple scrape runs. A database is needed to:

1. Track which properties have been seen
2. Detect price changes for existing properties
3. Only notify about new listings or price drops/increases

The user has created a Supabase project with session pooler connection available.

## Goals / Non-Goals

**Goals:**
- Store scraped properties in PostgreSQL (via Supabase)
- Track price history over time
- Skip notification for properties already in DB (unless price changed)
- Return price change information (old price, new price, percentage) for changed properties
- Make all scrapers extract unique property IDs from their source

**Non-Goals:**
- Full property detail storage (we store enough to identify and track prices)
- Historical analytics dashboard
- Property expiration/removal tracking
- Complex querying or search functionality

## Decisions

### Decision: Use Supabase JavaScript SDK
**Rationale**: Since the project already uses Supabase for hosting the database, the official SDK provides a clean API for database operations, built-in connection pooling, and type-safe queries. It simplifies authentication and eliminates manual connection management.

**Alternatives considered:**
- `pg` package directly - More control but requires manual connection pooling and lacks Supabase-specific features
- Prisma/Drizzle ORM - Overkill for simple read/write operations

### Decision: Composite unique key (source + sourceId)
**Rationale**: Each property is uniquely identified by its source website and the ID on that website. This allows the same property listed on multiple sites to be tracked separately.

### Decision: Store numeric price separately from formatted price string
**Rationale**: The `priceNumeric` column enables accurate comparison and percentage calculations. The `priceFormatted` column preserves the original display format.

### Decision: Extract IDs from URLs where explicit ID not available
**Rationale**: 
- Sreality provides `estate.id` directly
- Bezrealitky uses `uri` as identifier
- Idnes and Bazos have IDs embedded in URLs that can be parsed

## Database Schema

### Table: `properties`
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,           -- 'idnes', 'bezrealitky', 'sreality', 'bazos'
  source_id VARCHAR(255) NOT NULL,       -- External ID from source site
  title TEXT,
  location TEXT,
  area TEXT,
  rooms TEXT,
  url TEXT NOT NULL,
  price_formatted TEXT,                  -- Display price (e.g., "3 500 000 Kč")
  price_numeric INTEGER,                 -- Numeric price for comparison
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, source_id)
);
```

### Table: `price_history`
```sql
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  price_formatted TEXT,
  price_numeric INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Property ID Extraction Strategy

| Source | ID Location | Example |
|--------|-------------|---------|
| Sreality | `estate.id` field | `1889518412` |
| Bezrealitky | `uri` field / URL path | `prodej-bytu-3-kk-brno-slatina-12345` |
| Idnes | URL path segment | `/detail/12345678/` → `12345678` |
| Bazos | URL path segment | `/inzerat/12345678/` → `12345678` |

## Flow Changes

### Current Flow
```
Scrape → Transform → Send all to Telegram
```

### New Flow
```
Scrape → Transform with IDs → Check DB →
  If new: Insert → Include in notification
  If exists & price same: Skip notification
  If exists & price changed: Update price history → Include with price change info
```

## Risks / Trade-offs

- **Risk**: Database connection failures could block scraping
  - *Mitigation*: Graceful fallback to old behavior (notify all) if DB unavailable

- **Risk**: ID extraction patterns may break if sites change URLs
  - *Mitigation*: Log warnings for failed ID extractions; properties without IDs treated as new

- **Trade-off**: Numeric price parsing may fail for unusual price formats
  - *Mitigation*: Store both formatted and numeric; only compare when numeric available

## Migration Plan

1. Create database tables via Supabase migration
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to environment configuration
3. Deploy with backward compatibility (if DB unavailable, use old behavior)
4. Initial run will populate database with all current listings
5. Subsequent runs will show only new/changed properties

## Open Questions

- None - requirements are clear from user input
