# Reality Scraper with Telegram Bot

A TypeScript-based web scraper for Czech real estate listings from multiple sources with automated Telegram notifications.

## Features

- 🏠 Scrapes real estate listings from:
  - **reality.idnes.cz**
  - **bezrealitky.cz**
- 📱 Sends daily updates via Telegram bot
- ⏰ Automatically runs at 6 PM every day
- 🔍 Configurable search parameters for both sources
- 🇨🇿 Focuses on properties added in the last day

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create Telegram Bot:**
   - Message @BotFather on Telegram
   - Create a new bot with `/newbot`
   - Save the bot token

3. **Get your Chat ID:**
   - Message your bot
   - Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your chat ID in the response

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your bot details:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_CHAT_ID=your_chat_id_here
   ```

## Usage

### Start the Bot (Production)
```bash
npm start
```
The bot will:
- Send a test message on startup
- Schedule daily property updates at 6 PM (Prague time)
- Keep running until stopped

### Test Immediately
```bash
RUN_NOW=true npm start
```
This runs the scraper immediately for testing.

### Manual Scraping (Development)
```bash
# Scrape Idnes
npm run manual-scrape

# Scrape Bezrealitky
npm run manual-scrape:bezrealitky

# Scrape only new properties on Bezrealitky
npm run manual-scrape:bezrealitky -- --new-only
```
Runs scrapers without Telegram integration for testing.

## Configuration

### Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN` - Your bot token from @BotFather
- `TELEGRAM_CHAT_ID` - Your Telegram chat ID

Optional - Idnes Scraper Configuration:
- `IDNES_PRICE_MIN` - Minimum price in CZK (default: 3000000)
- `IDNES_PRICE_MAX` - Maximum price in CZK (default: 6000000)
- `IDNES_CITY` - City name (default: brno)
- `IDNES_ROOMS` - Room types (default: 2k|21)
- `IDNES_AREA_MIN` - Minimum area in m² (default: 36)
- `IDNES_OWNERSHIP` - Ownership type (default: personal)
- `IDNES_MATERIAL` - Building materials (default: brick|wood|stone|skeleton|prefab|mixed)
- `IDNES_ROOM_COUNT` - Room count filter (default: 3)

Optional - Bezrealitky Scraper Configuration:
- `BEZREALITKY_DISPOSITIONS` - Comma-separated dispositions (default: DISP_2_1,DISP_2_KK,DISP_3_1,DISP_3_KK)
- `BEZREALITKY_ESTATE_TYPE` - Estate type (default: BYT)
- `BEZREALITKY_OFFER_TYPE` - Offer type (default: PRODEJ)
- `BEZREALITKY_LOCATION` - Location type (default: exact)
- `BEZREALITKY_OSM_VALUE` - Location name (default: Brno-město, Jihomoravský kraj, Jihovýchod, Česko)
- `BEZREALITKY_REGION_OSM_IDS` - Region OSM IDs (default: R442273)
- `BEZREALITKY_PRICE_FROM` - Minimum price in CZK (default: 3000000)
- `BEZREALITKY_PRICE_TO` - Maximum price in CZK (default: 7000000)
- `BEZREALITKY_CURRENCY` - Currency (default: CZK)

Other:
- `RUN_NOW` - Set to "true" to run immediately on start

### Default Search Parameters

**Idnes Scraper:**
- Properties in Brno
- Price range: 3,000,000 - 6,000,000 CZK
- 2+kk or 2+1 apartments
- Minimum 36 m²
- Personal ownership
- Various building materials
- **Properties added in the last 1 day only**

**Bezrealitky Scraper:**
- Properties in Brno (Brno-město)
- Price range: 3,000,000 - 7,000,000 CZK
- 2+1, 2+kk, 3+1, or 3+kk apartments
- Apartments (BYT)
- Sale (PRODEJ)
- **Only new properties** (when running via scheduler)

## Available Scripts

- `npm start` - Start the Telegram bot with scheduler
- `npm run dev` - Start with file watching
- `npm run manual-scrape` - Run one-time scrape without bot
- `npm run build` - Compile TypeScript

## How It Works

1. **Daily Schedule**: Bot runs automatically at 6 PM Prague time
2. **Property Search**: 
   - Scrapes reality.idnes.cz for properties added in the last day (two price ranges)
   - Scrapes bezrealitky.cz for new properties only
3. **Message Format**: Sends formatted Telegram message with:
   - Property count
   - Title, price, location
   - Area, room count, description (when available)
   - Direct links to listings
   - Property images (when available)
   - Limits to 10 properties per message

## Troubleshooting

- **Bot doesn't respond**: Check your `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- **No properties found**: The search criteria might be too restrictive, or no new properties were listed
- **Scraper fails**: Website might have anti-bot protection or structure changed
- **Timezone issues**: Bot uses Europe/Prague timezone for scheduling

## Development

To modify search parameters without environment variables, edit `src/config.ts`:

```typescript
// Idnes configuration
export const DEFAULT_IDNES_CONFIG: IdnesScraperConfig = {
  priceMin: 3000000,
  priceMax: 6000000,
  city: "brno",
  rooms: "2k|21",
  areaMin: 36,
  ownership: "personal",
  material: "brick|wood|stone|skeleton|prefab|mixed",
  roomCount: 3,
  articleAge: "1" // Properties from last 1 day
};

// Bezrealitky configuration
export const DEFAULT_BEZREALITKY_CONFIG: BezrealitkyScraperConfig = {
  dispositions: ["DISP_2_1", "DISP_2_KK", "DISP_3_1", "DISP_3_KK"],
  estateType: "BYT",
  offerType: "PRODEJ",
  location: "exact",
  osmValue: "Brno-město, Jihomoravský kraj, Jihovýchod, Česko",
  regionOsmIds: "R442273",
  priceFrom: 3000000,
  priceTo: 7000000,
  currency: "CZK",
};
```

Both scrapers now use dynamic URL building from configuration instead of hardcoded URLs.