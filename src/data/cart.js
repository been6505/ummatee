import { useEffect, useState } from 'react'
import { effectivePrice } from './pricing.js'

// ตะกร้าสินค้า Um Shop — เก็บใน localStorage ฝั่งเครื่องผู้ใช้ (ยังไม่มีระบบชำระเงิน/เช็คเอาท์)
// โครงสร้างแต่ละรายการ: { id, productId, name, price, image, qty }

const CART_KEY = 'umShopCart'
const CART_EVENT = 'umShopCart:updated'

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]')
  } catch {
    return []
  }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: items }))
}

// เพิ่มสินค้าลงตะกร้า — สินค้าเดียวกันแต่คนละสี/ขนาด นับเป็นคนละรายการ (แยกด้วย variant)
// ถ้ามีรายการเดิม (สินค้า+สี+ขนาดตรงกัน) ให้บวกจำนวนเพิ่ม (ไม่เกิน stock ถ้าระบุไว้)
export function addToCart(product, qty = 1, variant = {}) {
  const items = getCart()
  const color = variant.color || ''
  const size = variant.size || ''
  const lineId = [product.id, color, size].join('|')
  const existing = items.find((i) => i.id === lineId)
  // สินค้าที่มีสต็อกแยกต่อไซซ์ ใช้จำนวนของไซซ์ที่เลือกเป็นเพดาน — ไม่ใช่สต็อกรวมทุกไซซ์
  // (ไม่งั้นเลือกไซซ์ S ที่เหลือ 2 แต่กด + ได้ถึงสต็อกรวม แล้วไปพังตอนเช็คเอาท์แทน)
  const lineStock = (product.sizeStock && size)
    ? (Number(product.sizeStock[size]) || 0)
    : (Number.isFinite(product.stock) ? product.stock : null)
  const maxQty = lineStock ?? Infinity
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, maxQty)
    existing.stock = lineStock // อัปเดตเพดานล่าสุด เผื่อสต็อกเปลี่ยนตั้งแต่หยิบครั้งแรก
  } else {
    items.push({
      id: lineId,
      productDocId: product.id, // doc id จริงใน Firestore — ใช้ตัดสต็อกตอนสร้างออเดอร์
      productId: product.productId || '',
      name: product.name || '',
      price: effectivePrice(product), // ใช้ราคาส่วนลดถ้ามี ไม่งั้นราคาเต็ม — ตะกร้า/เช็คเอาท์ต้องคิดราคาจริงที่ลูกค้าต้องจ่าย
      image: product.images?.[0] || '',
      // สี/ขนาดที่ลูกค้าเลือก — แสดงในตะกร้า/สรุป/ออเดอร์ (ฟิลด์ชื่อเดิม colors/sizes เพื่อให้หน้าแสดงผลเดิมใช้ได้)
      colors: color,
      sizes: size,
      stock: lineStock, // เพดานจำนวนของรายการนี้ (ต่อไซซ์ถ้ามี) — หน้าตะกร้าใช้ cap ตอนกด +
      qty: Math.min(qty, maxQty),
    })
  }
  saveCart(items)
  return items
}

export function cartCount() {
  return getCart().reduce((sum, i) => sum + (i.qty || 0), 0)
}

export function cartTotal() {
  return getCart().reduce((sum, i) => sum + (i.price || 0) * (i.qty || 0), 0)
}

// ตั้งจำนวนสินค้าชิ้นหนึ่งตรงๆ (ใช้ในหน้าตะกร้า) — qty <= 0 จะลบออกจากตะกร้า, ไม่เกิน stock ที่บันทึกไว้
export function setItemQty(id, qty) {
  let items = getCart()
  if (qty <= 0) {
    items = items.filter((i) => i.id !== id)
  } else {
    const item = items.find((i) => i.id === id)
    if (item) item.qty = Number.isFinite(item.stock) && item.stock > 0 ? Math.min(qty, item.stock) : qty
  }
  saveCart(items)
  return items
}

export function removeFromCart(id) {
  const items = getCart().filter((i) => i.id !== id)
  saveCart(items)
  return items
}

export function clearCart() {
  saveCart([])
}

// อัปเดตราคาในตะกร้าให้ตรงกับราคาจริงล่าสุด — ใช้ตอน createOrder เจอว่าราคาที่ตะกร้าจับไว้ไม่ตรงกับ Firestore
// (ตะกร้าอยู่ localStorage จับราคาไว้ตอนกดใส่ตะกร้า ถ้าแอดมินแก้ราคา/โปรฯ ทีหลังจะค้างราคาเก่า)
// รับ [{ id, price }] แล้วเขียนทับเฉพาะรายการที่ราคาเปลี่ยน คืน true ถ้ามีการเปลี่ยนจริง
export function updateCartPrices(priced) {
  const items = getCart()
  let changed = false
  for (const it of items) {
    const found = priced.find((p) => p.id === it.id)
    if (found && Number(found.price) !== Number(it.price)) {
      it.price = found.price
      changed = true
    }
  }
  if (changed) saveCart(items)
  return changed
}

export function useCart() {
  const [items, setItems] = useState(getCart())
  useEffect(() => {
    const update = () => setItems(getCart())
    window.addEventListener(CART_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(CART_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return items
}

export function useCartCount() {
  const [count, setCount] = useState(cartCount())
  useEffect(() => {
    const update = () => setCount(cartCount())
    window.addEventListener(CART_EVENT, update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener(CART_EVENT, update)
      window.removeEventListener('storage', update)
    }
  }, [])
  return count
}
