#!/usr/bin/env bash
# Build (Vite + React) แล้ว deploy ขึ้น Firebase Hosting
set -e

MSG="${1:-อัพเดทเว็บ Ummatee}"

echo "📦 ติดตั้ง dependencies (ถ้ายังไม่มี)..."
[ -d node_modules ] || npm install

echo "🔨 build เว็บด้วย Vite..."
npm run build

echo "🚀 deploy ขึ้น Firebase Hosting (project: ummatee-app)..."
npx firebase-tools deploy --only hosting --message "$MSG"

echo ""
echo "✅ Deploy สำเร็จ!"
echo "🌐 https://ummatee-app.web.app"
