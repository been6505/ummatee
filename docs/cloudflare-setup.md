# ย้ายโฮสต์ไป Cloudflare + สำรองข้อมูลลง Google Sheets

ทำเป็น 3 ขั้น — **ฐานข้อมูลยังอยู่ Firestore เหมือนเดิม** (ไม่ต้องย้ายข้อมูล ไม่มีอะไรหาย)
Firebase Hosting (`ummatee-app.web.app`) ยังเปิดอยู่คู่กันจนกว่าจะตัดสินใจปิด

| ขั้น | ได้อะไร | ใช้เวลา |
|---|---|---|
| 1. เว็บขึ้น Cloudflare Pages | merge เข้า `main` แล้วเว็บขึ้นเอง ไม่ต้องรัน `deploy.sh` | ~15 นาที |
| 2. อนุญาตโดเมนใหม่ใน Firebase/Google | ล็อกอินแอดมิน, App Check, Google Drive ใช้ได้บนโดเมนใหม่ | ~10 นาที |
| 3. Worker สำรองข้อมูลทุก 3 ชม. | Google Sheet ที่มีสำเนาการจอง/ออเดอร์/อาสาสมัคร ฯลฯ ล่าสุด | ~20 นาที |

> ⚠️ ทุกขั้นทำในหน้าเว็บของ Cloudflare / Google ด้วยบัญชีของมูลนิธิ — **ห้ามส่ง key/รหัสผ่านทางแชท**

---

## ขั้น 1 — Cloudflare Pages (โฮสต์เว็บ)

1. สมัคร/ล็อกอิน https://dash.cloudflare.com
2. **Workers & Pages → Create → Pages → Connect to Git** → เชื่อม GitHub แล้วเลือก repo `been6505/ummatee`
3. ตั้งค่า build:

   | ช่อง | ค่า |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build:pages` |
   | Build output directory | `dist` |
   | Environment variable | `NODE_VERSION` = `20` |
   | Environment variable (ถ้าเปิดแจ้งเตือน push) | `VITE_FCM_VAPID_KEY` = ค่าเดียวกับใน `.env.local` |

4. กด **Save and Deploy** — ได้ URL แบบ `https://ummatee.pages.dev`
5. (ถ้ามีโดเมนของตัวเอง) แท็บ **Custom domains → Set up a domain**

สิ่งที่ตั้งไว้ในโค้ดแล้ว:
- `public/_headers` — หัวความปลอดภัย (CSP ฯลฯ) และการแคช ชุดเดียวกับ `firebase.json` (มีเทสต์เทียบให้)
- `npm run build:pages` — build แล้วลบโฟลเดอร์ `Sales 10_ OFF` (Firebase ข้ามโฟลเดอร์นี้อยู่แล้ว)
- เส้นทางแบบ SPA (`/events/Naza`, `/admin/...`) — Pages ส่ง `index.html` ให้อัตโนมัติ

ทุกครั้งที่ merge เข้า `main` Cloudflare จะ build + ขึ้นเว็บเอง และ PR ทุกอันได้ลิงก์พรีวิวของตัวเอง

> **firestore.rules ยังต้อง deploy เองเมื่อมีการแก้** (Cloudflare ไม่รู้จัก Firebase):
> `npx firebase-tools deploy --only firestore:rules`

## ขั้น 2 — อนุญาตโดเมนใหม่ (ไม่ทำ = ล็อกอิน/บันทึกข้อมูลบนโดเมนใหม่ไม่ได้)

ใส่โดเมนใหม่ (เช่น `ummatee.pages.dev` และโดเมนของตัวเองถ้ามี) ใน 4 ที่:

1. **Firebase Console → Authentication → Settings → Authorized domains → Add domain**
   (ไม่ทำ = ปุ่มล็อกอิน Google ของแอดมินขึ้น error `auth/unauthorized-domain`)
2. **reCAPTCHA (App Check)** — https://www.google.com/recaptcha/admin → site key ที่ใช้ใน `src/firebase.js` → Domains → เพิ่มโดเมน
   (ไม่ทำ = App Check ไม่ผ่าน ถ้าเปิดบังคับไว้ Firestore จะปฏิเสธทุกคำขอจากโดเมนใหม่)
