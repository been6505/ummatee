import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import {
  collection, doc, updateDoc, deleteDoc, onSnapshot, runTransaction, query, orderBy, arrayUnion,
} from 'firebase/firestore'
import { LOW_STOCK_THRESHOLD } from './inventory.js'
import { notifyAdminLowStock } from '../utils/lineNotify.js'
import { effectivePrice, groupOrderItemsByProduct, planStockRestore } from './pricing.js'

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
  const orderRef = doc(collection(db, 'orders'))
  // it.productDocId = doc id จริงของสินค้า (it.id เป็น line id รวมสี/ขนาด) — fallback it.id เผื่อตะกร้าเก่า
  const productRefs = items.map((it) => doc(db, 'products', it.productDocId || it.id))
  let orderCode = ''
  let lowStockAlerts = [] // สินค้าที่เพิ่งตัดสต็อกแล้ว "ข้าม" เกณฑ์ต่ำครั้งนี้ — แจ้งแอดมินหลัง tx สำเร็จ

  await runTransaction(db, async (tx) => {
    lowStockAlerts = [] // reset ทุกครั้งที่ tx ลอง retry กันแจ้งซ้ำจากรอบที่ชนกัน
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

    // ราคาต้องคิดใหม่จากราคาจริงใน Firestore ตอนนี้ ห้ามเชื่อ it.price ที่ติดมากับตะกร้า
    // (ตะกร้าอยู่ใน localStorage ฝั่งลูกค้า จับราคาไว้ตอนกดใส่ตะกร้า — อาจค้างข้ามการแก้ราคา/โปรฯ ของแอดมิน
    //  และแก้ค่าเองได้ด้วย ส่วน firestore.rules ตรวจได้แค่ว่า total == itemsTotal + shippingFee สอดคล้องกันเอง
    //  เทียบราคาสินค้าจริงไม่ได้ เพราะ rules อ่านเอกสารอื่นมาคำนวณผลรวมทั้งตะกร้าไม่ได้)
    const pricedItems = items.map((it, i) => ({ ...it, price: effectivePrice(productSnaps[i].data()) }))
    const serverItemsTotal = pricedItems.reduce((s, it) => s + it.price * it.qty, 0)
    // ปัด 2 ตำแหน่งกันเศษ float (เช่นราคา 99.5 × 3) — rules บังคับ total == itemsTotal + shippingFee เป๊ะ
    const cleanItemsTotal = Math.round(serverItemsTotal * 100) / 100

    // ยอดที่คิดได้จริงไม่ตรงกับที่ลูกค้าเห็นบนหน้าจอ → ยกเลิกออเดอร์ ห้ามเก็บเงินยอดที่ลูกค้าไม่ได้ตกลงไว้
    // โยน error ที่พ่วง pricedItems ไปให้หน้าเช็คเอาท์ sync ราคาในตะกร้าแล้วให้ลูกค้าทบทวนยอดใหม่
    if (Math.round(itemsTotal * 100) / 100 !== cleanItemsTotal) {
      const err = new Error(`ราคาสินค้ามีการเปลี่ยนแปลง ยอดที่ถูกต้องคือ ฿${(cleanItemsTotal + shippingFee).toLocaleString('th-TH')} กรุณาตรวจสอบแล้วกดสั่งซื้ออีกครั้ง`)
      err.pricedItems = pricedItems.map((it) => ({ id: it.id, price: it.price }))
      throw err
    }

    tx.set(counterRef, { count: num })

    tx.set(orderRef, {
      orderCode,
      items: pricedItems,
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
        const prevTotal = Object.values(data.sizeStock).reduce((s, v) => s + (Number(v) || 0), 0)
        if (prevTotal > LOW_STOCK_THRESHOLD && nextTotal <= LOW_STOCK_THRESHOLD) {
          lowStockAlerts.push({ name: it.name || data.name, detail: `ไซซ์ ${it.sizes}`, remaining: nextTotal })
        }
      } else if (Number.isFinite(stock)) {
        const nextStock = stock - it.qty
        tx.update(productRefs[i], { stock: nextStock, sold: nextSold })
        if (stock > LOW_STOCK_THRESHOLD && nextStock <= LOW_STOCK_THRESHOLD) {
          lowStockAlerts.push({ name: it.name || data.name, detail: '', remaining: nextStock })
        }
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

  notifyAdminLowStock(lowStockAlerts)

  return { id: orderRef.id, orderCode }
}

// ลบคำสั่งซื้อ — เฉพาะแอดมินตัวจริง (rules บังคับ) ไม่คืนสต็อกที่ตัดไปแล้วให้อัตโนมัติ
// ใช้ตอนลบออเดอร์ทดสอบ/ผิดพลาด ถ้าออเดอร์จริงตัดสต็อกไปแล้วต้องไปเติมคลังคืนเองที่หน้าคลังสินค้า
// (ปกติควรใช้ cancelOrder ด้านล่างแทน — คืนสต็อกให้เองในทรานแซกชันเดียว)
export function deleteOrder(orderId) {
  return deleteDoc(doc(db, 'orders', orderId))
}

// ยกเลิกออเดอร์ + คืนสต็อกที่ตัดไปแล้วกลับคลัง ในทรานแซกชันเดียว (atomic) — กันเคสคืนสต็อกครึ่งๆ กลางๆ
// ลบเอกสารออเดอร์ทิ้งเหมือน deleteOrder แต่บวกสต็อกคืนและบันทึก stockMovements แบบ type 'cancel' ไว้เป็นหลักฐาน
// ใช้ตอนลูกค้าไม่จ่ายเงิน/ขอยกเลิก — ไม่ต้องให้แอดมินไปกดเติมคลังคืนเองแล้วลืม (ทำให้ของค้างสต็อก 0 ทั้งที่ยังมีของ)
export async function cancelOrder(orderId) {
  const orderRef = doc(db, 'orders', orderId)
  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists()) throw new Error('ไม่พบคำสั่งซื้อนี้ (อาจถูกลบไปแล้ว)')
    const order = orderSnap.data()
    const items = order.items || []

    // ต้องรวมรายการที่เป็น "สินค้าเดียวกัน" (doc เดียวกัน) เข้าด้วยกันก่อนเขียน
    // เสื้อตัวเดียวกันคนละไซซ์เป็นคนละรายการในตะกร้าแต่เป็น product doc เดียวกัน ถ้าเขียนทีละรายการ
    // แต่ละรอบจะคำนวณจาก snapshot ตั้งต้นชุดเดิม แล้ว tx.update รอบหลังทับรอบแรกทิ้ง
    // ⇒ คืนสต็อกได้แค่ไซซ์เดียว อีกไซซ์หายถาวร (และ sold ลดน้อยกว่าที่ควร)
    const entries = [...groupOrderItemsByProduct(items).entries()]
    const snaps = await Promise.all(entries.map(([pid]) => tx.get(doc(db, 'products', pid))))

    entries.forEach(([pid, lines], i) => {
      const snap = snaps[i]
      const ref = doc(db, 'products', pid)
      // บันทึกการเคลื่อนไหวสต็อกทีละรายการเสมอ (แม้สินค้าถูกลบไปแล้ว) เพื่อให้ประวัติตรงกับที่ตัดไปตอนสั่งซื้อ
      for (const it of lines) {
        tx.set(doc(collection(db, 'stockMovements')), {
          productId: pid,
          productCode: it.productId || '',
          productName: it.name || '',
          qty: it.qty, // บวก = คืนเข้าคลัง (ตรงข้ามกับ type 'order' ที่เป็นลบ)
          type: 'cancel',
          orderCode: order.orderCode || '',
          at: Date.now(),
        })
      }
      if (!snap.exists()) return // สินค้าถูกลบไปแล้ว — ไม่มีที่ให้คืนสต็อก (ออเดอร์ยังยกเลิกได้)

      // planStockRestore เป็นฟังก์ชันบริสุทธิ์ที่มีเทสต์คุมอยู่ (pricing.test.js) — รวมทุกไซซ์ของสินค้า
      // เดียวกันเป็นการเขียนครั้งเดียว และไม่บวกคืนสต็อกให้สินค้าที่ตอนสั่งซื้อไม่เคยถูกตัด
      tx.update(ref, planStockRestore(snap.data(), lines))
    })

    tx.delete(orderRef)
  })
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
// list ทั้ง collection ต้อง isFullAdmin() ตาม firestore.rules — ส่ง enabled:false เพื่อข้าม subscribe
// (เช่นตอนล็อกอินเป็นบัญชีอาสาสมัคร ซึ่งเป็น isAdmin() แต่ไม่ใช่ isFullAdmin() จะโดน permission-denied)
export function useOrders(enabled = true) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) return
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [enabled])

  return { orders, loading }
}

// ออเดอร์ "ใหม่" ที่แอดมินยังไม่เคยเปิดดูหน้ารายการคำสั่งซื้อ — เทียบเวลาสร้างกับเวลาที่แอดมิน
// เข้าหน้า /admin/shop/orders ครั้งล่าสุด (เก็บใน localStorage ต่อเบราว์เซอร์ ไม่มีฟิลด์ "อ่านแล้ว" ใน Firestore)
const ORDERS_SEEN_KEY = 'adminOrdersSeenAt'

export function markOrdersSeen() {
  try { localStorage.setItem(ORDERS_SEEN_KEY, String(Date.now())) } catch { /* noop */ }
}

export function useNewOrders(enabled = true) {
  const { orders } = useOrders(enabled)
  const seenAt = (() => { try { return Number(localStorage.getItem(ORDERS_SEEN_KEY)) || 0 } catch { return 0 } })()
  return orders.filter((o) => (o.createdAt || 0) > seenAt)
}

export function useNewOrdersCount(enabled = true) {
  return useNewOrders(enabled).length
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
