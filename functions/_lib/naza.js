// ตัวช่วยฝั่งเซิร์ฟเวอร์ของระบบจอง NAZA (Cloudflare Pages Functions + D1 + R2)
// ใช้ค่าคงที่ชุดเดียวกับหน้าเว็บ (src/data/nazaConfig.js) — รอบ/ที่นั่ง/ราคาเริ่มต้นจึงไม่มีทางไม่ตรงกัน
import {
  NAZA_ROUNDS, ALL_SEATS, NAZA_DEFAULTS, NAZA_EMAIL_RE, cleanPhone, cleanEmail, sortSeats,
} from '../../src/data/nazaConfig.js'

export const MAX_SLIP_BYTES = 10 * 1024 * 1024
const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomFrom(chars, n) {
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  // 256 % 62 ไม่ลงตัว — ใช้ rejection sampling กันตัวอักษรต้น ๆ ถูกเลือกบ่อยกว่า (id ต้องเดายาก)
  let out = ''
  const limit = 256 - (256 % chars.length)
  for (let i = 0; out.length < n; i++) {
    if (i >= bytes.length) { crypto.getRandomValues(bytes); i = 0 }
    if (bytes[i] < limit) out += chars[bytes[i] % chars.length]
  }
  return out
}
export const newBookingId = () => randomFrom(ID_CHARS, 20)
export const newCode = () => 'NZ-' + randomFrom(CODE_CHARS, 5)

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } })

export const fail = (status, error, extra = {}) => json({ error, ...extra }, status)

export async function readConfig(db) {
  const row = await db.prepare('SELECT data FROM naza_config WHERE id = 1').first()
  let data = {}
  try { data = row ? JSON.parse(row.data) : {} } catch { data = {} }
  return { ...NAZA_DEFAULTS, ...data }
}

// ตรวจค่าที่แอดมินบันทึก — ราคาเป็นจำนวนเต็มบวก, จองได้ 1–4 ที่ต่อครั้ง
export function cleanConfig(input) {
  const price = Math.round(Number(input.price))
  const maxSeats = Math.round(Number(input.maxSeats))
  if (!(price > 0 && price <= 100000)) throw new Error('ราคาต้องเป็นจำนวนเต็ม 1–100,000')
  if (!(maxSeats >= 1 && maxSeats <= 4)) throw new Error('จำนวนที่นั่งต่อครั้งต้องอยู่ระหว่าง 1–4')
  return {
    price, maxSeats,
    promptpay: String(input.promptpay || '').trim().slice(0, 40),
    accountName: String(input.accountName || '').trim().slice(0, 120),
    closed: !!input.closed,
  }
}

// ตรวจฟอร์มจอง — คืน { ok, value } หรือ { ok:false, error }
export function validateBooking(input, config) {
  const round = String(input.round || '')
  let seats = input.seats
  if (typeof seats === 'string') { try { seats = JSON.parse(seats) } catch { seats = null } }
  const name = String(input.name || '').trim()
  const phone = cleanPhone(input.phone)
  const email = cleanEmail(input.email)
  if (config.closed) return { ok: false, error: 'ปิดรับจองแล้ว' }
  if (!config.promptpay) return { ok: false, error: 'ยังไม่เปิดรับชำระเงิน' }
  if (!NAZA_ROUNDS.includes(round)) return { ok: false, error: 'รอบไม่ถูกต้อง' }
  const max = Math.min(4, Math.max(1, Number(config.maxSeats) || 4))
  if (!Array.isArray(seats) || seats.length < 1 || seats.length > max) return { ok: false, error: `เลือกที่นั่ง 1–${max} ที่` }
  if (new Set(seats).size !== seats.length || seats.some((s) => !ALL_SEATS.includes(s))) return { ok: false, error: 'ที่นั่งไม่ถูกต้อง' }
  if (name.length < 2 || name.length > 100) return { ok: false, error: 'กรอกชื่อ 2–100 ตัวอักษร' }
  if (phone.length < 9 || phone.length > 10) return { ok: false, error: 'กรอกเบอร์โทร 9–10 หลัก' }
  if (email.length > 200 || !NAZA_EMAIL_RE.test(email)) return { ok: false, error: 'อีเมลไม่ถูกต้อง' }
  const sorted = sortSeats(seats)
  return { ok: true, value: { round, seats: sorted, name, phone, email, amount: sorted.length * config.price } }
}

