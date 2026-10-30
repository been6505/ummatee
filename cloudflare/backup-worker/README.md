# ummatee-backup (Cloudflare Worker)

สำรองข้อมูล Firestore ลง Google Sheets ทุก 3 ชั่วโมง — ขั้นตอนตั้งค่าทั้งหมดอยู่ที่ [`docs/cloudflare-setup.md`](../../docs/cloudflare-setup.md) ขั้น 3

- `src/index.js` — ขอ token จาก service account, อ่าน Firestore REST, เขียน Sheets API, ตัวรับ cron + `/run`
- `src/lib.js` — รายการ collection ที่สำรอง (`BACKUP_COLLECTIONS`) + ฟังก์ชันแปลงข้อมูล
- `src/backup.test.js` — เทสต์ (รันพร้อมเทสต์ของเว็บด้วย `npm test` ที่รากโปรเจกต์)
