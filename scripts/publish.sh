#!/bin/bash

# MCPDog Publish Script
# This script automates the publishing process for MCPDog

set -e

echo "🚀 Starting MCPDog publish process..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if we have uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Warning: You have uncommitted changes. Please commit or stash them before publishing."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"

# Build the project
echo "🔨 Building project..."
npm run build

# Check if build was successful
if [ ! -f "dist/cli/cli-main.js" ]; then
    echo "❌ Error: Build failed. dist/cli/cli-main.js not found."
    exit 1
fi

if [ ! -f "web/dist/index.html" ]; then
    echo "❌ Error: Web build failed. web/dist/index.html not found."
    exit 1
fi

echo "✅ Build completed successfully"

# Test the build locally
echo "🧪 Testing build locally..."
npm link
mcpdog --version

# Check if test was successful
if [ $? -eq 0 ]; then
    echo "✅ Local test passed"
else
    echo "❌ Error: Local test failed"
    exit 1
fi

# Unlink to avoid conflicts
npm unlink

# Check if we're logged into npm
if ! npm whoami > /dev/null 2>&1; then
    echo "❌ Error: Not logged into npm. Please run 'npm login' first."
    exit 1
fi

# Show what will be published
echo "📋 Files to be published:"
npm pack --dry-run

# Confirm before publishing
read -p "Ready to publish version $CURRENT_VERSION? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Publishing cancelled."
    exit 1
fi

# Publish to npm
echo "🚀 Publishing to npm..."
npm publish

if [ $? -eq 0 ]; then
    echo "✅ Successfully published MCPDog v$CURRENT_VERSION to npm!"
    echo "📦 Package: https://www.npmjs.com/package/mcpdog"
    echo "🔗 Install: npm install -g mcpdog"
    echo "⚡ Quick start: npx mcpdog --version"
else
    echo "❌ Error: Publishing failed."
    exit 1
fi

echo "🎉 Publish process completed!" 