#!/bin/bash
# ZX-CRM Backend — AWS EC2 Deploy Script
# Run on the EC2 server: bash deploy.sh

set -e

echo "━━━ [1/6] Pulling latest code ━━━"
git pull origin main

echo "━━━ [2/6] Installing dependencies ━━━"
npm install --omit=dev

echo "━━━ [3/6] Generating Prisma client ━━━"
npx prisma generate

echo "━━━ [4/6] Pushing schema to database ━━━"
npx prisma db push

echo "━━━ [5/6] Ensuring log directory exists ━━━"
sudo mkdir -p /var/log/zx-crm
sudo chown ubuntu:ubuntu /var/log/zx-crm

echo "━━━ [6/6] Restarting server (PM2) ━━━"
pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js
pm2 save

echo ""
echo "✓ Deploy complete. Server status:"
pm2 status zx-crm-backend
