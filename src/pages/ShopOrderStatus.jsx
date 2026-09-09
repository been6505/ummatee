import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useOrder, uploadPaymentProof, declarePayment, normOrderStatus, STATUS_LABEL, STATUS_HINT } from '../data/orders.js'
import { notifyAdminPaymentDeclared } from '../utils/lineNotify.js'
import { uploadToCloudinary } from '../utils/cloudinary.js'
import { ACCOUNTS } from '../data/accounts.js'
import { useNavigate } from '../navContext'
import Footer from '../components/Footer.jsx'
import ShopAlert from '../components/ShopAlert.jsx'
import { THB, Stepper, UploadButton, OrderItemsCard, CustomerInfoCard, trackingUrl, courierLabel } from '../components/OrderShared.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCartShopping, faCheck, faCamera, faCopy, faLocationDot, faComments } from '@fortawesome/free-solid-svg-icons'
import { optImg } from '../utils/cloudinaryUrl.js'

// เปิดวิดเจ็ตแชทหน้าเว็บ (ChatWidget.jsx mount อยู่ที่ App.jsx) ผ่าน custom event — เหมือนหน้าอื่นๆ ในร้าน
const openChat = () => window.dispatchEvent(new Event('ummatee-open-chat'))

// หน้าติดตามคำสั่งซื้อสำหรับลูกค้า (/um-shop/order/:orderId) — ดูสถานะ + อัพหลักฐานการโอนเท่านั้น
// การจัดการฝั่งแอดมิน (ยืนยันชำระเงิน/แพ็คของ/อัปเดตจัดส่ง) ย้ายไปหน้า /admin/shop/orders/:id แล้ว
// 4 สถานะ: รอชำระเงิน → เตรียมจัดส่ง → กำลังจัดส่ง → จัดส่งเรียบร้อย

// บัญชีรับเงินสำหรับ Um Shop — ใช้บัญชี "สนับสนุนมูลนิธิ" เดียวกับหน้าบริจาคหลัก
const SHOP_ACCOUNT = ACCOUNTS.find((a) => a.key === 'foundation')

// กล่องเลขบัญชีให้โอน + ปุ่มคัดลอก — โชว์ "คัดลอกแล้ว" เฉพาะตอนคัดลอกสำเร็จจริง (กันหลอกผู้โอน)
function PaymentAccountBox({ amount }) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  const copy = () => {
    const clean = SHOP_ACCOUNT.raw.replace(/\s/g, '')
    const onSuccess = () => { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    const onFail = () => { setFailed(true); setTimeout(() => setFailed(false), 2200) }
    const fallback = () => {
      const el = document.createElement('textarea')
      el.value = clean; el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el); el.select()
      let ok = false
      try { ok = document.execCommand('copy') } catch (_) { /* noop */ }
      document.body.removeChild(el)
      if (ok) onSuccess(); else onFail()
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clean).then(onSuccess).catch(fallback)
    } else {
      fallback()
    }
  }

  return (
    <div style={{ background: '#f5fbf7', border: '1.5px solid var(--green-mid)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ fontSize: '.8rem', color: 'var(--ink-soft)', marginBottom: 4 }}>โอนเงินมาที่บัญชี</div>
      <div style={{ fontWeight: 700, color: 'var(--green-deep)' }}>{SHOP_ACCOUNT.icon} {SHOP_ACCOUNT.name} · ธนาคารอิสลามแห่งประเทศไทย (ibank)</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 800, letterSpacing: 1 }}>{SHOP_ACCOUNT.acc}</span>
        <button type="button" className="admin-btn" onClick={copy} style={{ fontSize: '.82rem' }}>
          <FontAwesomeIcon icon={faCheck} style={{ display: copied ? 'inline' : 'none' }} />
          <FontAwesomeIcon icon={faCopy} style={{ display: !copied ? 'inline' : 'none' }} />
          {' '}{copied ? 'คัดลอกแล้ว' : 'คัดลอกเลขบัญชี'}
        </button>
      </div>
      {failed && <p style={{ color: '#dc2626', fontSize: '.8rem', marginTop: 6 }}>คัดลอกไม่สำเร็จ กรุณาจดเลขบัญชีเอง</p>}
      <div style={{ marginTop: 10, fontSize: '.9rem' }}>
        ยอดที่ต้องโอน: <strong style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>{THB(amount)}</strong>
      </div>
    </div>
  )
}

