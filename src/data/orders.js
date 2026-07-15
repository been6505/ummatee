import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import {
  collection, doc, updateDoc, onSnapshot, runTransaction, query, orderBy, arrayUnion,
} from 'firebase/firestore'

// คำสั่งซื้อ Um Shop — เก็บใน Firestore collection "orders"
// ลำดับสถานะ: pending_payment → preparing → shipping → delivered
export const STATUS_STEPS = ['pending_payment', 'preparing', 'shipping', 'delivered']

export const STATUS_LABEL = {
  pending_payment: 'รอการชำระเงิน',
  preparing: 'เตรียมการจัดส่ง',
  shipping: 'กำลังจัดส่ง',
  delivered: 'จัดส่งเรียบร้อย',
}

// สถานะที่ไม่รู้จัก (เช่น 'reviewed' จาก order เก่าก่อนตัดระบบรีวิว) ให้นับเป็นขั้นสุดท้าย
export const stepIndex = (status) => {
  const i = STATUS_STEPS.indexOf(status)
  return i >= 0 ? i : STATUS_STEPS.length - 1
}

const SHIPPING_FEE = 50 // ค่าจัดส่งมาตรฐาน (บาท) — ถ้าต้องคำนวณตามน้ำหนัก/พื้นที่ในอนาคตค่อยแยกฟังก์ชัน
export const getShippingFee = () => SHIPPING_FEE

// สร้างคำสั่งซื้อใหม่ — คืน { id, orderCode }
// ตัดสต็อกสินค้า + สร้างเลขที่ออเดอร์ + สร้างออเดอร์ ในทรานแซกชันเดียวกัน (atomic) กันสต็อกติดลบ
// จากการสั่งซื้อพร้อมกันหลายคน (Firestore transaction อ่านสต็อกก่อนเขียนเสมอ ถ้าชนกันจะ retry ให้เอง)
export async function createOrder({ items, itemsTotal, customer }) {
  const counterRef = doc(db, 'config', 'shopOrderCounter')
  const shippingFee = getShippingFee()
  // ปัด 2 ตำแหน่งกันเศษ float (เช่นราคา 99.5 × 3) — rules บังคับ total == itemsTotal + shippingFee เป๊ะ
  const cleanItemsTotal = Math.round(itemsTotal * 100) / 100
  const orderRef = doc(collection(db, 'orders'))
  // it.productDocId = doc id จริงของสินค้า (it.id เป็น line id รวมสี/ขนาด) — fallback it.id เผื่อตะกร้าเก่า
  const productRefs = items.map((it) => doc(db, 'products', it.productDocId || it.id))
  let orderCode = ''

  await runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef)
    const num = counterSnap.exists() ? (counterSnap.data().count ?? 0) + 1 : 1
    orderCode = `ORD-${String(num).padStart(4, '0')}`

    const productSnaps = await Promise.all(productRefs.map((r) => tx.get(r)))
    productSnaps.forEach((snap, i) => {
      const it = items[i]
      if (!snap.exists()) throw new Error(`ไม่พบสินค้า "${it.name || it.id}" แล้ว — สินค้าอาจถูกลบไปแล้ว`)
      const data = snap.data()
      // สินค้าที่มีสต็อกแยกต่อไซซ์ (เสื้อ) เช็คจากไซซ์ที่เลือกโดยเฉพาะ — สินค้าอื่นเช็คจาก stock รวมเหมือนเดิม
      if (data.sizeStock && it.sizes) {
        const sizeLeft = Number(data.sizeStock[it.sizes]) || 0
        if (sizeLeft < it.qty) throw new Error(`"${it.name || 'สินค้า'}" ไซซ์ ${it.sizes} เหลือไม่พอ (คงเหลือ ${sizeLeft} ชิ้น)`)
      } else {
        const stock = data.stock
        if (Number.isFinite(stock) && stock < it.qty) {
          throw new Error(`"${it.name || 'สินค้า'}" เหลือไม่พอ (คงเหลือ ${stock} ชิ้น)`)
        }
      }
    })

    tx.set(counterRef, { count: num })

    tx.set(orderRef, {
      orderCode,
      items,
      itemsTotal: cleanItemsTotal,
      shippingFee,
      // ห้ามปัด total ซ้ำ — rules ตรวจ total == itemsTotal + shippingFee ด้วย float แบบเดียวกับ JS
      // ถ้าปัดแล้วค่าขยับแม้เศษเสี้ยว rules จะปฏิเสธ order ทันที
      total: cleanItemsTotal + shippingFee,
      customer,
      status: 'pending_payment',
      paymentProofUrl: null,
      createdAt: Date.now(),
    })

    productSnaps.forEach((snap, i) => {
      const it = items[i]
      const data = snap.data()
      const stock = data.stock
      const nextSold = (Number(data.sold) || 0) + it.qty // ยอดขายสะสมต่อสินค้า — โชว์ "ขายแล้ว X ชิ้น" ในการ์ด (social proof แบบ Shopee)
      if (data.sizeStock && it.sizes) {
        // ตัดเฉพาะไซซ์ที่เลือก แล้วปรับ stock รวมให้ตรงกับผลรวมใหม่เสมอ (หน้าร้าน/ตารางแอดมินอ่าน stock รวมนี้)
        const nextSizeStock = { ...data.sizeStock, [it.sizes]: (Number(data.sizeStock[it.sizes]) || 0) - it.qty }
        const nextTotal = Object.values(nextSizeStock).reduce((s, v) => s + (Number(v) || 0), 0)
        tx.update(productRefs[i], { sizeStock: nextSizeStock, stock: nextTotal, sold: nextSold })
      } else if (Number.isFinite(stock)) {
        tx.update(productRefs[i], { stock: stock - it.qty, sold: nextSold })
      }
      tx.set(doc(collection(db, 'stockMovements')), {
        productId: it.productDocId || it.id,
        productCode: it.productId || '',
        productName: it.name || '',
        qty: -it.qty,
        type: 'order',
        orderCode,
        at: Date.now(),
      })
    })
  })

  return { id: orderRef.id, orderCode }
}

