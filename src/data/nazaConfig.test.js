import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import {
  NAZA_ROUNDS, NAZA_DAYS, NAZA_TIMES, ALL_SEATS, SEATS_PER_ROUND, NAZA_EMAIL_RE, sortSeats, seatType, roundLabel,
  newBookingCode, validateBookingForm, cleanPhone, cleanEmail, parseNazaQr,
} from './nazaConfig.js'

// หน้าเว็บกับเซิร์ฟเวอร์ (functions/_lib/naza.js) ใช้ค่าคงที่ชุดเดียวกัน — ที่เขียนซ้ำอยู่มีแค่ Apps Script
// ที่ส่งอีเมล ถ้าวันที่/รูปแบบ QR ไม่ตรง อีเมลจะผิดวันหรือสแกนไม่ได้ โดยไม่มีอะไรฟ้อง
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const gs = readFileSync(join(ROOT, 'docs/volunteer-apps-script/Code.gs'), 'utf8')

describe('ผังที่นั่ง', () => {
  it('30 ที่ต่อรอบ: บีนแบ็ก A–B + เก้าอี้ C–F แถวละ 5', () => {
    expect(SEATS_PER_ROUND).toBe(30)
    expect(ALL_SEATS).toHaveLength(30)
    expect(ALL_SEATS).toContain('F5')
    expect(ALL_SEATS).not.toContain('C10')
    expect(NAZA_ROUNDS).toHaveLength(6)
  })
})

describe('nazaConfig ตรงกับ Apps Script (อีเมล/เตือนก่อนวันงาน)', () => {
  // ถ้าวันที่ไม่ตรง อีเมลเตือน "พรุ่งนี้" จะไปผิดวันหรือไม่ถูกส่งเลย โดยไม่มีอะไรฟ้อง
  it('วันที่ของแต่ละวันตรงกัน', () => {
    const m = gs.match(/var NAZA_DAY_DATES = (\{[^}]+\})/)
    const dates = Object.fromEntries([...m[1].matchAll(/(d\d+): '([\d-]+)'/g)].map((x) => [x[1], x[2]]))
    expect(dates).toEqual(Object.fromEntries(NAZA_DAYS.map((d) => [d.id, d.date])))
  })
  it('ชื่อวันและเวลาในอีเมลตรงกับหน้าเว็บ', () => {
    for (const d of NAZA_DAYS) expect(gs).toContain(`${d.id}: '${d.full}'`)
    for (const t of NAZA_TIMES) expect(gs).toContain(`'${t.id}': '${t.label}–${t.end} น.'`)
  })
  it('รูปแบบข้อความใน QR ของอีเมลตรงกับที่เครื่องสแกนอ่าน', () => {
    expect(gs).toContain("return 'NAZA|' + b.code + '|' + b.round + '|' + b.seats.join(',')")
    expect(parseNazaQr('NAZA|NZ-AB2CD|d6-1400|A1,F5')).toBe('NZ-AB2CD')
    expect(parseNazaQr('NZ-AB2CD')).toBe(null)
    expect(parseNazaQr('https://example.com')).toBe(null)
  })
  it('router ของ Apps Script รู้จัก nazaBooking', () => {
    expect(gs).toContain("if (type === 'nazaBooking') return handleNazaBooking")
  })
})

describe('อีเมล', () => {
  it('ตรวจและทำความสะอาดอีเมล', () => {
    expect(cleanEmail('  A.B@Mail.COM ')).toBe('a.b@mail.com')
    for (const ok of ['a@b.co', 'x.y+z@gmail.com']) expect(NAZA_EMAIL_RE.test(ok), ok).toBe(true)
    for (const bad of ['', 'a@b', 'a b@c.com', '@b.com', 'a@@b.com']) expect(NAZA_EMAIL_RE.test(bad), bad).toBe(false)
  })
})

describe('ฟังก์ชันช่วย', () => {
  it('เรียงที่นั่งตามแถวแล้วตามเลข', () => {
    expect(sortSeats(['F5', 'A2', 'C5', 'A1'])).toEqual(['A1', 'A2', 'C5', 'F5'])
  })
  it('ประเภทที่นั่ง', () => {
    expect(seatType('A1')).toBe('บีนแบ็ก')
    expect(seatType('F5')).toBe('เก้าอี้')
  })
  it('ชื่อรอบอ่านออก และรอบที่ไม่รู้จักไม่พัง', () => {
    expect(roundLabel('d6-1830')).toBe('ศุกร์ 6 พ.ย. 2569 · 18:30–21:00 น.')
    expect(roundLabel('zz')).toBe('zz')
  })
  it('รหัสการจองตรงรูปแบบ NZ-XXXXX', () => {
    const re = /^NZ-[A-Z0-9]{5}$/
    for (let i = 0; i < 50; i++) expect(re.test(newBookingCode())).toBe(true)
  })
  it('ตรวจฟอร์ม', () => {
    expect(validateBookingForm({ name: 'สมชาย ใจดี', phone: '081-234-5678', email: 'a@b.co', hasSlip: true })).toEqual({})
    const e = validateBookingForm({ name: ' ', phone: '123', email: 'nope', hasSlip: false })
    expect(Object.keys(e).sort()).toEqual(['email', 'name', 'phone', 'slip'])
    expect(cleanPhone('08 1-234 5678')).toBe('0812345678')
  })
})
