# ย้ายไป Cloudflare

## สถานะการย้าย

| ส่วน | อยู่ที่ | หมายเหตุ |
|---|---|---|
| โฮสต์เว็บ | **Cloudflare Pages** | merge เข้า `main` แล้วขึ้นเอง |
| ระบบจองตั๋ว NAZA (การจอง/ที่นั่ง/ค่าตั้งงาน) | **Cloudflare D1** | API ใน `functions/api/naza`, `functions/api/admin` |
| สลิปโอนเงินของ NAZA | **Cloudflare R2** (ส่วนตัว) | เปิดได้เฉพาะแอดมิน ไม่มี URL สาธารณะแล้ว |
| ล็อกอินแอดมิน NAZA | **Cloudflare Access** (Google) | |
| สำรองข้อมูล | **Cloudflare Worker** → Google Sheets | ทั้ง Firestore และ D1 ทุก 3 ชม. |
| อีเมลแจ้งลูกค้า | Google Apps Script (Gmail) | Cloudflare ส่งอีเมลหาลูกค้าทั่วไปเองไม่ได้ |
| ส่วนอื่นทั้งหมด (ร้านค้า, บริจาค, แอดมินส่วนอื่น ฯลฯ) | Firebase (Firestore + Auth) | ย้ายในเฟสถัดไป |

> ⚠️ ทุกขั้นทำด้วยบัญชีของมูลนิธิ — **ห้ามส่ง key/รหัสผ่าน/token ทางแชท**

---

## ขั้น 1 — สร้างฐานข้อมูล D1 + ที่เก็บสลิป R2 (บนเครื่อง Mac)

```bash
npx wrangler login
npx wrangler d1 create ummatee
```
คัดลอก `database_id` ที่ได้ ไปใส่แทน `00000000-...` ใน **2 ไฟล์**: `wrangler.toml` (รากโปรเจกต์) และ `cloudflare/backup-worker/wrangler.toml`

```bash
npx wrangler d1 migrations apply ummatee --remote
npx wrangler r2 bucket create ummatee-slips
```

## ขั้น 2 — Cloudflare Pages (โฮสต์เว็บ + API)

1. https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → repo `been6505/ummatee`
2. ตั้งค่า build:

   | ช่อง | ค่า |
   |---|---|
   | Production branch | `main` |
   | Build command | `npm run build:pages` |
   | Build output directory | `dist` |
   | Environment variable | `NODE_VERSION` = `20` |

3. **Save and Deploy** → ได้ `https://<ชื่อโปรเจกต์>.pages.dev`
4. (แนะนำ) **Custom domains** ใส่โดเมนของมูลนิธิ — Cloudflare Access (ขั้น 3) ทำงานกับโดเมนที่อยู่ใน Cloudflare

D1/R2 ผูกให้อัตโนมัติจาก `wrangler.toml` (binding `DB`, `SLIPS`) ไม่ต้องตั้งในหน้าเว็บ

## ขั้น 3 — Cloudflare Access (ล็อกอินแอดมินด้วย Google)

1. dashboard → **Zero Trust** (ครั้งแรกจะให้ตั้งชื่อทีม เช่น `ummatee` → ได้ `ummatee.cloudflareaccess.com`) เลือกแผน Free (ฟรีถึง 50 คน)
2. **Settings → Authentication → Login methods → Add new → Google** (ทำตามขั้นตอนในหน้านั้น: สร้าง OAuth client ใน Google Cloud แล้วใส่ Client ID/Secret)
3. **Access → Applications → Add an application → Self-hosted**
   - Application domain: `<โดเมนเว็บ>` path `admin` **และ** เพิ่มอีกบรรทัด path `api/admin`
   - Policy: Allow → Include → Emails → ใส่อีเมลแอดมิน/staff ที่ดูแลงาน NAZA
4. เปิดหน้า Application ที่สร้าง → คัดลอก **Application Audience (AUD) Tag**
5. แก้ `wrangler.toml` (รากโปรเจกต์):
   - `ACCESS_TEAM` = ชื่อทีม (เช่น `ummatee`)
   - `ACCESS_AUD` = AUD Tag
   - `ADMIN_EMAILS` = อีเมลชุดเดียวกับ policy (โค้ดตรวจซ้ำอีกชั้น)
6. commit + merge แล้ว Pages จะ deploy ใหม่เอง

