import { useState } from 'react'
import { ACCOUNTS } from '../data/accounts.js'
import { useCartCount } from '../data/cart.js'
import { useNavigate } from '../navContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCartShopping } from '@fortawesome/free-solid-svg-icons'

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false)
  // แสดง "คัดลอกแล้ว" เฉพาะเมื่อคัดลอกสำเร็จจริง — กันหลอกผู้บริจาคว่าคัดลอกได้ทั้งที่คลิปบอร์ดยังเป็นค่าเก่า
  const copy = () => {
    const clean = text.replace(/\s/g, '')
    const onSuccess = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    const fallback = () => {
      const el = document.createElement('textarea')
      el.value = clean; el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el); el.select()
      let ok = false
      try { ok = document.execCommand('copy') } catch (_) { /* noop */ }
      document.body.removeChild(el)
      if (ok) onSuccess()
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clean).then(onSuccess).catch(fallback)
    } else {
      fallback()
    }
  }
  return (
    <button className="fd-acc" onClick={copy}>
      <div className="fd-acc-name">{label}</div>
      <div className="fd-acc-num">{text}</div>
      <div className="fd-acc-copy">{copied ? '✓ คัดลอกแล้ว' : 'คัดลอก'}</div>
    </button>
  )
}

export default function FloatingDonate({ hidden }) {
  const [open, setOpen] = useState(false)
  const cartCount = useCartCount()
  const go = useNavigate()

  // หน้ารายละเอียดสินค้ามีแถบล่างของตัวเองอยู่แล้ว (แชท LINE / เพิ่มตะกร้า / ราคา) — ไม่ต้องมีปุ่มลอยซ้ำ
  if (hidden) return null

  // ตอนมีสินค้าอยู่ในตะกร้า ปุ่มลอยกลายเป็นปุ่มไปหน้าตะกร้าแทนปุ่มบริจาค
  if (cartCount > 0) {
    return (
      <button className="fd-fab fd-fab-cart" onClick={() => go('shop-cart')} aria-label="ตะกร้าสินค้า">
        <FontAwesomeIcon icon={faCartShopping} />  {cartCount}
      </button>
    )
  }

  return (
    <>
      <button className="fd-fab" onClick={() => setOpen(true)} aria-label="บริจาค">
      บริจาค
      </button>

      {open && (
        <>
          <div className="fd-overlay" onClick={() => setOpen(false)} />
          <div className="fd-popup">
            <button className="fd-close" onClick={() => setOpen(false)}>×</button>
            <h3>ร่วมบริจาค</h3>
            <p>ธนาคารอิสลามแห่งประเทศไทย (ibank)</p>
            <div className="fd-list">
              {ACCOUNTS.map((a) => (
                <CopyBtn key={a.acc} text={a.acc} label={`${a.icon} ${a.name}`} />
              ))}
            </div>
            <a href="/donation" className="fd-more" onClick={() => setOpen(false)}>ดูรายละเอียดเพิ่มเติม →</a>
          </div>
        </>
      )}
    </>
  )
}
