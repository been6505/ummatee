import { db } from '../firebase.js'
import {
  collection, doc, setDoc, updateDoc, runTransaction, onSnapshot,
} from 'firebase/firestore'
import { VOLUNTEER_ENDPOINT } from '../utils/endpoints.js'

// สมัครอาสาสมัคร — Firestore เป็นที่เก็บหลัก (ref มาจาก transaction ที่นี่ ไม่พึ่ง Google Sheet)
// Google Sheet (ผ่าน Apps Script) เป็นแค่สำรอง + ใช้ส่งอีเมลยืนยัน ถ้าเชื่อมต่อ Sheet ไม่ได้
// ข้อมูลก็ยังปลอดภัยอยู่ใน Firestore แล้ว ไม่หายเหมือนตอนพึ่ง Sheet เป็นหลัก

async function nextVolunteerRef() {
  const counterRef = doc(db, 'config', 'volunteerRefCounter')
  let num = 1
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    num = snap.exists() ? (snap.data().count ?? 0) + 1 : 1
    tx.set(counterRef, { count: num })
  })
  return `UMV-${String(num).padStart(4, '0')}`
}

// ส่งข้อมูลไป Sheet backup + อีเมลยืนยัน — ไม่บล็อกการสมัคร ถ้าล้มเหลวข้อมูลยังอยู่ใน Firestore ครบ
async function syncToSheet(docRef, regData) {
  try {
    const res = await fetch(VOLUNTEER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(regData),
    })
    if (!res.ok) throw new Error(`server error ${res.status}`)
    const out = await res.json()
    if (!out.ok) throw new Error(out.error || 'sheet sync failed')
    await updateDoc(docRef, { sheetSynced: true })
    return true
  } catch (e) {
    try { await updateDoc(docRef, { syncAttempts: (regData.syncAttempts || 0) + 1 }) } catch { /* noop — Firestore data itself already safe */ }
    return false
  }
}

// สร้างการสมัครอาสาสมัครใหม่ — คืน { ref, id } เสมอถ้า Firestore เขียนสำเร็จ (ไม่รอ Sheet)
export async function registerVolunteer(fields) {
  const ref = await nextVolunteerRef()
  const regData = { ref, type: 'volunteer', ...fields, sheetSynced: false, syncAttempts: 0 }
  const docRef = doc(collection(db, 'volunteerRegs'))
  await setDoc(docRef, regData)
  // ยิงไป Sheet แบบไม่รอ (best-effort) — ผู้ใช้ไม่ต้องรอ/ไม่ล้มเหลวเพราะ Sheet ช้าหรือล่ม
  syncToSheet(docRef, regData)
  return { ref, id: docRef.id }
}

// ให้แอดมินกดซิงก์ใหม่ได้เอง ถ้ารายการไหน sheetSynced ยังเป็น false
export async function retrySync(reg) {
  const docRef = doc(db, 'volunteerRegs', reg.id)
  return syncToSheet(docRef, reg)
}

// เรียงเองฝั่ง client (เหมือนเดิม) เพราะ date เก็บเป็น string locale th-TH ไม่ sort ตรงลำดับเวลาจริงถ้าใช้ orderBy ของ Firestore
export function watchVolunteerRegs(onData, onError) {
  return onSnapshot(collection(db, 'volunteerRegs'), (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}
