import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { roundLabel, sortSeats, parseNazaQr } from '../../data/nazaConfig.js'

// สแกน QR ตั๋ว NAZA หน้าห้องฉาย — เปิดกล้องหลัง อ่าน QR ด้วย jsQR (แบบเดียวกับ AdminQRcode.jsx)
// QR บนตั๋ว = "NAZA|<รหัสการจอง>|<รอบ>|<ที่นั่ง>" (ticketQrValue ใน shared.jsx)
// ตั๋วที่ยืนยันแล้วและยังไม่เช็กอิน → เช็กอินให้ทันที, กรณีอื่นแสดงเหตุผลให้เจ้าหน้าที่ตัดสินใจ

export default function NazaScanner({ bookings, onCheckIn, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(0)
  const lastRef = useRef({ text: '', at: 0 })
  const bookingsRef = useRef(bookings)
  const [camError, setCamError] = useState('')
  const [result, setResult] = useState(null) // { kind, b?, text }

  useEffect(() => { bookingsRef.current = bookings }, [bookings])

  useEffect(() => {
    let stopped = false
    const handle = async (text) => {
      const code = parseNazaQr(text)
      if (!code) { setResult({ kind: 'invalid', text }); return }
      const b = bookingsRef.current.find((x) => x.code === code)
      if (!b) { setResult({ kind: 'notfound', text: code }); return }
      if (b.status !== 'confirmed') { setResult({ kind: b.status, b }); return }
      if (b.checkedInAt) { setResult({ kind: 'already', b }); return }
      try {
        await onCheckIn(b)
        setResult({ kind: 'ok', b })
        if (navigator.vibrate) navigator.vibrate(120)
      } catch (e) {
        setResult({ kind: 'error', b, text: e?.message || String(e) })
      }
    }
    const tick = () => {
      if (stopped) return
      const v = videoRef.current, c = canvasRef.current
      if (v && c && v.readyState === v.HAVE_ENOUGH_DATA) {
        c.width = v.videoWidth; c.height = v.videoHeight
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(v, 0, 0, c.width, c.height)
        const img = ctx.getImageData(0, 0, c.width, c.height)
        const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
        const now = Date.now()
        // กันอ่าน QR ใบเดิมซ้ำรัว ๆ ระหว่างที่ยังถือไว้หน้ากล้อง
        if (qr?.data && (qr.data !== lastRef.current.text || now - lastRef.current.at > 4000)) {
          lastRef.current = { text: qr.data, at: now }
          handle(qr.data)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(async (stream) => {
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const v = videoRef.current
        v.srcObject = stream; v.setAttribute('playsinline', 'true')
        await v.play()
        rafRef.current = requestAnimationFrame(tick)
      })
      .catch((e) => setCamError('เปิดกล้องไม่ได้: ' + (e?.message || e?.name || 'ไม่รองรับ') + ' — ตรวจสิทธิ์กล้องของเบราว์เซอร์'))
    return () => {
      stopped = true
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [onCheckIn])

  const R = result
  const msg = !R ? null
    : R.kind === 'ok' ? ['ok', 'เช็กอินสำเร็จ']
      : R.kind === 'already' ? ['warn', 'ตั๋วนี้เช็กอินไปแล้ว']
        : R.kind === 'pending' ? ['warn', 'ตั๋วยังรอตรวจสลิป — ยังเข้างานไม่ได้']
          : R.kind === 'rejected' ? ['bad', 'ตั๋วนี้สลิปไม่ผ่าน — เข้างานไม่ได้']
            : R.kind === 'notfound' ? ['bad', `ไม่พบการจอง ${R.text}`]
              : R.kind === 'error' ? ['bad', 'บันทึกเช็กอินไม่สำเร็จ: ' + R.text]
                : ['bad', 'QR นี้ไม่ใช่ตั๋ว NAZA']

  return (
    <div className="scan-ov" role="dialog" aria-label="สแกน QR ตั๋ว">
      <div className="scan-box panel">
        <div className="scan-head">
          <b>สแกน QR ตั๋ว</b>
          <button className="ghost" onClick={onClose}>ปิด</button>
        </div>
        <div className="scan-cam">
          <video ref={videoRef} muted playsInline />
          <canvas ref={canvasRef} hidden />
          {camError && <p className="formerr">{camError}</p>}
        </div>
        {msg && (
          <div className={`scan-res ${msg[0]}`}>
            <b>{msg[1]}</b>
            {R.b && (
              <span>
                {R.b.code} · {R.b.name}<br />
                {roundLabel(R.b.round)} · ที่นั่ง {sortSeats(R.b.seats).join(' ')}
              </span>
            )}
          </div>
        )}
        <p className="hint">ตรวจรอบในตั๋วให้ตรงกับรอบที่กำลังจะฉายด้วยทุกครั้ง</p>
      </div>
    </div>
  )
}
