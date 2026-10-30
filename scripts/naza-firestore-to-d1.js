// ย้ายข้อมูลระบบจอง NAZA ที่เคยอยู่ใน Firestore → Cloudflare D1 (ใช้ครั้งเดียวตอนย้าย)
//
//   node scripts/naza-firestore-to-d1.js /path/to/service-account.json > naza-import.sql
//   npx wrangler d1 execute ummatee --remote --file naza-import.sql
//
// อ่านด้วย service account เดียวกับตัวสำรองข้อมูล (role Cloud Datastore Viewer) — ไม่ผ่าน firestore.rules
// ใช้ INSERT OR IGNORE: รันซ้ำได้ ไม่ทับข้อมูลที่จองผ่าน Cloudflare ไปแล้ว
// สลิปของการจองเก่ายังอยู่ที่ Cloudinary (เก็บลิงก์ไว้ใน slip_url — หน้าแอดมินเปิดได้เหมือนเดิม)
import { readFileSync } from 'node:fs'
import { getAccessToken, listCollection } from '../cloudflare/backup-worker/src/index.js'
import { toSql } from './naza-import-sql.js'

const saPath = process.argv[2]
if (!saPath) { console.error('ใช้: node scripts/naza-firestore-to-d1.js <service-account.json>'); process.exit(1) }
const sa = JSON.parse(readFileSync(saPath, 'utf8'))
const project = sa.project_id || 'ummatee-app'

const token = await getAccessToken(sa)
const [bookings, configs] = await Promise.all([
  listCollection(fetch, token, project, 'nazaBookings'),
  listCollection(fetch, token, project, 'config'),
])

console.log(toSql(bookings, configs))
const cfg = configs.find((c) => c.id === 'nazaEvent')
console.error(`การจอง ${bookings.length} รายการ${cfg ? ' + ค่าตั้งงาน' : ''} → SQL พร้อมแล้ว`)
