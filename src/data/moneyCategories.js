// หมวดหมู่รายรับ-รายจ่าย สำหรับแอปบันทึกการเงินส่วนตัว (/admin/money)

export const INCOME_CATEGORIES = [
  { key: 'salary', icon: '💼', name: 'เงินเดือน' },
  { key: 'bonus', icon: '🎁', name: 'โบนัส/OT' },
  { key: 'freelance', icon: '🧑‍💻', name: 'งานเสริม/ฟรีแลนซ์' },
  { key: 'business', icon: '🏪', name: 'ค้าขาย/ธุรกิจ' },
  { key: 'gift', icon: '🤝', name: 'ของขวัญ/ได้รับมา' },
  { key: 'other-in', icon: '➕', name: 'รายรับอื่น ๆ' },
]

// fixed: true = ถือเป็นค่าใช้จ่ายคงที่ ไม่นำไปคิดค่าเฉลี่ยการใช้จ่ายที่ยืดหยุ่นได้
export const EXPENSE_CATEGORIES = [
  { key: 'food', icon: '🍚', name: 'อาหาร/เครื่องดื่ม' },
  { key: 'transport', icon: '🚌', name: 'เดินทาง/น้ำมัน' },
  { key: 'rent', icon: '🏠', name: 'ค่าเช่า/ที่พัก', fixed: true },
  { key: 'utility', icon: '💡', name: 'น้ำ/ไฟ/เน็ต/โทรศัพท์', fixed: true },
  { key: 'loan', icon: '🏦', name: 'ผ่อนชำระ/หนี้', fixed: true },
  { key: 'insurance', icon: '🛡️', name: 'ประกัน/ตะกาฟุล', fixed: true },
  { key: 'shopping', icon: '🛍️', name: 'ช้อปปิ้ง/ของใช้' },
  { key: 'health', icon: '💊', name: 'สุขภาพ/รักษาพยาบาล' },
  { key: 'education', icon: '📚', name: 'การศึกษา/หนังสือ' },
  { key: 'family', icon: '👨‍👩‍👧', name: 'ครอบครัว/ส่งพ่อแม่' },
  { key: 'sadaqah', icon: '🤲', name: 'บริจาค/ซะกาต' },
  { key: 'other-out', icon: '➖', name: 'รายจ่ายอื่น ๆ' },
]

const INCOME_MAP = Object.fromEntries(INCOME_CATEGORIES.map((c) => [c.key, c]))
const EXPENSE_MAP = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.key, c]))

export const categoriesFor = (type) => (type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)

export const categoryInfo = (type, key) =>
  (type === 'income' ? INCOME_MAP[key] : EXPENSE_MAP[key]) || { key, icon: '•', name: key || 'ไม่ระบุ' }

export const categoryLabel = (type, key) => {
  const c = categoryInfo(type, key)
  return `${c.icon} ${c.name}`
}

// ค่าใช้จ่ายคงที่ (ค่าเช่า/ผ่อน/บิล) — แยกออกจากค่าใช้จ่ายที่ปรับลดได้ ตอนคำนวณงบรายสัปดาห์
export const isFixedCategory = (key) => Boolean(EXPENSE_MAP[key]?.fixed)
