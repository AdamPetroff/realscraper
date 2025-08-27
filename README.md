# Reality.cz Scraper with Telegram Bot

A TypeScript-based web scraper for Czech real estate listings from reality.idnes.cz with automated Telegram notifications.

## Features

- 🏠 Scrapes real estate listings from reality.idnes.cz
- 📱 Sends daily updates via Telegram bot
- ⏰ Automatically runs at 6 PM every day
- 🔍 Configurable search parameters
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
npm run manual-scrape
```
Runs the original scraper without Telegram integration.

## Configuration

### Environment Variables

Required:
- `TELEGRAM_BOT_TOKEN` - Your bot token from @BotFather
- `TELEGRAM_CHAT_ID` - Your Telegram chat ID

Optional (override default search parameters):
- `PRICE_MIN` - Minimum price in CZK (default: 3000000)
- `PRICE_MAX` - Maximum price in CZK (default: 6000000)
- `CITY` - City name (default: brno)
- `ROOMS` - Room types (default: 2k|21)
- `AREA_MIN` - Minimum area in m² (default: 36)
- `OWNERSHIP` - Ownership type (default: personal)
- `MATERIAL` - Building materials (default: brick|wood|stone|skeleton|prefab|mixed)
- `ROOM_COUNT` - Room count filter (default: 3)
- `RUN_NOW` - Set to "true" to run immediately on start

### Default Search Parameters

The bot searches for:
- Properties in Brno
- Price range: 3,000,000 - 6,000,000 CZK
- 2+kk or 2+1 apartments
- Minimum 36 m²
- Personal ownership
- Various building materials
- **Properties added in the last 1 day only**

## Available Scripts

- `npm start` - Start the Telegram bot with scheduler
- `npm run dev` - Start with file watching
- `npm run manual-scrape` - Run one-time scrape without bot
- `npm run build` - Compile TypeScript

## How It Works

1. **Daily Schedule**: Bot runs automatically at 6 PM Prague time
2. **Property Search**: Scrapes reality.idnes.cz for properties added in the last day
3. **Message Format**: Sends formatted Telegram message with:
   - Property count
   - Title, price, location (extracted from title)
   - Direct links to listings
   - Limits to 10 properties per message

## Troubleshooting

- **Bot doesn't respond**: Check your `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- **No properties found**: The search criteria might be too restrictive, or no new properties were listed
- **Scraper fails**: Website might have anti-bot protection or structure changed
- **Timezone issues**: Bot uses Europe/Prague timezone for scheduling

## Development

To modify search parameters without environment variables, edit `src/config.ts`:

```typescript
export const DEFAULT_CONFIG: ScraperConfig = {
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
```