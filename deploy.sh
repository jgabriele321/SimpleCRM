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

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

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
