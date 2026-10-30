// ฟังก์ชันล้วนของตัวสำรองข้อมูล Firestore → Google Sheets (เทสต์ได้โดยไม่ต้องต่อเน็ต — ดู lib.test.js)

// collection ที่สำรอง — ข้อมูลธุรกิจที่ทีมต้องเปิดดูได้ถ้า Firebase มีปัญหา
// ตั้งใจ "ไม่" สำรอง:
//   socialAccounts / socialInsightsCache — มี OAuth token ของเพจโซเชียล (ห้ามไปอยู่ในชีต)
//   pushTokens — token แจ้งเตือนของผู้ใช้ ไม่มีประโยชน์ในชีต
//   chats (+ messages) / auditLog / comments — ปริมาณเยอะ และเป็นบทสนทนาส่วนตัว
//   nazaSeats — สร้างใหม่ได้จาก nazaBookings
export const BACKUP_COLLECTIONS = [
  'nazaBookings',
  'orders', 'products', 'stockMovements', 'shopPromotions', 'productReviews', 'shopIssues',
  'donations', 'campaigns', 'campaignPartners',
  'volunteerRegs', 'iftarRegs', 'eventRegistrations', 'events',
  'give2Regs', 'give2CookRegs', 'giveReceiveRegs', 'b2umRegs',
  'partnerOrganizations', 'aidLocations', 'speakers', 'staff', 'staffDirectory',
  'publicUpdates', 'missionMedia', 'config',
]

export const META_SHEET = '_backup'
const MAX_CELL = 49000 // Google Sheets รับได้ 50,000 ตัวอักษรต่อช่อง

// เวลาไทย (UTC+7 ไม่มี DST) อ่านง่ายกว่า ISO สำหรับทีมที่เปิดชีต
export function bangkokTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const t = new Date(d.getTime() + 7 * 3600 * 1000)
  return t.toISOString().replace('T', ' ').slice(0, 19)
}

// แปลง value ของ Firestore REST ({stringValue}|{integerValue}|...) เป็นค่า JS ธรรมดา
export function decodeValue(v) {
  if (!v || typeof v !== 'object') return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return Number(v.doubleValue)
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return { __ts: v.timestampValue }
  if ('referenceValue' in v) return v.referenceValue.split('/documents/')[1] || v.referenceValue
  if ('geoPointValue' in v) return { lat: v.geoPointValue.latitude ?? 0, lng: v.geoPointValue.longitude ?? 0 }
  if ('bytesValue' in v) return '[bytes]'
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue)
  if ('mapValue' in v) {
    const o = {}
    for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = decodeValue(x)
    return o
  }
  return null
}

// ค่าในช่องของชีต: ตัวเลข/ข้อความ/boolean ตรง ๆ, เวลาเป็นเวลาไทย, ที่เหลือเป็น JSON
export function cellValue(x) {
  if (x === null || x === undefined) return ''
  if (typeof x === 'object' && '__ts' in x && Object.keys(x).length === 1) return bangkokTime(x.__ts)
  if (typeof x === 'number' || typeof x === 'boolean') return x
  const s = typeof x === 'string' ? x : JSON.stringify(x, (k, v) => (v && typeof v === 'object' && '__ts' in v ? bangkokTime(v.__ts) : v))
  return s.length > MAX_CELL ? s.slice(0, MAX_CELL) + '…[ตัดทอน]' : s
}

// เอกสาร Firestore REST → { id, fields }
export function decodeDoc(doc) {
  const id = String(doc.name || '').split('/').pop()
  const fields = {}
  for (const [k, v] of Object.entries(doc.fields || {})) fields[k] = decodeValue(v)
  return { id, fields, updateTime: doc.updateTime || '' }
}

// รายการเอกสาร → ตาราง 2 มิติ (แถวแรกเป็นหัวคอลัมน์) — คอลัมน์ = ทุกฟิลด์ที่เจอ เรียงตามตัวอักษร
export function buildTable(docs) {
  const keys = new Set()
  docs.forEach((d) => Object.keys(d.fields).forEach((k) => keys.add(k)))
  const cols = [...keys].sort()
  const header = ['_id', ...cols, '_updated']
  const rows = docs
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => [d.id, ...cols.map((c) => cellValue(d.fields[c])), d.updateTime ? bangkokTime(d.updateTime) : ''])
  return [header, ...rows]
}

// ชื่อแท็บใน A1 notation ต้องครอบด้วย ' ' (และ ' ข้างในต้องซ้อนเป็น '')
export const a1 = (sheet) => `'${String(sheet).replace(/'/g, "''")}'`

// PEM (private_key ใน service account JSON) → ArrayBuffer ของ PKCS8
export function pemToDer(pem) {
  const b64 = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}

export function base64url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// เทียบสตริงแบบเวลาคงที่ (กันเดา key ทีละตัวจากเวลาตอบ)
export function safeEqual(a, b) {
  const x = String(a || ''), y = String(b || '')
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0)
  return diff === 0
}
