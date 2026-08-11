import { useMemo, useState } from 'react'
import Footer from '../components/Footer.jsx'
import ShopAlert from '../components/ShopAlert.jsx'
import { useProducts } from '../data/shop.js'
import { useApprovedReviews, submitReview, submitIssue } from '../data/shopReviews.js'
import {
  ISSUE_TOPICS, MAX_PHOTOS, MAX_REVIEW_LEN, MAX_ISSUE_LEN, averageRating, cleanPhotos,
} from '../data/shopFeedback.js'
import PhotoUploader from '../components/PhotoUploader.jsx'
import { optImg } from '../utils/cloudinaryUrl.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStar, faCamera, faXmark, faBoxOpen, faCommentDots, faTriangleExclamation, faArrowLeft } from '@fortawesome/free-solid-svg-icons'

// ศูนย์บริการลูกค้า um-shop (/um-shop/support) — 3 แถบ: ติดตามสถานะ · รีวิวสินค้า · แจ้งปัญหา
//
// ทั้งหมดเปิดให้ลูกค้าที่ไม่ได้ล็อกอินใช้ได้ (ร้านนี้เป็น guest checkout)
// การตรวจข้อมูลอยู่ใน data/shopFeedback.js และ firestore.rules ตรวจซ้ำอีกชั้น
const TABS = [
  { key: 'track', label: 'ติดตามสถานะ', icon: faBoxOpen },
  { key: 'review', label: 'รีวิวสินค้า', icon: faCommentDots },
  { key: 'issue', label: 'แจ้งปัญหา', icon: faTriangleExclamation },
]

const initialTab = () => {
  const t = new URLSearchParams(window.location.search).get('tab')
  return TABS.some((x) => x.key === t) ? t : 'track'
}

