import { describe, it, expect } from 'vitest'
import {
  buildUpdate, sortUpdates, publishedOnly, cleanPhotos, isUploadedPhotoUrl, isDateKey,
  normUpdateStatus, normCategory, UPDATE_CATEGORIES, CATEGORY_COLOR,
  MAX_PHOTOS, MAX_BODY_LEN,
} from './publicUpdates.js'

const PHOTO = 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg'
const ok = { title: 'ส่งอาหารถึงกาซ่า', body: 'วันนี้ทีมงานส่งมอบอาหาร 500 ชุด', category: 'relief', date: '2026-08-01' }

describe('buildUpdate', () => {
  it('ข่าวปกติผ่าน', () => {
    const r = buildUpdate(ok)
    expect(r.ok).toBe(true)
    expect(r.value.category).toBe('relief')
  })

  it('ตั้งต้นเป็นฉบับร่างเสมอ — ข่าวที่ยังไม่เสร็จต้องไม่หลุดขึ้นเว็บ', () => {
    expect(buildUpdate(ok).value.status).toBe('draft')
    expect(buildUpdate({ ...ok, status: 'zzz' }).value.status).toBe('draft')
  })

  it('เผยแพร่ได้เมื่อระบุ status ชัดเจน', () => {
    expect(buildUpdate({ ...ok, status: 'published' }).value.status).toBe('published')
  })

  it('ไม่มีหัวข้อ หรือไม่มีเนื้อหา = ไม่ผ่าน', () => {
    expect(buildUpdate({ ...ok, title: '  ' }).ok).toBe(false)
    expect(buildUpdate({ ...ok, body: '' }).ok).toBe(false)
  })

  it('ไม่ใส่คำโปรย ตัดจากเนื้อหามาให้ ไม่ปล่อยว่าง', () => {
    expect(buildUpdate(ok).value.summary).toContain('ส่งมอบอาหาร')
  })

  it('คำโปรยที่ตัดมาต้องไม่มีขึ้นบรรทัด ไม่งั้นการ์ดในหน้ารวมข่าวเสียทรง', () => {
    const r = buildUpdate({ ...ok, body: 'บรรทัดหนึ่ง\nบรรทัดสอง' })
    expect(r.value.summary).not.toContain('\n')
  })

  it('วันที่ผิดรูปแบบ = ไม่ผ่าน (ไม่ใช่เงียบแล้วเก็บค่าขยะ)', () => {
    expect(buildUpdate({ ...ok, date: '1 ส.ค. 69' }).ok).toBe(false)
    expect(buildUpdate({ ...ok, date: '' }).ok).toBe(true) // ไม่ระบุวันได้
  })

  it('เก็บการขึ้นบรรทัดของเนื้อหาไว้ แต่ยุบช่องว่างในบรรทัด', () => {
    const r = buildUpdate({ ...ok, body: 'ย่อหน้า   หนึ่ง\nย่อหน้าสอง' })
    expect(r.value.body).toBe('ย่อหน้า หนึ่ง\nย่อหน้าสอง')
  })

  it('ตัดเนื้อหาที่ยาวเกิน', () => {
    expect(buildUpdate({ ...ok, body: 'ก'.repeat(9999) }).value.body).toHaveLength(MAX_BODY_LEN)
  })

  it('หมวดที่ไม่รู้จักตกไปเป็น "อื่นๆ"', () => {
    expect(buildUpdate({ ...ok, category: 'zzz' }).value.category).toBe('other')
  })

  it('รูปจากที่อื่นถูกกรองทิ้ง', () => {
    expect(buildUpdate({ ...ok, photos: ['https://evil.com/x.jpg', PHOTO] }).value.photos).toEqual([PHOTO])
  })
})

describe('รูปภาพ', () => {
  it('รับเฉพาะ https ของ Cloudinary', () => {
    expect(isUploadedPhotoUrl(PHOTO)).toBe(true)
    expect(isUploadedPhotoUrl('http://res.cloudinary.com/a.jpg')).toBe(false)
    expect(isUploadedPhotoUrl('javascript:alert(1)')).toBe(false)
  })
  it('จำกัดจำนวน และไม่พังเมื่อไม่ใช่ array', () => {
    expect(cleanPhotos(Array.from({ length: 20 }, () => PHOTO))).toHaveLength(MAX_PHOTOS)
    expect(cleanPhotos(null)).toEqual([])
  })
})

describe('isDateKey', () => {
  it('รับเฉพาะ YYYY-MM-DD', () => {
    expect(isDateKey('2026-08-01')).toBe(true)
    expect(isDateKey('2026-8-1')).toBe(false)
    expect(isDateKey(undefined)).toBe(false)
  })
})

describe('sortUpdates', () => {
  it('ใหม่ไปเก่า ตามวันที่', () => {
    const r = sortUpdates([{ date: '2026-01-01' }, { date: '2026-08-01' }, { date: '2026-05-01' }])
    expect(r.map((x) => x.date)).toEqual(['2026-08-01', '2026-05-01', '2026-01-01'])
  })

  it('วันเดียวกันใช้เวลาบันทึกตัดสิน', () => {
    const r = sortUpdates([{ date: '2026-08-01', updatedAt: 1 }, { date: '2026-08-01', updatedAt: 9 }])
    expect(r[0].updatedAt).toBe(9)
  })

  it('ข่าวที่ไม่ระบุวันไปอยู่ท้าย ไม่ใช่หายไป', () => {
    const r = sortUpdates([{ date: '' }, { date: '2026-08-01' }])
    expect(r).toHaveLength(2)
    expect(r[0].date).toBe('2026-08-01')
  })

  it('ไม่แก้ array เดิม', () => {
    const src = [{ date: '2026-01-01' }, { date: '2026-08-01' }]
    sortUpdates(src)
    expect(src[0].date).toBe('2026-01-01')
  })

  it('ไม่พังเมื่อไม่มีข้อมูล', () => {
    expect(sortUpdates(undefined)).toEqual([])
  })
})

describe('publishedOnly', () => {
  it('กรองเฉพาะที่เผยแพร่แล้ว — ฉบับร่างต้องไม่หลุด', () => {
    const r = publishedOnly([{ status: 'published' }, { status: 'draft' }, { status: undefined }])
    expect(r).toHaveLength(1)
  })

  it('status เพี้ยนถือเป็นฉบับร่าง ไม่ใช่เผยแพร่', () => {
    expect(normUpdateStatus('zzz')).toBe('draft')
    expect(publishedOnly([{ status: 'PUBLISHED' }])).toHaveLength(0)
  })
})

describe('หมวดหมู่', () => {
  it('key ไม่ซ้ำ และมี label/สีครบทุกอัน', () => {
    expect(new Set(UPDATE_CATEGORIES.map((c) => c.key)).size).toBe(UPDATE_CATEGORIES.length)
    for (const c of UPDATE_CATEGORIES) expect(CATEGORY_COLOR[c.key]).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('normCategory มีค่าตั้งต้นเสมอ', () => {
    expect(normCategory(undefined)).toBe('other')
  })
})
