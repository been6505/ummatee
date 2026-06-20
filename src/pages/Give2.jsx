import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase.js'
import { collection, doc, setDoc, runTransaction } from 'firebase/firestore'
import { QRCodeSVG } from 'qrcode.react'

const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyz1XLqpQ6bkA7aPX4K3nbag02JIv27Lkquf6jSub8dzVMK3UIAiNETrS1uTlv_UGVh/exec'
const SHEET_TOKEN = 'umt-7Kp2xQ9mZr4Wv8Td'
const CLD_CLOUD = 'dei5jktuw'
const CLD_PRESET = 'Ummatee'

const TYPES = [
  {
    key: 'computer',
    icon: '💻',
    label: 'มอบคอมมือสองให้น้องได้เรียน',
    desc: 'คอมพิวเตอร์ แล็ปท็อป แท็บเล็ต ที่ยังสามารถใช้งานได้',
    color: '#7c3aed',
    bg: '#f5f3ff',
  },
  {
    key: 'tools',
    icon: '🍳',
    label: 'มอบเครื่องมือทำอาชีพแก่ผู้ยากไร้',
    desc: 'เครื่องปั้น เตาปิ้ง อุปกรณ์ครัว เครื่องมือช่าง เครื่องตัดผม ฯลฯ',
    color: '#059669',
    bg: '#ecfdf5',
  },
]

async function nextRef() {
  const counterRef = doc(db, 'config', 'give2Counter')
  let num = 1
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    num = snap.exists() ? (snap.data().count ?? 0) + 1 : 1
    tx.set(counterRef, { count: num })
  })
  return `GIV-${String(num).padStart(4, '0')}`
}

// ── Success Screen ──────────────────────────────────────────────────
function SuccessScreen({ refCode, fname }) {
  return (
    <main className="g2-success-page">
      <div className="g2-success-wrap">
        <div className="g2-success-deco deco-a"></div>
        <div className="g2-success-deco deco-b"></div>
        <div className="g2-success-inner">
          <div className="g2-success-badge">✅</div>
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
                fgColor="#3b0764"
              />
            </div>
            <div className="g2-success-ref">{refCode}</div>
          </div>
          <div className="g2-success-note">
            📞 ทีมงานจะโทรหาคุณเพื่อนัดรับสิ่งของ<br />กรุณาเก็บรหัส <strong>{refCode}</strong> ไว้เป็นหลักฐาน
          </div>
          <a className="g2-back-btn" href="/event/give-for-um">← กลับหน้างาน GIVE</a>
        </div>
      </div>
    </main>
  )
}

