import { describe, it, expect } from 'vitest'
import { shouldStayHidden, DISMISS_DAYS, FOREVER } from './installPrompt.js'

const NOW = 1_800_000_000_000
const days = (n) => n * 24 * 60 * 60 * 1000

describe('shouldStayHidden', () => {
  it('ยังไม่เคยปิด = แสดงได้', () => {
    expect(shouldStayHidden(null, NOW)).toBe(false)
    expect(shouldStayHidden('', NOW)).toBe(false)
  })

  it('เพิ่งปิดไป = ยังไม่ต้องโชว์ซ้ำ', () => {
    expect(shouldStayHidden(String(NOW - days(1)), NOW)).toBe(true)
  })

  it('ปิดไปนานเกิน 30 วันแล้ว = กลับมาถามได้อีกครั้ง', () => {
    expect(shouldStayHidden(String(NOW - days(DISMISS_DAYS + 1)), NOW)).toBe(false)
  })

  it('ติดตั้งไปแล้วไม่ถามอีกเลย ต่อให้ผ่านไปเป็นปี', () => {
    expect(shouldStayHidden(FOREVER, NOW + days(999))).toBe(true)
  })

  it('ค่าที่อ่านไม่ออกถือว่ายังไม่เคยปิด ไม่ใช่ซ่อนถาวร', () => {
    // ถ้าตีความผิดเป็น NaN แล้วซ่อนไว้ แถบจะหายไปเงียบ ๆ ตลอดกาลโดยไม่มีใครรู้
    expect(shouldStayHidden('เมื่อวาน', NOW)).toBe(false)
  })

  it('เวลาในอนาคต (นาฬิกาเครื่องเพี้ยน) ยังนับว่าเพิ่งปิด ไม่ใช่โชว์รัว', () => {
    expect(shouldStayHidden(String(NOW + days(5)), NOW)).toBe(true)
  })
})
