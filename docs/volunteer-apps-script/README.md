# Apps Script — โปรเจกต์แจ้งเตือน/ลงทะเบียน (Ummatee)

**ไฟล์เดียว: `Code.gs`** (เคยลองแยกเป็น 7 ไฟล์ แล้วรวมกลับ เพราะตอน deploy ต้องวางทีละไฟล์เอง พลาดง่าย)

ข้างในแบ่งเป็น 7 ส่วนตามหัวข้อ `══` เลื่อนหาได้:
ตั้งค่า · ตัวรับ request · แจ้งเตือนแอดมิน · LINE หาลูกค้า · อาสาสมัคร · B2UM · Iftar

## วิธี deploy

1. เปิด https://script.google.com → โปรเจกต์ที่ผูกกับ `VOLUNTEER_ENDPOINT` (ดู `src/utils/endpoints.js`)
2. เปิดไฟล์ `Code.gs` → เลือกทั้งหมด (Ctrl/Cmd+A) → วางเนื้อหาใหม่ทับ
   ถ้ามีไฟล์ `.gs` อื่นค้างอยู่ให้ลบทิ้ง ไม่งั้นฟังก์ชันชื่อซ้ำจะทับกัน
3. **Deploy → Manage deployments → แก้ deployment เดิม** (อย่าสร้างใหม่ ไม่งั้น URL เปลี่ยน แล้วเว็บยิงไปที่เดิมไม่เจอ)
4. ตั้ง **Execute as: Me** และ **Who has access: Anyone**
5. Deploy

## ตรวจว่า deploy สำเร็จจริง

เปิด URL ของ Web App ตรงๆ ในเบราว์เซอร์ (ไม่ส่งอีเมลใดๆ) ต้องได้ JSON:

```json
{"ok":true,"version":"2026-07-31.3","handlers":["adminNotify","orderCreated","lineNotify","volunteer","b2um","(default) iftar"]}
```

- ได้ **HTML หน้า login ของ Google** → ข้อ 4 ยังไม่ได้ตั้ง "Anyone"
- ได้ **405 / หน้า error** → deployment ยังชี้ไปสคริปต์เก่าที่ไม่มี `doPost`
- `version` ไม่ตรงกับ `SCRIPT_VERSION` ใน `Code.gs` → ยังไม่ได้กด Deploy ทับ

> ขยับ `SCRIPT_VERSION` ทุกครั้งที่แก้แล้ว deploy ใหม่ จะได้รู้ทันทีว่าโค้ดที่รันอยู่เป็นชุดล่าสุดหรือยัง

## ไฟล์ Google Sheet ที่สคริปต์เขียนลง

| ตัวแปรใน `Code.gs` | ใช้กับ | ชีตที่เขียน |
|---|---|---|
| `ORDERS_SHEET_ID` | คำสั่งซื้อ um-shop | `Orders` |
| `VOLUNTEER_SHEET_ID` | อาสาสมัคร / B2UM | `Volunteer`, `B2UM` |
| (ไฟล์ที่ผูกกับสคริปต์) | Iftar For Gaza | `Registrations` |

บัญชีที่ตั้งไว้ใน **Execute as** ต้องมีสิทธิ์ **แก้ไข** ไฟล์เหล่านี้ ไม่งั้น `openById` จะ error
(ระบบจับ error ไว้ — อีเมลยังส่งตามปกติ แต่จะได้ `sheetLogged:false` กลับมา)

## Script Properties ที่ต้องตั้ง (ถ้าจะใช้ LINE)

| ชื่อ | ใช้ทำอะไร |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | ส่ง LINE ทั้งหาแอดมินและหาลูกค้า |
| `ADMIN_LINE_USER_ID` | userId ของแอดมิน/กลุ่มที่ให้บอทแจ้งเตือน |

ไม่ตั้งก็ใช้งานได้ — อีเมลยังส่งตามปกติ ส่วน LINE จะข้ามไปเฉยๆ
