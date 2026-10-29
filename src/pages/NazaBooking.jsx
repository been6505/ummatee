import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  NAZA_DAYS, NAZA_TIMES, NAZA_ROWS, SEATS_PER_ROUND, roundOf, roundLabel, baht, sortSeats, seatType,
  seatDocId, newBookingCode, cleanPhone, cleanEmail, validateBookingForm,
} from '../data/nazaConfig.js'
import { useNazaConfig, useNazaSeats, useMyNazaBookings, createNazaBooking, rememberBooking } from '../data/naza.js'
import { uploadToCloudinary } from '../utils/cloudinary.js'
import NazaRoom3D from '../components/naza/NazaRoom3D.jsx'
import { Ticket, StatusPill, useNazaFonts } from '../components/naza/shared.jsx'

// หน้าจองตั๋ว NAZA for GAZA (/events/Naza) — พอร์ตจากต้นแบบ NAZA_Booking.html
// ขั้นตอน: เลือกวัน/รอบ → เลือกที่นั่ง (3D หรือผัง 2D) → กรอกชื่อ/เบอร์ + แนบสลิป → ได้ตั๋ว (รอแอดมินตรวจสลิป)
// ฝั่งตรวจสลิป/อนุมัติอยู่ที่ /admin/events/naza (AdminNaza.jsx)
// ลิงก์ในอีเมล /events/Naza?t=<bookingId> เปิดตั๋วใบนั้นได้จากทุกเครื่อง (และจำไว้ใน "ตั๋วของฉัน")

// อ่าน ?t= ครั้งเดียวตอนเปิดหน้า แล้วลบออกจาก URL — กันลิงก์ตั๋วติดไปกับการแชร์หน้าโดยไม่ตั้งใจ
// จำผลไว้ — StrictMode เรียก initializer ของ useState สองรอบ รอบสองจะเจอ URL ที่ลบ ?t= ไปแล้ว
let linkedTicketCache
function ticketIdFromUrl() {
  if (linkedTicketCache !== undefined) return linkedTicketCache
  linkedTicketCache = readTicketParam()
  return linkedTicketCache
}
function readTicketParam() {
  try {
    const u = new URL(window.location.href)
    const t = u.searchParams.get('t')
    if (!t || !/^[A-Za-z0-9]{10,40}$/.test(t)) return null
    u.searchParams.delete('t')
    window.history.replaceState({}, '', u.pathname + u.search)
    return t
  } catch { return null }
}

const UploadIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
)

// ย่อรูปสลิปก่อนอัปโหลด — ภาพหน้าจอจากแอปธนาคารมักใหญ่หลาย MB แต่ตรวจด้วยตาแค่ ~1000px ก็พอ
function loadImage(file) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file); const im = new Image()
    im.onload = () => res({ im, url: u }); im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode')) }; im.src = u
  })
}
async function compressSlip(file) {
  const { im, url: srcUrl } = await loadImage(file)
  let max = 1400, q = 0.82, blob = null
  try {
    for (let k = 0; k < 8; k++) {
      const sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight))
      const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * sc); cv.height = Math.round(im.naturalHeight * sc)
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height)
      blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', q))
      if (blob && blob.size < 400000) break
      if (q > 0.5) q -= 0.1; else max = Math.round(max * 0.82)
    }
  } finally { URL.revokeObjectURL(srcUrl) }
  if (!blob) throw new Error('encode')
  return { file: new File([blob], 'slip.jpg', { type: 'image/jpeg' }), preview: URL.createObjectURL(blob) }
}

