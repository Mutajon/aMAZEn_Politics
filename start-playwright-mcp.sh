#!/bin/bash
# Start Playwright MCP server for amaze-politics project
# This script starts the Playwright MCP server on port 3050

echo "🎭 Starting Playwright MCP server for amaze-politics..."
echo "📡 Server will be available at: http://localhost:3050/mcp"
echo "🔧 MCP config is in .mcp.json"
echo ""

npx @playwright/mcp --port 3050 --headless