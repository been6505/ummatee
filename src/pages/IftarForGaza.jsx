import { useState, useEffect } from 'react'
import { formatPhone } from '../utils/formatPhone.js'
import Footer from '../components/Footer.jsx'
import { useLang } from '../i18n.jsx'
import { db } from '../firebase.js'
import { collection, addDoc, doc, getDoc, setDoc, increment } from 'firebase/firestore'
import { QRCodeSVG } from 'qrcode.react'
import CopyIcon from '../components/CopyIcon.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faEnvelope, faLocationDot, faMagnifyingGlass, faClipboardList } from '@fortawesome/free-solid-svg-icons'
import useParallax from '../hooks/useParallax.js'

const IFTAR_POSTERS = ['/poster-iftar.webp', '/poster-line1.webp', '/poster-line2.webp']

function IftarPosterCarousel() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % IFTAR_POSTERS.length), 4000)
    return () => clearInterval(t)
  }, [])
  const safeIdx = idx < IFTAR_POSTERS.length ? idx : 0
  return (
    <div className="iftar-poster-carousel">
      <img className="iftar-poster" src={IFTAR_POSTERS[safeIdx]} alt="Iftar For Gaza" loading="lazy" />
      <div className="iftar-poster-dots">
        {IFTAR_POSTERS.map((_, i) => <span key={i} className={`iftar-poster-dot${i === safeIdx ? ' active' : ''}`} />)}
      </div>
    </div>
  )
}

// หน้าลงทะเบียนงาน Iftar For Gaza — ฟอร์มสมัคร + ส่งข้อมูลเข้า Google Sheet (สำรองลง Firestore)
// ตัวเลือกช่องทางที่รู้จักงาน
const CHANNELS = ['Facebook', 'Instagram', 'LINE', 'TikTok', 'Threads', 'Twitter']

// ตัวเลือกอายุ 1-100 ปี สำหรับ dropdown
const AGES = Array.from({ length: 100 }, (_, i) => i + 1)

// รายชื่อ 77 จังหวัดของไทย สำหรับ dropdown
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

// URL ของ Google Apps Script Web App ที่ deploy จากบัญชี ummatee.thailand@gmail.com
import { IFTAR_SHEET_ENDPOINT as SHEET_ENDPOINT, fetchWithTimeout } from '../utils/endpoints.js'

// บันทึกลง Firestore แบบ retry (สำรองข้อมูลให้ครบเสมอ เพราะหน้า admin อ่านจาก Firestore)
// ลองซ้ำสูงสุด 3 ครั้ง หน่วงเพิ่มขึ้นเรื่อย ๆ — คืน true เมื่อสำเร็จ, false เมื่อพลาดทุกครั้ง
async function saveToFirestore(saved, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      await addDoc(collection(db, 'iftarRegs'), saved)
      return true
    } catch (e) {
      if (i === attempts - 1) return false
      await new Promise((r) => setTimeout(r, 600 * (i + 1)))
    }
  }
  return false
}

// ลิงก์แผนที่ไปยังสถานที่จัดงาน (ใช้ร่วมกันทุกภาษา)
const IB_MAP_LINK = 'https://maps.app.goo.gl/MeUdbtRPhB7mKBcb7'

// ไฟล์โปสเตอร์ประชาสัมพันธ์งาน (วางไฟล์ไว้ที่ public/iftar-for-gaza-poster.jpg)
const POSTER_IMG = '/iftar-for-gaza-poster.jpg'

// เพดานจำนวนที่นั่ง — ถ้ายอดลงทะเบียนถึงค่านี้จะปิดรับอัตโนมัติ (ต้องตรงกับข้อความ seatLimit ในแต่ละภาษา)
const SEAT_LIMIT = 400

// จัดรูปแบบเบอร์เป็น 0##-###-#### (เบอร์ไทย 10 หลักขึ้นต้น 0) ก่อนบันทึกลง Sheet/Firestore
// รูปแบบอื่น (เบอร์ต่างประเทศ/ไม่ครบ 10 หลัก) เก็บตามที่กรอก

