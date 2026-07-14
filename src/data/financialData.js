import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'

// ค่าเริ่มต้นของแดชบอร์ดการเงิน (Financial Dashboard) — ใช้เป็น fallback ถ้ายังไม่มีข้อมูลใน Firestore
export const DEFAULT_FINANCIAL = {
  poor: 5000, // จำนวนผู้ยากไร้เป้าหมาย (คน)
  perPerson: 100, // ค่าใช้จ่ายช่วยเหลือต่อคน (บาท)
  raised: 0, // ยอดบริจาคสะสม (บาท)
  account: {
    bank: 'ธนาคารอิสลามแห่งประเทศไทย (ibank)',
    name: 'เพื่อช่วยเหลือผู้ยากไร้ปาเลสไตน์',
    number: '0011 1863 48',
  },
}

export const FINANCIAL_DOC_REF = doc(db, 'config', 'financialDashboard')

// แปลงข้อมูลดิบจาก Firestore ให้ปลอดภัยเสมอ — บังคับ poor/perPerson/raised เป็นตัวเลขจำกัด (finite)
// กัน null / string / NaN ที่อาจหลุดมาจากการแก้ doc มือ ไม่ให้ทำให้ .toLocaleString() พังทั้งหน้า (จอขาวบนทีวี)
function sanitize(raw) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return {
    ...DEFAULT_FINANCIAL,
    ...raw,
    poor: num(raw?.poor ?? DEFAULT_FINANCIAL.poor),
    perPerson: num(raw?.perPerson ?? DEFAULT_FINANCIAL.perPerson),
    raised: num(raw?.raised ?? DEFAULT_FINANCIAL.raised),
    account: { ...DEFAULT_FINANCIAL.account, ...(raw?.account || {}) },
  }
}

// อ่านข้อมูลแดชบอร์ดการเงินแบบเรียลไทม์จาก Firestore (config/financialDashboard)
export function useFinancialData() {
  const [data, setData] = useState(DEFAULT_FINANCIAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(FINANCIAL_DOC_REF, (snap) => {
      setData(snap.exists() ? sanitize(snap.data()) : DEFAULT_FINANCIAL)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  return { data, loading }
}

export async function fetchFinancialData() {
  const snap = await getDoc(FINANCIAL_DOC_REF)
  return snap.exists() ? sanitize(snap.data()) : DEFAULT_FINANCIAL
}

export async function saveFinancialData(data) {
  await setDoc(FINANCIAL_DOC_REF, data)
}
