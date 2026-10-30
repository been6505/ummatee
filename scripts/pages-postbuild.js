// หลัง build สำหรับ Cloudflare Pages — ลบไฟล์ที่ไม่ควรขึ้นเว็บออกจาก dist/
// ต้องตรงกับ hosting.ignore ใน firebase.json (Firebase Hosting ข้ามโฟลเดอร์นี้อยู่แล้ว แต่ Pages เผยแพร่ทุกอย่างใน dist/)
import { rmSync, existsSync } from 'node:fs'

const EXCLUDE = ['dist/Sales 10_ OFF']
for (const p of EXCLUDE) {
  if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); console.log('ลบออกจาก build:', p) }
}
