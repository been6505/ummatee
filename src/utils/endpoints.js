// รวม URL ของ Google Apps Script ทุกตัวไว้ที่เดียว — เวลา re-deploy script แล้ว URL เปลี่ยน แก้ที่นี่จุดเดียว
//
// หมายเหตุความปลอดภัย: GIVE_SHEET_TOKEN เป็น write-token ฝั่ง client (จำเป็นสำหรับฟอร์มสาธารณะ
// ให้เขียนลงชีตได้) — ไม่ใช่ secret จริง ผู้ใช้เปิด bundle ดูได้เสมอ ระวังอย่าใช้ token นี้
// เปิดสิทธิ์ "อ่าน" ข้อมูลใน Apps Script เด็ดขาด (ดูข้อมูลให้ผ่านหน้าแอดมิน + Firestore rules เท่านั้น)

// งาน "ให้" ครั้งที่ 6 — Give2 / Give2Cook / ผู้รับ / B2UM
export const GIVE_SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzduk8FfVTjnNABJDBCXPOw82rzxCSNth8Mov-CL7sZgXqKcv6QTklFQBkKU1-3T-mm/exec'
export const GIVE_SHEET_TOKEN = 'umt-7Kp2xQ9mZr4Wv8Td'

// Iftar For Gaza — ลงทะเบียน + Broadcast อีเมล
export const IFTAR_SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzIqLLYl8qjwXXZRiZIefPPKyCK_SKZZi-0kCJDyz9vxbvHL9vQC5cHJ5ybZ3-NiXcCyA/exec'

// ส่งข้อมูลจากหน้าแอดมินเข้า Google Sheets (docs/sheets-export-apps-script/Code.gs)
// ปล่อยว่าง = ปิดฟีเจอร์ ปุ่ม "ส่งเข้า Google Sheets" จะซ่อน (ปุ่มดาวน์โหลด CSV ยังใช้ได้ตามปกติ)
// SHEETS_EXPORT_TOKEN ต้องตรงกับ EXPORT_TOKEN ใน Code.gs — เป็น write-token กันยิงมั่วเท่านั้น
// ไม่ใช่ความลับจริง (อยู่ใน bundle) จึงห้ามเปิดสิทธิ์ "อ่าน" ใน Apps Script ตัวนั้นเด็ดขาด
export const SHEETS_EXPORT_ENDPOINT = ''
export const SHEETS_EXPORT_TOKEN = ''

// อาสาสมัคร
export const VOLUNTEER_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzJyyA9lqjuiJOVry-Mcl-8tXyAtbaIKggO704EqEL9y_A4rIodYL_LqysvbXrltBZKTA/exec'

// fetch แบบมี timeout — Google Apps Script บางทีค้าง (ไม่ตอบ ไม่ error) ถ้าไม่มี timeout ปุ่ม "กำลังส่ง..." จะค้างตลอด
// ค่า default 15 วินาที เผื่อ Apps Script cold start ที่ช้าบ้างในบางครั้ง แต่ไม่ปล่อยให้ค้างไม่มีที่สิ้นสุด
export function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
}
