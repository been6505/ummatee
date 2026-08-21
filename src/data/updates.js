// ชั้นเชื่อม Firestore ของข่าวความคืบหน้า (/updates) — ตรรกะล้วนอยู่ที่ publicUpdates.js
import { useEffect, useState } from 'react'
import {
  collection, query, where, limit, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { sortUpdates, publishedOnly, buildUpdate } from './publicUpdates.js'

const COL = 'publicUpdates'
const PUBLIC_LIMIT = 100

// ฝั่งสาธารณะ: ต้องใส่ where('status','==','published') ในตัว query เอง
// ไม่ใช่ดึงมาหมดแล้วค่อยกรอง — rules ปฏิเสธ list ที่ไม่ผูก status มาตั้งแต่ต้น
// และไม่ใส่ orderBy: where + orderBy คนละฟิลด์ต้องมี composite index ที่ไม่มีอยู่ แล้วจะพังเงียบ ๆ
export function usePublicUpdates() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, COL), where('status', '==', 'published'), limit(PUBLIC_LIMIT)),
      (snap) => {
        // กรองซ้ำฝั่ง client ด้วย ไม่ได้เชื่อ query อย่างเดียว
        setItems(sortUpdates(publishedOnly(snap.docs.map((d) => ({ id: d.id, ...d.data() })))))
        setLoading(false)
      },
      () => { setError(true); setLoading(false) } // ต้องรู้ว่าล้ม ไม่ใช่ขึ้นว่า "ยังไม่มีข่าว"
    )
    return unsub
  }, [])

  return { items, loading, error }
}

// ฝั่งทีม: เห็นทั้งฉบับร่างและที่เผยแพร่แล้ว
export function useAllUpdates(enabled = true) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    const unsub = onSnapshot(
      query(collection(db, COL), limit(PUBLIC_LIMIT)),
      (snap) => {
        setItems(sortUpdates(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
        setLoading(false)
      },
      () => { setError(true); setLoading(false) }
    )
    return unsub
  }, [enabled])

  return { items, loading, error }
}

// คืน { ok, error, id } — ตรวจด้วย buildUpdate ก่อนเสมอ ไม่ส่งของดิบเข้า Firestore
export async function saveUpdate(id, input) {
  const built = buildUpdate(input)
  if (!built.ok) return built
  if (id) {
    await updateDoc(doc(db, COL, id), built.value)
    return { ok: true, id }
  }
  const ref = await addDoc(collection(db, COL), { ...built.value, createdAt: Date.now() })
  return { ok: true, id: ref.id }
}

export const removeUpdate = (id) => deleteDoc(doc(db, COL, id))
