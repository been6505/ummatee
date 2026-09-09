// ค่าตั้งต้นสำหรับเชื่อมต่อ Google Drive / Docs / Picker
//
// ══════════════════════════════════════════════════════════════════════════
// วิธีขอค่าพวกนี้ (ทำครั้งเดียว) — ต้องล็อกอินบัญชี Google ของมูลนิธิ
// ══════════════════════════════════════════════════════════════════════════
// 1) เข้า https://console.cloud.google.com เลือกโปรเจกต์ "ummatee-app" (โปรเจกต์เดียวกับ Firebase)
//
// 2) เปิด API 2 ตัว ที่ APIs & Services → Library แล้วกด Enable:
//      - Google Drive API
//      - Google Picker API
//
// 3) สร้าง API key ที่ APIs & Services → Credentials → Create credentials → API key
//    แล้วกด Edit key เพื่อจำกัดการใช้งาน (สำคัญ ไม่งั้นใครก็เอา key ไปใช้ได้):
//      - Application restrictions → Websites → ใส่ https://ummatee-app.web.app/*
//        และ http://localhost:4323/* (สำหรับทดสอบตอน dev)
//      - API restrictions → Restrict key → เลือกเฉพาะ Google Drive API + Google Picker API
//    → เอาค่ามาใส่ GOOGLE_API_KEY ด้านล่าง
//
// 4) สร้าง OAuth client ที่ Credentials → Create credentials → OAuth client ID
//      - Application type: Web application
//      - Authorized JavaScript origins: https://ummatee-app.web.app และ http://localhost:4323
//    → เอา "Client ID" (ลงท้าย .apps.googleusercontent.com) มาใส่ GOOGLE_CLIENT_ID ด้านล่าง
//      (ไม่ต้องใช้ Client secret — ฝั่งเบราว์เซอร์ไม่ใช้และห้ามใส่ไว้ในโค้ดเด็ดขาด)
//
// 5) ที่ APIs & Services → OAuth consent screen ใส่ชื่อแอป/อีเมลติดต่อ แล้วเพิ่มอีเมลของทีม
//    ในหัวข้อ Test users (ถ้ายังไม่ publish) ไม่งั้นจะขึ้น error ตอนกดอนุญาต
// ══════════════════════════════════════════════════════════════════════════
//
// ทั้ง 2 ค่านี้ "ไม่ใช่ความลับ" — ออกแบบมาให้เปิดเผยในเบราว์เซอร์ได้ (เหมือน Firebase config)
// ตัวป้องกันคือการจำกัดโดเมนในข้อ 3/4 ไม่ใช่การซ่อนค่า จึงใส่ในโค้ดที่ commit ได้ตามปกติ
//
// ปล่อยว่างไว้ = ปิดฟีเจอร์ Drive/Docs ทั้งหมด (ปุ่มจะซ่อน + ขึ้นข้อความบอกว่ายังไม่ได้ตั้งค่า)
// ระบบส่วนอื่นทำงานปกติทุกอย่าง
export const GOOGLE_CLIENT_ID = ''
export const GOOGLE_API_KEY = ''

// สิทธิ์ที่ขอจากผู้ใช้ — ขอเท่าที่จำเป็นเท่านั้น
//   drive.file     = สร้าง/แก้ไฟล์ที่แอปนี้สร้างเองหรือผู้ใช้เลือกผ่าน Picker (ใช้ตอนสร้าง Doc จดบันทึก)
//   drive.readonly = อ่านรายชื่อไฟล์ใน Drive เพื่อให้เลือกผ่าน Picker ได้
// ไม่ขอ scope "drive" แบบเต็ม (แก้/ลบได้ทุกไฟล์) เพราะเกินความจำเป็นของงานนี้
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

export const isGoogleConfigured = () => !!GOOGLE_CLIENT_ID && !!GOOGLE_API_KEY
