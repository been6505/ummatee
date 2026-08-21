// ตรวจว่าตัวเลขเงินในออเดอร์ "สอดคล้องกันเอง" หรือไม่ — ไม่ต้องพึ่งเซิร์ฟเวอร์
//
// ที่มา: firestore.rules ตรวจได้แค่ total == itemsTotal + shippingFee เทียบราคาสินค้าจริงไม่ได้
// (ภาษา rules ไม่มีลูปให้บวกผลรวมทั้งตะกร้า) ส่วน src/data/orders.js คิดราคาใหม่จาก Firestore
// ใน transaction อยู่แล้ว แต่นั่นเป็นโค้ดฝั่งเบราว์เซอร์ คนที่ยิง Firestore SDK ตรงข้ามไปได้
//
// ตัวนี้จับ "ออเดอร์ที่ตัวเลขในตัวมันเองยังไม่ตรงกัน" ซึ่งเป็นร่องรอยของการยิงเข้ามาเอง เช่นตั้ง
// itemsTotal เป็น 0 ทั้งที่ items ยังมีราคาเต็มอยู่ — ออเดอร์ที่สั่งผ่านหน้าเว็บจริงจะผ่านเสมอ
// เพราะทุกตัวเลขคิดมาจากชุดเดียวกันใน transaction เดียว
//
// สิ่งที่ "ไม่" ครอบคลุม: กรณีที่แก้ทั้ง items[].price และ itemsTotal ให้สอดคล้องกันเอง —
// เคสนั้นจับด้วยการเทียบกับราคาสินค้าปัจจุบัน ซึ่งหน้าออเดอร์แอดมินทำอยู่แยกต่างหากแล้ว

// ปัดทศนิยม 2 ตำแหน่งแบบเดียวกับ createOrder — ราคาอย่าง 99.5 × 3 ต้องลงเอยเท่ากันทั้งสองฝั่ง
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export function auditOrderTotals(order) {
  const issues = []
  const items = Array.isArray(order?.items) ? order.items : []

  if (items.length === 0) {
    issues.push('ออเดอร์ไม่มีรายการสินค้า')
    return { ok: false, issues }
  }

  for (const it of items) {
    const price = Number(it?.price)
    const qty = Number(it?.qty)
    if (!Number.isFinite(price) || price < 0) issues.push(`"${it?.name || 'สินค้า'}" ราคาในออเดอร์ไม่ถูกต้อง`)
    if (!Number.isFinite(qty) || qty <= 0) issues.push(`"${it?.name || 'สินค้า'}" จำนวนไม่ถูกต้อง`)
  }

  const sum = round2(items.reduce((s, it) => s + (Number(it?.price) || 0) * (Number(it?.qty) || 0), 0))
  const itemsTotal = round2(order?.itemsTotal)
  if (sum !== itemsTotal) {
    issues.push(`ผลรวมรายการสินค้าได้ ฿${sum} แต่ในออเดอร์บันทึกไว้ ฿${itemsTotal}`)
  }

  const total = round2(order?.total)
  const expectedTotal = round2(itemsTotal + round2(order?.shippingFee))
  if (total !== expectedTotal) {
    issues.push(`ยอดรวมควรเป็น ฿${expectedTotal} แต่ในออเดอร์บันทึกไว้ ฿${total}`)
  }

  return { ok: issues.length === 0, issues }
}
