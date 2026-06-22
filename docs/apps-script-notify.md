# แจ้งยืนยันการลงทะเบียน Iftar For Gaza (อีเมล)

อีเมลต้องส่งจากฝั่ง server — ที่นี่ใช้ **Google Apps Script** (ตัวเดียวกับที่หน้าลงทะเบียน
POST ข้อมูลเข้าไป) เพราะมีข้อมูลผู้ลงทะเบียนอยู่แล้ว และ `MailApp` ส่งอีเมลได้ฟรี

> ⚠️ โค้ดนี้ต้องเอาไปวางใน **Apps Script Editor** ของบัญชี `ummatee.thailand@gmail.com`
> แล้วกด **Deploy → Manage deployments → Edit → New version** (ใช้ URL เดิม ไม่ต้องเปลี่ยนในเว็บ)

---

## 1) อีเมลยืนยัน (ฟรี ใช้ได้ทันที)

วางฟังก์ชันนี้ลงใน Apps Script:

```javascript
// ส่งอีเมลยืนยันการลงทะเบียน — เรียกหลังจากออกเลข ref และบันทึกแถวลงชีตแล้ว
function sendIftarConfirmation(data, ref) {
  if (!data.email) return; // อีเมลเป็นช่องไม่บังคับ — ส่งเฉพาะคนที่กรอก

  var fullName = ((data.fname || '') + ' ' + (data.lname || '')).trim();
  var subject = 'ยืนยันการลงทะเบียน Iftar For Gaza 2026 — ' + ref;

  var htmlBody =
    '<div style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">' +
      '<div style="background:#1b5e36;color:#fff;padding:24px;text-align:center">' +
        '<h1 style="margin:0;font-size:22px">&#10003; ลงทะเบียนเรียบร้อย</h1>' +
        '<p style="margin:6px 0 0;opacity:.9">Iftar For Gaza 2026</p>' +
      '</div>' +
      '<div style="padding:24px;color:#333;line-height:1.7">' +
        '<p>เรียน คุณ' + fullName + '</p>' +
        '<p>ขอบคุณที่ลงทะเบียนเข้าร่วมงาน <b>Iftar For Gaza 2026</b> เรียบร้อยแล้ว</p>' +
        '<div style="background:#f6f6f4;border-radius:10px;padding:16px;margin:16px 0;text-align:center">' +
          '<div style="font-size:13px;color:#888">รหัสลงทะเบียนของคุณ</div>' +
          '<div style="font-size:26px;font-weight:800;color:#1b5e36;letter-spacing:1px">' + ref + '</div>' +
        '</div>' +
        '<p style="margin:0 0 4px"><b>&#128197; วัน-เวลา:</b> ศุกร์ 26 มิถุนายน 2569 · 15:30–20:30 น.</p>' +
        '<p style="margin:0"><b>&#128205; สถานที่:</b> สินธร สเต็กเฮ้าส์ ศรีนครินทร์</p>' +
        '<p style="margin:16px 0 0">กรุณาแสดงรหัสนี้ที่หน้างาน · Jazakallahu khairan</p>' +
      '</div>' +
      '<div style="padding:0 24px 22px;text-align:center;border-top:1px solid #f0f0f0">' +
        '<p style="color:#777;font-size:13px;margin:18px 0 12px">ติดตามอุมมะตี · Follow Ummatee</p>' +
        '<a href="https://www.facebook.com/UmmateeinThailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#1877f2;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">Facebook</a>' +
        '<a href="https://www.instagram.com/ummatee.thailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#e1306c;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">Instagram</a>' +
        '<a href="https://www.tiktok.com/@ummatee.thailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#010101;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">TikTok</a>' +
        '<a href="https://www.youtube.com/@ummateethailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#ff0000;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">YouTube</a>' +
        '<a href="https://line.me/R/ti/p/@745bvvgx" style="display:inline-block;margin:3px;padding:8px 13px;background:#06c755;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">LINE</a>' +
        '<a href="https://www.threads.com/@ummatee.thailand" style="display:inline-block;margin:3px;padding:8px 13px;background:#000000;color:#fff;text-decoration:none;border-radius:8px;font-size:13px">Threads</a>' +
      '</div>' +
      '<div style="background:#faf3e0;color:#8a6d1a;padding:14px 24px;font-size:13px;text-align:center">' +
        '&#9888;&#65039; อีเมลฉบับนี้เป็นข้อความอัตโนมัติ <b>ห้ามตอบกลับ</b> · This is an automated message, please do not reply.' +
      '</div>' +
    '</div>';

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: htmlBody,
    name: 'Ummatee Foundation (no-reply)', // ชื่อผู้ส่งที่ผู้รับเห็น
    noReply: true                          // ส่งจากที่อยู่ no-reply (ใช้ได้กับ Google Workspace)
  });
}
```

