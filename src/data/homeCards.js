import { useEffect, useState } from 'react'

// การ์ด Hero Feed บนหน้าแรก — แอดมินแก้ได้จาก /admin/website (เก็บที่ config/homeCards)
// ถ้ายังไม่เคยตั้งค่า (doc ไม่มี/ว่าง) หน้าแรกจะ fallback ไปการ์ด 3 ใบเดิมที่ hardcode ไว้
// โหลด firestore แบบ dynamic import เสมอ — Home ไม่ lazy จึงห้ามลาก firebase เข้า bundle หลัก

// สีปุ่มที่เลือกได้ต่อการ์ด — ตรงกับคลาส .hf-btn-* ใน pages2.css
export const CARD_COLORS = [
  { key: 'iftar', label: 'เขียว' },
  { key: 'give', label: 'ม่วง' },
  { key: 'volunteer', label: 'ฟ้าเขียว' },
]

export const EMPTY_CARD = {
  enabled: true,
  images: [],       // รูปโปสเตอร์ (หลายรูป = สไลด์วนอัตโนมัติ)
  tag: '',          // ป้ายแรก เช่น "🌙 EVENT"
  tag2: '',         // ป้ายรอง เช่น "Gaza" / วันที่จัดงาน
  title: '',
  desc: '',
  btnText: 'ดูรายละเอียด',
  link: '/',        // path ภายในเว็บ เช่น /event/iftar-for-gaza
  color: 'iftar',
}

// live=false → อ่านครั้งเดียว (getDoc) เหมาะกับหน้าแรก public ที่ไม่ต้องอัปเดตกลางทาง — เลี่ยง onSnapshot listener ค้างต่อผู้เข้าชมทุกคน
// live=true → onSnapshot เรียลไทม์ ใช้ในหน้าแอดมิน (AdminWebsite) ให้เห็นค่าล่าสุดหลังบันทึก/แก้จากที่อื่น
export function useHomeCards(live = false) {
  const [cards, setCards] = useState(null) // null = ยังไม่ตั้งค่า (ใช้การ์ดมาตรฐาน), [] = ตั้งค่าแล้วแต่ว่าง
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = () => {}
    let cancelled = false
    Promise.all([import('../firebase.js'), import('firebase/firestore')])
      .then(([{ db }, fs]) => {
        if (cancelled) return
        const ref = fs.doc(db, 'config', 'homeCards')
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

export async function saveHomeCards(cards) {
  const [{ db }, { doc, setDoc }] = await Promise.all([import('../firebase.js'), import('firebase/firestore')])
  await setDoc(doc(db, 'config', 'homeCards'), { cards, updatedAt: Date.now() })
}