const T = {
  th: {
    campaign: '🎗️ ให้ 100 ถึง 100',
    eyebrow: 'ลงทะเบียนเข้าร่วมงาน · ฟรี',
    lead: 'ร่วมละศีลอดเพื่อพี่น้องกาซ่า แบ่งปันมื้ออาหารแห่งความเป็นพี่น้อง และร่วมขอดุอาให้ผู้ถูกกดขี่ ลงทะเบียนล่วงหน้าเพื่อสำรองที่นั่ง',
    tagline: 'Break your Fast, Open Your Heart',
    ibDate: 'วัน & เวลา', ibDateV1: 'ศุกร์ 26 มิถุนายน 2569', ibDateV2: '15:30-20:30 น.',
    ibPlace: 'สถานที่', ibPlaceV: 'สินธร สเต็กเฮ้าส์ ศรีนครินทร์',
    ibMap: 'ดูแผนที่',
    ibType: 'ประเภท', ibTypeV: 'เข้าร่วมฟรี ไม่มีค่าใช้จ่าย',
    donateTitle: 'มูลนิธิอุมมะตี เพื่อช่วยปาเลสไตน์',
    donateAccount: '0011 1863 48',
    seatLimit: 'บุฟเฟ่ต์จำกัด 400 ที่นั่ง',
    contactTel: 'สอบถามเพิ่มเติม Tel. 065-926-7512',
    formTitle: 'แบบฟอร์มลงทะเบียน',
    formSub: 'กรอกข้อมูลเพื่อสำรองที่นั่งเข้าร่วมงาน · ใช้เวลาไม่ถึง 1 นาที',
    fname: 'ชื่อ', fnamePh: 'ชื่อจริง', lname: 'นามสกุล', lnamePh: 'นามสกุล',
    phone: 'เบอร์โทรศัพท์', phonePh: '08X-XXX-XXXX', email: 'อีเมล',
    gender: 'เพศ', genders: ['ชาย', 'หญิง'], age: 'อายุ', agePh: 'อายุ (ปี)', ageSelect: 'เลือกอายุ',
    channel: 'รู้จักงานนี้จากช่องทางใด', other: 'อื่นๆ',
    job: 'อาชีพ', jobPh: 'เช่น นักเรียน, พนักงาน', jobSelect: 'เลือกอาชีพ',
    jobs: ['นักเรียน/นักศึกษา', 'พนักงานบริษัท/เอกชน', 'ข้าราชการ/รัฐวิสาหกิจ', 'เจ้าของธุรกิจ/ค้าขาย', 'อาชีพอิสระ/ฟรีแลนซ์', 'รับจ้างทั่วไป', 'แม่บ้าน/พ่อบ้าน', 'เกษียณ', 'อื่นๆ'],
    province: 'จังหวัด', provincePh: 'จังหวัดที่พำนัก', provinceSelect: 'เลือกจังหวัด',
    expect: 'สิ่งที่คาดหวังจากงานนี้',
    expects: ['ร่วมละศีลอด', 'ฟังบรรยาย', 'ร่วมดุอา', 'พบปะพี่น้อง', 'ร่วมบริจาค'],
    comment: 'ข้อเสนอแนะเพิ่มเติม', commentPh: 'อยากบอกอะไรกับทีมงาน...',
    submit: 'ยืนยันการลงทะเบียน', submitting: 'กำลังบันทึก...',
    errFname: 'กรุณากรอกชื่อ', errLname: 'กรุณากรอกนามสกุล', errPhone: 'กรุณากรอกเบอร์โทรศัพท์',
    errPhoneBad: 'เบอร์โทรศัพท์ไม่ถูกต้อง', errEmail: 'รูปแบบอีเมลไม่ถูกต้อง', errNameEmail: 'ช่องชื่อ/นามสกุล ไม่ใช่อีเมล — กรุณากรอกชื่อจริง',
    errSend: 'ส่งข้อมูลไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง',
    successTitle: 'ลงทะเบียนสำเร็จ!',
    successP: 'ญะซากัลลอฮุค็อยรอน — ขอบคุณที่ร่วมเป็นส่วนหนึ่งของงาน Iftar For Gaza',
    successKeep: 'กรุณาบันทึกรหัสลงทะเบียนนี้ไว้ เพื่อใช้ยืนยันหน้างาน',
    successEmail: 'เราได้ส่งอีเมลยืนยันไปที่ {email} แล้ว (อีเมลอัตโนมัติ ห้ามตอบกลับ)',
    successAgain: 'ลงทะเบียนเพิ่มอีกคน',
    checkToggle: 'ตรวจสอบรายชื่อผู้ลงทะเบียน',
    checkSearch: 'ค้นหาด้วยชื่อ จังหวัด หรือรหัส IFG...',
    checkCount: (n) => `ผู้ลงทะเบียนทั้งหมด ${n} คน`,
    checkEmpty: 'ยังไม่มีรายชื่อผู้ลงทะเบียน',
  },
  en: {
    campaign: '🎗️ Give 100 to 100',
    eyebrow: 'Register for the event · Free',
    lead: 'Break fast together for Gaza, share a meal of brotherhood, and join in dua for the oppressed. Register in advance to reserve your seat.',
    tagline: 'Break your Fast, Open Your Heart',
    ibDate: 'Date & Time', ibDateV1: 'Friday, 26 June 2026', ibDateV2: '15:30-20:30',
    ibPlace: 'Location', ibPlaceV: 'Sinthorn Steak House Srinakarin',
    ibMap: 'View map',
    ibType: 'Admission', ibTypeV: 'Free entry, no charge',
    donateTitle: 'Ummatee — help Palestine',
    donateAccount: '0011 1863 48',
    seatLimit: 'Buffet limited to 400 seats',
    contactTel: 'Enquiries: Tel. 065-926-7512',
    formTitle: 'Registration Form',
    formSub: 'Fill in your details to reserve a seat · takes less than a minute',
    fname: 'First Name', fnamePh: 'First name', lname: 'Last Name', lnamePh: 'Last name',
    phone: 'Phone Number', phonePh: '08X-XXX-XXXX', email: 'Email',
    gender: 'Gender', genders: ['Male', 'Female'], age: 'Age', agePh: 'Age (years)', ageSelect: 'Select age',
    channel: 'How did you hear about this event?', other: 'Other',
    job: 'Occupation', jobPh: 'e.g. student, employee', jobSelect: 'Select occupation',
    jobs: ['Student', 'Private employee', 'Government employee', 'Business owner', 'Freelancer', 'General laborer', 'Homemaker', 'Retired', 'Other'],
    province: 'Province', provincePh: 'Province of residence', provinceSelect: 'Select province',
    expect: 'What do you expect from this event?',
    expects: ['Join iftar', 'Listen to talks', 'Join dua', 'Meet brothers & sisters', 'Donate'],
    comment: 'Additional comments', commentPh: 'Anything you want to tell the team...',
    submit: 'Confirm Registration', submitting: 'Saving...',
    errFname: 'Please enter your first name', errLname: 'Please enter your last name', errPhone: 'Please enter your phone number',
    errPhoneBad: 'Invalid phone number', errEmail: 'Invalid email format', errNameEmail: 'Name fields are not for email — please enter your real name',
    errSend: 'Submission failed. Please check your internet connection and try again.',
    successTitle: 'Registration Complete!',
    successP: 'Jazakallahu khairan — thank you for being part of Iftar For Gaza',
    successKeep: 'Please save this registration code to confirm at the event',
    successEmail: 'A confirmation email has been sent to {email} (automated message, please do not reply)',
    successAgain: 'Register another person',
    checkToggle: 'Check registered names',
    checkSearch: 'Search by name, province, or IFG code...',
    checkCount: (n) => `${n} registered in total`,
    checkEmpty: 'No registrations yet',
  },
  ar: {
    campaign: '🎗️ أعطِ 100 لـ 100',
    eyebrow: 'سجّل لحضور الفعالية · مجاناً',
    lead: 'شارك في إفطارٍ جماعي من أجل غزة، وشارك وجبة الأخوّة، وادعُ للمستضعفين. سجّل مسبقاً لحجز مقعدك.',
    tagline: 'Break your Fast, Open Your Heart',
    ibDate: 'التاريخ والوقت', ibDateV1: 'الجمعة 26 يونيو 2026', ibDateV2: '15:30-20:30',
    ibPlace: 'المكان', ibPlaceV: 'Sinthorn Steak House Srinakarin',
    ibMap: 'عرض الخريطة',
    ibType: 'الدخول', ibTypeV: 'مجاني بدون رسوم',
    donateTitle: 'Ummatee - help Palestine ',
    donateAccount: '0011 1863 48',
    seatLimit: 'البوفيه محدود بـ 400 مقعد',
    contactTel: 'للاستعلام: Tel. 065-926-7512',
    formTitle: 'نموذج التسجيل',
    formSub: 'املأ بياناتك لحجز مقعدك · يستغرق أقل من دقيقة',
    fname: 'الاسم', fnamePh: 'الاسم الأول', lname: 'اسم العائلة', lnamePh: 'اسم العائلة',
    phone: 'رقم الهاتف', phonePh: '08X-XXX-XXXX', email: 'البريد الإلكتروني',
    gender: 'الجنس', genders: ['ذكر', 'أنثى'], age: 'العمر', agePh: 'العمر (سنة)', ageSelect: 'اختر العمر',
    channel: 'كيف عرفت عن هذه الفعالية؟', other: 'أخرى',
    job: 'المهنة', jobPh: 'مثل: طالب، موظف', jobSelect: 'اختر المهنة',
    jobs: ['طالب', 'موظف قطاع خاص', 'موظف حكومي', 'صاحب عمل/تجارة', 'عمل حر', 'عامل عام', 'ربة منزل', 'متقاعد', 'أخرى'],
    province: 'المحافظة', provincePh: 'محافظة الإقامة', provinceSelect: 'اختر المحافظة',
    expect: 'ماذا تتوقع من هذه الفعالية؟',
    expects: ['المشاركة في الإفطار', 'حضور المحاضرات', 'المشاركة في الدعاء', 'لقاء الإخوة', 'التبرع'],
    comment: 'ملاحظات إضافية', commentPh: 'ما الذي تود إخبار الفريق به...',
    submit: 'تأكيد التسجيل', submitting: 'جارٍ الحفظ...',
    errFname: 'يرجى إدخال الاسم', errLname: 'يرجى إدخال اسم العائلة', errPhone: 'يرجى إدخال رقم الهاتف',
    errPhoneBad: 'رقم الهاتف غير صحيح', errEmail: 'صيغة البريد الإلكتروني غير صحيحة', errNameEmail: 'حقل الاسم ليس للبريد الإلكتروني — يرجى إدخال اسمك الحقيقي',
    errSend: 'فشل الإرسال. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.',
    successTitle: 'تم التسجيل بنجاح!',
    successP: 'جزاكم الله خيراً — شكراً لمشاركتكم في إفطار من أجل غزة',
    successKeep: 'يرجى حفظ رمز التسجيل هذا لتأكيد حضورك في الفعالية',
    successEmail: 'تم إرسال رسالة تأكيد إلى {email} (رسالة تلقائية، يرجى عدم الرد)',
    successAgain: 'تسجيل شخص آخر',
    checkToggle: 'التحقق من أسماء المسجلين',
    checkSearch: 'ابحث بالاسم أو المحافظة أو رمز IFG...',
    checkCount: (n) => `إجمالي المسجلين ${n}`,
    checkEmpty: 'لا توجد تسجيلات بعد',
  },
}

