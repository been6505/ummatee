import { useConfigDoc, saveConfigDoc } from './configDoc.js'

// เปิด/ปิดรายการเมนูของ Nav ฝั่ง public — เก็บ doc เดียวที่ config/navVisibility
// (อ่านได้ทุกคน, แก้ได้เฉพาะแอดมิน ตาม firestore.rules เดิม — เหมือน config/announcement)
// รายการเมนูทั้งหมดที่ปิดได้ (ไม่รวม "หน้าหลัก" — เป็นทางกลับบ้าน ปิดไม่ได้)
export const NAV_MENU_ITEMS = [
  { key: 'donation', label: 'ร่วมบริจาค', path: '/donation' },
  { key: 'missions', label: 'ภารกิจ', path: '/missions' },
  { key: 'updates', label: 'ความคืบหน้า', path: '/updates' },
  { key: 'qurban', label: 'ภารกิจกุรบาน', path: '/missions/qurban2026' },
  { key: 'shop', label: 'um-shop', path: '/um-shop' },
  { key: 'iftar', label: 'Iftar For Gaza', path: '/event/iftar-for-gaza' },
  { key: 'give', label: 'งาน "ให้"', path: '/event/give-for-um' },
  { key: 'volunteer', label: 'อาสาสมัคร', path: '/volunteer/register' },
]

// หา nav key จาก path ของลิงก์ (จับ path ที่ตรง/ครอบคลุมที่สุด เช่น /missions/qurban2026 → qurban ไม่ใช่ missions)
// ใช้ผูกการ์ดหน้าแรกกับเมนู — ปิดเมนูไหน การ์ดที่ลิงก์ไปหน้านั้นก็ถูกซ่อนตามด้วย
export const navKeyForPath = (link) => {
  if (!link) return null
  const clean = (link.split('?')[0].split('#')[0].replace(/\/+$/, '')) || '/'
  let best = null
  for (const it of NAV_MENU_ITEMS) {
    if (clean === it.path || clean.startsWith(it.path + '/')) {
      if (!best || it.path.length > best.path.length) best = it
    }
  }
  return best ? best.key : null
}

export function useNavVisibility() {
  // ยังไม่มีเอกสาร = ยังไม่เคยปิดเมนูไหนเลย ⇒ {} ว่าง (ผู้เรียกเช็ค visibility?.[key] !== false)
  const { data, loading } = useConfigDoc('navVisibility')
  return { visibility: data || {}, loading }
}

export const saveNavVisibility = (data) => saveConfigDoc('navVisibility', data)
