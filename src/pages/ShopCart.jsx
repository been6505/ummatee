import { useCart, setItemQty, removeFromCart } from '../data/cart.js'
import { useNavigate } from '../navContext'
import Footer from '../components/Footer.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMinus, faPlus, faTrash, faCartShopping, faArrowLeft, faComments } from '@fortawesome/free-solid-svg-icons'

// หน้าตะกร้าสินค้า (/um-shop/cart) — แสดงรายการที่เพิ่มไว้ ปรับจำนวน/ลบได้ พร้อมราคารวม แล้วไปหน้ายืนยันการสั่งซื้อ
import { optImg } from '../utils/cloudinaryUrl.js'
const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

// เปิดวิดเจ็ตแชทหน้าเว็บ (ChatWidget.jsx mount อยู่ที่ App.jsx) ผ่าน custom event — เหมือนปุ่มแชทหน้ารายละเอียดสินค้า
const openChat = () => window.dispatchEvent(new Event('ummatee-open-chat'))

export default function ShopCart() {
  const items = useCart()
  const go = useNavigate()

  const total = items.reduce((s, i) => s + i.price * i.qty, 0)

  return (
    <>
    <main className="page shop-cart-page">
      <section className="page-band">
        <div className="fc-pattern hero-pattern"></div>
        <div className="inner">
          <span className="badge"><FontAwesomeIcon icon={faCartShopping} /> ตะกร้าสินค้า</span>
          <h1>ตะกร้าของคุณ</h1>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <a href="/um-shop" onClick={(e) => { e.preventDefault(); go('shop') }} className="shop-detail-back">
            <FontAwesomeIcon icon={faArrowLeft} /> เลือกซื้อสินค้าเพิ่ม
          </a>

          {items.length === 0 ? (
            <div className="shop-empty">
              <FontAwesomeIcon icon={faCartShopping} className="shop-empty-icon" />
              <p className="shop-empty-text">ยังไม่มีสินค้าในตะกร้า</p>
              <button type="button" className="shop-empty-btn" onClick={() => go('shop')}>เลือกซื้อสินค้า</button>
            </div>
          ) : (
            <div className="cart-layout">
              <div className="cart-items">
                {items.map((i) => (
                  <div key={i.id} className="cart-row">
                    <div className="cart-row-img">
                      {i.image ? <img src={optImg(i.image, 220)} alt={i.name} /> : <div className="shop-img-ph"><FontAwesomeIcon icon={faCartShopping} /></div>}
                    </div>
                    <div className="cart-row-info">
                      <div className="cart-row-name">{i.name}</div>
                      {(i.colors || i.sizes) && (
                        <div className="order-item-variant">
                          {[i.colors && `สี: ${i.colors}`, i.sizes && `ขนาด: ${i.sizes}`].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      <div className="cart-row-price">{THB(i.price)}</div>
                    </div>
                    <div className="shop-qty-stepper">
                      <button type="button" onClick={() => setItemQty(i.id, i.qty - 1)} aria-label="ลดจำนวน"><FontAwesomeIcon icon={faMinus} /></button>
                      <span>{i.qty}</span>
                      <button type="button" onClick={() => setItemQty(i.id, i.qty + 1)} aria-label="เพิ่มจำนวน"><FontAwesomeIcon icon={faPlus} /></button>
                    </div>
                    <div className="cart-row-subtotal">{THB(i.price * i.qty)}</div>
                    <button type="button" className="cart-row-remove" onClick={() => removeFromCart(i.id)} aria-label="ลบสินค้า">
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>

    {/* แถบราคารวม/สั่งซื้อลอยติดขอบล่างจอ (แชท / ราคารวม / สั่งซื้อ) — เหมือนแถบล่างหน้ารายละเอียดสินค้า
        อยู่นอก <main className="page"> โดยตั้งใจเหมือนกัน กัน .page transform ค้างทำให้ position:fixed เพี้ยน */}
    {items.length > 0 && (
      <div className="shop-detail-bar shop-cart-bar">
        <button type="button" onClick={openChat} className="shop-detail-bar-line" aria-label="แชท">
          <FontAwesomeIcon icon={faComments} />
          <span>แชท</span>
        </button>
        <div className="shop-detail-bar-price">
          <span className="cart-bar-total-label">ราคารวม</span>
          <span className="shop-detail-bar-price-now">{THB(total)}</span>
        </div>
        <button type="button" className="shop-detail-bar-cart" onClick={() => go('shop-checkout')}>
          ทำการสั่งซื้อ
        </button>
      </div>
    )}
    </>
  )
}
