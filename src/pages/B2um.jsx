import { useState } from 'react'
import { db } from '../firebase.js'
import { collection, addDoc } from 'firebase/firestore'
import Footer from '../components/Footer.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faImage, faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons'

import { formatPhone } from '../utils/formatPhone.js'
import { uploadToCloudinary } from '../utils/cloudinary.js'

import { GIVE_SHEET_ENDPOINT as SHEET_ENDPOINT } from '../utils/endpoints.js'

const EMPTY = { fname: '', lname: '', phone: '', shopName: '' }

export default function B2um() {
  const [form, setForm] = useState(EMPTY)
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const uploadImages = async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    setUploading(true)
    try {
      const results = await Promise.all(files.map((f) => uploadToCloudinary(f, 'image')))
      setImages((prev) => [...prev, ...results.map((r) => r.url)])
    } catch (err) {
      setError('อัพโหลดภาพไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeImage = (i) => setImages((prev) => prev.filter((_, j) => j !== i))

  const submit = async () => {
    setError('')
    if (!form.fname.trim()) return setError('กรุณากรอกชื่อ')
    if (!form.lname.trim()) return setError('กรุณากรอกนามสกุล')
    if (!form.phone.trim()) return setError('กรุณากรอกเบอร์โทรศัพท์')
    if (!/^[0-9+\-\s]{6,15}$/.test(form.phone.trim())) return setError('เบอร์โทรศัพท์ไม่ถูกต้อง')
    if (!form.shopName.trim()) return setError('กรุณากรอกชื่อร้านค้า/ธุรกิจ')

    setSubmitting(true)
    const regData = {
      type: 'b2um',
      date: new Date().toLocaleString('th-TH'),
      fname: form.fname.trim(),
      lname: form.lname.trim(),
      phone: formatPhone(form.phone),
      shopName: form.shopName.trim(),
      images: images.join(', '),
    }
    try {
      const res = await fetch(SHEET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(regData),
      })
      if (!res.ok) throw new Error(`server error ${res.status}`)
      const out = await res.json()
      if (!out.ref) throw new Error('no ref')

      await addDoc(collection(db, 'b2umRegs'), { ref: out.ref, ...regData, images })
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError('ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setForm(EMPTY); setImages([]); setError(''); setSuccess(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="page b2um-page">
      <section className="b2um-hero">
        <div className="inner">
          <span className="b2um-eyebrow">Give ครั้งที่ 6 · B2UM</span>
          <h1 className="b2um-h1">B2UM</h1>
          <p className="b2um-lead">ลงทะเบียนร้านค้า/ธุรกิจ เข้าร่วมงาน Give ครั้งที่ 6<br />ทุกยอดขาย 1 บาท ร่วมบริจาคให้มูลนิธิอุมมะตี</p>
        </div>
      </section>

      <section className="b2um-stage">
        {success ? (
          <div className="iftar-success">
            <div className="success-card">
              <div className="success-check"><FontAwesomeIcon icon={faCheck} /></div>
              <h2>ลงทะเบียนสำเร็จ!</h2>
              <p>ขอบคุณที่สนใจเข้าร่วมงาน B2UM — ทีมงานจะติดต่อกลับเร็วๆ นี้</p>
              <button className="btn btn-primary" style={{ marginTop: 22, justifyContent: 'center' }} onClick={reset}>
                ลงทะเบียนร้านค้าเพิ่ม
              </button>
            </div>
          </div>
        ) : (
          <div className="b2um-card">
            <div className="form-shell">
              <h2>แบบฟอร์มลงทะเบียนร้านค้า B2UM</h2>
              <p className="fs-sub">กรอกข้อมูลเพื่อสมัครเข้าร่วมงาน · ใช้เวลาไม่ถึง 1 นาที</p>

              <div className="iftar-row">
                <div className="iftar-field">
                  <label className="iftar-label">ชื่อ <span className="req">*</span></label>
                  <input className="iftar-input" type="text" placeholder="ชื่อจริง" value={form.fname} onChange={set('fname')} autoComplete="given-name" />
                </div>
                <div className="iftar-field">
                  <label className="iftar-label">นามสกุล <span className="req">*</span></label>
                  <input className="iftar-input" type="text" placeholder="นามสกุล" value={form.lname} onChange={set('lname')} autoComplete="family-name" />
                </div>
              </div>

              <div className="iftar-field">
                <label className="iftar-label">เบอร์โทรศัพท์ <span className="req">*</span></label>
                <input className="iftar-input" type="tel" placeholder="08X-XXX-XXXX" maxLength={15} value={form.phone} onChange={set('phone')} autoComplete="tel" />
              </div>

              <div className="iftar-field">
                <label className="iftar-label">ชื่อร้านค้า / ธุรกิจ <span className="req">*</span></label>
                <input className="iftar-input" type="text" placeholder="เช่น ร้านอาหารฮาลาล, แบรนด์เสื้อผ้า..." value={form.shopName} onChange={set('shopName')} />
              </div>

              <div className="iftar-field">
                <label className="iftar-label">ภาพร้านค้าและสินค้า</label>
                {images.length > 0 && (
                  <div className="admin-media-preview" style={{ marginBottom: 12 }}>
                    {images.map((url, i) => (
                      <div key={i} className="admin-media-thumb">
                        <img src={url} alt="" />
                        <button type="button" className="admin-media-remove" onClick={() => removeImage(i)}><FontAwesomeIcon icon={faXmark} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="admin-upload-btn" style={{ opacity: uploading ? .6 : 1, pointerEvents: uploading ? 'none' : 'auto' }}>
                  <FontAwesomeIcon icon={uploading ? faSpinner : faImage} spin={uploading} />
                  {uploading ? ' กำลังอัพโหลด...' : ' เพิ่มภาพ'}
                  <input type="file" accept="image/*" multiple hidden onChange={uploadImages} />
                </label>
              </div>

              {error && <div className="iftar-error">{error}</div>}

              <button className="btn btn-donate iftar-submit" onClick={submit} disabled={submitting}>
                {submitting ? 'กำลังบันทึก...' : 'ยืนยันการลงทะเบียน'}
              </button>
            </div>
          </div>
        )}
      </section>
      <Footer />
    </main>
  )
}
