// POST /api/admin/naza/bookings/:id/:action
//   confirm   — ยืนยันที่นั่ง (ถ้าเคยปฏิเสธแล้วคืนที่ไป ต้องยังว่างอยู่ ไม่งั้น 409 { seat })
//   reject    — ปฏิเสธ + คืนที่นั่งให้คนอื่นจองต่อทันที
//   checkin / uncheckin — เช็กอินหน้างาน
//   email     — สั่งส่งอีเมลตามสถานะปัจจุบันอีกครั้ง (Apps Script ไม่ส่งซ้ำถ้าเคยส่งสำเร็จแล้ว)
import { json, fail, bookingOut, notifyEmail } from '../../../../../_lib/naza.js'

export async function onRequestPost({ params, env, data, waitUntil }) {
  const { id, action } = params
  const db = env.DB
  const r = await db.prepare('SELECT * FROM naza_bookings WHERE id = ?').bind(String(id)).first()
  if (!r) return fail(404, 'ไม่พบการจอง')
  const seats = JSON.parse(r.seats || '[]')
  const now = Date.now()
  const who = data.email

  if (action === 'confirm') {
    const marks = seats.map(() => '?').join(',')
    const other = await db.prepare(`SELECT seat FROM naza_seats WHERE round = ? AND seat IN (${marks}) AND booking_id <> ?`)
      .bind(r.round, ...seats, r.id).first()
    if (other) return fail(409, `ที่นั่ง ${other.seat} ถูกการจองอื่นถือไว้แล้ว`, { seat: other.seat })
    await db.batch([
      ...seats.map((s) => db.prepare(`INSERT INTO naza_seats (round, seat, booking_id, status, at) VALUES (?, ?, ?, 'confirmed', ?)
                                      ON CONFLICT(round, seat) DO UPDATE SET status = 'confirmed', at = excluded.at
                                      WHERE naza_seats.booking_id = excluded.booking_id`).bind(r.round, s, r.id, now)),
      db.prepare(`UPDATE naza_bookings SET status = 'confirmed', reviewed_at = ?, reviewed_by = ? WHERE id = ?`).bind(now, who, r.id),
    ])
    // กันกรณีมีคนจองแทรกระหว่างตรวจกับบันทึก — ถ้าได้ที่นั่งไม่ครบ ถอยสถานะกลับเป็นรอตรวจ
    const held = await db.prepare('SELECT COUNT(*) AS n FROM naza_seats WHERE booking_id = ?').bind(r.id).first()
    if ((held?.n || 0) < seats.length) {
      await db.prepare(`UPDATE naza_bookings SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL WHERE id = ?`).bind(r.id).run()
      return fail(409, 'มีที่นั่งถูกจองแทรก ยืนยันไม่ได้')
    }
    waitUntil(notifyEmail(env, r.id)) // อีเมลตั๋วพร้อม QR
  } else if (action === 'reject') {
    await db.batch([
      db.prepare('DELETE FROM naza_seats WHERE booking_id = ?').bind(r.id),
      db.prepare(`UPDATE naza_bookings SET status = 'rejected', reviewed_at = ?, reviewed_by = ? WHERE id = ?`).bind(now, who, r.id),
    ])
    waitUntil(notifyEmail(env, r.id)) // อีเมลแจ้งสลิปไม่ผ่าน
  } else if (action === 'checkin' || action === 'uncheckin') {
    if (action === 'checkin' && r.status !== 'confirmed') return fail(409, 'ตั๋วนี้ยังไม่ได้ยืนยัน')
    const on = action === 'checkin'
    await db.prepare('UPDATE naza_bookings SET checked_in_at = ?, checked_in_by = ? WHERE id = ?').bind(on ? now : null, on ? who : null, r.id).run()
  } else if (action === 'email') {
    const res = await notifyEmail(env, r.id)
    return json({ result: res })
  } else {
    return fail(404, 'ไม่รู้จักคำสั่ง')
  }
  const after = await db.prepare('SELECT * FROM naza_bookings WHERE id = ?').bind(r.id).first()
  return json(bookingOut(after, { admin: true }))
}
