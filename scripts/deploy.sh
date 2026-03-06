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

# Establish one SSH master connection (prompts once), then reuse it.
SSH_CONTROL_PATH="/tmp/reality-scraper-deploy-%r@%h:%p"
SSH_OPTS=(
  -o ControlMaster=auto
  -o ControlPath="$SSH_CONTROL_PATH"
  -o ControlPersist=10m
)

cleanup_ssh_master() {
  ssh -O exit "${SSH_OPTS[@]}" "$SERVER" >/dev/null 2>&1 || true
}
trap cleanup_ssh_master EXIT

echo -e "${YELLOW}🔐 Authenticating SSH session...${NC}"
ssh "${SSH_OPTS[@]}" "$SERVER" "true"

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
  -e "ssh -o ControlMaster=auto -o ControlPath=$SSH_CONTROL_PATH -o ControlPersist=10m" \
  "$LOCAL_PATH/" \
  "$SERVER:$REMOTE_PATH/"

# Step 3: Install production dependencies and restart
echo -e "${YELLOW}🔧 Installing dependencies and restarting...${NC}"
ssh "${SSH_OPTS[@]}" "$SERVER" "cd $REMOTE_PATH && npm ci --omit=dev && pm2 restart reality-scraper"

# Step 4: Show status
echo -e "${YELLOW}📊 Checking status...${NC}"
ssh "${SSH_OPTS[@]}" "$SERVER" "pm2 status"

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "View logs with: ssh $SERVER 'pm2 logs reality-scraper'"