// กล่องเลขบัญชีบริจาค — แตะเพื่อคัดลอกเฉพาะเลขบัญชี (ตัดช่องว่างออกก่อนคัดลอก)
function DonateAccount({ icon, title, account }) {
  const [copied, setCopied] = useState(false)
  // แสดง "คัดลอกแล้ว" + นับสถิติ เฉพาะเมื่อคัดลอกสำเร็จจริง — เดิมนับ/แสดงผลสำเร็จแม้คัดลอกจริงจะล้มเหลว
  const copy = () => {
    const clean = account.replace(/\s/g, '')
    const onSuccess = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
      setDoc(doc(db, 'stats', 'iftar'), { copies: increment(1) }, { merge: true }).catch(() => {})
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(clean).then(onSuccess).catch(() => { if (fallbackCopy(clean)) onSuccess() })
    } else if (fallbackCopy(clean)) {
      onSuccess()
    }
  }
  const fallbackCopy = (text) => {
    const el = document.createElement('textarea')
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0'
    document.body.appendChild(el); el.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch (e) { /* noop */ }
    document.body.removeChild(el)
    return ok
  }
  return (
    <button type="button" className="iftar-donate" onClick={copy} dir="ltr">
      <img className="iftar-donate-icon" src={icon} alt="" />
      <div className="iftar-donate-body">
        <div className="iftar-donate-title">{title}</div>
        <div className="iftar-donate-account" dir="ltr">{account}</div>
      </div>
      <div className={`don-copy ${copied ? 'copied' : ''}`}>{copied ? '✓' : <CopyIcon />}</div>
    </button>
  )
}