// แถว D1 → ข้อมูลการจองที่ส่งให้หน้าเว็บ (ชื่อฟิลด์แบบเดียวกับที่หน้าเว็บเคยได้จาก Firestore)
export function bookingOut(r, { admin = false } = {}) {
  if (!r) return null
  const b = {
    id: r.id, code: r.code, round: r.round, seats: JSON.parse(r.seats || '[]'), name: r.name, email: r.email,
    amount: r.amount, status: r.status, createdAt: r.created_at, reviewedAt: r.reviewed_at || null,
    checkedInAt: r.checked_in_at || null,
  }
  if (admin) {
    b.phone = r.phone
    b.reviewedBy = r.reviewed_by || null
    b.checkedInBy = r.checked_in_by || null
    b.adminNote = r.admin_note || ''
    b.slipUrl = r.slip_key ? `/api/admin/naza/slip/${r.id}` : (r.slip_url || '')
  }
  return b
}

// ── Cloudflare Access: ตรวจ JWT ที่ Access แนบมากับทุก request ──────────────
// ทำซ้ำในโค้ดแม้ Access กันหน้าไว้แล้ว เพราะโดเมน *.pages.dev ไม่ได้อยู่หลัง Access ถ้าไม่ได้ตั้งแยก
let jwksCache = { team: '', at: 0, keys: [] }

function b64urlToBytes(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

async function accessKeys(team, fetchFn) {
  if (jwksCache.team === team && Date.now() - jwksCache.at < 3600_000 && jwksCache.keys.length) return jwksCache.keys
  const res = await fetchFn(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`)
  if (!res.ok) throw new Error('โหลด key ของ Cloudflare Access ไม่ได้')
  const { keys = [] } = await res.json()
  jwksCache = { team, at: Date.now(), keys }
  return keys
}

export function cookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? m[1] : ''
}

// คืนอีเมลของผู้ล็อกอิน (ตัวพิมพ์เล็ก) หรือโยน error ถ้า token ไม่ถูกต้อง
export async function verifyAccessJwt(token, { team, aud }, fetchFn = fetch) {
  if (!team || !aud) throw new Error('ยังไม่ได้ตั้ง ACCESS_TEAM / ACCESS_AUD')
  const [h, p, s] = String(token || '').split('.')
  if (!h || !p || !s) throw new Error('ไม่มี token')
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)))
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)))
  if (header.alg !== 'RS256') throw new Error('alg ไม่รองรับ')
  const jwk = (await accessKeys(team, fetchFn)).find((k) => k.kid === header.kid)
  if (!jwk) throw new Error('ไม่รู้จัก key')
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`))
  if (!ok) throw new Error('ลายเซ็นไม่ถูกต้อง')
  const now = Date.now() / 1000
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!auds.includes(aud)) throw new Error('aud ไม่ตรง')
  if (payload.iss !== `https://${team}.cloudflareaccess.com`) throw new Error('iss ไม่ตรง')
  if (!(payload.exp > now) || (payload.nbf && payload.nbf > now + 60)) throw new Error('token หมดอายุ')
  if (!payload.email) throw new Error('token ไม่มีอีเมล')
  return String(payload.email).toLowerCase()
}

export const adminEmails = (env) =>
  String(env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

// แจ้ง Apps Script ให้ส่งอีเมลตามสถานะการจอง (สคริปต์อ่านการจองจาก /api/naza/bookings/:id เอง)
export async function notifyEmail(env, bookingId, fetchFn = fetch) {
  if (!env.EMAIL_SCRIPT_URL) return null
  try {
    const res = await fetchFn(env.EMAIL_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ token: env.EMAIL_SCRIPT_TOKEN, type: 'nazaBooking', bookingId }),
    })
    const text = await res.text()
    return text.trim().startsWith('{') ? JSON.parse(text) : null
  } catch { return null }
}
