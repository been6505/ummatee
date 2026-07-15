import { useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import VolunteerGuard from '../components/VolunteerGuard.jsx'
import useAdminAuth from '../useAdminAuth.js'
import {
  useOrder, STATUS_LABEL, adminStatusLabel,
  uploadPaymentProof, confirmPayment, confirmPackedAndShip, addShippingUpdate, confirmDelivered, setTrackingNumber,
  addDeliveredImages,
} from '../data/orders.js'
import { useProducts, effectivePrice } from '../data/shop.js'
import { uploadToCloudinary } from '../utils/cloudinary.js'
import { notifyLineOrderStatus } from '../utils/lineNotify.js'
import { Stepper, UploadButton, OrderItemsCard, CustomerInfoCard, trackingUrl, COURIERS } from '../components/OrderShared.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCheck, faLocationDot } from '@fortawesome/free-solid-svg-icons'

// หน้าจัดการคำสั่งซื้อของแอดมิน (/admin/shop/orders/:id) — ทำทุกขั้นตอน:
// ยืนยันการชำระเงิน, แนบรูปสินค้าที่แพ็ค + ยืนยันจัดส่ง, อัปเดตสถานะการจัดส่ง, ยืนยันจัดส่งเรียบร้อย

// สถานะการจัดส่งที่พบบ่อย — กดชิปแล้วบันทึกทันที ไม่ต้องพิมพ์เอง (พิมพ์เองได้ในช่องด้านล่างถ้าไม่ตรงตามนี้)
const SHIP_STATUS_PRESETS = [
  'พัสดุออกจากคลังแล้ว',
  'ถึงศูนย์กระจายสินค้าปลายทาง',
  'อยู่ระหว่างนำจ่าย',
  'นำจ่ายไม่สำเร็จ ลองใหม่วันถัดไป',
]
export default function AdminShopOrderDetail({ orderId }) {
  const { user, loading: authLoading } = useAdminAuth()
  const { order, loading, error } = useOrder(orderId)
  const { products } = useProducts()

  // ราคาต่อชิ้นในออเดอร์มาจากฝั่งลูกค้า (client) — เทียบกับราคาสินค้าปัจจุบัน ถ้าไม่ตรงให้เตือนแอดมินก่อนยืนยันรับเงิน
  // (ราคาอาจต่างเพราะแอดมินเพิ่งแก้ราคา/โปรฯ หลังลูกค้าสั่ง — ไม่ใช่การโกงเสมอไป แต่ควรเช็คยอดโอนกับราคาที่ถูกต้อง)
  const priceMismatches = (order?.items || []).flatMap((it) => {
    const p = products.find((x) => x.id === (it.productDocId || it.id))
    if (!p) return []
    const current = effectivePrice(p)
    if (current > 0 && Number(it.price) !== current) {
      return [{ name: it.name || it.productId, orderPrice: Number(it.price), currentPrice: current }]
    }
    return []
  })

  const [uploadingProof, setUploadingProof] = useState(false)
  const [uploadingPacked, setUploadingPacked] = useState(false)
  const [packedPreview, setPackedPreview] = useState([])
  const [confirming, setConfirming] = useState(false)
  const [shipText, setShipText] = useState('')
  const [trackingInput, setTrackingInput] = useState('')
  const [courierInput, setCourierInput] = useState('')
  const [editingTracking, setEditingTracking] = useState(false)
  const [uploadingDelivered, setUploadingDelivered] = useState(false)
  const [actionStatus, setActionStatus] = useState('')

  if (authLoading) return null
  if (!user) return <AdminLogin />

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

  const handlePackedUpload = async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    setUploadingPacked(true)
    try {
      const results = await Promise.all(files.map((f) => uploadToCloudinary(f, 'image')))
      setPackedPreview((prev) => [...prev, ...results.map((r) => r.url)])
    } catch (err) {
      setActionStatus('อัพโหลดไม่สำเร็จ: ' + err.message)
    } finally {
      setUploadingPacked(false)
      e.target.value = ''
    }
  }

  const handleConfirmPacked = async () => {
    if (packedPreview.length === 0) { setActionStatus('กรุณาอัพโหลดรูปสินค้าที่แพ็คก่อน'); return }
    setConfirming(true)
    try {
      await confirmPackedAndShip(order.id, packedPreview, trackingInput, courierInput)
      notifyLineOrderStatus(order, 'shipping', { trackingNumber: trackingInput })
    }
    catch (err) { setActionStatus('เกิดข้อผิดพลาด: ' + err.message) }
    finally { setConfirming(false) }
  }

  // แก้/เพิ่มเลขพัสดุภายหลัง (ตอน shipping) — เผื่อไม่มีเลขตอนแพ็ค พึ่งได้จากขนส่งทีหลัง
  const handleSaveTracking = async () => {
    setConfirming(true)
    try { await setTrackingNumber(order.id, trackingInput, courierInput); setEditingTracking(false) }
    catch (err) { setActionStatus('เกิดข้อผิดพลาด: ' + err.message) }
    finally { setConfirming(false) }
  }

  const handleConfirmPayment = async () => {
    setConfirming(true)
    try {
      await confirmPayment(order.id)
      notifyLineOrderStatus(order, 'payment_confirmed')
    }
    catch (err) { setActionStatus('เกิดข้อผิดพลาด: ' + err.message) }
    finally { setConfirming(false) }
  }

  // อัปเดตสถานะจัดส่ง — รับข้อความตรงๆ (ใช้ทั้งจากชิปสถานะสำเร็จรูปและช่องพิมพ์เอง)
  const submitShipUpdate = async (text) => {
    if (!text.trim()) return
    setConfirming(true)
    try {
      await addShippingUpdate(order.id, text.trim())
      notifyLineOrderStatus(order, 'shipping_update', { text: text.trim() })
      setShipText('')
    }
    catch (err) { setActionStatus('เกิดข้อผิดพลาด: ' + err.message) }
    finally { setConfirming(false) }
  }
  const handleAddShipUpdate = () => submitShipUpdate(shipText)

  const handleConfirmDelivered = async () => {
    setConfirming(true)
    try {
      await confirmDelivered(order.id)
      notifyLineOrderStatus(order, 'delivered')
    }
    catch (err) { setActionStatus('เกิดข้อผิดพลาด: ' + err.message) }
    finally { setConfirming(false) }
  }

  // แนบรูปหลังส่งพัสดุแล้ว (เช่น รูปหน้าบ้านลูกค้า/ใบเซ็นรับ) — อัพโหลดแล้วบันทึกทันที ไม่ต้องกดยืนยันซ้ำ
  const handleDeliveredUpload = async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    setUploadingDelivered(true)
    try {
      const results = await Promise.all(files.map((f) => uploadToCloudinary(f, 'image')))
      await addDeliveredImages(order.id, results.map((r) => r.url))
    } catch (err) {
      setActionStatus('อัพโหลดไม่สำเร็จ: ' + err.message)
    } finally {
      setUploadingDelivered(false)
      e.target.value = ''
    }
  }

  return (<VolunteerGuard>
    <main className="admin-dash admin-shop-wide">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <a href="/admin/shop/orders" className="shop-detail-back">
              <FontAwesomeIcon icon={faArrowLeft} /> กลับไปรายการคำสั่งซื้อ
            </a>
            <h1 style={{ marginTop: 8 }}>คำสั่งซื้อ {order?.orderCode || ''}</h1>
            {order && <p style={{ color: order.status === 'pending_payment' && order.paymentDeclaredAt ? '#dc2626' : 'var(--ink-soft)', fontWeight: 600 }}>{adminStatusLabel(order)}</p>}
          </div>
        </div>

        {loading && <p>กำลังโหลดข้อมูล...</p>}
        {!loading && (error || !order) && <p style={{ color: '#dc2626' }}>ไม่พบคำสั่งซื้อนี้</p>}

        {!loading && order && (
          <div style={{ maxWidth: 760 }}>
            <Stepper status={order.status} />

            {actionStatus && (
              <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '.88rem' }}>
                {actionStatus}
              </div>
            )}

            {priceMismatches.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: '.88rem' }}>
                <strong>⚠️ ราคาในออเดอร์ไม่ตรงกับราคาสินค้าปัจจุบัน</strong> — ตรวจยอดโอนให้ดีก่อนยืนยันรับเงิน
                <ul style={{ margin: '6px 0 0 18px' }}>
                  {priceMismatches.map((m, i) => (
                    <li key={i}>{m.name}: ในออเดอร์ ฿{m.orderPrice.toLocaleString('th-TH')} / ราคาปัจจุบัน ฿{m.currentPrice.toLocaleString('th-TH')}</li>
                  ))}
                </ul>
              </div>
            )}

            <OrderItemsCard order={order} />
            <CustomerInfoCard order={order} />

            {/* ── สถานะที่ 1: รอการชำระเงิน ── */}
            {order.status === 'pending_payment' && (
              <div className="admin-card" style={{ marginBottom: 20 }}>
                <h4>การชำระเงิน</h4>
                {order.paymentProofUrl ? (
                  <div style={{ marginBottom: 12 }}>
                    <img src={order.paymentProofUrl} alt="หลักฐานการชำระเงิน" style={{ maxWidth: 280, borderRadius: 10, display: 'block' }} />
                    <p style={{ color: '#15803d', fontSize: '.88rem', marginTop: 6 }}><FontAwesomeIcon icon={faCheck} /> อัพโหลดหลักฐานแล้ว รอตรวจสอบ</p>
                  </div>
                ) : (
                  <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem' }}>ลูกค้ายังไม่ได้อัพโหลดหลักฐานการโอน</p>
                )}
                {order.paymentDeclaredAt && (
                  <p style={{ color: '#dc2626', fontSize: '.88rem', fontWeight: 700, marginTop: 6 }}>
                    <FontAwesomeIcon icon={faCheck} /> ลูกค้ากดแจ้งชำระเงินแล้วเมื่อ {order.paymentDeclaredAt}
                  </p>
                )}
                {/* สตาฟอัพหลักฐานแทนลูกค้าได้ — เช่นลูกค้าส่งสลิปมาทาง LINE แล้วแนบเข้าระบบเอง */}
                <UploadButton
                  label={order.paymentProofUrl ? 'อัพโหลดหลักฐานใหม่ (แทนที่รูปเดิม)' : 'อัพโหลดหลักฐานการชำระเงิน'}
                  uploading={uploadingProof}
                  onFiles={handleProofUpload}
                />
                <button className="admin-btn-primary" style={{ marginTop: 12, display: 'block' }} onClick={handleConfirmPayment} disabled={!order.paymentProofUrl || confirming}>
                  {confirming ? 'กำลังยืนยัน...' : 'ยืนยันการชำระเงิน'}
                </button>
              </div>
            )}

            {/* ── สถานะที่ 2: เตรียมการจัดส่ง ── */}
            {order.status === 'preparing' && (
              <div className="admin-card" style={{ marginBottom: 20 }}>
                <h4>เตรียมการจัดส่ง</h4>
                <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem' }}>อัพโหลดรูปสินค้าที่แพ็คแล้ว จากนั้นกดยืนยันการจัดส่ง</p>
                {packedPreview.length > 0 && (
                  <div className="admin-media-preview" style={{ marginBottom: 10 }}>
                    {packedPreview.map((url, i) => (
                      <div key={i} className="admin-media-thumb"><img src={url} alt="" /></div>
                    ))}
                  </div>
                )}
                <UploadButton label="อัพโหลดรูปสินค้าที่แพ็ค" multiple uploading={uploadingPacked} onFiles={handlePackedUpload} />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                  <label style={{ display: 'block', flex: '1 1 200px', fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>
                    เลขพัสดุ (ไม่บังคับ — ใส่ทีหลังได้)
                    <input
                      type="text"
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value)}
                      placeholder="เช่น TH0123456789"
                      style={{ display: 'block', width: '100%', marginTop: 6, fontWeight: 400, boxSizing: 'border-box' }}
                    />
                  </label>
                  <label style={{ display: 'block', flex: '1 1 160px', fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)' }}>
                    ขนส่ง
                    <select value={courierInput} onChange={(e) => setCourierInput(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 6, fontWeight: 400 }}>
                      <option value="">— เลือกขนส่ง —</option>
                      {COURIERS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </label>
                </div>
                <button className="admin-btn-primary" style={{ marginTop: 12, display: 'block' }} onClick={handleConfirmPacked} disabled={confirming}>
                  {confirming ? 'กำลังยืนยัน...' : 'ยืนยันการจัดส่ง'}
                </button>
              </div>
            )}

            {/* ── สถานะที่ 3: กำลังจัดส่ง ── */}
            {order.status === 'shipping' && (
              <div className="admin-card" style={{ marginBottom: 20 }}>
                <h4>กำลังจัดส่ง</h4>
                <div style={{ marginBottom: 14 }}>
                  {editingTracking ? (
                    <div className="admin-inline-row">
                      <input type="text" value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} placeholder="เช่น TH0123456789" />
                      <select value={courierInput} onChange={(e) => setCourierInput(e.target.value)}>
                        <option value="">— เลือกขนส่ง —</option>
                        {COURIERS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                      <button className="admin-btn-primary" onClick={handleSaveTracking} disabled={confirming}>บันทึก</button>
                    </div>
                  ) : (
                    <p style={{ fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span><strong>เลขพัสดุ:</strong> {order.trackingNumber || <span style={{ color: 'var(--ink-soft)' }}>ยังไม่มี</span>}</span>
                      <button className="admin-btn" style={{ fontSize: '.78rem', padding: '3px 10px' }} onClick={() => { setTrackingInput(order.trackingNumber || ''); setCourierInput(order.courier || ''); setEditingTracking(true) }}>
                        {order.trackingNumber ? 'แก้ไข' : 'เพิ่มเลขพัสดุ'}
                      </button>
                      {order.trackingNumber && (
                        <a className="admin-btn" style={{ fontSize: '.78rem', padding: '3px 10px' }} href={trackingUrl(order.trackingNumber, order.courier)} target="_blank" rel="noopener noreferrer">
                          <FontAwesomeIcon icon={faLocationDot} /> ติดตามพัสดุ
                        </a>
                      )}
                    </p>
                  )}
                </div>
                {order.packedImages?.length > 0 && (
                  <div className="admin-media-preview" style={{ marginBottom: 14 }}>
                    {order.packedImages.map((url, i) => (
                      <div key={i} className="admin-media-thumb"><img src={url} alt="สินค้าที่แพ็ค" /></div>
                    ))}
                  </div>
                )}
                {order.shippingUpdates?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    {[...order.shippingUpdates].reverse().map((u, i) => (
                      <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: '.9rem' }}>
                        <div>{u.text}</div>
                        <div style={{ color: 'var(--ink-soft)', fontSize: '.78rem' }}>{u.at}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="ship-chip-wrap">
                  {SHIP_STATUS_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="ship-status-chip"
                      onClick={() => submitShipUpdate(preset)}
                      disabled={confirming}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="admin-inline-row" style={{ marginBottom: 10 }}>
                  <input type="text" value={shipText} onChange={(e) => setShipText(e.target.value)} placeholder="หรือพิมพ์สถานะเอง" />
                  <button className="admin-btn" onClick={handleAddShipUpdate} disabled={confirming}>อัปเดต</button>
                </div>
                <button className="admin-btn-primary" onClick={handleConfirmDelivered} disabled={confirming}>
                  {confirming ? 'กำลังยืนยัน...' : 'ยืนยันจัดส่งเรียบร้อย'}
                </button>
              </div>
            )}

            {/* ── สถานะที่ 4: จัดส่งเรียบร้อย ── */}
            {order.status === 'delivered' && (
              <div className="admin-card" style={{ marginBottom: 20 }}>
                <h4>{STATUS_LABEL.delivered}</h4>
                <p style={{ color: '#15803d' }}><FontAwesomeIcon icon={faCheck} /> ได้รับสินค้าเมื่อ {order.deliveredAt}</p>
                {order.trackingNumber && (
                  <p style={{ fontSize: '.9rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span><strong>เลขพัสดุ:</strong> {order.trackingNumber}</span>
                    <a className="admin-btn" style={{ fontSize: '.78rem', padding: '3px 10px' }} href={trackingUrl(order.trackingNumber, order.courier)} target="_blank" rel="noopener noreferrer">
                      <FontAwesomeIcon icon={faLocationDot} /> ติดตามพัสดุ
                    </a>
                  </p>
                )}

                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>รูปหลังส่งพัสดุแล้ว (เช่น รูปหน้าบ้านลูกค้า/ใบเซ็นรับ)</p>
                  {order.deliveredImages?.length > 0 && (
                    <div className="admin-media-preview" style={{ marginBottom: 10 }}>
                      {order.deliveredImages.map((url, i) => (
                        <div key={i} className="admin-media-thumb"><img src={url} alt="รูปหลังส่งพัสดุ" /></div>
                      ))}
                    </div>
                  )}
                  <UploadButton label="อัพโหลดรูปหลังส่งพัสดุ" multiple uploading={uploadingDelivered} onFiles={handleDeliveredUpload} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  </VolunteerGuard>)
}
