import { useEffect, useState } from 'react'
import { db, auth } from '../firebase.js'
import {
  collection, doc, onSnapshot, runTransaction, updateDoc, setDoc, query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { NAZA_DEFAULTS, seatDocId } from './nazaConfig.js'
import { notifyNazaBooking } from '../utils/lineNotify.js'

// ระบบจองตั๋ว NAZA for GAZA — ข้อมูลอยู่ 3 ที่
//   config/nazaEvent        ราคา/เลขพร้อมเพย์/เปิด-ปิดรับจอง (ทุกคนอ่านได้ staff แก้ได้)
//   nazaSeats/{round}_{seat} ที่นั่งที่ถูกถือไว้ (ทุกคนอ่านได้ — ใช้วาดผังที่นั่ง ไม่มีข้อมูลส่วนตัว)
//   nazaBookings/{autoId}   การจอง + ชื่อ/เบอร์/สลิป (ทุกคน get ได้ด้วย id สุ่ม แต่ list ได้เฉพาะ staff)
//
// ผู้จองไม่ต้องล็อกอิน (แบบเดียวกับ guest checkout ของ um-shop) — จำ id การจองไว้ใน localStorage
// การกันจองที่นั่งซ้ำอยู่ที่ transaction + rules: เอกสารที่นั่งสร้างได้เฉพาะตอนยังไม่มี
// และ rules บังคับให้สร้างพร้อมเอกสารการจองที่อ้างถึงกันในคำสั่งเดียว (ดู match /nazaSeats)

const CONFIG_REF = () => doc(db, 'config', 'nazaEvent')

export function useNazaConfig() {
  const [config, setConfig] = useState(NAZA_DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => onSnapshot(CONFIG_REF(), (snap) => {
    setConfig({ ...NAZA_DEFAULTS, ...(snap.exists() ? snap.data() : {}) })
    setLoaded(true)
  }, () => setLoaded(true)), [])
  return { config, loaded }
}

export const saveNazaConfig = (patch) => setDoc(CONFIG_REF(), patch, { merge: true })

// ที่นั่งที่ถูกถือไว้ทั้งหมด — map ของ docId → ข้อมูลที่นั่ง (ทั้งงานมีแค่ 180 ที่ subscribe ทั้งก้อนได้)
export function useNazaSeats() {
  const [seats, setSeats] = useState({})
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => onSnapshot(collection(db, 'nazaSeats'), (snap) => {
    const m = {}
    snap.docs.forEach((d) => { m[d.id] = d.data() })
    setSeats(m); setReady(true); setError(false)
  }, () => { setReady(true); setError(true) }), [])
  return { seats, ready, error }
}

export class SeatTakenError extends Error {
  constructor(seat) { super(`seat ${seat} taken`); this.code = 'seat-taken'; this.seat = seat }
}

// สร้างการจอง + ถือที่นั่งในทรานแซกชันเดียว — ถ้ามีที่นั่งไหนถูกจองไปแล้วจะโยน SeatTakenError
export async function createNazaBooking({ code, round, seats, name, phone, email, slipUrl, amount }) {
  const bookingRef = doc(collection(db, 'nazaBookings'))
  const seatRefs = seats.map((s) => doc(db, 'nazaSeats', seatDocId(round, s)))
  await runTransaction(db, async (tx) => {
    const snaps = await Promise.all(seatRefs.map((r) => tx.get(r)))
    const i = snaps.findIndex((s) => s.exists())
    if (i >= 0) throw new SeatTakenError(seats[i])
    seatRefs.forEach((r, k) => tx.set(r, {
      round, seat: seats[k], bookingId: bookingRef.id, status: 'pending', at: serverTimestamp(),
    }))
    tx.set(bookingRef, {
      code, round, seats, name, phone, email, amount, slipUrl, status: 'pending', createdAt: serverTimestamp(),
    })
  })
  rememberBooking(bookingRef.id)
  notifyNazaBooking(bookingRef.id) // อีเมล "ได้รับการจองแล้ว รอตรวจสลิป"
  return bookingRef.id
}

