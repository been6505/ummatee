// รีวิวสินค้า + แจ้งปัญหา จากลูกค้า um-shop
//
// ไฟล์นี้ไม่แตะ firebase (เทสต์ได้โดยไม่ต้องมี DOM) — มีแต่กฎว่าอะไรส่งได้/ส่งไม่ได้
// ⚠️ สองอย่างนี้ "ใครก็ส่งได้" เพราะลูกค้าไม่ได้ล็อกอิน (guest checkout) การตรวจฝั่งนี้จึงเป็นแค่
//    การช่วยผู้ใช้ ไม่ใช่การกันของเสีย — ตัวกันจริงคือ firestore.rules ที่ตรวจซ้ำทุกข้อ

export const MAX_REVIEW_LEN = 1000
export const MAX_ISSUE_LEN = 1500
export const MAX_NAME_LEN = 60
export const MAX_PHOTOS = 4

// รีวิวขึ้นหน้าเว็บสาธารณะ จึงต้องผ่านการอนุมัติก่อนเสมอ — ไม่ใช่ขึ้นทันทีแล้วค่อยตามลบ
export const REVIEW_STATUS = {
  pending: 'รอตรวจ',
  approved: 'เผยแพร่แล้ว',
  rejected: 'ไม่เผยแพร่',
}
export const REVIEW_STATUS_ORDER = ['pending', 'approved', 'rejected']
export const normReviewStatus = (s) => (REVIEW_STATUS[s] ? s : 'pending')

export const ISSUE_TOPICS = [
  { key: 'not_received', label: 'ยังไม่ได้รับสินค้า' },
  { key: 'damaged', label: 'สินค้าชำรุด/เสียหาย' },
  { key: 'wrong_item', label: 'ได้สินค้าผิด' },
  { key: 'payment', label: 'ปัญหาการชำระเงิน' },
  { key: 'other', label: 'อื่นๆ' },
]
export const ISSUE_TOPIC_LABEL = Object.fromEntries(ISSUE_TOPICS.map((t) => [t.key, t.label]))
export const normIssueTopic = (t) => (ISSUE_TOPIC_LABEL[t] ? t : 'other')

export const ISSUE_STATUS = { open: 'รอดำเนินการ', working: 'กำลังแก้ไข', done: 'แก้ไขแล้ว' }
export const ISSUE_STATUS_ORDER = ['open', 'working', 'done']
export const normIssueStatus = (s) => (ISSUE_STATUS[s] ? s : 'open')

const clean = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max)
// ข้อความยาว (รีวิว/รายละเอียดปัญหา) เก็บการขึ้นบรรทัดไว้ ยุบเฉพาะช่องว่างในบรรทัดเดียวกัน
const cleanMultiline = (v, max) =>
  String(v || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)

// รับเฉพาะ https ของ Cloudinary — ค่านี้ไปโผล่ใน <img src> บนหน้าสาธารณะ
// ถ้ารับ URL อะไรก็ได้ จะกลายเป็นช่องให้ฝังรูปจากที่อื่น (หรือ javascript:) ผ่านฟอร์มที่ใครก็ส่งได้
export const isUploadedPhotoUrl = (u) => /^https:\/\/res\.cloudinary\.com\/[\w./-]+$/i.test(String(u || ''))
export const cleanPhotos = (list) =>
  (Array.isArray(list) ? list : []).filter(isUploadedPhotoUrl).slice(0, MAX_PHOTOS)

// ดาว 1–5 เท่านั้น ไม่มีทศนิยม — ค่านอกช่วงปัดเข้าขอบ ไม่ใช่ทิ้งรีวิวทั้งอัน
export const cleanRating = (r) => {
  const n = Math.round(Number(r))
  if (!Number.isFinite(n)) return 5
  return Math.min(5, Math.max(1, n))
}

// คืน { ok, error, value } — value คือของที่พร้อมส่งเข้า Firestore แล้ว
export function buildReview({ productId, productName, rating, text, authorName, photos }) {
  const t = cleanMultiline(text, MAX_REVIEW_LEN)
  if (!String(productId || '').trim()) return { ok: false, error: 'ไม่รู้ว่ารีวิวสินค้าชิ้นไหน' }
  if (!t) return { ok: false, error: 'กรุณาเขียนรีวิว' }
  return {
    ok: true,
    value: {
      productId: String(productId).trim(),
      productName: clean(productName, 200),
      rating: cleanRating(rating),
      text: t,
      authorName: clean(authorName, MAX_NAME_LEN) || 'ลูกค้า',
      photos: cleanPhotos(photos),
      status: 'pending',
      createdAt: Date.now(),
    },
  }
}

export function buildIssue({ orderCode, phone, topic, detail, photos }) {
  const d = cleanMultiline(detail, MAX_ISSUE_LEN)
  const p = clean(phone, 20)
  if (!d) return { ok: false, error: 'กรุณาอธิบายปัญหาที่พบ' }
  // ต้องมีอย่างน้อยหนึ่งอย่างที่ติดต่อกลับหรือหาออเดอร์เจอ ไม่งั้นแจ้งมาแล้วช่วยอะไรไม่ได้
  if (!p && !clean(orderCode, 30)) return { ok: false, error: 'กรุณากรอกเลขออเดอร์หรือเบอร์โทรที่ติดต่อได้' }
  return {
    ok: true,
    value: {
      orderCode: clean(orderCode, 30),
      phone: p,
      topic: normIssueTopic(topic),
      detail: d,
      photos: cleanPhotos(photos),
      status: 'open',
      createdAt: Date.now(),
    },
  }
}

// ค่าเฉลี่ยดาว — ปัด 1 ตำแหน่ง คืน null เมื่อยังไม่มีรีวิว (ไม่ใช่ 0 ที่อ่านเหมือนได้ศูนย์ดาว)
export function averageRating(reviews) {
  const list = (reviews || []).filter((r) => Number.isFinite(Number(r?.rating)))
  if (list.length === 0) return null
  return Math.round((list.reduce((s, r) => s + Number(r.rating), 0) / list.length) * 10) / 10
}
