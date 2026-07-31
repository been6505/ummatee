// ══════════════════════════════════════════════════════════════════════
// แจ้งสถานะคำสั่งซื้อไปหาลูกค้าทาง LINE (um-shop)
//
// ต้องตั้ง Script Property ชื่อ LINE_CHANNEL_ACCESS_TOKEN (จาก LINE Messaging API channel
// ของ OA @745bvvgx — Provider เดียวกับ LINE Login channel) และลูกค้าต้องเป็นเพื่อนกับ OA
//
// ⚠️ ความปลอดภัย: ห้ามรับ lineUserId/ข้อความ จากผู้เรียกเด็ดขาด — SHEET_TOKEN เป็น token ฝั่ง client
// ที่ใครเปิด bundle ก็อ่านได้ ถ้ารับผู้รับ+ข้อความมาตรงๆ เท่ากับใครก็สั่งให้ LINE OA ของมูลนิธิ
// ส่งข้อความอะไรก็ได้ไปหาผู้ติดตามคนไหนก็ได้ (ปลอมเป็นมูลนิธิหลอกให้โอนเงินได้)
//
// จึงรับแค่ orderId + event แล้วมา "อ่านผู้รับจากตัวออเดอร์เอง" ผ่าน Firestore REST
// (orders มี allow get: if true อ่านทีละ doc ได้โดยไม่ต้องล็อกอิน) และประกอบข้อความจากเทมเพลตในนี้เท่านั้น
// ผลคือ: ต่อให้รู้ token ก็ส่งได้แค่ข้อความมาตรฐานไปหาลูกค้าเจ้าของออเดอร์นั้นเอง (ต้องรู้ orderId
// ซึ่งเป็น random id 20 ตัวอักษร เดาไม่ได้) ส่งหาคนอื่นหรือเขียนข้อความเองไม่ได้
// ══════════════════════════════════════════════════════════════════════
function handleLineNotify(data) {
  var lineToken = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN')
  if (!lineToken) return jsonOut({ error: 'no token configured' })
  if (!data.orderId || !data.event) return jsonOut({ error: 'missing orderId/event' })

  // อ่านออเดอร์จาก Firestore (ไม่ต้องใช้ credential เพราะ rules เปิด get ให้อ่านทีละ doc ได้)
  var fsUrl = 'https://firestore.googleapis.com/v1/projects/ummatee-app/databases/(default)/documents/orders/'
    + encodeURIComponent(String(data.orderId))
  var fsRes = UrlFetchApp.fetch(fsUrl, { muteHttpExceptions: true })
  if (fsRes.getResponseCode() !== 200) return jsonOut({ error: 'order not found' })

  var fields = (JSON.parse(fsRes.getContentText()) || {}).fields || {}
  var orderCode = (fields.orderCode || {}).stringValue || ''
  var custFields = ((fields.customer || {}).mapValue || {}).fields || {}
  var lineUserId = (custFields.lineUserId || {}).stringValue || ''
  if (!lineUserId) return jsonOut({ ok: false, reason: 'no lineUserId on order' })

  // ข้อความสร้างจากเทมเพลตในนี้เท่านั้น ผู้เรียกเติมได้แค่เลขพัสดุ/ข้อความอัปเดตสั้นๆ (คุมความยาว)
  var track = 'https://ummatee-app.web.app/um-shop/order/' + data.orderId
  var tracking = String(data.trackingNumber || '').slice(0, 40)
  var updateText = String(data.text || '').slice(0, 200)

  var templates = {
    payment_confirmed: '✅ ยืนยันการชำระเงินแล้ว\nคำสั่งซื้อ ' + orderCode + ' กำลังเตรียมการจัดส่ง\n\nติดตามสถานะ: ' + track,
    shipping: '📦 คำสั่งซื้อ ' + orderCode + ' จัดส่งแล้ว\n' + (tracking ? 'เลขพัสดุ: ' + tracking + '\n' : '') + '\nติดตามสถานะ: ' + track,
    shipping_update: '🚚 อัปเดตการจัดส่ง ' + orderCode + '\n' + updateText + '\n\nติดตามสถานะ: ' + track,
    delivered: '🎉 คำสั่งซื้อ ' + orderCode + ' จัดส่งเรียบร้อยแล้ว\nขอบคุณที่อุดหนุน um-shop — รายได้นำไปช่วยเหลือผู้ยากไร้\nJazakallahu khairan 💚',
  }

  var text = templates[data.event]
  if (!text) return jsonOut({ error: 'unknown event' })

  var resp = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + lineToken },
    payload: JSON.stringify({ to: lineUserId, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true,
  })
  return jsonOut({ ok: resp.getResponseCode() === 200, code: resp.getResponseCode() })
}
