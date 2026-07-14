import { useState } from 'react'
import { db } from '../firebase.js'
import { collection, addDoc } from 'firebase/firestore'
import Footer from '../components/Footer.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLaptop, faCheck, faArrowLeft } from '@fortawesome/free-solid-svg-icons'

import { GIVE_SHEET_ENDPOINT as SHEET_ENDPOINT, GIVE_SHEET_TOKEN as SHEET_TOKEN } from '../utils/endpoints.js'

import { formatPhone } from '../utils/formatPhone.js'

const AGES_STUDENT = Array.from({ length: 69 }, (_, i) => i + 12)
const EMPTY = { fname: '', lname: '', phone: '', email: '', address: '', school: '', age: '', teacherName: '', teacherPhone: '', reason: '' }

export default function Give2ComReceive() {
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
    if (!form.address.trim()) return setError('กรุณากรอกที่อยู่สำหรับจัดส่ง')
    if (!form.school.trim()) return setError('กรุณากรอกชื่อโรงเรียน')
    if (!form.teacherName.trim()) return setError('กรุณากรอกชื่ออาจารย์ที่ปรึกษา')
    if (!form.teacherPhone.trim()) return setError('กรุณากรอกเบอร์โทรอาจารย์')
    if (!form.reason.trim()) return setError('กรุณากรอกเหตุผลที่ต้องการรับมอบ')

    setSubmitting(true)
    try {
      await addDoc(collection(db, 'giveReceiveRegs'), {
        type: 'computer',
        date: new Date().toLocaleString('th-TH'),
        fname: form.fname.trim(), lname: form.lname.trim(),
        phone: formatPhone(form.phone), email: form.email.trim(),
        address: form.address.trim(), age: form.age,
        school: form.school.trim(),
        teacherName: form.teacherName.trim(),
        teacherPhone: formatPhone(form.teacherPhone),
        reason: form.reason.trim(),
      })
      const payload = {
        type: 'give2comreceive',
        date: new Date().toLocaleString('th-TH'),
        fname: form.fname.trim(), lname: form.lname.trim(),
        phone: formatPhone(form.phone), email: form.email.trim(),
        age: form.age, school: form.school.trim(),
        teacherName: form.teacherName.trim(), teacherPhone: formatPhone(form.teacherPhone),
        address: form.address.trim(), reason: form.reason.trim(),
      }
      fetch(SHEET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: SHEET_TOKEN, ...payload }),
      }).catch(() => {})
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { setError('ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่') }
    finally { setSubmitting(false) }
  }

  const reset = () => { setForm(EMPTY); setError(''); setSuccess(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return (
    <main className="page give-page">
      <section className="b2um-hero">
        <div className="inner">
          <span className="b2um-eyebrow">UMMATEE · มอบคอมมือสองเพื่อสองได้เรียน</span>
          <h1 className="b2um-h1"><FontAwesomeIcon icon={faLaptop} /> รับคอมมือสอง</h1>
          <p className="b2um-lead">ลงทะเบียนล่วงหน้าเพื่อรับ Notebook / Tablet มือสองในงานให้ ครั้งที่ 6</p>
        </div>
      </section>

      <section className="b2um-stage">
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

              <h2><FontAwesomeIcon icon={faLaptop} style={{ color: '#7c3aed' }} /> นักเรียนและนักศึกษา</h2>
              <p className="fs-sub"></p>

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
                  <label className="iftar-label">เบอร์โทรนักเรียน <span className="req">*</span></label>
                  <input className="iftar-input" type="tel" placeholder="08X-XXX-XXXX" maxLength={15} value={form.phone} onChange={set('phone')} autoComplete="tel" />
                </div>
                <div className="iftar-field">
                  <label className="iftar-label">อายุ <span className="req">*</span></label>
                  <select className="iftar-input" value={form.age} onChange={set('age')}>
                    <option value="" disabled>เลือกอายุ</option>
                    {AGES_STUDENT.map((a) => <option key={a} value={a}>{a} ปี</option>)}
                  </select>
                </div>
              </div>

              <div className="iftar-row">
                <div className="iftar-field">
                  <label className="iftar-label">อีเมล <span className="req-opt">(ไม่บังคับ)</span></label>
                  <input className="iftar-input" type="email" placeholder="example@email.com" value={form.email} onChange={set('email')} autoComplete="email" />
                </div>
              </div>

              <div className="iftar-field">
                <label className="iftar-label">ที่อยู่สำหรับจัดส่ง <span className="req">*</span></label>
                <textarea className="iftar-input" rows={3} placeholder="บ้านเลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์" value={form.address} onChange={set('address')} />
              </div>

              <div className="iftar-field">
                <label className="iftar-label">โรงเรียน <span className="req">*</span></label>
                <input className="iftar-input" type="text" placeholder="ชื่อโรงเรียน" value={form.school} onChange={set('school')} />
              </div>

              <div className="iftar-row">
                <div className="iftar-field">
                  <label className="iftar-label">ชื่ออาจารย์ที่ปรึกษา/ผู้ปกครอง <span className="req">*</span></label>
                  <input className="iftar-input" type="text" placeholder="ชื่อ-นามสกุล อาจารย์/ผู้ปกครอง" value={form.teacherName} onChange={set('teacherName')} />
                </div>
                <div className="iftar-field">
                  <label className="iftar-label">เบอร์โทรอาจารย์/ผู้ปกครอง <span className="req">*</span></label>
                  <input className="iftar-input" type="tel" placeholder="08X-XXX-XXXX" maxLength={15} value={form.teacherPhone} onChange={set('teacherPhone')} />
                </div>
              </div>

              <div className="iftar-field">
                <label className="iftar-label">เหตุผลที่ต้องการรับมอบ <span className="req">*</span></label>
                <textarea className="iftar-input" rows={4} placeholder="อธิบายว่าคุณต้องการคอมพิวเตอร์เพื่อใช้ทำอะไร และทำไมถึงต้องการรับมอบ" value={form.reason} onChange={set('reason')} />
              </div>

              {error && <div className="iftar-error">{error}</div>}
              <button className="btn btn-donate iftar-submit" onClick={submit} disabled={submitting}>
                {submitting ? 'กำลังบันทึก...' : 'ยืนยันการลงทะเบียน'}
              </button>
          </div>
        )}
      </section>
      <Footer />
    </main>
  )
}
