import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { templateFrom, MAX_TEMPLATE_NAME } from './contentTemplate.js'

// แม่แบบโพสต์ที่บันทึกไว้ใช้ซ้ำ — เก็บใน contentTemplates
// ตรรกะว่าฟิลด์ไหนใช้ซ้ำได้อยู่ใน contentTemplate.js (ไฟล์ที่ไม่แตะ firebase จึงเทสต์ได้)

export function useContentTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ไม่ใส่ orderBy — แม่แบบเก่าที่บันทึกก่อนมี createdAt จะหายไปจากผลลัพธ์ทั้งใบ
    // (Firestore ตัดเอกสารที่ไม่มีฟิลด์ที่ orderBy ออก) เรียงฝั่ง client แทน
    const unsub = onSnapshot(
      collection(db, 'contentTemplates'),
      (snap) => {
        setTemplates(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'))
        )
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])

  return { templates, loading }
}

export async function saveTemplate(name, post) {
  const clean = String(name || '').trim().slice(0, MAX_TEMPLATE_NAME)
  if (!clean) return null
  return addDoc(collection(db, 'contentTemplates'), {
    name: clean,
    ...templateFrom(post),
    createdAt: serverTimestamp(),
  })
}

export const removeTemplate = (id) => deleteDoc(doc(db, 'contentTemplates', id))
