import { useState } from 'react'
import { db } from '../firebase.js'
import { collection, addDoc } from 'firebase/firestore'
import { QRCodeSVG } from 'qrcode.react'
import Footer from '../components/Footer.jsx'

const VOLUNTEER_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyz1XLqpQ6bkA7aPX4K3nbag02JIv27Lkquf6jSub8dzVMK3UIAiNETrS1uTlv_UGVh/exec'

const AGES = Array.from({ length: 83 }, (_, i) => i + 18)

const PROVINCES = [
  'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา',
  'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก',
  'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน',
  'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา',
  'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่', 'ภูเก็ต', 'มหาสารคาม',
  'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี',
  'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม',
  'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์',
  'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี',
]

const CHANNELS = ['Facebook', 'Instagram', 'LINE', 'TikTok', 'Threads', 'Twitter', 'เพื่อน/ครอบครัว', 'อื่นๆ']

function formatPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '')
  if (/^0\d{9}$/.test(digits)) return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3')
  return (raw || '').trim()
}

async function saveToFirestore(data, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try { await addDoc(collection(db, 'volunteerRegs'), data); return true }
    catch (e) { if (i === attempts - 1) return false; await new Promise(r => setTimeout(r, 600 * (i + 1))) }
  }
  return false
}

function Chip({ label, active, onClick }) {
  return (
    <button type="button" className={`iftar-chip ${active ? 'selected' : ''}`} onClick={onClick}>
      {label}
    </button>
  )
}

const EMPTY = { fname: '', lname: '', fnameEn: '', lnameEn: '', phone: '', email: '', age: '', province: '', expect: '', skills: '', note: '' }

