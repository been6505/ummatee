// ตารางไลฟ์สด — จัดเรียง/แบ่งกลุ่มโพสต์ชนิด 'live' จาก contentPosts
//
// ไฟล์นี้ต้องไม่ import firebase (ต้องเทสต์ได้โดยไม่ต้องมี DOM — เหตุผลเดียวกับ orderStatus.js
// และ campaignProgress.js) หน้าที่มันมีอย่างเดียวคือแปลงลิสต์โพสต์ให้เป็นตารางที่อ่านรู้เรื่อง

// เวลาที่จะใช้จริง: วันเวลาโพสต์ (date + time) เป็นหลัก
//
// ช่อง "วันเวลาไลฟ์" (liveScheduledAt) ถูกตัดออกจากฟอร์มแล้ว เพราะซ้ำกับวันเวลาโพสต์
// และการมีเวลาสองชุดต่อโพสต์เดียวทำให้ขัดกันเองได้โดยไม่มีใครรู้ว่าอันไหนจริง
// แต่ยังอ่านค่าเดิมก่อน — โพสต์ที่เคยกรอกไว้ตอนที่ยังมีช่องนี้ต้องไม่เลื่อนเวลาไปเองหลังเปลี่ยน
export function liveTimeOf(post) {
  const explicit = String(post?.liveScheduledAt || '').trim()
  if (explicit) return explicit
  const date = String(post?.date || '').trim()
  if (!date) return ''
  const time = String(post?.time || '').trim() || '00:00'
  return `${date}T${time}`
}

export const isLivePost = (p) => p?.contentType === 'live'

// เทียบกับ "ตอนนี้" ที่ส่งเข้ามา ไม่เรียก Date.now() เอง — ฟังก์ชันที่อ่านนาฬิกาเองเทสต์ยาก
// และทำให้ผลลัพธ์เปลี่ยนไปเรื่อยๆ ระหว่างเรนเดอร์
export function splitLives(posts, nowIso) {
  const lives = (posts || [])
    .filter(isLivePost)
    .map((p) => ({ ...p, liveAt: liveTimeOf(p) }))

  // ไลฟ์ที่ยังไม่ได้ตั้งเวลาเลย ต้องไม่ถูกกลืนหายไปกับกลุ่ม "ผ่านไปแล้ว"
  // (สตริงว่างเทียบยังไงก็น้อยกว่าเวลาปัจจุบัน) — แยกเป็นกลุ่มของตัวเองให้เห็นว่าค้างอยู่
  const unscheduled = lives.filter((p) => !p.liveAt)
  const scheduled = lives.filter((p) => p.liveAt)

  const upcoming = scheduled.filter((p) => p.liveAt >= nowIso).sort((a, b) => a.liveAt.localeCompare(b.liveAt))
  const past = scheduled.filter((p) => p.liveAt < nowIso).sort((a, b) => b.liveAt.localeCompare(a.liveAt))

  return { upcoming, past, unscheduled, total: lives.length }
}

// "YYYY-MM-DDTHH:mm" ในเขตเวลาเครื่อง — ใช้เป็นเส้นแบ่งอดีต/อนาคต เทียบกับค่าที่ datetime-local เก็บไว้
// ห้ามใช้ toISOString() เพราะมันแปลงเป็น UTC ทำให้ไลฟ์ตอนเช้าในไทยกลายเป็นเมื่อวานตอนเทียบ
export function localNowIso(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// ป้ายเวลาแบบอ่านง่าย — คืน '' ถ้ารูปแบบไม่ถูก ไม่ใช่ "Invalid Date"
export function liveTimeLabel(iso) {
  const s = String(iso || '')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!m) return ''
  const [, y, mo, d, h, mi] = m
  return `${d}/${mo}/${y} ${h}:${mi}`
}
