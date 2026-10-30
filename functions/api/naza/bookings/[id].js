// GET /api/naza/bookings/:id — ตั๋วหนึ่งใบ (ผู้จองเปิดด้วย id สุ่มที่จำไว้ในเครื่อง/ลิงก์ในอีเมล)
// Apps Script ที่ส่งอีเมลก็อ่านการจองจากที่นี่ — ไม่มีเบอร์โทรและสลิป
import { json, fail, bookingOut } from '../../../_lib/naza.js'

export async function onRequestGet({ params, env }) {
  const id = String(params.id || '')
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return fail(404, 'ไม่พบการจอง')
  const r = await env.DB.prepare('SELECT * FROM naza_bookings WHERE id = ?').bind(id).first()
  if (!r) return fail(404, 'ไม่พบการจอง')
  return json(bookingOut(r), 200, { 'Access-Control-Allow-Origin': '*' })
}
