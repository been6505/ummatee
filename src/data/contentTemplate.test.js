import { describe, it, expect } from 'vitest'
import { templateFrom, applyTemplate, suggestTemplateName, TEMPLATE_FIELDS } from './contentTemplate.js'

const EMPTY_FORM = {
  title: '', text: '', date: '', time: '10:00', platforms: [], status: 'draft',
  mediaUrls: [], mediaPublicIds: [], campaignId: '', contentType: 'post',
  liveScheduledAt: '', livePlatforms: [], liveHost: '', sources: [],
  repeatDays: [], repeatWeeks: 4, driveUrl: '', assignedToStaffId: null,
}

const post = (over = {}) => ({
  title: 'อัปเดตภารกิจกุรบาน',
  text: 'แคปชันยาวๆ',
  platforms: ['facebook', 'instagram'],
  contentType: 'video',
  campaignId: 'camp1',
  sources: [{ label: 'อ้างอิง', url: 'https://example.com' }],
  mediaUrls: ['https://img/1.jpg'],
  // ของครั้งเดียว ไม่ควรติดไปกับแม่แบบ
  date: '2026-08-02',
  time: '12:00',
  status: 'posted',
  driveUrl: 'https://drive.google.com/file/xyz',
  repeatDays: [1, 3, 5],
  assignedToStaffId: 'uid-somebody',
  ...over,
})

describe('templateFrom', () => {
  it('เก็บเฉพาะฟิลด์ที่ใช้ซ้ำได้', () => {
    const t = templateFrom(post())
    expect(t.title).toBe('อัปเดตภารกิจกุรบาน')
    expect(t.platforms).toEqual(['facebook', 'instagram'])
    expect(t.contentType).toBe('video')
    expect(t.campaignId).toBe('camp1')
  })
  it('ไม่ติดวันเวลา/สถานะ/ลิงก์ Drive/การทำซ้ำ มาด้วย', () => {
    const t = templateFrom(post())
    for (const k of ['date', 'time', 'status', 'driveUrl', 'repeatDays', 'assignedToStaffId']) {
      expect(t).not.toHaveProperty(k)
    }
  })
  it('คัดลอก array เป็นก้อนใหม่ ไม่แชร์อ้างอิงกับโพสต์ต้นทาง', () => {
    const src = post()
    const t = templateFrom(src)
    t.platforms.push('tiktok')
    expect(src.platforms).toEqual(['facebook', 'instagram'])
  })
  it('ฟิลด์ที่ไม่มีในโพสต์ก็ไม่โผล่มาเป็น undefined', () => {
    const t = templateFrom({ title: 'ชื่อเดียว' })
    expect(Object.keys(t)).toEqual(['title'])
  })
  it('รับ null ได้โดยไม่โยน error', () => {
    expect(() => templateFrom(null)).not.toThrow()
    expect(templateFrom(null)).toEqual({})
  })
})

describe('applyTemplate', () => {
  it('ได้ฟอร์มที่มีเนื้อหาเดิม แต่พร้อมเป็นโพสต์ใบใหม่', () => {
    const f = applyTemplate(EMPTY_FORM, post())
    expect(f.title).toBe('อัปเดตภารกิจกุรบาน')
    expect(f.status).toBe('draft')       // ไม่ใช่ posted ของใบเดิม
    expect(f.driveUrl).toBe('')          // ไฟล์งานของใบเดิมต้องไม่ติดมา
    expect(f.repeatDays).toEqual([])     // กันเผลอสร้างทีละหลายสิบใบ
    expect(f.assignedToStaffId).toBeNull()
    expect(f.date).toBe('')
  })
  it('ผู้เรียกกำหนดวันที่เองได้ (เช่นวันที่เลือกอยู่ในปฏิทิน)', () => {
    const f = applyTemplate(EMPTY_FORM, post(), { date: '2026-09-09' })
    expect(f.date).toBe('2026-09-09')
    expect(f.status).toBe('draft')
  })
  it('ฟิลด์ที่แม่แบบไม่มี ใช้ค่าตั้งต้นของฟอร์มเปล่า ไม่กลายเป็น undefined', () => {
    const f = applyTemplate(EMPTY_FORM, { title: 'สั้นๆ' })
    expect(f.repeatWeeks).toBe(4)
    expect(f.platforms).toEqual([])
    expect(f.text).toBe('')
  })
  it('ไม่แก้ฟอร์มเปล่าต้นฉบับ', () => {
    applyTemplate(EMPTY_FORM, post(), { date: '2026-09-09' })
    expect(EMPTY_FORM.title).toBe('')
    expect(EMPTY_FORM.date).toBe('')
  })
})

describe('suggestTemplateName', () => {
  it('ใช้ชื่อโพสต์เป็นค่าตั้งต้น', () => {
    expect(suggestTemplateName({ title: '  โพสต์ประจำสัปดาห์  ' })).toBe('โพสต์ประจำสัปดาห์')
  })
  it('โพสต์ไม่มีชื่อยังได้ชื่อที่อ่านออก ไม่ใช่ค่าว่าง', () => {
    expect(suggestTemplateName({})).toBe('แม่แบบไม่มีชื่อ')
    expect(suggestTemplateName(null)).toBe('แม่แบบไม่มีชื่อ')
  })
})

describe('TEMPLATE_FIELDS', () => {
  it('ไม่มีฟิลด์ครั้งเดียวหลุดเข้ามาในรายการ', () => {
    for (const k of ['date', 'time', 'status', 'driveUrl', 'repeatDays', 'repeatWeeks', 'assignedToStaffId', 'liveScheduledAt']) {
      expect(TEMPLATE_FIELDS).not.toContain(k)
    }
  })
})
