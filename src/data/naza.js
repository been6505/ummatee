import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { NAZA_DEFAULTS, seatDocId } from './nazaConfig.js'

// ระบบจองตั๋ว NAZA for GAZA — ข้อมูลอยู่บน Cloudflare (D1 + R2) เรียกผ่าน API ใน functions/api/
//   GET  /api/naza/state            ค่าตั้งงาน + ที่นั่งที่ถูกถือไว้ (สาธารณะ)
//   POST /api/naza/bookings         จอง + แนบสลิป (multipart)
//   GET  /api/naza/bookings/:id     ตั๋วหนึ่งใบ (id สุ่ม — ผู้จองจำไว้ในเครื่อง/ลิงก์ในอีเมล)
//   /api/admin/naza/...             ฝั่งแอดมิน — อยู่หลัง Cloudflare Access (ดู functions/api/admin/_middleware.js)
//
// "อัปเดตสด" ใช้การถามซ้ำเป็นระยะ (หยุดเมื่อแท็บถูกซ่อน) แทน onSnapshot ของ Firestore
// ผู้จองไม่ต้องล็อกอิน — จำ id การจองไว้ใน localStorage แบบเดิม
//
// VITE_API_BASE: เว้นว่าง = เว็บกับ API อยู่โดเมนเดียวกัน (Cloudflare Pages) — ตั้งเป็น URL เต็มถ้าหน้าเว็บ
// ถูกเปิดจากโดเมนอื่น เช่น ummatee-app.web.app ระหว่างย้าย (API สาธารณะเปิด CORS ไว้ ส่วนแอดมินไม่เปิด)
const API = (import.meta.env?.VITE_API_BASE || '').replace(/\/$/, '')
const STATE_POLL_MS = 5000
const MINE_POLL_MS = 15000
const ADMIN_POLL_MS = 8000

export class SeatTakenError extends Error {
  constructor(seat) { super(`seat ${seat} taken`); this.code = 'seat-taken'; this.seat = seat }
}
export class ApiError extends Error {
  constructor(status, message, body) { super(message); this.status = status; this.body = body; this.code = status === 401 ? 'unauthenticated' : status === 403 ? 'permission-denied' : 'api' }
}

async function api(path, init = {}) {
  const res = await fetch(API + path, { credentials: 'same-origin', ...init })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = null }
  if (!res.ok) {
    if (res.status === 409 && body?.seat) throw new SeatTakenError(body.seat)
    throw new ApiError(res.status, body?.error || `HTTP ${res.status}`, body)
  }
  if (body === null && text) throw new ApiError(res.status, 'API ตอบกลับไม่ใช่ JSON — ยังไม่ได้ตั้ง Cloudflare Pages Functions?')
  return body
}

