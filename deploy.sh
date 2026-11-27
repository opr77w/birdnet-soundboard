#!/usr/bin/env bash
# When: 2026-11-23 | By: claude-sonnet-4-6 | What: pull latest, rebuild, and restart container on the Pi
set -euo pipefail

cd "$(dirname "$0")"

# Load secrets if present (exports all vars to subshells)
SECRETS=/home/pi/.secrets/soundboard.env
if [[ -f "$SECRETS" ]]; then set -a; source "$SECRETS"; set +a; fi

echo "Pulling latest..."
git pull

echo "Building image..."
docker build -t birdnet-soundboard .

echo "Restarting container..."
docker rm -f birdnet-soundboard 2>/dev/null || true
docker run -d \
  --name birdnet-soundboard \
  --network host \
  --restart unless-stopped \
  --user 1000:1000 \
  -v /mnt/birdnet-go/external/clips:/clips:ro \
  -e BIRDNET_BASE_URL=http://localhost:8080 \
  -e BIRDNET_CLIPS_DIR=/clips \
  ${XENOCANTO_API_KEY:+-e XENOCANTO_API_KEY="$XENOCANTO_API_KEY"} \
  ${BIRDWEATHER_TOKEN:+-e BIRDWEATHER_TOKEN="$BIRDWEATHER_TOKEN"} \
  ${BIRDNET_LAT:+-e BIRDNET_LAT="$BIRDNET_LAT"} \
  ${BIRDNET_LON:+-e BIRDNET_LON="$BIRDNET_LON"} \
  birdnet-soundboard

echo "Done. Soundboard running at http://$(hostname -I | awk '{print $1}'):3000"