// ปุ่มตัวเลือกแบบ chip (กดเลือก/ยกเลิกได้)
function Chip({ label, active, onClick }) {
  return (
    <button type="button" className={`iftar-chip ${active ? 'selected' : ''}`} onClick={onClick}>
      {label}
    </button>
  )
}

// ค่าเริ่มต้นของฟอร์ม (ใช้ตอน reset ด้วย)
const EMPTY = { fname: '', lname: '', age: '', phone: '', email: '', job: '', jobOther: '', province: '', comment: '' }

export default function Iftar() {
  const { lang } = useLang()
  const t = T[lang]
  const heroParallaxRef = useParallax(0.15)
  const [form, setForm] = useState(EMPTY)
  const [gender, setGender] = useState('')
  const [channel, setChannel] = useState([])
  const [expect, setExpect] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successRef, setSuccessRef] = useState(null)
  const [isFull, setIsFull] = useState(false)

  useEffect(() => {
    // 1) ปิดด้วยมือจากแอดมิน + อ่าน seatLimit ที่แอดมินตั้งไว้ (ถ้ามี)
    getDoc(doc(db, 'config', 'iftarMeta'))
      .then((snap) => {
        if (!snap.exists()) return
        if (snap.data().isClosed) setIsFull(true)
        const limit = snap.data().seatLimit || SEAT_LIMIT
        // 2) ปิดอัตโนมัติเมื่อยอดถึงเพดาน (อ่าน count สาธารณะจาก Apps Script)
        fetchWithTimeout(`${SHEET_ENDPOINT}?count=1`)
          .then((r) => r.json())
          .then((o) => { if (typeof o.count === 'number' && o.count >= limit) setIsFull(true) })
          .catch(() => {})
      })
      .catch(() => {})
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggle = (list, setList, v) =>
    setList(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  // ตรวจความถูกต้องของฟอร์ม แล้วส่งข้อมูลลงทะเบียน
  const submit = async () => {
    const f = form
    setError('')
    // ตรวจช่องบังคับ: ชื่อ นามสกุล เบอร์โทร (และรูปแบบเบอร์/อีเมล)
    if (!f.fname.trim()) return setError(t.errFname)
    if (/@/.test(f.fname.trim())) return setError(t.errNameEmail)
    if (!f.lname.trim()) return setError(t.errLname)
    if (/@/.test(f.lname.trim())) return setError(t.errNameEmail)
    if (!f.phone.trim()) return setError(t.errPhone)
    if (!/^[0-9+\-\s]{6,15}$/.test(f.phone.trim())) return setError(t.errPhoneBad)
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setError(t.errEmail)

    setSubmitting(true)
    const regData = {
      date: new Date().toLocaleString('th-TH'),
      fname: f.fname.trim(), lname: f.lname.trim(), gender, age: f.age.trim(), phone: formatPhone(f.phone), email: f.email.trim(),
      job: (f.job === t.jobs[t.jobs.length - 1] ? f.jobOther : f.job).trim(), province: f.province.trim(),
      channel: channel.join(', '), expect: expect.join(', '), comment: f.comment.trim(),
    }

    try {
      // ส่งไป Google Sheet ก่อน — Apps Script เป็นผู้ออกเลข IFG (นับจากแถวจริง ไม่ซ้ำข้ามเครื่อง)
      const res = await fetchWithTimeout(SHEET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(regData),
      })
      if (!res.ok) throw new Error(`server error ${res.status}`)
      const out = await res.json()
      if (!out.ref) throw new Error('no ref')
      const saved = { ref: out.ref, ...regData }

      // สำรองลง Firestore แบบ retry — ให้บันทึกครบทั้ง Sheet (หลัก) และ Firestore (สำรอง) พร้อมกัน
      // ถ้าพลาดทุกครั้งไม่ถือว่าลงทะเบียนล้มเหลว เพราะข้อมูลหลักอยู่ในชีตแล้ว
      await saveToFirestore(saved)

      // เก็บสำเนาในเครื่อง (localStorage) ไว้ให้แผง "ตรวจสอบรายชื่อ" ใช้แสดง
      // เก็บเฉพาะ 5 ฟิลด์ที่ CheckPanel แสดงจริงเท่านั้น — ห้ามเก็บ token/เบอร์โทร/อีเมล ลงเครื่อง เพราะฟอร์มนี้
      // มักเปิดบนแท็บเล็ตที่ตั้งให้คนลงทะเบียนต่อคิวกันหน้างาน คนถัดไปเปิด DevTools อ่านของคนก่อนได้หมด
      // (ข้อมูลเต็มอยู่ใน Sheet + Firestore แล้ว ที่นี่เป็นแค่ตัวช่วยค้นชื่อในเครื่องนั้น)
      try {
        const regs = JSON.parse(localStorage.getItem('iftarRegs') || '[]')
        regs.push({ ref: saved.ref, fname: saved.fname, lname: saved.lname, province: saved.province, date: saved.date })
        localStorage.setItem('iftarRegs', JSON.stringify(regs.slice(-200)))
      } catch (e) { /* noop */ }

      setSuccessRef(out.ref)
      setTimeout(() => {
        document.getElementById('iftar-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 50)
    } catch (e) {
      setError(t.errSend)
    } finally {
      setSubmitting(false)
    }
  }

  // ล้างฟอร์มทั้งหมดเพื่อลงทะเบียนคนถัดไป
  const reset = () => {
    setForm(EMPTY); setGender(''); setChannel([]); setExpect([]); setError(''); setSuccessRef(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="page gaza-page">
      <section className="iftar-hero">
        <div className="fc-pattern hero-pattern" ref={heroParallaxRef}></div>

        <div className="inner">
          <h1><span className="moon">Iftar</span> For Gaza</h1>
          <p className="iftar-tagline">{t.tagline}</p>
          <a href="#iftar-form" className="iftar-eyebrow"><span>🇵🇸</span> {t.eyebrow}</a>

          <IftarPosterCarousel />

          <p className="lead">{t.lead}</p>

          <div className="iftar-live" style={{ padding: '24px 0' }}>
            <div className="iftar-live-card">
              <h2>🔴 LIVE — Iftar For Gaza 2026</h2>
              <div className="iftar-live-embed">
                <iframe
                  src="https://www.youtube.com/embed/ZqFHlNyB_kM?autoplay=1"
                  title="Iftar For Gaza 2026 Live"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p>ร่วมรับชมงาน Iftar For Gaza 2026 · ถ่ายทอดสด</p>
              <a href="https://www.youtube.com/live/ZqFHlNyB_kM" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: 12 }}>
                ▶️ ดูบน YouTube
              </a>
            </div>
          </div>

          <DonateAccount icon="/ibank.png" title={t.donateTitle} account={t.donateAccount} />
        </div>
      </section>

      <section className="iftar-stage" id="iftar-form">
        {/* ฟอร์มลงทะเบียนซ่อนไว้ — งานจบแล้ว */}
        {false && (isFull ? (
          <div className="iftar-full">
            <div className="iftar-full-card">
              <div className="iftar-full-icon">🚫</div>
              <h2>ปิดรับลงทะเบียนแล้ว</h2>
              <p>ขออภัย — ที่นั่งครบ 400 คนแล้ว ขอบคุณทุกท่านที่ให้ความสนใจ</p>
              <p style={{ fontSize: '0.92rem', opacity: 0.7 }}>Registration is closed · تم إغلاق التسجيل</p>
            </div>
          </div>
        ) : successRef ? (
          <div className="iftar-success">
            <div className="success-card">
              <div className="success-check"><FontAwesomeIcon icon={faCheck} /></div>
              <h2>{t.successTitle}</h2>
              <p>{t.successP}</p>
              <div className="success-qr">
                <QRCodeSVG value={successRef} size={188} level="M" marginSize={2} />
              </div>
              <div className="ref-pill">{successRef}</div>
              <p>{t.successKeep}</p>
              {form.email.trim() && (
                <p className="success-email-note"><FontAwesomeIcon icon={faEnvelope} /> {t.successEmail.replace('{email}', form.email.trim())}</p>
              )}
              <button className="btn btn-primary" style={{ marginTop: 22, justifyContent: 'center' }} onClick={reset}>
                {t.successAgain}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="iftar-card">
              <div className="form-shell">
                <h2>{t.formTitle}</h2>
                <p className="fs-sub">{t.formSub}</p>

                <div className="iftar-row">
                  <div className="iftar-field">
                    <label className="iftar-label">{t.fname} <span className="req">*</span></label>
                    <input className="iftar-input" type="text" placeholder={t.fnamePh} value={form.fname} onChange={set('fname')} autoComplete="given-name" />
                  </div>
                  <div className="iftar-field">
                    <label className="iftar-label">{t.lname} <span className="req">*</span></label>
                    <input className="iftar-input" type="text" placeholder={t.lnamePh} value={form.lname} onChange={set('lname')} autoComplete="family-name" />
                  </div>
                </div>

                <div className="iftar-row">
                  <div className="iftar-field">
                    <label className="iftar-label">{t.phone} <span className="req">*</span></label>
                    <input className="iftar-input" type="tel" placeholder={t.phonePh} maxLength={15} value={form.phone} onChange={set('phone')} autoComplete="tel" />
                  </div>
                  <div className="iftar-field">
                    <label className="iftar-label">{t.email}</label>
                    <input className="iftar-input" type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} autoComplete="email" />
                  </div>
                </div>

                <div className="iftar-row">
                  <div className="iftar-field">
                    <label className="iftar-label">{t.gender}</label>
                    <div className="chip-wrap">
                      {t.genders.map((g) => (
                        <Chip key={g} label={g} active={gender === g} onClick={() => setGender(gender === g ? '' : g)} />
                      ))}
                    </div>
                  </div>
                  <div className="iftar-field">
                    <label className="iftar-label">{t.age}</label>
                    <select className="iftar-input" value={form.age} onChange={set('age')}>
                      <option value="" disabled>{t.ageSelect}</option>
                      {AGES.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>

                <div className="iftar-field">
                  <label className="iftar-label">{t.channel}</label>
                  <div className="chip-wrap">
                    {[...CHANNELS, t.other].map((c) => (
                      <Chip key={c} label={c} active={channel.includes(c)} onClick={() => toggle(channel, setChannel, c)} />
                    ))}
                  </div>
                </div>

                <div className="iftar-row">
                  <div className="iftar-field">
                    <label className="iftar-label">{t.job}</label>
                    <select className="iftar-input" value={form.job} onChange={set('job')}>
                      <option value="" disabled>{t.jobSelect}</option>
                      {t.jobs.map((j) => <option key={j} value={j}>{j}</option>)}
                    </select>
                    {form.job === t.jobs[t.jobs.length - 1] && (
                      <input
                        className="iftar-input"
                        type="text"
                        placeholder={t.jobPh}
                        value={form.jobOther}
                        onChange={set('jobOther')}
                        style={{ marginTop: 10 }}
                      />
                    )}
                  </div>
                  <div className="iftar-field">
                    <label className="iftar-label">{t.province}</label>
                    <select className="iftar-input" value={form.province} onChange={set('province')}>
                      <option value="" disabled>{t.provinceSelect}</option>
                      {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div className="iftar-field">
                  <label className="iftar-label">{t.expect}</label>
                  <div className="chip-wrap">
                    {[...t.expects, t.other].map((c) => (
                      <Chip key={c} label={c} active={expect.includes(c)} onClick={() => toggle(expect, setExpect, c)} />
                    ))}
                  </div>
                </div>

                <div className="iftar-field">
                  <label className="iftar-label">{t.comment}</label>
                  <textarea className="iftar-input" placeholder={t.commentPh} value={form.comment} onChange={set('comment')} />
                </div>

                {error && <div className="iftar-error">{error}</div>}
                <button className="btn btn-donate iftar-submit" onClick={submit} disabled={submitting}>
                  {submitting ? t.submitting : t.submit}
                </button>
              </div>
            </div>

            <CheckPanel t={t} />
          </>
        ))}
      </section>

      <Footer />
    </main>
  )
}

// แผงตรวจสอบรายชื่อผู้ลงทะเบียน — อ่านจาก localStorage ของเครื่องนั้น ๆ (ไม่ใช่ข้อมูลรวมทั้งหมด)
function CheckPanel({ t }) {
  const [open, setOpen] = useState(false)
  const [regs, setRegs] = useState([])
  const [query, setQuery] = useState('')

  const load = () => {
    try { setRegs(JSON.parse(localStorage.getItem('iftarRegs') || '[]')) }
    catch (e) { setRegs([]) }
  }
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  const q = query.trim().toLowerCase()
  const filtered = !q ? regs : regs.filter((r) =>
    (r.fname + ' ' + r.lname).toLowerCase().includes(q) ||
    (r.province || '').toLowerCase().includes(q) ||
    (r.ref || '').toLowerCase().includes(q)
  )

  return (
    <div className="check-block">
      <button className="check-toggle" onClick={toggle}><FontAwesomeIcon icon={faMagnifyingGlass} /> {t.checkToggle}</button>
      {open && (
        <div className="check-panel">
          <input className="iftar-input check-search" type="text" placeholder={t.checkSearch} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="check-count">{t.checkCount(regs.length)}</div>
          <div className="check-list">
            {filtered.length === 0 ? (
              <div className="check-empty">{t.checkEmpty}</div>
            ) : (
              filtered.map((r, i) => (
                <div className="check-item" key={r.ref + i}>
                  <span className="ci-ref">{r.ref}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ci-name">{r.fname} {r.lname}</div>
                    <div className="ci-meta">{r.province || '-'} · {r.date || ''}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
