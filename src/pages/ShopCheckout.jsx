import { useState } from 'react'
import { useCart, clearCart, updateCartPrices } from '../data/cart.js'
import { createOrder, getShippingFee } from '../data/orders.js'
import { notifyAdminNewOrder } from '../utils/lineNotify.js'
import { formatPhone } from '../utils/formatPhone.js'
import { useNavigate } from '../navContext'
import Footer from '../components/Footer.jsx'
import ShopAlert from '../components/ShopAlert.jsx'
import InAppBrowserWarning from '../components/InAppBrowserWarning.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCartShopping, faCheck, faUserPen, faComments } from '@fortawesome/free-solid-svg-icons'
import { faGoogle, faLine } from '@fortawesome/free-brands-svg-icons'
import { THAILAND_PROVINCES, getAmphoes, getDistricts, getZipcode, isBangkok } from '../data/thailandAddress.js'

// เปิดวิดเจ็ตแชทหน้าเว็บ (ChatWidget.jsx mount อยู่ที่ App.jsx) ผ่าน custom event — เหมือนหน้าอื่นๆ ในร้าน
const openChat = () => window.dispatchEvent(new Event('ummatee-open-chat'))

// หน้ายืนยันการสั่งซื้อ (/um-shop/checkout) — ขั้นแรกให้ลงทะเบียน (กรอกเอง / Google / LINE)
// แล้วค่อยกรอกที่อยู่ กด "ยืนยันข้อมูล" จึงแสดงค่าจัดส่ง + ปุ่มยืนยันคำสั่งซื้อจริง
import { optImg } from '../utils/cloudinaryUrl.js'
const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')
const EMPTY = { fullName: '', phone: '', email: '', address: '', province: '', amphoe: '', district: '', postalCode: '' }

// ปุ่มลงทะเบียนด้วย LINE/Google — ซ่อนไว้จนกว่าจะตั้งค่า provider ใน Firebase Console เสร็จ
// เปิดใช้: เปลี่ยนเป็น true อย่างเดียว (โค้ด sign-in พร้อมอยู่แล้ว)
const SOCIAL_LOGIN_ENABLED = false

const CUSTOMER_KEY = 'umShopCustomer' // จำข้อมูลลูกค้าไว้ในเครื่อง สั่งซื้อครั้งหน้าไม่ต้องกรอกใหม่

function savedCustomer() {
  try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || 'null') } catch { return null }
}

// ล็อกอินผ่าน Firebase Auth แล้วคืนข้อมูลไว้เติมฟอร์ม — โหลด firebase/auth แบบ dynamic
// (ลูกค้าที่กรอกเองไม่ต้องเสียเวลาโหลด auth SDK)
async function socialSignIn(providerKey) {
  const [{ auth }, { GoogleAuthProvider, OAuthProvider, signInWithPopup }] =
    await Promise.all([import('../firebase.js'), import('firebase/auth')])
  // LINE ใช้ผ่าน OIDC provider ของ Firebase (ตั้งค่า LINE Login channel ใน Firebase Console → Authentication → Sign-in method)
  const provider = providerKey === 'google' ? new GoogleAuthProvider() : new OAuthProvider('oidc.line')
  const result = await signInWithPopup(auth, provider)
  const u = result.user
  // เก็บ LINE userId ไว้ในข้อมูลลูกค้า — ใช้ส่งแจ้งเตือนสถานะออเดอร์ผ่าน LINE OA ภายหลัง
  const lineUserId = providerKey === 'line'
    ? (u.providerData.find((p) => p.providerId === 'oidc.line')?.uid || '')
    : ''
  return {
    fullName: (u.displayName || '').trim(),
    email: u.email || '',
    phone: u.phoneNumber || '',
    lineUserId,
  }
}

