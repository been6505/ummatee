import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faSpinner, faImage, faCartShopping, faCamera } from '@fortawesome/free-solid-svg-icons'
import { STATUS_STEPS, STATUS_LABEL_SHORT, stepIndex } from '../data/orders.js'

// ชิ้นส่วน UI ที่ใช้ร่วมกันระหว่างหน้าติดตามคำสั่งซื้อของลูกค้า (ShopOrderStatus)
// และหน้าจัดการคำสั่งซื้อของแอดมิน (AdminShopOrderDetail)

import { optImg } from '../utils/cloudinaryUrl.js'
export const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

// รายชื่อขนส่งที่ใช้บ่อยในไทย — ลิงก์ตรงไปหน้าติดตามของแต่ละเจ้า (แม่นยำกว่าเดาจากรูปแบบเลขพัสดุ)
export const COURIERS = [
  { key: 'thailandpost', label: 'ไปรษณีย์ไทย (EMS/ลงทะเบียน)', url: (code) => `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(code)}` },
  { key: 'kerry', label: 'KEX', url: (code) => `https://th.kerryexpress.com/th/track/?track=${encodeURIComponent(code)}` },
  { key: 'flash', label: 'Flash Express', url: (code) => `https://www.flashexpress.com/tracking/?se=${encodeURIComponent(code)}` },
  { key: 'jt', label: 'J&T Express', url: (code) => `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${encodeURIComponent(code)}` },
  { key: 'ninjavan', label: 'Ninja Van', url: (code) => `https://www.ninjavan.co/th-th/tracking?id=${encodeURIComponent(code)}` },
  { key: 'spx', label: 'SPX Express (Shopee)', url: (code) => `https://spx.co.th/th/track?${new URLSearchParams({ sls_tracking_number: code })}` },
]

// ลิงก์ติดตามพัสดุ — ถ้ารู้ขนส่งให้ไปหน้าติดตามของเจ้านั้นตรงๆ ถ้าไม่รู้ (ออเดอร์เก่าก่อนมีช่องเลือกขนส่ง) fallback ไป 17TRACK ที่เดาขนส่งจากรูปแบบเลขพัสดุ
/** ชื่อขนส่งสำหรับแสดงผล — ไม่รู้ว่าเจ้าไหนก็บอกกลางๆ ดีกว่าโชว์คีย์ดิบหรือช่องว่าง */
export const courierLabel = (courierKey) =>
  (COURIERS.find((c) => c.key === courierKey) || {}).label || 'พัสดุของคุณ'

export const trackingUrl = (code, courierKey) => {
  const trimmed = code.trim()
  const courier = COURIERS.find((c) => c.key === courierKey)
  if (courier) return courier.url(trimmed)
  return `https://t.17track.net/en#nums=${encodeURIComponent(trimmed)}`
}

const STEP_ICONS = ['1', '2', '3']

export function Stepper({ status }) {
  const idx = stepIndex(status)
  return (
    <div className="order-stepper">
      {STATUS_STEPS.map((s, i) => (
        <div key={s} className={`order-step ${i <= idx ? 'done' : ''} ${i === idx ? 'active' : ''}`}>
          <div className="order-step-dot">{i < idx ? <FontAwesomeIcon icon={faCheck} /> : STEP_ICONS[i]}</div>
          <div className="order-step-label">{STATUS_LABEL_SHORT[s]}</div>
        </div>
      ))}
    </div>
  )
}

// ปุ่มอัพโหลดรูป — มี 2 ตัวเลือก: เลือกจากคลังรูปภาพ / ถ่ายภาพด้วยกล้องโดยตรง (capture="environment" เปิดกล้องหลังทันทีบนมือถือ)
// จัดเป็น grid 2 คอลัมน์แถวเดียวเสมอ (ไม่ใช้ flex-wrap ที่จะตกบรรทัดเมื่อ label ยาวเกินความกว้างจอ)
export function UploadButton({ label, multiple, uploading, onFiles }) {
  return (
    <div className="upload-btn-row">
      <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
        <FontAwesomeIcon icon={uploading ? faSpinner : faImage} spin={uploading} />
        {uploading ? ' กำลังอัพโหลด...' : ` ${label}`}
        <input type="file" accept="image/*,.heic,.heif,.cr2,.cr3,.nef,.arw,.raf,.rw2,.dng,.orf,.sr2,.raw" multiple={multiple} hidden onChange={onFiles} />
      </label>
      <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }} title="ถ่ายภาพด้วยกล้อง">
        <FontAwesomeIcon icon={faCamera} />
        {' ถ่ายภาพ'}
        <input type="file" accept="image/*,.heic,.heif,.cr2,.cr3,.nef,.arw,.raf,.rw2,.dng,.orf,.sr2,.raw" capture="environment" hidden onChange={onFiles} />
      </label>
    </div>
  )
}

// ตารางสรุปรายการสินค้า + ยอดเงิน — ใช้ทั้งหน้าลูกค้าและแอดมิน
export function OrderItemsCard({ order }) {
  return (
    <div className="admin-card" style={{ marginBottom: 20 }}>
      <h4>รายการสินค้า</h4>
      <div>
        {order.items.map((i, idx) => (
          <div key={idx} className="order-item-row">
            {i.image
              ? <img src={optImg(i.image, 160)} alt={i.name} className="order-item-img" />
              : <div className="order-item-img order-item-img-ph"><FontAwesomeIcon icon={faCartShopping} /></div>}
            <div className="order-item-mid">
              <div className="order-item-name">{i.name}</div>
              {(i.colors || i.sizes) && (
                <div className="order-item-variant">
                  {[i.colors && `สี: ${i.colors}`, i.sizes && `ขนาด: ${i.sizes}`].filter(Boolean).join(' · ')}
                </div>
              )}
              <div className="order-item-unit">{THB(i.price)}</div>
            </div>
            <div className="order-item-right">
              <span className="order-item-qty">x{i.qty}</span>
              <span className="order-item-total">{THB(i.price * i.qty)}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="cart-summary-row"><span>ราคาสินค้ารวม</span><span>{THB(order.itemsTotal)}</span></div>
        <div className="cart-summary-row"><span>ค่าจัดส่ง</span><span>{THB(order.shippingFee)}</span></div>
        <div className="cart-summary-row cart-summary-total"><span>ยอดชำระทั้งหมด</span><span>{THB(order.total)}</span></div>
      </div>
    </div>
  )
}

export function CustomerInfoCard({ order }) {
  return (
    <div className="admin-card" style={{ marginBottom: 20 }}>
      <h4>ข้อมูลลูกค้า</h4>
      <p style={{ margin: '4px 0' }}>{order.customer.fullName} · {order.customer.phone}</p>
      {order.customer.email && <p style={{ margin: '4px 0', color: 'var(--ink-soft)' }}>{order.customer.email}</p>}
      <p style={{ margin: '4px 0', color: 'var(--ink-soft)' }}>{order.customer.address}</p>
    </div>
  )
}
