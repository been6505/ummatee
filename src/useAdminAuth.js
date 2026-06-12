// Hook สำหรับเช็คสถานะล็อกอินของผู้ดูแลระบบ ผ่าน Firebase Authentication (email/password)
import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase.js'

export default function useAdminAuth() {
  const [user, setUser] = useState(() => auth.currentUser)
  const [loading, setLoading] = useState(!auth.currentUser)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsub
  }, [])

  return { user, loading }
}
