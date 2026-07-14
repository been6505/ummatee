// ฟังก์ชันราคา/ส่วนลดล้วนๆ (pure) — แยกจาก shop.js เพื่อไม่ให้โมดูลที่โหลดตอนเปิดเว็บครั้งแรก
// (เช่น cart.js ที่ Nav ใช้) ลาก firebase/firestore (~700KB) เข้า bundle หลักไปด้วย

// คำนวณราคาหลังหักส่วนลดจากโปรโมชั่น — ปัดเศษไม่ให้ติดลบ
export const applyPromotion = (price, promo) => {
  const p = Number(price) || 0
  const v = Number(promo.value) || 0
  const result = promo.type === 'percent' ? p * (1 - v / 100) : p - v
  return Math.max(0, Math.round(result * 100) / 100)
}

// สินค้ามีราคาส่วนลดจริงไหม (ต้องน้อยกว่าราคาเต็ม ไม่งั้นไม่ถือเป็นส่วนลด)
export const hasDiscount = (p) => p.discountPrice != null && p.discountPrice < p.price
// ราคาที่ลูกค้าต้องจ่ายจริง — ใช้ราคาส่วนลดถ้ามี ไม่งั้นใช้ราคาเต็ม (ใช้เรียงลำดับ/คำนวณตะกร้า)
export const effectivePrice = (p) => (hasDiscount(p) ? p.discountPrice : (p.price || 0))
// เปอร์เซ็นต์ส่วนลด ปัดเป็นจำนวนเต็ม — ใช้แสดงป้าย "ลด X%"
export const discountPercent = (p) => Math.round((1 - p.discountPrice / p.price) * 100)

// แปลงข้อความ comma-separated เป็น array (ใช้กับ colors/sizes)
export const csvToList = (str) => String(str || '').split(',').map((s) => s.trim()).filter(Boolean)

// ลำดับไซซ์มาตรฐานต่อหมวดหมู่ (ใช้ทั้งฟอร์มแอดมินและหน้า public) — หมวดอื่นไม่กำหนดลำดับตายตัว
export const SHOP_SIZES_BY_CATEGORY = { 'เสื้อ': ['S', 'M', 'L', 'XL', '2XL', '3XL'] }

// ตัดค่าซ้ำ + เรียงตามลำดับมาตรฐานถ้าหมวดหมู่นั้นกำหนดไว้ (เช่น เสื้อ → S,M,L,XL เสมอ ไม่ว่าจะบันทึกมาลำดับไหน)
export function dedupeSortSizes(sizes, category) {
  const unique = [...new Set((sizes || []).map((s) => String(s).trim()).filter(Boolean))]
  const order = SHOP_SIZES_BY_CATEGORY[category]
  if (!order) return unique
  return unique.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b)
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

// รวมสินค้าที่ชื่อเดียวกัน (แต่คนละสี/ขนาด — คนละ Firestore doc) ให้เป็นกลุ่มเดียว
// ใช้ในหน้าร้าน (การ์ดเดียว/ชื่อ) และหน้ารายละเอียด (เลือกสี → คนละ doc, เลือกขนาด → sizes ของ doc นั้น)
export function groupProductsByName(products) {
  const map = new Map()
  for (const p of products) {
    const key = (p.name || '').trim() || p.id
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(p)
  }
  return [...map.values()].map((group) => {
    // เรียงตามวันที่สร้างเสมอ กัน primary กระโดดไปมาตอน re-render
    const variants = [...group].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    const primary = variants[0]
    const prices = variants.map(effectivePrice)
    return {
      key: primary.name || primary.id,
      name: primary.name,
      primary,
      variants,
      totalStock: variants.reduce((s, v) => s + (Number.isFinite(v.stock) ? v.stock : 0), 0),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      anyDiscount: variants.some(hasDiscount),
    }
  })
}
