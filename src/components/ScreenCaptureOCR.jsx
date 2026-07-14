import { useRef, useState, useEffect, useCallback } from 'react'
import { createWorker } from 'tesseract.js'

const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function ocrFromCanvas(sourceCanvas, cropRect, scale) {
  const c = document.createElement('canvas')
  let sx = 0, sy = 0, sw = sourceCanvas.width, sh = sourceCanvas.height
  if (cropRect && cropRect.w > 10 && cropRect.h > 10) {
    sx = cropRect.x / scale
    sy = cropRect.y / scale
    sw = cropRect.w / scale
    sh = cropRect.h / scale
  }
  const upscale = 2
  c.width = sw * upscale
  c.height = sh * upscale
  c.getContext('2d').drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, c.width, c.height)

  const worker = await createWorker('eng+tha')
  const { data } = await worker.recognize(c.toDataURL('image/png'))
  await worker.terminate()

  const raw = data.text.trim()
  const nums = raw.replace(/,/g, '').match(/[\d]+\.?\d*/g)
  let num = null
  if (nums) {
    num = parseFloat(nums.reduce((a, b) => (parseFloat(a) > parseFloat(b) ? a : b)))
  }
  return { raw, num }
}

export default function ScreenCaptureOCR({ onExtracted, onAutoSave }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [imgSrc, setImgSrc] = useState(null)
  const [crop, setCrop] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [extractedText, setExtractedText] = useState('')
  const [extractedNum, setExtractedNum] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [scale, setScale] = useState(1)

  const [baseline, setBaseline] = useState(null)
  const [history, setHistory] = useState([])

  // Realtime mode
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  const intervalRef = useRef(null)
  const cropRef = useRef(null)
  const baselineRef = useRef(null)
  const scaleRef = useRef(1)
  const [realtime, setRealtime] = useState(false)
  const [intervalSec, setIntervalSec] = useState(10)
  const [countdown, setCountdown] = useState(0)
  const [realtimeStatus, setRealtimeStatus] = useState('')

  // Keep refs in sync
  useEffect(() => { cropRef.current = crop }, [crop])
  useEffect(() => { baselineRef.current = baseline }, [baseline])
  useEffect(() => { scaleRef.current = scale }, [scale])

  // เก็บ callback ล่าสุดไว้ใน ref — เพราะ loop ใน startRealtime (setInterval) จับ closure ไว้ตั้งแต่ตอนกดเริ่ม
  // ถ้าเรียก prop ตรง ๆ ค่า form/prevAmount ฝั่ง AdminFinancialDashboard จะค้างเป็นค่าเก่า (stale) ตลอดการ Realtime
  const onExtractedRef = useRef(onExtracted)
  const onAutoSaveRef = useRef(onAutoSave)
  useEffect(() => { onExtractedRef.current = onExtracted; onAutoSaveRef.current = onAutoSave })

  const delta = (extractedNum != null && baseline != null) ? Math.max(extractedNum - baseline, 0) : null

  const grabFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null
    const c = document.createElement('canvas')
    c.width = video.videoWidth
    c.height = video.videoHeight
    c.getContext('2d').drawImage(video, 0, 0)
    return c
  }, [])

  const loadImageToCanvas = useCallback((src) => {
    if (!canvasRef.current) return
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const maxW = canvasRef.current.parentElement.clientWidth - 32
      const s = Math.min(1, maxW / img.width)
      setScale(s)
      canvasRef.current.width = img.width * s
      canvasRef.current.height = img.height * s
      const ctx = canvasRef.current.getContext('2d')
      ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height)
    }
    img.src = src
  }, [])

  const handleCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()
      const c = document.createElement('canvas')
      c.width = video.videoWidth
      c.height = video.videoHeight
      c.getContext('2d').drawImage(video, 0, 0)
      stream.getTracks().forEach((t) => t.stop())
      const src = c.toDataURL('image/png')
      setImgSrc(src)
      setCrop(null)
      setExtractedText('')
      setExtractedNum(null)
      loadImageToCanvas(src)
    } catch (_) { /* user cancelled */ }
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImgSrc(ev.target.result)
      setCrop(null)
      setExtractedText('')
      setExtractedNum(null)
    }
    reader.readAsDataURL(file)
  }

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const reader = new FileReader()
        reader.onload = (ev) => {
          setImgSrc(ev.target.result)
          setCrop(null)
          setExtractedText('')
          setExtractedNum(null)
        }
        reader.readAsDataURL(item.getAsFile())
        break
      }
    }
  }, [])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  useEffect(() => {
    if (!imgSrc || !canvasRef.current) return
    loadImageToCanvas(imgSrc)
  }, [imgSrc, loadImageToCanvas])

  useEffect(() => {
    if (!imgSrc || !canvasRef.current || !imgRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.drawImage(imgRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height)
    if (crop) {
      ctx.strokeStyle = '#2E7D52'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h)
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(46,125,82,0.12)'
      ctx.fillRect(crop.x, crop.y, crop.w, crop.h)
    }
  }, [crop, imgSrc])

  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onMouseDown = (e) => {
    const p = getPos(e)
    setDragStart(p)
    setDragging(true)
    setCrop(null)
  }
  const onMouseMove = (e) => {
    if (!dragging || !dragStart) return
    const p = getPos(e)
    setCrop({
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      w: Math.abs(p.x - dragStart.x),
      h: Math.abs(p.y - dragStart.y),
    })
  }
  const onMouseUp = () => setDragging(false)

  const runOCR = async () => {
    if (!imgRef.current) return
    setProcessing(true)
    setExtractedText('')
    setExtractedNum(null)
    try {
      const srcCanvas = document.createElement('canvas')
      const img = imgRef.current
      srcCanvas.width = img.width
      srcCanvas.height = img.height
      srcCanvas.getContext('2d').drawImage(img, 0, 0)
      const { raw, num } = await ocrFromCanvas(srcCanvas, crop, scale)
      setExtractedText(raw)
      setExtractedNum(num)
    } catch (err) {
      setExtractedText('OCR ผิดพลาด: ' + err.message)
    }
    setProcessing(false)
  }

  const setAsBaseline = () => {
    if (extractedNum != null) {
      setBaseline(extractedNum)
      setHistory([{ time: new Date(), raw: extractedNum, delta: 0 }])
    }
  }

  const applyDelta = () => {
    if (delta != null) {
      onExtracted(delta)
      setHistory((h) => [...h, { time: new Date(), raw: extractedNum, delta }])
    }
  }

  const resetBaseline = () => {
    setBaseline(null)
    setHistory([])
  }

  // --- Realtime ---
  const stopRealtime = useCallback(() => {
    setRealtime(false)
    setRealtimeStatus('')
    setCountdown(0)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    if (videoRef.current) { videoRef.current = null }
  }, [])

  const startRealtime = async () => {
    if (baseline == null) {
      setRealtimeStatus('⚠️ ต้องตั้งยอดฐานก่อนเปิด Realtime')
      return
    }
    if (!crop || crop.w < 10 || crop.h < 10) {
      setRealtimeStatus('⚠️ ต้องลากเลือกบริเวณตัวเลขก่อน')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      streamRef.current = stream
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()
      videoRef.current = video

      stream.getVideoTracks()[0].addEventListener('ended', stopRealtime)

      setRealtime(true)
      setRealtimeStatus('🟢 Realtime กำลังทำงาน...')
      setCountdown(intervalSec)

      let cd = intervalSec
      intervalRef.current = setInterval(async () => {
        cd--
        if (cd > 0) {
          setCountdown(cd)
          return
        }
        cd = intervalSec
        setCountdown(intervalSec)

        setRealtimeStatus('🔄 กำลังแคป + อ่านยอด...')
        const frameCanvas = grabFrame()
        if (!frameCanvas) return

        // Show frame on preview canvas
        const src = frameCanvas.toDataURL('image/png')
        setImgSrc(src)

        try {
          const { raw, num } = await ocrFromCanvas(frameCanvas, cropRef.current, scaleRef.current)
          setExtractedText(raw)
          setExtractedNum(num)

          if (num != null && baselineRef.current != null) {
            const d = Math.max(num - baselineRef.current, 0)
            onExtractedRef.current?.(d)
            setHistory((h) => [...h, { time: new Date(), raw: num, delta: d }])
            if (onAutoSaveRef.current) await onAutoSaveRef.current(d)
            setRealtimeStatus(`🟢 อัพเดทแล้ว: ${fmt(d)} บาท`)
          } else {
            setRealtimeStatus('⚠️ อ่านยอดไม่ได้ — รอรอบถัดไป')
          }
        } catch {
          setRealtimeStatus('⚠️ OCR ผิดพลาด — รอรอบถัดไป')
        }
      }, 1000)
    } catch {
      setRealtimeStatus('❌ ไม่สามารถแคปหน้าจอได้')
    }
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="admin-card" style={{ marginBottom: 24 }}>
      <h4>📷 แคปจอ / อัพโหลดรูป → OCR อ่านยอด</h4>
      <p style={{ fontSize: 13, opacity: 0.7, margin: '0 0 12px' }}>
        แคปจอจากไลฟ์สด หรือวางรูป (Ctrl+V) แล้วลากเลือกบริเวณตัวเลขยอดบริจาค
      </p>

      {/* Baseline status */}
      {baseline != null && (
        <div style={{ background: '#1a2a1a', border: '1px solid #2E7D52', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>ยอดฐาน (Baseline)</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#C9A84C' }}>{fmt(baseline)} บาท</div>
            </div>
            <button type="button" className="admin-btn" onClick={resetBaseline} disabled={realtime} style={{ fontSize: 12 }}>
              🔄 รีเซ็ตยอดฐาน
            </button>
          </div>
          <p style={{ fontSize: 12, opacity: 0.6, margin: '8px 0 0' }}>
            ยอดที่แคปครั้งต่อไปจะคำนวณเป็น: ยอดใหม่ − {fmt(baseline)} = ยอดปัจจุบัน
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button type="button" className="admin-btn" onClick={handleCapture} disabled={realtime}>🖥️ แคปหน้าจอ</button>
        <label className="admin-btn" style={{ cursor: realtime ? 'not-allowed' : 'pointer', opacity: realtime ? 0.5 : 1 }}>
          📁 เลือกไฟล์
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} disabled={realtime} />
        </label>
      </div>

      {imgSrc && (
        <>
          <div style={{ overflow: 'auto', maxHeight: 500, border: '1px solid #ccc', borderRadius: 8, marginBottom: 12 }}>
            <canvas
              ref={canvasRef}
              style={{ cursor: realtime ? 'default' : 'crosshair', display: 'block' }}
              onMouseDown={realtime ? undefined : onMouseDown}
              onMouseMove={realtime ? undefined : onMouseMove}
              onMouseUp={realtime ? undefined : onMouseUp}
              onMouseLeave={realtime ? undefined : onMouseUp}
            />
          </div>
          {crop && crop.w > 10 && !realtime && (
            <p style={{ fontSize: 13, color: '#2E7D52' }}>
              ✓ เลือกบริเวณแล้ว ({Math.round(crop.w)}×{Math.round(crop.h)} px) — กดอ่านยอดได้เลย
            </p>
          )}
          {!realtime && (
            <button
              type="button"
              className="admin-btn-primary"
              onClick={runOCR}
              disabled={processing}
              style={{ marginBottom: 12 }}
            >
              {processing ? '⏳ กำลังอ่าน...' : '🔍 อ่านยอดจากรูป (OCR)'}
            </button>
          )}

          {extractedText && (
            <div style={{ background: '#f0f0f0', color: '#222', padding: 12, borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>ข้อความที่อ่านได้:</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>{extractedText}</pre>
            </div>
          )}

          {extractedNum != null && !realtime && (
            <div style={{ background: '#f5f5f5', color: '#222', borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 4 }}>ยอดที่อ่านได้จากรูป</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(extractedNum)} บาท</div>

              {baseline == null ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="admin-btn" onClick={setAsBaseline}>
                    📌 ตั้งเป็นยอดฐาน (เริ่มนับจาก 0)
                  </button>
                  <button type="button" className="admin-btn-primary" onClick={() => onExtracted(extractedNum)}>
                    ✅ ใช้ยอดนี้ตรงๆ
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, opacity: 0.7, marginBottom: 4 }}>
                    <span>{fmt(extractedNum)}</span>
                    <span>−</span>
                    <span>{fmt(baseline)}</span>
                    <span>=</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#2E7D52' }}>
                    {fmt(delta)} บาท
                  </div>
                  <button type="button" className="admin-btn-primary" onClick={applyDelta} style={{ marginTop: 8 }}>
                    ✅ ใช้ยอดนี้ ({fmt(delta)} บาท)
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Realtime controls */}
      <div style={{ background: realtime ? '#e8f5e9' : '#f5f5f5', border: `1px solid ${realtime ? '#2E7D52' : '#ccc'}`, borderRadius: 8, padding: 16, marginTop: 12, color: '#222' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <h4 style={{ margin: 0 }}>⚡ Realtime Mode</h4>
          {realtime && countdown > 0 && (
            <span style={{ fontSize: 14, color: '#C9A84C', fontWeight: 600 }}>อัพเดทอีก {countdown} วินาที</span>
          )}
        </div>
        <p style={{ fontSize: 12, opacity: 0.6, margin: '0 0 12px' }}>
          เปิดแคปจอค้างไว้ → ระบบจะแคป + OCR + อัพเดทยอด + บันทึกลง Firestore อัตโนมัติตามช่วงเวลาที่ตั้ง
        </p>

        {!realtime ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <label style={{ fontSize: 13 }}>อ่านยอดทุกๆ</label>
              <select
                value={intervalSec}
                onChange={(e) => setIntervalSec(Number(e.target.value))}
                style={{ padding: '4px 8px', borderRadius: 4, background: '#fff', color: '#222', border: '1px solid #ccc' }}
              >
                <option value={5}>5 วินาที</option>
                <option value={10}>10 วินาที</option>
                <option value={15}>15 วินาที</option>
                <option value={30}>30 วินาที</option>
                <option value={60}>1 นาที</option>
              </select>
            </div>
            <button type="button" className="admin-btn-primary" onClick={startRealtime}>
              ▶️ เริ่ม Realtime
            </button>
            {!baseline && <span style={{ fontSize: 12, opacity: 0.5, marginLeft: 8, color: '#666' }}>ต้องตั้งยอดฐาน + เลือกบริเวณก่อน</span>}
          </>
        ) : (
          <button type="button" className="admin-btn" onClick={stopRealtime} style={{ background: '#7D2E2E', borderColor: '#7D2E2E' }}>
            ⏹️ หยุด Realtime
          </button>
        )}

        {realtimeStatus && (
          <div style={{ marginTop: 8, fontSize: 13 }}>{realtimeStatus}</div>
        )}
      </div>

      {/* History log */}
      {history.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>ประวัติการอ่านยอด</div>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ opacity: 0.6, textAlign: 'left' }}>
                  <th style={{ padding: '4px 8px' }}>#</th>
                  <th style={{ padding: '4px 8px' }}>เวลา</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right' }}>ยอดดิบ</th>
                  <th style={{ padding: '4px 8px', textAlign: 'right' }}>ยอดสุทธิ (−ฐาน)</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #ddd' }}>
                    <td style={{ padding: '4px 8px' }}>{history.length - i}</td>
                    <td style={{ padding: '4px 8px' }}>{h.time.toLocaleTimeString('th-TH')}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmt(h.raw)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: '#2E7D52', fontWeight: 600 }}>{fmt(h.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
