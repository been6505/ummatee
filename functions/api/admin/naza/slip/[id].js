// GET /api/admin/naza/slip/:id — รูปสลิปจาก R2 (bucket ส่วนตัว เปิดได้เฉพาะแอดมินที่ผ่าน middleware)
import { fail } from '../../../../_lib/naza.js'

export async function onRequestGet({ params, env }) {
  const r = await env.DB.prepare('SELECT slip_key FROM naza_bookings WHERE id = ?').bind(String(params.id || '')).first()
  if (!r?.slip_key) return fail(404, 'ไม่พบสลิป')
  const obj = await env.SLIPS.get(r.slip_key)
  if (!obj) return fail(404, 'ไม่พบไฟล์สลิป')
  return new Response(obj.body, {
    headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
  })
}
