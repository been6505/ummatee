import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, increment, serverTimestamp } from 'firebase/firestore'
import { cleanHookText, normHookCategory, sortHooks } from './hooks.js'

// คลัง HOOK ใน Firestore — ตรรกะล้วนๆ (จัดหมวด/ค้นหา/เรียง) อยู่ใน data/hooks.js ที่เทสต์ได้

export function useContentHooks() {
  const [hooks, setHooks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ไม่ใส่ orderBy — Firestore ตัดเอกสารที่ไม่มีฟิลด์ที่เรียงออกจากผลลัพธ์
    // hook ที่บันทึกก่อนมี useCount จะหายไปจากคลังเงียบๆ เรียงฝั่ง client แทน (ดู sortHooks)
    const unsub = onSnapshot(
      collection(db, 'contentHooks'),
      (snap) => { setHooks(sortHooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })))); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [])

  return { hooks, loading }
}

export async function addHook({ text, category, note }) {
  const clean = cleanHookText(text)
  if (!clean) return null
  return addDoc(collection(db, 'contentHooks'), {
    text: clean,
    category: normHookCategory(category),
    note: String(note || '').trim().slice(0, 200),
    useCount: 0,
    createdAt: serverTimestamp(),
  })
}

export const removeHook = (id) => deleteDoc(doc(db, 'contentHooks', id))

// นับตอนหยิบไปใช้จริง — ตัวเลขนี้คือสิ่งเดียวที่บอกได้ว่า hook ไหนได้ผล
// increment() ฝั่งเซิร์ฟเวอร์ ไม่ใช่อ่านมาบวกแล้วเขียนกลับ — สองคนกดพร้อมกันจะนับหายไปหนึ่ง
export const markHookUsed = (id) => updateDoc(doc(db, 'contentHooks', id), { useCount: increment(1) })
