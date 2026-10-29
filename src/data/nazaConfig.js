// ค่าคงที่ + ฟังก์ชันล้วนของระบบจองตั๋ว NAZA for GAZA (/events/Naza)
// แยกจาก naza.js (ที่แตะ Firestore) เพื่อให้เทสต์ได้โดยไม่ต้องโหลด firebase
//
// ⚠️ รายการรอบ (NAZA_ROUNDS) และรูปแบบรหัสที่นั่งถูกเขียนซ้ำไว้ใน firestore.rules
// (validNazaBooking / match /nazaSeats) — แก้ที่นี่ต้องแก้ที่ rules ด้วย ไม่งั้นจองไม่ผ่าน
// มีเทสต์ nazaConfig.test.js เทียบให้อยู่แล้ว

// date (ค.ศ.) ใช้ตอนส่งอีเมลเตือนก่อนวันงาน — ซ้ำอยู่ใน NAZA_DAY_DATES ของ docs/volunteer-apps-script/Code.gs
export const NAZA_DAYS = [
  { id: 'd6', date: '2026-11-06', w: 'ศุกร์', d: '6', m: 'พ.ย.', full: 'ศุกร์ 6 พ.ย. 2569' },
  { id: 'd7', date: '2026-11-07', w: 'เสาร์', d: '7', m: 'พ.ย.', full: 'เสาร์ 7 พ.ย. 2569' },
  { id: 'd8', date: '2026-11-08', w: 'อาทิตย์', d: '8', m: 'พ.ย.', full: 'อาทิตย์ 8 พ.ย. 2569' },
]

export const NAZA_TIMES = [
  { id: '1400', label: '14:00', end: '16:30' },
  { id: '1830', label: '18:30', end: '21:00' },
]

// แถว A–B บีนแบ็กด้านหน้า (10 ที่) · แถว C–D เก้าอี้ (20 ที่) · รวม 30 ที่ต่อรอบ
export const NAZA_ROWS = [['A', 5, 'bean'], ['B', 5, 'bean'], ['C', 10, 'chair'], ['D', 10, 'chair']]
export const SEATS_PER_ROUND = NAZA_ROWS.reduce((a, [, n]) => a + n, 0)
export const ALL_SEATS = NAZA_ROWS.flatMap(([r, n]) => Array.from({ length: n }, (_, i) => r + (i + 1)))

export const NAZA_ROUNDS = NAZA_DAYS.flatMap((d) => NAZA_TIMES.map((t) => `${d.id}-${t.id}`))

// ค่าเริ่มต้นของ config/nazaEvent — ใช้ตอนแอดมินยังไม่เคยบันทึกค่า
// price ต้องตรงกับค่า fallback ใน nazaPrice() ของ firestore.rules
export const NAZA_DEFAULTS = {
  price: 100,
  maxSeats: 4,
  promptpay: '',
  accountName: 'มูลนิธิอุมมะตี',
  closed: false,
}

export const seatDocId = (round, seat) => `${round}_${seat}`
export const seatType = (s) => ((NAZA_ROWS.find((r) => r[0] === s[0]) || [])[2] === 'bean' ? 'บีนแบ็ก' : 'เก้าอี้')

export const roundOf = (id) => {
  const [d, t] = String(id || '').split('-')
  return { day: NAZA_DAYS.find((x) => x.id === d), time: NAZA_TIMES.find((x) => x.id === t) }
}
export const roundLabel = (id) => {
  const r = roundOf(id)
  return r.day && r.time ? `${r.day.full} · ${r.time.label}–${r.time.end} น.` : String(id || '')
}
export const roundShort = (id) => {
  const r = roundOf(id)
  return r.day && r.time ? `${r.day.w} ${r.day.d} ${r.day.m} · ${r.time.label}` : String(id || '')
}

export const baht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

export const sortSeats = (a) => [...(a || [])].sort((x, y) => (
  x[0] === y[0] ? (+x.slice(1)) - (+y.slice(1)) : x.localeCompare(y)
))

// รหัสการจองที่คนอ่านออกเสียงได้หน้างาน — ตัด 0/O/1/I ที่สับสนกันออก
export function newBookingCode(rand = Math.random) {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 5; i++) s += c[Math.floor(rand() * c.length)]
  return 'NZ-' + s
}

export const cleanPhone = (p) => String(p || '').replace(/[^\d]/g, '')
export const cleanEmail = (e) => String(e || '').trim().toLowerCase()
// ต้องตรงกับ d.email.matches(...) ใน firestore.rules (เทสต์เทียบให้)
export const NAZA_EMAIL_RE = /^[^@\s]+@[^@\s]+[.][^@\s]+$/

// ตรวจฟอร์มผู้จอง — คืน object ของข้อความ error (ว่าง = ผ่าน) เงื่อนไขเดียวกับใน firestore.rules
export function validateBookingForm({ name, phone, email, hasSlip }) {
  const e = {}
  const n = String(name || '').trim()
  const p = cleanPhone(phone)
  const m = cleanEmail(email)
  if (n.length < 2 || n.length > 100) e.name = 'กรอกชื่อสำหรับเช็กอินหน้างาน'
  if (p.length < 9 || p.length > 10) e.phone = 'กรอกเบอร์โทร 9–10 หลัก'
  if (!NAZA_EMAIL_RE.test(m) || m.length > 200) e.email = 'กรอกอีเมลให้ถูกต้อง เพื่อรับตั๋วและการแจ้งเตือน'
  if (!hasSlip) e.slip = 'แนบสลิปการโอนก่อนยืนยัน'
  return e
}

export const STATUS_TEXT = {
  pending: ['pending', 'รอตรวจสลิป'],
  confirmed: ['confirmed', 'ยืนยันแล้ว'],
  rejected: ['rejected', 'ไม่ผ่านการตรวจ'],
}

// อ่านรหัสการจองจากข้อความใน QR ตั๋ว ("NAZA|NZ-XXXXX|รอบ|ที่นั่ง") — คืน null ถ้าไม่ใช่ตั๋ว NAZA
export const parseNazaQr = (text) => {
  const m = String(text || '').trim().match(/^NAZA\|(NZ-[A-Z0-9]{5})\|/)
  return m ? m[1] : null
}
