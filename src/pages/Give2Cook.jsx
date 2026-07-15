import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase.js'
import { collection, doc, setDoc, runTransaction } from 'firebase/firestore'
import { QRCodeSVG } from 'qrcode.react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLaptop, faUtensils, faCircleCheck, faPhone, faCamera, faCheck, faXmark, faArrowLeft, faHandHoldingHeart, faBoxOpen } from '@fortawesome/free-solid-svg-icons'

import { GIVE_SHEET_ENDPOINT as SHEET_ENDPOINT, GIVE_SHEET_TOKEN as SHEET_TOKEN, fetchWithTimeout } from '../utils/endpoints.js'
const CLD_CLOUD = 'dei5jktuw'
const CLD_PRESET = 'Ummatee'

import { formatPhone } from '../utils/formatPhone.js'

const TYPES = [
  {
    key: 'kitchen',
    icon: faLaptop,
    label: 'มอบเครื่องมือประกอบอาชีพแก่ผู้ยากไร้',
    desc: 'เครื่องปั่น เตาปิ้ง อุปกรณ์ครัว ที่ยังใช้งานได้',
    color: '#d97706',
    bg: '#fef9ee',
  },
]

async function nextRef() {
  const counterRef = doc(db, 'config', 'give2CookCounter')
  let num = 1
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    num = snap.exists() ? (snap.data().count ?? 0) + 1 : 1
    tx.set(counterRef, { count: num })
  })
  return `COOK-${String(num).padStart(4, '0')}`
}

// ── Success Screen ──────────────────────────────────────────────────
function SuccessScreen({ refCode, fname }) {
  return (
    <main className="g2-success-page">
      <div className="g2-success-wrap">
        <div className="g2-success-deco deco-a"></div>
        <div className="g2-success-deco deco-b"></div>
        <div className="g2-success-inner">
          <div className="g2-success-badge"><FontAwesomeIcon icon={faCircleCheck} /></div>
          <h2 className="g2-success-title">
            ญะซากัลลอฮุคอยรอน<br />
            <span className="g2-success-name">{fname}</span>
          </h2>
          <p className="g2-success-msg">
            ขอบคุณที่ร่วมส่งต่อสิ่งดี ๆ ให้แก่สังคม<br />
            ทีมงานจะติดต่อกลับเพื่อนัดรับสิ่งของของคุณ
          </p>
          <div className="g2-success-qr-box">
            <div className="g2-success-qr-label">QR Code ยืนยันการลงทะเบียน</div>
            <div className="g2-success-qr">
              <QRCodeSVG
                value={`https://ummatee-app.web.app/give2/${refCode}`}
                size={160}
                bgColor="transparent"
                fgColor="#1B5E36"
              />
            </div>
            <div className="g2-success-ref">{refCode}</div>
          </div>
          <div className="g2-success-note">
            <FontAwesomeIcon icon={faPhone} /> ทีมงานจะโทรหาคุณเพื่อนัดรับสิ่งของ<br />กรุณาเก็บรหัส <strong>{refCode}</strong> ไว้เป็นหลักฐาน
          </div>
          <a className="g2-back-btn" href="/event/give-for-um"><FontAwesomeIcon icon={faArrowLeft} /> กลับหน้างาน GIVE</a>
        </div>
      </div>
    </main>
  )
}

