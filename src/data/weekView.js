// ตัวช่วยของปฏิทินรายสัปดาห์ — คิดบนสตริง "YYYY-MM-DD" ล้วน ไม่แตะ firebase และไม่อ่านนาฬิกาเอง
// (เทสต์ได้โดยไม่ต้องมี DOM — เหตุผลเดียวกับ orderStatus.js / campaignProgress.js / liveSchedule.js)
//
// สัปดาห์เริ่มวันอาทิตย์ ให้ตรงกับตารางเดือนในหน้าปฏิทินคอนเทนต์ — สองหน้านี้ต้องเรียงวันเหมือนกัน
// ไม่งั้นสลับหน้าไปมาแล้วอ่านผิดคอลัมน์

const pad = (n) => String(n).padStart(2, '0')

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// สร้าง Date จาก key แบบเวลาท้องถิ่น (new Date('2026-08-01') ตีความเป็น UTC ซึ่งใน +07
// จะเลื่อนกลับไปเป็นวันก่อนหน้าเมื่ออ่านค่าด้วย getDate())
export function fromKey(key) {
  const m = String(key || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

// วันอาทิตย์ของสัปดาห์ที่ key นั้นอยู่ — getDay() คืน 0=อาทิตย์อยู่แล้ว จึงถอยกลับเท่ากับค่าที่ได้ตรงๆ
export function weekStart(key) {
  const d = fromKey(key)
  if (!d) return ''
  d.setDate(d.getDate() - d.getDay())
  return toKey(d)
}

export function weekDays(startKey) {
  const d = fromKey(startKey)
  if (!d) return []
  const out = []
  for (let i = 0; i < 7; i++) {
    out.push(toKey(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

// เลื่อนสัปดาห์ — บวกทีละวันผ่าน Date เพื่อให้ข้ามเดือน/ปีถูกเอง
export function shiftWeek(startKey, weeks) {
  const d = fromKey(startKey)
  if (!d) return ''
  d.setDate(d.getDate() + weeks * 7)
  return toKey(d)
}

export const WEEK_COLUMNS = [
  { dow: 0, label: 'อาทิตย์', short: 'อา' },
  { dow: 1, label: 'จันทร์', short: 'จ' },
  { dow: 2, label: 'อังคาร', short: 'อ' },
  { dow: 3, label: 'พุธ', short: 'พ' },
  { dow: 4, label: 'พฤหัสบดี', short: 'พฤ' },
  { dow: 5, label: 'ศุกร์', short: 'ศ' },
  { dow: 6, label: 'เสาร์', short: 'ส' },
]

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// "1 ส.ค." — ใช้บนหัวคอลัมน์ ต้องสั้นเพราะมี 7 คอลัมน์บนจอเดียว
export function dayLabel(key) {
  const d = fromKey(key)
  if (!d) return ''
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]}`
}

// ช่วงของสัปดาห์แบบอ่านง่าย พร้อม พ.ศ. — ข้ามเดือน/ปีต้องบอกให้ครบ ไม่งั้นดูไม่ออกว่าอยู่ช่วงไหน
export function weekRangeLabel(startKey) {
  const a = fromKey(startKey)
  const b = fromKey(weekDays(startKey)[6])
  if (!a || !b) return ''
  const be = (d) => d.getFullYear() + 543
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getDate()} ${TH_MONTHS[a.getMonth()]} ${be(a)} – ${b.getDate()} ${TH_MONTHS[b.getMonth()]} ${be(b)}`
  }
  if (a.getMonth() !== b.getMonth()) {
    return `${a.getDate()} ${TH_MONTHS[a.getMonth()]} – ${b.getDate()} ${TH_MONTHS[b.getMonth()]} ${be(b)}`
  }
  return `${a.getDate()} – ${b.getDate()} ${TH_MONTHS[b.getMonth()]} ${be(b)}`
}

// จัดโพสต์ลงช่องวัน — คืนคีย์ครบทั้ง 7 วันเสมอแม้วันนั้นไม่มีโพสต์ คอลัมน์จะได้ไม่หายไป
export function groupByDay(posts, days) {
  const map = {}
  for (const k of days) map[k] = []
  for (const p of posts || []) {
    if (map[p?.date]) map[p.date].push(p)
  }
  for (const k of days) {
    map[k].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  }
  return map
}
