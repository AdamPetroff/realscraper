# Project Context

## Purpose
A TypeScript-based web scraper for Czech real estate listings from multiple sources (reality.idnes.cz, bezrealitky.cz, sreality.cz, bazos.cz) with automated Telegram notifications. The bot runs on a schedule (daily at 6 PM, nightly at 11:50 PM and 12:10 AM Prague time) to find new property listings matching configurable criteria and sends formatted updates to a Telegram chat.

**Goals:**
- Monitor multiple Czech real estate websites for new listings
- Filter properties by location (primarily Brno), price range, apartment size/disposition, and other criteria
- Send consolidated daily updates via Telegram with property details, images, and direct links
- Maintain low resource usage by preferring native fetch over browser automation

## Tech Stack
- **Language**: TypeScript (strict mode, ES2020 target)
- **Runtime**: Node.js
- **Build**: `tsc` with ts-node/ts-node-dev for development
- **HTML Parsing**: Cheerio (primary), Puppeteer (deprecated fallback)
- **Scheduling**: node-cron
- **Notifications**: node-telegram-bot-api
- **Deployment**: Docker on Fly.io
- **Package Manager**: npm

## Project Conventions

### Code Style
- **Naming**: 
  - `PascalCase` for classes and interfaces (e.g., `BezrealitkyScraper`, `Property`)
  - `camelCase` for functions, variables, and methods (e.g., `scrapeProperties`, `buildUrlForScrape`)
  - `SCREAMING_SNAKE_CASE` for constants and enum-like mappings (e.g., `DISPOSITION_MAP`, `DAILY_SCRAPES`)
- **TypeScript**:
  - Explicit type annotations for function parameters and return types
  - Interface definitions for all configuration objects and data structures
  - Use `type` for unions/aliases, `interface` for object shapes
- **Async**: Always use async/await over raw Promises
- **Logging**: Console logging with emoji prefixes for visual clarity (✅, ❌, 🔍, ⏰, etc.)
- **Formatting**: No trailing semicolons enforced, tabs for indentation

### Architecture Patterns
- **Scraper Pattern**: Each scraper is a class implementing the `IScraper` interface with `scrapeProperties(url, options)` and `close()` methods
- **Configuration-Driven**: URL building is centralized in `config.ts` with type-safe config interfaces and builder functions (`buildIdnesUrl`, `buildBezrealitkyUrl`, etc.)
- **Scrape Configs**: Declarative scrape configurations in `scrape-configs.ts` define what to scrape, when, and with what parameters
- **Service Layer**: `TelegramService` handles all Telegram API interactions
- **Scheduler**: `PropertyScheduler` orchestrates scrapers and notification delivery
- **Dependency Injection**: Services receive dependencies (tokens, IDs) via constructor
- **Fetch-First**: Prefer native `fetch()` with Cheerio parsing over Puppeteer for performance

### Testing Strategy
- Manual testing via `scripts/manual-scrape-*.ts` scripts
- `RUN_NOW=true` environment variable for immediate testing
- No automated test suite currently

### Git Workflow
- Main branch: `main`
- Direct commits to main for this project
- No specific commit message convention enforced

## Domain Context

### Czech Real Estate Terms
- **Disposition** (room layout): `1+kk`, `1+1`, `2+kk`, `2+1`, `3+kk`, `3+1`, etc.
  - `+kk` = kitchenette (open kitchen)
  - `+1` = separate kitchen room
- **Offer Types**: `PRODEJ` (sale), `PRONAJEM` (rent)
- **Estate Types**: `BYT` (apartment), `DUM` (house)
- **Ownership**: `osobni` (personal), `druzstevni` (cooperative)
- **Currency**: CZK (Czech Koruna)

### Supported Real Estate Sites
1. **reality.idnes.cz** - Uses query parameters for filtering, supports article age filtering
2. **bezrealitky.cz** - Next.js app with Apollo cache in `__NEXT_DATA__`, has "Nový" (new) tag
3. **sreality.cz** - Requires special handling, API-based data
4. **bazos.cz** - Classifieds site, uses location codes and date-based filtering

### Location System
- OSM (OpenStreetMap) IDs used for location filtering on bezrealitky.cz
- City slugs (e.g., `brno`) for idnes.cz
- Postal/area codes (e.g., `60200` for Brno-město) for bazos.cz

## Important Constraints
- **No Official APIs**: All sites are scraped via HTML parsing - structures may change
- **Anti-Bot Protection**: Some sites have protection; scrapers use realistic headers and user agents
- **Rate Limiting**: Avoid rapid successive requests; scheduled runs are spaced out
- **Image Handling**: Telegram has limits on media groups; max 10 properties per message batch
- **Timezone**: All scheduling uses `Europe/Prague` timezone

## External Dependencies

### Services
- **Telegram Bot API**: For sending notifications (requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`)
- **Fly.io**: Hosting platform (configured via `fly.toml`)

### Scraped Websites (unofficial)
- https://reality.idnes.cz
- https://www.bezrealitky.cz
- https://www.sreality.cz
- https://reality.bazos.cz

### Environment Variables
**Required:**
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `TELEGRAM_CHAT_ID` - Target chat ID for notifications

**Optional (per scraper):**
- `IDNES_*` - Idnes scraper configuration
- `BEZREALITKY_*` - Bezrealitky scraper configuration
- `RUN_NOW` - Set to "true" for immediate test run
