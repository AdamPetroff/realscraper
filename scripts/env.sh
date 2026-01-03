#!/bin/bash

# Environment variable management script for Reality Scraper
# Usage:
#   ./scripts/env.sh              - Edit .env file interactively
#   ./scripts/env.sh show         - Show current .env contents
#   ./scripts/env.sh set KEY=VAL  - Set/update a variable
#   ./scripts/env.sh get KEY      - Get a specific variable

set -e

SERVER="hostinger"
ENV_PATH="/opt/reality-scraper/.env"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

case "${1:-edit}" in
  show)
    echo -e "${CYAN}📋 Current environment variables:${NC}"
    echo "─────────────────────────────────"
    ssh "$SERVER" "cat $ENV_PATH"
    echo "─────────────────────────────────"
    ;;
    
  get)
    if [ -z "$2" ]; then
      echo "Usage: $0 get KEY"
      exit 1
    fi
    ssh "$SERVER" "grep '^$2=' $ENV_PATH | cut -d'=' -f2-"
    ;;
    
  set)
    if [ -z "$2" ]; then
      echo "Usage: $0 set KEY=VALUE"
      exit 1
    fi
    KEY="${2%%=*}"
    VALUE="${2#*=}"
    
    echo -e "${YELLOW}Setting $KEY...${NC}"
    
    # Check if key exists and update, or append
    ssh "$SERVER" "
      if grep -q '^${KEY}=' $ENV_PATH; then
        sed -i 's|^${KEY}=.*|${KEY}=${VALUE}|' $ENV_PATH
        echo 'Updated existing variable'
      else
        echo '${KEY}=${VALUE}' >> $ENV_PATH
        echo 'Added new variable'
      fi
    "
    
    echo -e "${YELLOW}Restarting app...${NC}"
    ssh "$SERVER" "pm2 restart reality-scraper"
    echo -e "${GREEN}✅ Done!${NC}"
    ;;
    
  edit)
    echo -e "${YELLOW}Opening .env for editing...${NC}"
    echo -e "${CYAN}(Save and exit to restart the app)${NC}"
    ssh -t "$SERVER" "nano $ENV_PATH"
    
    echo -e "${YELLOW}Restarting app...${NC}"
    ssh "$SERVER" "pm2 restart reality-scraper"
    echo -e "${GREEN}✅ Done!${NC}"
    ;;
    
  *)
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  edit          Edit .env interactively (default)"
    echo "  show          Show current .env contents"
    echo "  set KEY=VAL   Set or update a variable"
    echo "  get KEY       Get a specific variable value"
    ;;
esac
