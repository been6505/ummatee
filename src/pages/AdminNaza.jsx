import { useCallback, useMemo, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { writeAuditLog } from '../lib/auditLog.js'
import { downloadCsv } from '../lib/csv.js'
import {
  NAZA_ROWS, NAZA_ROUNDS, SEATS_PER_ROUND, NAZA_DEFAULTS, roundLabel, roundShort, baht, sortSeats, seatDocId,
} from '../data/nazaConfig.js'
import {
  useNazaConfig, useNazaSeats, useNazaBookings, saveNazaConfig,
  confirmNazaBooking, rejectNazaBooking, setNazaCheckIn,
} from '../data/naza.js'
import { StatusPill, useNazaFonts } from '../components/naza/shared.jsx'
import NazaScanner from '../components/naza/NazaScanner.jsx'
import { notifyNazaBooking } from '../utils/lineNotify.js'

// แอดมินระบบจองตั๋ว NAZA for GAZA (/admin/events/naza)
// ตรวจสลิป → อนุมัติ (ยืนยันที่นั่ง) / ปฏิเสธ (คืนที่นั่ง) · ดูผังที่นั่งทุกรอบ · เช็กอินหน้างาน · ตั้งราคา/พร้อมเพย์/ปิดรับจอง
// สิทธิ์ตรงกับ isNazaStaff() ใน firestore.rules

const ROLES = ['admin', 'staff', 'field']
const FILTERS = [['pending', 'รอตรวจ'], ['confirmed', 'ยืนยันแล้ว'], ['rejected', 'ปฏิเสธ'], ['all', 'ทั้งหมด']]
const tsLabel = (ts) => {
  const d = ts?.toDate ? ts.toDate() : null
  return d ? d.toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
}
// ช่องค้นหารับข้อความจาก QR บนตั๋วได้ตรงๆ (NAZA|NZ-XXXXX|round|seats) — ดึงรหัสการจองออกมา
const normalizeSearch = (q) => {
  const s = q.trim()
  const m = s.match(/^NAZA\|([^|]+)\|/i)
  return (m ? m[1] : s).toLowerCase()
}

export default function AdminNaza() {
  return (
    <StaffRoleGuard allowedRoles={ROLES}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap"><NazaAdminBody /></div>
        </main>
      )}
    </StaffRoleGuard>
  )
}

