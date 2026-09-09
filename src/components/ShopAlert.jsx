import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'

// กล่องแจ้งเตือนกลางจอของฝั่งร้านค้า
//
// ทำไมต้องเป็นกลางจอ: ปุ่มหลักของหน้าร้าน ("เพิ่มลงตะกร้า" / "ยืนยันข้อมูล" / "ยืนยันคำสั่งซื้อ")
// อยู่ในแถบล่างที่ลอยติดจอ (.shop-detail-bar) แต่ข้อความเตือนแบบเดิมเป็นตัวแดงเล็กๆ ในเนื้อหน้า
// ซึ่งอาจอยู่นอกจอตอนที่ผู้ใช้กดปุ่ม ⇒ กดแล้วเหมือนปุ่มไม่ทำงาน
// z-index ของ .shop-alert-overlay สูงกว่าแถบล่าง (500) จึงไม่โดนทับ
export default function ShopAlert({ message, title = 'ยังเลือกไม่ครบ', okLabel = 'ตกลง', onClose }) {
  if (!message) return null
  return (
    <div className="shop-alert-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="shop-alert" onClick={(e) => e.stopPropagation()}>
        <div className="shop-alert-icon"><FontAwesomeIcon icon={faTriangleExclamation} /></div>
        <h3>{title}</h3>
        <p>{message}</p>
        <button type="button" className="shop-alert-btn" onClick={onClose} autoFocus>{okLabel}</button>
      </div>
    </div>
  )
}
