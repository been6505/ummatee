import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import {
  collection, doc, setDoc, updateDoc, deleteDoc, getDoc, onSnapshot, query, orderBy,
} from 'firebase/firestore'

// ห้องประชุมวิดีโอ (Jitsi Meet) — เก็บใน Firestore collection "meetings"
//
// แนวคิดความปลอดภัย: ลิงก์เชิญคือ /meet/<meeting id> โดย id เป็น UUID สุ่ม (เดาไม่ได้)
// - คนนอกเข้าได้โดยไม่ต้องล็อกอิน แค่ต้องมีลิงก์ (capability link แบบเดียวกับลิงก์ติดตามคำสั่งซื้อ)
// - "ไม่ public" คือไม่มีลิงก์ไปหน้านี้จากที่ไหนในเว็บเลย และ list ทั้งคอลเลกชันได้เฉพาะ staff
//   (firestore.rules: allow get: if true / allow list: if isStaffRole([...])) คนนอกจึงไล่ดูห้องทั้งหมดไม่ได้
// - ปิดห้องได้ทันที (active: false) และมีวันหมดอายุ ลิงก์ที่หลุดไปแล้วจะใช้ต่อไม่ได้
//
// ⚠️ ชื่อห้อง Jitsi (room) เป็นความลับตัวจริง — ใครรู้ชื่อห้องก็เข้า meet.jit.si/<room> ตรงได้โดยไม่ผ่านเว็บเรา
// จึงต้องสุ่มให้ยาวพอและไม่เอาชื่อหัวข้อประชุมมาตั้ง (กันเดาจากชื่องาน) ถ้าเป็นประชุมที่ข้อมูลอ่อนไหว
// ควรตั้งรหัสห้องใน Jitsi เพิ่มอีกชั้นด้วย (ปุ่ม Security ในห้อง) เพราะเราคุมฝั่ง Jitsi ไม่ได้

const COL = 'meetings'
const DEFAULT_HOURS = 24 // ลิงก์เชิญอยู่ได้ 24 ชม.

const randomId = () => (crypto.randomUUID ? crypto.randomUUID() : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`)

// ชื่อห้อง Jitsi สุ่มยาว ๆ ไม่ผูกกับหัวข้อประชุม (ดูเหตุผลด้านบน)
const randomRoom = () => `ummatee-${randomId().replace(/-/g, '').slice(0, 20)}`

export const meetingUrl = (id) => `${window.location.origin}/meet/${id}`

// ห้องยังใช้ได้ไหม — ปิดเองแล้ว หรือเลยกำหนดหมดอายุ ถือว่าใช้ไม่ได้
export const isMeetingOpen = (m) => !!m && m.active !== false && (!m.expiresAt || m.expiresAt > Date.now())

export async function createMeeting({ title, hours = DEFAULT_HOURS, createdBy = '' }) {
  const id = randomId()
  const data = {
    room: randomRoom(),
    title: String(title || '').trim().slice(0, 200),
    createdBy: String(createdBy || '').slice(0, 200),
    createdAt: Date.now(),
    expiresAt: Date.now() + hours * 3600 * 1000,
    active: true,
  }
  await setDoc(doc(db, COL, id), data)
  return { id, ...data }
}

export const closeMeeting = (id) => updateDoc(doc(db, COL, id), { active: false })
export const reopenMeeting = (id, hours = DEFAULT_HOURS) =>
  updateDoc(doc(db, COL, id), { active: true, expiresAt: Date.now() + hours * 3600 * 1000 })
export const deleteMeeting = (id) => deleteDoc(doc(db, COL, id))

// รายการห้องทั้งหมด (ฝั่ง staff) — เรียลไทม์ ให้เห็นสถานะเปิด/ปิดล่าสุด
export function useMeetings() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const qy = query(collection(db, COL), orderBy('createdAt', 'desc'))
    return onSnapshot(qy, (snap) => {
      setMeetings(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
  }, [])
  return { meetings, loading }
}

// อ่านห้องเดียวสำหรับหน้าเข้าร่วมของคนนอก — อ่านครั้งเดียว (getDoc) ไม่ต้อง listener ค้างไว้
// notFound แยกจาก loading เพื่อให้หน้าแยกข้อความ "กำลังโหลด" กับ "ลิงก์ไม่ถูกต้อง" ได้
export function useMeeting(id) {
  const [meeting, setMeeting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  useEffect(() => {
    if (!id) { setLoading(false); setNotFound(true); return }
    let cancelled = false
    getDoc(doc(db, COL, id))
      .then((snap) => {
        if (cancelled) return
        if (snap.exists()) setMeeting({ id: snap.id, ...snap.data() })
        else setNotFound(true)
      })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])
  return { meeting, loading, notFound }
}