// ทำงานซ้ำทุก ms วินาทีเฉพาะตอนแท็บเปิดอยู่ + ทำทันทีเมื่อกลับมาที่แท็บ
function usePoll(fn, ms, deps) {
  useEffect(() => {
    let stop = false, t = 0
    const tick = async () => {
      clearTimeout(t)
      if (document.visibilityState !== 'hidden') { try { await fn() } catch { /* fn จัดการ error เอง */ } }
      if (!stop) t = setTimeout(tick, ms)
    }
    const onVis = () => { if (document.visibilityState === 'visible') tick() }
    tick()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop = true; clearTimeout(t); document.removeEventListener('visibilitychange', onVis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// ── สถานะงาน (ค่าตั้ง + ที่นั่ง) — ดึงครั้งเดียวใช้ร่วมกันทุก component ─────────
let stateSnap = { config: NAZA_DEFAULTS, seats: {}, loaded: false, error: false }
const listeners = new Set()
let pollers = 0, pollTimer = 0
const emit = () => listeners.forEach((l) => l())

export async function refreshNazaState() {
  try {
    const s = await api('/api/naza/state')
    const seats = {}
    for (const [round, seat, status] of s.seats || []) seats[seatDocId(round, seat)] = { round, seat, status }
    stateSnap = { config: { ...NAZA_DEFAULTS, ...(s.config || {}) }, seats, loaded: true, error: false }
  } catch {
    stateSnap = { ...stateSnap, loaded: true, error: true }
  }
  emit()
}
function pollState() {
  clearTimeout(pollTimer)
  if (!pollers) return
  const run = document.visibilityState === 'hidden' ? Promise.resolve() : refreshNazaState()
  run.finally(() => { if (pollers) pollTimer = setTimeout(pollState, STATE_POLL_MS) })
}
function subscribeState(l) {
  listeners.add(l)
  if (pollers++ === 0) { pollState(); document.addEventListener('visibilitychange', pollState) }
  return () => {
    listeners.delete(l)
    if (--pollers === 0) { clearTimeout(pollTimer); document.removeEventListener('visibilitychange', pollState) }
  }
}
const useNazaState = () => useSyncExternalStore(subscribeState, () => stateSnap)

export function useNazaConfig() {
  const s = useNazaState()
  return { config: s.config, loaded: s.loaded }
}
export function useNazaSeats() {
  const s = useNazaState()
  return { seats: s.seats, ready: s.loaded, error: s.error }
}

// จอง + แนบสลิปในคำขอเดียว — ที่นั่งชนโยน SeatTakenError
export async function createNazaBooking({ round, seats, name, phone, email, slipFile }) {
  const fd = new FormData()
  fd.append('round', round)
  fd.append('seats', JSON.stringify(seats))
  fd.append('name', name)
  fd.append('phone', phone)
  fd.append('email', email)
  fd.append('slip', slipFile, slipFile.name || 'slip.jpg')
  try {
    const { id } = await api('/api/naza/bookings', { method: 'POST', body: fd })
    rememberBooking(id)
    return id
  } finally {
    refreshNazaState() // ได้ผังที่นั่งล่าสุดทันที ไม่ต้องรอรอบถัดไป
  }
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
  usePoll(async () => {
    const results = await Promise.all(ids.map((id) => api(`/api/naza/bookings/${encodeURIComponent(id)}`)
      .then((b) => [id, b])
      .catch((e) => [id, e.status === 404 ? null : undefined]))) // undefined = เน็ตล่ม คงค่าเดิมไว้
    setItems((m) => {
      const next = { ...m }
      for (const [id, b] of results) if (b !== undefined) next[id] = b
      return next
    })
  }, MINE_POLL_MS, [ids.join(',')])
  const list = ids.map((id) => items[id]).filter(Boolean)
  return { list, byId: items, loading: ids.some((id) => !(id in items)) }
}

// ── ฝั่งแอดมิน ───────────────────────────────────────────────────────
export const nazaWhoAmI = () => api('/api/admin/me')

export function useNazaBookings() {
  const [state, setState] = useState({ list: [], seats: {}, config: NAZA_DEFAULTS, loading: true, error: null })
  const load = useCallback(async () => {
    try {
      const r = await api('/api/admin/naza/bookings')
      setState({ list: r.bookings || [], seats: r.seats || {}, config: { ...NAZA_DEFAULTS, ...(r.config || {}) }, loading: false, error: null })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e }))
    }
  }, [])
  usePoll(load, ADMIN_POLL_MS, [load])
  return { ...state, reload: load }
}

const adminAction = (id, action) => api(`/api/admin/naza/bookings/${encodeURIComponent(id)}/${action}`, { method: 'POST' })
export const confirmNazaBooking = (b) => adminAction(b.id, 'confirm')
export const rejectNazaBooking = (b) => adminAction(b.id, 'reject')
export const setNazaCheckIn = (id, on) => adminAction(id, on ? 'checkin' : 'uncheckin')
// ส่งอีเมลตามสถานะปัจจุบันอีกครั้ง — คืนผลจาก Apps Script ({ mailed, already, error }) หรือ null
export const resendNazaEmail = (id) => adminAction(id, 'email').then((r) => r?.result ?? null)

export const saveNazaConfig = (cfg) => api('/api/admin/naza/config', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg),
}).then((r) => { refreshNazaState(); return r })
