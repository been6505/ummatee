import { useEffect, useRef, useState } from 'react'

// ห้องฉายจำลอง 3D — ห่อ room3d.js (imperative three.js) ให้ใช้ใน React
// โหลด three.js ตอน component นี้ mount ครั้งแรกเท่านั้น ถ้าโหลด/สร้าง WebGL ไม่ได้ เรียก onFail
// ให้หน้าหลักสลับไปใช้ผังที่นั่ง 2D แทน
const HINT = 'ลากเพื่อหมุนห้อง · ถ่างนิ้วเพื่อซูม · แตะที่นั่งเพื่อเลือก'

export default function NazaRoom3D({ rows, round, taken, selected, active, onToggle, onFail }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const roomRef = useRef(null)
  const cbRef = useRef({ onToggle, onFail })
  const [ready, setReady] = useState(false)
  const [pov, setPov] = useState(null)
  const [hintOn, setHintOn] = useState(true)

  useEffect(() => { cbRef.current = { onToggle, onFail } }, [onToggle, onFail])

  useEffect(() => {
    let cancelled = false
    import('./room3d.js').then(({ buildRoom }) => {
      if (cancelled) return
      roomRef.current = buildRoom({
        canvas: canvasRef.current, wrap: wrapRef.current, rows,
        onToggle: (id) => cbRef.current.onToggle?.(id),
        onPov: (id) => { setPov(id); setHintOn(true) },
        onHover: () => setHintOn(false),
      })
      setReady(true)
    }).catch((err) => {
      console.error(err)
      if (!cancelled) cbRef.current.onFail?.()
    })
    return () => { cancelled = true; roomRef.current?.dispose(); roomRef.current = null }
  }, [rows])

  useEffect(() => {
    const r = roomRef.current; if (!r) return
    if (active) r.start(); else r.stop()
  }, [active, ready])

  useEffect(() => {
    roomRef.current?.apply({ round, taken, selected })
  }, [round, taken, selected, ready])

  const lastSel = selected.length ? selected[selected.length - 1] : null

  return (
    <div className="panel room3d" ref={wrapRef}>
      <canvas ref={canvasRef} className="room-canvas" aria-label="ห้องฉายจำลองสามมิติ แตะที่นั่งเพื่อเลือก" />
      {!ready && <div className="r3-load">กำลังจัดห้องฉาย…</div>}
      <div className="r3-hint" style={{ opacity: hintOn ? 1 : 0 }}>
        {pov ? `มุมมองจากที่นั่ง ${pov} · แตะที่นั่งเพื่อเลือกเพิ่ม` : HINT}
      </div>
      <div className="r3-btns">
        {pov
          ? <button type="button" onClick={() => roomRef.current?.exitPov()}>← มุมมองรวม</button>
          : (
            <button type="button" disabled={!lastSel || !ready} onClick={() => roomRef.current?.enterPov(lastSel)}>
              {lastSel ? `มุมมองจากที่นั่ง ${lastSel}` : 'เลือกที่นั่งเพื่อดูมุมมอง'}
            </button>
          )}
      </div>
    </div>
  )
}
