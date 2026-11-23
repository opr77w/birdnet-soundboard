#!/usr/bin/env bash
# When: 2026-11-23 | By: claude-sonnet-4-6 | What: pull latest and rebuild on the Pi
set -euo pipefail

cd "$(dirname "$0")"

echo "Pulling latest..."
git pull

echo "Building and restarting..."
docker compose up --build -d

echo "Done. Soundboard running at http://$(hostname -I | awk '{print $1}'):3000"
