import { useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { roundOf, sortSeats, STATUS_TEXT } from '../../data/nazaConfig.js'
import '../../styles/naza.css'

// ส่วนที่หน้าจอง (NazaBooking) กับหน้าแอดมิน (AdminNaza) ใช้ร่วมกัน

// ฟอนต์ของงานนี้ไม่ได้ใช้ที่อื่นในเว็บ — โหลดเฉพาะตอนเปิดหน้า NAZA ไม่ใส่ใน index.html ให้ทุกหน้าต้องโหลด
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600&family=Archivo+Black&family=IBM+Plex+Mono:wght@500;600&family=Kanit:wght@500;700;800&display=swap'
export function useNazaFonts(title) {
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_HREF
      document.head.appendChild(l)
    }
    const prev = document.title
    if (title) document.title = title
    return () => { document.title = prev }
  }, [title])
}

// ข้อความใน QR — ทีมหน้างานสแกนแล้วได้รหัสการจองไปค้นในหน้าแอดมิน
export const ticketQrValue = (b) => `NAZA|${b.code}|${b.round}|${(b.seats || []).join(',')}`

export function StatusPill({ status, short }) {
  const s = STATUS_TEXT[status] || STATUS_TEXT.pending
  const label = short && status === 'rejected' ? 'ไม่ผ่าน' : s[1]
  return <span className={`pill ${s[0]}`}>{label}</span>
}

export function Ticket({ b }) {
  const r = roundOf(b.round)
  return (
    <article className="ticket">
      <div className="tk-top" role="img" aria-label="NAZA for GAZA">
        <div className="tline">รับชม × Talk พิเศษ · Meeting Mall</div>
      </div>
      <div className="tk-grid">
        <div><span>วันที่</span><b>{r.day?.full}</b></div>
        <div><span>เวลา</span><b className="mono">{r.time?.label}</b></div>
        <div><span>ที่นั่ง</span><b className="mono">{sortSeats(b.seats).join(' ')}</b></div>
        <div><span>ผู้จอง</span><b>{b.name}</b></div>
      </div>
      <div className="perf" />
      <div className="tk-bot">
        <div className="qr"><QRCodeSVG value={ticketQrValue(b)} level="M" style={{ width: '100%', height: '100%' }} /></div>
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <span className="note">รหัสการจอง</span>
          <span className="code">{b.code}</span>
          <StatusPill status={b.status} />
        </div>
      </div>
      {b.checkedInAt && <div className="tk-meta">เช็กอินแล้ว</div>}
    </article>
  )
}
