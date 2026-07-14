var SHEET_TOKEN = 'umt-7Kp2xQ9mZr4Wv8Td'
var VOLUNTEER_SHEET_ID = '1HANcunEVvMQFSEY84WSS41jqmUPCm1QkfatX_xXiZj0'

var HEADERS = {
  'Give2Com':         ['refCode', 'วันที่', 'ชื่อ', 'นามสกุล', 'เบอร์โทร', 'อีเมล', 'ประเภทสิ่งของ', 'Notebook', 'Tablet', 'รายละเอียด', 'สะดวกมามอบในงาน', 'จำนวนรูป'],
  'Give2Cook':        ['refCode', 'วันที่', 'ชื่อ', 'นามสกุล', 'เบอร์โทร', 'อีเมล', 'รายการสิ่งของ', 'รายละเอียด', 'สะดวกมามอบในงาน'],
  'Give2ComReceive':  ['วันที่', 'ชื่อ', 'นามสกุล', 'เบอร์โทร', 'อีเมล', 'อายุ', 'โรงเรียน', 'อาจารย์ที่ปรึกษา', 'เบอร์อาจารย์', 'ที่อยู่จัดส่ง', 'เหตุผล'],
  'Give2CookReceive': ['วันที่', 'ชื่อ', 'นามสกุล', 'เบอร์โทร', 'อีเมล', 'อายุ', 'อาชีพ', 'รายละเอียดสิ่งที่ทำ', 'สิ่งของที่ต้องการ', 'ที่อยู่จัดส่ง', 'เหตุผล'],
}

// ─────────────────────────────────────────────────────────────
//  doGet — ปิดการอ่านข้อมูล (PII) ผ่าน Apps Script แล้ว
// ─────────────────────────────────────────────────────────────
// เดิม doGet(type=volunteer) คืนรายชื่อ/เบอร์/อีเมลอาสาสมัครทั้งหมดให้ใครก็ได้ที่มี
// SHEET_TOKEN (ซึ่งเป็น write-token สาธารณะ ฝังอยู่ใน client bundle อยู่แล้ว — ดู endpoints.js)
// หรือ token 'ummatee-secret-2024' ที่ก็ฝังอยู่ใน client bundle เช่นกัน (AdminVolunteer.jsx)
// ทำให้ใครก็เปิดดู PII อาสาสมัครทั้งหมดได้โดยไม่ต้องล็อกอิน — เป็นช่องโหว่ข้อมูลรั่ว
// อ่านข้อมูลอาสาสมัครผ่านหน้า /admin/volunteer (Firestore + isAdmin() rule) เท่านั้น
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ error: 'disabled' }))
    .setMimeType(ContentService.MimeType.JSON)
}

// ─────────────────────────────────────────────────────────────
//  HTML escaping — ป้องกัน HTML/markup injection ในอีเมลจากฟิลด์ที่ผู้ใช้กรอกเอง
// ─────────────────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─────────────────────────────────────────────────────────────
//  Shared email layout helpers
// ─────────────────────────────────────────────────────────────
function emailWrap(accentColor, headerTitle, headerSub, bodyHtml) {
  return (
    '<div style="font-family:Tahoma,Arial,sans-serif;max-width:580px;margin:auto;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#fff">' +
    '<div style="background:' + accentColor + ';color:#fff;padding:28px 24px;text-align:center">' +
    '<img src="https://ummatee-app.web.app/logo.png" alt="Ummatee" style="height:48px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto">' +
    '<h1 style="margin:0;font-size:20px;font-weight:800">' + headerTitle + '</h1>' +
    '<p style="margin:6px 0 0;opacity:.85;font-size:14px">' + headerSub + '</p>' +
    '</div>' +
    '<div style="padding:28px 24px;color:#1f2937;line-height:1.75;font-size:15px">' +
    bodyHtml +
    '</div>' +
    '<div style="padding:16px 24px;border-top:1px solid #f3f4f6;text-align:center">' +
    '<p style="color:#9ca3af;font-size:12px;margin:0 0 10px">ติดตามอุมมะตี · Follow Ummatee</p>' +
    '<a href="https://www.facebook.com/UmmateeinThailand" style="display:inline-block;margin:2px;padding:6px 11px;background:#1877f2;color:#fff;text-decoration:none;border-radius:7px;font-size:12px">Facebook</a>' +
    '<a href="https://www.instagram.com/ummatee.thailand" style="display:inline-block;margin:2px;padding:6px 11px;background:#e1306c;color:#fff;text-decoration:none;border-radius:7px;font-size:12px">Instagram</a>' +
    '<a href="https://www.tiktok.com/@ummatee.thailand" style="display:inline-block;margin:2px;padding:6px 11px;background:#010101;color:#fff;text-decoration:none;border-radius:7px;font-size:12px">TikTok</a>' +
    '<a href="https://line.me/R/ti/p/@745bvvgx" style="display:inline-block;margin:2px;padding:6px 11px;background:#06c755;color:#fff;text-decoration:none;border-radius:7px;font-size:12px">LINE</a>' +
    '</div>' +
    '<div style="background:#fef9c3;color:#92400e;padding:12px 24px;font-size:12px;text-align:center">' +
    '&#9888;&#65039; อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ' +
    '</div>' +
    '</div>'
  )
}

