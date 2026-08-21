import { useState } from 'react'
import { db } from '../firebase.js'
import { collection, addDoc } from 'firebase/firestore'
import Footer from '../components/Footer.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLaptop, faUtensils, faCheck, faArrowLeft } from '@fortawesome/free-solid-svg-icons'

import { formatPhone } from '../utils/formatPhone.js'

const AGES_STUDENT = Array.from({ length: 69 }, (_, i) => i + 12)
const AGES_ADULT = Array.from({ length: 63 }, (_, i) => i + 18)

const EMPTY_COM = { fname: '', lname: '', phone: '', school: '', age: '', teacherName: '', teacherPhone: '' }
const EMPTY_EQUIP = { fname: '', lname: '', phone: '', age: '', job: '', detail: '' }

export default function GiveReceive() {
  const [mode, setMode] = useState(null)
  const [comForm, setComForm] = useState(EMPTY_COM)
  const [equipForm, setEquipForm] = useState(EMPTY_EQUIP)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const setC = (k) => (e) => setComForm((f) => ({ ...f, [k]: e.target.value }))
  const setE = (k) => (e) => setEquipForm((f) => ({ ...f, [k]: e.target.value }))

  const submitComputer = async () => {
    setError('')
    const f = comForm
    if (!f.fname.trim()) return setError('กรุณากรอกชื่อ')
    if (!f.lname.trim()) return setError('กรุณากรอกนามสกุล')
    if (!f.phone.trim()) return setError('กรุณากรอกเบอร์โทร')
    if (!/^[0-9+\-\s]{6,15}$/.test(f.phone.trim())) return setError('เบอร์โทรไม่ถูกต้อง')
    if (!f.age) return setError('กรุณาเลือกอายุ')
    if (!f.school.trim()) return setError('กรุณากรอกชื่อโรงเรียน')
    if (!f.teacherName.trim()) return setError('กรุณากรอกชื่ออาจารย์ที่ปรึกษา')
    if (!f.teacherPhone.trim()) return setError('กรุณากรอกเบอร์โทรอาจารย์')

    setSubmitting(true)
    try {
      await addDoc(collection(db, 'giveReceiveRegs'), {
        type: 'computer',
        date: new Date().toLocaleString('th-TH'),
        fname: f.fname.trim(), lname: f.lname.trim(),
        phone: formatPhone(f.phone), age: f.age,
        school: f.school.trim(),
        teacherName: f.teacherName.trim(),
        teacherPhone: formatPhone(f.teacherPhone),
      })
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { setError('ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่') }
    finally { setSubmitting(false) }
  }

  const submitEquip = async () => {
    setError('')
    const f = equipForm
    if (!f.fname.trim()) return setError('กรุณากรอกชื่อ')
    if (!f.lname.trim()) return setError('กรุณากรอกนามสกุล')
    if (!f.phone.trim()) return setError('กรุณากรอกเบอร์โทร')
    if (!/^[0-9+\-\s]{6,15}$/.test(f.phone.trim())) return setError('เบอร์โทรไม่ถูกต้อง')
    if (!f.age) return setError('กรุณาเลือกอายุ')
    if (!f.job.trim()) return setError('กรุณากรอกอาชีพ')
    if (!f.detail.trim()) return setError('กรุณากรอกรายละเอียดสิ่งที่ทำ')

    setSubmitting(true)
    try {
      await addDoc(collection(db, 'giveReceiveRegs'), {
        type: 'equipment',
        date: new Date().toLocaleString('th-TH'),
        fname: f.fname.trim(), lname: f.lname.trim(),
        phone: formatPhone(f.phone), age: f.age,
        job: f.job.trim(), detail: f.detail.trim(),
      })
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { setError('ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่') }
    finally { setSubmitting(false) }
  }

  const reset = () => {
    setMode(null); setComForm(EMPTY_COM); setEquipForm(EMPTY_EQUIP)
    setError(''); setSuccess(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="page give-page">
      <section className="b2um-hero">
        <div className="inner">
          <span className="b2um-eyebrow">Give ครั้งที่ 6 · ลงทะเบียนรับของ</span>
          <h1 className="b2um-h1">ลงทะเบียนรับของ</h1>
          <p className="b2um-lead">ลงทะเบียนล่วงหน้าเพื่อรับคอมมือสองหรืออุปกรณ์ประกอบอาชีพในงาน Give ครั้งที่ 6</p>
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
        ) : !mode ? (
          <div className="giver-choose">
            <h2 className="giver-choose-title">เลือกประเภทที่ต้องการรับ</h2>
            <div className="giver-cards">
              <button className="giver-option" onClick={() => { window.history.pushState({}, '', '/event/give-for-um/receive/computer'); window.dispatchEvent(new PopStateEvent('popstate')) }}>
                <div className="giver-option-icon" style={{ color: '#7c3aed' }}><FontAwesomeIcon icon={faLaptop} /></div>
                <h3>รับคอมมือสอง</h3>
                <p>สำหรับนักเรียนและผู้สนใจ</p>
                <span className="giver-option-badge">ลงทะเบียน →</span>
              </button>
              <button className="giver-option" onClick={() => { window.history.pushState({}, '', '/event/give-for-um/receive/equipment'); window.dispatchEvent(new PopStateEvent('popstate')) }}>
                <div className="giver-option-icon" style={{ color: '#d97706' }}><FontAwesomeIcon icon={faUtensils} /></div>
                <h3>รับอุปกรณ์ประกอบอาชีพ</h3>
                <p>เครื่องปั่น เตาปิ้ง อุปกรณ์ครัว</p>
                <span className="giver-option-badge" style={{ background: '#d97706' }}>ลงทะเบียน →</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="b2um-card">
            <div className="form-shell">
              <button className="giver-back" onClick={() => { setMode(null); setError('') }}>
                <FontAwesomeIcon icon={faArrowLeft} /> เลือกประเภทใหม่
              </button>

              {mode === 'computer' ? (
                <>
                  <h2><FontAwesomeIcon icon={faLaptop} style={{ color: '#7c3aed' }} /> รับคอมมือสอง</h2>
                  <p className="fs-sub">สำหรับนักเรียนและผู้สนใจ</p>

                  <div className="iftar-row">
                    <div className="iftar-field">
                      <label className="iftar-label">ชื่อนักเรียน <span className="req">*</span></label>
                      <input className="iftar-input" type="text" placeholder="ชื่อจริง" value={comForm.fname} onChange={setC('fname')} autoComplete="given-name" />
                    </div>
                    <div className="iftar-field">
                      <label className="iftar-label">นามสกุล <span className="req">*</span></label>
                      <input className="iftar-input" type="text" placeholder="นามสกุล" value={comForm.lname} onChange={setC('lname')} autoComplete="family-name" />
                    </div>
                  </div>

                  <div className="iftar-row">
                    <div className="iftar-field">
                      <label className="iftar-label">เบอร์โทรนักเรียน <span className="req">*</span></label>
                      <input className="iftar-input" type="tel" placeholder="08X-XXX-XXXX" maxLength={15} value={comForm.phone} onChange={setC('phone')} autoComplete="tel" />
                    </div>
                    <div className="iftar-field">
                      <label className="iftar-label">อายุ <span className="req">*</span></label>
                      <select className="iftar-input" value={comForm.age} onChange={setC('age')}>
                        <option value="" disabled>เลือกอายุ</option>
                        {AGES_STUDENT.map((a) => <option key={a} value={a}>{a} ปี</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="iftar-field">
                    <label className="iftar-label">โรงเรียน <span className="req">*</span></label>
                    <input className="iftar-input" type="text" placeholder="ชื่อโรงเรียน" value={comForm.school} onChange={setC('school')} />
                  </div>

                  <div className="iftar-row">
                    <div className="iftar-field">
                      <label className="iftar-label">ชื่ออาจารย์ที่ปรึกษา <span className="req">*</span></label>
                      <input className="iftar-input" type="text" placeholder="ชื่อ-นามสกุล อาจารย์" value={comForm.teacherName} onChange={setC('teacherName')} />
                    </div>
                    <div className="iftar-field">
                      <label className="iftar-label">เบอร์โทรอาจารย์ <span className="req">*</span></label>
                      <input className="iftar-input" type="tel" placeholder="08X-XXX-XXXX" maxLength={15} value={comForm.teacherPhone} onChange={setC('teacherPhone')} />
                    </div>
                  </div>

                  {error && <div className="iftar-error">{error}</div>}
                  <button className="btn btn-donate iftar-submit" onClick={submitComputer} disabled={submitting}>
                    {submitting ? 'กำลังบันทึก...' : 'ยืนยันการลงทะเบียน'}
                  </button>
                </>
              ) : (
                <>
                  <h2><FontAwesomeIcon icon={faUtensils} style={{ color: '#d97706' }} /> รับอุปกรณ์ประกอบอาชีพ</h2>
                  <p className="fs-sub">เครื่องปั่น เตาปิ้ง อุปกรณ์ครัว สำหรับผู้ใหญ่</p>

                  <div className="iftar-row">
                    <div className="iftar-field">
                      <label className="iftar-label">ชื่อ <span className="req">*</span></label>
                      <input className="iftar-input" type="text" placeholder="ชื่อจริง" value={equipForm.fname} onChange={setE('fname')} autoComplete="given-name" />
                    </div>
                    <div className="iftar-field">
                      <label className="iftar-label">นามสกุล <span className="req">*</span></label>
                      <input className="iftar-input" type="text" placeholder="นามสกุล" value={equipForm.lname} onChange={setE('lname')} autoComplete="family-name" />
                    </div>
                  </div>

                  <div className="iftar-row">
                    <div className="iftar-field">
                      <label className="iftar-label">เบอร์โทรศัพท์ <span className="req">*</span></label>
                      <input className="iftar-input" type="tel" placeholder="08X-XXX-XXXX" maxLength={15} value={equipForm.phone} onChange={setE('phone')} autoComplete="tel" />
                    </div>
                    <div className="iftar-field">
                      <label className="iftar-label">อายุ <span className="req">*</span></label>
                      <select className="iftar-input" value={equipForm.age} onChange={setE('age')}>
                        <option value="" disabled>เลือกอายุ</option>
                        {AGES_ADULT.map((a) => <option key={a} value={a}>{a} ปี</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="iftar-field">
                    <label className="iftar-label">อาชีพ <span className="req">*</span></label>
                    <input className="iftar-input" type="text" placeholder="เช่น ขายอาหาร, ค้าขาย, รับจ้าง..." value={equipForm.job} onChange={setE('job')} />
                  </div>

                  <div className="iftar-field">
                    <label className="iftar-label">รายละเอียดสิ่งที่ทำ <span className="req">*</span></label>
                    <textarea className="iftar-input" rows={3} placeholder="เช่น ขายน้ำปั่นหน้าบ้าน ต้องการเครื่องปั่น..." value={equipForm.detail} onChange={setE('detail')} />
                  </div>

                  {error && <div className="iftar-error">{error}</div>}
                  <button className="btn btn-donate iftar-submit" onClick={submitEquip} disabled={submitting}>
                    {submitting ? 'กำลังบันทึก...' : 'ยืนยันการลงทะเบียน'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </section>
      <Footer />
    </main>
  )
}
