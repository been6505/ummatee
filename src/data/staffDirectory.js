import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDocs } from 'firebase/firestore'

// สมุดรายชื่อทีมแบบย่อ — ใช้เป็นตัวเลือกในช่อง "ผู้รับผิดชอบ" ทุกที่ (บอร์ด/คอนเทนต์/แคมเปญ)
//
// เก็บแยกจาก staff/ เพราะ staff/ อ่านได้เฉพาะ doc ตัวเองกับ super admin (ดู firestore.rules)
// ทีมงานทั่วไปจึงไล่รายชื่อเพื่อนร่วมทีมไม่ได้ ซึ่งแปลว่ามอบหมายงานให้กันไม่ได้เลย
//
// ที่นี่มีแค่ป้ายชื่อสำหรับ UI — ไม่ได้ให้สิทธิ์อะไร สิทธิ์จริงยังตัดสินจาก staff/{uid} เท่านั้น
// ซิงก์จากหน้า /admin/staff (super admin) ไม่ใช่ของที่อัปเดตตัวเอง เพราะไม่มี Cloud Functions

export const ROLE_LABEL = {
  admin: 'ผู้ดูแล',
  staff: 'ทีมงาน',
  social: 'โซเชียล',
  pending: 'รออนุมัติ',
}

// ชื่อที่เอาไว้โชว์ — staff หลายคนยังไม่ได้ตั้งชื่อ ใช้ส่วนหน้าอีเมลแทนดีกว่าโชว์ว่าง
export const memberLabel = (m) => m?.name?.trim() || (m?.email || '').split('@')[0] || 'ไม่ทราบชื่อ'

export function useStaffDirectory() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'staffDirectory'),
      (snap) => {
        setMembers(
          snap.docs
            .map((d) => ({ uid: d.id, ...d.data() }))
            .sort((a, b) => memberLabel(a).localeCompare(memberLabel(b), 'th'))
        )
        setLoading(false)
      },
      // ไม่มีสิทธิ์อ่าน (เช่น role ยัง pending) = ถือว่าไม่มีรายชื่อ ไม่ใช่หน้าพัง
      () => setLoading(false)
    )
    return unsub
  }, [])

  return { members, loading }
}

// หาชื่อจาก uid ที่เก็บไว้ในงาน — งานเก่าที่คนถูกลบออกจากทีมไปแล้วต้องไม่แสดงเป็นค่าว่างเฉยๆ
// ไม่งั้นจะดูเหมือน "ไม่มีคนรับผิดชอบ" ทั้งที่จริงคือคนรับผิดชอบหายไปจากระบบ
export function findMember(members, uid) {
  if (!uid) return null
  return members.find((m) => m.uid === uid) || { uid, name: '', email: '', role: null, missing: true }
}

// ซิงก์สมุดรายชื่อจาก staff/ ทั้งชุด — เรียกจากหน้า /admin/staff หลังเปลี่ยน role/เปิด-ปิดใช้งาน
// เขียนเฉพาะคนที่ active และ role ใช้งานได้จริง ส่วนคนที่ถูกปิด/ยัง pending จะถูกลบออกจากสมุด
// (คนที่ไม่มีสิทธิ์เข้าระบบไม่ควรถูกมอบหมายงานได้)
// ตรงกับ role ที่ firestore.rules ให้อ่าน staffDirectory ได้ — ต้องตรงกันเสมอ
// ไม่งั้นจะมีคนที่ "ถูกมอบหมายงานได้ แต่เปิดดูงานของตัวเองไม่ได้"
// (role 'field' ยังไม่รวม เพราะยังไม่มีสิทธิ์เข้าส่วนไหนใน rules เลย — ถ้าจะให้รับงานได้ต้องเปิดสิทธิ์ที่ rules ก่อน)
const ASSIGNABLE_ROLES = ['admin', 'staff', 'social']

export async function syncStaffDirectory(staffList) {
  const keep = new Set()
  await Promise.all(
    staffList
      .filter((s) => s.active !== false && ASSIGNABLE_ROLES.includes(s.role))
      .map((s) => {
        keep.add(s.id)
        return setDoc(doc(db, 'staffDirectory', s.id), {
          name: s.name || '',
          email: s.email || '',
          role: s.role,
        })
      })
  )

  // เก็บกวาดคนที่ไม่ควรอยู่ในสมุดแล้ว
  const existing = await getDocs(collection(db, 'staffDirectory'))
  await Promise.all(existing.docs.filter((d) => !keep.has(d.id)).map((d) => deleteDoc(d.ref)))

  return keep.size
}
