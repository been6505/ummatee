import { describe, it, expect } from 'vitest'
import { buildSearchTokens, queryToken, matchesTerm, normalizeTerm, MIN_GRAM, MAX_GRAM } from './searchIndex.js'

// เทสต์ดัชนีคำค้น — จุดสำคัญคือภาษาไทยต้องตัดตาม grapheme ไม่งั้นสระ/วรรณยุกต์หลุด
// แล้วผู้ใช้พิมพ์ตามที่เห็นบนหน้าจอจะค้นไม่เจอ
// รัน: npm test

describe('normalizeTerm', () => {
  it('ตัวพิมพ์เล็ก + ตัดช่องว่างหัวท้าย + ยุบช่องว่างซ้ำ', () => {
    expect(normalizeTerm('  Um   SHOP ')).toBe('um shop')
  })
  it('ค่าว่าง/null ได้สตริงว่าง', () => {
    expect(normalizeTerm(null)).toBe('')
    expect(normalizeTerm(undefined)).toBe('')
  })
})

describe('buildSearchTokens', () => {
  it('เก็บท่อนย่อยจากกลางข้อความ ทำให้ค้นคำกลางเจอ (โจทย์หลักของฟีเจอร์นี้)', () => {
    const tokens = buildSearchTokens('เสื้อลายขนนก')
    expect(tokens).toContain('ขนนก')   // คำกลาง — เดิมค้นไม่เจอเพราะ prefix-match
    expect(tokens).toContain('ลาย')
    expect(tokens).toContain('เสื้อ')
  })

  it('ไม่ตัดสระ/วรรณยุกต์ออกจากพยัญชนะ (ตัดตาม grapheme)', () => {
    // "เสื้อ" = เ + ส + ื + ้ + อ ถ้าตัดตาม code unit จะได้ท่อนอย่าง "ส" เดี่ยวๆ ที่ไม่มีสระ
    // ทุก token ต้องพิมพ์ตามได้จริง = ต้องเป็นส่วนหนึ่งของข้อความต้นฉบับเสมอ
    const src = 'เสื้อลายขนนก'
    for (const t of buildSearchTokens(src)) expect(src).toContain(t)
  })

  it('รวมข้อความหลายชิ้นเข้าเป็นดัชนีเดียว', () => {
    const tokens = buildSearchTokens('เสื้อยืด', 'UM130')
    expect(tokens).toContain('130')
    expect(tokens).toContain('ยืด')
  })

  it('ตัวพิมพ์ใหญ่ค้นด้วยตัวพิมพ์เล็กได้', () => {
    expect(buildSearchTokens('Um Shop')).toContain('shop')
  })

  it('ข้ามค่าว่าง/null โดยไม่พัง', () => {
    expect(buildSearchTokens('', null, undefined)).toEqual([])
  })

  it('ไม่เก็บท่อนที่สั้นกว่า MIN_GRAM และไม่ยาวเกิน MAX_GRAM (นับเป็น grapheme)', () => {
    // ต้องนับเป็น grapheme ไม่ใช่ .length — ไทย 12 grapheme อาจยาวถึง 17 code point
    // เพราะสระ/วรรณยุกต์แต่ละตัวนับแยก การนับผิดจะทำให้เทสต์ฟ้องทั้งที่โค้ดถูก
    const seg = new Intl.Segmenter('th', { granularity: 'grapheme' })
    const count = (s) => [...seg.segment(s)].length
    for (const tok of buildSearchTokens('เสื้อลายขนนกสีเขียวรุ่นพิเศษ')) {
      expect(count(tok)).toBeGreaterThanOrEqual(MIN_GRAM)
      expect(count(tok)).toBeLessThanOrEqual(MAX_GRAM)
    }
  })

  it('จำกัดจำนวน token กันเอกสารบวมจนชนลิมิต 1MB', () => {
    expect(buildSearchTokens('ก'.repeat(400)).length).toBeLessThanOrEqual(500)
  })
})

describe('queryToken', () => {
  it('คำสั้นกว่า MIN_GRAM คืน null (ไม่ต้องยิง query)', () => {
    expect(queryToken('ก')).toBeNull()
    expect(queryToken(' ')).toBeNull()
  })
  it('คำปกติใช้ได้ตรงๆ', () => {
    expect(queryToken('ขนนก')).toBe('ขนนก')
  })
  it('คำยาวเกิน MAX_GRAM ถูกตัดให้เท่าที่ index ไว้', () => {
    const long = 'เสื้อลายขนนกสีเขียวรุ่นพิเศษมาก'
    const q = queryToken(long)
    const seg = new Intl.Segmenter('th', { granularity: 'grapheme' })
    expect([...seg.segment(q)].length).toBeLessThanOrEqual(MAX_GRAM)
    expect(long).toContain(q)
  })
})

describe('matchesTerm', () => {
  it('ใช้กรองซ้ำตอนผู้ใช้พิมพ์ยาวเกินที่ index ไว้', () => {
    expect(matchesTerm('เสื้อลายขนนกสีเขียวรุ่นพิเศษมาก', 'ขนนกสีเขียวรุ่นพิเศษมาก')).toBe(true)
    expect(matchesTerm('เสื้อลายขนนก', 'ขนนกสีแดง')).toBe(false)
  })
  it('ไม่สนตัวพิมพ์เล็กใหญ่', () => {
    expect(matchesTerm('Um Shop', 'um sh')).toBe(true)
  })
})
