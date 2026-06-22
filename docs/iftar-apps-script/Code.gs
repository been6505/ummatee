var SHEET_TOKEN = 'umt-7Kp2xQ9mZr4Wv8Td'

function doGet(e) {
  if (e.parameter.count) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Iftar For Gaza') || ss.getSheets()[0];
    var n = Math.max(0, sh.getLastRow() - 1);
    return ContentService.createTextOutput(JSON.stringify({ count: n }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.token !== SHEET_TOKEN) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Iftar For Gaza') || ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1).map(function(r) {
    return {
      ref: r[0], date: r[1], fname: r[2], lname: r[3], gender: r[4], age: r[5],
      phone: r[6], email: r[7], job: r[8], province: r[9], channel: r[10],
      expect: r[11], comment: r[12]
    };
  });
  return ContentService.createTextOutput(JSON.stringify({ rows: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Iftar For Gaza') || ss.getActiveSheet();
    var ref = 'IFG-' + String(sheet.getLastRow()).padStart(4, '0');
    sheet.appendRow([
      ref, data.date, data.fname, data.lname, data.gender, data.age, data.phone,
      data.email, data.job, data.province, data.channel, data.expect, data.comment
    ]);

    try { sendIftarConfirmation(data, ref); } catch (err) {}

    return ContentService.createTextOutput(JSON.stringify({ ref: ref }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function sendIftarConfirmation(data, ref) {
  if (!data.email) return;

  var fullName = ((data.fname || '') + ' ' + (data.lname || '')).trim();
  var subject = 'ยืนยันการลงทะเบียน Iftar For Gaza 2026 — ' + ref;
  var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(ref);

  var htmlBody =
    '<div style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">' +
    '<div style="background:#1b5e36;color:#fff;padding:24px;text-align:center">' +
    '<h1 style="margin:0;font-size:22px">&#10003; ลงทะเบียนเรียบร้อย</h1>' +
    '<p style="margin:6px 0 0;opacity:.9">Iftar For Gaza 2026</p>' +
    '</div>' +
    '<div style="padding:24px;color:#333;line-height:1.7">' +
    '<p>เรียน คุณ' + fullName + '</p>' +
    '<p>ขอบคุณที่ลงทะเบียนเข้าร่วมงาน <b>Iftar For Gaza 2026</b> เรียบร้อยแล้ว</p>' +

    // QR Code + Ref
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
    '</div>';

  GmailApp.sendEmail(data.email, subject, 'กรุณาเปิดอีเมลในโปรแกรมที่รองรับ HTML', { htmlBody: htmlBody });
}
