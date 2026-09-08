// Hook สำหรับเช็คสถานะล็อกอินของผู้ดูแลระบบ ผ่าน Firebase Authentication
// (อีเมล/รหัสผ่าน หรือบัญชี Google)
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase.js'
import { isAllowedEmail } from './useAdminRole.js'

// ช่องบอก AdminLogin ว่าเพิ่งเตะใครออกเพราะอีเมลไม่อยู่ในรายชื่อ — ใช้ sessionStorage เพราะ
// หน้าแอดมินกว่า 20 หน้าเรียก hook นี้เองแล้วเรนเดอร์ <AdminLogin /> โดยไม่ส่ง prop ต่อกัน
export const DENIED_KEY = 'umAuthDeniedEmail'

export default function useAdminAuth() {
  const allowed = (u) => !u || isAllowedEmail(u.email)
  const [user, setUser] = useState(() => (allowed(auth.currentUser) ? auth.currentUser : null))
  const [loading, setLoading] = useState(!auth.currentUser)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      // ล็อกอิน Google สำเร็จได้ด้วยบัญชีอะไรก็ได้ ต้องเช็ครายชื่อที่มีสิทธิ์เองอีกชั้น
      // แล้วเตะออกทันที ไม่ให้ค้างอยู่ในหน้าแอดมินโดยที่อ่าน/เขียนอะไรไม่ได้เลย
      if (u && !isAllowedEmail(u.email)) {
        sessionStorage.setItem(DENIED_KEY, u.email || '')
        setUser(null)
        setLoading(false)
        signOut(auth).catch(() => {})
        return
      }
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  return { user, loading }
}