// อ่านคำสั่งซื้อ 1 รายการแบบเรียลไทม์ (ใช้ทั้งฝั่งลูกค้าและแอดมิน)
export function useOrder(orderId) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!orderId) { setLoading(false); return }
    const unsub = onSnapshot(
      doc(db, 'orders', orderId),
      (snap) => { setOrder(snap.exists() ? { id: snap.id, ...snap.data() } : null); setLoading(false) },
      () => { setError(true); setLoading(false) }
    )
    return unsub
  }, [orderId])

  return { order, loading, error }
}

// รายการคำสั่งซื้อทั้งหมด (สำหรับหน้าแอดมิน) — เรียงใหม่ล่าสุดก่อน
export function useOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  return { orders, loading }
}

// ── ฝั่งลูกค้า ───────────────────────────────────────────────────────
// อัพโหลดหลักฐานการชำระเงิน (ทำได้เฉพาะตอนสถานะยังรอชำระเงิน — คุมด้วย Firestore rules อีกชั้น)
export const uploadPaymentProof = (orderId, url) =>
  updateDoc(doc(db, 'orders', orderId), { paymentProofUrl: url, paymentProofAt: new Date().toLocaleString('th-TH') })

// ลูกค้ากดปุ่ม "ชำระเงินแล้ว" — ไม่เปลี่ยน status (ยังเป็น pending_payment จนกว่าแอดมินจะกดยืนยัน)
// แค่บันทึกเวลาที่ลูกค้าแจ้ง เพื่อให้แอดมินเห็นว่าออเดอร์นี้ "รอยืนยัน" ต่างจากออเดอร์ที่ลูกค้ายังไม่ได้ทำอะไรเลย
export const declarePayment = (orderId) =>
  updateDoc(doc(db, 'orders', orderId), { paymentDeclaredAt: new Date().toLocaleString('th-TH') })

// label สถานะที่แอดมินเห็น — แยก "รอการชำระเงิน" (ลูกค้ายังไม่กดอะไร) กับ
// "รอยืนยันการชำระเงิน" (ลูกค้ากดปุ่มชำระเงินแล้ว รอแอดมินตรวจสลิป+ยืนยัน)
export const adminStatusLabel = (order) => {
  if (order.status === 'pending_payment' && order.paymentDeclaredAt) return 'รอยืนยันการชำระเงิน'
  return STATUS_LABEL[order.status] || order.status
}

// ── ฝั่งแอดมิน ───────────────────────────────────────────────────────
export const confirmPayment = (orderId) =>
  updateDoc(doc(db, 'orders', orderId), { status: 'preparing', paymentConfirmedAt: new Date().toLocaleString('th-TH') })

// ยืนยันแพ็คของ + อัปโหลดรูปสินค้าที่แพ็ค + เลขพัสดุ+ขนส่ง (ไม่บังคับ) → เปลี่ยนสถานะเป็นกำลังจัดส่ง
export const confirmPackedAndShip = (orderId, packedImages, trackingNumber, courier) =>
  updateDoc(doc(db, 'orders', orderId), {
    packedImages, packedAt: new Date().toLocaleString('th-TH'), status: 'shipping',
    trackingNumber: trackingNumber?.trim() || null,
    courier: trackingNumber?.trim() ? (courier || null) : null,
  })

// แก้/เพิ่มเลขพัสดุ+ขนส่งภายหลัง (เช่น ตอนแรกไม่มีเลข พึ่งได้จากขนส่งทีหลัง) — ใช้ได้ทั้งตอน shipping/delivered
export const setTrackingNumber = (orderId, trackingNumber, courier) =>
  updateDoc(doc(db, 'orders', orderId), {
    trackingNumber: trackingNumber?.trim() || null,
    courier: trackingNumber?.trim() ? (courier || null) : null,
  })

// อัปเดตความคืบหน้าการจัดส่ง (ข้อความอิสระจากผู้จัดส่ง) — เก็บเป็นประวัติ
export const addShippingUpdate = (orderId, text) =>
  updateDoc(doc(db, 'orders', orderId), {
    shippingUpdates: arrayUnion({ text, at: new Date().toLocaleString('th-TH') }),
  })

export const confirmDelivered = (orderId) =>
  updateDoc(doc(db, 'orders', orderId), { status: 'delivered', deliveredAt: new Date().toLocaleString('th-TH') })

// แนบรูปหลังส่งพัสดุแล้ว (เช่น รูปหน้าบ้านลูกค้า/ใบเซ็นรับ) — อัพได้เรื่อยๆ ทีละชุด สะสมไว้ทั้งหมด
export const addDeliveredImages = (orderId, images) =>
  updateDoc(doc(db, 'orders', orderId), { deliveredImages: arrayUnion(...images) })
