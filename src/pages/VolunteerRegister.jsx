import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Footer from '../components/Footer.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faEnvelope } from '@fortawesome/free-solid-svg-icons'

import { GIVE_SHEET_TOKEN } from '../utils/endpoints.js'
import { registerVolunteer } from '../data/volunteer.js'

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

import { formatPhone } from '../utils/formatPhone.js'

function Chip({ label, active, onClick }) {
  return (
    <button type="button" className={`iftar-chip ${active ? 'selected' : ''}`} onClick={onClick}>
      {label}
    </button>
  )
}

const SKILL_OPTIONS = ['แนะนำนิทรรศการ', 'ถ่ายภาพ/วิดีโอ', 'ลงทะเบียน', 'ขายสินค้า', 'Backstage', 'จุดรับบริจาค', 'Workshop', 'อื่นๆ']
const MISSION_OPTIONS = [
  { key: 'give', label: 'งาน Give ให้ ครั้งที่ 6', sub: '3-5 ก.ค. · 14:00-21:00 น.' },
]
const GIVE_PROJECTS = ['คอมมือสอง', 'อุปกรณ์ประกอบอาชีพ']
const GIVE_DATES = ['1 ก.ค.', '2 ก.ค.', '3 ก.ค.', '4 ก.ค.', '5 ก.ค.']

const EMPTY = { fname: '', lname: '', fnameEn: '', lnameEn: '', phone: '', email: '', age: '', province: '', expect: '', note: '' }

