#!/bin/bash

# Deploy script for Reality Scraper
# Usage: ./scripts/deploy.sh

set -e  # Exit on error

# Configuration
SERVER="root@72.62.145.103"  # Uses SSH config alias (see ~/.ssh/config)
REMOTE_PATH="/opt/reality-scraper"
LOCAL_PATH="$(dirname "$0")/.."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Deploying Reality Scraper...${NC}"

# Step 1: Build locally first to catch errors early
echo -e "${YELLOW}📦 Building locally...${NC}"
cd "$LOCAL_PATH"
npm run build

# Step 2: Sync code to server (including dist, excluding dev files)
echo -e "${YELLOW}📤 Uploading code to server...${NC}"
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='.git' \
  --exclude='hostinger' \
  --exclude='hostinger.pub' \
  --exclude='src/__tests__' \
  -e "ssh" \
  "$LOCAL_PATH/" \
  "$SERVER:$REMOTE_PATH/"

# Step 3: Install production dependencies and restart
echo -e "${YELLOW}🔧 Installing dependencies and restarting...${NC}"
ssh "$SERVER" "cd $REMOTE_PATH && npm ci --omit=dev && pm2 restart reality-scraper"

# Step 4: Show status
echo -e "${YELLOW}📊 Checking status...${NC}"
ssh "$SERVER" "pm2 status"

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "View logs with: ssh $SERVER 'pm2 logs reality-scraper'"
