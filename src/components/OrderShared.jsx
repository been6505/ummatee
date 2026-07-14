import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faSpinner, faImage, faCartShopping } from '@fortawesome/free-solid-svg-icons'
import { STATUS_STEPS, STATUS_LABEL, stepIndex } from '../data/orders.js'

// ชิ้นส่วน UI ที่ใช้ร่วมกันระหว่างหน้าติดตามคำสั่งซื้อของลูกค้า (ShopOrderStatus)
// และหน้าจัดการคำสั่งซื้อของแอดมิน (AdminShopOrderDetail)

import { optImg } from '../utils/cloudinaryUrl.js'
export const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

const STEP_ICONS = ['1', '2', '3', '4']

export function Stepper({ status }) {
  const idx = stepIndex(status)
  return (
    <div className="order-stepper">
      {STATUS_STEPS.map((s, i) => (
        <div key={s} className={`order-step ${i <= idx ? 'done' : ''} ${i === idx ? 'active' : ''}`}>
          <div className="order-step-dot">{i < idx ? <FontAwesomeIcon icon={faCheck} /> : STEP_ICONS[i]}</div>
          <div className="order-step-label">{STATUS_LABEL[s]}</div>
        </div>
      ))}
    </div>
  )
}

export function UploadButton({ label, multiple, uploading, onFiles }) {
  return (
    <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
      <FontAwesomeIcon icon={uploading ? faSpinner : faImage} spin={uploading} />
      {uploading ? ' กำลังอัพโหลด...' : ` ${label}`}
      <input type="file" accept="image/*" multiple={multiple} hidden onChange={onFiles} />
    </label>
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
      <p style={{ margin: '4px 0' }}>{order.customer.firstName} {order.customer.lastName} · {order.customer.phone}</p>
      {order.customer.email && <p style={{ margin: '4px 0', color: 'var(--ink-soft)' }}>{order.customer.email}</p>}
      <p style={{ margin: '4px 0', color: 'var(--ink-soft)' }}>{order.customer.address}</p>
    </div>
  )
}
