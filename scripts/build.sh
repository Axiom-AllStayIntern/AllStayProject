#!/usr/bin/env bash
set -e

echo "Building AllStay..."

echo "→ Building shared-types..."
npm run build --workspace=packages/shared-types

echo "→ Building MCP shared module..."
npm run build --workspace=apps/mcp-servers/packages/shared

echo "→ Building MCP servers..."
npm run build --workspace=apps/mcp-servers/packages/dining
npm run build --workspace=apps/mcp-servers/packages/spa
npm run build --workspace=apps/mcp-servers/packages/restaurant
npm run build --workspace=apps/mcp-servers/packages/transport

echo "→ Building tablet app..."
npm run build --workspace=apps/tablet

echo "✓ Build complete."
