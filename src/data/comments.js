import { useEffect, useState } from 'react'
import { db, auth } from '../firebase.js'
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore'

// คอมเมนต์ต่อชิ้นงาน — ผูกกับงานชิ้นไหนก็ได้ด้วยคู่ (entityType, entityId)
// ใช้ได้กับการ์ดบอร์ด / โพสต์ในปฏิทิน / ร้าน B2UM / แคมเปญ โดยไม่ต้องมี collection แยกต่อชนิด
//
// ทำไมต้องมี: ที่ผ่านมาคุยเรื่องงานในระบบไม่ได้เลย ต้องไปคุยกันที่แชทข้างนอกแล้วบริบทหาย
// คนที่มารับงานต่อทีหลังจะไม่เห็นว่าเคยตกลงอะไรกันไว้ เห็นแต่ผลลัพธ์สุดท้ายที่ไม่มีที่มา
//
// ต่างจาก auditLog: auditLog คือ "ระบบบันทึกว่าใครเปลี่ยนอะไร" อัตโนมัติและลบไม่ได้
// ส่วนนี่คือ "คนพิมพ์คุยกันเอง" ลบของตัวเองได้ — คนละวัตถุประสงค์ ไม่ควรปนกัน

export const MAX_COMMENT_LEN = 2000

export function useComments(entityType, entityId) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!entityType || !entityId) { setComments([]); setLoading(false); return }
    // where 2 ฟิลด์ + orderby ต้องมี composite index ที่ Firestore ไม่สร้างให้เอง แล้ว query จะพังเงียบๆ
    // (เคยเจอมาแล้วที่บอร์ด) — จำนวนคอมเมนต์ต่อชิ้นงานน้อย เรียงฝั่ง client พอ
    const qy = query(
      collection(db, 'comments'),
      where('entityType', '==', entityType),
      where('entityId', '==', entityId)
    )
    const unsub = onSnapshot(
      qy,
      (snap) => {
        setComments(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
        )
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [entityType, entityId])

  return { comments, loading }
}

export async function addComment(entityType, entityId, text) {
  const body = String(text || '').trim().slice(0, MAX_COMMENT_LEN)
  if (!body) return
  const u = auth.currentUser
  // เก็บชื่อ/อีเมลผู้เขียนไว้กับคอมเมนต์เลย ไม่ใช่แค่ uid — คนที่ออกจากทีมไปแล้วจะหายจาก
  // staffDirectory ทำให้คอมเมนต์เก่ากลายเป็น "ไม่ทราบชื่อ" ทั้งที่ตอนเขียนรู้ว่าเป็นใคร
  await addDoc(collection(db, 'comments'), {
    entityType,
    entityId: String(entityId),
    text: body,
    authorUid: u?.uid || '',
    authorEmail: u?.email || '',
    authorName: u?.displayName || '',
    createdAt: serverTimestamp(),
  })
}

export const removeComment = (id) => deleteDoc(doc(db, 'comments', id))

// ชื่อที่เอาไว้โชว์ — ส่วนใหญ่ไม่ได้ตั้ง displayName ใน Firebase Auth ใช้ส่วนหน้าอีเมลแทน
export const commentAuthorLabel = (c) =>
  c?.authorName?.trim() || String(c?.authorEmail || '').split('@')[0] || 'ไม่ทราบชื่อ'
