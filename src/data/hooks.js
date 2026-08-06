// คลัง HOOK — ประโยคเปิดที่ใช้ได้ผล เก็บไว้หยิบมาใช้ซ้ำแทนที่จะคิดใหม่ทุกครั้ง
//
// ไฟล์นี้ไม่แตะ firebase (เทสต์ได้โดยไม่ต้องมี DOM — เหมือน weekView.js / contentTemplate.js)
// ตัวอ่าน/เขียน Firestore อยู่ใน data/contentHooks.js

export const HOOK_CATEGORIES = [
  { key: 'question', label: 'คำถาม', hint: 'เปิดด้วยคำถามที่คนอยากรู้คำตอบ' },
  { key: 'number', label: 'ตัวเลข', hint: 'ตัวเลขที่ทำให้หยุดอ่าน' },
  { key: 'story', label: 'เรื่องเล่า', hint: 'เริ่มจากเหตุการณ์จริง' },
  { key: 'news', label: 'ประกาศ/ข่าว', hint: 'บอกสิ่งที่เพิ่งเกิดขึ้น' },
  { key: 'howto', label: 'วิธีทำ', hint: 'บอกว่าจะได้อะไรถ้าอ่านต่อ' },
]

export const HOOK_CATEGORY_LABEL = Object.fromEntries(HOOK_CATEGORIES.map((c) => [c.key, c.label]))

// หมวดที่ไม่รู้จัก/ยังไม่ได้เลือก ตกมาที่ 'question' ไม่ใช่ค่าว่าง — ค่าว่างจะหลุดจากทุกตัวกรอง
// แล้ว hook นั้นจะหายไปจากคลังทั้งที่ยังอยู่ใน Firestore
export const normHookCategory = (c) => (HOOK_CATEGORY_LABEL[c] ? c : 'question')

export const MAX_HOOK_LEN = 300

// ตัดช่องว่างซ้ำและจำกัดความยาว — hook คือประโยคเปิด ไม่ใช่แคปชันทั้งก้อน
// ถ้าปล่อยยาวไม่จำกัด คลังจะกลายเป็นที่เก็บโพสต์เก่าแทนที่จะเป็นประโยคเปิดที่หยิบใช้ได้เร็ว
export const cleanHookText = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, MAX_HOOK_LEN)

// ค้นหาแบบไม่สนตัวพิมพ์และไม่สนช่องว่างเกิน — ผู้ใช้พิมพ์คำค้นมาไม่ตรงเป๊ะเสมอ
export function matchesHook(hook, term) {
  const q = String(term || '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!q) return true
  return [hook?.text, HOOK_CATEGORY_LABEL[normHookCategory(hook?.category)], hook?.note]
    .some((f) => String(f || '').toLowerCase().includes(q))
}

// เรียงตามที่ใช้บ่อยก่อน แล้วค่อยตามตัวอักษร — คลังมีไว้หยิบใช้ ของที่ได้ผลจึงควรอยู่บนสุด
// (ไม่เรียงตามวันที่สร้าง เพราะ hook ที่เพิ่งใส่ยังไม่รู้ว่าใช้ได้ไหม)
export function sortHooks(hooks) {
  return [...(hooks || [])].sort((a, b) => {
    const d = (Number(b?.useCount) || 0) - (Number(a?.useCount) || 0)
    return d !== 0 ? d : String(a?.text || '').localeCompare(String(b?.text || ''), 'th')
  })
}