// ── Role Selection ──────────────────────────────────────────────────
function RoleSelect({ onSelect }) {
  return (
    <main className="g2-page">
      <section className="g2-hero">
        <div className="g2-hero-blob blob-1"></div>
        <div className="g2-hero-blob blob-2"></div>
        <div className="g2-hero-inner">
          <img src="/logo.png" alt="Ummatee" className="g2-hero-logo" />
          <div className="g2-hero-tag">งาน "ให้" ครั้งที่ 6 · GIVE</div>
          <h1 className="g2-hero-title">คุณต้องการ<br />ทำอะไร?</h1>
          <p className="g2-hero-lead">เลือกว่าคุณต้องการส่งมอบสิ่งของ หรือต้องการรับสิ่งของ</p>
        </div>
      </section>
      <div className="g2-role-cards">
        <button className="g2-role-card g2-role-give" onClick={() => onSelect('give')}>
          <div className="g2-role-icon"><FontAwesomeIcon icon={faHandHoldingHeart} /></div>
          <h3>พี่ต้องการส่งมอบ</h3>
          <p>มอบคอมมือสอง อุปกรณ์ประกอบอาชีพ หรือสิ่งของที่ไม่ได้ใช้แล้ว</p>
          <div className="g2-role-arrow">เริ่มลงทะเบียน →</div>
        </button>
        <button className="g2-role-card g2-role-receive" onClick={() => { window.location.href = '/event/give-for-um/receive' }}>
          <div className="g2-role-icon"><FontAwesomeIcon icon={faBoxOpen} /></div>
          <h3>ผมต้องการรับ</h3>
          <p>ลงทะเบียนรับคอมมือสอง อุปกรณ์ประกอบอาชีพ หรือสิ่งของบริจาค</p>
          <div className="g2-role-arrow">เริ่มลงทะเบียน →</div>
        </button>
      </div>
      <div style={{ textAlign: 'center', padding: '0 0 40px' }}>
        <a className="g2-back-btn" href="#/event/give-for-um"><FontAwesomeIcon icon={faArrowLeft} /> กลับหน้างาน GIVE</a>
      </div>
    </main>
  )
}

