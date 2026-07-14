import { useEffect, useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'

// สินค้า Um Shop — เก็บใน Firestore collection "products"
// โครงสร้างสินค้า: { name, images: [url...], price, description, colors: [..], sizes: [..], stock, category, createdAt }

export function useProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  return { products, loading }
}

export const addProduct = (data) => addDoc(collection(db, 'products'), { ...data, createdAt: Date.now() })
export const updateProduct = (id, data) => updateDoc(doc(db, 'products', id), data)
export const deleteProduct = (id) => deleteDoc(doc(db, 'products', id))

// โปรโมชั่นส่วนลด Um Shop — เก็บใน Firestore collection "shopPromotions" (แอดมินเท่านั้นที่เห็น/จัดการ)
// โครงสร้าง: { label, type: 'percent' | 'amount', value }
export function usePromotions() {
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shopPromotions'), (snap) => {
      setPromotions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  return { promotions, loading }
}

export const addPromotion = (data) => addDoc(collection(db, 'shopPromotions'), data)
export const deletePromotion = (id) => deleteDoc(doc(db, 'shopPromotions', id))

// ฟังก์ชันราคา/ส่วนลด (pure) ย้ายไป pricing.js — re-export ให้หน้าที่เคย import จากที่นี่ใช้ได้เหมือนเดิม
export { applyPromotion, hasDiscount, effectivePrice, discountPercent, csvToList, groupProductsByName, SHOP_SIZES_BY_CATEGORY, dedupeSortSizes } from './pricing.js'
