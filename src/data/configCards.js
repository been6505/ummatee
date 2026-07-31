import { useEffect, useState } from 'react'

// ตัวอ่าน/เขียนชุดการ์ดที่แอดมินจัดการเองใน config/{docId}
// ใช้ร่วมกันระหว่าง config/homeCards (การ์ด Hero Feed) กับ config/focusCards (การ์ดทางลัด)
// — เดิมสองไฟล์นี้เขียน hook เดียวกันคนละชุด ต่างกันแค่ชื่อเอกสาร แก้บั๊กทีต้องแก้สองที่
//
// โหลด firebase แบบ dynamic import เพราะหน้าแรกเรียก hook นี้ตั้งแต่เรนเดอร์แรก
// ถ้า import ตรงๆ ก้อน firebase จะถูกดึงเข้ามาใน bundle หลักและถ่วง first paint ของหน้า public
export function useConfigCards(docId, live = false) {
  // null = ยังไม่เคยตั้งค่า (ให้ผู้เรียกใช้ชุดมาตรฐานแทน), [] = ตั้งค่าแล้วแต่ไม่มีการ์ดเลย
  const [cards, setCards] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = () => {}
    let cancelled = false
    Promise.all([import('../firebase.js'), import('firebase/firestore')])
      .then(([{ db }, fs]) => {
        if (cancelled) return
        const ref = fs.doc(db, 'config', docId)
        const apply = (snap) => { setCards(snap.exists() ? (snap.data().cards || []) : null); setLoading(false) }
        if (live) {
          unsub = fs.onSnapshot(ref, apply, () => setLoading(false))
        } else {
          fs.getDoc(ref).then((snap) => { if (!cancelled) apply(snap) }).catch(() => setLoading(false))
        }
      })
      .catch(() => setLoading(false))
    return () => { cancelled = true; unsub() }
  }, [docId, live])

  return { cards, loading }
}

export async function saveConfigCards(docId, cards) {
  const [{ db }, { doc, setDoc }] = await Promise.all([import('../firebase.js'), import('firebase/firestore')])
  await setDoc(doc(db, 'config', docId), { cards, updatedAt: Date.now() })
}
