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
// สินค้าที่มี sizeStock (เช่น เสื้อ) ต้องระบุ size ด้วย — บวกเข้าไซซ์นั้นโดยตรง แล้วคำนวณ stock รวมใหม่จากผลรวม sizeStock เสมอ
// กันไม่ให้ stock (ยอดรวม) เพี้ยนไปจาก sizeStock จริง (ไม่งั้นของที่ "รับเข้า" จะไม่มีไซซ์ไหนขายได้จริง)
export async function stockIn(product, qty, reason, size) {
  const n = Math.trunc(Number(qty))
  if (!Number.isFinite(n) || n <= 0) throw new Error('กรุณาใส่จำนวนที่มากกว่า 0')
  const hasSizeStock = product.sizeStock && Object.keys(product.sizeStock).length > 0
  if (hasSizeStock && !size) throw new Error('สินค้านี้แยกสต็อกตามไซซ์ กรุณาเลือกไซซ์ที่รับเข้า')
  const productRef = doc(db, 'products', product.id)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(productRef)
    if (!snap.exists()) throw new Error('ไม่พบสินค้านี้ในระบบแล้ว')
    const data = snap.data()
    if (hasSizeStock) {
      const nextSizeStock = { ...data.sizeStock, [size]: (Number(data.sizeStock?.[size]) || 0) + n }
      const nextTotal = Object.values(nextSizeStock).reduce((s, v) => s + (Number(v) || 0), 0)
      tx.update(productRef, { sizeStock: nextSizeStock, stock: nextTotal })
    } else {
      const next = (Number.isFinite(data.stock) ? data.stock : 0) + n
      tx.update(productRef, { stock: next })
    }
  })
  await addDoc(collection(db, 'stockMovements'), {
    productId: product.id,
    productCode: product.productId || '',
    productName: product.name || '',
    qty: n,
    type: 'stock-in',
    reason: (hasSizeStock ? `ไซซ์ ${size}${reason ? ' — ' + reason : ''}` : (reason || '')).trim().slice(0, 300),
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
