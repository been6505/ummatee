// คำนวณวันที่ของโพสต์ที่ "ทำซ้ำทุกสัปดาห์"
//
// วิธีที่เลือก: สร้างโพสต์จริงหนึ่งใบต่อหนึ่งวัน (materialize) ไม่ได้เก็บเป็นกฎแล้วค่อยกางตอนแสดง
// เพราะทั้งระบบผูกกับ date ของเอกสารอยู่แล้ว (ปฏิทินจัดกลุ่มด้วย date, รายการในแดชบอร์ด,
// หน้ารายละเอียด ?post=<id>) และสถานะงาน (ร่าง/กำลังดำเนินงาน/ส่งงาน/โพสต์แล้ว) เป็นของ
// "แต่ละครั้ง" ไม่ใช่ของกฎ — ถ้าเก็บเป็นกฎ จะเปลี่ยนสถานะรายครั้งไม่ได้เลย
//
// ราคาที่จ่าย: แก้/ลบต้องทำรายใบ (ไม่มีปุ่ม "แก้ทั้งชุด") ซึ่งรับได้กว่าการที่ติดตามงานรายวันไม่ได้

// 0 = อาทิตย์ ... 6 = เสาร์ — ตรงกับค่าที่ Date.getDay() คืนมา
export const WEEKDAYS = [
  { id: 1, label: 'จ' },
  { id: 2, label: 'อ' },
  { id: 3, label: 'พ' },
  { id: 4, label: 'พฤ' },
  { id: 5, label: 'ศ' },
  { id: 6, label: 'ส' },
  { id: 0, label: 'อา' },
]

// เพดานจำนวนโพสต์ที่สร้างได้ในครั้งเดียว — กันกดพลาดแล้วได้เอกสารเป็นร้อย
export const MAX_REPEAT_WEEKS = 12
export const MAX_REPEAT_POSTS = 84 // 7 วัน × 12 สัปดาห์

const pad = (n) => String(n).padStart(2, '0')
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * รายการวันที่ทั้งหมดของโพสต์ที่ทำซ้ำ
 *
 * @param startKey วันเริ่ม 'YYYY-MM-DD' (จากช่อง "วันเวลาโพสต์")
 * @param weekdays วันในสัปดาห์ที่เลือก (0-6) — ว่าง = ไม่ทำซ้ำ คืนแค่ startKey
 * @param weeks    จำนวนสัปดาห์ที่ต้องการ (นับรวมสัปดาห์แรก)
 * @returns 'YYYY-MM-DD'[] เรียงจากน้อยไปมาก ไม่มีวันซ้ำ
 *
 * สัปดาห์แรกนับจาก startKey เป็นต้นไปเท่านั้น — วันที่เลือกไว้แต่ผ่านมาแล้วในสัปดาห์นั้นจะถูกข้าม
 * (เลือกวันจันทร์ทั้งที่ startKey เป็นวันพุธ ⇒ ครั้งแรกคือจันทร์สัปดาห์ถัดไป ไม่ใช่จันทร์ที่ผ่านมา)
 */
export function repeatDates(startKey, weekdays = [], weeks = 1) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(startKey || ''))
  if (!m) return []
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(start.getTime())) return []
  if (!Array.isArray(weekdays) || weekdays.length === 0) return [toKey(start)]

  const days = [...new Set(weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
  if (days.length === 0) return [toKey(start)]

  const wanted = Math.min(Math.max(1, Math.floor(weeks) || 1), MAX_REPEAT_WEEKS)
  const out = new Set()
  for (const day of days) {
    // ระยะห่างจาก start ถึงวันนั้นในสัปดาห์เดียวกัน (0-6) — ครั้งแรกจึงไม่ย้อนหลังไปก่อน start
    const offset = (day - start.getDay() + 7) % 7
    for (let w = 0; w < wanted; w++) {
      const d = new Date(start)
      d.setDate(d.getDate() + offset + w * 7)
      out.add(toKey(d))
      if (out.size >= MAX_REPEAT_POSTS) break
    }
  }
  return [...out].sort()
}
