import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { collection, doc, addDoc, onSnapshot, runTransaction } from 'firebase/firestore'

// ระบบคลัง Um Shop — บันทึกทุกครั้งที่สต็อกเปลี่ยน ('stockMovements') เพื่อดูย้อนหลังได้ว่าใคร/เมื่อไหร่/เพราะอะไร
// ตัดสต็อกอัตโนมัติตอนสั่งซื้อ (ดู createOrder ใน orders.js) — ไฟล์นี้จัดการฝั่งแอดมิน: รับเข้าคลัง + ดูประวัติ + แจ้งเตือนใกล้หมด

export const LOW_STOCK_THRESHOLD = 5

export const stockLevel = (stock) => {
  if (!Number.isFinite(stock) || stock <= 0) return 'out'
  if (stock <= LOW_STOCK_THRESHOLD) return 'low'
  return 'ok'
}

// รับสินค้าเข้าคลัง — เพิ่ม stock ของสินค้า + บันทึก log (เฉพาะแอดมิน — คุมสิทธิ์ใน firestore.rules)
export async function stockIn(product, qty, reason) {
  const n = Math.trunc(Number(qty))
  if (!Number.isFinite(n) || n <= 0) throw new Error('กรุณาใส่จำนวนที่มากกว่า 0')
  const productRef = doc(db, 'products', product.id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef)
    if (!snap.exists()) throw new Error('ไม่พบสินค้านี้ในระบบแล้ว')
    const next = (Number.isFinite(snap.data().stock) ? snap.data().stock : 0) + n
    tx.update(productRef, { stock: next })
  })
  await addDoc(collection(db, 'stockMovements'), {
    productId: product.id,
    productCode: product.productId || '',
    productName: product.name || '',
    qty: n,
    type: 'stock-in',
    reason: (reason || '').trim().slice(0, 300),
    at: Date.now(),
  })
}

export function useStockMovements() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'stockMovements'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (b.at || 0) - (a.at || 0))
        setRows(list)
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])

  return { rows, loading }
}
