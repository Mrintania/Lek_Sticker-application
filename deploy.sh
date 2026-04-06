#!/bin/bash
set -e

EC2_HOST="ubuntu@ec2-43-208-15-18.ap-southeast-7.compute.amazonaws.com"
EC2_KEY="MacOS-Babylony-Leksticker.pem"
EC2_PATH="/home/ubuntu/lek_sticker"
APP_NAME="lek-sticker"

echo "==> Build locally..."
npm run build

echo "==> Copy .next to EC2..."
scp -i "$EC2_KEY" -r .next "$EC2_HOST:$EC2_PATH/"

echo "==> Copy package.json to EC2..."
scp -i "$EC2_KEY" package.json package-lock.json "$EC2_HOST:$EC2_PATH/"

echo "==> Copy attendance.db to EC2 (skip if exists)..."
ssh -i "$EC2_KEY" "$EC2_HOST" "[ -f $EC2_PATH/attendance.db ] && echo 'DB already exists, skipping.' || echo 'DB not found on EC2.'"

echo "==> Install production deps and restart app..."
ssh -i "$EC2_KEY" "$EC2_HOST" "cd $EC2_PATH && npm install --omit=dev && pm2 restart $APP_NAME || pm2 start npm --name $APP_NAME -- start && pm2 save"

echo "==> Deploy complete!"
