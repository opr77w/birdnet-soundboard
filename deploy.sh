#!/usr/bin/env bash
# When: 2026-11-23 | By: claude-sonnet-4-6 | What: pull latest, rebuild, and restart container on the Pi
set -euo pipefail

cd "$(dirname "$0")"

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
  birdnet-soundboard

echo "Done. Soundboard running at http://$(hostname -I | awk '{print $1}'):3000"
