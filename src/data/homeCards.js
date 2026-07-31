import { useConfigCards, saveConfigCards } from './configCards.js'

// การ์ด Hero Feed บนหน้าแรก — แอดมินแก้ได้จาก /admin/website (เก็บที่ config/homeCards)
// ถ้ายังไม่เคยตั้งค่า (doc ไม่มี/ว่าง) หน้าแรกจะ fallback ไปการ์ด 3 ใบเดิมที่ hardcode ไว้
// โหลด firestore แบบ dynamic import เสมอ — Home ไม่ lazy จึงห้ามลาก firebase เข้า bundle หลัก

// สีปุ่มที่เลือกได้ต่อการ์ด — ตรงกับคลาส .hf-btn-* ใน pages2.css
export const CARD_COLORS = [
  { key: 'iftar', label: 'เขียว' },
  { key: 'give', label: 'ม่วง' },
  { key: 'volunteer', label: 'ฟ้าเขียว' },
]

// ฟิลด์ข้อความที่แปลได้ (title/desc/btnText) เก็บเป็น { th, en, ar } — ดึงค่าตามภาษา ถ้าภาษานั้นว่างให้ fallback มาไทย
// รองรับค่าเดิมที่เป็น string เดี่ยว (การ์ดที่บันทึกก่อนรองรับหลายภาษา) ด้วย
export const L = (field, lang) => {
  if (field == null) return ''
  if (typeof field === 'string') return field
  return field[lang] || field.th || field.en || field.ar || ''
}

export const EMPTY_CARD = {
  enabled: true,
  images: [],       // รูปโปสเตอร์ (หลายรูป = สไลด์วนอัตโนมัติ)
  tag: '',          // ป้ายแรก เช่น "🌙 EVENT" (ไม่แปลภาษา — ใช้ร่วมทุกภาษา)
  tag2: '',         // ป้ายรอง เช่น "Gaza" / วันที่จัดงาน (ไม่แปลภาษา)
  title: { th: '', en: '', ar: '' },
  desc: { th: '', en: '', ar: '' },
  btnText: { th: 'ดูรายละเอียด', en: 'Learn More', ar: 'اعرف أكثر' },
  link: '/',        // path ภายในเว็บ เช่น /event/iftar-for-gaza
  color: 'iftar',
}

// การ์ดมาตรฐาน 3 ใบ (Iftar / งานให้ / อาสาสมัคร) — เดิม hardcode ในหน้าแรก ย้ายมาเป็น "ข้อมูลตั้งต้น"
// หน้าแรกใช้ชุดนี้ตราบใดที่แอดมินยังไม่บันทึกการ์ดของตัวเอง และหน้าแอดมินเปิดมาเห็นชุดนี้ให้แก้/บันทึกต่อได้เลย
export const DEFAULT_HOME_CARDS = [
  {
    enabled: true,
    images: ['/poster-iftar-gaza.webp', '/poster-line1.webp', '/poster-line2.webp'],
    tag: '🌙 EVENT', tag2: 'Gaza',
    title: { th: 'Iftar For Gaza', en: 'Iftar For Gaza', ar: 'إفطار من أجل غزة' },
    desc: {
      th: 'ร่วมละศีลอดเพื่อกาซา แบ่งปันมื้ออาหารและดุอาอ์ให้พี่น้องผู้ถูกกดขี่ ลงทะเบียนเข้าร่วมงานฟรี',
      en: 'Break fast together for Gaza, share meals and dua for our oppressed brothers and sisters. Free registration.',
      ar: 'شارك في إفطارٍ جماعي من أجل غزة، وشارك الطعام والدعاء لإخواننا المستضعفين. التسجيل مجاني.',
    },
    btnText: { th: 'ชมภาพและวิดีโอจากงาน', en: 'Register Now', ar: 'سجّل الآن' },
    link: '/event/iftar-for-gaza', color: 'iftar',
  },
  {
    enabled: true,
    images: ['/721119853_1607959538003595_185415737813897318_n.jpg'],
    tag: '💜 EVENT', tag2: '3–5 ก.ค. 2569',
    title: { th: 'งาน "ให้" ครั้งที่ 6', en: 'GIVE — 6th Edition', ar: 'العطاء — الدورة السادسة' },
    desc: {
      th: 'เทศกาลแห่งการแบ่งปัน ออกร้านอาหาร ฟังบรรยาย และส่งต่อสิ่งของ ลานพลาซ่า อินดอร์สเตเดียมหัวหมาก',
      en: 'A festival of giving — food stalls, talks, influencer meet-ups, and a fun kids zone. Three full days.',
      ar: 'مهرجان العطاء — أكشاك طعام، محاضرات، وأنشطة عائلية. ثلاثة أيام كاملة.',
    },
    btnText: { th: 'ดูรายละเอียด', en: 'Learn More', ar: 'اعرف أكثر' },
    link: '/event/give-for-um', color: 'give',
  },
  {
    enabled: true,
    images: [],
    tag: '🤝 JOIN US', tag2: 'งาน ให้ ครั้งที่ 6',
    title: { th: 'สมัครอาสาสมัคร', en: 'Volunteer with Us', ar: 'تطوع معنا' },
    desc: {
      th: 'ร่วมเป็นทีมอาสาในงาน "ให้" ครั้งที่ 6 ช่วยเตรียมงาน ต้อนรับแขก และสร้างบรรยากาศที่อบอุ่น',
      en: 'Join our volunteer team for GIVE 6th edition — help set up, guide guests, and make the event a success.',
      ar: 'انضم إلى فريق التطوع لنسخة العطاء السادسة وساعد في جعل الحدث ناجحاً.',
    },
    btnText: { th: 'สมัครเลย', en: 'Sign Up', ar: 'سجّل الآن' },
    link: '/volunteer/register', color: 'volunteer',
  },
]

// live=false → อ่านครั้งเดียว (getDoc) เหมาะกับหน้าแรก public ที่ไม่ต้องอัปเดตกลางทาง — เลี่ยง onSnapshot listener ค้างต่อผู้เข้าชมทุกคน
// live=true → onSnapshot เรียลไทม์ ใช้ในหน้าแอดมิน (AdminWebsite) ให้เห็นค่าล่าสุดหลังบันทึก/แก้จากที่อื่น

// ตัวอ่าน/เขียนย้ายไปอยู่ configCards.js แล้ว — ตรรกะเหมือน config/homeCards ทุกบรรทัดยกเว้นชื่อเอกสาร
// คงชื่อ useHomeCards/saveHomeCards ไว้เป็นตัวห่อบางๆ เพื่อไม่ต้องแก้จุดเรียกทุกหน้า และยังอ่านออกว่าหน้าไหนใช้ชุดไหน
export const useHomeCards = (live = false) => useConfigCards('homeCards', live)
export const saveHomeCards = (cards) => saveConfigCards('homeCards', cards)
