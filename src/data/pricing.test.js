import { describe, it, expect } from 'vitest'
import { applyPromotion, hasDiscount, effectivePrice, discountPercent, groupProductsByName, dedupeSortSizes } from './pricing.js'

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

describe('groupProductsByName — รวมสินค้าชื่อเดียวกัน (คนละสี = คนละ doc) เป็นกลุ่มเดียว', () => {
  const products = [
    { id: 'a', name: 'เสื้อ um', price: 250, discountPrice: 225, stock: 10, createdAt: 2 },
    { id: 'b', name: 'เสื้อ um', price: 250, stock: 5, createdAt: 1 },
    { id: 'c', name: 'กระเป๋า', price: 379, stock: 47, createdAt: 3 },
  ]

  it('รวมชื่อเดียวกันเป็นกลุ่มเดียว และเรียง variant ตาม createdAt', () => {
    const groups = groupProductsByName(products)
    expect(groups).toHaveLength(2)
    const shirt = groups.find((g) => g.name === 'เสื้อ um')
    expect(shirt.variants.map((v) => v.id)).toEqual(['b', 'a']) // createdAt 1 มาก่อน
    expect(shirt.primary.id).toBe('b')
  })

  it('totalStock / minPrice / maxPrice / anyDiscount ถูกต้อง', () => {
    const shirt = groupProductsByName(products).find((g) => g.name === 'เสื้อ um')
    expect(shirt.totalStock).toBe(15)
    expect(shirt.minPrice).toBe(225) // ราคาหลังส่วนลดของ doc a
    expect(shirt.maxPrice).toBe(250)
    expect(shirt.anyDiscount).toBe(true)
  })

  it('ชื่อว่าง ใช้ id เป็น key — ไม่ถูกจับกลุ่มรวมกันมั่ว', () => {
    const groups = groupProductsByName([
      { id: 'x', name: '', price: 10, stock: 1 },
      { id: 'y', name: '', price: 20, stock: 1 },
    ])
    expect(groups).toHaveLength(2)
  })

  it('stock ไม่ใช่ตัวเลข ไม่ทำให้ totalStock เป็น NaN', () => {
    const groups = groupProductsByName([
      { id: 'x', name: 'ของ', price: 10, stock: 'เยอะ' },
      { id: 'y', name: 'ของ', price: 10, stock: 3 },
    ])
    expect(groups[0].totalStock).toBe(3)
  })
})

describe('dedupeSortSizes — ตัดไซซ์ซ้ำ + เรียงตามลำดับมาตรฐานของหมวดหมู่', () => {
  it('หมวดเสื้อ: เรียง S,M,L,XL,... เสมอ ไม่ว่าบันทึกมาลำดับไหน', () => {
    expect(dedupeSortSizes(['XL', 'S', '2XL', 'M', 'L'], 'เสื้อ')).toEqual(['S', 'M', 'L', 'XL', '2XL'])
  })

  it('ตัดค่าซ้ำ + ตัดช่องว่างรอบข้าง', () => {
    expect(dedupeSortSizes(['S', ' S ', 'M', 'M'], 'เสื้อ')).toEqual(['S', 'M'])
  })

  it('ไซซ์แปลกที่ไม่อยู่ในลิสต์มาตรฐาน ต่อท้ายไม่หาย', () => {
    const out = dedupeSortSizes(['พิเศษ', 'S'], 'เสื้อ')
    expect(out[0]).toBe('S')
    expect(out).toContain('พิเศษ')
  })

  it('หมวดที่ไม่มีลิสต์มาตรฐาน — แค่ตัดซ้ำ ไม่เรียงใหม่', () => {
    expect(dedupeSortSizes(['500ml', '350ml', '500ml'], 'กระบอกน้ำ')).toEqual(['500ml', '350ml'])
  })

  it('ไม่มีข้อมูล — คืน array ว่าง ไม่ crash', () => {
    expect(dedupeSortSizes(undefined, undefined)).toEqual([])
    expect(dedupeSortSizes([], 'เสื้อ')).toEqual([])
  })
})