function NazaAdminBody() {
  useNazaFonts('NAZA · ตรวจสลิป')
  const { list, loading, error } = useNazaBookings()
  const { seats } = useNazaSeats()
  const { config, loaded } = useNazaConfig()
  const [filter, setFilter] = useState('pending')
  const [roundF, setRoundF] = useState('all')
  const [q, setQ] = useState('')
  const [openSlip, setOpenSlip] = useState({})
  const [armed, setArmed] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [showCfg, setShowCfg] = useState(false)
  const [msg, setMsg] = useState('')
  const [scanning, setScanning] = useState(false)
  const [mailing, setMailing] = useState(null)

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const stats = useMemo(() => {
    const c = { pending: 0, confirmed: 0, rejected: 0 }
    let seatsConfirmed = 0, revenue = 0, checkedIn = 0
    list.forEach((b) => {
      c[b.status] = (c[b.status] || 0) + 1
      if (b.status === 'confirmed') { seatsConfirmed += b.seats.length; revenue += Number(b.amount) || 0; if (b.checkedInAt) checkedIn += b.seats.length }
    })
    return { ...c, seatsConfirmed, revenue, checkedIn }
  }, [list])

  const byId = useMemo(() => Object.fromEntries(list.map((b) => [b.id, b])), [list])

  const shown = useMemo(() => {
    const s = normalizeSearch(q)
    return list
      .filter((b) => filter === 'all' || b.status === filter)
      .filter((b) => roundF === 'all' || b.round === roundF)
      .filter((b) => !s || [b.code, b.name, b.phone, b.email].some((x) => String(x || '').toLowerCase().includes(s)))
  }, [list, filter, roundF, q])

  const act = async (b, kind) => {
    if (kind === 'reject' && armed !== b.id) {
      setArmed(b.id); setTimeout(() => setArmed((x) => (x === b.id ? null : x)), 3500); return
    }
    setArmed(null); setBusyId(b.id)
    try {
      if (kind === 'confirm') {
        await confirmNazaBooking(b)
        writeAuditLog({ action: 'update', entityType: 'nazaBooking', entityId: b.id, summary: `อนุมัติการจอง ${b.code} (${roundShort(b.round)} ${b.seats.join(',')})` })
        flash(`ยืนยัน ${b.code} แล้ว`)
      } else if (kind === 'reject') {
        await rejectNazaBooking(b)
        writeAuditLog({ action: 'update', entityType: 'nazaBooking', entityId: b.id, summary: `ปฏิเสธการจอง ${b.code} และคืนที่นั่ง` })
        flash(`ปฏิเสธ ${b.code} และคืนที่นั่งแล้ว`)
      } else if (kind === 'checkin' || kind === 'uncheckin') {
        await setNazaCheckIn(b.id, kind === 'checkin')
        flash(kind === 'checkin' ? `เช็กอิน ${b.code} แล้ว` : `ยกเลิกเช็กอิน ${b.code}`)
      }
    } catch (e) {
      if (e?.code === 'seat-taken') alert(`อนุมัติไม่ได้: ที่นั่ง ${e.seat} ถูกการจองอื่นถือไว้แล้ว\nติดต่อผู้จองเพื่อเปลี่ยนรอบ/ที่นั่ง หรือคืนเงิน`)
      else alert('บันทึกไม่สำเร็จ: ' + (e?.message || e))
    } finally { setBusyId(null) }
  }

  // ใช้กับเครื่องสแกน — ต้องคงที่ ไม่งั้นกล้องปิด/เปิดใหม่ทุกครั้งที่รายการจองอัปเดต
  const scanCheckIn = useCallback(async (b) => {
    await setNazaCheckIn(b.id, true)
  }, [])

  // ส่งอีเมลตามสถานะปัจจุบันอีกครั้ง (เช่น Apps Script ล่มตอนกดอนุมัติ) — ฝั่งนั้นไม่ส่งซ้ำถ้าส่งสำเร็จไปแล้ว
  const resendEmail = async (b) => {
    setMailing(b.id)
    const r = await notifyNazaBooking(b.id)
    setMailing(null)
    if (!r) flash('ติดต่อระบบอีเมลไม่ได้ — ตรวจการ deploy ของ Apps Script')
    else if (r.already) flash(`อีเมลสถานะนี้ของ ${b.code} เคยส่งไปแล้ว`)
    else if (r.mailed) flash(`ส่งอีเมลถึง ${b.email} แล้ว`)
    else flash('ส่งอีเมลไม่สำเร็จ: ' + (r.error || 'ไม่ทราบสาเหตุ'))
  }

  const exportCsv = () => {
    const rows = sortForExport(list).map((b) => [
      b.code, roundLabel(b.round), sortSeats(b.seats).join(' '), b.seats.length, b.name, b.phone, b.email || '', b.amount,
      { pending: 'รอตรวจ', confirmed: 'ยืนยันแล้ว', rejected: 'ปฏิเสธ' }[b.status] || b.status,
      b.checkedInAt ? 'เช็กอินแล้ว' : '', tsLabel(b.createdAt), b.slipUrl,
    ])
    downloadCsv('naza-bookings.csv', ['รหัส', 'รอบ', 'ที่นั่ง', 'จำนวน', 'ชื่อ', 'เบอร์', 'อีเมล', 'ยอด', 'สถานะ', 'เช็กอิน', 'จองเมื่อ', 'สลิป'], rows)
  }

  return (
    <div className="naza admin">
      <div className="app">
        <div className="stephead">
          <h1>NAZA for GAZA · ตรวจสลิป</h1>
          <p>อนุมัติเพื่อยืนยันที่นั่ง ปฏิเสธเพื่อคืนที่นั่งให้คนอื่นจอง · <a href="/events/Naza" target="_blank" rel="noreferrer">เปิดหน้าจอง ↗</a></p>
        </div>

        {error && <p className="formerr" style={{ marginTop: 12 }}>โหลดรายการจองไม่สำเร็จ ({error.code || 'error'}) — บัญชีนี้อาจไม่มีสิทธิ์</p>}

        <section className="sec">
          <div className="stats">
            <div className="panel stat"><b style={{ color: 'var(--pending)' }}>{stats.pending}</b><span>รอตรวจ</span></div>
            <div className="panel stat"><b style={{ color: 'var(--ok)' }}>{stats.confirmed}</b><span>ยืนยันแล้ว</span></div>
            <div className="panel stat"><b>{stats.seatsConfirmed}/{SEATS_PER_ROUND * NAZA_ROUNDS.length}</b><span>ที่นั่งยืนยัน</span></div>
            <div className="panel stat"><b>{baht(stats.revenue)}</b><span>ยอดยืนยัน</span></div>
            <div className="panel stat"><b>{stats.checkedIn}</b><span>ที่นั่งเช็กอินแล้ว</span></div>
          </div>
        </section>

        <section className="sec">
          <h2>
            ตั้งค่างาน
            <small>{loaded ? `${baht(config.price)}/ที่ · พร้อมเพย์ ${config.promptpay || 'ยังไม่ตั้ง'} · ${config.closed ? 'ปิดรับจอง' : 'เปิดรับจอง'}` : '…'}</small>
            <button className="linkbtn" onClick={() => setShowCfg((v) => !v)}>{showCfg ? 'ซ่อน' : 'แก้ไข'}</button>
          </h2>
          {showCfg && loaded && <ConfigForm config={config} onSaved={() => { setShowCfg(false); flash('บันทึกการตั้งค่าแล้ว') }} />}
        </section>

        <section className="sec">
          <h2>ผังที่นั่งรายรอบ <small>แตะที่นั่งเพื่อค้นหาการจอง</small></h2>
          <div className="rounds-ov">
            {NAZA_ROUNDS.map((rid) => (
              <RoundMap key={rid} rid={rid} seats={seats} byId={byId}
                onPick={(b) => { setQ(b.code); setFilter('all'); setRoundF('all') }} />
            ))}
          </div>
        </section>

        <section className="sec">
          <h2>รายการจอง <small>{shown.length} รายการ</small></h2>
          <div className="filters">
            {FILTERS.map(([k, l]) => (
              <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {l}{k !== 'all' && stats[k] ? ` ${stats[k]}` : ''}
              </button>
            ))}
          </div>
          <div className="adm-tools">
            <button className="primary" onClick={() => setScanning(true)}>สแกน QR เช็กอิน</button>
            <input placeholder="ค้นหารหัส / ชื่อ / เบอร์ / อีเมล (วางข้อความจาก QR ได้)" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={roundF} onChange={(e) => setRoundF(e.target.value)}>
              <option value="all">ทุกรอบ</option>
              {NAZA_ROUNDS.map((r) => <option key={r} value={r}>{roundShort(r)}</option>)}
            </select>
            <button className="ghost" onClick={exportCsv} disabled={!list.length}>ดาวน์โหลด CSV</button>
          </div>

          {loading ? <div className="panel empty">กำลังโหลด…</div>
            : !shown.length ? <div className="panel empty">ไม่มีรายการในหมวดนี้</div>
              : (
                <div className="adm-grid">
                  {shown.map((b) => (
                    <div key={b.id} className="panel adm">
                      <div className="h">
                        <div className="who">
                          <b>{b.name}</b>
                          <span><a href={`tel:${b.phone}`}>{b.phone}</a> · {b.code}</span>
                          {b.email && <span><a href={`mailto:${b.email}`}>{b.email}</a></span>}
                        </div>
                        <StatusPill status={b.status} short />
                      </div>
                      <div className="kv"><span>{roundLabel(b.round)}</span><b style={{ fontFamily: 'var(--f-mono)' }}>{sortSeats(b.seats).join(' ')}</b></div>
                      <div className="kv"><span>ยอดโอน</span><b style={{ fontFamily: 'var(--f-mono)' }}>{baht(b.amount)}</b></div>
                      <div className="meta2">
                        จองเมื่อ {tsLabel(b.createdAt)}
                        {b.reviewedBy ? ` · ตรวจโดย ${b.reviewedBy}` : ''}
                        {b.checkedInAt ? ` · เช็กอิน ${tsLabel(b.checkedInAt)}` : ''}
                      </div>
                      {openSlip[b.id] && (
                        <div className="slip">
                          <a href={b.slipUrl} target="_blank" rel="noreferrer"><img src={b.slipUrl} alt={`สลิปของ ${b.name}`} loading="lazy" /></a>
                        </div>
                      )}
                      <div className="btns">
                        <button onClick={() => setOpenSlip((m) => ({ ...m, [b.id]: !m[b.id] }))}>{openSlip[b.id] ? 'ซ่อนสลิป' : 'ดูสลิป'}</button>
                        {b.status !== 'confirmed' && <button className="ok" disabled={busyId === b.id} onClick={() => act(b, 'confirm')}>อนุมัติ</button>}
                        {b.status !== 'rejected' && (
                          <button className={`no ${armed === b.id ? 'arm' : ''}`} disabled={busyId === b.id} onClick={() => act(b, 'reject')}>
                            {armed === b.id ? 'แตะอีกครั้งเพื่อปฏิเสธ' : 'ปฏิเสธ'}
                          </button>
                        )}
                        {b.email && (
                          <button disabled={mailing === b.id} onClick={() => resendEmail(b)}>{mailing === b.id ? 'กำลังส่ง…' : 'ส่งอีเมลอีกครั้ง'}</button>
                        )}
                        {b.status === 'confirmed' && (
                          b.checkedInAt
                            ? <button className="ci" disabled={busyId === b.id} onClick={() => act(b, 'uncheckin')}>เช็กอินแล้ว ✓</button>
                            : <button disabled={busyId === b.id} onClick={() => act(b, 'checkin')}>เช็กอิน</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </section>
      </div>
      {scanning && <NazaScanner bookings={list} onCheckIn={scanCheckIn} onClose={() => setScanning(false)} />}
      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  )
}

const sortForExport = (list) => [...list].sort((a, b) => (
  a.round === b.round ? sortSeats(a.seats)[0].localeCompare(sortSeats(b.seats)[0], 'en', { numeric: true }) : a.round.localeCompare(b.round)
))

function RoundMap({ rid, seats, byId, onPick }) {
  let pending = 0, confirmed = 0
  const cells = NAZA_ROWS.map(([r, n, type]) => (
    <div key={r} className="mrow">
      <b>{r}</b>
      {Array.from({ length: n }, (_, k) => {
        const s = r + (k + 1)
        const st = seats[seatDocId(rid, s)]
        const b = st ? byId[st.bookingId] : null
        if (st?.status === 'confirmed') confirmed++; else if (st) pending++
        const cls = !st ? '' : b?.checkedInAt ? 'in' : st.status === 'confirmed' ? 'confirmed' : 'pending'
        return (
          <button key={s} type="button" className={`ms ${type} ${cls}`}
            title={st ? `${s} · ${b ? `${b.code} ${b.name}` : 'ไม่พบการจอง'}` : `${s} ว่าง`}
            onClick={() => b && onPick(b)} />
        )
      })}
    </div>
  ))
  return (
    <div className="panel rov">
      <h3>{roundShort(rid)}<small>ยืนยัน {confirmed} · รอ {pending} · ว่าง {SEATS_PER_ROUND - confirmed - pending}</small></h3>
      <div className="mmap">{cells}</div>
    </div>
  )
}

function ConfigForm({ config, onSaved }) {
  const [f, setF] = useState({
    price: String(config.price ?? NAZA_DEFAULTS.price),
    maxSeats: String(config.maxSeats ?? NAZA_DEFAULTS.maxSeats),
    promptpay: config.promptpay || '',
    accountName: config.accountName || '',
    closed: !!config.closed,
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const save = async () => {
    const price = Math.round(Number(f.price))
    const maxSeats = Math.round(Number(f.maxSeats))
    if (!(price > 0)) { alert('ราคาต้องมากกว่า 0'); return }
    if (!(maxSeats >= 1 && maxSeats <= 4)) { alert('จำนวนที่นั่งต่อครั้งต้องอยู่ระหว่าง 1–4'); return }
    setSaving(true)
    try {
      await saveNazaConfig({ price, maxSeats, promptpay: f.promptpay.trim(), accountName: f.accountName.trim(), closed: f.closed })
      writeAuditLog({ action: 'update', entityType: 'nazaConfig', entityId: 'nazaEvent', summary: `ตั้งค่า NAZA: ${price} บาท/ที่, พร้อมเพย์ ${f.promptpay.trim() || '-'}, ${f.closed ? 'ปิด' : 'เปิด'}รับจอง` })
      onSaved()
    } catch (e) { alert('บันทึกไม่สำเร็จ: ' + (e?.message || e)) } finally { setSaving(false) }
  }
  return (
    <div className="panel cfg">
      <label>ราคาต่อที่นั่ง (บาท)<input type="number" min="1" value={f.price} onChange={set('price')} /></label>
      <label>จองได้สูงสุดต่อครั้ง (1–4)<input type="number" min="1" max="4" value={f.maxSeats} onChange={set('maxSeats')} /></label>
      <label>เลขพร้อมเพย์<input value={f.promptpay} onChange={set('promptpay')} placeholder="0xx-xxx-xxxx" /></label>
      <label>ชื่อบัญชี<input value={f.accountName} onChange={set('accountName')} /></label>
      <label className="chk"><input type="checkbox" checked={f.closed} onChange={set('closed')} /> ปิดรับจอง</label>
      <button className="primary" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
    </div>
  )
}
