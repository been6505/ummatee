import { describe, it, expect } from 'vitest'
import {
  toKey, fromKey, weekStart, weekDays, shiftWeek, dayLabel, weekRangeLabel, groupByDay, WEEK_COLUMNS,
} from './weekView.js'

describe('fromKey', () => {
  it('อ่านเป็นเวลาท้องถิ่น ไม่ใช่ UTC — new Date("2026-08-01") จะเพี้ยนไปวันก่อนหน้าในเขต +07', () => {
    const d = fromKey('2026-08-01')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)
    expect(d.getDate()).toBe(1)
  })
  it('รูปแบบผิดคืน null ไม่ใช่ Invalid Date', () => {
    expect(fromKey('')).toBeNull()
    expect(fromKey('2026-8-1')).toBeNull()
    expect(fromKey(null)).toBeNull()
  })
})

describe('weekStart', () => {
  it('วันเสาร์ 1 ส.ค. 2026 อยู่ในสัปดาห์ที่เริ่มอาทิตย์ 26 ก.ค.', () => {
    expect(weekStart('2026-08-01')).toBe('2026-07-26')
  })
  it('วันอาทิตย์คือจุดเริ่มของตัวเอง ไม่ถอยไปสัปดาห์ก่อน', () => {
    // 2026-08-02 เป็นวันอาทิตย์
    expect(fromKey('2026-08-02').getDay()).toBe(0)
    expect(weekStart('2026-08-02')).toBe('2026-08-02')
  })
  it('วันจันทร์ถอยกลับ 1 วันมาที่อาทิตย์ก่อนหน้า', () => {
    expect(weekStart('2026-07-27')).toBe('2026-07-26')
  })
  it('ข้ามเดือนและข้ามปีได้', () => {
    expect(weekStart('2027-01-01')).toBe('2026-12-27')
  })
})

describe('weekDays', () => {
  it('คืน 7 วันเรียงอาทิตย์ถึงเสาร์', () => {
    expect(weekDays('2026-07-26')).toEqual([
      '2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29',
      '2026-07-30', '2026-07-31', '2026-08-01',
    ])
  })
  it('ลำดับวันตรงกับหัวคอลัมน์ WEEK_COLUMNS (อาทิตย์มาก่อน)', () => {
    const days = weekDays('2026-07-26')
    days.forEach((k, i) => expect(fromKey(k).getDay()).toBe(WEEK_COLUMNS[i].dow))
    expect(WEEK_COLUMNS[0].label).toBe('อาทิตย์')
  })
  it('รับ key ผิดคืนลิสต์ว่าง ไม่โยน error', () => {
    expect(weekDays('อะไรก็ไม่รู้')).toEqual([])
  })
})

describe('shiftWeek', () => {
  it('เดินหน้า/ถอยหลังทีละสัปดาห์', () => {
    expect(shiftWeek('2026-07-26', 1)).toBe('2026-08-02')
    expect(shiftWeek('2026-07-26', -1)).toBe('2026-07-19')
  })
  it('ข้ามปีถูกต้อง', () => {
    expect(shiftWeek('2026-12-27', 1)).toBe('2027-01-03')
  })
})

describe('ป้ายข้อความ', () => {
  it('หัวคอลัมน์สั้น', () => {
    expect(dayLabel('2026-08-01')).toBe('1 ส.ค.')
  })
  it('สัปดาห์ในเดือนเดียวกันไม่ต้องเขียนเดือนซ้ำ', () => {
    expect(weekRangeLabel('2026-08-02')).toBe('2 – 8 ส.ค. 2569')
  })
  it('สัปดาห์คร่อมเดือนต้องบอกทั้งสองเดือน', () => {
    expect(weekRangeLabel('2026-07-26')).toBe('26 ก.ค. – 1 ส.ค. 2569')
  })
  it('สัปดาห์คร่อมปีต้องบอก พ.ศ. ทั้งสองฝั่ง', () => {
    expect(weekRangeLabel('2026-12-27')).toBe('27 ธ.ค. 2569 – 2 ม.ค. 2570')
  })
})

describe('groupByDay', () => {
  const days = weekDays('2026-07-26')
  it('มีครบทั้ง 7 คีย์เสมอ แม้วันนั้นไม่มีโพสต์ — คอลัมน์จะได้ไม่หายไป', () => {
    const m = groupByDay([], days)
    expect(Object.keys(m)).toHaveLength(7)
    expect(m['2026-07-29']).toEqual([])
  })
  it('เรียงตามเวลาในแต่ละวัน', () => {
    const m = groupByDay([
      { date: '2026-07-26', time: '18:00', title: 'เย็น' },
      { date: '2026-07-26', time: '09:00', title: 'เช้า' },
    ], days)
    expect(m['2026-07-26'].map((p) => p.title)).toEqual(['เช้า', 'เย็น'])
  })
  it('โพสต์นอกสัปดาห์ถูกทิ้ง ไม่ไปโผล่ผิดวัน', () => {
    const m = groupByDay([{ date: '2026-09-09', title: 'คนละเดือน' }], days)
    expect(Object.values(m).flat()).toHaveLength(0)
  })
  it('โพสต์ที่ไม่มีวันที่ไม่ทำให้พัง', () => {
    expect(() => groupByDay([{ title: 'ไม่มีวัน' }, null], days)).not.toThrow()
  })
})

describe('toKey', () => {
  it('เติมศูนย์ให้เดือน/วันครบสองหลัก', () => {
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
