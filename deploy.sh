#!/bin/bash
set -e

echo "=== Deploying Prism CRM ==="

# Navigate to app directory
cd /var/www/crm

# Pull latest code
echo "Pulling latest code..."
git -c safe.directory=/var/www/crm pull origin main

# Install dependencies
echo "Installing dependencies..."
npm install

# Run database migrations (use local prisma to avoid version mismatch)
echo "Running database migrations..."
npx prisma@5 migrate deploy

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma@5 generate

# One-time baseline for existing DBs created before migrations were added.
HAS_MIGRATIONS_TABLE=$(sqlite3 prisma/dev.db "SELECT name FROM sqlite_master WHERE type='table' AND name='_prisma_migrations';")
HAS_DEAL_TABLE=$(sqlite3 prisma/dev.db "SELECT name FROM sqlite_master WHERE type='table' AND name='Deal';")
if [ -z "$HAS_MIGRATIONS_TABLE" ] && [ -n "$HAS_DEAL_TABLE" ]; then
  echo "Baselining existing database..."
  npx prisma@5 migrate resolve --applied 20260316122000_initial_baseline
fi

# Apply Prisma migrations
echo "Applying Prisma migrations..."
npx prisma@5 migrate deploy

# Build frontend
echo "Building frontend..."
npm run build

# Build server
echo "Building server..."
npm run build:server

# Restart service
echo "Restarting service..."
sudo systemctl restart crm

echo "=== Deployment complete ==="
