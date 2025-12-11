#!/bin/bash

echo "Setting up test database..."

# Create test database if it doesn't exist
psql -U postgres -h localhost -c "CREATE DATABASE uitrace_test;" 2>/dev/null || echo "Database already exists"

# Run migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy --preview-feature

# Seed test data if needed
echo "Seeding test data..."
npx prisma db seed 2>/dev/null || echo "No seed script configured"

echo "Test database setup complete!"