3. **Google Cloud Console → APIs & Services → Credentials** (โปรเจกต์ `ummatee-app`)
   - API key ของ Google Drive/Picker → Website restrictions → เพิ่ม `https://<โดเมนใหม่>/*`
   - OAuth client (Web) → Authorized JavaScript origins → เพิ่ม `https://<โดเมนใหม่>`
4. **Cloudinary** — ถ้าตั้งจำกัดโดเมนไว้ที่ upload preset `Ummatee` ให้เพิ่มโดเมนใหม่

ลิงก์ในอีเมล (Apps Script) ยังชี้ `ummatee-app.web.app` — ใช้ได้ตามปกติตราบที่ Firebase Hosting ยังเปิด
ถ้าจะย้ายถาวรค่อยเปลี่ยน `NAZA_SITE` ใน `docs/volunteer-apps-script/Code.gs`

## ขั้น 3 — Worker สำรองข้อมูลลง Google Sheets

Worker อยู่ที่ `cloudflare/backup-worker/` — ทุก 3 ชั่วโมง อ่าน Firestore แล้วเขียนลงชีต แท็บละ 1 collection
(รายการอยู่ใน `BACKUP_COLLECTIONS` ใน `src/lib.js`) + แท็บ `_backup` บอกเวลาสำรองล่าสุดและ collection ที่ล้ม
**ไม่สำรอง** token ลับ (`socialAccounts`, `pushTokens`) และแชท

### 3.1 สร้าง service account (Google Cloud Console โปรเจกต์ `ummatee-app`)
1. **IAM & Admin → Service Accounts → Create** ชื่อ `sheets-backup`
2. ให้ role **Cloud Datastore Viewer** (อ่าน Firestore ได้อย่างเดียว แก้/ลบไม่ได้)
3. เปิดบัญชีที่สร้าง → **Keys → Add key → JSON** → ได้ไฟล์ `.json` (เก็บให้ดี ห้ามขึ้น git ห้ามส่งแชท)
4. **APIs & Services → Library** → เปิด **Google Sheets API**

### 3.2 สร้าง Google Sheet ปลายทาง
1. สร้างชีตเปล่าในบัญชีมูลนิธิ ตั้งชื่อเช่น `Ummatee Backup`
2. **Share** ให้อีเมลของ service account (ลงท้าย `@ummatee-app.iam.gserviceaccount.com`) สิทธิ์ **Editor**
3. คัดลอก id จาก URL: `https://docs.google.com/spreadsheets/d/`**`<id>`**`/edit`
4. ชีตนี้มีข้อมูลส่วนตัว (ชื่อ/เบอร์/อีเมล) — **อย่าแชร์แบบ "ทุกคนที่มีลิงก์"**

### 3.3 Deploy Worker (บนเครื่อง Mac)
```bash
cd cloudflare/backup-worker
npx wrangler login                      # เปิดเบราว์เซอร์ให้ล็อกอิน Cloudflare
# แก้ BACKUP_SHEET_ID ใน wrangler.toml เป็น id จากข้อ 3.2 แล้ว:
npx wrangler secret put GCP_SA_KEY < /path/to/service-account.json
npx wrangler secret put BACKUP_RUN_KEY  # (ไม่บังคับ) ตั้งรหัสสำหรับสั่งสำรองทันที
npx wrangler deploy
```

### 3.4 ทดสอบ
- สั่งสำรองทันที: เปิด `https://ummatee-backup.<บัญชี>.workers.dev/run?key=<BACKUP_RUN_KEY>`
  ได้ `{"ok":true,...}` แล้วเปิดชีตดู แท็บ `_backup` ต้องมีเวลาล่าสุด
- หรือใน Cloudflare dashboard → Workers → `ummatee-backup` → Triggers → รัน cron
- `"ok":false` → ดูคอลัมน์ "ข้อผิดพลาด" ในแท็บ `_backup` (ส่วนใหญ่คือยังไม่ได้ให้ role/ยังไม่ได้แชร์ชีต)

ค่าใช้จ่าย: Pages และ Workers แผนฟรีพอสำหรับเว็บนี้ (Workers ฟรี 100,000 ครั้ง/วัน — Worker นี้รันวันละ 8 ครั้ง)
