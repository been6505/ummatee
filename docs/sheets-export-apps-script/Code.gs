/**
 * Ummatee — ส่งข้อมูลจากหน้าแอดมินเข้า Google Sheets
 * ═══════════════════════════════════════════════════════════════════
 * วิธีติดตั้ง (ทำครั้งเดียว)
 * ═══════════════════════════════════════════════════════════════════
 * 1) สร้าง Google Sheet ใหม่ 1 ไฟล์ (จะใช้เก็บทุกตาราง แยกเป็นชีตย่อยตามชนิดข้อมูล)
 *    คัดลอก "ID" ของไฟล์จาก URL มาใส่ SHEET_ID ด้านล่าง
 *    URL หน้าตาแบบนี้: docs.google.com/spreadsheets/d/<<< ID อยู่ตรงนี้ >>>/edit
 *
 * 2) ที่ Google Sheet นั้น → Extensions → Apps Script → วางโค้ดไฟล์นี้ทับทั้งหมด
 *
 * 3) ตั้ง EXPORT_TOKEN เป็นรหัสสุ่มยาวๆ ของตัวเอง (อย่าใช้ค่าตัวอย่าง)
 *    แล้วเอารหัสเดียวกันไปใส่ SHEETS_EXPORT_TOKEN ใน src/utils/endpoints.js
 *
 * 4) Deploy → New deployment → เลือก type "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    กด Deploy แล้วคัดลอก Web app URL มาใส่ SHEETS_EXPORT_ENDPOINT ใน src/utils/endpoints.js
 *
 * 5) แก้โค้ดครั้งต่อไปต้อง Deploy → Manage deployments → แก้เป็น New version ทุกครั้ง
 *    ไม่งั้น URL เดิมจะยังรันโค้ดเวอร์ชันเก่า
 * ═══════════════════════════════════════════════════════════════════
 *
 * หมายเหตุความปลอดภัย: EXPORT_TOKEN อยู่ใน JS bundle ฝั่งเบราว์เซอร์ ใครก็อ่านได้
 * จึงเป็นแค่การกันยิงมั่วจากภายนอก ไม่ใช่ความลับจริง — สคริปต์นี้จึง "เขียนเท่านั้น"
 * ห้ามเพิ่มคำสั่งที่อ่านข้อมูลออกจากชีตกลับไปให้ client เด็ดขาด (ดูเหตุผลใน endpoints.js)
 */

var SHEET_ID = 'ใส่ ID ของ Google Sheet ที่นี่'
var EXPORT_TOKEN = 'เปลี่ยนเป็นรหัสสุ่มของตัวเอง'

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents)

    if (body.token !== EXPORT_TOKEN) {
      return json({ ok: false, error: 'unauthorized' })
    }

    var sheetName = String(body.sheetName || '').slice(0, 80)
    var headers = body.headers
    var rows = body.rows

    if (!sheetName || !Array.isArray(headers) || !Array.isArray(rows)) {
      return json({ ok: false, error: 'bad request' })
    }
    // กันยัดข้อมูลใหญ่เกินจนสคริปต์ timeout (Apps Script จำกัดเวลารันต่อครั้ง)
    if (rows.length > 5000) {
      return json({ ok: false, error: 'too many rows (max 5000)' })
    }

    var ss = SpreadsheetApp.openById(SHEET_ID)
    var sheet = ss.getSheetByName(sheetName)
    if (!sheet) sheet = ss.insertSheet(sheetName)

    // เขียนทับทั้งชีตทุกครั้ง (snapshot ล่าสุด) ไม่ต่อท้าย — กันข้อมูลซ้ำเวลากดส่งหลายรอบ
    sheet.clear()
    var values = [headers].concat(rows.map(function (r) {
      // บังคับให้ทุกแถวยาวเท่า headers ไม่งั้น setValues โยน error เรื่องขนาดไม่ตรง
      var out = []
      for (var i = 0; i < headers.length; i++) {
        var v = r[i]
        out.push(v === null || v === undefined ? '' : v)
      }
      return out
    }))
    sheet.getRange(1, 1, values.length, headers.length).setValues(values)
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e8f5e9')
    sheet.setFrozenRows(1)

    // แถวสรุปว่าอัปเดตล่าสุดเมื่อไหร่ — ไว้เช็คว่าข้อมูลที่เห็นสดแค่ไหน
    sheet.getRange(values.length + 2, 1)
      .setValue('อัปเดตล่าสุด: ' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss'))
      .setFontColor('#888')

    return json({ ok: true, sheetName: sheetName, rows: rows.length })
  } catch (err) {
    return json({ ok: false, error: String(err) })
  }
}

// ปิดการอ่านผ่าน GET เด็ดขาด — endpoint นี้ต้องเป็นทางเดียว (เขียนเข้าเท่านั้น)
// ถ้าเปิดให้อ่าน ใครที่เห็น token ใน bundle ก็ดึงข้อมูลผู้บริจาค/ผู้ลงทะเบียนทั้งหมดออกไปได้
function doGet() {
  return json({ ok: false, error: 'disabled' })
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
