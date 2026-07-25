// คำนวณไล่สีพื้นหลัง admin ตามตำแหน่งดวงอาทิตย์ (เวลาไทย/กรุงเทพฯ)
// ใช้ UTC+7 แบบ hardcode แทน timezone library เพราะผู้ใช้งานระบบนี้อยู่ในไทยทั้งหมด
// และไม่อยากพึ่งพา library เพิ่มสำหรับ feature เล็กๆ นี้

// จุดสี 4 ช่วงเวลา: เที่ยงคืน(มืด/เขียวเข้ม) -> รุ่งเช้า(อุ่น) -> เที่ยงวัน(สว่างครีม) -> พลบค่ำ(อุ่นอมส้ม) -> เที่ยงคืน
// สีอ้างอิงจาก --green-deep / --green-mid ใน base.css ให้กลืนกับโทนเว็บเดิม ไม่ใช้สีใหม่ที่ขัดกัน
const STOPS = [
  { hour: 0, light: '#EAF6EE', dark: '#0F2A1A' },   // เที่ยงคืน — เขียวเข้มเกือบดำ
  { hour: 6, light: '#FDF6E9', dark: '#1B5E36' },   // รุ่งอรุณ — ครีมอุ่นแตะเขียวเข้ม (--green-deep)
  { hour: 12, light: '#FFFdf5', dark: '#2E7D52' },  // เที่ยงวัน — ครีมสว่างสุด กับ --green-mid
  { hour: 18, light: '#FDF1DD', dark: '#1B5E36' },  // พลบค่ำ — ส้มอุ่นอ่อนๆ กับ --green-deep
  { hour: 24, light: '#EAF6EE', dark: '#0F2A1A' },  // กลับสู่เที่ยงคืน (วนลูป)
]

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function lerpColor(hexA, hexB, t) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const r = Math.round(a.r + (b.r - a.r) * t)
  const g = Math.round(a.g + (b.g - a.g) * t)
  const bl = Math.round(a.b + (b.b - a.b) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

// หา 2 stop ที่ hour ปัจจุบันอยู่ระหว่าง แล้ว interpolate สีต่อเนื่อง ไม่ใช่กระโดดเป็นช่วงๆ
function interpolateStops(hour) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i]
    const b = STOPS[i + 1]
    if (hour >= a.hour && hour <= b.hour) {
      const t = (hour - a.hour) / (b.hour - a.hour)
      return { light: lerpColor(a.light, b.light, t), dark: lerpColor(a.dark, b.dark, t) }
    }
  }
  return { light: STOPS[0].light, dark: STOPS[0].dark }
}

/**
 * getSunGradient(date) -> { angleDeg, colorLight, colorDark }
 * ใช้เวลาไทย (UTC+7) เสมอ ไม่ขึ้นกับ timezone ของเบราว์เซอร์ผู้ใช้
 */
export function getSunGradient(date = new Date()) {
  // แปลงเป็นเวลาไทย (UTC+7) โดยไม่ต้องพึ่ง Intl/timezone library
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000
  const bangkokMs = utcMs + 7 * 60 * 60 * 1000
  const bkk = new Date(bangkokMs)
  const hour = bkk.getHours() + bkk.getMinutes() / 60

  // ความสว่าง 0-1 พีคที่เที่ยงวัน (hour=12) ต่ำสุดที่เที่ยงคืน — เส้นโค้ง cosine ต่อเนื่องตลอด 24 ชม.
  const brightness = (Math.cos(((hour - 12) / 24) * 2 * Math.PI) + 1) / 2

  // มุมไล่สีหมุนไปตามเวลาของวัน (0-360deg) ให้ทิศทางแสงดูเคลื่อนเหมือนดวงอาทิตย์เคลื่อนผ่านท้องฟ้า
  // 180deg ที่เที่ยงคืนเป็นจุดเริ่ม แล้วหมุนครบรอบ 360deg ตลอด 24 ชม.
  const angleDeg = Math.round(180 + (hour / 24) * 180) % 360

  const { light, dark } = interpolateStops(hour)

  return { angleDeg, colorLight: light, colorDark: dark, brightness }
}
