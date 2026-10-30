import { describe, it, expect } from 'vitest'
import { validateBooking, cleanConfig, bookingOut, verifyAccessJwt, newBookingId, newCode, adminEmails, cookie } from '../../functions/_lib/naza.js'
import { NAZA_DEFAULTS } from '../../src/data/nazaConfig.js'

const OPEN = { ...NAZA_DEFAULTS, promptpay: '0812345678' }
const good = { round: 'd6-1400', seats: '["C3","A1"]', name: 'สมชาย ใจดี', phone: '081-234-5678', email: ' A@B.co ' }

describe('validateBooking (ด่านจริงของการจอง — แทน firestore.rules เดิม)', () => {
  it('รับฟอร์มที่ถูกต้อง คิดราคาที่เซิร์ฟเวอร์ และเรียงที่นั่ง', () => {
    const r = validateBooking(good, { ...OPEN, price: 150 })
    expect(r).toEqual({ ok: true, value: { round: 'd6-1400', seats: ['A1', 'C3'], name: 'สมชาย ใจดี', phone: '0812345678', email: 'a@b.co', amount: 300 } })
  })
  it.each([
    ['ปิดรับจอง', good, { ...OPEN, closed: true }],
    ['ยังไม่ตั้งพร้อมเพย์', good, NAZA_DEFAULTS],
    ['รอบไม่มี', { ...good, round: 'd9-1400' }, OPEN],
    ['ที่นั่งไม่มีในผัง (ผังเก่า C10)', { ...good, seats: '["C10"]' }, OPEN],
    ['ที่นั่งซ้ำ', { ...good, seats: '["A1","A1"]' }, OPEN],
    ['เกินจำนวนที่ตั้งไว้', { ...good, seats: '["A1","A2","A3"]' }, { ...OPEN, maxSeats: 2 }],
    ['ไม่เลือกที่นั่ง', { ...good, seats: '[]' }, OPEN],
    ['seats ไม่ใช่ JSON', { ...good, seats: 'A1' }, OPEN],
    ['ชื่อสั้นเกิน', { ...good, name: 'ก' }, OPEN],
    ['เบอร์สั้นเกิน', { ...good, phone: '1234' }, OPEN],
    ['อีเมลผิด', { ...good, email: 'nope' }, OPEN],
  ])('ปฏิเสธ: %s', (_, input, cfg) => {
    expect(validateBooking(input, cfg).ok).toBe(false)
  })
  it('maxSeats ในค่าตั้งเกิน 4 ก็ยังจองได้ไม่เกิน 4', () => {
    expect(validateBooking({ ...good, seats: '["A1","A2","A3","A4","A5"]' }, { ...OPEN, maxSeats: 9 }).ok).toBe(false)
  })
})

describe('cleanConfig', () => {
  it('ปัดราคาเป็นจำนวนเต็ม ตัดฟิลด์แปลกปลอม', () => {
    expect(cleanConfig({ price: '120.4', maxSeats: 3, promptpay: ' 081 ', accountName: 'มูลนิธิ', closed: 1, evil: 1 }))
      .toEqual({ price: 120, maxSeats: 3, promptpay: '081', accountName: 'มูลนิธิ', closed: true })
  })
  it('ไม่รับราคา 0 หรือจำนวนที่นั่งเกิน 4', () => {
    expect(() => cleanConfig({ price: 0, maxSeats: 4 })).toThrow()
    expect(() => cleanConfig({ price: 100, maxSeats: 5 })).toThrow()
  })
})

describe('bookingOut', () => {
  const row = { id: 'x', code: 'NZ-ABCDE', round: 'd6-1400', seats: '["A1"]', name: 'n', email: 'e@x.co', phone: '0812345678', amount: 100, status: 'pending', created_at: 1, slip_key: 'naza/x' }
  it('มุมมองสาธารณะไม่มีเบอร์และสลิป', () => {
    const b = bookingOut(row)
    expect(b.phone).toBeUndefined()
    expect(b.slipUrl).toBeUndefined()
    expect(b.seats).toEqual(['A1'])
  })
  it('มุมมองแอดมินมีเบอร์ และสลิปชี้ endpoint ส่วนตัว', () => {
    const b = bookingOut(row, { admin: true })
    expect(b.phone).toBe('0812345678')
    expect(b.slipUrl).toBe('/api/admin/naza/slip/x')
    expect(bookingOut({ ...row, slip_key: null, slip_url: 'https://res.cloudinary.com/a.jpg' }, { admin: true }).slipUrl).toBe('https://res.cloudinary.com/a.jpg')
  })
})

