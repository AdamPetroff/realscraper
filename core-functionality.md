# Core Functionality

This document describes the business logic and core functionality of the Real Estate Scraper Bot.

## Overview

The Real Estate Scraper Bot is an automated system that monitors Czech real estate websites for property listings, detects new listings and price changes, and sends notifications via Telegram. It's designed to help users stay on top of the property market without manually checking multiple websites.

## High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Scheduler     │────▶│    Scrapers     │────▶│   Database      │
│   (cron)        │     │  (4 sources)    │     │   (Supabase)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        │
                        ┌─────────────────┐              │
                        │   Deduplication │◀─────────────┘
                        │   & Price Check │
                        └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   Telegram      │
                        │   Notifications │
                        └─────────────────┘
```

## Core Components

### 1. Scheduler (`src/scheduler.ts`)

The `PropertyScheduler` class orchestrates the entire scraping workflow:

- **Initialization**: Sets up database connection, initializes required scrapers, and tests Telegram connectivity
- **Scheduling**: Runs scrapes every **10 minutes** using cron (`*/10 * * * *`) in Europe/Prague timezone
- **Manual Trigger**: Supports immediate scraping via `RUN_NOW=true` environment variable

**Key Flow:**
1. Load enabled scrape configurations
2. Initialize only the scrapers needed for enabled configs
3. Execute each scrape configuration sequentially
4. Process results through deduplication
5. Send combined Telegram notification for all new/changed properties

### 2. Scrapers (`src/scrapers/`)

Four specialized scrapers extract property listings from Czech real estate portals:

| Scraper | Website | Method |
|---------|---------|--------|
| `IdnesScraper` | reality.idnes.cz | HTML scraping with Cheerio |
| `BezrealitkyScraper` | bezrealitky.cz | Next.js Apollo cache extraction |
| `SrealityScraper` | sreality.cz | Next.js API with dynamic build ID |
| `BazosScraper` | bazos.cz | HTML scraping with Cheerio |

**All scrapers:**
- Use native `fetch()` for HTTP requests (no headless browser)
- Extract unique property IDs from URLs/data
- Parse numeric prices for comparison
- Return structured `Property` objects

### 3. Scrape Configurations (`src/scrape-configs.ts`)

The `SCRAPES` array defines what to scrape. Each configuration specifies:
- **type**: Which scraper to use (`idnes`, `bezrealitky`, `sreality`, `bazos`)
- **label**: Human-readable name for notifications
- **config**: Source-specific search parameters

**Current configurations search for:**
- Apartments for sale in Brno, Břeclav, and Hodonín
- 2+1, 2+kk, 3+1, 3+kk layouts
- Price ranges: 3-6M CZK and 6-8M CZK
- Personal ownership
- Recent listings (today/yesterday filters where supported)

### 4. Database Layer (`src/db/`)

Uses Supabase (PostgreSQL) for persistence:

**Tables:**
- `properties`: Stores all seen properties with source, ID, price, timestamps
- `price_history`: Records price changes over time

**Property Processing Logic (`processProperty`):**

```
For each scraped property:
├── No source/sourceId? → Treat as new, notify
├── Not in database? → Insert, notify as NEW
└── In database?
    ├── Price unchanged or not comparable? → Update last_seen, SKIP notification
    └── Price changed? → Record in history, update property, notify as PRICE CHANGE
```

**Key Behavior:**
- Without database: All properties are treated as new (notifies every time)
- With database: Only new properties and price changes trigger notifications

### 5. Telegram Service (`src/telegram-service.ts`)

Sends notifications via Telegram Bot API:

- **Photo messages**: Each property sends as a photo with caption
- **Rich formatting**: HTML-formatted captions with title, price, location, link
- **Price change indicators**: Shows old price, new price, and percentage change
- **Batched sending**: Groups results by scrape label/city

**Notification Content:**
- Property title
- City/region label
- Price (with strikethrough for old price if changed)
- Location
- Link to listing

## Data Flow

### Property Lifecycle

```
1. SCRAPE: Fetch listings from source website
          ↓
2. PARSE: Extract property data (title, price, location, images, ID)
          ↓
3. DEDUPE: Check database for existing property
          ↓
4. CLASSIFY:
   - NEW: Property not seen before → Insert to DB → Notify
   - PRICE_CHANGE: Property exists, price differs → Update DB, record history → Notify
   - SKIP: Property exists, same price → Update last_seen only
          ↓
5. NOTIFY: Send Telegram message with photo for each new/changed property
```

### Property Data Structure

```typescript
interface Property {
  title: string;        // Listing title
  price: string;        // Formatted price (e.g., "3 500 000 Kč")
  location: string;     // Address/city
  area?: string;        // Size in m²
  rooms: string;        // Layout (e.g., "2+kk")
  url: string;          // Link to listing
  images?: string[];    // Photo URLs
  source: ScraperSource;  // 'idnes' | 'bezrealitky' | 'sreality' | 'bazos'
  sourceId: string;     // Unique ID from source site
  priceNumeric: number; // Numeric price for comparison
}
```

## Key Business Rules

### Deduplication

- **Unique Key**: `(source, sourceId)` - each property is uniquely identified by its source website and that site's ID
- **ID Extraction**: Each scraper extracts IDs from URLs or API data (e.g., `/detail/.../12345/` → `12345`)

### Price Change Detection

- Compares `priceNumeric` values (integers)
- Calculates percentage change: `((new - old) / old) * 100`
- Records history in `price_history` table for trend analysis
- Shows both increase (📈) and decrease (📉) indicators

### Filtering

Different scrapers support different filtering:
- **Idnes**: `articleAge` parameter filters to last 1/7/31 days
- **Sreality**: `stari` parameter (dnes/tyden/mesic) + optional `newOnly` flag for watchdog badge
- **Bezrealitky**: `newOnly` flag checks for "Nový" tag
- **Bazos**: `recentOnly` filters to today's date based on listing timestamp

### Graceful Degradation

- **No database**: Bot runs in "notify all" mode - every scraped property triggers a notification
- **Scraper errors**: Individual scrape failures don't stop other scrapes
- **Telegram errors**: Logged but don't crash the bot

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram Bot API token |
| `TELEGRAM_CHAT_ID` | Yes | Target chat for notifications |
| `SUPABASE_URL` | No | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Supabase service role key |
| `RUN_NOW` | No | Set to `true` for immediate scrape on startup |

### Adding/Modifying Scrapes

Edit the `SCRAPES` array in `src/scrape-configs.ts`:

```typescript
{
  type: "sreality",
  label: "Sreality (Custom)",
  enabled: true,  // optional, defaults to true
  config: {
    offerType: "prodej",
    category: "byty",
    locationSlug: "praha",
    sizes: ["3+1", "3+kk"],
    priceMax: 10_000_000,
    newOnly: true,
  },
}
```

## Operational Notes

### Schedule

- Scrapes run every **10 minutes**
- Timezone: Europe/Prague
- First run can be triggered immediately with `RUN_NOW=true`

### Resource Usage

- No headless browser (Puppeteer kept for fallback but unused)
- All scrapers use native `fetch()` with appropriate headers
- Sequential scraping prevents rate limiting issues

### Logging

- `✅` Success operations
- `❌` Errors
- `⚠️` Warnings
- `🔍` Scraping activity
- `📊` Statistics (counts of new/changed/skipped)
