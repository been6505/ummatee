// GET /api/admin/naza/bookings — การจองทั้งหมด + ที่นั่งทุกรอบ (พร้อม booking id) + ค่าตั้งงาน
import { json, readConfig, bookingOut } from '../../../_lib/naza.js'

export async function onRequestGet({ env }) {
  const [rows, seats, config] = await Promise.all([
    env.DB.prepare('SELECT * FROM naza_bookings ORDER BY created_at ASC').all(),
    env.DB.prepare('SELECT round, seat, booking_id, status FROM naza_seats').all(),
    readConfig(env.DB),
  ])
  const seatMap = {}
  for (const s of seats.results || []) seatMap[`${s.round}_${s.seat}`] = { round: s.round, seat: s.seat, bookingId: s.booking_id, status: s.status }
  return json({ bookings: (rows.results || []).map((r) => bookingOut(r, { admin: true })), seats: seatMap, config })
}