> โดเมน `*.pages.dev` ไม่ได้อยู่หลัง Access — ตรงนั้น API แอดมินจะตอบ 401 เสมอ (โค้ดตรวจ token เอง) ให้แอดมินเข้าผ่านโดเมนหลักเท่านั้น

## ขั้น 4 — อีเมล (Apps Script)

1. เปิด `docs/volunteer-apps-script/Code.gs` แก้ `NAZA_SITE` เป็นโดเมนเว็บจริง (บรรทัด `var NAZA_SITE = ...`)
2. วางทับใน Apps Script → **Deploy → Manage deployments → แก้ deployment เดิม**
3. ถ้ายังไม่เคย: รันฟังก์ชัน `nazaInstallReminderTrigger` หนึ่งครั้ง (อีเมลเตือนก่อนวันงาน)

เว็บสั่งส่งอีเมลจากฝั่งเซิร์ฟเวอร์ (`EMAIL_SCRIPT_URL` ใน `wrangler.toml`) — สคริปต์อ่านการจองจาก `/api/naza/bookings/:id` เอง

## ขั้น 5 — ย้ายการจองเก่าจาก Firestore (ทำเฉพาะถ้าเคยเปิดจองบนระบบเดิมแล้ว)

ต้องมี service account จากขั้น 6.1 ก่อน
```bash
node scripts/naza-firestore-to-d1.js /path/to/service-account.json > naza-import.sql
npx wrangler d1 execute ummatee --remote --file naza-import.sql
```
รันซ้ำได้ ไม่ทับการจองใหม่ — สลิปของการจองเก่ายังเปิดได้ (ลิงก์ Cloudinary เดิม)

## ขั้น 6 — Worker สำรองข้อมูลลง Google Sheets

### 6.1 service account (Google Cloud Console โปรเจกต์ `ummatee-app`)
1. **IAM & Admin → Service Accounts → Create** ชื่อ `sheets-backup` → role **Cloud Datastore Viewer**
2. **Keys → Add key → JSON** (เก็บไฟล์ให้ดี ห้ามขึ้น git)
3. **APIs & Services → Library** → เปิด **Google Sheets API**

### 6.2 Google Sheet ปลายทาง
สร้างชีตเปล่า → **Share** ให้อีเมล service account เป็น **Editor** → คัดลอก id จาก URL (`/d/<id>/edit`)
ชีตมีข้อมูลส่วนตัว — **อย่าแชร์แบบ "ทุกคนที่มีลิงก์"**

### 6.3 deploy
```bash
cd cloudflare/backup-worker
# แก้ BACKUP_SHEET_ID และ database_id ใน wrangler.toml แล้ว:
npx wrangler secret put GCP_SA_KEY < /path/to/service-account.json
npx wrangler secret put BACKUP_RUN_KEY   # (ไม่บังคับ) รหัสสั่งสำรองทันที
npx wrangler deploy
```
ทดสอบ: `https://ummatee-backup.<บัญชี>.workers.dev/run?key=<BACKUP_RUN_KEY>` → ชีตมีแท็บ `_backup`, `d1_naza_bookings`, `orders` ฯลฯ

---

## ทดสอบในเครื่องก่อนขึ้นจริง

```bash
npm run build:pages
npx wrangler d1 migrations apply ummatee --local
npx wrangler pages dev dist --binding DEV_ADMIN_EMAIL=you@gmail.com --binding EMAIL_SCRIPT_URL=
```
เปิด http://127.0.0.1:8788/events/Naza และ /admin/events/naza (`DEV_ADMIN_EMAIL` ใช้ได้เฉพาะ localhost)

## หมายเหตุ

- `firestore.rules` ยังต้อง deploy เองเมื่อแก้: `npx firebase-tools deploy --only firestore:rules`
- เว็บบน `ummatee-app.web.app` (Firebase Hosting) จองตั๋ว NAZA ไม่ได้แล้ว (ไม่มี API) — ให้ประกาศลิงก์โดเมนใหม่
  หรือถ้าต้องเปิดคู่กันชั่วคราว: build ฝั่ง Firebase ด้วย `VITE_API_BASE=https://<โดเมนใหม่> ./deploy.sh` (หน้าจองใช้ได้ หน้าแอดมินไม่ได้)
- โฟลเดอร์ `firebase-functions/` คือ Cloud Functions เดิมที่ไม่เคย deploy ได้ (แผน Spark) — ย้ายชื่อเพราะ `functions/` เป็นของ Cloudflare
- ค่าใช้จ่าย: Pages, Workers, D1, R2, Access แผนฟรีพอสำหรับเว็บนี้
