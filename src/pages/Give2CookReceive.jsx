import { useState } from 'react'
import { db } from '../firebase.js'
import { collection, addDoc } from 'firebase/firestore'
import Footer from '../components/Footer.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUtensils, faCheck, faArrowLeft } from '@fortawesome/free-solid-svg-icons'

import { formatPhone } from '../utils/formatPhone.js'

import { GIVE_SHEET_ENDPOINT as SHEET_ENDPOINT, GIVE_SHEET_TOKEN as SHEET_TOKEN } from '../utils/endpoints.js'

const AGES_ADULT = Array.from({ length: 63 }, (_, i) => i + 18)
const EMPTY = { fname: '', lname: '', phone: '', email: '', age: '', job: '', detail: '', address: '', wantedItems: '', reason: '' }

export default function Give2CookReceive() {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setError('')
    if (!form.fname.trim()) return setError('กรุณากรอกชื่อ')
    if (!form.lname.trim()) return setError('กรุณากรอกนามสกุล')
    if (!form.phone.trim()) return setError('กรุณากรอกเบอร์โทร')
    if (!/^[0-9+\-\s]{6,15}$/.test(form.phone.trim())) return setError('เบอร์โทรไม่ถูกต้อง')
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('อีเมลไม่ถูกต้อง')
    if (!form.age) return setError('กรุณาเลือกอายุ')
    if (!form.job.trim()) return setError('กรุณากรอกอาชีพ')
    if (!form.detail.trim()) return setError('กรุณากรอกรายละเอียดสิ่งที่ทำ')
    if (!form.address.trim()) return setError('กรุณากรอกที่อยู่สำหรับจัดส่ง')
    if (!form.wantedItems.trim()) return setError('กรุณากรอกสิ่งของที่ต้องการ')
    if (!form.reason.trim()) return setError('กรุณากรอกเหตุผลที่ต้องการรับของ')

    setSubmitting(true)
    try {
      await addDoc(collection(db, 'giveReceiveRegs'), {
        type: 'equipment',
        date: new Date().toLocaleString('th-TH'),
        fname: form.fname.trim(), lname: form.lname.trim(),
        phone: formatPhone(form.phone), email: form.email.trim(),
        age: form.age, job: form.job.trim(), detail: form.detail.trim(),
        address: form.address.trim(),
        wantedItems: form.wantedItems.trim(),
        reason: form.reason.trim(),
      })
      fetch(SHEET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: SHEET_TOKEN, type: 'give2cookreceive',
          date: new Date().toLocaleString('th-TH'),
          fname: form.fname.trim(), lname: form.lname.trim(),
          phone: formatPhone(form.phone), email: form.email.trim(),
          age: form.age, job: form.job.trim(), detail: form.detail.trim(),
          address: form.address.trim(), wantedItems: form.wantedItems.trim(),
          reason: form.reason.trim(),
        }),
      }).catch(() => {})
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { setError('ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่') }
    finally { setSubmitting(false) }
  }

  const reset = () => { setForm(EMPTY); setError(''); setSuccess(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return (
    <main className="page give-page">
      <section className="b2um-hero b2um-hero--cook">
        <div className="inner">
          <span className="b2um-eyebrow">มูลนิธิอุมมะตี · มอบอุปกรณ์ครัวแก่ผู้ยากไร้</span>
          <h1 className="b2um-h1"><FontAwesomeIcon icon={faUtensils} /> รับอุปกรณ์ครัวเพื่อประกอบอาชีพ</h1>
          <p className="b2um-lead">ลงทะเบียนรับอุปกรณ์ครัว เพื่อการประกอบอาชีพ</p>
        </div>
      </section>

      <section className="b2um-stage b2um-stage--cook">
        {success ? (
          <div className="iftar-success">
            <div className="success-card">
              <div className="success-check"><FontAwesomeIcon icon={faCheck} /></div>
              <h2>ลงทะเบียนสำเร็จ!</h2>
              <p>ขอบคุณที่ลงทะเบียน — ทีมงานจะติดต่อกลับเร็วๆ นี้</p>
              <button className="btn btn-primary" style={{ marginTop: 22, justifyContent: 'center' }} onClick={reset}>
                ลงทะเบียนเพิ่ม
              </button>
            </div>
          </div>
        ) : (
          <div className="b2um-card">
              <button className="giver-back" onClick={() => window.history.back()}>
                <FontAwesomeIcon icon={faArrowLeft} /> กลับ
              </button>

              <h2><FontAwesomeIcon icon={faUtensils} style={{ color: '#d97706' }} /> ผู้ต้องการรับมอบ</h2>
              

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

              <div className="iftar-row">
                <div className="iftar-field">
                  <label className="iftar-label">เบอร์โทรศัพท์ <span className="req">*</span></label>
                  <input className="iftar-input" type="tel" placeholder="08X-XXX-XXXX" maxLength={15} value={form.phone} onChange={set('phone')} autoComplete="tel" />
                </div>

 <div className="iftar-field">
                <label className="iftar-label">อีเมล <span className="req-opt">(ไม่บังคับ)</span></label>
                <input className="iftar-input" type="email" placeholder="example@email.com" value={form.email} onChange={set('email')} autoComplete="email" />
              </div>

                <div className="iftar-field">
                  <label className="iftar-label">อายุ <span className="req">*</span></label>
                  <select className="iftar-input" value={form.age} onChange={set('age')}>
                    <option value="" disabled>เลือกอายุ</option>
                    {AGES_ADULT.map((a) => <option key={a} value={a}>{a} ปี</option>)}
                  </select>
                </div>
              </div>

             

              <div className="iftar-field">
                <label className="iftar-label">อาชีพ <span className="req">*</span></label>
                <input className="iftar-input" type="text" placeholder="เช่น ขายอาหาร, ค้าขาย, รับจ้าง..." value={form.job} onChange={set('job')} />
              </div>

              <div className="iftar-field">
                <label className="iftar-label">รายละเอียดสิ่งที่ทำ <span className="req">*</span></label>
                <textarea className="iftar-input" rows={3} placeholder="เช่น ขายน้ำปั่นหน้าบ้าน ต้องการเครื่องปั่น..." value={form.detail} onChange={set('detail')} />
              </div>

              <div className="iftar-field">
                <label className="iftar-label">ที่อยู่สำหรับจัดส่ง <span className="req">*</span></label>
                <textarea className="iftar-input" rows={3} placeholder="บ้านเลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" value={form.address} onChange={set('address')} />
              </div>

              <div className="iftar-field">
                <label className="iftar-label">สิ่งของที่ต้องการ <span className="req">*</span></label>
                <input className="iftar-input" type="text" placeholder="เช่น เครื่องปั่น, เตาปิ้ง, หม้อหุงข้าว..." value={form.wantedItems} onChange={set('wantedItems')} />
              </div>

              <div className="iftar-field">
                <label className="iftar-label">เหตุผลที่ต้องการรับมอบ <span className="req">*</span></label>
                <textarea className="iftar-input" rows={4} placeholder="อธิบายว่าทำไมถึงต้องการรับสิ่งของนี้ และจะนำไปใช้ประโยชน์อย่างไร" value={form.reason} onChange={set('reason')} />
              </div>

              {error && <div className="iftar-error">{error}</div>}
              <button className="btn btn-donate iftar-submit" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }} onClick={submit} disabled={submitting}>
                {submitting ? 'กำลังบันทึก...' : 'ยืนยันการลงทะเบียน'}
              </button>
          </div>
        )}
      </section>
      <Footer />
    </main>
  )
}