export default function ShopOrderStatus({ orderId }) {
  const { order, loading, error } = useOrder(orderId)
  const go = useNavigate()

  const [uploadingProof, setUploadingProof] = useState(false)
  const [declaring, setDeclaring] = useState(false)
  const [actionStatus, setActionStatus] = useState('')
  // ปุ่มคัดลอกเลขพัสดุ — ลูกค้าส่วนใหญ่เอาเลขไปวางในแอปขนส่ง/ไลน์ พิมพ์ตามเองผิดง่าย
  const [copiedTracking, setCopiedTracking] = useState(false)

  if (loading) return null

  if (error || !order) {
    return (
      <main className="page">
        <section className="section"><div className="wrap" style={{ textAlign: 'center', padding: '80px 0' }}>
          <h2>ไม่พบคำสั่งซื้อนี้</h2>
          <a href="/um-shop" onClick={(e) => { e.preventDefault(); go('shop') }} className="shop-interest-btn" style={{ background: 'var(--green-mid)' }}>
            <FontAwesomeIcon icon={faArrowLeft} /> กลับไปหน้าร้านค้า
          </a>
        </div></section>
        <Footer />
      </main>
    )
  }

  const copyTracking = async () => {
    const code = order?.trackingNumber || ''
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopiedTracking(true)
      setTimeout(() => setCopiedTracking(false), 2000)
    } catch { setActionStatus('คัดลอกไม่สำเร็จ — กรุณาจดเลขพัสดุเอง') }
  }

  const handleProofUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingProof(true)
    try {
      const { url } = await uploadToCloudinary(file, 'image')
      await uploadPaymentProof(order.id, url)
    } catch (err) {
      setActionStatus('อัพโหลดไม่สำเร็จ: ' + err.message)
    } finally {
      setUploadingProof(false)
      e.target.value = ''
    }
  }

  const handleDeclarePayment = async () => {
    setDeclaring(true)
    try {
      await declarePayment(order.id)
      notifyAdminPaymentDeclared(order)
    }
    catch (err) { setActionStatus('เกิดข้อผิดพลาด: ' + err.message) }
    finally { setDeclaring(false) }
  }

  return (
    <>
    {/* ข้อผิดพลาด (อัพโหลดสลิป / แจ้งชำระเงิน) ขึ้นเป็นกล่องกลางจอ — ปุ่ม "ยืนยันการชำระเงิน"
        อยู่ในแถบล่างที่ลอยติดจอ แต่แถบข้อความเดิมอยู่บนสุดของหน้า ผู้ใช้กดแล้วไม่เห็นว่าพลาดอะไร */}
    <ShopAlert message={actionStatus} title="แจ้งเตือน" onClose={() => setActionStatus('')} />
    <main className={`page${order.status === 'pending_payment' ? ' shop-checkout-page' : ''}`}>
      <section className="page-band">
        <div className="fc-pattern hero-pattern"></div>
        <div className="inner">
          <h1>ติดตามคำสั่งซื้อ</h1>


          <span className="badge">
            <h3>


              <FontAwesomeIcon icon={faCartShopping} /> คำสั่งซื้อ {order.orderCode}
            </h3>    </span>



        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <a href="/um-shop" onClick={(e) => { e.preventDefault(); go('shop') }} className="shop-detail-back">
            <FontAwesomeIcon icon={faArrowLeft} /> กลับไปหน้าร้านค้า
          </a>

          <Stepper status={order.status} />

          {/* บอกด้วยคำพูดว่าสถานะตอนนี้แปลว่าอะไรและต้องทำอะไรต่อ — แถบขั้นตอนบอกได้แค่ว่าอยู่ขั้นไหน
              ลูกค้าที่ไม่คุ้นกับขั้นตอนสั่งของออนไลน์มักไม่รู้ว่า "เตรียมจัดส่ง" ต่างจาก "ส่งมอบขนส่งแล้ว" อย่างไร */}
          <div className="order-status-hint">
            <div className="order-status-hint-title">{STATUS_LABEL[normOrderStatus(order.status)] || order.status}</div>
            <p>{STATUS_HINT[normOrderStatus(order.status)]}</p>
          </div>


          {/* QR โค้ด + คำเตือนให้แคปหน้าจอเก็บไว้ — ลิงก์นี้เป็นทางเดียวที่ลูกค้ากลับมาติดตามสถานะภายหลังได้ */}
          <div className="admin-card" style={{ marginBottom: 20, textAlign: 'center' }}>
            <h4>บันทึกคำสั่งซื้อของคุณ</h4>
            <div style={{ display: 'inline-block', padding: 12, background: '#fff', border: '2px solid #e5e7eb', borderRadius: 14, margin: '10px 0' }}>
              <QRCodeSVG value={window.location.href} size={160} level="M" />
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--green-deep)', letterSpacing: 1 }}>{order.orderCode}</div>
            <p style={{ color: '#d97706', fontSize: '.88rem', fontWeight: 700, marginTop: 10 }}>
              <FontAwesomeIcon icon={faCamera} /> กรุณาแคปหน้าจอนี้เก็บไว้ — ใช้สแกน QR หรือกดลิงก์นี้เพื่อกลับมาติดตามสถานะได้ตลอด
            </p>
          </div>

          <OrderItemsCard order={order} />
          <CustomerInfoCard order={order} />

          {/* ── สถานะที่ 1: รอการชำระเงิน ── */}
          {order.status === 'pending_payment' && (
            <div className="admin-card" style={{ marginBottom: 20 }} id="payment-section">
              <h4>การชำระเงิน</h4>
              {!order.paymentProofUrl && <PaymentAccountBox amount={order.total} />}
              {order.paymentProofUrl ? (
                <div style={{ marginBottom: 12 }}>
                  <img src={order.paymentProofUrl} alt="หลักฐานการชำระเงิน" style={{ maxWidth: 280, borderRadius: 10, display: 'block' }} />
                  <p style={{ color: '#15803d', fontSize: '.88rem', marginTop: 6 }}><FontAwesomeIcon icon={faCheck} /> อัพโหลดหลักฐานแล้ว รอตรวจสอบ</p>
                </div>
              ) : (
                <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem' }}>โอนเงินตามยอดด้านบน แล้วอัพโหลดหลักฐานการโอนด้านล่าง</p>
              )}
              <UploadButton label="อัพโหลดหลักฐานการชำระเงิน" uploading={uploadingProof} onFiles={handleProofUpload} />
              {order.paymentDeclaredAt && (
                <p style={{ color: '#15803d', fontSize: '.88rem', marginTop: 12 }}>
                  <FontAwesomeIcon icon={faCheck} /> แจ้งชำระเงินแล้วเมื่อ {order.paymentDeclaredAt} — รอทีมงานยืนยัน
                </p>
              )}
            </div>
          )}

          {/* ── สถานะที่ 2: เตรียมการจัดส่ง ── */}
          {order.status === 'preparing' && (
            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>เตรียมการจัดส่ง</h4>
              <p style={{ color: 'var(--ink-soft)' }}>ทีมงานกำลังเตรียมสินค้าของคุณ กรุณารอสักครู่</p>
            </div>
          )}

          {/* ── สถานะที่ 3: จัดส่งแล้ว (ขั้นสุดท้าย) ──
              เลขพัสดุ + ปุ่มไปเว็บขนส่งอยู่บนสุดและเด่นที่สุด เพราะเป็นสิ่งเดียวที่ลูกค้าเปิดหน้านี้มาหา
              สถานะละเอียด (ถึงไหนแล้ว/ส่งสำเร็จหรือยัง) ดูที่เว็บขนส่ง ร้านไม่รู้ข้อมูลนั้นเอง */}
          {normOrderStatus(order.status) === 'shipped' && (
            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>{STATUS_LABEL.shipped}</h4>
              {order.trackingNumber ? (
                <div className="order-track-box">
                  <div className="order-track-courier">{courierLabel(order.courier)}</div>
                  <div className="order-track-code">{order.trackingNumber}</div>
                  <div className="order-track-actions">
                    <a className="order-track-btn" href={trackingUrl(order.trackingNumber, order.courier)} target="_blank" rel="noopener noreferrer">
                      <FontAwesomeIcon icon={faLocationDot} /> ติดตามพัสดุที่เว็บขนส่ง
                    </a>
                    <button type="button" className="order-track-copy" onClick={copyTracking}>
                      <FontAwesomeIcon icon={copiedTracking ? faCheck : faCopy} /> {copiedTracking ? 'คัดลอกแล้ว' : 'คัดลอกเลขพัสดุ'}
                    </button>
                  </div>
                  <p className="order-track-note">กดปุ่มด้านบนเพื่อดูว่าพัสดุถึงไหนแล้วจากเว็บของขนส่งโดยตรง</p>
                </div>
              ) : (
                <p style={{ color: 'var(--ink-soft)' }}>ร้านส่งพัสดุแล้ว — จะแจ้งเลขพัสดุให้เร็วๆ นี้</p>
              )}

              {order.packedImages?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>รูปสินค้าที่แพ็ค</p>
                  <div className="admin-media-preview">
                    {order.packedImages.map((url, i) => (
                      <div key={i} className="admin-media-thumb"><img src={optImg(url, 220)} alt="สินค้าที่แพ็ค" /></div>
                    ))}
                  </div>
                </div>
              )}

              {order.deliveredImages?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>รูปหลังส่งพัสดุแล้ว</p>
                  <div className="admin-media-preview">
                    {order.deliveredImages.map((url, i) => (
                      <div key={i} className="admin-media-thumb"><img src={optImg(url, 220)} alt="รูปหลังส่งพัสดุ" /></div>
                    ))}
                  </div>
                </div>
              )}

              {order.shippingUpdates?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  {[...order.shippingUpdates].reverse().map((u, i) => (
                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: '.9rem' }}>
                      <div>{u.text}</div>
                      <div style={{ color: 'var(--ink-soft)', fontSize: '.78rem' }}>{u.at}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>

    {/* แถบลอยติดขอบล่างจอ (แชท / ชำระเงิน) — โชว์เฉพาะตอนยังรอชำระเงินและยังไม่เคยแจ้งชำระ
        สถานะอื่น (global ChatWidget fab ถูกซ่อนไว้ทั้งหน้านี้ใน App.jsx) เหลือปุ่มแชทกลมลอยธรรมดาแทน กันไม่มีทางเข้าแชทเลย */}
    {order.status === 'pending_payment' && !order.paymentDeclaredAt ? (
      <div className="shop-detail-bar shop-checkout-bar">
        <button type="button" onClick={openChat} className="shop-detail-bar-line" aria-label="แชท">
          <FontAwesomeIcon icon={faComments} />
          <span>แชท</span>
        </button>
        <div className="shop-detail-bar-price">
          <span className="cart-bar-total-label">ยอดที่ต้องโอน</span>
          <span className="shop-detail-bar-price-now">{THB(order.total)}</span>
        </div>
        <button
          type="button"
          className="shop-detail-bar-cart"
          onClick={order.paymentProofUrl
            ? handleDeclarePayment
            : () => document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          disabled={declaring}
        >
          {declaring ? 'กำลังส่ง...' : order.paymentProofUrl ? 'ยืนยันการชำระเงิน' : 'ชำระเงิน'}
        </button>
      </div>
    ) : (
      <button className="chat-fab" onClick={openChat} aria-label="แชทกับแอดมิน">
        <FontAwesomeIcon icon={faComments} />
      </button>
    )}
    </>
  )
}
