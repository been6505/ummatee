import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useOrder, uploadPaymentProof, declarePayment } from '../data/orders.js'
import { notifyAdminPaymentDeclared } from '../utils/lineNotify.js'
import { uploadToCloudinary } from '../utils/cloudinary.js'
import { ACCOUNTS } from '../data/accounts.js'
import { useNavigate } from '../navContext'
import Footer from '../components/Footer.jsx'
import { THB, Stepper, UploadButton, OrderItemsCard, CustomerInfoCard, trackingUrl } from '../components/OrderShared.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCartShopping, faCheck, faCamera, faCopy, faLocationDot } from '@fortawesome/free-solid-svg-icons'
import { optImg } from '../utils/cloudinaryUrl.js'

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
    <main className="page">
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

          {actionStatus && (
            <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '.88rem' }}>
              {actionStatus}
            </div>
          )}

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
            <div className="admin-card" style={{ marginBottom: 20 }}>
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
<br/> 
              {order.paymentDeclaredAt ? (
                <p style={{ color: '#15803d', fontSize: '.88rem', marginTop: 12 }}>
                  <FontAwesomeIcon icon={faCheck} /> แจ้งชำระเงินแล้วเมื่อ {order.paymentDeclaredAt} — รอทีมงานยืนยัน
                </p>
              ) : (
                <button
                  type="button"
                  className="shop-addcart-btn"
                  style={{ marginTop: 12 }}
                  onClick={handleDeclarePayment}
                  disabled={!order.paymentProofUrl || declaring}
                >
                  {declaring ? 'กำลังส่ง...' : 'ชำระเงิน'}
                </button>
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

          {/* ── สถานะที่ 3: กำลังจัดส่ง ── */}
          {order.status === 'shipping' && (
            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>กำลังจัดส่ง</h4>
              {order.trackingNumber && (
                <p style={{ fontSize: '.95rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span><strong>เลขพัสดุ:</strong> {order.trackingNumber}</span>
                  <a className="admin-btn" style={{ fontSize: '.78rem', padding: '3px 10px' }} href={trackingUrl(order.trackingNumber, order.courier)} target="_blank" rel="noopener noreferrer">
                    <FontAwesomeIcon icon={faLocationDot} /> ติดตามพัสดุ
                  </a>
                </p>
              )}
              {order.packedImages?.length > 0 && (
                <div className="admin-media-preview" style={{ marginBottom: 14 }}>
                  {order.packedImages.map((url, i) => (
                    <div key={i} className="admin-media-thumb"><img src={url} alt="สินค้าที่แพ็ค" /></div>
                  ))}
                </div>
              )}
              {order.shippingUpdates?.length > 0 ? (
                <div>
                  {[...order.shippingUpdates].reverse().map((u, i) => (
                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: '.9rem' }}>
                      <div>{u.text}</div>
                      <div style={{ color: 'var(--ink-soft)', fontSize: '.78rem' }}>{u.at}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--ink-soft)' }}>พัสดุของคุณกำลังจัดส่ง</p>
              )}
            </div>
          )}

          {/* ── สถานะที่ 4: จัดส่งเรียบร้อย (ขั้นสุดท้าย) ── */}
          {order.status === 'delivered' && (
            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>จัดส่งเรียบร้อยแล้ว</h4>
              <p style={{ color: '#15803d' }}><FontAwesomeIcon icon={faCheck} /> ได้รับสินค้าเมื่อ {order.deliveredAt}</p>
              {order.trackingNumber && (
                <p style={{ fontSize: '.9rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span><strong>เลขพัสดุ:</strong> {order.trackingNumber}</span>
                  <a className="admin-btn" style={{ fontSize: '.78rem', padding: '3px 10px' }} href={trackingUrl(order.trackingNumber, order.courier)} target="_blank" rel="noopener noreferrer">
                    <FontAwesomeIcon icon={faLocationDot} /> ติดตามพัสดุ
                  </a>
                </p>
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
              <p style={{ color: 'var(--ink-soft)', marginTop: 12 }}>ขอบคุณที่อุดหนุนสินค้าของมูลนิธิอุมมะตี 🤍</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}