// ── Main Form ───────────────────────────────────────────────────────
export default function Give2Cook() {
  const [role, setRole] = useState('give')
  const [form, setForm] = useState({ fname: '', lname: '', phone: '', email: '', detail: '', canAttend: null })
  const [items, setItems] = useState([])
  const [selItem, setSelItem] = useState('')
  const [selQty, setSelQty] = useState('1')
  const [customItem, setCustomItem] = useState('')
  const [imageUrls, setImageUrls] = useState([])
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null)
  const widgetRef = useRef(null)

  // โหลด Cloudinary Upload Widget script
  useEffect(() => {
    if (window.cloudinary) return
    const script = document.createElement('script')
    script.src = 'https://upload-widget.cloudinary.com/global/all.js'
    script.async = true
    document.head.appendChild(script)
  }, [])

  const openWidget = () => {
    if (!window.cloudinary) return
    if (!widgetRef.current) {
      widgetRef.current = window.cloudinary.createUploadWidget(
        {
          cloudName: CLD_CLOUD,
          uploadPreset: CLD_PRESET,
          sources: ['local', 'camera'],
          multiple: true,
          maxFiles: 10,
          maxFileSize: 10_000_000,
          resourceType: 'image',
          clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
          language: 'en',
          text: {
            en: {
              or: 'หรือ',
              back: 'กลับ',
              advanced: 'ขั้นสูง',
              close: 'ปิด',
              no_results: 'ไม่พบผลลัพธ์',
              search_placeholder: 'ค้นหาไฟล์',
              about_uw: 'เกี่ยวกับ Upload Widget',
              menu: { files: 'ไฟล์ของฉัน', camera: 'กล้องถ่ายรูป' },
              local: { browse: 'เลือกไฟล์', dd_title_single: 'ลากรูปมาวางที่นี่', dd_title_multi: 'ลากรูปมาวางที่นี่', drop_title_single: 'วางรูปที่นี่', drop_title_multiple: 'วางรูปที่นี่' },
            },
          },
          styles: {
            palette: { window: '#FFFFFF', windowBorder: '#e5e7eb', tabIcon: '#059669', menuIcons: '#059669', textDark: '#1f2937', textLight: '#ffffff', link: '#059669', action: '#059669', inactiveTabIcon: '#9ca3af', error: '#ef4444', inProgress: '#059669', complete: '#059669', sourceBg: '#f9fafb' },
            fonts: { default: null, "'Noto Sans Thai', sans-serif": { url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600', active: true } },
          },
        },
        (error, result) => {
          if (error) return
          if (result.event === 'success') {
            setImageUrls((prev) => [...prev, result.info.secure_url])
            setErrors((er) => ({ ...er, images: undefined }))
          }
        }
      )
    }
    widgetRef.current.open()
  }

  const removeImage = (i) => setImageUrls((prev) => prev.filter((_, idx) => idx !== i))

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))


  const validate = () => {
    const e = {}
    if (!form.fname.trim()) e.fname = 'กรุณากรอกชื่อ'
    if (!form.lname.trim()) e.lname = 'กรุณากรอกนามสกุล'
    if (!form.phone.trim()) e.phone = 'กรุณากรอกเบอร์โทร'
    else if (!/^[0-9+\-\s]{6,15}$/.test(form.phone.trim())) e.phone = 'เบอร์โทรไม่ถูกต้อง'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'อีเมลไม่ถูกต้อง'
    if (items.length === 0) e.types = 'กรุณาเพิ่มรายการอย่างน้อย 1 รายการ'
    if (form.canAttend === null) e.canAttend = 'กรุณาเลือกว่าสะดวกมามอบในงานหรือไม่'
    if (imageUrls.length < 1) e.images = 'กรุณาอัพโหลดรูปอย่างน้อย 1 รูป'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) {
      document.querySelector('.g2-err')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSubmitting(true)
    try {
      const refCode = await nextRef()
      const typeLabels = items.map((it) => `${it.name} x${it.qty}`).join(', ')
      const payload = {
        refCode, fname: form.fname.trim(), lname: form.lname.trim(),
        phone: formatPhone(form.phone), email: form.email.trim(), types: items.map((it) => it.name), typeLabels,
        items,
        detail: form.detail.trim(), canAttend: form.canAttend, imageUrls, submittedAt: new Date().toISOString(),
      }

      await setDoc(doc(collection(db, 'give2CookRegs'), refCode), payload)

      fetchWithTimeout(SHEET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: SHEET_TOKEN, type: 'give2cook', ...payload }),
      }).catch(() => {})

      setDone({ refCode, fname: form.fname.trim() })
    } catch (err) {
      setErrors({ submit: err?.message ? `เกิดข้อผิดพลาด: ${err.message}` : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' })
    } finally {
      setSubmitting(false)
    }
  }

  if (done) return <SuccessScreen {...done} />

  if (!role) return (
    <main className="g2-page g2-cook">
      <section className="g2-hero">
        <div className="g2-hero-blob blob-1"></div>
        <div className="g2-hero-blob blob-2"></div>
        <div className="g2-hero-inner">
          <img src="/logo.png" alt="Ummatee" className="g2-hero-logo" />
          <div className="g2-hero-tag">งาน "ให้" ครั้งที่ 6 · อุปกรณ์ครัว</div>
          <h1 className="g2-hero-title">เครื่องมือ<br />ประกอบอาชีพ</h1>
          <p className="g2-hero-lead">เครื่องปั่น เตาปิ้ง อุปกรณ์ครัว เครื่องมือช่าง</p>
        </div>
      </section>
      <div className="g2-role-cards">
        <button className="g2-role-card g2-role-give" onClick={() => setRole('give')}>
          <div className="g2-role-icon"><FontAwesomeIcon icon={faHandHoldingHeart} /></div>
          <h3>ผู้ให้</h3>
          <p>มอบเครื่องปั่น เตาปิ้ง อุปกรณ์ครัว หรือเครื่องมือช่างที่ยังใช้ได้</p>
          <div className="g2-role-arrow">ลงทะเบียนมอบ →</div>
        </button>
        <button className="g2-role-card g2-role-receive" onClick={() => { window.location.href = '/event/give-for-um/receive' }}>
          <div className="g2-role-icon"><FontAwesomeIcon icon={faBoxOpen} /></div>
          <h3>ผู้รับ</h3>
          <p>ลงทะเบียนรับอุปกรณ์ประกอบอาชีพสำหรับผู้ที่ต้องการ</p>
          <div className="g2-role-arrow">ลงทะเบียนรับ →</div>
        </button>
      </div>
      <div style={{ textAlign: 'center', padding: '0 0 40px' }}>
        <a className="g2-back-btn" href="/event/give-for-um"><FontAwesomeIcon icon={faArrowLeft} /> กลับหน้างาน GIVE</a>
      </div>
    </main>
  )

  return (
    <main className="g2-page g2-cook">
      {/* ── Hero ── */}
      <section className="g2-hero">
        <div className="g2-hero-blob blob-1"></div>
        <div className="g2-hero-blob blob-2"></div>
        <div className="g2-hero-inner">
          <img src="/logo.png" alt="Ummatee" className="g2-hero-logo" />

          <div className="g2-hero-tag">มูลนิธิอุมมะตี · มอบอาชีพแก่ผู้ยากไร้</div>
          <h1 className="g2-hero-title">มอบอาชีพ<br />แก่ผู้ยากไร้</h1>
          <p className="g2-hero-lead">
            เครื่องปั่น เตาปิ้ง อุปกรณ์ครัว <br className="hide-sm" /><br/> 
            กรอกข้อมูล · อัพโหลดรูป · รอทีมงานติดต่อกลับ
          </p>
          <div className="g2-steps">
            <div className="g2-step"><div className="g2-step-num">1</div><div className="g2-step-label">ข้อมูลผู้บริจาค</div></div>
            <div className="g2-step-line"></div>
            <div className="g2-step"><div className="g2-step-num">2</div><div className="g2-step-label">ประเภทอุปกรณ์</div></div>
            <div className="g2-step-line"></div>
            <div className="g2-step"><div className="g2-step-num">3</div><div className="g2-step-label">อัพโหลดรูป</div></div>
          </div>
        </div>
      </section>

      <form onSubmit={submit} noValidate className="g2-form-card">

        {/* ── Band 1: ข้อมูลผู้บริจาค ── */}
        <section className="g2-band band-1">
          <div className="g2-band-header bh-purple">
            <div className="g2-band-header-inner">
              <div className="g2-band-num">1</div>
              <div>
                <div className="g2-band-title">ข้อมูลผู้บริจาค</div>
                <div className="g2-band-sub">ทีมงานจะใช้ข้อมูลนี้ติดต่อกลับเพื่อนัดรับสิ่งของ</div>
              </div>
            </div>
          </div>
          <div className="g2-band-body">
            <div className="g2-row-2">
              <div className="g2-field">
                <label className="g2-label">ชื่อ <span className="g2-req">*</span></label>
                <input
                  className={`g2-input ${errors.fname ? 'err' : ''}`}
                  value={form.fname}
                  onChange={(e) => { set('fname', e.target.value); setErrors((er) => ({ ...er, fname: undefined })) }}
                  placeholder="ชื่อจริง"
                />
                {errors.fname && <div className="g2-err">{errors.fname}</div>}
              </div>
              <div className="g2-field">
                <label className="g2-label">นามสกุล <span className="g2-req">*</span></label>
                <input
                  className={`g2-input ${errors.lname ? 'err' : ''}`}
                  value={form.lname}
                  onChange={(e) => { set('lname', e.target.value); setErrors((er) => ({ ...er, lname: undefined })) }}
                  placeholder="นามสกุล"
                />
                {errors.lname && <div className="g2-err">{errors.lname}</div>}
              </div>
            </div>
            <div className="g2-row-2">
              <div className="g2-field">
                <label className="g2-label">เบอร์โทรศัพท์ <span className="g2-req">*</span></label>
                <input
                  className={`g2-input ${errors.phone ? 'err' : ''}`}
                  value={form.phone}
                  onChange={(e) => { set('phone', e.target.value); setErrors((er) => ({ ...er, phone: undefined })) }}
                  placeholder="0xx-xxx-xxxx"
                  type="tel"
                />
                {errors.phone && <div className="g2-err">{errors.phone}</div>}
              </div>
              <div className="g2-field">
                <label className="g2-label">อีเมล</label>
                <input
                  className={`g2-input ${errors.email ? 'err' : ''}`}
                  value={form.email}
                  onChange={(e) => { set('email', e.target.value); setErrors((er) => ({ ...er, email: undefined })) }}
                  placeholder="example@email.com"
                  type="email"
                  autoComplete="email"
                />
                {errors.email && <div className="g2-err">{errors.email}</div>}
              </div>
            </div>
          </div>
        </section>

        {/* ── Band 2: รายการอุปกรณ์ ── */}
        <section className="g2-band band-2">
          <div className="g2-band-header bh-indigo">
            <div className="g2-band-header-inner">
              <div className="g2-band-num">2</div>
              <div>
                <div className="g2-band-title">รายการอุปกรณ์ <span className="g2-req">*</span></div>
                <div className="g2-band-sub">เลือกอุปกรณ์และจำนวน กดเพิ่มได้หลายรายการ</div>
              </div>
            </div>
          </div>
          <div className="g2-band-body">
            <div className="g2-add-row" style={{ flexWrap: 'wrap' }}>
              <select className="g2-input" value={selItem} onChange={(e) => { setSelItem(e.target.value); setCustomItem('') }} style={{ flex: '1 1 100%' }}>
                <option value="">เลือกอุปกรณ์</option>
                <option value="เครื่องปั่น">เครื่องปั่น</option>
                <option value="เตาปิ้ง">เตาปิ้ง</option>
                <option value="หม้อหุงข้าว">หม้อหุงข้าว</option>
                <option value="เตาแก๊ส">เตาแก๊ส</option>
                <option value="ชุดอุปกรณ์ครัว">ชุดอุปกรณ์ครัว</option>
                <option value="เตาอบ">เตาอบ</option>
                <option value="หม้ออบ">หม้ออบ</option>
                <option value="รถเข็น">รถเข็น</option>
                <option value="อื่นๆ">อื่นๆ</option>
              </select>
              {selItem === 'อื่นๆ' && (
                <input
                  className="g2-input"
                  style={{ flex: '1 1 100%' }}
                  value={customItem}
                  onChange={(e) => setCustomItem(e.target.value)}
                  placeholder="ระบุชื่ออุปกรณ์ เช่น เครื่องทำน้ำแข็ง"
                  autoFocus
                />
              )}
              <div className="g2-qty-row">
                <button type="button" className="g2-qty-btn" onClick={() => setSelQty((q) => String(Math.max(1, parseInt(q) - 1)))}>−</button>
                <span className="g2-qty-num">{selQty}</span>
                <button type="button" className="g2-qty-btn" onClick={() => setSelQty((q) => String(Math.min(20, parseInt(q) + 1)))}>+</button>
              </div>
              <button type="button" className="g2-add-btn" onClick={() => {
                const name = selItem === 'อื่นๆ' ? customItem.trim() : selItem
                if (!name) return
                setItems((prev) => [...prev, { name, qty: parseInt(selQty) }])
                setSelItem(''); setSelQty('1'); setCustomItem('')
                setErrors((er) => ({ ...er, types: undefined }))
              }}>+ เพิ่ม</button>
            </div>

            {items.length > 0 && (
              <div className="g2-items-list">
                {items.map((it, i) => (
                  <div key={i} className="g2-item-row">
                    <FontAwesomeIcon icon={faUtensils} style={{ color: '#d97706' }} />
                    <span className="g2-item-name">{it.name}</span>
                    <span className="g2-item-qty">x{it.qty}</span>
                    <button type="button" className="g2-item-remove" onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}>
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {errors.types && <div className="g2-err g2-err-block">{errors.types}</div>}
            <div className="g2-field" style={{ marginTop: 20 }}>
              <label className="g2-label">รายละเอียดเพิ่มเติม <span className="g2-opt">(ไม่บังคับ)</span></label>
              <textarea
                className="g2-input g2-textarea"
                value={form.detail}
                onChange={(e) => set('detail', e.target.value)}
                rows={3}
                placeholder="เช่น สภาพ ยี่ห้อ หรือข้อมูลเพิ่มเติม"
              />
            </div>

            {/* ── ถามการเข้างาน ── */}
            <div className="g2-field g2-attend-field">
              <label className="g2-label">สะดวกมามอบในงานให้ วันที่ 3, 4, 5 กรกฎาคม 2569 ไหมครับ? <span className="g2-req">*</span></label>
              <div className="g2-attend-chips">
                <button
                  type="button"
                  className={`g2-attend-chip${form.canAttend === true ? ' attend-yes' : ''}`}
                  onClick={() => { set('canAttend', true); setErrors((er) => ({ ...er, canAttend: undefined })) }}
                >
                  ✓ สะดวกมามอบ
                </button>
                <button
                  type="button"
                  className={`g2-attend-chip${form.canAttend === false ? ' attend-no' : ''}`}
                  onClick={() => { set('canAttend', false); setErrors((er) => ({ ...er, canAttend: undefined })) }}
                >
                  ✕ ไม่สะดวกมามอบ
                </button>
              </div>
              {errors.canAttend && <div className="g2-err">{errors.canAttend}</div>}
              {form.canAttend === false && (
                <div className="g2-attend-addr-box">
                  <div className="g2-attend-addr-title">📍 ที่อยู่สำหรับนัดรับสิ่งของ</div>
                   <div className="g2-attend-addr-title">มูลนิธิอุมมะตี UMMATEE THAILAND</div>
                  <div className="g2-attend-addr-text">183 ซอย กรุงเทพกรีฑา 7 แขวงหัวหมาก บางกะปิ กรุงเทพมหานคร 10240</div>
                  <iframe
                    title="แผนที่อุมมะตี"
                    src="https://maps.google.com/maps?q=183+ซอย+กรุงเทพกรีฑา+7+หัวหมาก+บางกะปิ+กรุงเทพมหานคร+10240&output=embed&hl=th"
                    width="100%"
                    height="220"
                    style={{ border: 0, borderRadius: 12, marginTop: 12, display: 'block' }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Band 3: รูปภาพ ── */}
        <section className="g2-band band-3">
          <div className="g2-band-header bh-violet">
            <div className="g2-band-header-inner">
              <div className="g2-band-num">3</div>
              <div>
                <div className="g2-band-title">รูปภาพสิ่งของ <span className="g2-req">*</span></div>
                <div className="g2-band-sub">อย่างน้อย 1 รูป · สูงสุด 10 รูป · JPG, PNG, WEBP</div>
              </div>
            </div>
          </div>
          <div className="g2-band-body">
            {/* Preview grid */}
            {imageUrls.length > 0 && (
              <div className="g2-preview-grid" style={{ marginBottom: 16 }}>
                {imageUrls.map((url, i) => (
                  <div className="g2-preview-item" key={i}>
                    <img src={url} alt="" className="g2-preview-img" />
                    <button type="button" className="g2-preview-remove" onClick={() => removeImage(i)} aria-label="ลบ"><FontAwesomeIcon icon={faXmark} /></button>
                    <div className="g2-preview-num">{i + 1}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <button
              type="button"
              className={`g2-cld-btn ${errors.images ? 'err' : ''}`}
              onClick={openWidget}
              disabled={imageUrls.length >= 10}
            >
              <span className="g2-cld-icon"><FontAwesomeIcon icon={faCamera} /></span>
              <span>{imageUrls.length === 0 ? 'เลือกรูปภาพ' : `เพิ่มรูปอีก (${imageUrls.length}/10)`}</span>
            </button>

            {imageUrls.length > 0 && (
              <div className="g2-img-bar">
                <div className="g2-img-bar-track">
                  <div className="g2-img-bar-fill" style={{ width: `${(imageUrls.length / 10) * 100}%`, background: '#d97706' }}></div>
                </div>
                <div className="g2-img-bar-label" style={{ color: '#d97706' }}>
                  {imageUrls.length}/10 รูป <FontAwesomeIcon icon={faCheck} />
                </div>
              </div>
            )}
            {errors.images && <div className="g2-err g2-err-block">{errors.images}</div>}
          </div>
        </section>

        {/* ── Submit ── */}
        <section className="g2-band band-submit">
          <div className="g2-band-body">
            {errors.submit && <div className="g2-err g2-err-block" style={{ textAlign: 'center', marginBottom: 16 }}>{errors.submit}</div>}
            <button className="g2-submit-btn" type="submit" disabled={submitting}>
              {submitting ? (
                <span className="g2-submit-loading"><span className="g2-spinner"></span> กำลังบันทึก...</span>
              ) : (
                'ส่งข้อมูล →'
              )}
            </button>
            <p className="g2-submit-note">ทีมงานจะติดต่อกลับภายใน 1-2 วันทำการ เพื่อนัดรับสิ่งของ</p>
          </div>
        </section>

      </form>
    </main>
  )
}