function infoRow(label, value) {
  if (!value) return ''
  return (
    '<tr>' +
    '<td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top">' + label + '</td>' +
    '<td style="padding:6px 0;font-size:13px;font-weight:600;color:#1f2937">' + value + '</td>' +
    '</tr>'
  )
}

// ─────────────────────────────────────────────────────────────
//  Email: Give2Com
// ─────────────────────────────────────────────────────────────
function sendGive2ComConfirmation(data) {
  if (!data.email) return
  var name = escapeHtml(((data.fname || '') + ' ' + (data.lname || '')).trim())
  var refCode = escapeHtml(data.refCode)
  var canAttend = data.canAttend === true ? '✅ สะดวกมามอบในงาน วันที่ 3–5 กรกฎาคม 2569'
    : data.canAttend === false ? '📦 ไม่สะดวก — ทีมงานจะนัดรับที่ออฟฟิศ' : ''
  var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(data.refCode)
  var body =
    '<p>เรียน คุณ<strong>' + name + '</strong></p>' +
    '<p>ขอบคุณที่ร่วมส่งต่อสิ่งดีๆ ให้น้องๆ ได้เรียน — ทีมงานจะติดต่อกลับเพื่อนัดรับสิ่งของของคุณโดยเร็ว</p>' +
    '<div style="text-align:center;margin:24px 0">' +
    '<div style="display:inline-block;background:#f5f3ff;border:2px solid #ddd6fe;border-radius:14px;padding:16px">' +
    '<div style="font-size:12px;color:#7c3aed;font-weight:700;margin-bottom:8px">รหัสลงทะเบียนของคุณ</div>' +
    '<img src="' + qrUrl + '" width="160" height="160" style="display:block;border-radius:8px;margin:0 auto 10px">' +
    '<div style="font-size:24px;font-weight:900;color:#7c3aed;letter-spacing:2px">' + refCode + '</div>' +
    '</div></div>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
    infoRow('สิ่งของที่บริจาค', escapeHtml(data.typeLabels)) +
    (data.notebookQty > 0 ? infoRow('Notebook', data.notebookQty + ' เครื่อง') : '') +
    (data.tabletQty > 0 ? infoRow('Tablet', data.tabletQty + ' เครื่อง') : '') +
    infoRow('การมามอบในงาน', canAttend) +
    '</table>' +
    (data.canAttend === false
      ? '<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:8px;font-size:13px;margin:12px 0">' +
        '📍 <strong>ที่อยู่รับสิ่งของ:</strong><br>183 ซอยกรุงเทพกรีฑา 7 แขวงหัวหมาก บางกะปิ กรุงเทพมหานคร 10240</div>' : '') +
    '<p style="font-size:13px;color:#6b7280;margin-top:20px">กรุณาเก็บรหัส <strong>' + refCode + '</strong> ไว้เป็นหลักฐาน · Jazakallahu khairan 🤍</p>'
  GmailApp.sendEmail(data.email, 'ยืนยันการบริจาคคอมมือสอง — ' + data.refCode, '',
    { htmlBody: emailWrap('#7c3aed', '✅ ลงทะเบียนบริจาคสำเร็จ', 'งานให้ ครั้งที่ 6 · มูลนิธิอุมมะตี', body) })
}

