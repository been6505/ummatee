// ต้องตรงกับ GIVE_SHEET_TOKEN ใน src/utils/endpoints.js (client ส่งค่านี้มาใน data.token ทุก request)
var SHEET_TOKEN = 'umt-7Kp2xQ9mZr4Wv8Td'
var VOLUNTEER_SHEET_ID = '1HANcunEVvMQFSEY84WSS41jqmUPCm1QkfatX_xXiZj0'

// ⚠️ ความปลอดภัย: doGet เดิม (token === SHEET_TOKEN) เปิดให้ใครก็ได้ที่รู้ token ดึง PII
// (ชื่อ/เบอร์/อีเมล/ที่อยู่) ของอาสาสมัครและผู้ลงทะเบียน Iftar ทั้งหมดออกไปได้ โดยไม่ต้องล็อกอิน
// เว็บเลย และ token นั้นก็ฝังอยู่ใน client bundle อยู่ดี (AdminVolunteer.jsx) — ปิดการอ่าน PII
// ผ่าน Apps Script ทั้งหมด อ่านข้อมูลผ่านหน้า /admin (Firestore + isAdmin() rule) เท่านั้น
// คงไว้แค่ count (ไม่มี PII) สำหรับเช็คที่นั่งเหลือ
function doGet(e) {
  if (e.parameter.count) {
    var ss = SpreadsheetApp.getActiveSpreadsheet()
    var sheet = ss.getSheetByName('Registrations') || ss.getActiveSheet()
    var lastRow = sheet.getLastRow()
    var count = lastRow > 1 ? lastRow - 1 : 0
    return ContentService.createTextOutput(JSON.stringify({ count: count }))
      .setMimeType(ContentService.MimeType.JSON)
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'disabled' }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ป้องกัน HTML/markup injection ในอีเมลจากฟิลด์ที่ผู้ใช้กรอกเอง
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents)

    // ⚠️ ความปลอดภัย: ก่อนหน้านี้ endpoint นี้ไม่ตรวจ token เลยสักฟังก์ชัน — ใครก็ได้ที่เจอ URL นี้
    // (public constant ใน src/utils/endpoints.js) สามารถยิง POST ตรงมาสั่งส่งอีเมล/LINE ข้อความ
    // "ใดก็ได้" ถึงผู้รับ "ใดก็ได้" ผ่านบัญชี Gmail/LINE OA ของมูลนิธิ (adminNotify/lineNotify)
    // — เสี่ยงถูกใช้เป็น open relay สแปม/ฟิชชิ่งจนบัญชีโดนแบน ต้องตรวจ token ก่อนทำงานทุก action
    // (token เป็น public write-token เหมือน GIVE_SHEET_TOKEN อื่นๆ ในระบบ — กันบอท/การเจอ URL
    // มั่วๆ ไม่ใช่การยืนยันตัวตนจริงจัง แต่ดีกว่าเปิดโล่งไม่มีอะไรกั้นเลย)
    if (data.token !== SHEET_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    // --- แจ้งเตือนแอดมินเมื่อมีออเดอร์ใหม่ / ลูกค้าแจ้งชำระเงิน (Um Shop) ---
    // ส่งอีเมลถึงแอดมินเสมอ + ส่ง LINE ด้วยถ้าตั้ง Script Properties ครบ
    // (LINE_CHANNEL_ACCESS_TOKEN และ ADMIN_LINE_USER_ID = userId ของแอดมิน/กลุ่มที่ให้บอทแจ้ง)
    if (data.type === 'adminNotify') {
      var subj = data.subject || 'Um Shop แจ้งเตือน'
      var msg = String(data.message || '').slice(0, 4000)
      if (!msg) {
        return ContentService.createTextOutput(JSON.stringify({ error: 'missing message' }))
          .setMimeType(ContentService.MimeType.JSON)
      }
      try {
        GmailApp.sendEmail('ummatee.thailand@gmail.com', subj,
          msg + '\n\nเปิดหน้าจัดการ: https://ummatee-app.web.app/admin/shop/orders')
      } catch (mailErr) { Logger.log('adminNotify mail error: ' + mailErr.message) }

      var props = PropertiesService.getScriptProperties()
      var aToken = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN')
      var adminLineId = props.getProperty('ADMIN_LINE_USER_ID')
      if (aToken && adminLineId) {
        try {
          UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
            method: 'post',
            contentType: 'application/json',
            headers: { Authorization: 'Bearer ' + aToken },
            payload: JSON.stringify({ to: adminLineId, messages: [{ type: 'text', text: msg }] }),
            muteHttpExceptions: true,
          })
        } catch (lineErr) { Logger.log('adminNotify line error: ' + lineErr.message) }
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    // --- แจ้งเตือนสถานะคำสั่งซื้อ Um Shop ผ่าน LINE ---
    // ต้องตั้ง Script Property ชื่อ LINE_CHANNEL_ACCESS_TOKEN (จาก LINE Messaging API channel
    // ของ OA @745bvvgx — Provider เดียวกับ LINE Login channel) และลูกค้าต้องเป็นเพื่อนกับ OA
    if (data.type === 'lineNotify') {
      var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN')
      if (!token) {
        return ContentService.createTextOutput(JSON.stringify({ error: 'no token configured' }))
          .setMimeType(ContentService.MimeType.JSON)
      }
      if (!data.lineUserId || !data.message) {
        return ContentService.createTextOutput(JSON.stringify({ error: 'missing lineUserId/message' }))
          .setMimeType(ContentService.MimeType.JSON)
      }
      var resp = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify({
          to: data.lineUserId,
          messages: [{ type: 'text', text: String(data.message).slice(0, 4900) }],
        }),
        muteHttpExceptions: true,
      })
      return ContentService.createTextOutput(JSON.stringify({ ok: resp.getResponseCode() === 200, code: resp.getResponseCode() }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    // --- Volunteer registration ---
    // หมายเหตุ: Firestore เป็นที่เก็บหลักแล้ว (ref สร้างจาก counter ฝั่ง Firestore ก่อนเรียกมาที่นี่)
    // Sheet นี้เป็นแค่สำรอง/ใช้ส่งอีเมลยืนยัน — ต้องใช้ ref ที่ client ส่งมา ห้ามสร้าง ref เองอีกต่อไป
    // (ไม่งั้น ref ใน Sheet กับใน Firestore จะไม่ตรงกัน)
    if (data.type === 'volunteer') {
      var vSS = SpreadsheetApp.openById(VOLUNTEER_SHEET_ID)
      var vSheet = vSS.getSheetByName('Volunteer') || vSS.getActiveSheet()
      if (vSheet.getLastRow() === 0) {
        vSheet.appendRow([
          'Ref', 'วันที่', 'ชื่อ', 'นามสกุล', 'Name', 'Last Name',
          'เพศ', 'อายุ', 'จังหวัด', 'เบอร์โทร', 'อีเมล',
          'ช่องทางการรับรู้', 'ความสามารถ', 'งานที่สนใจ', 'โครงการ',
          'วันที่สะดวก', 'ความคาดหวัง', 'ข้อความ'
        ])
      }
      var ref = data.ref || ('UMV-' + vSheet.getLastRow())
      vSheet.appendRow([
        ref,
        data.date || '',
        data.fname || '',
        data.lname || '',
        data.fnameEn || '',
        data.lnameEn || '',
        data.gender || '',
        data.age || '',
        data.province || '',
        data.phone || '',
        data.email || '',
        data.channel || '',
        data.skills || '',
        data.missions || '',
        data.giveProjects || '',
        data.giveDates || '',
        data.expect || '',
        data.note || '',
      ])
      sendVolunteerConfirmation(data, ref)
      return ContentService.createTextOutput(JSON.stringify({ ok: true, ref: ref }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    // --- B2UM registration ---
    if (data.type === 'b2um') {
      var vSS = SpreadsheetApp.openById(VOLUNTEER_SHEET_ID)
      var bSheet = vSS.getSheetByName('B2UM') || vSS.insertSheet('B2UM')
      if (bSheet.getLastRow() === 0) {
        bSheet.appendRow(['Ref', 'วันที่', 'ชื่อ', 'นามสกุล', 'เบอร์โทร', 'ชื่อร้านค้า/ธุรกิจ', 'ภาพ'])
      }
      var ref = 'B2UM-' + String(bSheet.getLastRow()).padStart(3, '0')
      bSheet.appendRow([
        ref,
        data.date || '',
        data.fname || '',
        data.lname || '',
        data.phone || '',
        data.shopName || '',
        data.images || '',
      ])
      return ContentService.createTextOutput(JSON.stringify({ ok: true, ref: ref }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    // --- Iftar registration ---
    var ss = SpreadsheetApp.getActiveSpreadsheet()
    var sheet = ss.getSheetByName('Registrations') || ss.getActiveSheet()

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Ref', 'วันที่', 'ชื่อ', 'นามสกุล', 'เบอร์โทร', 'อีเมล', 'จำนวน', 'จังหวัด', 'ช่องทาง'])
    }

    var ref = data.ref || ('IFG-' + Date.now())
    sheet.appendRow([
      ref,
      data.date || new Date().toLocaleString('th-TH'),
      data.fname || '',
      data.lname || '',
      data.phone || '',
      data.email || '',
      data.count || 1,
      data.province || '',
      data.channel || '',
    ])

    sendIftarConfirmation(data, ref)

    return ContentService.createTextOutput(JSON.stringify({ ok: true, ref: ref }))
      .setMimeType(ContentService.MimeType.JSON)

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}

// ======== อีเมลยืนยัน Volunteer — โครงเดียวกับ Iftar (QR code + รหัส เท่านั้น) ========
function sendVolunteerConfirmation(data, ref) {
  try {
    var name = escapeHtml((data.fname || '') + ' ' + (data.lname || ''))
    var email = data.email || ''
    if (!email) return

    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(ref)
    var subject = 'ยืนยันการสมัครอาสาสมัคร Ummatee — ' + ref

    var body =
      '<div style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">' +
      '<div style="background:#1b5e36;color:#fff;padding:24px;text-align:center">' +
      '<h1 style="margin:0;font-size:22px">&#10003; สมัครอาสาสมัครเรียบร้อย</h1>' +
      '<p style="margin:6px 0 0;opacity:.9">Ummatee Volunteer</p>' +
      '</div>' +
      '<div style="padding:24px;color:#333;line-height:1.7">' +
      '<p>เรียน คุณ' + name + '</p>' +
      '<p>ขอบคุณที่สมัครเป็นอาสาสมัครมูลนิธิอุมมะตี</p>' +

      '<div style="text-align:center;margin:24px 0">' +
      '<div style="display:inline-block;background:#fff;border:2px solid #e5e7eb;border-radius:14px;padding:14px">' +
      '<img src="' + qrUrl + '" alt="QR Code" width="180" height="180" style="display:block;border-radius:8px">' +
      '</div>' +
      '</div>' +

      '<div style="background:#f6f6f4;border-radius:10px;padding:16px;margin:16px 0;text-align:center">' +
      '<div style="font-size:13px;color:#888">รหัสอาสาสมัครของคุณ</div>' +
      '<div style="font-size:26px;font-weight:800;color:#1b5e36;letter-spacing:1px">' + ref + '</div>' +
      '</div>' +

      '<p style="text-align:center;color:#555;font-size:13px;line-height:1.6;margin:16px 0">' +
      '&#128241; กรุณาแสดง <b>QR Code</b> หรือ รหัส <b>' + ref + '</b> เมื่อมาร่วมงาน<br>' +
      'Please show this QR code or code <b>' + ref + '</b> at the event' +
      '</p>' +

      (data.missions ? '<p style="margin:0 0 4px"><b>&#127919; ภารกิจ:</b> ' + escapeHtml(data.missions) + '</p>' : '') +
      (data.skills ? '<p style="margin:0 0 4px"><b>&#128736; ตำแหน่ง:</b> ' + escapeHtml(data.skills) + '</p>' : '') +
      (data.giveProjects ? '<p style="margin:0 0 4px"><b>&#128230; โครงการ:</b> ' + escapeHtml(data.giveProjects) + '</p>' : '') +

      '<p style="margin:16px 0 0">ทีมงานจะติดต่อกลับเร็วๆ นี้ · Jazakallahu khairan</p>' +
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
      '</div>'

    GmailApp.sendEmail(email, subject, 'กรุณาเปิดอีเมลในโปรแกรมที่รองรับ HTML', { htmlBody: body })
  } catch (err) {
    Logger.log('Volunteer email error: ' + err.message)
  }
}

// ======== อีเมลยืนยัน Iftar For Gaza — QR code + รหัส ========
function sendIftarConfirmation(data, ref) {
  try {
    var name = escapeHtml((data.fname || '') + ' ' + (data.lname || ''))
    var email = data.email || ''
    if (!email) return

    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(ref)
    var subject = 'ยืนยันการลงทะเบียน Iftar For Gaza 2026 — ' + ref

    var body =
      '<div style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">' +
      '<div style="background:#1b5e36;color:#fff;padding:24px;text-align:center">' +
      '<h1 style="margin:0;font-size:22px">&#10003; ลงทะเบียนเรียบร้อย</h1>' +
      '<p style="margin:6px 0 0;opacity:.9">Iftar For Gaza 2026</p>' +
      '</div>' +
      '<div style="padding:24px;color:#333;line-height:1.7">' +
      '<p>เรียน คุณ' + name + '</p>' +
      '<p>ขอบคุณที่ลงทะเบียนเข้าร่วมงาน <b>Iftar For Gaza 2026</b> เรียบร้อยแล้ว</p>' +

      '<div style="text-align:center;margin:24px 0">' +
      '<div style="display:inline-block;background:#fff;border:2px solid #e5e7eb;border-radius:14px;padding:14px">' +
      '<img src="' + qrUrl + '" alt="QR Code" width="180" height="180" style="display:block;border-radius:8px">' +
      '</div>' +
      '</div>' +

      '<div style="background:#f6f6f4;border-radius:10px;padding:16px;margin:16px 0;text-align:center">' +
      '<div style="font-size:13px;color:#888">รหัสลงทะเบียนของคุณ</div>' +
      '<div style="font-size:26px;font-weight:800;color:#1b5e36;letter-spacing:1px">' + ref + '</div>' +
      '</div>' +

      '<p style="text-align:center;color:#555;font-size:13px;line-height:1.6;margin:16px 0">' +
      '&#128241; กรุณาแสดง <b>QR Code</b> หรือ รหัส <b>' + ref + '</b> ที่จุดลงทะเบียนหน้างาน<br>' +
      'Please show this QR code or code <b>' + ref + '</b> at the check-in counter' +
      '</p>' +

      '<p style="margin:0 0 4px"><b>&#128197; วัน-เวลา:</b> ศุกร์ 26 มิถุนายน 2569 · 15:30–20:30 น.</p>' +
      '<p style="margin:0 0 16px"><b>&#128205; สถานที่:</b> สินธร สเต็กเฮ้าส์ ศรีนครินทร์</p>' +
      '<div style="text-align:center;margin:20px 0">' +
      '<a href="https://maps.app.goo.gl/MeUdbtRPhB7mKBcb7" style="display:inline-block;padding:12px 22px;background:#4285f4;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;margin:4px">&#128205; ดูแผนที่</a>' +
      '<a href="https://ummatee-app.web.app/donation" style="display:inline-block;padding:12px 22px;background:#1b5e36;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;margin:4px">&#10084; ร่วมบริจาค</a>' +
      '</div>' +
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
      '</div>'

    GmailApp.sendEmail(email, subject, 'กรุณาเปิดอีเมลในโปรแกรมที่รองรับ HTML', { htmlBody: body })
  } catch (err) {
    Logger.log('Email error: ' + err.message)
  }
}

function testVolunteerSheet() {
  var vSS = SpreadsheetApp.openById(VOLUNTEER_SHEET_ID)
  var vSheet = vSS.getSheetByName('Volunteer') || vSS.getActiveSheet()
  Logger.log('Sheet name: ' + vSheet.getName())
  Logger.log('Last row: ' + vSheet.getLastRow())
  Logger.log('OK')
}