export default function VolunteerRegister() {
  const [form, setForm] = useState(EMPTY)
  const [gender, setGender] = useState('')
  const [channel, setChannel] = useState('')
  const [skills, setSkills] = useState([])
  const [missions, setMissions] = useState([])
  const [giveProjects, setGiveProjects] = useState([])
  const [giveDates, setGiveDates] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successRef, setSuccessRef] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggleList = (list, setList, v) => setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  const submit = async () => {
    setError('')
    if (!form.fname.trim()) return setError('กรุณากรอกชื่อ')
    if (!form.lname.trim()) return setError('กรุณากรอกนามสกุล')
    if (!form.phone.trim()) return setError('กรุณากรอกเบอร์โทรศัพท์')
    if (!/^[0-9+\-\s]{6,15}$/.test(form.phone.trim())) return setError('เบอร์โทรศัพท์ไม่ถูกต้อง')
    if (!form.email.trim()) return setError('กรุณากรอกอีเมล')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('รูปแบบอีเมลไม่ถูกต้อง')
    if (!form.age) return setError('กรุณาเลือกอายุ')
    if (!gender) return setError('กรุณาเลือกเพศ')
    if (!form.province) return setError('กรุณาเลือกจังหวัด')
    if (!channel) return setError('กรุณาเลือกช่องทางที่รู้จักอุมมะตี')
    if (skills.length === 0) return setError('กรุณาเลือกตำแหน่งอย่างน้อย 1 อย่าง')
    if (missions.length === 0) return setError('กรุณาเลือกภารกิจที่สนใจอย่างน้อย 1 งาน')

    setSubmitting(true)
    const regData = {
      type: 'volunteer',
      token: GIVE_SHEET_TOKEN,
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
      skills: skills.join(', '),
      missions: missions.map(k => MISSION_OPTIONS.find(m => m.key === k)?.label).join(', '),
      giveProjects: giveProjects.join(', '),
      giveDates: giveDates.join(', '),
      note: form.note.trim(),
    }

    try {
      // Firestore คือที่เก็บหลัก — ต้องเขียนสำเร็จก่อนถึงจะถือว่าสมัครสำเร็จ (Sheet เป็นแค่สำรอง/ส่งอีเมล
      // ในพื้นหลัง ไม่บล็อกและไม่ทำให้การสมัครล้มเหลวถ้า Sheet ช้าหรือล่ม)
      const { ref } = await registerVolunteer(regData)

      // เก็บแค่รหัสอ้างอิงไว้เตือนความจำว่าเคยสมัครแล้ว — ห้ามเก็บ PII (ชื่อ/เบอร์/อีเมล/จังหวัด) หรือ token
      // ลงใน localStorage เพราะฟอร์มนี้มักเปิดบนแท็บเล็ตที่ตั้งให้คนกรอกต่อคิวกันหน้างาน คนถัดไปเปิด DevTools
      // อ่านข้อมูลของคนก่อนได้ทั้งหมด (ข้อมูลตัวจริงอยู่ Firestore + Sheet แล้ว ไม่ต้องสำรองในเครื่อง)
      try {
        const regs = JSON.parse(localStorage.getItem('volunteerRegs') || '[]')
        regs.push({ ref, at: Date.now() })
        localStorage.setItem('volunteerRegs', JSON.stringify(regs.slice(-20)))
      } catch (e) { /* noop */ }

      setSuccessRef(ref)
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
    setForm(EMPTY); setGender(''); setChannel(''); setSkills([]); setMissions([]); setGiveProjects([]); setGiveDates([]); setError(''); setSuccessRef(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="page volunteer-page">

      <section className="iftar-hero" style={{ paddingBottom: 40 }}>
        <div className="fc-pattern hero-pattern" />
        <div className="inner">
          <img src="/logo.png" alt="Ummatee" style={{ height: 80, display: 'block', margin: '0 auto 10px', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,.35))' }} />
          <h1> อาสาสมัคร<br /><span className="moon">Ummatee</span></h1>
          <p className="iftar-tagline">ร่วมเป็นส่วนหนึ่งของการช่วยเหลือ</p>
          <p className="lead">ช่วยเหลือกิจกรรมด้านมนุษยธรรม</p>
          <div className="vol-gallery">
            <img src="/give-event.webp" alt="งาน ให้" loading="lazy" style={{ height: '80%', display: 'block', margin: '0 auto 10px', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,.35))' }} />
          </div>
        </div>
      </section>

      <section className="iftar-stage" id="volunteer-form">
        {successRef ? (
          <div className="iftar-success">
            <div className="success-card">
              <div className="success-check"><FontAwesomeIcon icon={faCheck} /></div>
              <h2>ลงทะเบียนสำเร็จ!</h2>
              <p>ญะซากัลลอฮุค็อยรอน — ขอบคุณที่สมัครเป็นอาสาสมัครกับมูลนิธิอุมมะตี</p>
              <div className="success-qr">
                <QRCodeSVG value={successRef} size={188} level="M" marginSize={2} />
              </div>
              <div className="ref-pill">{successRef}</div>
              <p>กรุณาบันทึกรหัสอาสาสมัครนี้ไว้เพื่อใช้อ้างอิง</p>
              {form.email.trim() && (
                <p className="success-email-note"><FontAwesomeIcon icon={faEnvelope} /> ทีมงานจะติดต่อกลับทาง {form.email.trim()}</p>
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
                  <label className="iftar-label">First Name (English)</label>
                  <input className="iftar-input" type="text" placeholder="First name" value={form.fnameEn} onChange={set('fnameEn')} />
                </div>
                <div className="iftar-field">
                  <label className="iftar-label">Last Name (English)</label>
                  <input className="iftar-input" type="text" placeholder="Last name" value={form.lnameEn} onChange={set('lnameEn')} />
                </div>
              </div>

              <div className="iftar-row">
                <div className="iftar-field">
                  <label className="iftar-label">เบอร์โทรศัพท์ <span className="req">*</span></label>
                  <input className="iftar-input" type="tel" placeholder="08X-XXX-XXXX" maxLength={15} value={form.phone} onChange={set('phone')} />
                </div>
                <div className="iftar-field">
                  <label className="iftar-label">อีเมล <span className="req">*</span></label>
                  <input className="iftar-input" type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} />
                </div>
              </div>

              <div className="iftar-row">
                <div className="iftar-field">
                  <label className="iftar-label">เพศ <span className="req">*</span></label>
                  <select className="iftar-input" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="" disabled>เลือกเพศ</option>
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                  </select>
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
                <select className="iftar-input" value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="" disabled>เลือกช่องทาง</option>
                  {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              

              <div className="iftar-field">
                <label className="iftar-label">ตำแหน่งที่สนใจ (เลือกได้มากกว่า 1) <span className="req">*</span></label>
                <div className="chip-wrap">
                  {SKILL_OPTIONS.map((s) => (
                    <Chip key={s} label={s} active={skills.includes(s)} onClick={() => toggleList(skills, setSkills, s)} />
                  ))}
                </div>
              </div>

              <div className="iftar-field">
                <label className="iftar-label">สนใจร่วมภารกิจในงาน (เลือกได้มากกว่า 1) <span className="req">*</span></label>
                <div className="chip-wrap">
                  {MISSION_OPTIONS.map((m) => (
                    <Chip key={m.key} label={m.label + ' (' + m.sub + ')'} active={missions.includes(m.key)} onClick={() => toggleList(missions, setMissions, m.key)} />
                  ))}
                </div>
              </div>

              {missions.includes('give') && (
                <>
                <div className="iftar-field">
                  <label className="iftar-label">สนใจร่วมทำงานในโครงการ (ไม่บังคับ)</label>
                  <div className="chip-wrap">
                    {GIVE_PROJECTS.map((p) => (
                      <Chip key={p} label={p} active={giveProjects.includes(p)} onClick={() => toggleList(giveProjects, setGiveProjects, p)} />
                    ))}
                  </div>
                </div>
                <div className="iftar-field">
                  <label className="iftar-label">วันที่สะดวกมาร่วมอาสา (เลือกได้มากกว่า 1)</label>
                  <div className="chip-wrap">
                    {GIVE_DATES.map((d) => (
                      <Chip key={d} label={d} active={giveDates.includes(d)} onClick={() => toggleList(giveDates, setGiveDates, d)} />
                    ))}
                  </div>
                </div>
                </>
              )}

              <div className="iftar-field">
                <label className="iftar-label">สิ่งที่คาดหวังจากการเป็น Ummatee Volunteer</label>
                <textarea className="iftar-input" rows={3} placeholder="เช่น อยากช่วยเหลือผู้ที่ต้องการความช่วยเหลือ อยากเรียนรู้งานมนุษยธรรม..." value={form.expect} onChange={set('expect')} />
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
