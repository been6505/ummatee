import { VOLUNTEER_ENDPOINT, GIVE_SHEET_TOKEN, fetchWithTimeout } from './endpoints.js'

// แจ้งเตือนสถานะคำสั่งซื้อผ่าน LINE — ทำงานเฉพาะออเดอร์ที่ลูกค้าลงทะเบียนด้วย LINE
// (มี customer.lineUserId) ส่งผ่าน Apps Script (ถือ channel access token ฝั่ง server)
// เป็น best-effort: ล้มเหลวเงียบๆ ไม่กระทบการอัปเดตสถานะออเดอร์

// เนื้อความทั้งหมดย้ายไปอยู่ฝั่ง Apps Script แล้ว (ดู docs/volunteer-apps-script/Code.gs)
// เพราะ GIVE_SHEET_TOKEN เป็น token ที่อ่านได้จาก bundle — ถ้าฝั่งนี้ยังส่งผู้รับ+ข้อความไปเอง
// ใครก็สั่ง LINE OA ของมูลนิธิให้ส่งข้อความอะไรก็ได้ไปหาผู้ติดตามคนไหนก็ได้ ที่นี่จึงส่งแค่
// orderId + ชื่อ event ให้ Apps Script ไปอ่านผู้รับจากตัวออเดอร์และประกอบข้อความเองทั้งหมด
const LINE_EVENTS = ['payment_confirmed', 'shipping', 'shipping_update', 'delivered']

export function notifyLineOrderStatus(order, event, extra) {
  // ยังเช็ค lineUserId ฝั่งนี้ไว้เพื่อไม่ยิง request ที่ยังไงก็ไม่ได้ส่ง (ฝั่ง server เช็คซ้ำอยู่แล้ว)
  if (!order?.id || !order?.customer?.lineUserId || !LINE_EVENTS.includes(event)) return
  fetchWithTimeout(VOLUNTEER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      token: GIVE_SHEET_TOKEN,
      type: 'lineNotify',
      orderId: order.id,
      event,
      trackingNumber: extra?.trackingNumber || '',
      text: extra?.text || '',
    }),
  }).catch(() => {})
}

// แจ้งเตือนแอดมิน (อีเมลเสมอ + LINE ถ้าตั้งค่าแล้ว) — best-effort ไม่กระทบ flow ลูกค้า
//
// ยังกลืน error ไม่ให้กระทบการสั่งซื้อ แต่ "บอกใน console" ด้วย — เดิมเงียบสนิท (.catch(() => {}))
// จึงไม่มีใครรู้เลยว่าอีเมลแจ้งออเดอร์ไม่เคยถูกส่ง ถ้า Apps Script ยังไม่ได้ deploy หรือ deploy ผิดเวอร์ชัน
// (Apps Script ตอบ 200 พร้อมหน้า HTML ได้ทั้งที่ทำงานไม่สำเร็จ จึงเช็ค JSON ที่ควรได้กลับมาด้วย)
export function notifyAdmin(subject, message) {
  fetchWithTimeout(VOLUNTEER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: GIVE_SHEET_TOKEN, type: 'adminNotify', subject, message }),
  })
    .then(async (res) => {
      const body = await res.text().catch(() => '')
      if (!res.ok || !body.trim().startsWith('{')) {
        console.warn(`[notifyAdmin] ส่งแจ้งเตือนไม่สำเร็จ (HTTP ${res.status}) — ตรวจการ deploy ของ Apps Script`, { subject })
      }
    })
    .catch((e) => console.warn('[notifyAdmin] ส่งแจ้งเตือนไม่สำเร็จ:', e?.message || e, { subject }))
}

export function notifyAdminNewOrder(orderCode, total, customer, items) {
  const itemLines = (items || []).map((i) => `- ${i.name}${i.colors ? ` (${i.colors}${i.sizes ? '/' + i.sizes : ''})` : i.sizes ? ` (${i.sizes})` : ''} x${i.qty}`).join('\n')
  notifyAdmin(
    `🛒 ออเดอร์ใหม่ ${orderCode}`,
    `🛒 มีคำสั่งซื้อใหม่ ${orderCode}\nลูกค้า: ${customer.fullName} (${customer.phone})\nยอดรวม: ฿${Number(total).toLocaleString('th-TH')}\n${itemLines}`
  )
}

export function notifyAdminPaymentDeclared(order) {
  notifyAdmin(
    `💰 แจ้งชำระเงิน ${order.orderCode}`,
    `💰 ลูกค้าแจ้งชำระเงินแล้ว: ${order.orderCode}\nยอด: ฿${Number(order.total).toLocaleString('th-TH')}\nกรุณาตรวจสลิปและกดยืนยันในหน้าแอดมิน`
  )
}

// แจ้งเตือนสต็อกใกล้หมด/หมด — ยิงตอนตัดสต็อกแล้ว "ข้าม" เกณฑ์ครั้งแรก (ดู createOrder ใน orders.js)
// กันสแปม: แจ้งเฉพาะตอนที่ stock เพิ่งลดลงมาต่ำกว่าเกณฑ์ ไม่ใช่ทุกครั้งที่ยังต่ำอยู่
export function notifyAdminLowStock(alerts) {
  if (!alerts || alerts.length === 0) return
  const lines = alerts.map((a) => `- ${a.name}${a.detail ? ` (${a.detail})` : ''}: เหลือ ${a.remaining} ชิ้น`).join('\n')
  notifyAdmin(
    `⚠️ สต็อกใกล้หมด (${alerts.length} รายการ)`,
    `⚠️ สินค้าต่อไปนี้สต็อกใกล้หมด/หมดแล้ว กรุณารับเข้าคลังเพิ่ม:\n${lines}`
  )
}

// แจ้งเตือนแอดมินมีข้อความแชทใหม่จากผู้เยี่ยมชม — กันสแปม: ต่อ 1 แชท แจ้งได้ไม่เกิน 1 ครั้งทุก 10 นาที
// (ผู้เยี่ยมชมพิมพ์หลายข้อความติดกันไม่ควรยิง LINE รัวๆ) เก็บ throttle ไว้ในหน่วยความจำฝั่ง browser พอ
const CHAT_NOTIFY_COOLDOWN_MS = 10 * 60 * 1000
const lastChatNotifyAt = new Map()
export function notifyAdminNewChatMessage(chatId, text) {
  const now = Date.now()
  const last = lastChatNotifyAt.get(chatId) || 0
  if (now - last < CHAT_NOTIFY_COOLDOWN_MS) return
  lastChatNotifyAt.set(chatId, now)
  notifyAdmin(
    '💬 ข้อความแชทใหม่',
    `💬 มีข้อความใหม่จากผู้เยี่ยมชมเว็บไซต์:\n"${text}"\n\nตอบกลับได้ที่หน้าแอดมิน: https://ummatee-app.web.app/admin/chat`
  )
}
