import { describe, it, expect } from 'vitest'
import { STATUS_STEPS, STATUS_LABEL, stepIndex, normOrderStatus } from './orderStatus.js'

// สถานะคำสั่งซื้อลดจาก 4 ขั้นเหลือ 3 — ออเดอร์เก่าใน Firestore ยังมีค่าเดิมอยู่
// เทสต์ชุดนี้กันไม่ให้ออเดอร์เก่าแสดงผลเพี้ยนหรือหลุดออกนอกแถบสถานะ
describe('สถานะคำสั่งซื้อ 3 ขั้น', () => {
  it('มี 3 ขั้นตามลำดับที่ถูกต้อง', () => {
    expect(STATUS_STEPS).toEqual(['pending_payment', 'preparing', 'shipped'])
    expect(STATUS_STEPS.map((s) => STATUS_LABEL[s])).toEqual(['รอชำระเงิน', 'เตรียมจัดส่ง', 'จัดส่งแล้ว'])
  })

  it('ออเดอร์เก่า shipping/delivered ถูก map มาเป็น shipped', () => {
    expect(normOrderStatus('shipping')).toBe('shipped')
    expect(normOrderStatus('delivered')).toBe('shipped')
  })

  it('สถานะปัจจุบันไม่ถูกแปลง', () => {
    for (const s of STATUS_STEPS) expect(normOrderStatus(s)).toBe(s)
  })

  it('ทุกสถานะเก่าชี้ไปขั้นสุดท้าย ไม่ใช่ -1 (ซึ่งจะทำให้ stepper ว่างทั้งแถบ)', () => {
    for (const s of ['shipping', 'delivered']) expect(stepIndex(s)).toBe(2)
  })

  it('สถานะที่ไม่รู้จักตกไปขั้นสุดท้าย ไม่พัง', () => {
    expect(stepIndex('reviewed')).toBe(2)
    expect(stepIndex(undefined)).toBe(2)
    expect(stepIndex('')).toBe(2)
  })

  it('ขั้นแรกสุดคือรอชำระเงิน', () => {
    expect(stepIndex('pending_payment')).toBe(0)
    expect(stepIndex('preparing')).toBe(1)
    expect(stepIndex('shipped')).toBe(2)
  })

  it('ทุกขั้นมีป้ายภาษาไทย ไม่มีขั้นไหนแสดงเป็น undefined', () => {
    for (const s of STATUS_STEPS) expect(typeof STATUS_LABEL[s]).toBe('string')
  })
})
