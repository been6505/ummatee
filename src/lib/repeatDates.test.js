import { describe, it, expect } from 'vitest'
import { repeatDates, MAX_REPEAT_POSTS, WEEKDAYS } from './repeatDates.js'

// 2026-07-31 = วันศุกร์ (getDay() === 5) — ใช้เป็นวันเริ่มในเทสต์ส่วนใหญ่
const FRI = '2026-07-31'

describe('repeatDates', () => {
  it('ไม่เลือกวันไหนเลย = โพสต์ใบเดียวในวันที่เลือก', () => {
    expect(repeatDates(FRI, [], 4)).toEqual([FRI])
    expect(repeatDates(FRI)).toEqual([FRI])
  })

  it('เลือกวันเดียวกับวันเริ่ม ครั้งแรกคือวันนั้นเลย ไม่ใช่สัปดาห์ถัดไป', () => {
    expect(repeatDates(FRI, [5], 3)).toEqual(['2026-07-31', '2026-08-07', '2026-08-14'])
  })

  it('วันที่เลือกผ่านมาแล้วในสัปดาห์นั้น ⇒ เริ่มสัปดาห์ถัดไป ไม่ย้อนหลัง', () => {
    // เริ่มวันศุกร์ แต่เลือกวันจันทร์ ⇒ จันทร์ที่ 3 ส.ค. (ไม่ใช่ 27 ก.ค. ที่ผ่านมาแล้ว)
    const r = repeatDates(FRI, [1], 2)
    expect(r).toEqual(['2026-08-03', '2026-08-10'])
    expect(r.every((d) => d >= FRI)).toBe(true)
  })

  it('หลายวันในสัปดาห์ เรียงจากน้อยไปมากและไม่ซ้ำ', () => {
    const r = repeatDates(FRI, [1, 3, 5], 2) // จ พ ศ
    expect(r).toEqual(['2026-07-31', '2026-08-03', '2026-08-05', '2026-08-07', '2026-08-10', '2026-08-12'])
    expect(new Set(r).size).toBe(r.length)
    expect([...r].sort()).toEqual(r)
  })

  it('ข้ามเดือน/ข้ามปีได้ถูกต้อง (ไม่ใช่บวกเลขวันตรงๆ)', () => {
    expect(repeatDates('2026-12-28', [1], 3)).toEqual(['2026-12-28', '2027-01-04', '2027-01-11'])
  })

  it('จำนวนวันเท่ากับ วันที่เลือก × สัปดาห์', () => {
    expect(repeatDates(FRI, [0, 1, 2, 3, 4, 5, 6], 4)).toHaveLength(28)
  })

  it('จำกัดจำนวนโพสต์สูงสุด กันกดพลาดแล้วได้เอกสารเป็นร้อย', () => {
    expect(repeatDates(FRI, [0, 1, 2, 3, 4, 5, 6], 99).length).toBeLessThanOrEqual(MAX_REPEAT_POSTS)
  })

  it('สัปดาห์เป็น 0/ติดลบ/ไม่ใช่ตัวเลข ถอยไปเป็น 1 สัปดาห์', () => {
    expect(repeatDates(FRI, [5], 0)).toEqual([FRI])
    expect(repeatDates(FRI, [5], -3)).toEqual([FRI])
    expect(repeatDates(FRI, [5], NaN)).toEqual([FRI])
  })

  it('วันที่ไม่ถูกรูปแบบคืนลิสต์ว่าง ไม่สร้างโพสต์วันเพี้ยน', () => {
    expect(repeatDates('', [5], 4)).toEqual([])
    expect(repeatDates('31/07/2026', [5], 4)).toEqual([])
    expect(repeatDates(null, [5], 4)).toEqual([])
  })

  it('ค่าวันในสัปดาห์ที่ไม่ถูกต้องถูกกรองออก', () => {
    expect(repeatDates(FRI, [9, -1, 'จ'], 2)).toEqual([FRI]) // ไม่เหลือวันที่ใช้ได้ = ใบเดียว
    expect(repeatDates(FRI, [5, 99], 2)).toEqual(['2026-07-31', '2026-08-07'])
  })

  it('WEEKDAYS เรียงจันทร์→อาทิตย์ และ id ตรงกับ Date.getDay()', () => {
    expect(WEEKDAYS.map((d) => d.id)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(new Date(2026, 6, 31).getDay()).toBe(5) // ยืนยันว่า 2026-07-31 เป็นวันศุกร์จริง
  })
})