describe('id/รหัส', () => {
  it('id ยาว 20 ตัวและไม่ซ้ำกัน', () => {
    const ids = new Set(Array.from({ length: 500 }, newBookingId))
    expect(ids.size).toBe(500)
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{20}$/)
  })
  it('รหัสการจอง', () => { expect(newCode()).toMatch(/^NZ-[A-HJ-NP-Z2-9]{5}$/) })
  it('รายชื่ออีเมลแอดมิน', () => { expect(adminEmails({ ADMIN_EMAILS: ' A@x.com, ,b@y.com' })).toEqual(['a@x.com', 'b@y.com']) })
  it('อ่าน cookie', () => {
    const req = new Request('https://x', { headers: { Cookie: 'a=1; CF_Authorization=tok.en; b=2' } })
    expect(cookie(req, 'CF_Authorization')).toBe('tok.en')
  })
})

describe('verifyAccessJwt (Cloudflare Access)', () => {
  const team = 'ummatee', aud = 'AUD123'
  const b64u = (x) => Buffer.from(typeof x === 'string' ? x : new Uint8Array(x)).toString('base64url')
  async function setup() {
    const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
    const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1' }
    const fetchFn = async (url) => {
      expect(url).toBe(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`)
      return new Response(JSON.stringify({ keys: [jwk] }))
    }
    const sign = async (payload, kid = 'k1') => {
      const h = b64u(JSON.stringify({ alg: 'RS256', kid })), p = b64u(JSON.stringify(payload))
      const s = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`))
      return `${h}.${p}.${b64u(s)}`
    }
    const now = Math.floor(Date.now() / 1000)
    const base = { aud: [aud], iss: `https://${team}.cloudflareaccess.com`, exp: now + 600, email: 'Admin@Gmail.com' }
    return { fetchFn, sign, base, now }
  }
  it('token ถูกต้อง → คืนอีเมลตัวพิมพ์เล็ก', async () => {
    const { fetchFn, sign, base } = await setup()
    expect(await verifyAccessJwt(await sign(base), { team, aud }, fetchFn)).toBe('admin@gmail.com')
  })
  it.each([
    ['aud ผิด', (b) => ({ ...b, aud: ['OTHER'] })],
    ['iss ผิด', (b) => ({ ...b, iss: 'https://evil.cloudflareaccess.com' })],
    ['หมดอายุ', (b, now) => ({ ...b, exp: now - 10 })],
    ['ไม่มีอีเมล', (b) => ({ ...b, email: undefined })],
  ])('ปฏิเสธ: %s', async (_, mut) => {
    const { fetchFn, sign, base, now } = await setup()
    await expect(verifyAccessJwt(await sign(mut(base, now)), { team, aud }, fetchFn)).rejects.toThrow()
  })
  it('ปฏิเสธ token ที่ถูกแก้ payload หลังเซ็น และ key ที่ไม่รู้จัก', async () => {
    const { fetchFn, sign, base } = await setup()
    const [h, , s] = (await sign(base)).split('.')
    const forged = `${h}.${b64u(JSON.stringify({ ...base, email: 'hacker@x.com' }))}.${s}`
    await expect(verifyAccessJwt(forged, { team, aud }, fetchFn)).rejects.toThrow('ลายเซ็น')
    await expect(verifyAccessJwt(await sign(base, 'k2'), { team, aud }, fetchFn)).rejects.toThrow('key')
  })
  it('ไม่ได้ตั้งค่า/ไม่มี token', async () => {
    await expect(verifyAccessJwt('a.b.c', { team: '', aud })).rejects.toThrow('ACCESS_TEAM')
    await expect(verifyAccessJwt('', { team, aud })).rejects.toThrow('token')
  })
})
