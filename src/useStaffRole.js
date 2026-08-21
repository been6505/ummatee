// Hook สำหรับระบบ staff role ใหม่ (แยกจาก isAdmin/isFullAdmin เดิมที่เช็คจาก email allowlist)
// อ่าน/สร้าง doc staff/{uid} — ใช้ uid แทน email เพราะ Firestore rules เช็ค request.auth.uid ได้ตรงๆ
//
// การ bootstrap แอดมินคนแรก "ไม่" ทำอัตโนมัติแบบยกสิทธิ์ตัวเองเป็น admin (เสี่ยง race/ช่องโหว่ในระบบที่ไม่มี
// server ตรวจสอบ) — ผู้ใช้ที่ล็อกอินแล้วยังไม่มี staff doc จะถูกสร้างเป็น role: 'pending' ซึ่ง "เข้าถึงอะไรไม่ได้เลย"
// (ไม่ปรากฏใน isStaffRole([...]) ของ collection ใดๆ ใน firestore.rules) แล้วรอแอดมินอนุมัติเปลี่ยน role ให้
//
// ⚠️ ห้ามเปลี่ยนกลับเป็น 'staff': ใครก็สมัคร Firebase Auth เองได้ (มี Google Sign-In เปิดอยู่) ถ้า default เป็น
// 'staff' คนนอกที่ล็อกอินมาจะได้สิทธิ์อ่าน/เขียน/ลบ CRM ทั้งหมดทันที รวมข้อมูลส่วนบุคคลของผู้รับความช่วยเหลือ
// firestore.rules บังคับไว้อีกชั้นแล้วว่า self-create ได้เฉพาะ role == 'pending' เท่านั้น (ดูคอมเมนต์ที่ staff/{staffId})
// ส่วนแอดมินคนแรกต้องตั้งเองผ่าน Firebase Console
import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from './firebase.js'
import { isFullAdminEmail } from './useAdminRole.js'

export default function useStaffRole(user) {
  const [staff, setStaff] = useState(null)
  const [loading, setLoading] = useState(true)
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    if (!user) { setStaff(null); setLoading(false); return }
    setLoading(true)
    const ref = doc(db, 'staff', user.uid)
    const unsub = onSnapshot(ref, async (snap) => {
      if (snap.exists()) {
        setStaff({ id: snap.id, ...snap.data() })
        setLoading(false)
      } else if (!bootstrapped) {
        // สมัครตัวเองครั้งแรกที่ล็อกอิน — ได้ role 'pending' ที่ยังไม่มีสิทธิ์อะไรเลย
        // ต้องรอแอดมินเลื่อน role ให้ที่ /admin/staff ก่อนถึงจะเข้าส่วนไหนได้ (rules บังคับ path นี้ทางเดียว)
        setBootstrapped(true)
        try {
          await setDoc(ref, {
            email: user.email || '',
            name: user.displayName || '',
            role: 'pending',
            active: true,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          })
        } catch (e) {
          console.error('bootstrap staff doc failed', e)
          setLoading(false)
        }
      }
    }, (err) => { console.error(err); setLoading(false) })
    return unsub
  }, [user?.uid, bootstrapped])

  return { staff, loading, role: staff?.role || null, active: staff?.active !== false }
}

// ใช้ในหน้า React เช็คว่า role ปัจจุบันอยู่ในลิสต์ที่อนุญาตไหม (ฝั่ง client แค่ซ่อน UI — ของจริงบังคับที่ firestore.rules)
export function hasStaffRole(staff, roles) {
  return !!staff && staff.active !== false && roles.includes(staff.role)
}

// role ที่ "ใช้จริง" — เจ้าของระบบ (email allowlist เดียวกับ isFullAdmin ใน rules) นับเป็น admin เสมอ
// แม้จะยังไม่มี staff doc หรือยังเป็น 'pending' อยู่ ตรงกับที่ StaffRoleGuard ปล่อยผ่าน
//
// มีไว้ให้หน้าที่ต้องรู้ role "ก่อน" จะเปิด listener (เช่นเลือกว่าจะ subscribe collection ไหน)
// ซึ่งเอาจาก children(staff) ของ guard ไม่ได้ เพราะ effect รันก่อนถึงตรงนั้น
export function effectiveRole(user, staff) {
  if (!user) return null
  if (isFullAdminEmail(user.email || '')) return 'admin'
  if (staff?.active === false) return null
  return staff?.role || null
}