// ─────────────────────────────────────────────────────────────
//  Email: Give2Cook
// ─────────────────────────────────────────────────────────────
function sendGive2CookConfirmation(data) {
  if (!data.email) return
  var name = escapeHtml(((data.fname || '') + ' ' + (data.lname || '')).trim())
  var refCode = escapeHtml(data.refCode)
  var canAttend = data.canAttend === true ? '✅ สะดวกมามอบในงาน วันที่ 3–5 กรกฎาคม 2569'
    : data.canAttend === false ? '📦 ไม่สะดวก — ทีมงานจะนัดรับที่ออฟฟิศ' : ''
  var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(data.refCode)
  var body =
    '<p>เรียน คุณ<strong>' + name + '</strong></p>' +
    '<p>ขอบคุณที่ร่วมส่งต่ออุปกรณ์ประกอบอาชีพ — ทีมงานจะติดต่อกลับเพื่อนัดรับสิ่งของของคุณโดยเร็ว</p>' +
    '<div style="text-align:center;margin:24px 0">' +
    '<div style="display:inline-block;background:#fffbeb;border:2px solid #fde68a;border-radius:14px;padding:16px">' +
    '<div style="font-size:12px;color:#d97706;font-weight:700;margin-bottom:8px">รหัสลงทะเบียนของคุณ</div>' +
    '<img src="' + qrUrl + '" width="160" height="160" style="display:block;border-radius:8px;margin:0 auto 10px">' +
    '<div style="font-size:24px;font-weight:900;color:#d97706;letter-spacing:2px">' + refCode + '</div>' +
    '</div></div>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
    infoRow('สิ่งของที่บริจาค', escapeHtml(data.typeLabels)) +
    infoRow('การมามอบในงาน', canAttend) +
    '</table>' +
    (data.canAttend === false
      ? '<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:8px;font-size:13px;margin:12px 0">' +
        '📍 <strong>ที่อยู่รับสิ่งของ:</strong><br>183 ซอยกรุงเทพกรีฑา 7 แขวงหัวหมาก บางกะปิ กรุงเทพมหานคร 10240</div>' : '') +
    '<p style="font-size:13px;color:#6b7280;margin-top:20px">กรุณาเก็บรหัส <strong>' + refCode + '</strong> ไว้เป็นหลักฐาน · Jazakallahu khairan 🤍</p>'
  GmailApp.sendEmail(data.email, 'ยืนยันการบริจาคอุปกรณ์ — ' + data.refCode, '',
    { htmlBody: emailWrap('#d97706', '✅ ลงทะเบียนบริจาคสำเร็จ', 'งานให้ ครั้งที่ 6 · มูลนิธิอุมมะตี', body) })
}

// ─────────────────────────────────────────────────────────────
//  Email: Give2ComReceive
// ─────────────────────────────────────────────────────────────
function sendGive2ComReceiveConfirmation(data) {
  if (!data.email) return
  var name = escapeHtml(((data.fname || '') + ' ' + (data.lname || '')).trim())
  var body =
    '<p>เรียน คุณ<strong>' + name + '</strong></p>' +
    '<p>ทีมงานได้รับการลงทะเบียนขอรับคอมมือสองของคุณเรียบร้อยแล้ว — เราจะพิจารณาและติดต่อกลับโดยเร็วที่สุด</p>' +
    '<div style="background:#f5f3ff;border-radius:12px;padding:16px 20px;margin:20px 0">' +
    '<div style="font-size:13px;font-weight:700;color:#7c3aed;margin-bottom:10px">🖥️ ข้อมูลที่ลงทะเบียน</div>' +
    '<table style="width:100%;border-collapse:collapse">' +
    infoRow('ชื่อ-นามสกุล', name) +
    infoRow('เบอร์โทร', escapeHtml(data.phone)) +
    infoRow('โรงเรียน', escapeHtml(data.school)) +
    infoRow('อาจารย์ที่ปรึกษา', escapeHtml(data.teacherName)) +
    infoRow('ที่อยู่จัดส่ง', escapeHtml(data.address)) +
    '</table></div>' +
    '<p style="font-size:13px;color:#6b7280">หากมีข้อสงสัยสามารถติดต่อทีมงานอุมมะตีได้ทาง LINE หรือ Facebook · Jazakallahu khairan 🤍</p>'
  GmailApp.sendEmail(data.email, 'ยืนยันการลงทะเบียนรับคอมมือสอง', '',
    { htmlBody: emailWrap('#7c3aed', '✅ ลงทะเบียนรับคอมมือสองสำเร็จ', 'งานให้ ครั้งที่ 6 · มูลนิธิอุมมะตี', body) })
}

