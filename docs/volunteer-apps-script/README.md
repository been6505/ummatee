# Apps Script — โปรเจกต์แจ้งเตือน/ลงทะเบียน (Ummatee)

แยกจากไฟล์เดียว `Code.gs` (387 บรรทัด รวมทุกงานไว้ใน `doPost` เดียว) เป็นไฟล์ละงาน

| ไฟล์ | หน้าที่ |
|---|---|
| `00_Config.gs` | token, sheet id, เวอร์ชัน, `jsonOut()`, `escapeHtml()` |
| `01_Main.gs` | `doGet` / `doPost` — ตรวจ token แล้วส่งต่อให้ handler (ไม่มี logic ของงานใดงานหนึ่ง) |
| `10_AdminNotify.gs` | แจ้งแอดมิน: ออเดอร์ใหม่ / แจ้งชำระเงิน / สต็อกใกล้หมด → อีเมล + LINE |
| `20_LineNotify.gs` | แจ้งสถานะคำสั่งซื้อไปหาลูกค้าทาง LINE |
| `30_Volunteer.gs` | สมัครอาสาสมัคร + อีเมลยืนยัน (QR) |
| `40_B2um.gs` | ลงทะเบียนร้านค้า B2UM |
| `50_Iftar.gs` | ลงทะเบียน Iftar For Gaza + อีเมลยืนยัน (QR) — เป็น action เริ่มต้นเมื่อไม่ส่ง `type` |

ไฟล์ `.gs` ทุกไฟล์ในโปรเจกต์เดียวกันใช้ global scope ร่วมกันและถูกรวมเป็นสคริปต์เดียวตอนรัน
**ลำดับไฟล์ไม่มีผล** เลขนำหน้ามีไว้ให้คนอ่านเรียงตามลำดับเท่านั้น

## วิธี deploy

1. เปิด https://script.google.com → โปรเจกต์ที่ผูกกับ `VOLUNTEER_ENDPOINT` (ดู `src/utils/endpoints.js`)
2. สร้างไฟล์ให้ครบ 7 ไฟล์ตามชื่อข้างบน แล้ววางเนื้อหาทีละไฟล์
   (ไฟล์เดิมชื่อ `Code.gs` — **ลบทิ้ง** หลังวางครบ ไม่งั้นฟังก์ชันชื่อซ้ำจะทับกัน)
3. **Deploy → Manage deployments → แก้ deployment เดิม** (อย่าสร้างใหม่ ไม่งั้น URL เปลี่ยน แล้วเว็บยิงไปที่เดิมไม่เจอ)
4. ตั้ง **Execute as: Me** และ **Who has access: Anyone**
5. Deploy

## ตรวจว่า deploy สำเร็จจริง

เปิด URL ของ Web App ตรงๆ ในเบราว์เซอร์ (ไม่ส่งอีเมลใดๆ) ต้องได้ JSON หน้าตาแบบนี้:

```json
{"ok":true,"version":"2026-07-31.1","handlers":["adminNotify","lineNotify","volunteer","b2um","(default) iftar"]}
```

- ได้ **HTML หน้า login ของ Google** → ข้อ 4 ยังไม่ได้ตั้ง "Anyone"
- ได้ **405 / หน้า error** → deployment ยังชี้ไปสคริปต์เก่าที่ไม่มี `doPost`
- `version` ไม่ตรงกับ `SCRIPT_VERSION` ใน `00_Config.gs` → ยังไม่ได้กด Deploy ทับ

> ขยับ `SCRIPT_VERSION` ทุกครั้งที่แก้แล้ว deploy ใหม่ จะได้รู้ทันทีว่าโค้ดที่รันอยู่เป็นชุดล่าสุดหรือยัง

## Script Properties ที่ต้องตั้ง (ถ้าจะใช้ LINE)

| ชื่อ | ใช้ทำอะไร |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | ส่ง LINE ทั้งหาแอดมินและหาลูกค้า |
| `ADMIN_LINE_USER_ID` | userId ของแอดมิน/กลุ่มที่ให้บอทแจ้งเตือน |

ไม่ตั้งก็ใช้งานได้ — อีเมลยังส่งตามปกติ ส่วน LINE จะข้ามไปเฉยๆ
