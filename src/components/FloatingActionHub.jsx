import { useEffect, useState } from 'react'
import { useCartCount } from '../data/cart.js'
import { useNavigate } from '../navContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComments, faHandHoldingHeart, faCartShopping, faXmark } from '@fortawesome/free-solid-svg-icons'

const ICONS = { donate: faHandHoldingHeart, chat: faComments, cart: faCartShopping }
const LABELS = { donate: 'บริจาค', chat: 'แชท', cart: 'ตะกร้าสินค้า' }

// ปุ่มลอยรวมเดียว (บริจาค/แชท/ตะกร้า) — วงกลมขนาดเท่าปุ่มแชทเดิม สลับไอคอนที่โชว์แบบ fade
// ระหว่างตัวเลือกที่มีอยู่ กดแล้วเปิดเมนูเล็กๆ ให้เลือกว่าจะทำอะไร (ไม่ใช่กดแล้วเปิดสิ่งที่โชว์อยู่ตรงๆ)
// includeDonate=false ใช้ตอนหน้าร้าน (/um-shop) ที่ตั้งใจซ่อนปุ่มบริจาคไปแล้วตามที่เคยขอไว้ก่อนหน้า
export default function FloatingActionHub({ includeDonate = true }) {
  const cartCount = useCartCount()
  const go = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const actions = [
    ...(includeDonate ? ['donate'] : []),
    'chat',
    ...(cartCount > 0 ? ['cart'] : []),
  ]

  const cartIdx = actions.indexOf('cart')
  const hasCart = cartIdx !== -1

  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (idx >= actions.length) setIdx(0)
  }, [actions.length, idx])

  // มีของในตะกร้าแล้ว — ปักหมุดไอคอนตะกร้าค้างไว้เลย ไม่ต้องสลับต่อ (กันลูกค้าลืมว่ามีของค้างอยู่)
  useEffect(() => {
    if (hasCart) setIdx(cartIdx)
  }, [hasCart, cartIdx])

  useEffect(() => {
    if (actions.length < 2 || menuOpen || hasCart) return
    const id = setInterval(() => setIdx((i) => (i + 1) % actions.length), 2800)
    return () => clearInterval(id)
  }, [actions.length, menuOpen, hasCart])

  const runAction = (action) => {
    setMenuOpen(false)
    if (action === 'donate') window.dispatchEvent(new Event('ummatee-open-donate'))
    else if (action === 'chat') window.dispatchEvent(new Event('ummatee-open-chat'))
    else if (action === 'cart') go('shop-cart')
  }

  return (
    <>
      <button className="fab-hub" onClick={() => setMenuOpen((v) => !v)} aria-label="เมนูด่วน">
        {menuOpen ? <FontAwesomeIcon icon={faXmark} /> : actions.map((a, i) => (
          <FontAwesomeIcon key={a} icon={ICONS[a]} className={`fab-hub-icon${i === idx ? ' active' : ''}`} />
        ))}
        {actions.includes('cart') && !menuOpen && <span className="fab-hub-badge">{cartCount}</span>}
      </button>

      {menuOpen && (
        <>
          <div className="fab-hub-overlay" onClick={() => setMenuOpen(false)} />
          <div className="fab-hub-menu">
            {actions.map((a) => (
              <button key={a} className="fab-hub-menu-item" onClick={() => runAction(a)}>
                <FontAwesomeIcon icon={ICONS[a]} />
                <span>{LABELS[a]}{a === 'cart' ? ` (${cartCount})` : ''}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
