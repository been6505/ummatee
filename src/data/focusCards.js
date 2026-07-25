import { useEffect, useState } from 'react'

// การ์ดทางลัด 3 ใบใต้หัวข้อ "สองหนทางแห่งการให้" บนหน้าแรก — แอดมินแก้ได้จาก /admin/website (เก็บที่ config/focusCards)
// ข้อความหลายภาษาใช้ helper L() จาก homeCards.js ร่วมกัน
// โหลด firestore แบบ dynamic import เสมอ — Home ไม่ lazy จึงห้ามลาก firebase เข้า bundle หลัก

// รูปแบบสีของการ์ด — key ต้องตรงกับคลาส .focus-* ใน home.css / events.css (เปลี่ยน key = พื้นหลังหาย)
export const FOCUS_VARIANTS = [
  { key: 'iftar', label: 'แดง (กิจกรรม)' },
  { key: 'donate', label: 'เขียว (บริจาค)' },
  { key: 'volunteer', label: 'น้ำเงินเขียว (อาสาสมัคร)' },
]

// tag แปลได้ด้วย (ไม่เหมือน homeCards) เพราะข้อความเดิมต่างกันจริงในแต่ละภาษา เช่น '🌙 EVENT · กิจกรรม' vs '🌙 فعالية'
export const EMPTY_FOCUS_CARD = {
  enabled: true,
  tag: { th: '', en: '', ar: '' },
  title: { th: '', en: '', ar: '' },
  desc: { th: '', en: '', ar: '' },
  linkText: { th: '', en: '', ar: '' },
  link: '/',
  variant: 'iftar',
}

// การ์ดตั้งต้น = ชุดเดิมที่ hardcode ไว้ในหน้าแรก (ย้ายข้อความมาครบทั้ง 3 ภาษา)
export const DEFAULT_FOCUS_CARDS = [
  {
    enabled: true,
    tag: { th: '🌙 EVENT · กิจกรรม', en: '🌙 EVENT', ar: '🌙 فعالية' },
    title: { th: 'Iftar For Gaza', en: 'Iftar For Gaza', ar: 'إفطار من أجل غزة' },
    desc: {
      th: 'ร่วมละศีลอดเพื่อกาซา แบ่งปันมื้ออาหารและดุอาอ์ให้พี่น้องผู้ถูกกดขี่ ลงทะเบียนเข้าร่วมงานฟรี',
      en: 'Break fast together for Gaza, share meals and dua for our oppressed brothers and sisters. Free registration.',
      ar: 'شارك في إفطارٍ جماعي من أجل غزة، وشارك الطعام والدعاء لإخواننا المستضعفين. التسجيل مجاني.',
    },
    linkText: { th: 'ชมภาพและวิดีโอจากงาน', en: 'Register Now', ar: 'سجّل الآن' },
    link: '/event/iftar-for-gaza',
    variant: 'iftar',
  },
  {
    enabled: true,
    tag: { th: '💚 DONATE · บริจาค', en: '💚 DONATE', ar: '💚 تبرّع' },
    title: { th: 'ช่วยเหลือผู้ยากไร้', en: 'Help Those in Need', ar: 'مساعدة المحتاجين' },
    desc: {
      th: 'บริจาคผ่านบัญชีมูลนิธิอุมมะตี เลือกได้ทั้งซะกาต ช่วยในไทย ปาเลสไตน์ ซีเรีย และอาหารทั่วโลก',
      en: 'Donate via Ummatee Foundation accounts — zakat, aid for Thailand, Palestine, Syria, and food worldwide.',
      ar: 'تبرّع عبر حسابات مؤسسة أمّتي — زكاة، إغاثة في تايلاند وفلسطين وسوريا، وإطعام حول العالم.',
    },
    linkText: { th: 'ดูบัญชีบริจาค', en: 'View Donation Accounts', ar: 'عرض حسابات التبرع' },
    link: '/donation',
    variant: 'donate',
  },
  {
    enabled: true,
    tag: { th: '🤝 VOLUNTEER · อาสาสมัคร', en: '🤝 VOLUNTEER', ar: '🤝 تطوّع' },
    title: { th: 'เป็นส่วนหนึ่งกับเรา', en: 'Join Our Team', ar: 'كن جزءاً منّا' },
    desc: {
      th: 'ร่วมเป็นอาสาสมัครมูลนิธิอุมมะตี ช่วยเหลือกิจกรรม งานมนุษยธรรม และการสนับสนุนชุมชน สมัครได้เลย',
      en: 'Become an Ummatee volunteer — help with events, humanitarian work, and community support. Register today.',
      ar: 'انضم إلى متطوعي مؤسسة أمّتي — ساعدنا في الفعاليات والعمل الإنساني ودعم المجتمع. سجّل الآن.',
    },
    linkText: { th: 'สมัครอาสาสมัคร', en: 'Register as Volunteer', ar: 'سجّل كمتطوع' },
    link: '/volunteer/register',
    variant: 'volunteer',
  },
]

// live=false → อ่านครั้งเดียว (getDoc) สำหรับหน้าแรก public — เลี่ยง listener ค้างต่อผู้เข้าชมทุกคน
// live=true → onSnapshot ใช้ในหน้าแอดมิน ให้เห็นค่าล่าสุดหลังบันทึก
export function useFocusCards(live = false) {
  const [cards, setCards] = useState(null) // null = ยังไม่ตั้งค่า (ใช้การ์ดตั้งต้น), [] = ตั้งค่าแล้วแต่ว่าง
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = () => {}
    let cancelled = false
    Promise.all([import('../firebase.js'), import('firebase/firestore')])
      .then(([{ db }, fs]) => {
        if (cancelled) return
        const ref = fs.doc(db, 'config', 'focusCards')
        const apply = (snap) => { setCards(snap.exists() ? (snap.data().cards || []) : null); setLoading(false) }
        if (live) {
          unsub = fs.onSnapshot(ref, apply, () => setLoading(false))
        } else {
          fs.getDoc(ref).then((snap) => { if (!cancelled) apply(snap) }).catch(() => setLoading(false))
        }
      })
      .catch(() => setLoading(false))
    return () => { cancelled = true; unsub() }
  }, [live])

  return { cards, loading }
}

export async function saveFocusCards(cards) {
  const [{ db }, { doc, setDoc }] = await Promise.all([import('../firebase.js'), import('firebase/firestore')])
  await setDoc(doc(db, 'config', 'focusCards'), { cards, updatedAt: Date.now() })
}
