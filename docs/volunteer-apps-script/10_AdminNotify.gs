// ══════════════════════════════════════════════════════════════════════
// แจ้งเตือนแอดมิน — ออเดอร์ใหม่ / ลูกค้าแจ้งชำระเงิน / สต็อกใกล้หมด (um-shop)
// ส่งอีเมลถึง ADMIN_EMAIL เสมอ + ส่ง LINE ด้วยถ้าตั้ง Script Properties ครบ
// (LINE_CHANNEL_ACCESS_TOKEN และ ADMIN_LINE_USER_ID = userId ของแอดมิน/กลุ่มที่ให้บอทแจ้ง)
// ══════════════════════════════════════════════════════════════════════
function handleAdminNotify(data) {
  var subj = data.subject || 'um-shop แจ้งเตือน'
  var msg = String(data.message || '').slice(0, 4000)
  if (!msg) return jsonOut({ error: 'missing message' })

  var mailed = false
  try {
    GmailApp.sendEmail(ADMIN_EMAIL, subj,
      msg + '\n\nเปิดหน้าจัดการ: https://ummatee-app.web.app/admin/shop/orders')
    mailed = true
  } catch (mailErr) { Logger.log('adminNotify mail error: ' + mailErr.message) }

  var props = PropertiesService.getScriptProperties()
  var aToken = props.getProperty('LINE_CHANNEL_ACCESS_TOKEN')
  var adminLineId = props.getProperty('ADMIN_LINE_USER_ID')
  var lined = false
  if (aToken && adminLineId) {
    try {
      var r = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + aToken },
        payload: JSON.stringify({ to: adminLineId, messages: [{ type: 'text', text: msg }] }),
        muteHttpExceptions: true,
      })
      lined = r.getResponseCode() === 200
    } catch (lineErr) { Logger.log('adminNotify line error: ' + lineErr.message) }
  }

  // บอกกลับว่าช่องไหนสำเร็จบ้าง — เดิมตอบ ok:true เสมอแม้อีเมลจะส่งไม่ออก
  return jsonOut({ ok: true, mailed: mailed, lined: lined })
}
