import { describe, it, expect } from 'vitest'
import { applyPromotion, hasDiscount, effectivePrice, discountPercent } from './pricing.js'

// เทสต์ logic เงินทั้งหมดของ Um Shop — กันพังเงียบๆ เวลาแก้โค้ด
// รัน: npm test

describe('applyPromotion', () => {
  it('ลดเป็นเปอร์เซ็นต์', () => {
    expect(applyPromotion(100, { type: 'percent', value: 10 })).toBe(90)
    expect(applyPromotion(290, { type: 'percent', value: 26 })).toBe(214.6)
  })
  it('ลดเป็นจำนวนเงิน', () => {
    expect(applyPromotion(100, { type: 'amount', value: 30 })).toBe(70)
  })
  it('ไม่ติดลบแม้ส่วนลดเกินราคา', () => {
    expect(applyPromotion(50, { type: 'amount', value: 100 })).toBe(0)
    expect(applyPromotion(50, { type: 'percent', value: 150 })).toBe(0)
  })
  it('ปัดเศษ 2 ตำแหน่ง', () => {
    expect(applyPromotion(99.99, { type: 'percent', value: 33 })).toBe(66.99)
  })
  it('ข้อมูลเพี้ยน (ค่าว่าง/ไม่ใช่ตัวเลข) ไม่ทำให้ crash', () => {
    expect(applyPromotion(undefined, { type: 'percent', value: 10 })).toBe(0)
    expect(applyPromotion(100, { type: 'percent', value: 'abc' })).toBe(100)
  })
})

describe('hasDiscount / effectivePrice / discountPercent', () => {
  it('มีส่วนลดจริง — discountPrice น้อยกว่าราคาเต็ม', () => {
    const p = { price: 390, discountPrice: 290 }
    expect(hasDiscount(p)).toBe(true)
    expect(effectivePrice(p)).toBe(290)
    expect(discountPercent(p)).toBe(26)
  })
  it('ไม่มี discountPrice — ใช้ราคาเต็ม', () => {
    const p = { price: 390 }
    expect(hasDiscount(p)).toBe(false)
    expect(effectivePrice(p)).toBe(390)
  })
  it('discountPrice >= ราคาเต็ม ไม่นับเป็นส่วนลด (ข้อมูลเพี้ยน)', () => {
    expect(hasDiscount({ price: 100, discountPrice: 100 })).toBe(false)
    expect(hasDiscount({ price: 100, discountPrice: 150 })).toBe(false)
    expect(effectivePrice({ price: 100, discountPrice: 150 })).toBe(100)
  })
  it('สินค้าไม่มีราคา — effectivePrice เป็น 0 ไม่ใช่ NaN', () => {
    expect(effectivePrice({})).toBe(0)
  })
})

describe('การคิดยอดออเดอร์ (ตรรกะเดียวกับ createOrder + firestore.rules)', () => {
  // rules บังคับ total == itemsTotal + shippingFee เป๊ะแบบ float — จำลองการคำนวณฝั่ง client
  const orderTotals = (items, shippingFee = 50) => {
    const raw = items.reduce((s, i) => s + i.price * i.qty, 0)
    const itemsTotal = Math.round(raw * 100) / 100
    return { itemsTotal, total: itemsTotal + shippingFee }
  }

  it('ยอดปกติ', () => {
    const { itemsTotal, total } = orderTotals([{ price: 290, qty: 2 }])
    expect(itemsTotal).toBe(580)
    expect(total).toBe(630)
  })
  it('ราคามีเศษสตางค์ ×3 — ปัดแล้ว total ต้องเท่ากับ itemsTotal + ค่าส่ง แบบ float เป๊ะ', () => {
    const { itemsTotal, total } = orderTotals([{ price: 99.5, qty: 3 }])
    expect(itemsTotal).toBe(298.5)
    expect(total === itemsTotal + 50).toBe(true) // เงื่อนไขเดียวกับ rules
  })
  it('หลายรายการรวมกัน', () => {
    const { total } = orderTotals([
      { price: 214.6, qty: 1 }, // ราคาหลังโปรโมชั่น 26%
      { price: 99.99, qty: 2 },
    ])
    expect(total).toBe(214.6 + 199.98 + 50)
  })
})