// ── Main Form ───────────────────────────────────────────────────────
export default function Give2() {
  const [form, setForm] = useState({ fname: '', lname: '', phone: '', types: [], detail: '' })
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
            palette: { window: '#FFFFFF', windowBorder: '#e5e7eb', tabIcon: '#7c3aed', menuIcons: '#7c3aed', textDark: '#1f2937', textLight: '#ffffff', link: '#7c3aed', action: '#7c3aed', inactiveTabIcon: '#9ca3af', error: '#ef4444', inProgress: '#7c3aed', complete: '#059669', sourceBg: '#f9fafb' },
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

  const toggleType = (key) => {
    setForm((f) => {
      const types = f.types.includes(key) ? f.types.filter((t) => t !== key) : [...f.types, key]
      return { ...f, types }
    })
    setErrors((er) => ({ ...er, types: undefined }))
  }

  const validate = () => {
    const e = {}
    if (!form.fname.trim()) e.fname = 'กรุณากรอกชื่อ'
    if (!form.lname.trim()) e.lname = 'กรุณากรอกนามสกุล'
    if (!form.phone.trim()) e.phone = 'กรุณากรอกเบอร์โทร'
    if (form.types.length === 0) e.types = 'กรุณาเลือกประเภทสิ่งที่ต้องการให้อย่างน้อย 1 รายการ'
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
      const typeLabels = form.types.map((k) => TYPES.find((t) => t.key === k)?.label).join(', ')
      const payload = {
        refCode, fname: form.fname.trim(), lname: form.lname.trim(),
        phone: form.phone.trim(), types: form.types, typeLabels,
        detail: form.detail.trim(), imageUrls, submittedAt: new Date().toISOString(),
      }

      await setDoc(doc(collection(db, 'give2Regs'), refCode), payload)

      fetch(SHEET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: SHEET_TOKEN, type: 'give2', ...payload }),
      }).catch(() => {})

      setDone({ refCode, fname: form.fname.trim() })
    } catch (err) {
      setErrors({ submit: err?.message ? `เกิดข้อผิดพลาด: ${err.message}` : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' })
    } finally {
      setSubmitting(false)
    }
  }

  if (done) return <SuccessScreen {...done} />

  return (
    <main className="g2-page">
      {/* ── Hero ── */}
      <section className="g2-hero">
        <div className="g2-hero-blob blob-1"></div>
        <div className="g2-hero-blob blob-2"></div>
        <div className="g2-hero-inner">
          <img src="/logo.png" alt="Ummatee" className="g2-hero-logo" />
          <div className="g2-hero-tag">งาน "ให้" ครั้งที่ 6 · GIVE</div>
          <h1 className="g2-hero-title">ส่งต่อของ<br />เพื่อสังคม</h1>
          <p className="g2-hero-lead">
            นำสิ่งของที่ไม่ได้ใช้แล้วมาส่งต่อให้ผู้ที่ต้องการ<br className="hide-sm" />
            กรอกข้อมูล · อัพโหลดรูป · รอทีมงานติดต่อกลับ
          </p>
          <div className="g2-steps">
            <div className="g2-step"><div className="g2-step-num">1</div><div className="g2-step-label">ข้อมูลผู้บริจาค</div></div>
            <div className="g2-step-line"></div>
            <div className="g2-step"><div className="g2-step-num">2</div><div className="g2-step-label">เลือกประเภท</div></div>
            <div className="g2-step-line"></div>
            <div className="g2-step"><div className="g2-step-num">3</div><div className="g2-step-label">อัพโหลดรูป</div></div>
          </div>
        </div>
      </section>

      <form onSubmit={submit} noValidate>

        {/* ── Band 1: ข้อมูลผู้บริจาค ── */}
        <section className="g2-band band-1">
          <div className="g2-band-header bh-purple">
            <div className="g2-band-num">1</div>
            <div>
              <div className="g2-band-title">ข้อมูลผู้บริจาค</div>
              <div className="g2-band-sub">ทีมงานจะใช้ข้อมูลนี้ติดต่อกลับเพื่อนัดรับสิ่งของ</div>
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
          </div>
        </section>

        {/* ── Band 2: ประเภทสิ่งของ ── */}
        <section className="g2-band band-2">
          <div className="g2-band-header bh-indigo">
            <div className="g2-band-num">2</div>
            <div>
              <div className="g2-band-title">ประเภทสิ่งที่ต้องการให้ <span className="g2-req">*</span></div>
              <div className="g2-band-sub">เลือกได้มากกว่า 1 ประเภท</div>
            </div>
          </div>
          <div className="g2-band-body">
            <div className="g2-type-cards">
              {TYPES.map((t) => {
                const sel = form.types.includes(t.key)
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`g2-type-card ${sel ? 'sel' : ''}`}
                    onClick={() => toggleType(t.key)}
                    style={sel ? { '--tc': t.color, '--tb': t.bg } : {}}
                  >
                    <div className="g2-type-check">{sel ? '✓' : ''}</div>
                    <div className="g2-type-emoji">{t.icon}</div>
                    <div className="g2-type-body">
                      <div className="g2-type-title">{t.label}</div>
                      <div className="g2-type-desc">{t.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            {errors.types && <div className="g2-err g2-err-block">{errors.types}</div>}
            <div className="g2-field" style={{ marginTop: 20 }}>
              <label className="g2-label">รายละเอียดเพิ่มเติม <span className="g2-opt">(ไม่บังคับ)</span></label>
              <textarea
                className="g2-input g2-textarea"
                value={form.detail}
                onChange={(e) => set('detail', e.target.value)}
                rows={3}
                placeholder="เช่น สภาพสิ่งของ ยี่ห้อ รุ่น หรือข้อมูลที่อยากแจ้งทีมงานเพิ่มเติม"
              />
            </div>
          </div>
        </section>

        {/* ── Band 3: รูปภาพ ── */}
        <section className="g2-band band-3">
          <div className="g2-band-header bh-violet">
            <div className="g2-band-num">3</div>
            <div>
              <div className="g2-band-title">รูปภาพสิ่งของ <span className="g2-req">*</span></div>
              <div className="g2-band-sub">อย่างน้อย 1 รูป · สูงสุด 10 รูป · JPG, PNG, WEBP</div>
            </div>
          </div>
          <div className="g2-band-body">
            {/* Preview grid */}
            {imageUrls.length > 0 && (
              <div className="g2-preview-grid" style={{ marginBottom: 16 }}>
                {imageUrls.map((url, i) => (
                  <div className="g2-preview-item" key={i}>
                    <img src={url} alt="" className="g2-preview-img" />
                    <button type="button" className="g2-preview-remove" onClick={() => removeImage(i)} aria-label="ลบ">×</button>
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
              <span className="g2-cld-icon">📷</span>
              <span>{imageUrls.length === 0 ? 'เลือกรูปภาพ' : `เพิ่มรูปอีก (${imageUrls.length}/10)`}</span>
            </button>

            {imageUrls.length > 0 && (
              <div className="g2-img-bar">
                <div className="g2-img-bar-track">
                  <div className="g2-img-bar-fill" style={{ width: `${(imageUrls.length / 10) * 100}%`, background: '#7c3aed' }}></div>
                </div>
                <div className="g2-img-bar-label" style={{ color: '#7c3aed' }}>
                  {imageUrls.length}/10 รูป ✓
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
