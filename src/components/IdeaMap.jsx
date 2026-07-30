import { useEffect, useRef, useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash, faLink, faXmark, faCalendarDays } from '@fortawesome/free-solid-svg-icons'
import {
  clampPos, addLink, removeLinkUpdates, deleteNodeUpdates, edgesOf, centerOf, nextFreePos,
  CANVAS_W, CANVAS_H, NODE_W, NODE_H,
} from '../lib/ideaMap.js'

// แท็บ "ไอเดีย" ของบอร์ดวางแผน — มายด์แมป: ลากโน้ดไปวางที่ไหนก็ได้ ลากเส้นเชื่อมกัน และกำหนดวันได้
//
// เก็บใน collection ideaNodes (flat, มี boardId) แบบเดียวกับ boardLists/boardCards
// พิกัดเก็บเป็น x,y ของผ้าใบขนาดคงที่ (ไม่ใช่ % ของจอ) เพื่อให้ทุกคนเห็นผังเหมือนกันทุกขนาดหน้าจอ
//
// ลากด้วย Pointer Events + setPointerCapture ตัวเดียวจบทั้งเมาส์และนิ้ว
// (touchmove ต้อง preventDefault กันหน้าเลื่อนตาม ซึ่ง pointer-events + touch-action:none ใน CSS จัดการให้แล้ว)
export default function IdeaMap({ boardId }) {
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [linkFrom, setLinkFrom] = useState(null) // โน้ดต้นทางระหว่างรอเลือกปลายทาง
  const [status, setStatus] = useState('')
  const dragRef = useRef(null) // { id, dx, dy } ระยะจากมุมโน้ดถึงจุดที่กด กันโน้ดกระโดดไปใต้นิ้ว
  const canvasRef = useRef(null)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'ideaNodes'), where('boardId', '==', boardId)),
      (snap) => { setNodes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false) },
      () => setLoading(false),
    )
    return unsub
  }, [boardId])

  const note = (msg) => { setStatus(msg); setTimeout(() => setStatus(''), 2200) }

  const addNode = async () => {
    const pos = nextFreePos(nodes)
    try {
      await addDoc(collection(db, 'ideaNodes'), {
        boardId, title: 'ไอเดียใหม่', date: null, links: [], ...pos,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
    } catch (e) { note('เพิ่มไม่สำเร็จ: ' + e.message) }
  }

  const patch = (id, data) => updateDoc(doc(db, 'ideaNodes', id), { ...data, updatedAt: serverTimestamp() })

  const removeNode = async (n) => {
    if (!window.confirm(`ลบ "${n.title || 'ไอเดีย'}" และเส้นเชื่อมของมัน?`)) return
    try {
      // ลบเส้นที่โน้ดอื่นชี้มาก่อน แล้วค่อยลบตัวโน้ด — ลำดับนี้ทำให้ไม่มีจังหวะที่เส้นชี้ไปที่ว่าง
      await Promise.all(deleteNodeUpdates(nodes, n.id).map((u) => patch(u.id, { links: u.links })))
      await deleteDoc(doc(db, 'ideaNodes', n.id))
    } catch (e) { note('ลบไม่สำเร็จ: ' + e.message) }
  }

  // กด "เชื่อม" ที่โน้ดแรก แล้วกดโน้ดที่สอง — กดโน้ดเดิมซ้ำ = ยกเลิก
  const tapNode = async (n) => {
    if (!linkFrom) return
    if (linkFrom === n.id) { setLinkFrom(null); return }
    const links = addLink(nodes, linkFrom, n.id)
    setLinkFrom(null)
    if (!links) { note('เชื่อมไม่ได้ (เส้นนี้มีอยู่แล้ว)'); return }
    try { await patch(linkFrom, { links }) } catch (e) { note('เชื่อมไม่สำเร็จ: ' + e.message) }
  }

  const removeEdge = async (e) => {
    try {
      await Promise.all(removeLinkUpdates(nodes, e.from.id, e.to.id).map((u) => patch(u.id, { links: u.links })))
    } catch (err) { note('ลบเส้นไม่สำเร็จ: ' + err.message) }
  }

  const onPointerDown = (e, n) => {
    if (linkFrom) return // โหมดเชื่อม: การกดคือเลือกปลายทาง ไม่ใช่ลาก
    const rect = canvasRef.current.getBoundingClientRect()
    dragRef.current = {
      id: n.id,
      dx: e.clientX - rect.left - (Number(n.x) || 0),
      dy: e.clientY - rect.top - (Number(n.y) || 0),
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const rect = canvasRef.current.getBoundingClientRect()
    const pos = clampPos(e.clientX - rect.left - d.dx, e.clientY - rect.top - d.dy)
    // อัปเดตในหน่วยความจำก่อนเพื่อให้ลากลื่น — เขียน Firestore ครั้งเดียวตอนปล่อยนิ้ว
    setNodes((prev) => prev.map((n) => (n.id === d.id ? { ...n, ...pos } : n)))
  }

  const onPointerUp = async () => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    const n = nodes.find((x) => x.id === d.id)
    if (!n) return
    try { await patch(d.id, clampPos(n.x, n.y)) } catch (e) { note('ย้ายไม่สำเร็จ: ' + e.message) }
  }

  const edges = edgesOf(nodes)

  return (
    <div className="admin-card idea-card">
      <div className="idea-toolbar">
        <button className="admin-btn-primary" onClick={addNode}>
          <FontAwesomeIcon icon={faPlus} /> เพิ่มไอเดีย
        </button>
        <span className="idea-hint">
          {linkFrom
            ? 'เลือกไอเดียปลายทางเพื่อเชื่อม (กดใบเดิมซ้ำเพื่อยกเลิก)'
            : 'ลากการ์ดเพื่อย้าย · กดปุ่มโซ่เพื่อเชื่อม · กดเส้นเพื่อลบเส้น'}
        </span>
        {status && <span className="idea-status">{status}</span>}
      </div>

      {loading ? <p className="admin-empty">กำลังโหลด...</p> : nodes.length === 0 ? (
        <p className="admin-empty">ยังไม่มีไอเดีย — กด “เพิ่มไอเดีย” เพื่อเริ่ม</p>
      ) : null}

      {/* ผ้าใบกว้างกว่าจอ เลื่อนดูได้ — ไม่ย่อผังลงมาให้พอจอเพราะข้อความในโน้ดจะเล็กจนอ่านไม่ออก */}
      <div className="idea-scroll">
        <div className="idea-canvas" ref={canvasRef} style={{ width: CANVAS_W, height: CANVAS_H }}>
          <svg className="idea-edges" width={CANVAS_W} height={CANVAS_H}>
            {edges.map((e) => {
              const a = centerOf(e.from)
              const b = centerOf(e.to)
              return (
                <g key={e.key} className="idea-edge" onClick={() => removeEdge(e)}>
                  {/* เส้นโปร่งหนาซ้อนไว้ให้กดง่าย — เส้นจริงบางเกินกว่าจะกดโดนบนมือถือ */}
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="idea-edge-hit" />
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="idea-edge-line" />
                </g>
              )
            })}
          </svg>

          {nodes.map((n) => {
            const pos = clampPos(n.x, n.y)
            const isFrom = linkFrom === n.id
            return (
              <div
                key={n.id}
                className={`idea-node${isFrom ? ' linking' : ''}${linkFrom && !isFrom ? ' target' : ''}`}
                style={{ left: pos.x, top: pos.y, width: NODE_W, minHeight: NODE_H }}
                onPointerDown={(e) => onPointerDown(e, n)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onClick={() => tapNode(n)}
              >
                <div className="idea-node-head">
                  <input
                    className="idea-node-title"
                    value={n.title || ''}
                    onChange={(e) => setNodes((p) => p.map((x) => (x.id === n.id ? { ...x, title: e.target.value } : x)))}
                    onBlur={(e) => patch(n.id, { title: e.target.value.trim() || 'ไอเดียใหม่' }).catch(() => note('บันทึกชื่อไม่สำเร็จ'))}
                    onPointerDown={(e) => e.stopPropagation()}
                    placeholder="ชื่อไอเดีย"
                  />
                  <span className="idea-node-btns">
                    <button
                      type="button"
                      className={`idea-node-btn${isFrom ? ' on' : ''}`}
                      title="เชื่อมกับไอเดียอื่น"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); setLinkFrom(isFrom ? null : n.id) }}
                    >
                      <FontAwesomeIcon icon={isFrom ? faXmark : faLink} />
                    </button>
                    <button
                      type="button"
                      className="idea-node-btn danger"
                      title="ลบไอเดีย"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); removeNode(n) }}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </span>
                </div>
                <label className="idea-node-date" onPointerDown={(e) => e.stopPropagation()}>
                  <FontAwesomeIcon icon={faCalendarDays} />
                  <input
                    type="date"
                    value={n.date || ''}
                    onChange={(e) => patch(n.id, { date: e.target.value || null }).catch(() => note('บันทึกวันไม่สำเร็จ'))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </label>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
