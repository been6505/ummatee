import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import {
  NAZA_ROUNDS, NAZA_DAYS, NAZA_TIMES, ALL_SEATS, SEATS_PER_ROUND, NAZA_DEFAULTS, NAZA_EMAIL_RE, sortSeats, seatType, roundLabel,
  newBookingCode, validateBookingForm, cleanPhone, cleanEmail, parseNazaQr,
} from './nazaConfig.js'

// รอบ/รหัสที่นั่ง/ราคาเริ่มต้นถูกเขียนซ้ำใน firestore.rules — ถ้าสองฝั่งไม่ตรงกัน การจองจะโดน
// permission-denied ทั้งรอบโดยที่หน้าเว็บดูปกติทุกอย่าง เทสต์นี้เทียบให้ทุกครั้งที่แก้ฝั่งใดฝั่งหนึ่ง
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const rules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8')
const gs = readFileSync(join(ROOT, 'docs/volunteer-apps-script/Code.gs'), 'utf8')

describe('nazaConfig ตรงกับ firestore.rules', () => {
  it('รายการรอบตรงกัน', () => {
    const m = rules.match(/d\.round in \[([^\]]+)\]/)
    expect(m).toBeTruthy()
    const ruled = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    expect(ruled).toEqual(NAZA_ROUNDS)
  })

  it('รูปแบบรหัสที่นั่งใน rules รับทุกที่นั่งจริง และไม่รับที่นั่งที่ไม่มี', () => {
    const m = rules.match(/seat\.matches\('([^']+)'\)/)
    expect(m).toBeTruthy()
    const re = new RegExp(m[1])
    for (const s of ALL_SEATS) expect(re.test(s), s).toBe(true)
    for (const s of ['A0', 'A6', 'B6', 'C0', 'C11', 'D11', 'E1', 'A10']) expect(re.test(s), s).toBe(false)
    expect(ALL_SEATS).toHaveLength(SEATS_PER_ROUND)
  })

  it('ราคา fallback ใน rules ตรงกับค่าเริ่มต้นฝั่งเว็บ', () => {
    const m = rules.match(/function nazaPrice\(\) \{[\s\S]*?: (\d+);/)
    expect(Number(m[1])).toBe(NAZA_DEFAULTS.price)
  })

  it('จำนวนที่นั่งสูงสุดต่อการจองใน rules ไม่น้อยกว่าค่าเริ่มต้น และเช็คที่นั่งครบทุกช่อง', () => {
    const max = Number(rules.match(/d\.seats\.size\(\) <= (\d+)/)[1])
    expect(max).toBeGreaterThanOrEqual(NAZA_DEFAULTS.maxSeats)
    const held = [...rules.matchAll(/nazaSeatHeld\(d\.round, d\.seats, (\d+), id\)/g)].map((x) => Number(x[1]))
    expect(held).toEqual(Array.from({ length: max }, (_, i) => i))
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
    expect(parseNazaQr('NAZA|NZ-AB2CD|d6-1400|A1,C10')).toBe('NZ-AB2CD')
    expect(parseNazaQr('NZ-AB2CD')).toBe(null)
    expect(parseNazaQr('https://example.com')).toBe(null)
  })
  it('router ของ Apps Script รู้จัก nazaBooking', () => {
    expect(gs).toContain("if (type === 'nazaBooking') return handleNazaBooking")
  })
})

describe('อีเมล', () => {
  it('regex ฝั่งเว็บตรงกับ rules', () => {
    const m = rules.match(/d\.email\.matches\('([^']+)'\)/)
    expect(m[1].replace(/\\\\/g, '\\')).toBe(NAZA_EMAIL_RE.source)
  })
  it('ตรวจและทำความสะอาดอีเมล', () => {
    expect(cleanEmail('  A.B@Mail.COM ')).toBe('a.b@mail.com')
    for (const ok of ['a@b.co', 'x.y+z@gmail.com']) expect(NAZA_EMAIL_RE.test(ok), ok).toBe(true)
    for (const bad of ['', 'a@b', 'a b@c.com', '@b.com', 'a@@b.com']) expect(NAZA_EMAIL_RE.test(bad), bad).toBe(false)
  })
})

describe('ฟังก์ชันช่วย', () => {
  it('เรียงที่นั่งตามแถวแล้วตามเลข (C10 อยู่หลัง C9)', () => {
    expect(sortSeats(['C10', 'A2', 'C9', 'A1'])).toEqual(['A1', 'A2', 'C9', 'C10'])
  })
  it('ประเภทที่นั่ง', () => {
    expect(seatType('A1')).toBe('บีนแบ็ก')
    expect(seatType('D10')).toBe('เก้าอี้')
  })
  it('ชื่อรอบอ่านออก และรอบที่ไม่รู้จักไม่พัง', () => {
    expect(roundLabel('d6-1830')).toBe('ศุกร์ 6 พ.ย. 2569 · 18:30–21:00 น.')
    expect(roundLabel('zz')).toBe('zz')
  })
  it('รหัสการจองตรงรูปแบบที่ rules บังคับ', () => {
    const re = new RegExp(rules.match(/d\.code\.matches\('([^']+)'\)/)[1])
    for (let i = 0; i < 50; i++) expect(re.test(newBookingCode())).toBe(true)
  })
  it('ตรวจฟอร์ม', () => {
    expect(validateBookingForm({ name: 'สมชาย ใจดี', phone: '081-234-5678', email: 'a@b.co', hasSlip: true })).toEqual({})
    const e = validateBookingForm({ name: ' ', phone: '123', email: 'nope', hasSlip: false })
    expect(Object.keys(e).sort()).toEqual(['email', 'name', 'phone', 'slip'])
    expect(cleanPhone('08 1-234 5678')).toBe('0812345678')
  })
})
