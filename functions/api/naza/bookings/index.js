// POST /api/naza/bookings — จองที่นั่ง + แนบสลิป (multipart/form-data) ในคำขอเดียว
//   ฟิลด์: round, seats (JSON array), name, phone, email, slip (ไฟล์รูป)
// ลำดับ: ตรวจฟอร์ม → เก็บสลิปลง R2 → บันทึกการจอง+ที่นั่งใน batch เดียว (ล้มทั้งชุดถ้าที่นั่งชน) → แจ้งอีเมล
// ที่นั่งชน → 409 { error, seat } ให้หน้าเว็บตัดที่นั่งนั้นออกแล้วให้เลือกใหม่
import { json, fail, readConfig, validateBooking, newBookingId, newCode, notifyEmail, MAX_SLIP_BYTES } from '../../../_lib/naza.js'

export async function onRequestPost({ request, env, waitUntil }) {
  let form
  try { form = await request.formData() } catch { return fail(400, 'รูปแบบคำขอไม่ถูกต้อง') }
  const config = await readConfig(env.DB)
  const v = validateBooking(Object.fromEntries([...form.entries()].filter(([, x]) => typeof x === 'string')), config)
  if (!v.ok) return fail(400, v.error)
  const slip = form.get('slip')
  if (!slip || typeof slip === 'string' || !slip.size) return fail(400, 'แนบสลิปการโอนก่อนยืนยัน')
  if (slip.size > MAX_SLIP_BYTES) return fail(400, 'ไฟล์สลิปใหญ่เกิน 10MB')
  if (slip.type && !/^image\//.test(slip.type)) return fail(400, 'รองรับเฉพาะไฟล์รูปภาพ')

  // ที่นั่งถูกถือไปแล้ว → ตอบทันทีโดยไม่ต้องอัปโหลดสลิป
  const { round, seats } = v.value
  const marks = seats.map(() => '?').join(',')
  const taken = await env.DB.prepare(`SELECT seat FROM naza_seats WHERE round = ? AND seat IN (${marks})`).bind(round, ...seats).first()
  if (taken) return fail(409, 'ที่นั่งถูกจองไปแล้ว', { seat: taken.seat })

  const id = newBookingId()
  const slipKey = `naza/${id}`
  await env.SLIPS.put(slipKey, slip.stream(), { httpMetadata: { contentType: slip.type || 'image/jpeg' } })

  const now = Date.now()
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newCode()
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO naza_bookings (id, code, round, seats, name, phone, email, amount, slip_key, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`)
          .bind(id, code, round, JSON.stringify(seats), v.value.name, v.value.phone, v.value.email, v.value.amount, slipKey, now),
        ...seats.map((s) => env.DB.prepare('INSERT INTO naza_seats (round, seat, booking_id, status, at) VALUES (?, ?, ?, ?, ?)')
          .bind(round, s, id, 'pending', now)),
      ])
      waitUntil(notifyEmail(env, id)) // อีเมล "ได้รับการจองแล้ว รอตรวจสลิป"
      return json({ id, code }, 201, { 'Access-Control-Allow-Origin': '*' })
    } catch (e) {
      const msg = String(e?.message || e)
      if (/naza_bookings\.code/.test(msg)) continue // รหัสซ้ำ (โอกาสน้อยมาก) — สุ่มใหม่
      await env.SLIPS.delete(slipKey)
      if (/naza_seats/.test(msg) && /UNIQUE|PRIMARY/i.test(msg)) {
        const t = await env.DB.prepare(`SELECT seat FROM naza_seats WHERE round = ? AND seat IN (${marks})`).bind(round, ...seats).first()
        return fail(409, 'ที่นั่งถูกจองไปแล้ว', { seat: t?.seat || seats[0] })
      }
      throw e
    }
  }
  await env.SLIPS.delete(slipKey)
  return fail(500, 'สร้างรหัสการจองไม่สำเร็จ ลองอีกครั้ง')
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '86400' } })
}
