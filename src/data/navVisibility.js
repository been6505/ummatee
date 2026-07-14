import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'

// เปิด/ปิดรายการเมนูของ Nav ฝั่ง public — เก็บ doc เดียวที่ config/navVisibility
// (อ่านได้ทุกคน, แก้ได้เฉพาะแอดมิน ตาม firestore.rules เดิม — เหมือน config/announcement)
// รายการเมนูทั้งหมดที่ปิดได้ (ไม่รวม "หน้าหลัก" — เป็นทางกลับบ้าน ปิดไม่ได้)
export const NAV_MENU_ITEMS = [
  { key: 'donation', label: 'ร่วมบริจาค' },
  { key: 'missions', label: 'ภารกิจ' },
  { key: 'qurban', label: 'ภารกิจกุรบาน' },
  { key: 'shop', label: 'Um Shop' },
  { key: 'iftar', label: 'Iftar For Gaza' },
  { key: 'give', label: 'งาน "ให้"' },
  { key: 'volunteer', label: 'อาสาสมัคร' },
]

export function useNavVisibility() {
  const [visibility, setVisibility] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'navVisibility'),
      (snap) => { setVisibility(snap.exists() ? snap.data() : {}); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [])

  return { visibility, loading }
}

export const saveNavVisibility = (data) => setDoc(doc(db, 'config', 'navVisibility'), data, { merge: true })
