// สถานะคำสั่งซื้อ — แยกจาก orders.js เพราะไฟล์นั้น import firebase.js (ต้องมี DOM)
// ทำให้เทสต์ตรรกะสถานะไม่ได้เลย ที่นี่เป็นฟังก์ชันล้วน ไม่มี dependency
//
// ลำดับสถานะ: pending_payment → preparing → shipped (3 ขั้น)
//
// เดิมมี 4 ขั้น (แยก 'กำลังจัดส่ง' กับ 'จัดส่งเรียบร้อย') แต่ร้านไม่มีทางรู้ว่าของถึงมือลูกค้าเมื่อไร
// ต้องมากดเองซึ่งไม่มีใครกด ออเดอร์เลยค้างที่ 'กำลังจัดส่ง' ตลอด — ขั้นสุดท้ายจึงเหลือ "จัดส่งแล้ว"
// (ส่งของออกจากร้าน + มีเลขพัสดุ) แล้วให้ลูกค้าไปดูสถานะจริงที่เว็บขนส่งผ่านลิงก์เลขพัสดุแทน
export const STATUS_STEPS = ['pending_payment', 'preparing', 'shipped']

export const STATUS_LABEL = {
  pending_payment: 'รอชำระเงิน',
  preparing: 'เตรียมจัดส่ง',
  shipped: 'จัดส่งแล้ว',
}

// ออเดอร์เก่าที่บันทึกไว้ก่อนลดเหลือ 3 ขั้น ยังมี status เดิมอยู่ใน Firestore
// map ตอนอ่านแทนการไล่แก้ข้อมูลย้อนหลัง (ปลอดภัยกว่า และออเดอร์เก่ายังเปิดดูได้ปกติ)
const LEGACY_STATUS = { shipping: 'shipped', delivered: 'shipped' }
export const normOrderStatus = (status) => LEGACY_STATUS[status] || status

// สถานะที่ไม่รู้จัก (เช่น 'reviewed' จาก order เก่าก่อนตัดระบบรีวิว) ให้นับเป็นขั้นสุดท้าย
export const stepIndex = (status) => {
  const i = STATUS_STEPS.indexOf(normOrderStatus(status))
  return i >= 0 ? i : STATUS_STEPS.length - 1
}
