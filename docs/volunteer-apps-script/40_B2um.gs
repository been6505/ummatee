// ══════════════════════════════════════════════════════════════════════
// B2UM — ลงทะเบียนร้านค้า/ธุรกิจ (บันทึกลงชีต B2UM ไม่ส่งอีเมล)
// ══════════════════════════════════════════════════════════════════════
function handleB2um(data) {
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
  return jsonOut({ ok: true, ref: ref })
}
