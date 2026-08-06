import { describe, it, expect } from 'vitest'
import {
  buildReview, buildIssue, cleanRating, cleanPhotos, isUploadedPhotoUrl, averageRating,
  normReviewStatus, normIssueTopic, normIssueStatus, ISSUE_TOPICS, REVIEW_STATUS_ORDER,
  MAX_PHOTOS, MAX_REVIEW_LEN,
} from './shopFeedback.js'

const PHOTO = 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg'

describe('isUploadedPhotoUrl', () => {
  it('รับเฉพาะ https ของ Cloudinary', () => {
    expect(isUploadedPhotoUrl(PHOTO)).toBe(true)
  })
  it('ปฏิเสธ URL จากที่อื่น — ฟอร์มนี้ใครก็ส่งได้ ค่านี้ไปโผล่ใน <img src> หน้าสาธารณะ', () => {
    expect(isUploadedPhotoUrl('https://evil.example.com/x.jpg')).toBe(false)
    expect(isUploadedPhotoUrl('http://res.cloudinary.com/demo/a.jpg')).toBe(false) // ไม่ใช่ https
  })
  it('ปฏิเสธ javascript: และค่าว่าง', () => {
    expect(isUploadedPhotoUrl('javascript:alert(1)')).toBe(false)
    expect(isUploadedPhotoUrl('')).toBe(false)
    expect(isUploadedPhotoUrl(null)).toBe(false)
  })
})

describe('cleanPhotos', () => {
  it('กรองตัวที่ไม่ผ่านออก และจำกัดจำนวน', () => {
    const many = Array.from({ length: 10 }, () => PHOTO)
    expect(cleanPhotos([...many, 'https://evil.com/x.jpg'])).toHaveLength(MAX_PHOTOS)
  })
  it('ไม่ใช่ array ก็ไม่พัง', () => {
    expect(cleanPhotos(null)).toEqual([])
    expect(cleanPhotos('รูป')).toEqual([])
  })
})

describe('cleanRating', () => {
  it('คุมอยู่ในช่วง 1–5', () => {
    expect(cleanRating(0)).toBe(1)
    expect(cleanRating(99)).toBe(5)
    expect(cleanRating(-3)).toBe(1)
  })
  it('ปัดเป็นจำนวนเต็ม', () => {
    expect(cleanRating(4.4)).toBe(4)
    expect(cleanRating('3')).toBe(3)
  })
  it('ค่าที่ไม่ใช่ตัวเลขถือว่า 5 ไม่ใช่ NaN ที่ทำให้ค่าเฉลี่ยพัง', () => {
    expect(cleanRating('ดีมาก')).toBe(5)
    expect(cleanRating(undefined)).toBe(5)
  })
})

describe('buildReview', () => {
  const ok = { productId: 'p1', productName: 'กระเป๋า', rating: 5, text: 'ดีมาก', authorName: 'นาซนีน', photos: [PHOTO] }

  it('รีวิวปกติผ่าน และตั้งสถานะเป็นรอตรวจเสมอ', () => {
    const r = buildReview(ok)
    expect(r.ok).toBe(true)
    expect(r.value.status).toBe('pending')
  })
  it('ผู้ส่งกำหนดสถานะเองไม่ได้ — ส่ง approved มาก็ยังเป็น pending', () => {
    const r = buildReview({ ...ok, status: 'approved' })
    expect(r.value.status).toBe('pending')
  })
  it('ไม่มีข้อความ = ไม่ผ่าน', () => {
    expect(buildReview({ ...ok, text: '   ' }).ok).toBe(false)
  })
  it('ไม่รู้ว่าสินค้าชิ้นไหน = ไม่ผ่าน', () => {
    expect(buildReview({ ...ok, productId: '' }).ok).toBe(false)
  })
  it('ไม่ใส่ชื่อ ใช้ "ลูกค้า" แทน ไม่ใช่ค่าว่าง', () => {
    expect(buildReview({ ...ok, authorName: '' }).value.authorName).toBe('ลูกค้า')
  })
  it('ตัดข้อความที่ยาวเกิน', () => {
    expect(buildReview({ ...ok, text: 'ก'.repeat(5000) }).value.text).toHaveLength(MAX_REVIEW_LEN)
  })
  it('เก็บการขึ้นบรรทัดของรีวิวไว้ แต่ยุบช่องว่างในบรรทัด', () => {
    const r = buildReview({ ...ok, text: 'บรรทัดหนึ่ง   ดี\nบรรทัดสอง' })
    expect(r.value.text).toBe('บรรทัดหนึ่ง ดี\nบรรทัดสอง')
  })
  it('รูปจากที่อื่นถูกกรองทิ้ง', () => {
    expect(buildReview({ ...ok, photos: ['https://evil.com/x.jpg'] }).value.photos).toEqual([])
  })
})