export default function ShopCheckout() {
  const items = useCart()
  const go = useNavigate()

  // ลูกค้าเก่าที่เคยลงทะเบียนแล้ว ข้ามขั้นเลือกวิธีลงทะเบียนไปกรอก/เช็คข้อมูลได้เลย
  // ข้อมูลเก่าใน localStorage (ก่อนรวมช่องชื่อ-นามสกุล) อาจมีแค่ firstName/lastName แยกกัน — รวมเป็น fullName ให้อัตโนมัติ
  const [form, setForm] = useState(() => {
    const saved = savedCustomer() || {}
    const legacyFullName = !saved.fullName && (saved.firstName || saved.lastName)
      ? `${saved.firstName || ''} ${saved.lastName || ''}`.trim()
      : undefined
    return { ...EMPTY, ...saved, ...(legacyFullName ? { fullName: legacyFullName } : {}) }
  })
  const [registered, setRegistered] = useState(() => !SOCIAL_LOGIN_ENABLED || !!savedCustomer())
  const [infoConfirmed, setInfoConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signingIn, setSigningIn] = useState('')

  const itemsTotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const shippingFee = getShippingFee()

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // เลือกจังหวัด/อำเภอ-เขต ใหม่ ต้องล้างตัวเลือกที่อยู่ล่างลงไปด้วย (เดิมอาจเลือกไว้แล้วแต่ไม่ตรงกับตัวเลือกใหม่) — รหัสไปรษณีย์เติมอัตโนมัติตอนเลือกตำบล/แขวงครบ
  const setProvince = (e) => setForm((f) => ({ ...f, province: e.target.value, amphoe: '', district: '', postalCode: '' }))
  const setAmphoe = (e) => setForm((f) => ({ ...f, amphoe: e.target.value, district: '', postalCode: '' }))
  const setDistrict = (e) => {
    const district = e.target.value
    setForm((f) => ({ ...f, district, postalCode: district ? getZipcode(f.province, f.amphoe, district) : '' }))
  }

  const registerWith = async (providerKey) => {
    setError('')
    setSigningIn(providerKey)
    try {
      const info = await socialSignIn(providerKey)
      setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(info).filter(([, v]) => v)) }))
      setRegistered(true)
    } catch (e) {
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return
      setError(providerKey === 'line'
        ? 'ลงทะเบียนด้วย LINE ไม่สำเร็จ — กรุณากรอกข้อมูลเอง หรือลองใหม่อีกครั้ง'
        : 'ลงทะเบียนด้วย Google ไม่สำเร็จ — กรุณากรอกข้อมูลเอง หรือลองใหม่อีกครั้ง')
    } finally {
      setSigningIn('')
    }
  }

  const confirmInfo = () => {
    if (!form.fullName.trim()) return setError('กรุณากรอกชื่อ-นามสกุล')
    if (!form.phone.trim()) return setError('กรุณากรอกเบอร์โทรศัพท์')
    if (!/^[0-9+\-\s]{6,15}$/.test(form.phone.trim())) return setError('เบอร์โทรศัพท์ไม่ถูกต้อง')
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('อีเมลไม่ถูกต้อง')
    if (!form.address.trim()) return setError('กรุณากรอกที่อยู่จัดส่ง')
    if (!form.province) return setError('กรุณาเลือกจังหวัด')
    if (!form.amphoe) return setError(isBangkok(form.province) ? 'กรุณาเลือกเขต' : 'กรุณาเลือกอำเภอ')
    if (!form.district) return setError(isBangkok(form.province) ? 'กรุณาเลือกแขวง' : 'กรุณาเลือกตำบล')
    setError('')
    setInfoConfirmed(true)
    // จำข้อมูลไว้ในเครื่อง (ไม่ใช่ server) — สั่งซื้อครั้งหน้าฟอร์มเติมให้อัตโนมัติ
    try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(form)) } catch { /* noop */ }
  }

  // กด "แก้ไขข้อมูล" หลังยืนยันแล้ว — ปลดล็อกฟอร์มกลับมาแก้ได้ (ไม่ต้องกดลงทะเบียนใหม่)
  const editInfo = () => { setInfoConfirmed(false); setError('') }

  const confirmOrder = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      // ที่อยู่ที่บันทึกจริง (Firestore/แอดมิน) ยังเป็นสตริงเดียวเหมือนเดิม — ต่อตำบล/อำเภอ/จังหวัด/รหัสไปรษณีย์
      // เข้าไปท้ายที่อยู่ที่กรอก เพื่อไม่ต้องแก้ทุกจุดที่อ่าน customer.address อยู่ทั่วระบบ
      const bkk = isBangkok(form.province)
      const customer = {
        fullName: form.fullName.trim(),
        phone: formatPhone(form.phone),
        email: form.email.trim(),
        address: `${form.address.trim()} ${bkk ? 'แขวง' : 'ตำบล'}${form.district} ${bkk ? 'เขต' : 'อำเภอ'}${form.amphoe} ${form.province} ${form.postalCode}`,
        // มีค่าเฉพาะลูกค้าที่ลงทะเบียนด้วย LINE — ใช้แจ้งเตือนสถานะออเดอร์ผ่าน LINE
        ...(form.lineUserId ? { lineUserId: form.lineUserId } : {}),
      }
      const { id, orderCode } = await createOrder({ items, itemsTotal, customer })
      clearCart()
      notifyAdminNewOrder(orderCode, itemsTotal + shippingFee, customer, items)
      // จำออเดอร์ไว้ในเครื่อง — ใช้แสดงหน้า "คำสั่งซื้อของฉัน" (ลิงก์ออเดอร์ไม่หายแม้ลืมแคปหน้าจอ)
      try {
        const mine = JSON.parse(localStorage.getItem('umShopMyOrders') || '[]')
        mine.unshift({ id, at: Date.now() })
        localStorage.setItem('umShopMyOrders', JSON.stringify(mine.slice(0, 50)))
      } catch { /* noop */ }
      go('shop-order', id)
    } catch (e) {
      // ราคาเปลี่ยนตั้งแต่ตอนหยิบใส่ตะกร้า — เขียนราคาใหม่ลงตะกร้าก่อน ให้ยอดบนหน้าจอตรงกับของจริงทันที
      // ลูกค้าจะได้เห็นยอดที่ถูกต้องแล้วตัดสินใจกดสั่งซื้อใหม่เอง (ดู createOrder ใน data/orders.js)
      if (e.pricedItems) updateCartPrices(e.pricedItems)
      setError('สั่งซื้อไม่สำเร็จ กรุณาลองใหม่: ' + e.message)
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <main className="page">
        <section className="section"><div className="wrap" style={{ textAlign: 'center', padding: '80px 0' }}>
          <h2>ไม่มีสินค้าในตะกร้า</h2>
          <a href="/um-shop" onClick={(e) => { e.preventDefault(); go('shop') }} className="shop-interest-btn" style={{ background: 'var(--green-mid)' }}>
            <FontAwesomeIcon icon={faArrowLeft} /> กลับไปเลือกซื้อสินค้า
          </a>
        </div></section>
        <Footer />
      </main>
    )
  }

  // ข้อความเตือนขึ้นเป็นกล่องกลางจอ ไม่ใช่ตัวแดงเล็กๆ ในฟอร์มอีกต่อไป — ปุ่ม "ยืนยันข้อมูล"/"ยืนยันคำสั่งซื้อ"
  // อยู่ในแถบล่างที่ลอยติดจอ ผู้ใช้ที่เลื่อนอยู่ท้ายหน้าจะไม่เห็นข้อความที่อยู่ในฟอร์มด้านบน (ดู ShopAlert.jsx)
  // หัวข้อกล่องแยกเป็นสองแบบ: ข้อมูลกรอกไม่ครบ/ไม่ถูกต้อง กับข้อผิดพลาดตอนส่งคำสั่งซื้อ
  const alertTitle = /^(กรุณา|เบอร์|อีเมล)/.test(error) ? 'ข้อมูลยังไม่ครบ' : 'แจ้งเตือน'

  return (
    <>
    <ShopAlert message={error} title={alertTitle} onClose={() => setError('')} />
    <main className="page shop-checkout-page">
      <section className="page-band">
        <div className="fc-pattern hero-pattern"></div>
        <div className="inner">
          <span className="badge"><FontAwesomeIcon icon={faCartShopping} /> ยืนยันการสั่งซื้อ</span>
          <h1>สรุปคำสั่งซื้อ</h1>
        </div>
      </section>

      <section className="section">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <a href="/um-shop/cart" onClick={(e) => { e.preventDefault(); go('shop-cart') }} className="shop-detail-back">
            <FontAwesomeIcon icon={faArrowLeft} /> กลับไปตะกร้า
          </a>

          <InAppBrowserWarning />

          <div className="admin-card" style={{ marginBottom: 20 }}>
            <h4>รายการสินค้า</h4>
            <div>
              {items.map((i) => (
                <div key={i.id} className="order-item-row">
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
            <div style={{ textAlign: 'right', marginTop: 12, fontSize: '1.05rem' }}>
              ราคาสินค้ารวม: <strong>{THB(itemsTotal)}</strong>
            </div>
          </div>

          {!registered && (
            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>ลงทะเบียน</h4>
              <p style={{ fontSize: '.88rem', color: 'var(--ink-soft)', marginBottom: 14 }}>
                เลือกวิธีลงทะเบียนเพื่อกรอกข้อมูลผู้สั่งซื้อ
              </p>
              <div className="checkout-register-options">
                <button type="button" className="checkout-register-btn" onClick={() => setRegistered(true)}>
                  <FontAwesomeIcon icon={faUserPen} /> กรอกข้อมูลเอง
                </button>
                <button type="button" className="checkout-register-btn checkout-register-line" onClick={() => registerWith('line')} disabled={!!signingIn}>
                  <FontAwesomeIcon icon={faLine} /> {signingIn === 'line' ? 'กำลังเชื่อมต่อ...' : 'ลงทะเบียนด้วย LINE'}
                </button>
                <button type="button" className="checkout-register-btn checkout-register-google" onClick={() => registerWith('google')} disabled={!!signingIn}>
                  <FontAwesomeIcon icon={faGoogle} /> {signingIn === 'google' ? 'กำลังเชื่อมต่อ...' : 'ลงทะเบียนด้วย Google'}
                </button>
              </div>
            </div>
          )}

          {registered && (
          <div className="admin-card" style={{ marginBottom: 20 }}>
            <h4>ข้อมูลลูกค้า</h4>
            <div className="admin-form-grid">
              <label style={{ gridColumn: '1 / -1' }}>ชื่อ-นามสกุล
                <input type="text" value={form.fullName} onChange={set('fullName')} disabled={infoConfirmed} />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>เบอร์โทรศัพท์
                <input type="tel" value={form.phone} onChange={set('phone')} disabled={infoConfirmed} />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>อีเมล (ไม่บังคับ)
                <input type="email" value={form.email} onChange={set('email')} disabled={infoConfirmed} placeholder="example@email.com" autoComplete="email" />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>ที่อยู่จัดส่ง
                <textarea rows="3" value={form.address} onChange={set('address')} disabled={infoConfirmed} placeholder="บ้านเลขที่ ถนน ซอย" />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>จังหวัด
                <select value={form.province} onChange={setProvince} disabled={infoConfirmed}>
                  <option value="">เลือกจังหวัด</option>
                  {THAILAND_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label>{isBangkok(form.province) ? 'เขต' : 'อำเภอ'}
                <select value={form.amphoe} onChange={setAmphoe} disabled={infoConfirmed || !form.province}>
                  <option value="">{form.province ? `เลือก${isBangkok(form.province) ? 'เขต' : 'อำเภอ'}` : 'เลือกจังหวัดก่อน'}</option>
                  {getAmphoes(form.province).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label>{isBangkok(form.province) ? 'แขวง' : 'ตำบล'}
                <select value={form.district} onChange={setDistrict} disabled={infoConfirmed || !form.amphoe}>
                  <option value="">{form.amphoe ? `เลือก${isBangkok(form.province) ? 'แขวง' : 'ตำบล'}` : `เลือก${isBangkok(form.province) ? 'เขต' : 'อำเภอ'}ก่อน`}</option>
                  {getDistricts(form.province, form.amphoe).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label style={{ gridColumn: '1 / -1' }}>รหัสไปรษณีย์
                <input type="text" value={form.postalCode} disabled placeholder="เลือกที่อยู่ให้ครบเพื่อเติมอัตโนมัติ" />
              </label>
            </div>
            {infoConfirmed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                <p style={{ color: '#15803d', fontSize: '.9rem', margin: 0 }}><FontAwesomeIcon icon={faCheck} /> ยืนยันข้อมูลแล้ว</p>
                <button className="admin-btn" onClick={editInfo}><FontAwesomeIcon icon={faUserPen} /> แก้ไขข้อมูล</button>
              </div>
            )}
          </div>
          )}

          {infoConfirmed && (
            <div className="admin-card">
              <div className="cart-summary-row"><span>ราคาสินค้ารวม</span><span>{THB(itemsTotal)}</span></div>
              <div className="cart-summary-row"><span>ค่าจัดส่ง</span><span>{THB(shippingFee)}</span></div>
              <div className="cart-summary-row cart-summary-total"><span>ยอดชำระทั้งหมด</span><span>{THB(itemsTotal + shippingFee)}</span></div>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>

    {/* แถบลอยติดขอบล่างจอ (แชท / ราคา / ยืนยันข้อมูล-สั่งซื้อ) — โชว์เฉพาะตอนเข้าสู่ขั้นกรอกข้อมูลแล้ว (ลงทะเบียนเสร็จ) */}
    {registered && (
      <div className="shop-detail-bar shop-checkout-bar">
        <button type="button" onClick={openChat} className="shop-detail-bar-line" aria-label="แชท">
          <FontAwesomeIcon icon={faComments} />
          <span>แชท</span>
        </button>
        <div className="shop-detail-bar-price">
          <span className="cart-bar-total-label">ราคารวม</span>
          <span className="shop-detail-bar-price-now">{THB(itemsTotal + shippingFee)}</span>
        </div>
        {infoConfirmed ? (
          <button type="button" className="shop-detail-bar-cart" onClick={confirmOrder} disabled={submitting}>
            {submitting ? 'กำลังส่งคำสั่งซื้อ...' : 'ยืนยันคำสั่งซื้อ'}
          </button>
        ) : (
          <button type="button" className="shop-detail-bar-cart" onClick={confirmInfo}>ยืนยันข้อมูล</button>
        )}
      </div>
    )}
    </>
  )
}
