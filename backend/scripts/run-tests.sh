#!/bin/bash

set -e

echo "🧪 Running UITrace Backend Tests with Browser Execution"
echo "=================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if required services are running
echo "🔍 Checking test services..."

# Start test services if not running
if ! docker ps | grep -q "postgres-test"; then
    echo "📦 Starting test services..."
    docker-compose -f docker-compose.test.yml up -d
    echo "⏳ Waiting for services to be ready..."
    sleep 10
fi

# Run tests
echo "🚀 Running tests..."
NODE_ENV=test npm test

# Cleanup
echo "🧹 Cleaning up test services..."
docker-compose -f docker-compose.test.yml down

echo "✅ Tests completed!"