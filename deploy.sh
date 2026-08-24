#!/usr/bin/env bash
# Build (Vite + React) แล้ว deploy ขึ้น Firebase Hosting + Firestore/Storage rules
set -e

MSG="${1:-อัพเดทเว็บ Ummatee}"

echo "📦 ติดตั้ง dependencies (ถ้ายังไม่มี)..."
[ -d node_modules ] || npm install

echo "🔨 build เว็บด้วย Vite..."
npm run build

echo "🚀 deploy ขึ้น Firebase Hosting + Firestore rules (project: ummatee-app)..."
# deploy ทั้ง hosting และ firestore:rules พร้อมกัน — firestore.rules จะ sync กับที่ใช้จริงเสมอ
#
# ไม่รวม storage:rules เพราะโปรเจกต์ ummatee-app ยังไม่ได้เปิดใช้ Firebase Storage (ไฟล์อัปโหลด
# ทั้งเว็บใช้ Cloudinary) ใส่ไว้แล้ว firebase จะ error ทั้งชุดจน hosting ไม่ได้ deploy ตามไปด้วย
# ถ้าวันไหนเปิด Storage ที่ Firebase Console แล้ว ค่อยเติม ,storage:rules กลับเข้าไป
npx firebase-tools deploy --only hosting,firestore:rules --message "$MSG"

echo ""
echo "✅ Deploy สำเร็จ!"
echo "🌐 https://ummatee-app.web.app"
