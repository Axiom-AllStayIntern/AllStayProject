#!/usr/bin/env bash
set -e

echo "Deploying AllStay via Docker Compose..."

# Copy env if needed
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example and fill in values."
  exit 1
fi

docker compose down
docker compose build --no-cache
docker compose up -d

echo "✓ Deploy complete."
echo "Services:"
echo "  Tablet:      http://localhost:3000"
echo "  Dining MCP:  http://localhost:3001"
echo "  Spa MCP:     http://localhost:3002"
echo "  Restaurant:  http://localhost:3003"
echo "  Transport:   http://localhost:3004"
