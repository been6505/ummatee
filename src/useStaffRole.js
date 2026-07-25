// Hook สำหรับระบบ staff role ใหม่ (แยกจาก isAdmin/isFullAdmin เดิมที่เช็คจาก email allowlist)
// อ่าน/สร้าง doc staff/{uid} — ใช้ uid แทน email เพราะ Firestore rules เช็ค request.auth.uid ได้ตรงๆ
//
// การ bootstrap แอดมินคนแรก "ไม่" ทำอัตโนมัติแบบยกสิทธิ์ตัวเองเป็น admin (เสี่ยง race/ช่องโหว่ในระบบที่ไม่มี
// server ตรวจสอบ) — ผู้ใช้ที่ล็อกอินแล้วยังไม่มี staff doc จะถูกสร้างเป็น role: 'staff' (สิทธิ์ต่ำสุด) ให้เอง
// ส่วนแอดมินคนแรกต้องตั้งเองผ่าน Firebase Console (ดูรายงานท้ายงานสำหรับขั้นตอน)
import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from './firebase.js'

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
        // สมัครตัวเองเป็น staff (role ต่ำสุด) ครั้งแรกที่ล็อกอิน — rules อนุญาตแค่ path นี้ (สร้าง doc ตัวเอง role:'staff' เท่านั้น)
        setBootstrapped(true)
        try {
          await setDoc(ref, {
            email: user.email || '',
            name: user.displayName || '',
            role: 'staff',
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
