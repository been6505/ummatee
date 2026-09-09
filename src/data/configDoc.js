import { useEffect, useState } from 'react'

// ตัวอ่าน/เขียนเอกสารเดี่ยวใน collection `config` — ใช้ร่วมกันทุกตัวที่เก็บค่าตั้งค่าของเว็บ
// (announcement, navVisibility, siteContent, homeCards, focusCards)
// เดิมแต่ละไฟล์เขียน hook เดียวกันซ้ำกันคนละชุด ต่างกันแค่ชื่อเอกสาร
//
// ⚠️ firebase ต้อง import แบบ dynamic เท่านั้น — Home.jsx เป็นหน้าแรกที่ไม่ lazy
// ถ้าไฟล์นี้ import firebase ตรงๆ Rollup จะดึง Firebase SDK ทั้งก้อน (firestore + auth +
// storage + functions) เข้า entry chunk ทำให้คนเปิดหน้าแรกต้องโหลด JS หลายร้อย kB
// ก่อนเห็นอะไรเลย ทั้งที่หน้าแรกยังไม่ต้องใช้ firebase ตอนเรนเดอร์
//
// data = null หมายถึง "ยังไม่มีเอกสารนี้" ผู้เรียกเป็นคนตัดสินใจเองว่าจะแปลงเป็นอะไร
// (บางที่ต้องการ {} ว่างๆ บางที่ต้องการรู้ว่ายังไม่เคยตั้งค่าเพื่อ fallback ไปค่ามาตรฐาน)
export function useConfigDoc(docId, { live = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub = () => {}
    let cancelled = false
    Promise.all([import('../firebase.js'), import('firebase/firestore')])
      .then(([{ db }, fs]) => {
        if (cancelled) return
        const ref = fs.doc(db, 'config', docId)
        const apply = (snap) => { setData(snap.exists() ? snap.data() : null); setLoading(false) }
        if (live) {
          unsub = fs.onSnapshot(ref, apply, () => setLoading(false))
        } else {
          fs.getDoc(ref).then((snap) => { if (!cancelled) apply(snap) }).catch(() => setLoading(false))
        }
      })
      .catch(() => setLoading(false))
    return () => { cancelled = true; unsub() }
  }, [docId, live])

  return { data, loading }
}

// merge:true = อัปเดตเฉพาะ key ที่ส่งมา (ค่าตั้งค่าทั่วไป)
// merge:false = เขียนทับทั้งเอกสาร จำเป็นสำหรับชุดการ์ด — ถ้า merge ไว้ การ์ดที่ถูกลบจะไม่หายไปจริง
export async function saveConfigDoc(docId, data, { merge = true } = {}) {
  const [{ db }, { doc, setDoc }] = await Promise.all([import('../firebase.js'), import('firebase/firestore')])
  await setDoc(doc(db, 'config', docId), data, { merge })
}