function Stars({ value, onChange }) {
  return (
    <div className="sup-stars" role="radiogroup" aria-label="ให้คะแนน">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ดาว`}
          className={n <= value ? 'on' : ''}
          onClick={() => onChange(n)}
        ><FontAwesomeIcon icon={faStar} /></button>
      ))}
    </div>
  )
}

export default function ShopSupport() {
  const [tab, setTab] = useState(initialTab)
  const [alert, setAlert] = useState('')
  const { products } = useProducts()
  const { reviews, loading: reviewsLoading } = useApprovedReviews()

  // ── รีวิว ──
  const [rProduct, setRProduct] = useState('')
  const [rRating, setRRating] = useState(5)
  const [rText, setRText] = useState('')
  const [rName, setRName] = useState('')
  const [rPhotos, setRPhotos] = useState([])
  const [rBusy, setRBusy] = useState(false)
  const [rDone, setRDone] = useState(false)

  // ── แจ้งปัญหา ──
  const [iOrder, setIOrder] = useState('')
  const [iPhone, setIPhone] = useState('')
  const [iTopic, setITopic] = useState('not_received')
  const [iDetail, setIDetail] = useState('')
  const [iPhotos, setIPhotos] = useState([])
  const [iBusy, setIBusy] = useState(false)
  const [iDone, setIDone] = useState(false)

  const [filterProduct, setFilterProduct] = useState('all')
  const shown = useMemo(
    () => (filterProduct === 'all' ? reviews : reviews.filter((r) => r.productId === filterProduct)),
    [reviews, filterProduct]
  )
  const avg = averageRating(shown)
  // เอาเฉพาะสินค้าที่มีรีวิวแล้วมาเป็นตัวกรอง — ปุ่มกรองที่กดแล้วว่างเปล่าไม่มีประโยชน์
  const reviewedProducts = useMemo(() => {
    const ids = new Set(reviews.map((r) => r.productId))
    return products.filter((p) => ids.has(p.id))
  }, [products, reviews])

  const sendReview = async () => {
    if (rBusy) return
    setRBusy(true)
    try {
      const p = products.find((x) => x.id === rProduct)
      await submitReview({ productId: rProduct, productName: p?.name, rating: rRating, text: rText, authorName: rName, photos: rPhotos })
      setRDone(true)
      setRText(''); setRPhotos([]); setRRating(5)
    } catch (e) {
      setAlert(e.message)
    } finally { setRBusy(false) }
  }

  const sendIssue = async () => {
    if (iBusy) return
    setIBusy(true)
    try {
      await submitIssue({ orderCode: iOrder, phone: iPhone, topic: iTopic, detail: iDetail, photos: iPhotos })
      setIDone(true)
      setIDetail(''); setIPhotos([])
    } catch (e) {
      setAlert(e.message)
    } finally { setIBusy(false) }
  }

  // ต้องมีคลาส "page" — นาวบาร์เป็น position:fixed (nav.css) ทุกหน้าจึงต้องเว้น padding-top ชดเชยไว้เอง
  // (.page{padding-top:72px} ใน home.css ใช้ร่วมกันทุกหน้า) หน้านี้เคยลืมใส่ไว้อันเดียวในบรรดาหน้า Shop ทั้งหมด
  // เนื้อหาจึงเริ่มห่างจากนาวบาร์แค่ 20px (จาก .sup-wrap) ซึ่งบางกว่าความสูงนาวบาร์จริงมาก
  return (
    <div className="page shop-page sup-page">
      <ShopAlert message={alert} onClose={() => setAlert('')} />

      <div className="sup-wrap">
        <a className="sup-back" href="/um-shop"><FontAwesomeIcon icon={faArrowLeft} /> กลับไปที่ร้าน</a>
        <h1 className="sup-title">ศูนย์บริการลูกค้า</h1>
        <p className="sup-sub">ติดตามออเดอร์ · รีวิวสินค้าที่ได้รับ · แจ้งปัญหาการสั่งซื้อ</p>

        <div className="sup-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={tab === t.key ? 'on' : ''}
              onClick={() => setTab(t.key)}
            ><FontAwesomeIcon icon={t.icon} /> {t.label}</button>
          ))}
        </div>

        {tab === 'track' && (
          <div className="sup-card">
            <h2>ติดตามสถานะสินค้า</h2>
            <p className="sup-note">
              ออเดอร์ที่สั่งจากเครื่องนี้จะขึ้นในหน้า “คำสั่งซื้อของฉัน” อัตโนมัติ
            </p>
            <a className="sup-btn-primary" href="/um-shop/my-orders">เปิดคำสั่งซื้อของฉัน</a>
            {/* ตั้งใจไม่ทำช่องค้นหาด้วยเลขออเดอร์: เลขรันเป็นลำดับ (ORD-0001, ORD-0002…)
                ใครก็ไล่เลขดูชื่อ เบอร์โทร และที่อยู่ของลูกค้าคนอื่นได้ทั้งร้าน
                ลิงก์ติดตามที่ส่งให้ลูกค้าทางอีเมลใช้ id สุ่มยาว ซึ่งเดาไม่ได้ */}
            <p className="sup-note sup-note-dim">
              เปลี่ยนเครื่องหรือล้างข้อมูลเบราว์เซอร์แล้วรายการหาย? ใช้ลิงก์ติดตามในอีเมลยืนยันคำสั่งซื้อ
              หรือทักแชทร้านพร้อมแจ้งเลขออเดอร์ได้เลย
            </p>
          </div>
        )}

        {tab === 'review' && (
          <>
            <div className="sup-card">
              <h2>เขียนรีวิวสินค้า</h2>
              {rDone ? (
                <div className="sup-done">
                  <strong>ส่งรีวิวแล้ว ขอบคุณมากครับ 🙏</strong>
                  <p>รีวิวจะขึ้นหน้าเว็บหลังทีมงานตรวจสอบ</p>
                  <button className="sup-btn" onClick={() => setRDone(false)}>เขียนรีวิวอีกชิ้น</button>
                </div>
              ) : (
                <>
                  <label>สินค้าที่รีวิว
                    <select value={rProduct} onChange={(e) => setRProduct(e.target.value)}>
                      <option value="">— เลือกสินค้า —</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <label>ให้คะแนน<Stars value={rRating} onChange={setRRating} /></label>
                  <label>รีวิวของคุณ
                    <textarea
                      rows={4} value={rText} maxLength={MAX_REVIEW_LEN}
                      onChange={(e) => setRText(e.target.value)}
                      placeholder="เล่าให้ฟังหน่อยว่าของเป็นยังไงบ้าง"
                    />
                  </label>
                  <label>ชื่อที่จะแสดง (ไม่บังคับ)
                    <input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="เช่น นาซนีน" />
                  </label>
                  <div className="sup-field-label">รูปสินค้าที่ได้รับ (ไม่บังคับ · สูงสุด {MAX_PHOTOS} รูป)</div>
                  <PhotoUploader photos={rPhotos} max={MAX_PHOTOS} onChange={setRPhotos} onBusyChange={setRBusy} />
                  <button className="sup-btn-primary" onClick={sendReview} disabled={rBusy || !rProduct || !rText.trim()}>
                    {rBusy ? 'กำลังส่ง…' : 'ส่งรีวิว'}
                  </button>
                </>
              )}
            </div>

            <div className="sup-card">
              <div className="sup-reviews-head">
                <h2>รีวิวจากลูกค้า</h2>
                {avg !== null && <span className="sup-avg"><FontAwesomeIcon icon={faStar} /> {avg} ({shown.length})</span>}
              </div>
              {reviewedProducts.length > 0 && (
                <div className="sup-filters">
                  <button className={filterProduct === 'all' ? 'on' : ''} onClick={() => setFilterProduct('all')}>
                    ทั้งหมด ({reviews.length})
                  </button>
                  {reviewedProducts.map((p) => (
                    <button key={p.id} className={filterProduct === p.id ? 'on' : ''} onClick={() => setFilterProduct(p.id)}>
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
              {reviewsLoading ? <p className="sup-note">กำลังโหลด…</p> : shown.length === 0 ? (
                <p className="sup-note">ยังไม่มีรีวิว — เป็นคนแรกได้เลย</p>
              ) : (
                <div className="sup-review-list">
                  {shown.map((r) => (
                    <div key={r.id} className="sup-review">
                      {/* กรอง URL รูปตอนแสดงผลอีกชั้น ไม่ใช่เชื่อค่าที่อยู่ในเอกสาร —
                          firestore.rules ตรวจได้แค่ว่า photos เป็น list ไม่เกิน 4 ตัว
                          (ภาษา rules วน regex ทีละสมาชิกไม่ได้) คนที่ยิง REST ตรงจึงยังใส่ URL
                          จากที่อื่นมาได้ ถ้าเรนเดอร์ตรงๆ จะกลายเป็นการฝังรูปนอกบนหน้าเว็บมูลนิธิ */}
                      {cleanPhotos(r.photos).length > 0 && (
                        <div className="sup-review-photos">
                          {cleanPhotos(r.photos).map((u, i) => <img key={i} src={optImg(u, 400)} alt="" loading="lazy" />)}
                        </div>
                      )}
                      <div className="sup-review-body">
                        {r.productName && <span className="sup-review-tag">{r.productName}</span>}
                        <div className="sup-review-stars">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <FontAwesomeIcon key={n} icon={faStar} className={n <= (r.rating || 0) ? 'on' : ''} />
                          ))}
                        </div>
                        <p className="sup-review-text">{r.text}</p>
                        <span className="sup-review-by">— {r.authorName || 'ลูกค้า'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'issue' && (
          <div className="sup-card">
            <h2>แจ้งปัญหา</h2>
            {iDone ? (
              <div className="sup-done">
                <strong>รับเรื่องแล้วครับ 🙏</strong>
                <p>ทีมงานจะติดต่อกลับตามเบอร์/เลขออเดอร์ที่แจ้งไว้</p>
                <button className="sup-btn" onClick={() => setIDone(false)}>แจ้งเรื่องอื่น</button>
              </div>
            ) : (
              <>
                <label>เรื่องที่ต้องการแจ้ง
                  <select value={iTopic} onChange={(e) => setITopic(e.target.value)}>
                    {ISSUE_TOPICS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </label>
                <label>เลขออเดอร์ (ถ้ามี)
                  <input value={iOrder} onChange={(e) => setIOrder(e.target.value)} placeholder="เช่น ORD-0012" />
                </label>
                <label>เบอร์โทรที่ติดต่อได้
                  <input type="tel" value={iPhone} onChange={(e) => setIPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
                </label>
                <label>รายละเอียด
                  <textarea
                    rows={4} value={iDetail} maxLength={MAX_ISSUE_LEN}
                    onChange={(e) => setIDetail(e.target.value)}
                    placeholder="เล่าปัญหาที่พบให้ละเอียดที่สุดเท่าที่จะทำได้"
                  />
                </label>
                <div className="sup-field-label">แนบรูป (ถ้ามี · ช่วยให้แก้ไขได้เร็วขึ้น)</div>
                <PhotoUploader photos={iPhotos} max={MAX_PHOTOS} onChange={setIPhotos} onBusyChange={setIBusy} />
                <button className="sup-btn-primary" onClick={sendIssue} disabled={iBusy || !iDetail.trim()}>
                  {iBusy ? 'กำลังส่ง…' : 'ส่งเรื่อง'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
