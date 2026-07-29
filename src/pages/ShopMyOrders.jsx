import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { doc, getDoc } from 'firebase/firestore'
import { STATUS_LABEL } from '../data/orders.js'
import { useNavigate } from '../navContext'
import Footer from '../components/Footer.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faBoxOpen, faChevronRight } from '@fortawesome/free-solid-svg-icons'

// หน้า "คำสั่งซื้อของฉัน" (/um-shop/my-orders) — รายการออเดอร์ที่เคยสั่งจากเครื่องนี้
// เก็บ id ไว้ใน localStorage ตอนสั่งซื้อสำเร็จ (ยังไม่มีระบบบัญชี — เปลี่ยนเครื่อง/ลบข้อมูลเบราว์เซอร์แล้วรายการหาย
// ลูกค้ายังเข้าผ่านลิงก์/QR ที่แคปไว้ได้เสมอ)

import { optImg } from '../utils/cloudinaryUrl.js'
import ListSkeleton from '../components/ListSkeleton.jsx'
const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

function myOrderIds() {
  try { return JSON.parse(localStorage.getItem('umShopMyOrders') || '[]') } catch { return [] }
}

export default function ShopMyOrders() {
  const go = useNavigate()
  const [orders, setOrders] = useState(null) // null = กำลังโหลด

  useEffect(() => {
    const ids = myOrderIds()
    if (ids.length === 0) { setOrders([]); return }
    let cancelled = false
    Promise.all(
      ids.map(({ id }) =>
        getDoc(doc(db, 'orders', id))
          .then((snap) => (snap.exists() ? { id: snap.id, ...snap.data() } : null))
          .catch(() => null)
      )
    ).then((rows) => { if (!cancelled) setOrders(rows.filter(Boolean)) })
    return () => { cancelled = true }
  }, [])

  const openOrder = (id) => (e) => { e.preventDefault(); go('shop-order', id) }

  return (
    <main className="page">
      <section className="page-band">
        <div className="fc-pattern hero-pattern"></div>
        <div className="inner">
          <span className="badge"><FontAwesomeIcon icon={faBoxOpen} /> Um Shop</span>
          <h1>คำสั่งซื้อของฉัน</h1>
        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <a href="/um-shop" onClick={(e) => { e.preventDefault(); go('shop') }} className="shop-detail-back">
            <FontAwesomeIcon icon={faArrowLeft} /> กลับไปหน้าร้านค้า
          </a>

          {orders === null ? (
            <ListSkeleton />
          ) : orders.length === 0 ? (
            <div className="shop-empty">
              <FontAwesomeIcon icon={faBoxOpen} className="shop-empty-icon" />
              <p className="shop-empty-text">ยังไม่มีคำสั่งซื้อจากเครื่องนี้</p>
              <p style={{ fontSize: '.85rem', marginTop: -4, marginBottom: 4, color: 'var(--ink-soft)' }}>ถ้าเคยสั่งซื้อจากเครื่องอื่น ให้เปิดจากลิงก์/QR ที่ได้รับตอนสั่งซื้อ</p>
              <button type="button" className="shop-empty-btn" onClick={() => go('shop')}>เลือกซื้อสินค้า</button>
            </div>
          ) : (
            <div>
              {orders.map((o) => (
                <a key={o.id} href={`/um-shop/order/${o.id}`} onClick={openOrder(o.id)} className="my-order-row">
                  <div className="my-order-thumb">
                    {o.items?.[0]?.image ? <img src={optImg(o.items[0].image, 140)} alt="" /> : <FontAwesomeIcon icon={faBoxOpen} />}
                  </div>
                  <div className="my-order-mid">
                    <div className="my-order-code">{o.orderCode}</div>
                    <div className="my-order-items">
                      {o.items?.length === 1 ? o.items[0].name : `${o.items?.[0]?.name} และอีก ${o.items.length - 1} รายการ`}
                    </div>
                    <div className="my-order-total">{THB(o.total)}</div>
                  </div>
                  <div className="my-order-right">
                    <span className={`my-order-status st-${o.status}`}>{STATUS_LABEL[o.status] || o.status}</span>
                    <FontAwesomeIcon icon={faChevronRight} style={{ color: '#ccc' }} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}
