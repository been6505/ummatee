import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'

// เนื้อหาเว็บแบบ key-value ทั่วไป (เช่น อีเมลติดต่อ/ที่อยู่/คำโปรย ท้ายเว็บ) — เก็บ doc เดียวที่ config/siteContent
// อ่านได้ทุกคน แก้ได้เฉพาะแอดมิน (ใช้ rule generic ของ config/{id} เดิม) — เพิ่ม key ใหม่ได้จากหน้าแอดมินโดยไม่ต้องแก้โค้ด
// component ที่ใช้ข้อความนี้เรียก siteText(content, key, fallback) — ถ้ายังไม่มีค่าใน Firestore จะใช้ fallback ที่ hardcode ไว้แทน (ไม่พังหน้าเว็บ)

export function useSiteContent() {
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'siteContent'),
      (snap) => { setContent(snap.exists() ? snap.data() : {}); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [])

  return { content, loading }
}

export const saveSiteContent = (data) => setDoc(doc(db, 'config', 'siteContent'), data, { merge: true })

// ดึงข้อความจาก content ตาม key — รองรับ key แบบ 3 ภาษา ("footerTagline.th") หรือ key เดี่ยว ("footerEmail")
export const siteText = (content, key, fallback = '') => {
  const v = content?.[key]
  return (typeof v === 'string' && v.trim()) ? v : fallback
}

// ค่ารูปภาพเก็บเป็น { type: 'image', url } แยกจากข้อความธรรมดา (string) เพื่อให้หน้าแอดมินรู้ว่า key ไหนควรโชว์เป็นตัวอัพโหลดรูป
export const siteImageUrl = (content, key, fallback = '') => {
  const v = content?.[key]
  return (v && typeof v === 'object' && v.type === 'image' && v.url) ? v.url : fallback
}
export const isSiteImageValue = (v) => !!(v && typeof v === 'object' && v.type === 'image')
