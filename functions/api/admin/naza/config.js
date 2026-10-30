// PUT /api/admin/naza/config — ราคา / จำนวนที่นั่งต่อครั้ง / เลขพร้อมเพย์ / ชื่อบัญชี / ปิดรับจอง
import { json, fail, cleanConfig } from '../../../_lib/naza.js'

export async function onRequestPut({ request, env, data }) {
  let cfg
  try { cfg = cleanConfig(await request.json()) } catch (e) { return fail(400, String(e.message || e)) }
  await env.DB.prepare(`INSERT INTO naza_config (id, data, updated_at, updated_by) VALUES (1, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(JSON.stringify(cfg), Date.now(), data.email).run()
  return json(cfg)
}