// ─────────────────────────────────────────────────────────────
//  Email: Give2CookReceive
// ─────────────────────────────────────────────────────────────
function sendGive2CookReceiveConfirmation(data) {
  if (!data.email) return
  var name = escapeHtml(((data.fname || '') + ' ' + (data.lname || '')).trim())
  var body =
    '<p>เรียน คุณ<strong>' + name + '</strong></p>' +
    '<p>ทีมงานได้รับการลงทะเบียนขอรับอุปกรณ์ประกอบอาชีพของคุณเรียบร้อยแล้ว — เราจะพิจารณาและติดต่อกลับโดยเร็วที่สุด</p>' +
    '<div style="background:#fffbeb;border-radius:12px;padding:16px 20px;margin:20px 0">' +
    '<div style="font-size:13px;font-weight:700;color:#d97706;margin-bottom:10px">🍳 ข้อมูลที่ลงทะเบียน</div>' +
    '<table style="width:100%;border-collapse:collapse">' +
    infoRow('ชื่อ-นามสกุล', name) +
    infoRow('เบอร์โทร', escapeHtml(data.phone)) +
    infoRow('อาชีพ', escapeHtml(data.job)) +
    infoRow('สิ่งของที่ต้องการ', escapeHtml(data.wantedItems)) +
    infoRow('ที่อยู่จัดส่ง', escapeHtml(data.address)) +
    '</table></div>' +
    '<p style="font-size:13px;color:#6b7280">หากมีข้อสงสัยสามารถติดต่อทีมงานอุมมะตีได้ทาง LINE หรือ Facebook · Jazakallahu khairan 🤍</p>'
  GmailApp.sendEmail(data.email, 'ยืนยันการลงทะเบียนรับอุปกรณ์ประกอบอาชีพ', '',
    { htmlBody: emailWrap('#d97706', '✅ ลงทะเบียนรับอุปกรณ์สำเร็จ', 'งานให้ ครั้งที่ 6 · มูลนิธิอุมมะตี', body) })
}

// ─────────────────────────────────────────────────────────────
//  Email: Volunteer
// ─────────────────────────────────────────────────────────────
function sendVolunteerConfirmation(data, ref) {
  if (!data.email) return
  var name = escapeHtml(((data.fname || '') + ' ' + (data.lname || '')).trim())
  var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(ref)
  var body =
    '<p>เรียน คุณ<strong>' + name + '</strong></p>' +
    '<p>ขอบคุณที่สมัครเป็นอาสาสมัครมูลนิธิอุมมะตี — ทีมงานจะติดต่อกลับเร็วๆ นี้</p>' +
    '<div style="text-align:center;margin:24px 0">' +
    '<div style="display:inline-block;background:#f0fdf4;border:2px solid #bbf7d0;border-radius:14px;padding:16px">' +
    '<div style="font-size:12px;color:#15803d;font-weight:700;margin-bottom:8px">รหัสอาสาสมัครของคุณ</div>' +
    '<img src="' + qrUrl + '" width="160" height="160" style="display:block;border-radius:8px;margin:0 auto 10px">' +
    '<div style="font-size:24px;font-weight:900;color:#15803d;letter-spacing:2px">' + escapeHtml(ref) + '</div>' +
    '</div></div>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
    infoRow('ตำแหน่งที่สนใจ', escapeHtml(data.skills)) +
    infoRow('ภารกิจ', escapeHtml(data.missions)) +
    infoRow('โครงการ', escapeHtml(data.giveProjects)) +
    '</table>' +
    '<p style="font-size:13px;color:#6b7280;margin-top:20px">กรุณาแสดงรหัสนี้เมื่อมาร่วมงาน · Jazakallahu khairan 🤍</p>'
  GmailApp.sendEmail(data.email, 'ยืนยันการสมัครอาสาสมัคร Ummatee — ' + ref, '',
    { htmlBody: emailWrap('#15803d', '✅ สมัครอาสาสมัครสำเร็จ', 'มูลนิธิอุมมะตี', body) })
}

// ─────────────────────────────────────────────────────────────
//  Sheet helpers
// ─────────────────────────────────────────────────────────────
function getOrCreateSheet(ss, name) {
  var sh = ss.getSheetByName(name)
  if (!sh) {
    sh = ss.insertSheet(name)
    var headers = HEADERS[name]
    if (headers) {
      sh.appendRow(headers)
      sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6')
      sh.setFrozenRows(1)
    }
  }
  return sh
}

