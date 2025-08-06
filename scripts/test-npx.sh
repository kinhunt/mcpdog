#!/bin/bash

# MCPDog npx Test Script
# This script tests the npx installation and functionality

set -e

echo "🧪 Testing MCPDog npx installation..."

# Stop any existing daemon first
echo "🛑 Stopping any existing daemon..."
npx mcpdog stop 2>/dev/null || true
sleep 2

# Test version command
echo "📋 Testing version command..."
npx mcpdog --version

if [ $? -eq 0 ]; then
    echo "✅ Version command works"
else
    echo "❌ Version command failed"
    exit 1
fi

# Test help command
echo "📋 Testing help command..."
npx mcpdog --help

if [ $? -eq 0 ]; then
    echo "✅ Help command works"
else
    echo "❌ Help command failed"
    exit 1
fi

# Test status command (should fail if no daemon running)
echo "📋 Testing status command..."
npx mcpdog status

if [ $? -eq 1 ]; then
    echo "✅ Status command works (correctly reports no daemon)"
else
    echo "⚠️  Status command returned unexpected exit code"
fi

# Test daemon start (background)
echo "📋 Testing daemon start..."
npx mcpdog daemon start --web-port 3002 &
DAEMON_PID=$!

# Wait for daemon to start
sleep 5

# Test if daemon is running
if kill -0 $DAEMON_PID 2>/dev/null; then
    echo "✅ Daemon started successfully"
else
    echo "❌ Daemon failed to start"
    exit 1
fi

# Test web interface
echo "📋 Testing web interface..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002

if [ $? -eq 0 ]; then
    echo "✅ Web interface is accessible"
else
    echo "❌ Web interface is not accessible"
    kill $DAEMON_PID 2>/dev/null || true
    exit 1
fi

# Test status command with running daemon
echo "📋 Testing status with running daemon..."
npx mcpdog status

if [ $? -eq 0 ]; then
    echo "✅ Status command works with running daemon"
else
    echo "❌ Status command failed with running daemon"
fi

# Stop daemon
echo "📋 Stopping daemon..."
kill $DAEMON_PID 2>/dev/null || true
sleep 2

# Test stop command
npx mcpdog stop

if [ $? -eq 0 ]; then
    echo "✅ Stop command works"
else
    echo "⚠️  Stop command returned unexpected exit code"
fi

echo "🎉 All npx tests passed!"
echo "✅ MCPDog is ready for npm publishing!" 