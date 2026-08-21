// สร้าง "ดัชนีคำค้น" (searchTokens) เก็บไว้ในเอกสาร เพื่อให้ค้นแบบพิมพ์คำไหนก็เจอ
//
// ทำไมต้องทำแบบนี้: Firestore ไม่มี full-text search ในตัว ค้นได้แค่ prefix
// (where('>=',t) + where('<=',t+'')) ⇒ พิมพ์ "ขนนก" ไม่เจอ "เสื้อลายขนนก"
// วิธีมาตรฐานที่ไม่ต้องพึ่งบริการภายนอก (Algolia/Typesense) คือเก็บ "ทุกท่อนย่อย" ของข้อความ
// ไว้เป็น array แล้วค้นด้วย array-contains ซึ่งเป็น index จริงของ Firestore — เร็วและ scale ได้
// ต่างจากการดึงทั้ง collection มากรองฝั่ง client ที่พังเมื่อข้อมูลเยอะ
//
// ⚠️ ภาษาไทยไม่มีช่องว่างระหว่างคำ จะตัดเป็น "คำ" แบบภาษาอังกฤษไม่ได้ ("เสื้อลายขนนก" เป็นก้อนเดียว)
// จึงต้องทำ n-gram ทุกท่อนย่อยแทน และต้องตัดตาม "grapheme" ไม่ใช่ตาม code unit
// ไม่งั้นสระ/วรรณยุกต์จะหลุดจากพยัญชนะที่มันเกาะอยู่ กลายเป็นท่อนที่พิมพ์ตามไม่ได้

// ความยาวท่อนที่เก็บ — สั้นกว่า 2 ไม่มีประโยชน์ (เจอเกือบทุกอย่าง) ยาวเกิน 12 ทำให้เอกสารบวมเร็ว
export const MIN_GRAM = 2
export const MAX_GRAM = 12
// เพดานจำนวน token ต่อเอกสาร กันเอกสารบวมจนชนลิมิต 1MB ของ Firestore
const MAX_TOKENS = 500

// ตัดข้อความเป็น grapheme (ตัวอักษรที่คนมองว่าเป็นตัวเดียว รวมสระ/วรรณยุกต์ที่เกาะอยู่)
// Intl.Segmenter รองรับในเบราว์เซอร์ยุคปัจจุบันทั้งหมด — ถ้าไม่มีก็ถอยไปใช้ [...str]
// ซึ่งตัดตาม code point (ยังดีกว่า str[i] ที่พังกับ emoji/surrogate pair)
function graphemes(str) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(str)].map((s) => s.segment)
  }
  return [...str]
}

// ปรับข้อความให้เทียบกันได้: ตัวพิมพ์เล็ก ตัดช่องว่างหัวท้าย ยุบช่องว่างซ้ำ
export function normalizeTerm(text) {
  return String(text ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/** สร้าง token ทั้งหมดจากข้อความหลายชิ้น (เช่น ชื่อ + รหัสสินค้า + หมวดหมู่) */
export function buildSearchTokens(...texts) {
  const out = new Set()
  for (const text of texts) {
    const norm = normalizeTerm(text)
    if (!norm) continue
    const g = graphemes(norm)
    for (let i = 0; i < g.length; i++) {
      // ต่อทีละ grapheme ไปเรื่อยๆ แทนการ slice ใหม่ทุกรอบ (ประหยัดกว่าเมื่อข้อความยาว)
      let piece = ''
      for (let n = 0; n < MAX_GRAM && i + n < g.length; n++) {
        piece += g[i + n]
        if (n + 1 >= MIN_GRAM) out.add(piece)
        if (out.size >= MAX_TOKENS) return [...out]
      }
    }
  }
  return [...out]
}

/**
 * แปลงคำที่ผู้ใช้พิมพ์ให้เป็นค่าที่ใช้ยิง array-contains ได้
 * ถ้าพิมพ์ยาวเกิน MAX_GRAM จะตัดให้เหลือเท่าที่ index ไว้ แล้วต้องกรองซ้ำฝั่ง client
 * ด้วย matchesTerm() เพื่อไม่ให้ผลลัพธ์หลุดเกินสิ่งที่ผู้ใช้พิมพ์จริง
 */
export function queryToken(term) {
  const norm = normalizeTerm(term)
  if (norm.length < MIN_GRAM) return null // สั้นเกินกว่าจะค้นอย่างมีความหมาย
  const g = graphemes(norm)
  return g.length <= MAX_GRAM ? norm : g.slice(0, MAX_GRAM).join('')
}

/** ผู้ใช้พิมพ์ยาวกว่าที่ index ไว้ ⇒ ต้องเช็คซ้ำว่าข้อความจริงมีคำนั้นอยู่ไหม */
export function matchesTerm(text, term) {
  return normalizeTerm(text).includes(normalizeTerm(term))
}

// ── คอลเลกชันที่ทำดัชนีค้นหา + ฟิลด์ที่เอามาสร้าง token ──
// ใช้ร่วมกัน 3 ที่: ตอนบันทึก (ใส่ token), ตอนค้นหา (ยิง array-contains), ตอน backfill (เติมของเก่า)
// รวมไว้ที่เดียวเพื่อไม่ให้หลุดกัน — เพิ่มคอลเลกชันใหม่ที่นี่แล้วทั้ง 3 ส่วนได้ตามอัตโนมัติ
//
// ไม่รวม meetings เพราะ validMeeting() ใน firestore.rules ใช้ keys().hasOnly() ระบุฟิลด์เป๊ะ
// การเพิ่มฟิลด์ต้องแก้กฎด้วย และห้องประชุมมีไม่กี่ห้อง/ชื่อสั้น ค้นแบบ prefix เดิมก็พอ
export const SEARCH_COLLECTIONS = [
  { col: 'products', fields: ['name', 'productId', 'category'], label: 'สินค้า', icon: '🛍', href: '/admin/shop', titleField: 'name' },
  { col: 'partnerOrganizations', fields: ['name', 'contactName'], label: 'องค์กรเครือข่าย', icon: '🤝', href: '/admin/partners', titleField: 'name' },
  { col: 'speakers', fields: ['name', 'type'], label: 'วิทยากร', icon: '🎤', href: '/admin/speakers', titleField: 'name' },
  { col: 'aidLocations', fields: ['villageName', 'city', 'province', 'aidType'], label: 'จุดลงพื้นที่', icon: '📍', href: '/admin/aid-map', titleField: 'villageName' },
  { col: 'campaigns', fields: ['name'], label: 'แคมเปญบริจาค', icon: '🎯', href: '/admin/campaigns', titleField: 'name' },
  { col: 'events', fields: ['name', 'location'], label: 'งาน/อีเวนต์', icon: '🚩', href: '/admin/events', titleField: 'name' },
  { col: 'contentPosts', fields: ['title', 'text'], label: 'แผนคอนเทนต์', icon: '🗓', href: '/admin/calendar', titleField: 'title' },
  { col: 'boardCards', fields: ['title'], label: 'การ์ดบอร์ด', icon: '🗂', href: '/admin/board', titleField: 'title' },
]

export const SEARCH_FIELD = 'searchTokens'

/** ใส่ searchTokens ลงในข้อมูลก่อนบันทึก — เรียกทุกครั้งที่ create/update เอกสารที่ทำดัชนี */
export function withSearchTokens(data, fields) {
  return { ...data, [SEARCH_FIELD]: buildSearchTokens(...fields.map((f) => data[f])) }
}
