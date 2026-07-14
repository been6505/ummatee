// หน้าเช็คอินหน้างาน Iftar For Gaza (/admin/register-event) — เปิดกล้องมือถือสแกน QR รหัส IFG
// ของผู้มาร่วมงาน แล้ว mark checkedIn ใน Firestore (เฉพาะแอดมิน)
import { useEffect, useRef, useState } from 'react'
import { db } from '../firebase.js'
import { collection, query, where, getDocs, doc, runTransaction } from 'firebase/firestore'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import jsQR from 'jsqr'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faTriangleExclamation, faCamera, faMosque, faGift } from '@fortawesome/free-solid-svg-icons'

// เสียงบี๊บสั้นสังเคราะห์ด้วย Web Audio API (ไม่ต้องโหลดไฟล์เสียง)
function beep(type = 'ok') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    if (type === 'ok') {
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.25)
    } else {
      osc.frequency.setValueAtTime(330, ctx.currentTime)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    }
    osc.onended = () => ctx.close()
  } catch (_) {}
}

export default function AdminQRcode() {
  const { user, loading } = useAdminAuth()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(0)
  const lastRef = useRef('')
  const busyRef = useRef(false)

  const [mode, setMode] = useState('iftar') // 'iftar' | 'give'
  const modeRef = useRef('iftar') // ให้ loop สแกน (tick) อ่านค่า mode ล่าสุดเสมอ ไม่ค้างค่าเก่าใน closure
  const [scanning, setScanning] = useState(false)
  const [camError, setCamError] = useState('')
  const [result, setResult] = useState(null) // { status, ref, reg }
  const [count, setCount] = useState(0)
  const [manual, setManual] = useState('')
  const [recentList, setRecentList] = useState([]) // รายการเช็คอินล่าสุด (สูงสุด 20 คน)
  const [showWelcome, setShowWelcome] = useState(false) // popup ยินดีต้อนรับ
  const welcomeTimer = useRef(null)

  const addToRecent = (reg, ref) => {
    const entry = {
      ref,
      name: `${reg.fname || ''} ${reg.lname || ''}`.trim(),
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    }
    setRecentList((prev) => [entry, ...prev].slice(0, 20))
  }

  // ค้นหา ref ใน Firestore แล้ว mark checkedIn
  const checkIn = async (ref) => {
    if (!ref || busyRef.current) return
    busyRef.current = true
    setResult({ status: 'loading', ref })
    setShowWelcome(false)
    clearTimeout(welcomeTimer.current)
    try {
      const snap = await getDocs(query(collection(db, 'iftarRegs'), where('ref', '==', ref)))
      if (snap.empty) {
        setResult({ status: 'notfound', ref })
        beep('err')
      } else {
        const docRef = doc(db, 'iftarRegs', snap.docs[0].id)
        // อ่าน+เช็ค checkedIn+เขียนใน transaction เดียวกัน กันสองเครื่องสแกน QR เดียวกันพร้อมกัน
        // ที่หน้างาน (หลายจุดเช็คอิน) จนทั้งคู่เห็น checkedIn:false ก่อนใครเขียนเสร็จแล้วเช็คอินซ้ำ
        let reg, already
        await runTransaction(db, async (tx) => {
          const fresh = await tx.get(docRef)
          reg = { id: fresh.id, ...fresh.data() }
          already = !!reg.checkedIn
          if (!already) {
            tx.update(docRef, { checkedIn: true, checkedInAt: new Date().toLocaleString('th-TH') })
          }
        })
        if (already) {
          setResult({ status: 'already', ref, reg })
          beep('err')
        } else {
          setResult({ status: 'ok', ref, reg })
          setCount((c) => c + 1)
          addToRecent(reg, ref)
          beep('ok')
          if (navigator.vibrate) navigator.vibrate(120)
          // แสดง popup ยินดีต้อนรับ 3 วินาที
          setShowWelcome(reg)
          welcomeTimer.current = setTimeout(() => setShowWelcome(false), 3500)
        }
      }
    } catch (e) {
      setResult({ status: 'error', ref, msg: e.message })
      beep('err')
    } finally {
      busyRef.current = false
      setTimeout(() => { lastRef.current = '' }, 3000)
    }
  }

  // ค้นหา refCode ใน give2Regs/give2CookRegs หรือ RCV-{id} ใน giveReceiveRegs แล้ว mark delivered/received
  const checkInGive = async (val) => {
    if (!val || busyRef.current) return
    busyRef.current = true
    setResult({ status: 'loading', ref: val })
    try {
      // Receiver QR: "RCV-{firestoreId}"
      if (val.startsWith('RCV-')) {
        const id = val.slice(4)
        const docRef = doc(db, 'giveReceiveRegs', id)
        let reg, already, notfound
        await runTransaction(db, async (tx) => {
          const fresh = await tx.get(docRef)
          if (!fresh.exists()) { notfound = true; return }
          reg = { id: fresh.id, ...fresh.data() }
          already = !!reg.received
          if (!already) tx.update(docRef, { received: true, receivedAt: new Date().toLocaleString('th-TH') })
        })
        if (notfound) {
          setResult({ status: 'notfound', ref: val }); beep('err')
        } else if (already) {
          setResult({ status: 'already', ref: val, reg }); beep('err')
        } else {
          setResult({ status: 'ok', ref: val, reg })
          setCount((c) => c + 1)
          addToRecent(reg, val)
          beep('ok')
          if (navigator.vibrate) navigator.vibrate(120)
        }
      } else {
        // Donor QR: refCode in give2Regs or give2CookRegs
        const [snap1, snap2] = await Promise.all([
          getDocs(query(collection(db, 'give2Regs'), where('refCode', '==', val))),
          getDocs(query(collection(db, 'give2CookRegs'), where('refCode', '==', val))),
        ])
        const hit = !snap1.empty ? snap1.docs[0] : !snap2.empty ? snap2.docs[0] : null
        const colName = !snap1.empty ? 'give2Regs' : 'give2CookRegs'
        if (!hit) {
          setResult({ status: 'notfound', ref: val }); beep('err')
        } else {
          const docRef = doc(db, colName, hit.id)
          // อ่าน+เช็ค delivered+เขียนใน transaction เดียวกัน กันสองเครื่องสแกน QR เดียวกันพร้อมกัน
          let reg, already
          await runTransaction(db, async (tx) => {
            const fresh = await tx.get(docRef)
            reg = { id: fresh.id, ...fresh.data() }
            already = !!reg.delivered
            if (!already) tx.update(docRef, { delivered: true, deliveredAt: new Date().toLocaleString('th-TH') })
          })
          if (already) {
            setResult({ status: 'already', ref: val, reg }); beep('err')
          } else {
            setResult({ status: 'ok', ref: val, reg })
            setCount((c) => c + 1)
            addToRecent(reg, val)
            beep('ok')
            if (navigator.vibrate) navigator.vibrate(120)
          }
        }
      }
    } catch (e) {
      setResult({ status: 'error', ref: val, msg: e.message }); beep('err')
    } finally {
      busyRef.current = false
      setTimeout(() => { lastRef.current = '' }, 3000)
    }
  }

  const tick = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
      if (code && code.data) {
        const val = code.data.trim()
        if (val && val !== lastRef.current) {
          lastRef.current = val
          if (modeRef.current === 'give') checkInGive(val)
          else checkIn(val)
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const startCamera = async () => {
    setCamError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      videoRef.current.setAttribute('playsinline', 'true')
      await videoRef.current.play()
      setScanning(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch (e) {
      setCamError('เปิดกล้องไม่ได้: ' + (e.message || e.name) + ' — ตรวจสิทธิ์กล้องของเบราว์เซอร์')
    }
  }

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  const exportCSV = () => {
    if (!recentList.length) return
    const rows = [['ชื่อ-นามสกุล', 'รหัส', 'เวลา'], ...recentList.map((r) => [r.name, r.ref, r.time])]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checkin-${new Date().toLocaleDateString('th-TH').replace(/\//g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => () => { stopCamera(); clearTimeout(welcomeTimer.current) }, [])

  if (loading) return null
  if (!user) return <AdminLogin />

  const R = result
  const isGive = mode === 'give'
  const alreadyLabel = isGive
    ? (R?.ref?.startsWith('RCV-') ? 'รับมอบไปแล้ว' : 'ส่งมอบไปแล้ว')
    : 'เช็คอินไปแล้ว'
  const alreadyAt = isGive
    ? (R?.reg?.receivedAt || R?.reg?.deliveredAt || '-')
    : (R?.reg?.checkedInAt || '-')
  const okLabel = isGive
    ? (R?.ref?.startsWith('RCV-') ? 'บันทึกรับมอบสำเร็จ' : 'บันทึกส่งมอบสำเร็จ')
    : 'เช็คอินสำเร็จ'
  const statusCard = R && {
    loading: { cls: 'rc-load', icon: '⏳', title: 'กำลังตรวจสอบ...', sub: R.ref },
    ok: { cls: 'rc-ok', icon: <FontAwesomeIcon icon={faCheck} />, title: okLabel, sub: R.reg ? `${R.reg.fname} ${R.reg.lname} · ${R.ref}` : R.ref },
    already: { cls: 'rc-warn', icon: <FontAwesomeIcon icon={faTriangleExclamation} />, title: alreadyLabel, sub: R.reg ? `${R.reg.fname} ${R.reg.lname} · เมื่อ ${alreadyAt}` : R.ref },
    notfound: { cls: 'rc-err', icon: '✕', title: 'ไม่พบรหัสนี้', sub: R.ref },
    error: { cls: 'rc-err', icon: '✕', title: 'เกิดข้อผิดพลาด', sub: R.msg },
  }[R.status]

  return (
    <main className="scan-page">
      {/* Popup ยินดีต้อนรับ */}
      {showWelcome && (
        <div className="scan-welcome-overlay" onClick={() => setShowWelcome(false)}>
          <div className="scan-welcome-card">
            <div className="scan-welcome-icon"><FontAwesomeIcon icon={faMosque} /></div>
            <div className="scan-welcome-title">ยินดีต้อนรับเข้าสู่งาน</div>
            <div className="scan-welcome-event">Iftar For Gaza</div>
            <div className="scan-welcome-name">{showWelcome.fname} {showWelcome.lname}</div>
            <div className="scan-welcome-ref">{showWelcome.ref}</div>
          </div>
        </div>
      )}

      <header className="scan-head">
        <div>
          <h1><FontAwesomeIcon icon={faCamera} /> เช็คอินหน้างาน</h1>
          <p>{mode === 'give' ? 'ส่งต่อของ — สแกน QR ผู้บริจาค/ผู้รับ' : 'Iftar For Gaza — สแกน QR ของผู้มาร่วมงาน'}</p>
        </div>
        <div className="scan-count"><b>{count}</b><span>{mode === 'give' ? 'รอบนี้' : 'เช็คอินรอบนี้'}</span></div>
      </header>

      <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', justifyContent: 'center' }}>
        <button
          onClick={() => { setMode('iftar'); modeRef.current = 'iftar'; lastRef.current = ''; setResult(null); setCount(0) }}
          style={{ flex: 1, maxWidth: 180, padding: '8px 16px', borderRadius: 99, border: 'none', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer', background: mode === 'iftar' ? '#15803d' : '#e5e7eb', color: mode === 'iftar' ? '#fff' : '#374151' }}
        >
          <FontAwesomeIcon icon={faMosque} /> Iftar Check-in
        </button>
        <button
          onClick={() => { setMode('give'); modeRef.current = 'give'; lastRef.current = ''; setResult(null); setCount(0) }}
          style={{ flex: 1, maxWidth: 180, padding: '8px 16px', borderRadius: 99, border: 'none', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer', background: mode === 'give' ? '#7c3aed' : '#e5e7eb', color: mode === 'give' ? '#fff' : '#374151' }}
        >
          <FontAwesomeIcon icon={faGift} /> ส่งต่อของ
        </button>
      </div>

      <div className="scan-stage">
        <video ref={videoRef} className="scan-video" muted playsInline />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {!scanning && (
          <div className="scan-overlay">
            <button className="scan-btn" onClick={startCamera}>เปิดกล้องเริ่มสแกน</button>
            {camError && <p className="scan-cam-err">{camError}</p>}
          </div>
        )}
        {scanning && <div className="scan-frame" />}
      </div>

      {statusCard && (
        <div className={`scan-result ${statusCard.cls}`}>
          <div className="rc-icon">{statusCard.icon}</div>
          <div>
            <div className="rc-title">{statusCard.title}</div>
            <div className="rc-sub">{statusCard.sub}</div>
          </div>
        </div>
      )}

      <div className="scan-manual">
        <input
          className="scan-input"
          placeholder={mode === 'give' ? 'พิมพ์ refCode ผู้บริจาค หรือ RCV-{id} ผู้รับ...' : 'หรือพิมพ์รหัส IFG เอง...'}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && manual.trim()) { const fn = mode === 'give' ? checkInGive : checkIn; fn(manual.trim()); setManual('') } }}
        />
        <button className="scan-manual-btn" onClick={() => { if (manual.trim()) { const fn = mode === 'give' ? checkInGive : checkIn; fn(manual.trim()); setManual('') } }}>
          {mode === 'give' ? 'ยืนยัน' : 'เช็คอิน'}
        </button>
      </div>

      {scanning && <button className="scan-stop" onClick={stopCamera}>หยุดกล้อง</button>}

      {/* รายการเช็คอินล่าสุด */}
      {recentList.length > 0 && (
        <div className="scan-recent">
          <div className="scan-recent-head">
            <span>รายการเช็คอินล่าสุด ({recentList.length})</span>
            <button className="scan-export-btn" onClick={exportCSV}>⬇ Export CSV</button>
          </div>
          <div className="scan-recent-list">
            {recentList.map((r, i) => (
              <div key={i} className="scan-recent-item">
                <div className="sri-name">{r.name || '—'}</div>
                <div className="sri-meta">{r.ref} · {r.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <a className="scan-back" href="/admin/event/iftar2026">← กลับแดชบอร์ด</a>
    </main>
  )
}
