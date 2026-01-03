# Deployment Guide - Hostinger VPS

## Server Details

- **Host**: `72.62.145.103`
- **User**: `root`
- **App Location**: `/opt/reality-scraper`
- **Process Manager**: PM2
- **SSH Key**: `~/.ssh/hostinger`

## SSH Connection

```bash
# Using SSH alias (configured in ~/.ssh/config)
ssh hostinger
```

## PM2 Commands (run on server)

```bash
# Check app status
pm2 status

# View logs in real-time
pm2 logs reality-scraper

# View last N lines of logs
pm2 logs reality-scraper --lines 100

# Restart the app
pm2 restart reality-scraper

# Stop the app
pm2 stop reality-scraper

# Start the app (if stopped)
pm2 start reality-scraper

# Delete the app from PM2
pm2 delete reality-scraper
```

## Updating the App

### Quick Deploy (Recommended)

From your local machine, run:

```bash
npm run deploy
```

This script will:
1. Build locally (to catch errors early)
2. Upload code to the server
3. Install dependencies and rebuild
4. Restart the app with PM2

### Manual Deploy

If you prefer to do it manually:

```bash
# 1. Upload updated code (excluding node_modules, .env, dist)
rsync -avz --exclude='node_modules' --exclude='.env' --exclude='dist' \
  -e "ssh" \
  /Users/adampetroff/coding/realscraper/ \
  root@72.62.145.103:/opt/reality-scraper/

# 2. SSH into server
ssh root@72.62.145.103

# 3. Rebuild and restart
cd /opt/reality-scraper
npm ci
npm run build
pm2 restart reality-scraper
```

## Environment Variables

Located at `/opt/reality-scraper/.env` on the server.

### Using the helper script (Recommended)

```bash
# Edit interactively (opens nano, restarts app on save)
npm run env

# Show all current variables
npm run env:show

# Set or update a variable
./scripts/env.sh set NEW_VAR=value

# Get a specific variable
./scripts/env.sh get TELEGRAM_BOT_TOKEN
```

### Manual editing

```bash
ssh hostinger "nano /opt/reality-scraper/.env"
ssh hostinger "pm2 restart reality-scraper"
```

## Server Maintenance

```bash
# Check disk space
df -h

# Check memory usage
free -m

# Check running processes
htop

# View PM2 monitoring dashboard
pm2 monit
```

## Auto-restart Configuration

The app is configured to:
- ✅ Automatically restart if it crashes (PM2)
- ✅ Automatically start on server reboot (systemd service: `pm2-root`)

To verify systemd service:
```bash
systemctl status pm2-root
```
