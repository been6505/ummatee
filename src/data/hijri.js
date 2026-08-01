// ปฏิทินฮิจเราะห์ — เดิมเขียนไว้ในตัว AdminCalendar.jsx ย้ายออกมาให้หน้าปฏิทินรายสัปดาห์ใช้ร่วมได้
// (ไม่แตะ firebase จึงเทสต์ได้ตรงๆ)
export const HIJRI_MONTHS = [
  'มุฮัรรอม', 'ศอฟัร', 'รอบีอุลเอาวัล', 'รอบีอุษษานี',
  'ญุมาดัลอูลา', 'ญุมาดัลอาคิเราะห์', 'รอญับ', 'ชะอฺบาน',
  'รอมฎอน', 'เชาวาล', 'ซุลกิอฺดะฮฺ', 'ซุลหิจญะฮฺ',
]

// ใช้ Intl ของเบราว์เซอร์ (ปฏิทิน umalqura) — คืน null ถ้าเบราว์เซอร์ไม่รองรับ
// ผู้เรียกต้องเช็ค null เสมอ ห้ามให้หน้าพังเพราะแสดงวันฮิจเราะห์ไม่ได้
export function getHijri(date) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric',
    }).formatToParts(date)
    const v = {}
    for (const p of parts) v[p.type] = p.value
    return { d: +v.day, m: +v.month - 1, y: +v.year }
  } catch { return null }
}

// "18 ศอฟัร 1448 ฮ.ศ." — คืน '' ถ้าแปลงไม่ได้
export function hijriLabel(date) {
  const h = getHijri(date)
  return h ? `${h.d} ${HIJRI_MONTHS[h.m]} ${h.y} ฮ.ศ.` : ''
}
