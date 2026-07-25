// ฐานข้อมูลที่อยู่ไทย (จังหวัด/อำเภอ-เขต/ตำบล-แขวง/รหัสไปรษณีย์) จากแพ็กเกจสำเร็จรูป thai-address-database
// (ทีม Sellsuki ดูแล ใช้กันแพร่หลาย — ไม่พิมพ์เองเพราะข้อมูลระดับตำบลทั่วประเทศมี ~7,400 รายการ เสี่ยงผิด/ตกหล่นถ้าทำเอง)
import { searchAddressByProvince } from 'thai-address-database'

// ดึงข้อมูลทั้งหมดครั้งเดียว (searchAddressByProvince ปกติทำมาสำหรับค้นหา ไม่ใช่ดึงทั้งหมด — ใช้ regex '.'
// จับคู่ทุก province ที่ไม่ว่าง แล้วให้ maxResult สูงมากพอให้ได้ครบทุกแถว)
const ALL = searchAddressByProvince('.', 999999)

// กรุงเทพฯ ใช้คำว่า "เขต"/"แขวง" จังหวัดอื่นใช้ "อำเภอ"/"ตำบล" — เอาไว้ให้ฝั่ง UI เลือก label ให้ตรง
export const isBangkok = (province) => province === 'กรุงเทพมหานคร'

export const THAILAND_PROVINCES = [...new Set(ALL.map((r) => r.province))].sort((a, b) => a.localeCompare(b, 'th'))

export function getAmphoes(province) {
  if (!province) return []
  return [...new Set(ALL.filter((r) => r.province === province).map((r) => r.amphoe))].sort((a, b) => a.localeCompare(b, 'th'))
}

export function getDistricts(province, amphoe) {
  if (!province || !amphoe) return []
  return [...new Set(ALL.filter((r) => r.province === province && r.amphoe === amphoe).map((r) => r.district))].sort((a, b) => a.localeCompare(b, 'th'))
}

export function getZipcode(province, amphoe, district) {
  const row = ALL.find((r) => r.province === province && r.amphoe === amphoe && r.district === district)
  return row ? String(row.zipcode) : ''
}
