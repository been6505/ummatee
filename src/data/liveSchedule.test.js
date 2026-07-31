import { describe, it, expect } from 'vitest'
import { liveTimeOf, isLivePost, splitLives, localNowIso, liveTimeLabel } from './liveSchedule.js'

const live = (over = {}) => ({ contentType: 'live', title: 'ไลฟ์', ...over })

describe('liveTimeOf', () => {
  it('ใช้ liveScheduledAt ถ้ามี', () => {
    expect(liveTimeOf(live({ liveScheduledAt: '2026-08-01T20:00', date: '2026-07-01', time: '10:00' })))
      .toBe('2026-08-01T20:00')
  })
  it('ถ้ายังไม่ได้ตั้งเวลาไลฟ์ ถอยไปใช้วันเวลาโพสต์ — ไลฟ์เก่าจะได้ไม่หายจากตาราง', () => {
    expect(liveTimeOf(live({ date: '2026-07-01', time: '10:00' }))).toBe('2026-07-01T10:00')
  })
  it('มีวันแต่ไม่มีเวลา ให้เป็นเที่ยงคืนของวันนั้น', () => {
    expect(liveTimeOf(live({ date: '2026-07-01' }))).toBe('2026-07-01T00:00')
  })
  it('ไม่มีอะไรเลยคืนค่าว่าง ไม่ใช่สตริงที่ดูเหมือนวันที่', () => {
    expect(liveTimeOf(live())).toBe('')
    expect(liveTimeOf(null)).toBe('')
  })
})

describe('isLivePost', () => {
  it('เอาเฉพาะ contentType === live', () => {
    expect(isLivePost(live())).toBe(true)
    expect(isLivePost({ contentType: 'post' })).toBe(false)
    expect(isLivePost({})).toBe(false)
    expect(isLivePost(null)).toBe(false)
  })
})

describe('splitLives', () => {
  const NOW = '2026-07-31T12:00'
  const posts = [
    { contentType: 'post', title: 'โพสต์ธรรมดา', date: '2026-08-05' },
    live({ title: 'ไลฟ์อนาคต', liveScheduledAt: '2026-08-02T20:00' }),
    live({ title: 'ไลฟ์อดีต', liveScheduledAt: '2026-07-20T20:00' }),
    live({ title: 'ไลฟ์ยังไม่ตั้งเวลา' }),
    live({ title: 'ไลฟ์อนาคตอีกอัน', liveScheduledAt: '2026-08-01T09:00' }),
  ]

  it('คัดเฉพาะไลฟ์ ไม่เอาโพสต์ธรรมดา', () => {
    expect(splitLives(posts, NOW).total).toBe(4)
  })
  it('อนาคตเรียงจากใกล้ที่สุดไปไกล', () => {
    expect(splitLives(posts, NOW).upcoming.map((p) => p.title))
      .toEqual(['ไลฟ์อนาคตอีกอัน', 'ไลฟ์อนาคต'])
  })
  it('อดีตเรียงจากล่าสุดย้อนลง', () => {
    expect(splitLives(posts, NOW).past.map((p) => p.title)).toEqual(['ไลฟ์อดีต'])
  })
  it('ไลฟ์ที่ยังไม่ตั้งเวลาแยกกลุ่มของตัวเอง ไม่ถูกกลืนไปกับ "ผ่านไปแล้ว"', () => {
    const r = splitLives(posts, NOW)
    expect(r.unscheduled.map((p) => p.title)).toEqual(['ไลฟ์ยังไม่ตั้งเวลา'])
    expect(r.past.map((p) => p.title)).not.toContain('ไลฟ์ยังไม่ตั้งเวลา')
  })
  it('ไลฟ์ที่ตรงกับเวลาปัจจุบันพอดี ถือว่ายังไม่ผ่าน (กำลังจะเริ่ม)', () => {
    const r = splitLives([live({ title: 'ตอนนี้', liveScheduledAt: NOW })], NOW)
    expect(r.upcoming).toHaveLength(1)
    expect(r.past).toHaveLength(0)
  })
  it('ลิสต์ว่าง/undefined ไม่โยน error', () => {
    expect(() => splitLives(undefined, NOW)).not.toThrow()
    expect(splitLives([], NOW).total).toBe(0)
  })
})

describe('localNowIso', () => {
  it('ใช้เวลาท้องถิ่น ไม่ใช่ UTC — ไลฟ์เช้าในไทยต้องไม่กลายเป็นเมื่อวาน', () => {
    // 1 ส.ค. 07:00 เวลาเครื่อง — ถ้าเผลอใช้ toISOString ในเขต +07 จะได้ 2026-07-31T00:00
    const d = new Date(2026, 7, 1, 7, 0)
    expect(localNowIso(d)).toBe('2026-08-01T07:00')
  })
  it('เติมศูนย์ให้ครบทุกช่อง', () => {
    expect(localNowIso(new Date(2026, 0, 5, 3, 7))).toBe('2026-01-05T03:07')
  })
})

describe('liveTimeLabel', () => {
  it('แปลงเป็นรูปแบบที่คนอ่าน', () => {
    expect(liveTimeLabel('2026-08-02T20:00')).toBe('02/08/2026 20:00')
  })
  it('ค่าที่ผิดรูปแบบคืนค่าว่าง ไม่ใช่ Invalid Date', () => {
    expect(liveTimeLabel('')).toBe('')
    expect(liveTimeLabel('พรุ่งนี้')).toBe('')
    expect(liveTimeLabel(null)).toBe('')
  })
})
