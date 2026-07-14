import { useEffect, useState } from 'react'
import { db } from '../firebase.js'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'

// แบนเนอร์ประกาศหน้าแรก — เก็บ doc เดียวที่ config/announcement (อ่านได้ทุกคน, แก้ได้เฉพาะแอดมิน ตาม firestore.rules เดิม)

export function useAnnouncement() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'announcement'),
      (snap) => { setData(snap.exists() ? snap.data() : null); setLoading(false) },
      () => setLoading(false)
    )
    return unsub
  }, [])

  return { announcement: data, loading }
}

export const saveAnnouncement = (data) => setDoc(doc(db, 'config', 'announcement'), data, { merge: true })
