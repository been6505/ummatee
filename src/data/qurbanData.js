import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'

// ค่าเริ่มต้น (เดิมเป็นค่าฮาร์ดโค้ดในหน้า admin/public) — ใช้เป็น fallback ถ้ายังไม่มีข้อมูลใน Firestore
export const DEFAULT_QURBAN = {
  categories: {
    palestine: 145,
    syria: 12,
    thailand: 34,
    worldwide: 100,
  },
  summary: {
    countries: 31,
    cows: 279,
    sheep: 17,
    total: 1948,
  },
  afghanistanSheep: 5,
  countries: [
    { n: 'India', v: 55 },
    { n: 'Chad', v: 13 },
    { n: 'Bangladesh', v: 3 },
    { n: 'Benin', v: 2 },
    { n: 'Ethiopia', v: 2 },
    { n: 'Kenya', v: 2 },
    { n: 'Mozambique', v: 2 },
    { n: 'Nigeria', v: 2 },
    { n: 'Kashmir', v: 1 },
    { n: 'Yemen', v: 1 },
    { n: 'Indonesia', v: 1 },
    { n: 'Lebanon', v: 1 },
    { n: 'Pakistan', v: 1 },
    { n: 'Nepal', v: 1 },
    { n: 'Sudan', v: 1 },
    { n: 'Myanmar', v: 1 },
    { n: 'Mauritania', v: 1 },
    { n: 'Sierra Leone', v: 1 },
    { n: 'South Sudan', v: 1 },
    { n: 'Malawi', v: 1 },
    { n: 'Somalia', v: 1 },
    { n: 'Cameroon', v: 1 },
    { n: 'Uganda', v: 1 },
    { n: 'Niger', v: 1 },
    { n: 'Tanzania', v: 1 },
    { n: 'Rohingya', v: 1 },
    { n: 'Burkina Faso', v: 1 },
  ],
}

export const QURBAN_DOC_REF = doc(db, 'config', 'qurban2026')

// อ่านข้อมูลกุรบานแบบเรียลไทม์จาก Firestore (config/qurban2026) — ถ้ายังไม่มี ใช้ค่า DEFAULT_QURBAN
export function useQurbanData() {
  const [data, setData] = useState(DEFAULT_QURBAN)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(QURBAN_DOC_REF, (snap) => {
      if (snap.exists()) setData({ ...DEFAULT_QURBAN, ...snap.data() })
      else setData(DEFAULT_QURBAN)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  return { data, loading }
}

export async function fetchQurbanData() {
  const snap = await getDoc(QURBAN_DOC_REF)
  return snap.exists() ? { ...DEFAULT_QURBAN, ...snap.data() } : DEFAULT_QURBAN
}

export async function saveQurbanData(data) {
  await setDoc(QURBAN_DOC_REF, data)
}
