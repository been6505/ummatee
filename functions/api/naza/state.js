// GET /api/naza/state — ค่าตั้งงาน + ที่นั่งที่ถูกถือไว้ทุกรอบ (สาธารณะ ไม่มีข้อมูลส่วนตัว)
// หน้าจองเรียกซ้ำทุก ~5 วินาทีแทนการ subscribe แบบ Firestore
import { json, readConfig } from '../../_lib/naza.js'

export async function onRequestGet({ env }) {
  const [config, seats] = await Promise.all([
    readConfig(env.DB),
    env.DB.prepare('SELECT round, seat, status FROM naza_seats').all(),
  ])
  return json({
    config: { price: config.price, maxSeats: config.maxSeats, promptpay: config.promptpay, accountName: config.accountName, closed: config.closed },
    seats: (seats.results || []).map((r) => [r.round, r.seat, r.status]),
    at: Date.now(),
  }, 200, { 'Access-Control-Allow-Origin': '*' })
}