// ─────────────────────────────────────────────────────────────
//  doPost
// ─────────────────────────────────────────────────────────────
function doPost(e) {
  var lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    var data = JSON.parse(e.postData.contents)
    var type = data.type || ''

    // ── ทุกฟอร์มสาธารณะต้องใช้ token (กันสแปม/บอทยิงตรงมาที่ endpoint) ──
    if (data.token !== SHEET_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    // ── Volunteer ──
    if (type === 'volunteer') {
      var vSS = SpreadsheetApp.openById(VOLUNTEER_SHEET_ID)
      var vSheet = vSS.getSheetByName('Volunteer') || vSS.getActiveSheet()
      if (vSheet.getLastRow() === 0) {
        vSheet.appendRow(['Ref', 'วันที่', 'ชื่อ', 'นามสกุล', 'Name', 'Last Name',
          'เพศ', 'อายุ', 'จังหวัด', 'เบอร์โทร', 'อีเมล',
          'ช่องทางการรับรู้', 'ความสามารถ', 'งานที่สนใจ', 'โครงการ',
          'วันที่สะดวก', 'ความคาดหวัง', 'ข้อความ'])
      }
      var ref = 'UMV-' + vSheet.getLastRow()
      vSheet.appendRow([ref, data.date || '', data.fname || '', data.lname || '',
        data.fnameEn || '', data.lnameEn || '', data.gender || '', data.age || '',
        data.province || '', data.phone || '', data.email || '', data.channel || '',
        data.skills || '', data.missions || '', data.giveProjects || '',
        data.giveDates || '', data.expect || '', data.note || ''])
      try { sendVolunteerConfirmation(data, ref) } catch (err) {}
      return ContentService.createTextOutput(JSON.stringify({ ok: true, ref: ref }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    // ── Give2 forms ──
    var ss = SpreadsheetApp.getActiveSpreadsheet()

    if (type === 'give2') {
      var sh = getOrCreateSheet(ss, 'Give2Com')
      var canAttend = data.canAttend === true ? 'สะดวก' : data.canAttend === false ? 'ไม่สะดวก' : ''
      sh.appendRow([data.refCode || '',
        data.submittedAt ? new Date(data.submittedAt).toLocaleString('th-TH') : '',
        data.fname || '', data.lname || '', data.phone || '', data.email || '',
        data.typeLabels || '', data.notebookQty || 0, data.tabletQty || 0,
        data.detail || '', canAttend, (data.imageUrls || []).length])
      try { sendGive2ComConfirmation(data) } catch (err) {}
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    if (type === 'give2cook') {
      var sh = getOrCreateSheet(ss, 'Give2Cook')
      var canAttend = data.canAttend === true ? 'สะดวก' : data.canAttend === false ? 'ไม่สะดวก' : ''
      sh.appendRow([data.refCode || '',
        data.submittedAt ? new Date(data.submittedAt).toLocaleString('th-TH') : '',
        data.fname || '', data.lname || '', data.phone || '', data.email || '',
        data.typeLabels || '', data.detail || '', canAttend])
      try { sendGive2CookConfirmation(data) } catch (err) {}
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    if (type === 'give2comreceive') {
      var sh = getOrCreateSheet(ss, 'Give2ComReceive')
      sh.appendRow([data.date || '', data.fname || '', data.lname || '',
        data.phone || '', data.email || '', data.age || '', data.school || '',
        data.teacherName || '', data.teacherPhone || '', data.address || '', data.reason || ''])
      try { sendGive2ComReceiveConfirmation(data) } catch (err) {}
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    if (type === 'give2cookreceive') {
      var sh = getOrCreateSheet(ss, 'Give2CookReceive')
      sh.appendRow([data.date || '', data.fname || '', data.lname || '',
        data.phone || '', data.email || '', data.age || '', data.job || '',
        data.detail || '', data.wantedItems || '', data.address || '', data.reason || ''])
      try { sendGive2CookReceiveConfirmation(data) } catch (err) {}
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON)
    }

    return ContentService.createTextOutput(JSON.stringify({ error: 'unknown type' }))
      .setMimeType(ContentService.MimeType.JSON)
  } finally {
    lock.releaseLock()
  }
}