แล้วใน `doPost` ของคุณ — **หลังจากที่ได้เลข `ref` และ append แถวลงชีตแล้ว** — เพิ่ม 1 บรรทัด:

```javascript
// ส่งอีเมลยืนยัน (กันพังด้วย try/catch — ถ้าโควต้าเมลเต็มจะไม่ทำให้ลงทะเบียนล้มเหลว)
try { sendIftarConfirmation(data, ref); } catch (err) {}
```

> หมายเหตุ: `noReply:true` ใช้ที่อยู่ no-reply ได้เฉพาะบัญชี **Google Workspace**
> ถ้าเป็น @gmail.com ธรรมดา จะส่งจากอีเมลตัวเอง แต่ข้อความ "ห้ามตอบกลับ" ในเนื้อหายังแสดงครบ
> โควต้า MailApp: ~100 ฉบับ/วัน (Gmail ฟรี) หรือ ~1,500 ฉบับ/วัน (Workspace)

---

## 2) ปิดรับอัตโนมัติเมื่อครบ 400 ที่นั่ง — count endpoint (สาธารณะ)

ฝั่งเว็บ (deploy แล้ว) จะเรียก `?count=1` ตอนโหลดหน้า ถ้าได้ `count >= 400` จะปิดฟอร์มอัตโนมัติ
(ปุ่ม "ปิดรับ" ของแอดมินยังใช้บังคับปิดก่อนได้เหมือนเดิม)

เพิ่มที่ **ต้นฟังก์ชัน `doGet`** ของคุณ — คืนแค่จำนวน ไม่ต้องใช้ token เพราะเป็นแค่ตัวเลข ไม่มี PII:

```javascript
function doGet(e) {
  // โหมดนับจำนวน (สาธารณะ) — ใส่ไว้บนสุดของ doGet
  if (e && e.parameter && e.parameter.count) {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; // ปรับให้ตรงชีตของคุณ
    var n = Math.max(0, sh.getLastRow() - 1);                      // ลบ 1 แถวหัวตาราง
    return ContentService.createTextOutput(JSON.stringify({ count: n }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ... โค้ด doGet เดิมของคุณ (ตรวจ token แล้วคืน rows) วางต่อจากนี้ ...
}
```

> ถ้ายังไม่เพิ่มส่วนนี้ เว็บจะไม่ปิดอัตโนมัติ (แต่ปุ่มปิดด้วยมือยังทำงาน) — ไม่มี error
> ถ้าเปลี่ยนเพดานที่นั่ง ต้องแก้ทั้ง `SEAT_LIMIT` ใน `IftarForGaza.jsx` และข้อความ `seatLimit` ทั้ง 3 ภาษา

---

## 3) Backfill ครั้งเดียว: Sheet → Firestore (ทำเฉพาะถ้าจำนวนไม่ตรง)

ปกติทุกการลงทะเบียนเขียนลง Firestore อยู่แล้ว (มี retry) — ทำข้อนี้**เฉพาะเมื่อ**ยอดในแดชบอร์ด
(Firestore) น้อยกว่ายอดแถวจริงใน Sheet (แปลว่ามีรายการเก่าตกหล่นก่อนใส่ retry)

วิธีที่ง่ายสุด: เพิ่ม library **FirestoreApp** (`1VUSl4b1r1eoNcRWotZM3e87ygkxvXltOgyDZhixqncz9lQ3MjfT1iKFw`)
ใน Apps Script (Libraries → ใส่ ID) แล้วใช้ service account ของโปรเจกต์เขียนลง Firestore:

```javascript
function backfillSheetToFirestore() {
  // ต้องมี service account JSON (สร้างที่ Google Cloud Console → IAM → Service Accounts)
  var email = 'xxx@ummatee-app.iam.gserviceaccount.com';
  var key = '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n';
  var fs = FirestoreApp.getFirestore(email, key, 'ummatee-app');

  var rows = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0].getDataRange().getValues();
  var header = rows[0];
  for (var i = 1; i < rows.length; i++) {
    var d = {};
    header.forEach(function (h, j) { d[h] = rows[i][j]; });
    // กันซ้ำ: ใช้ ref เป็น document id
    if (d.ref) fs.updateDocument('iftarRegs/' + d.ref, d); // create/overwrite ตาม ref
  }
}
```

> รันครั้งเดียวจาก Apps Script editor (กด Run) — ต้องตั้งชื่อ header ในชีตให้ตรงกับฟิลด์
> (ref, date, fname, lname, gender, age, phone, email, job, province, channel, expect, comment)
