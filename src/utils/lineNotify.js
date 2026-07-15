import { VOLUNTEER_ENDPOINT, GIVE_SHEET_TOKEN, fetchWithTimeout } from './endpoints.js'

// แจ้งเตือนสถานะคำสั่งซื้อผ่าน LINE — ทำงานเฉพาะออเดอร์ที่ลูกค้าลงทะเบียนด้วย LINE
// (มี customer.lineUserId) ส่งผ่าน Apps Script (ถือ channel access token ฝั่ง server)
// เป็น best-effort: ล้มเหลวเงียบๆ ไม่กระทบการอัปเดตสถานะออเดอร์

const trackUrl = (orderId) => `https://ummatee-app.web.app/um-shop/order/${orderId}`

const MESSAGES = {
  payment_confirmed: (o) =>
    `✅ ยืนยันการชำระเงินแล้ว\nคำสั่งซื้อ ${o.orderCode} กำลังเตรียมการจัดส่ง\n\nติดตามสถานะ: ${trackUrl(o.id)}`,
  shipping: (o, extra) =>
    `📦 คำสั่งซื้อ ${o.orderCode} จัดส่งแล้ว\n${extra?.trackingNumber ? `เลขพัสดุ: ${extra.trackingNumber}\n` : ''}\nติดตามสถานะ: ${trackUrl(o.id)}`,
  shipping_update: (o, extra) =>
    `🚚 อัปเดตการจัดส่ง ${o.orderCode}\n${extra?.text || ''}\n\nติดตามสถานะ: ${trackUrl(o.id)}`,
  delivered: (o) =>
    `🎉 คำสั่งซื้อ ${o.orderCode} จัดส่งเรียบร้อยแล้ว\nขอบคุณที่อุดหนุน Um Shop — รายได้นำไปช่วยเหลือผู้ยากไร้\nJazakallahu khairan 💚`,
}

export function notifyLineOrderStatus(order, event, extra) {
  const lineUserId = order?.customer?.lineUserId
  const build = MESSAGES[event]
  if (!lineUserId || !build) return
  fetchWithTimeout(VOLUNTEER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: GIVE_SHEET_TOKEN, type: 'lineNotify', lineUserId, message: build(order, extra) }),
  }).catch(() => {})
}

// แจ้งเตือนแอดมิน (อีเมลเสมอ + LINE ถ้าตั้งค่าแล้ว) — best-effort ไม่กระทบ flow ลูกค้า
export function notifyAdmin(subject, message) {
  fetchWithTimeout(VOLUNTEER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ token: GIVE_SHEET_TOKEN, type: 'adminNotify', subject, message }),
  }).catch(() => {})
}

export function notifyAdminNewOrder(orderCode, total, customer, items) {
  const itemLines = (items || []).map((i) => `- ${i.name}${i.colors ? ` (${i.colors}${i.sizes ? '/' + i.sizes : ''})` : i.sizes ? ` (${i.sizes})` : ''} x${i.qty}`).join('\n')
  notifyAdmin(
    `🛒 ออเดอร์ใหม่ ${orderCode}`,
    `🛒 มีคำสั่งซื้อใหม่ ${orderCode}\nลูกค้า: ${customer.firstName} ${customer.lastName} (${customer.phone})\nยอดรวม: ฿${Number(total).toLocaleString('th-TH')}\n${itemLines}`
  )
}

export function notifyAdminPaymentDeclared(order) {
  notifyAdmin(
    `💰 แจ้งชำระเงิน ${order.orderCode}`,
    `💰 ลูกค้าแจ้งชำระเงินแล้ว: ${order.orderCode}\nยอด: ฿${Number(order.total).toLocaleString('th-TH')}\nกรุณาตรวจสลิปและกดยืนยันในหน้าแอดมิน`
  )
}
