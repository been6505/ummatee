import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore'
import { buildReview, buildIssue, normReviewStatus } from './shopFeedback.js'

// รีวิวสินค้า + แจ้งปัญหา — ตรรกะตรวจข้อมูลอยู่ใน data/shopFeedback.js (เทสต์ได้ ไม่แตะ firebase)

// ฝั่งสาธารณะ: ต้อง query where('status','==','approved') เท่านั้น
// ไม่ใช่แค่เพื่อกรอง — firestore.rules ปฏิเสธ list ที่ไม่ได้จำกัดไว้แบบนี้ (รีวิวที่ยังไม่ตรวจจะได้ไม่หลุด)
// ไม่ใส่ orderBy เพราะ where + orderBy คนละฟิลด์ต้องมี composite index ที่ไม่ได้สร้างไว้ เรียงฝั่ง client แทน
export function useApprovedReviews() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'productReviews'), where('status', '==', 'approved')),
      (snap) => {
        setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [])
  return { reviews, loading }
}

// ฝั่งแอดมิน: เห็นทุกสถานะเพื่อตรวจ
export function useAllReviews(enabled) {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!enabled) return
    const unsub = onSnapshot(
      collection(db, 'productReviews'),
      (snap) => {
        setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data(), status: normReviewStatus(d.data().status) }))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [enabled])
  return { reviews, loading }
}

export async function submitReview(input) {
  const r = buildReview(input)
  if (!r.ok) throw new Error(r.error)
  await addDoc(collection(db, 'productReviews'), r.value)
}

export const setReviewStatus = (id, status) => updateDoc(doc(db, 'productReviews', id), { status })
export const removeReview = (id) => deleteDoc(doc(db, 'productReviews', id))

export function useShopIssues(enabled) {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!enabled) return
    const unsub = onSnapshot(
      collection(db, 'shopIssues'),
      (snap) => {
        setIssues(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
        setLoading(false)
      },
      () => setLoading(false)
    )
    return unsub
  }, [enabled])
  return { issues, loading }
}

export async function submitIssue(input) {
  const r = buildIssue(input)
  if (!r.ok) throw new Error(r.error)
  await addDoc(collection(db, 'shopIssues'), r.value)
}

export const setIssueStatus = (id, status) => updateDoc(doc(db, 'shopIssues', id), { status })
