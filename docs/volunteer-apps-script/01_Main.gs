// ══════════════════════════════════════════════════════════════════════
// ตัวรับ request และกระจายงาน (router) — ไม่มี logic ของงานใดงานหนึ่งในไฟล์นี้
// เพิ่มงานใหม่: สร้างไฟล์ handler แล้วมาเพิ่มบรรทัดใน HANDLERS
// ══════════════════════════════════════════════════════════════════════

// data.type → ฟังก์ชันที่รับผิดชอบ (นิยามอยู่ในไฟล์ของงานนั้นๆ)
// ไม่ประกาศเป็น object ตรงนี้เพราะฟังก์ชันในไฟล์อื่นอาจยังไม่ถูกนิยามตอนไฟล์นี้ถูกอ่าน
// ⇒ อ้างถึงตอนเรียกใช้จริงแทน (ดู doPost)
function getHandler(type) {
  if (type === 'adminNotify') return handleAdminNotify
  if (type === 'lineNotify') return handleLineNotify
  if (type === 'volunteer') return handleVolunteer
  if (type === 'b2um') return handleB2um
  return null
}

var HANDLER_TYPES = ['adminNotify', 'lineNotify', 'volunteer', 'b2um', '(default) iftar']

// ⚠️ ความปลอดภัย: doGet เดิม (token === SHEET_TOKEN) เปิดให้ใครก็ได้ที่รู้ token ดึง PII
// (ชื่อ/เบอร์/อีเมล/ที่อยู่) ของอาสาสมัครและผู้ลงทะเบียน Iftar ทั้งหมดออกไปได้ โดยไม่ต้องล็อกอิน
// เว็บเลย และ token นั้นก็ฝังอยู่ใน client bundle อยู่ดี — ปิดการอ่าน PII ผ่าน Apps Script ทั้งหมด
// อ่านข้อมูลผ่านหน้า /admin (Firestore + rules) เท่านั้น คงไว้แค่ count (ไม่มี PII)
function doGet(e) {
  if (e && e.parameter && e.parameter.count) {
    var ss = SpreadsheetApp.getActiveSpreadsheet()
    var sheet = ss.getSheetByName('Registrations') || ss.getActiveSheet()
    var lastRow = sheet.getLastRow()
    return jsonOut({ count: lastRow > 1 ? lastRow - 1 : 0 })
  }

  // สถานะการ deploy — ไม่มี PII และไม่ส่งอีเมลใดๆ ใช้ยืนยันว่า URL นี้รันโค้ดชุดไหนอยู่
  // (เคยเจอว่า endpoint ตอบ 405 เพราะสคริปต์ที่ deploy อยู่ไม่มี doPost เลย แต่ไม่มีอะไรบอก)
  return jsonOut({ ok: true, version: SCRIPT_VERSION, handlers: HANDLER_TYPES })
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents)

    // --- [ชั่วคราว] LINE Webhook event logger — ใช้หา ADMIN_LINE_USER_ID ครั้งเดียวตอนตั้งค่า ---
    // LINE ส่ง payload เป็น { events: [...] } ไม่มี data.token เลย เช็คก่อนโดน SHEET_TOKEN gate ด้านล่างปัดตก
    // เมื่อมีคนทัก OA จะ log userId ไว้ใน Executions ให้เอาไปตั้งเป็น Script Property — ลบ block นี้ทิ้งหลังใช้เสร็จ
    if (data.events) {
      data.events.forEach(function (ev) {
        Logger.log('LINE event type=' + ev.type + ' userId=' + (ev.source && ev.source.userId))
      })
      return jsonOut({ ok: true })
    }

    // ⚠️ ความปลอดภัย: ก่อนหน้านี้ endpoint นี้ไม่ตรวจ token เลยสักฟังก์ชัน — ใครก็ได้ที่เจอ URL นี้
    // (public constant ใน src/utils/endpoints.js) สามารถยิง POST ตรงมาสั่งส่งอีเมล/LINE ข้อความ
    // "ใดก็ได้" ถึงผู้รับ "ใดก็ได้" ผ่านบัญชี Gmail/LINE OA ของมูลนิธิ (adminNotify/lineNotify)
    // — เสี่ยงถูกใช้เป็น open relay สแปม/ฟิชชิ่งจนบัญชีโดนแบน ต้องตรวจ token ก่อนทำงานทุก action
    // (token เป็น public write-token — กันบอท/การเจอ URL มั่วๆ ไม่ใช่การยืนยันตัวตนจริงจัง
    // แต่ดีกว่าเปิดโล่งไม่มีอะไรกั้นเลย)
    if (data.token !== SHEET_TOKEN) {
      return jsonOut({ error: 'unauthorized' })
    }

    var handler = getHandler(data.type)
    if (handler) return handler(data)

    // ไม่ระบุ type = ลงทะเบียน Iftar (พฤติกรรมเดิมของ endpoint นี้ ห้ามเปลี่ยน —
    // ฟอร์ม Iftar ที่ deploy อยู่ยังยิงมาโดยไม่ส่ง type)
    return handleIftar(data)

  } catch (err) {
    return jsonOut({ error: err.message })
  }
}
