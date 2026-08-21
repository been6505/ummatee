import { describe, it, expect } from 'vitest'
import { auditOrderTotals } from './orderAudit.js'

const order = (over = {}) => ({
  items: [{ name: 'เสื้อ', price: 250, qty: 2 }, { name: 'กระเป๋า', price: 150, qty: 1 }],
  itemsTotal: 650,
  shippingFee: 40,
  total: 690,
  ...over,
})

describe('auditOrderTotals', () => {
  it('ออเดอร์ปกติจากหน้าเว็บผ่าน', () => {
    expect(auditOrderTotals(order())).toEqual({ ok: true, issues: [] })
  })

  it('จับ itemsTotal ที่ถูกกดให้เป็น 0 ทั้งที่สินค้ายังมีราคา', () => {
    const r = auditOrderTotals(order({ itemsTotal: 0, total: 40 }))
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.includes('650'))).toBe(true)
  })

  it('จับยอดรวมที่ไม่เท่ากับค่าสินค้า + ค่าส่ง', () => {
    const r = auditOrderTotals(order({ total: 100 }))
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => i.includes('690'))).toBe(true)
  })

  it('ราคาเศษทศนิยมไม่ทำให้ฟ้องผิด (99.5 × 3 = 298.5)', () => {
    const o = { items: [{ name: 'ก', price: 99.5, qty: 3 }], itemsTotal: 298.5, shippingFee: 40, total: 338.5 }
    expect(auditOrderTotals(o).ok).toBe(true)
  })

  it('ค่าส่งฟรี (0 บาท) ยังผ่าน', () => {
    const o = { items: [{ name: 'ก', price: 100, qty: 1 }], itemsTotal: 100, shippingFee: 0, total: 100 }
    expect(auditOrderTotals(o).ok).toBe(true)
  })

  it('สินค้าแจกฟรีราคา 0 ไม่ถือว่าผิด — ผิดคือราคาติดลบ', () => {
    const free = { items: [{ name: 'ของแถม', price: 0, qty: 1 }], itemsTotal: 0, shippingFee: 40, total: 40 }
    expect(auditOrderTotals(free).ok).toBe(true)
    const neg = { items: [{ name: 'ก', price: -50, qty: 1 }], itemsTotal: -50, shippingFee: 40, total: -10 }
    expect(auditOrderTotals(neg).ok).toBe(false)
  })

  it('จำนวนเป็น 0 หรือติดลบถือว่าผิด', () => {
    expect(auditOrderTotals(order({ items: [{ name: 'ก', price: 10, qty: 0 }], itemsTotal: 0, total: 40 })).ok).toBe(false)
  })

  it('ออเดอร์ไม่มีรายการสินค้าถือว่าผิด และไม่ไปคำนวณต่อจนพัง', () => {
    expect(auditOrderTotals({ items: [], itemsTotal: 0, shippingFee: 40, total: 40 }).ok).toBe(false)
    expect(auditOrderTotals({}).ok).toBe(false)
    expect(auditOrderTotals(null).ok).toBe(false)
  })

  it('ฟิลด์หายไปทั้งหมดไม่ทำให้โยน error (ออเดอร์เก่าที่ข้อมูลไม่ครบ)', () => {
    expect(() => auditOrderTotals({ items: [{ name: 'ก' }] })).not.toThrow()
  })
})
