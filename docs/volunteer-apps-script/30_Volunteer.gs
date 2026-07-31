// ══════════════════════════════════════════════════════════════════════
// สมัครอาสาสมัคร — บันทึกลง Sheet + ส่งอีเมลยืนยันพร้อม QR
//
// หมายเหตุ: Firestore เป็นที่เก็บหลักแล้ว (ref สร้างจาก counter ฝั่ง Firestore ก่อนเรียกมาที่นี่)
// Sheet นี้เป็นแค่สำรอง/ใช้ส่งอีเมลยืนยัน — ต้องใช้ ref ที่ client ส่งมา ห้ามสร้าง ref เองอีกต่อไป
// (ไม่งั้น ref ใน Sheet กับใน Firestore จะไม่ตรงกัน)
// ══════════════════════════════════════════════════════════════════════
function handleVolunteer(data) {
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
  return jsonOut({ ok: true, ref: ref })
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

function testVolunteerSheet() {
  var vSS = SpreadsheetApp.openById(VOLUNTEER_SHEET_ID)
  var vSheet = vSS.getSheetByName('Volunteer') || vSS.getActiveSheet()
  Logger.log('Sheet name: ' + vSheet.getName())
  Logger.log('Last row: ' + vSheet.getLastRow())
  Logger.log('OK')
}