export default function VolunteerRegister() {
  const [form, setForm] = useState(EMPTY)
  const [gender, setGender] = useState('')
  const [channel, setChannel] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successRef, setSuccessRef] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setError('')
    if (!form.fname.trim()) return setError('กรุณากรอกชื่อ')
    if (!form.lname.trim()) return setError('กรุณากรอกนามสกุล')
    if (!form.phone.trim()) return setError('กรุณากรอกเบอร์โทรศัพท์')
    if (!/^[0-9+\-\s]{6,15}$/.test(form.phone.trim())) return setError('เบอร์โทรศัพท์ไม่ถูกต้อง')
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('รูปแบบอีเมลไม่ถูกต้อง')
    if (!form.age) return setError('กรุณาเลือกอายุ')
    if (!gender) return setError('กรุณาเลือกเพศ')
    if (!form.fnameEn.trim()) return setError('กรุณากรอกชื่อภาษาอังกฤษ')
    if (!form.lnameEn.trim()) return setError('กรุณากรอกนามสกุลภาษาอังกฤษ')
    if (!form.province) return setError('กรุณาเลือกจังหวัด')
    if (!channel) return setError('กรุณาเลือกช่องทางที่รู้จักอุมมะตี')
    if (!form.skills.trim()) return setError('กรุณากรอกทักษะ/ความสามารถพิเศษ')
    if (!form.expect.trim()) return setError('กรุณากรอกสิ่งที่คาดหวัง')

    setSubmitting(true)
    const regData = {
      type: 'volunteer',
      date: new Date().toLocaleString('th-TH'),
      fname: form.fname.trim(),
      lname: form.lname.trim(),
      fnameEn: form.fnameEn.trim(),
      lnameEn: form.lnameEn.trim(),
      phone: formatPhone(form.phone),
      email: form.email.trim(),
      age: form.age,
      gender,
      province: form.province,
      channel,
      expect: form.expect.trim(),
      skills: form.skills.trim(),
      note: form.note.trim(),
    }

    try {
      const res = await fetch(VOLUNTEER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(regData),
      })
      const out = await res.json()
      if (!out.ref) throw new Error('no ref')
      const saved = { ref: out.ref, ...regData }

      await saveToFirestore(saved)

      try {
        const regs = JSON.parse(localStorage.getItem('volunteerRegs') || '[]')
        regs.push(saved)
        localStorage.setItem('volunteerRegs', JSON.stringify(regs))
      } catch (e) { /* noop */ }

      setSuccessRef(out.ref)
      setTimeout(() => {
        document.getElementById('volunteer-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    } catch (e) {
      setError('ส่งข้อมูลไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setForm(EMPTY); setGender(''); setChannel(''); setError(''); setSuccessRef(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="page volunteer-page">

      <section className="iftar-hero" style={{ paddingBottom: 40 }}>
        <div className="fc-pattern hero-pattern" />
        <div className="inner">
          <img src="/logo.png" alt="Ummatee" style={{ height: 250, display: 'block', margin: '0 auto 10px', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,.35))' }} />
          <h1> อาสาสมัคร<br /><span className="moon">Ummatee</span></h1>
          <p className="iftar-tagline">ร่วมเป็นส่วนหนึ่งของการช่วยเหลือ</p>
          <p className="lead">ลงทะเบียนเพื่อเข้าร่วมเป็นอาสาสมัครมูลนิธิอุมมะตี ช่วยเหลือกิจกรรม งานมนุษยธรรม และการสนับสนุนชุมชน</p>
        </div>
      </section>

      <section className="iftar-stage" id="volunteer-form">
        {successRef ? (
          <div className="iftar-success">
            <div className="success-card">
              <div className="success-check">✓</div>
              <h2>ลงทะเบียนสำเร็จ!</h2>
              <p>ญะซากัลลอฮุค็อยรอน — ขอบคุณที่สมัครเป็นอาสาสมัครกับมูลนิธิอุมมะตี</p>
              <div className="success-qr">
                <QRCodeSVG value={successRef} size={188} level="M" marginSize={2} />
              </div>
              <div className="ref-pill">{successRef}</div>
              <p>กรุณาบันทึกรหัสอาสาสมัครนี้ไว้เพื่อใช้อ้างอิง</p>
              {form.email.trim() && (
                <p className="success-email-note">📧 ทีมงานจะติดต่อกลับทาง {form.email.trim()}</p>
              )}
              <button className="btn btn-primary" style={{ marginTop: 22, justifyContent: 'center' }} onClick={reset}>
                ลงทะเบียนเพิ่มอีกคน
              </button>
            </div>
          </div>
        ) : (
          <div className="iftar-card">
            <div className="form-shell">
              <h2>แบบฟอร์มลงทะเบียนอาสาสมัคร</h2>
              <p className="fs-sub">กรอกข้อมูลเพื่อสมัครเป็นอาสาสมัครมูลนิธิอุมมะตี · ใช้เวลาไม่ถึง 1 นาที</p>

              <div className="iftar-row">
                <div className="iftar-field">
                  <label className="iftar-label">ชื่อ <span className="req">*</span></label>
                  <input className="iftar-input" type="text" placeholder="ชื่อจริง" value={form.fname} onChange={set('fname')} />
                </div>
                <div className="iftar-field">
                  <label className="iftar-label">นามสกุล <span className="req">*</span></label>
                  <input className="iftar-input" type="text" placeholder="นามสกุล" value={form.lname} onChange={set('lname')} />
                </div>
              </div>

              <div className="iftar-row">
                <div className="iftar-field">
                  <label className="iftar-label">First Name (English) <span className="req">*</span></label>
                  <input className="iftar-input" type="text" placeholder="First name" value={form.fnameEn} onChange={set('fnameEn')} />
                </div>
                <div className="iftar-field">
                  <label className="iftar-label">Last Name (English) <span className="req">*</span></label>
                  <input className="iftar-input" type="text" placeholder="Last name" value={form.lnameEn} onChange={set('lnameEn')} />
                </div>
              </div>

              <div className="iftar-row">
                <div className="iftar-field">
                  <label className="iftar-label">เบอร์โทรศัพท์ <span className="req">*</span></label>
                  <input className="iftar-input" type="tel" placeholder="08X-XXX-XXXX" maxLength={15} value={form.phone} onChange={set('phone')} />
                </div>
                <div className="iftar-field">
                  <label className="iftar-label">อีเมล</label>
                  <input className="iftar-input" type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} />
                </div>
              </div>

              <div className="iftar-row">
                <div className="iftar-field">
                  <label className="iftar-label">เพศ <span className="req">*</span></label>
                  <div className="chip-wrap">
                    {['ชาย', 'หญิง'].map((g) => (
                      <Chip key={g} label={g} active={gender === g} onClick={() => setGender(gender === g ? '' : g)} />
                    ))}
                  </div>
                </div>
                <div className="iftar-field">
                  <label className="iftar-label">อายุ <span className="req">*</span></label>
                  <select className="iftar-input" value={form.age} onChange={set('age')}>
                    <option value="" disabled>เลือกอายุ</option>
                    {AGES.map((a) => <option key={a} value={a}>{a} ปี</option>)}
                  </select>
                </div>
              </div>

              <div className="iftar-field">
                <label className="iftar-label">จังหวัด <span className="req">*</span></label>
                <select className="iftar-input" value={form.province} onChange={set('province')}>
                  <option value="">เลือกจังหวัด</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="iftar-field">
                <label className="iftar-label">รู้จักอุมมะตีจากช่องทางใด <span className="req">*</span></label>
                <div className="chip-wrap">
                  {CHANNELS.map((c) => (
                    <Chip key={c} label={c} active={channel === c} onClick={() => setChannel(channel === c ? '' : c)} />
                  ))}
                </div>
              </div>

              <div className="iftar-field">
                <label className="iftar-label">สิ่งที่คาดหวังจากการเป็น Ummatee Volunteer <span className="req">*</span></label>
                <textarea className="iftar-input" rows={3} placeholder="เช่น อยากช่วยเหลือผู้ที่ต้องการความช่วยเหลือ อยากเรียนรู้งานมนุษยธรรม..." value={form.expect} onChange={set('expect')} />
              </div>

              <div className="iftar-field">
                <label className="iftar-label">ทักษะ / ความสามารถพิเศษ <span className="req">*</span></label>
                <input className="iftar-input" type="text" placeholder="เช่น ถ่ายภาพ, ออกแบบ, ภาษาอาหรับ, ขับรถ..." value={form.skills} onChange={set('skills')} />
              </div>

              <div className="iftar-field">
                <label className="iftar-label">ข้อความเพิ่มเติม</label>
                <textarea className="iftar-input" placeholder="อยากบอกอะไรกับทีมงาน..." value={form.note} onChange={set('note')} />
              </div>

              {error && <div className="iftar-error">{error}</div>}

              <button className="btn btn-donate iftar-submit" onClick={submit} disabled={submitting}>
                {submitting ? 'กำลังบันทึก...' : 'ยืนยันการสมัคร'}
              </button>
            </div>
          </div>
        )}
      </section>
      <Footer />
    </main>
  )
}
