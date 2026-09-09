// ข่าวความคืบหน้าการช่วยเหลือที่เผยแพร่สู่สาธารณะ (/updates)
//
// ทำไมต้องมี collection ใหม่ แทนที่จะเปิด `campaigns` ให้อ่านสาธารณะ:
// campaigns เป็นข้อมูล "การทำงานภายใน" — มีผู้รับผิดชอบ งบ สถานะแผน ฯลฯ ปนอยู่ในเอกสารเดียวกัน
// การเปิดอ่านทั้ง doc แปลว่าเปิดทุกฟิลด์ รวมฟิลด์ที่จะเพิ่มมาในอนาคตซึ่งไม่มีใครทันคิดว่าจะหลุด
// collection นี้จึงเก็บเฉพาะสิ่งที่ "ตั้งใจให้คนนอกเห็น" ทีมเป็นคนเลือกเขียนลงมาเอง
//
// ไฟล์นี้ไม่แตะ firebase (เทสต์ได้โดยไม่ต้องมี DOM) — มีแต่กฎว่าอะไรเผยแพร่ได้/ไม่ได้

import { isUploadedPhotoUrl, cleanPhotoList } from '../utils/photoUrl.js'

export const MAX_TITLE_LEN = 120
export const MAX_SUMMARY_LEN = 300
export const MAX_BODY_LEN = 4000
export const MAX_PLACE_LEN = 80
export const MAX_PHOTOS = 6

// draft = ยังไม่ขึ้นเว็บ, published = ขึ้นแล้ว
// ตั้งต้นเป็น draft เสมอ — ข่าวที่ยังเขียนไม่เสร็จต้องไม่หลุดออกไปเพราะเผลอกดผิด
export const UPDATE_STATUS = { draft: 'ฉบับร่าง', published: 'เผยแพร่แล้ว' }
export const UPDATE_STATUS_ORDER = ['draft', 'published']
export const normUpdateStatus = (s) => (UPDATE_STATUS[s] ? s : 'draft')

export const UPDATE_CATEGORIES = [
  { key: 'relief', label: 'ความช่วยเหลือ', color: '#2e7d32' },
  { key: 'campaign', label: 'แคมเปญ', color: '#0e7490' },
  { key: 'event', label: 'กิจกรรม', color: '#b45309' },
  { key: 'report', label: 'รายงานผล', color: '#6d28d9' },
  { key: 'other', label: 'อื่นๆ', color: '#6b7280' },
]
export const CATEGORY_LABEL = Object.fromEntries(UPDATE_CATEGORIES.map((c) => [c.key, c.label]))
export const CATEGORY_COLOR = Object.fromEntries(UPDATE_CATEGORIES.map((c) => [c.key, c.color]))
export const normCategory = (c) => (CATEGORY_LABEL[c] ? c : 'other')

const clean = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max)
const cleanMultiline = (v, max) =>
  String(v || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)

// ตัวตรวจใช้ร่วมกับ shopFeedback.js — อยู่ที่ utils/photoUrl.js ที่เดียว ไม่เขียนซ้ำ
export { isUploadedPhotoUrl }
export const cleanPhotos = (list) => cleanPhotoList(list, MAX_PHOTOS)

// วันที่แบบ YYYY-MM-DD เท่านั้น — ห้าม new Date(str) เพราะมันตีความเป็น UTC
// พอเป็นเวลาไทย (+07) getDate() จะได้ "วันก่อนหน้า" (เคยพลาดมาแล้วที่ปฏิทิน)
export const isDateKey = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))

// คืน { ok, error, value } — value พร้อมส่งเข้า Firestore
export function buildUpdate({ title, summary, body, category, place, date, photos, authorName, status }) {
  const t = clean(title, MAX_TITLE_LEN)
  if (!t) return { ok: false, error: 'กรุณาใส่หัวข้อข่าว' }
  const b = cleanMultiline(body, MAX_BODY_LEN)
  if (!b) return { ok: false, error: 'กรุณาเขียนเนื้อหา' }
  const d = clean(date, 10)
  if (d && !isDateKey(d)) return { ok: false, error: 'รูปแบบวันที่ต้องเป็น ปปปป-ดด-วว' }
  return {
    ok: true,
    value: {
      title: t,
      // ไม่มีคำโปรยก็ตัดจากเนื้อหามาให้ — หน้ารวมข่าวต้องมีอะไรให้อ่านใต้หัวข้อเสมอ
      summary: clean(summary, MAX_SUMMARY_LEN) || b.replace(/\n/g, ' ').slice(0, 140),
      body: b,
      category: normCategory(category),
      place: clean(place, MAX_PLACE_LEN),
      date: d,
      photos: cleanPhotos(photos),
      authorName: clean(authorName, 60),
      status: normUpdateStatus(status),
      updatedAt: Date.now(),
    },
  }
}

// เรียงใหม่ไปเก่า โดยใช้ date ถ้ามี ไม่งั้นใช้เวลาที่บันทึก
// เรียงฝั่ง client เสมอ — where('status','==','published') + orderBy คนละฟิลด์ ต้องมี composite index
// ที่ Firestore ไม่สร้างให้เอง แล้ว query จะพังเงียบ ๆ (เจอมาแล้วหลายรอบในโปรเจกต์นี้)
export function sortUpdates(list) {
  return [...(list || [])].sort((a, b) => {
    const ka = a?.date || ''
    const kb = b?.date || ''
    if (ka !== kb) return kb.localeCompare(ka)
    return Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0)
  })
}

// เฉพาะที่เผยแพร่แล้ว — ใช้กรองซ้ำฝั่ง client ด้วย ไม่ได้เชื่อ query อย่างเดียว
export const publishedOnly = (list) =>
  (list || []).filter((u) => normUpdateStatus(u?.status) === 'published')
