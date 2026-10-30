// แปลงข้อมูลระบบจอง NAZA จาก Firestore (ผลของ listCollection) เป็นคำสั่ง SQL สำหรับ D1 — แยกไว้ให้เทสต์ได้
export const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)
export const ms = (v) => (v && typeof v === 'object' && v.__ts ? Date.parse(v.__ts) : typeof v === 'number' ? v : null)


export function toSql(bookings, configs) {
  const out = ['-- นำเข้าจาก Firestore ' + new Date().toISOString(), 'PRAGMA defer_foreign_keys = ON;']
  for (const { id, fields: f } of bookings) {
    const seats = Array.isArray(f.seats) ? f.seats : []
    out.push(`INSERT OR IGNORE INTO naza_bookings (id, code, round, seats, name, phone, email, amount, slip_url, status, created_at, reviewed_at, reviewed_by, checked_in_at, checked_in_by, admin_note) VALUES (${[
      id, f.code, f.round, JSON.stringify(seats), f.name, f.phone, f.email || '', Number(f.amount) || 0, f.slipUrl || null,
      ['pending', 'confirmed', 'rejected'].includes(f.status) ? f.status : 'pending',
      ms(f.createdAt) || Date.now(), ms(f.reviewedAt), f.reviewedBy || null, ms(f.checkedInAt), f.checkedInBy || null, f.adminNote || null,
    ].map(q).join(', ')});`)
    if (f.status === 'pending' || f.status === 'confirmed') {
      for (const s of seats) {
        out.push(`INSERT OR IGNORE INTO naza_seats (round, seat, booking_id, status, at) VALUES (${[f.round, s, id, f.status, ms(f.createdAt) || Date.now()].map(q).join(', ')});`)
      }
    }
  }
  const cfg = configs.find((c) => c.id === 'nazaEvent')
  if (cfg) {
    const { price, maxSeats, promptpay, accountName, closed } = cfg.fields
    out.push(`INSERT OR IGNORE INTO naza_config (id, data, updated_at, updated_by) VALUES (1, ${q(JSON.stringify({ price, maxSeats, promptpay, accountName, closed }))}, ${Date.now()}, 'import');`)
  }
  return out.join('\n')
}
