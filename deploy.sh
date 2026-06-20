#!/usr/bin/env bash
# Build (Vite + React) แล้ว deploy ขึ้น Firebase Hosting + Firestore rules
set -e

MSG="${1:-อัพเดทเว็บ Ummatee}"

echo "📦 ติดตั้ง dependencies (ถ้ายังไม่มี)..."
[ -d node_modules ] || npm install

echo "🔨 build เว็บด้วย Vite..."
npm run build

echo "🚀 deploy ขึ้น Firebase Hosting + Firestore rules (project: ummatee-app)..."
# deploy ทั้ง hosting และ firestore:rules พร้อมกัน — rules (firestore.rules) จะ sync กับที่ใช้จริงเสมอ
npx firebase-tools deploy --only hosting,firestore:rules --message "$MSG"

echo ""
echo "✅ Deploy สำเร็จ!"
echo "🌐 https://ummatee-app.web.app"