// ── ตั๋วของฉัน (จำไว้ในเครื่อง) ─────────────────────────────────────
const MINE_KEY = 'nazaMyBookings'
export function myBookingIds() {
  try { const v = JSON.parse(localStorage.getItem(MINE_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
// export ไว้ให้ลิงก์ตั๋วในอีเมล (/events/Naza?t=<id>) เพิ่มตั๋วเข้า "ตั๋วของฉัน" บนเครื่องใหม่ได้
export function rememberBooking(id) {
  if (!id || myBookingIds().includes(id)) { window.dispatchEvent(new Event('naza:mine')); return }
  try { localStorage.setItem(MINE_KEY, JSON.stringify([id, ...myBookingIds().filter((x) => x !== id)])) } catch { /* noop */ }
  window.dispatchEvent(new Event('naza:mine'))
}

export function useMyNazaBookings() {
  const [ids, setIds] = useState(myBookingIds)
  const [items, setItems] = useState({})
  useEffect(() => {
    const on = () => setIds(myBookingIds())
    window.addEventListener('naza:mine', on)
    window.addEventListener('storage', on)
    return () => { window.removeEventListener('naza:mine', on); window.removeEventListener('storage', on) }
  }, [])
  useEffect(() => {
    const unsubs = ids.map((id) => onSnapshot(doc(db, 'nazaBookings', id), (snap) => {
      setItems((m) => ({ ...m, [id]: snap.exists() ? { id, ...snap.data() } : null }))
    }, () => setItems((m) => ({ ...m, [id]: null }))))
    return () => unsubs.forEach((u) => u())
  }, [ids])
  const list = ids.map((id) => items[id]).filter(Boolean)
  return { list, byId: items, loading: ids.some((id) => !(id in items)) }
}

// ── ฝั่งแอดมิน ───────────────────────────────────────────────────────
export function useNazaBookings() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    const q = query(collection(db, 'nazaBookings'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false); setError(null)
    }, (e) => { setLoading(false); setError(e) })
  }, [])
  return { list, loading, error }
}

const reviewer = () => auth.currentUser?.email || ''

// อนุมัติ: ยืนยันที่นั่งทุกที่ของการจองนี้ — ถ้าเคยปฏิเสธแล้วคืนที่ไป ต้องเช็คว่ายังว่างอยู่ไหม
export async function confirmNazaBooking(b) {
  const seatRefs = b.seats.map((s) => doc(db, 'nazaSeats', seatDocId(b.round, s)))
  await runTransaction(db, async (tx) => {
    const snaps = await Promise.all(seatRefs.map((r) => tx.get(r)))
    const i = snaps.findIndex((s) => s.exists() && s.data().bookingId !== b.id)
    if (i >= 0) throw new SeatTakenError(b.seats[i])
    seatRefs.forEach((r, k) => tx.set(r, {
      round: b.round, seat: b.seats[k], bookingId: b.id, status: 'confirmed', at: serverTimestamp(),
    }))
    tx.update(doc(db, 'nazaBookings', b.id), { status: 'confirmed', reviewedAt: serverTimestamp(), reviewedBy: reviewer() })
  })
  notifyNazaBooking(b.id) // อีเมลตั๋วพร้อม QR
}

// ปฏิเสธ: คืนที่นั่ง (ลบเฉพาะเอกสารที่นั่งที่ยังเป็นของการจองนี้) ให้คนอื่นจองต่อได้ทันที
export async function rejectNazaBooking(b) {
  const seatRefs = b.seats.map((s) => doc(db, 'nazaSeats', seatDocId(b.round, s)))
  await runTransaction(db, async (tx) => {
    const snaps = await Promise.all(seatRefs.map((r) => tx.get(r)))
    snaps.forEach((s, k) => { if (s.exists() && s.data().bookingId === b.id) tx.delete(seatRefs[k]) })
    tx.update(doc(db, 'nazaBookings', b.id), { status: 'rejected', reviewedAt: serverTimestamp(), reviewedBy: reviewer() })
  })
  notifyNazaBooking(b.id) // อีเมลแจ้งสลิปไม่ผ่าน
}

export const setNazaCheckIn = (id, on) =>
  updateDoc(doc(db, 'nazaBookings', id), { checkedInAt: on ? serverTimestamp() : null, checkedInBy: on ? reviewer() : null })

export const setNazaNote = (id, note) => updateDoc(doc(db, 'nazaBookings', id), { adminNote: note })
