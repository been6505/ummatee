// ══════════════════════════════════════════════════════════════════════
// ตั้งค่าและตัวช่วยที่ทุกไฟล์ใช้ร่วมกัน
//
// ⚠️ ไฟล์ .gs ทุกไฟล์ในโปรเจกต์ Apps Script เดียวกันใช้ global scope ร่วมกัน
// และถูกรวมเป็นสคริปต์เดียวตอนรัน ⇒ ลำดับไฟล์ไม่สำคัญ เรียกฟังก์ชันข้ามไฟล์ได้เลย
// เลขนำหน้าชื่อไฟล์มีไว้ให้คนอ่านเรียงตามลำดับความสำคัญเท่านั้น
// ══════════════════════════════════════════════════════════════════════

// ต้องตรงกับ GIVE_SHEET_TOKEN ใน src/utils/endpoints.js (client ส่งค่านี้มาใน data.token ทุก request)
var SHEET_TOKEN = 'umt-7Kp2xQ9mZr4Wv8Td'
var VOLUNTEER_SHEET_ID = '1HANcunEVvMQFSEY84WSS41jqmUPCm1QkfatX_xXiZj0'

// ขยับเลขนี้ทุกครั้งที่แก้แล้ว deploy ใหม่ — เปิด URL ของ Web App แล้วดูค่า version
// จะรู้ทันทีว่าโค้ดที่รันอยู่จริงเป็นชุดล่าสุดหรือยัง (เคยเจอปัญหาแก้แล้วแต่ deploy ไม่ขึ้น)
var SCRIPT_VERSION = '2026-07-31.1'

var ADMIN_EMAIL = 'ummatee.thailand@gmail.com'

/** ตอบกลับเป็น JSON เสมอ — ฝั่ง client เช็คว่า body ขึ้นต้นด้วย { เพื่อแยกจากหน้า error HTML ของ Google */
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

/** ป้องกัน HTML/markup injection ในอีเมลจากฟิลด์ที่ผู้ใช้กรอกเอง */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