export default function NazaBooking() {
  useNazaFonts('จองตั๋ว NAZA for GAZA · Ummatee')
  const { config, loaded: configLoaded } = useNazaConfig()
  const { seats, ready: seatsReady, error: seatsError } = useNazaSeats()
  const mine = useMyNazaBookings()

  const [linkedTicket] = useState(ticketIdFromUrl)
  const [view, setView] = useState(linkedTicket ? 'ticket' : 'round')
  const [day, setDay] = useState(NAZA_DAYS[0].id)
  const [round, setRound] = useState(null)
  const [selected, setSelected] = useState([])
  const [seatMode, setSeatMode] = useState('3d')
  const [room3dFailed, setRoom3dFailed] = useState(false)
  const [current, setCurrent] = useState(linkedTicket)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [slip, setSlip] = useState(null) // { file, preview, name, uploadedUrl }
  const [errors, setErrors] = useState({})
  const [formErr, setFormErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const toastT = useRef(null)
  const slipInput = useRef(null)

  useEffect(() => { if (linkedTicket) rememberBooking(linkedTicket) }, [linkedTicket])

  const toast = useCallback((m) => {
    setToastMsg(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToastMsg(''), 2800)
  }, [])
  useEffect(() => () => clearTimeout(toastT.current), [])

  const price = Number(config.price) || 0
  const maxSeats = Math.min(4, Math.max(1, Number(config.maxSeats) || 4))
  const store = seatsReady && !seatsError

  const takenIn = useCallback((rid) => Object.values(seats).filter((x) => x && x.round === rid).length, [seats])
  const takenSeats = useMemo(
    () => (round ? Object.values(seats).filter((x) => x && x.round === round).map((x) => x.seat) : []),
    [seats, round]
  )

  // ที่นั่งที่เลือกไว้ถูกคนอื่นจองตัดหน้า — ตัดออกจากที่เลือกแล้วแจ้ง
  useEffect(() => {
    if (!round) return
    const lost = selected.filter((s) => seats[seatDocId(round, s)])
    if (lost.length && !busy) {
      setSelected((sel) => sel.filter((s) => !lost.includes(s)))
      toast('มีคนจองที่นั่งที่คุณเลือกไปแล้ว กรุณาเลือกใหม่')
    }
  }, [seats, round, selected, busy, toast])

  const show = (v) => { setView(v); window.scrollTo({ top: 0 }) }

  const toggleSeat = useCallback((s) => {
    if (seats[seatDocId(round, s)]) { toast(`ที่นั่ง ${s} มีผู้จองแล้ว`); return }
    setSelected((sel) => {
      if (sel.includes(s)) return sel.filter((x) => x !== s)
      if (sel.length >= maxSeats) { toast(`จองได้สูงสุด ${maxSeats} ที่ต่อครั้ง`); return sel }
      return [...sel, s]
    })
  }, [seats, round, maxSeats, toast])

  const resetForm = () => {
    setSelected([]); setErrors({}); setFormErr('')
    setSlip((s) => { if (s?.preview) URL.revokeObjectURL(s.preview); return null })
    if (slipInput.current) slipInput.current.value = ''
  }

  const onSlip = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setErrors((x) => ({ ...x, slip: '' }))
    if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) { setErrors((x) => ({ ...x, slip: 'รองรับเฉพาะไฟล์รูปภาพ' })); return }
    try {
      const c = await compressSlip(f)
      setSlip((s) => { if (s?.preview) URL.revokeObjectURL(s.preview); return { ...c, name: f.name } })
    } catch {
      // เบราว์เซอร์ถอดรหัสรูปนี้ไม่ได้ (เช่น HEIC บน Chrome) — ส่งไฟล์เดิมขึ้นไปให้ Cloudinary แปลงเอง
      setSlip((s) => { if (s?.preview) URL.revokeObjectURL(s.preview); return { file: f, preview: null, name: f.name } })
    }
  }

  const copyPromptpay = async () => {
    const txt = String(config.promptpay || '').replace(/\D/g, '')
    try { await navigator.clipboard.writeText(txt); toast('คัดลอกเลขพร้อมเพย์แล้ว') } catch { toast('คัดลอกไม่ได้ กดค้างที่ตัวเลขเพื่อคัดลอก') }
  }

  const submit = async () => {
    const e = validateBookingForm({ name, phone, email, hasSlip: !!slip })
    setErrors(e); setFormErr('')
    if (Object.keys(e).length) {
      setTimeout(() => document.querySelector('.naza .err:not(:empty)')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
      return
    }
    if (config.closed) { setFormErr('ปิดรับจองแล้ว'); return }
    if (!config.promptpay) { setFormErr('ยังไม่เปิดรับชำระเงิน กรุณารอทีมงานประกาศ'); return }
    setBusy(true)
    const seatList = sortSeats(selected)
    try {
      let slipUrl = slip.uploadedUrl
      if (!slipUrl) {
        slipUrl = (await uploadToCloudinary(slip.file)).url
        setSlip((s) => (s ? { ...s, uploadedUrl: slipUrl } : s)) // ลองส่งซ้ำได้โดยไม่ต้องอัปโหลดใหม่
      }
      const id = await createNazaBooking({
        code: newBookingCode(), round, seats: seatList, name: name.trim(), phone: cleanPhone(phone), email: cleanEmail(email),
        slipUrl, amount: seatList.length * price,
      })
      setCurrent(id)
      resetForm()
      show('ticket')
    } catch (err) {
      if (err?.code === 'seat-taken') {
        toast(`ที่นั่ง ${err.seat} เพิ่งถูกจองไป กรุณาเลือกใหม่`)
        setSelected((sel) => sel.filter((s) => s !== err.seat))
        show('seats')
      } else if (err?.code === 'permission-denied') {
        setFormErr('ระบบไม่รับการจองนี้ — ราคาหรือสถานะการเปิดรับจองอาจเพิ่งเปลี่ยน ลองรีเฟรชหน้าแล้วจองใหม่')
      } else {
        setFormErr('ส่งการจองไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง')
      }
    } finally {
      setBusy(false)
    }
  }

  const tab = ['round', 'seats', 'info', 'ticket'].includes(view) ? 'book' : view
  const dayObj = NAZA_DAYS.find((d) => d.id === day)
  const n = selected.length

  return (
    <div className="naza">
      <div className="app">
        <header className="top">
          <a className="brand" href="/home">NAZA<b>FOR GAZA</b></a>
          <nav className="tabs" aria-label="เมนู">
            <button aria-current={tab === 'book'} onClick={() => { resetForm(); show('round') }}>จองตั๋ว</button>
            <button aria-current={tab === 'mine'} onClick={() => show('mine')}>
              ตั๋วของฉัน<span className="n">{mine.list.length || ''}</span>
            </button>
          </nav>
        </header>
        <div className={`modebar ${store ? 'live' : ''}`}>
          <i />
          <span>{!seatsReady ? 'กำลังเชื่อมต่อระบบที่นั่ง…' : seatsError ? 'เชื่อมต่อระบบที่นั่งไม่สำเร็จ ลองรีเฟรชหน้า' : 'ที่นั่งอัปเดตสด'}</span>
        </div>

        {view === 'round' && (
          <main>
            <section className="nz-hero">
              <figure className="poster"><img src="/naza/hero.jpg" alt="Ummatee the Series: NAZA for GAZA" width="900" height="474" /></figure>
              <div className="tag">เมื่อชีวิตคนเป็นแค่ตัวเลข</div>
              <div className="facts">
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>6–8 พ.ย. 2569</span>
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>Meeting Mall</span>
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /></svg>ฉายภาพยนตร์ + Talk</span>
              </div>
            </section>

            {configLoaded && config.closed && <div className="closed" style={{ marginTop: 18 }}>ปิดรับจองแล้ว ขอบคุณที่ให้ความสนใจ</div>}

            <section className="sec">
              <h2>เลือกวัน</h2>
              <div className="days">
                {NAZA_DAYS.map((d) => {
                  const left = NAZA_TIMES.reduce((a, t) => a + SEATS_PER_ROUND - takenIn(`${d.id}-${t.id}`), 0)
                  return (
                    <button key={d.id} className="day" aria-pressed={day === d.id} onClick={() => setDay(d.id)}>
                      <span className="w">{d.w}</span><span className="d">{d.d}</span>
                      <span className="w">{d.m} · ว่าง {store ? left : '–'}</span>
                    </button>
                  )
                })}
              </div>
            </section>
            <section className="sec">
              <h2>เลือกรอบ <small>{dayObj.full}</small></h2>
              <div className="rounds">
                {NAZA_TIMES.map((t) => {
                  const rid = `${dayObj.id}-${t.id}`; const tk = takenIn(rid); const left = SEATS_PER_ROUND - tk
                  const full = store && left <= 0
                  return (
                    <button key={rid} className="round" disabled={full || !store || config.closed}
                      onClick={() => { setRound(rid); setSelected([]); show('seats') }}>
                      <span className="tm"><span className="t">{t.label}</span><span className="end">ถึง {t.end} น.</span></span>
                      <span className="info"><span>ภาพยนตร์ + Talk</span><span className="bar"><i style={{ width: `${store ? Math.round(tk / SEATS_PER_ROUND * 100) : 0}%` }} /></span></span>
                      <span className={`left ${left <= 8 ? 'low' : ''}`}>{!store ? '…' : full ? 'เต็ม' : `ว่าง ${left}/${SEATS_PER_ROUND}`}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="sec">
              <h2>เกี่ยวกับงาน</h2>
              <div className="panel about">
                <img src="/naza/poster.jpg" alt="โปสเตอร์ NAZA for GAZA" width="118" height="150" />
                <div>
                  <h3>ผู้ร่วม Talk</h3>
                  <ul>
                    <li>ผศ.ดร.นพ.มูฮัมมัดฟาห์มี ตาเละ</li>
                    <li>วรรณสิงห์ ประเสริฐกุล</li>
                    <li>รศ.ดร.ศราวุฒิ อารีย์</li>
                    <li>ดร.ไฟโรส อยู่เป็นสุข</li>
                  </ul>
                  <p>ห้องฉายขนาดเล็ก {SEATS_PER_ROUND} ที่ต่อรอบ บีนแบ็ก 10 ที่แถวหน้า และเก้าอี้ 20 ที่ ฉายภาพยนตร์ต่อด้วยวงคุย</p>
                </div>
              </div>
            </section>
            <p className="foot">จัดโดย มูลนิธิอุมมะตี × Meeting Mall · ให้ 100 ถึง 100</p>
          </main>
        )}

        {view === 'seats' && round && (
          <main>
            <div className="stephead">
              <button className="back" onClick={() => show('round')}>← เปลี่ยนรอบ</button>
              <div className="steps"><i className="on" /><i className="on" /><i /></div>
              <h1>เลือกที่นั่ง</h1>
              <p>{roundLabel(round)}</p>
            </div>
            <section className="sec">
              {!room3dFailed && (
                <div className="viewtoggle">
                  <button aria-pressed={seatMode === '3d'} onClick={() => setSeatMode('3d')}>ห้องจำลอง 3D</button>
                  <button aria-pressed={seatMode === '2d'} onClick={() => setSeatMode('2d')}>ผังที่นั่ง</button>
                </div>
              )}
              {!room3dFailed && (
                <div hidden={seatMode !== '3d'}>
                  <NazaRoom3D rows={NAZA_ROWS} round={round} taken={takenSeats} selected={selected}
                    active={view === 'seats' && seatMode === '3d'} onToggle={toggleSeat}
                    onFail={() => { setRoom3dFailed(true); setSeatMode('2d') }} />
                </div>
              )}
              {(seatMode === '2d' || room3dFailed) && <SeatMap2D round={round} seats={seats} selected={selected} onToggle={toggleSeat} />}
              <div className="legend"><span><i />บีนแบ็ก</span><span><i className="chairi" />เก้าอี้</span><span><i className="sel" />ที่คุณเลือก</span><span><i className="tk" />มีผู้จองแล้ว</span></div>
              <p className="hint">บีนแบ็ก 10 ที่แถวหน้า และเก้าอี้ 20 ที่ · จองได้สูงสุด {maxSeats} ที่ต่อครั้ง</p>
            </section>
          </main>
        )}

        {view === 'info' && round && (
          <main>
            <div className="stephead">
              <button className="back" onClick={() => show('seats')}>← แก้ที่นั่ง</button>
              <div className="steps"><i className="on" /><i className="on" /><i className="on" /></div>
              <h1>ข้อมูลและชำระเงิน</h1>
              <p>โอนเงินแล้วแนบสลิป ทีมงานจะตรวจและยืนยันตั๋วให้</p>
            </div>
            <section className="sec"><TicketPreview round={round} seats={selected} price={price} /></section>
            <form className="sec" noValidate onSubmit={(e) => { e.preventDefault(); submit() }}>
              <h2>ผู้จอง</h2>
              <div className="field">
                <label htmlFor="nz-name">ชื่อ-นามสกุล</label>
                <input id="nz-name" autoComplete="name" placeholder="ชื่อที่ใช้เช็กอินหน้างาน" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
                <div className="err">{errors.name}</div>
              </div>
              <div className="field">
                <label htmlFor="nz-phone">เบอร์โทร</label>
                <input id="nz-phone" inputMode="tel" autoComplete="tel" placeholder="08x-xxx-xxxx" value={phone} maxLength={14} onChange={(e) => setPhone(e.target.value)} />
                <div className="err">{errors.phone}</div>
              </div>
              <div className="field">
                <label htmlFor="nz-email">อีเมล</label>
                <input id="nz-email" type="email" inputMode="email" autoComplete="email" placeholder="ใช้รับตั๋ว QR และการแจ้งเตือนก่อนวันงาน" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
                <div className="err">{errors.email}</div>
              </div>

              <h2 style={{ marginTop: 8 }}>โอนเงิน</h2>
              <div className="panel pay">
                <div className="row"><span className="label">พร้อมเพย์</span></div>
                {config.promptpay ? (
                  <div className="row"><span className="num">{config.promptpay}</span><button type="button" className="ghost" onClick={copyPromptpay}>คัดลอก</button></div>
                ) : (
                  <div className="row"><span className="who">ทีมงานยังไม่ได้ประกาศเลขพร้อมเพย์</span></div>
                )}
                <div className="who">ชื่อบัญชี: {config.accountName}</div>
                <div className="kv total"><span>ยอดที่ต้องโอน</span><b>{baht(n * price)}</b></div>
              </div>

              <h2 style={{ marginTop: 8 }}>แนบสลิป</h2>
              <label className={`drop ${slip ? 'has' : ''}`} htmlFor="nz-slip">
                {slip ? (
                  <>
                    {slip.preview ? <img src={slip.preview} alt="ตัวอย่างสลิป" /> : <UploadIcon />}
                    <div><b>แนบสลิปแล้ว</b><br /><span>{slip.name} · แตะเพื่อเปลี่ยนรูป</span></div>
                  </>
                ) : (
                  <>
                    <UploadIcon />
                    <b>เลือกรูปสลิป</b>
                    <span>ภาพหน้าจอจากแอปธนาคาร (JPG, PNG)</span>
                  </>
                )}
              </label>
              <input ref={slipInput} className="sr" type="file" id="nz-slip" accept="image/*" onChange={onSlip} />
              <div className="err formerr">{errors.slip}</div>
              <p className="formerr">{formErr}</p>
            </form>
          </main>
        )}

        {view === 'ticket' && <TicketView booking={current ? mine.byId[current] : null} missing={current ? mine.byId[current] === null : false} />}

        {view === 'mine' && (
          <main>
            <div className="stephead"><h1>ตั๋วของฉัน</h1><p>สถานะอัปเดตเมื่อทีมงานตรวจสลิป · ตั๋วจำไว้ในเครื่องนี้เท่านั้น</p></div>
            <section className="sec list">
              {!mine.list.length ? (
                <div className="panel empty">
                  {mine.loading ? 'กำลังโหลด…' : 'ยังไม่มีการจอง'}
                  {!mine.loading && <button className="primary" onClick={() => show('round')}>เลือกรอบฉาย</button>}
                </div>
              ) : [...mine.list].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)).map((b) => (
                <button key={b.id} className="mini" onClick={() => { setCurrent(b.id); show('ticket') }}>
                  <span className="c">{b.code}</span><StatusPill status={b.status} short />
                  <span className="s">{roundLabel(b.round)} · ที่นั่ง {sortSeats(b.seats).join(', ')}</span>
                </button>
              ))}
            </section>
          </main>
        )}
      </div>

      {view === 'seats' && (
        <div className="action"><div className="in">
          <div className="sum"><b>{baht(n * price)}</b><span>{n ? `${n} ที่นั่ง · ${sortSeats(selected).join(', ')}` : 'ยังไม่ได้เลือกที่นั่ง'}</span></div>
          <button className="primary" disabled={!n} onClick={() => show('info')}>ถัดไป</button>
        </div></div>
      )}
      {view === 'info' && (
        <div className="action"><div className="in">
          <button className="primary wide" disabled={busy || !n} onClick={submit}>{busy ? 'กำลังส่ง…' : 'ยืนยันการจองและส่งสลิป'}</button>
        </div></div>
      )}
      {view === 'ticket' && (
        <div className="action"><div className="in">
          <button className="primary wide" onClick={() => { resetForm(); show('round') }}>จองรอบอื่นเพิ่ม</button>
        </div></div>
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  )
}

function SeatMap2D({ round, seats, selected, onToggle }) {
  return (
    <div className="panel room">
      <div className="screen"><span>จอ</span></div>
      <div className="proj" title="โปรเจกเตอร์" />
      <div className="grid">
        {NAZA_ROWS.map(([r, n, type], ri) => (
          <div key={r}>
            {ri > 0 && type !== NAZA_ROWS[ri - 1][2] && <div className="zone">เก้าอี้</div>}
            <div className={`srow ${type}`}>
              <span className="rowlab">{r}</span>
              <div className="seats">
                {Array.from({ length: n }, (_, k) => {
                  const s = r + (k + 1)
                  const taken = !!seats[seatDocId(round, s)]
                  const sel = selected.includes(s)
                  return [
                    type === 'chair' && k === n / 2 ? <span key={s + 'a'} className="aisle" /> : null,
                    <button key={s} type="button" className={`seat ${type}`} data-taken={taken || undefined} aria-disabled={taken || undefined}
                      aria-pressed={sel} aria-label={`${type === 'bean' ? 'บีนแบ็ก' : 'เก้าอี้'} ${s} ${taken ? 'มีผู้จองแล้ว' : sel ? 'เลือกแล้ว' : 'ว่าง'}`}
                      onClick={() => onToggle(s)}><i>{s}</i></button>,
                  ]
                })}
              </div>
              <span className="rowlab">{r}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TicketPreview({ round, seats, price }) {
  const r = roundOf(round), list = sortSeats(seats), n = list.length
  const types = [...new Set(list.map(seatType))].join(' / ')
  return (
    <article className="ticket preview" aria-label="ตั๋วที่กำลังจอง">
      <div className="tk-top small" role="img" aria-label="NAZA for GAZA"><div className="tline">รับชม × Talk พิเศษ · Meeting Mall</div></div>
      <div className="tk-grid">
        <div><span>วันที่</span><b>{r.day?.full}</b></div>
        <div><span>เวลา</span><b className="mono">{r.time?.label}–{r.time?.end}</b></div>
        <div><span>ที่นั่ง</span><b className="mono">{list.join(' ')}</b></div>
        <div><span>ประเภท</span><b>{types}</b></div>
      </div>
      <div className="perf" />
      <div className="tk-price">
        <div><span>ADMIT</span><b>{n}</b></div>
        <div className="pr"><span>{n} × {baht(price)}</span><b className="amt">{baht(n * price)}</b></div>
      </div>
      <div className="tk-foot"><div className="barcode" aria-hidden="true" /><span className="pill pending">รอชำระเงิน</span></div>
    </article>
  )
}

function TicketView({ booking: b, missing }) {
  const t = {
    pending: ['ส่งสลิปแล้ว', 'ทีมงานจะตรวจสลิปและยืนยันตั๋ว เมื่อยืนยันแล้ว QR สำหรับเข้างานจะขึ้นในหน้านี้และส่งไปที่อีเมลของคุณ · เปิดดูได้ที่ “ตั๋วของฉัน”'],
    confirmed: ['ตั๋วพร้อมใช้', 'แสดง QR นี้ให้เจ้าหน้าที่สแกนที่จุดลงทะเบียนหน้าห้องฉาย'],
    rejected: ['สลิปไม่ผ่านการตรวจ', 'ที่นั่งถูกคืนแล้ว ติดต่อทีมงานพร้อมรหัสการจองนี้'],
  }[b?.status] || ['ส่งสลิปแล้ว', 'เก็บหน้านี้ไว้ หรือเปิดดูได้ที่ “ตั๋วของฉัน”']
  return (
    <main>
      <div className="stephead"><h1>{t[0]}</h1><p>{t[1]}</p></div>
      <section className="sec">
        {b ? <Ticket b={b} /> : <div className="panel empty">{missing ? 'ไม่พบตั๋วนี้ ตรวจลิงก์อีกครั้งหรือติดต่อทีมงาน' : 'กำลังโหลดตั๋ว…'}</div>}
      </section>
    </main>
  )
}
