#!/usr/bin/env bash
# Build (Vite + React) แล้ว deploy ขึ้น Firebase Hosting + Firestore/Storage rules
set -e

MSG="${1:-อัพเดทเว็บ Ummatee}"

echo "📦 ติดตั้ง dependencies (ถ้ายังไม่มี)..."
[ -d node_modules ] || npm install

echo "🔨 build เว็บด้วย Vite..."
npm run build

echo "🚀 deploy ขึ้น Firebase Hosting + Firestore/Storage rules (project: ummatee-app)..."
# deploy ทั้ง hosting, firestore:rules และ storage:rules พร้อมกัน — rules (firestore.rules,
# storage.rules) จะ sync กับที่ใช้จริงเสมอ (เดิม storage.rules ไม่ถูก deploy อัตโนมัติเลย)
npx firebase-tools deploy --only hosting,firestore:rules,storage:rules --message "$MSG"

echo ""
echo "✅ Deploy สำเร็จ!"
echo "🌐 https://ummatee-app.web.app"