describe('buildIssue', () => {
  const ok = { orderCode: 'ORD-0001', phone: '0801112222', topic: 'damaged', detail: 'กล่องบุบ' }

  it('แจ้งปัญหาปกติผ่าน และเริ่มที่สถานะรอดำเนินการ', () => {
    const r = buildIssue(ok)
    expect(r.ok).toBe(true)
    expect(r.value.status).toBe('open')
  })
  it('ไม่มีรายละเอียด = ไม่ผ่าน', () => {
    expect(buildIssue({ ...ok, detail: '' }).ok).toBe(false)
  })
  it('ไม่มีทั้งเลขออเดอร์และเบอร์โทร = ไม่ผ่าน (แจ้งมาแล้วติดต่อกลับไม่ได้)', () => {
    const r = buildIssue({ detail: 'มีปัญหา' })
    expect(r.ok).toBe(false)
  })
  it('มีเบอร์อย่างเดียวก็พอ', () => {
    expect(buildIssue({ detail: 'มีปัญหา', phone: '0801112222' }).ok).toBe(true)
  })
  it('มีเลขออเดอร์อย่างเดียวก็พอ', () => {
    expect(buildIssue({ detail: 'มีปัญหา', orderCode: 'ORD-0009' }).ok).toBe(true)
  })
  it('หัวข้อที่ไม่รู้จักตกไปเป็น "อื่นๆ" ไม่ใช่ค่าว่าง', () => {
    expect(buildIssue({ ...ok, topic: 'zzz' }).value.topic).toBe('other')
  })
})

describe('averageRating', () => {
  it('คิดค่าเฉลี่ยและปัด 1 ตำแหน่ง', () => {
    expect(averageRating([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toBe(4.3)
  })
  it('ยังไม่มีรีวิวคืน null ไม่ใช่ 0 ที่อ่านเหมือนได้ศูนย์ดาว', () => {
    expect(averageRating([])).toBeNull()
    expect(averageRating(undefined)).toBeNull()
  })
  it('ข้ามรายการที่ rating ใช้ไม่ได้ ไม่ทำให้ค่าเฉลี่ยเป็น NaN', () => {
    expect(averageRating([{ rating: 5 }, { rating: 'ห้า' }])).toBe(5)
  })
})

describe('ตารางสถานะ/หัวข้อครบถ้วน', () => {
  it('normReviewStatus ค่าแปลกตกมาที่ pending — รีวิวที่สถานะเพี้ยนต้องไม่หลุดขึ้นหน้าสาธารณะ', () => {
    expect(normReviewStatus('approved')).toBe('approved')
    expect(normReviewStatus('zzz')).toBe('pending')
    expect(normReviewStatus(undefined)).toBe('pending')
  })
  it('normIssueStatus / normIssueTopic มีค่าตั้งต้นเสมอ', () => {
    expect(normIssueStatus('zzz')).toBe('open')
    expect(normIssueTopic(undefined)).toBe('other')
  })
  it('หัวข้อปัญหา key ไม่ซ้ำและมี label ครบ', () => {
    expect(new Set(ISSUE_TOPICS.map((t) => t.key)).size).toBe(ISSUE_TOPICS.length)
    for (const t of ISSUE_TOPICS) expect(t.label?.trim()).toBeTruthy()
  })
  it('REVIEW_STATUS_ORDER ครอบคลุมทุกสถานะ', () => {
    expect(REVIEW_STATUS_ORDER).toContain('pending')
    expect(REVIEW_STATUS_ORDER).toHaveLength(3)
  })
})
