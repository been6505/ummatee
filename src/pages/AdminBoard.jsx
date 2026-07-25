import { useEffect, useMemo, useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { writeAuditLog } from '../lib/auditLog.js'

// บอร์ดวางแผนสไตล์ Trello (/admin/board) — v1 ใช้บอร์ดเดียว (default board) ตาม Next.js เวอร์ชันเดิม
// ใช้ collection แบบ flat (boardLists มี boardId, boardCards มี listId+boardId) ตามแบบที่ chats/{id}/messages
// เป็น subcollection จริงในโปรเจกต์นี้ แต่ที่นี่เลือก flat แทนเพราะต้อง query ข้าม list ได้ง่าย (เช่นหน้า dashboard
// นับการ์ดใกล้ครบกำหนดทั้งบอร์ด) ซึ่งทำกับ subcollection ของ list แต่ละอันลำบากกว่า (ต้อง query ซ้อนหลายชั้น)
const DEFAULT_BOARD_ID = 'default'
const DEFAULT_LISTS = ['ต้องทำ', 'กำลังทำ', 'เสร็จแล้ว']

export default function AdminBoard() {
  const [lists, setLists] = useState([])
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [newCardTitle, setNewCardTitle] = useState({})
  const [dragCardId, setDragCardId] = useState(null)

  useEffect(() => {
    // ตัด orderBy('position') ออก — where + orderBy คนละฟิลด์ต้องมี composite index ใน Firestore ซึ่งไม่มี
    // ให้อัตโนมัติ ทำให้ query พังเงียบๆ (onSnapshot error callback ทำแค่ setLoading(false) ไม่โชว์ error)
    // หน้าจอเลยว่างเปล่าไม่มีคอลัมน์ขึ้นเลย — เรียงฝั่ง client แทน จำนวน list น้อยมากไม่กระทบ perf
    const unsubLists = onSnapshot(query(collection(db, 'boardLists'), where('boardId', '==', DEFAULT_BOARD_ID)), async (snap) => {
      if (snap.empty) {
        // สร้าง list เริ่มต้นให้อัตโนมัติครั้งแรกที่เปิดบอร์ด
        await Promise.all(DEFAULT_LISTS.map((name, i) =>
          addDoc(collection(db, 'boardLists'), { boardId: DEFAULT_BOARD_ID, name, position: i, createdAt: serverTimestamp() })
        ))
        return
      }
      setLists(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.position || 0) - (b.position || 0)))
      setLoading(false)
    }, () => setLoading(false))
    const unsubCards = onSnapshot(query(collection(db, 'boardCards'), where('boardId', '==', DEFAULT_BOARD_ID)), (snap) => {
      setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return () => { unsubLists(); unsubCards() }
  }, [])

  const cardsByList = useMemo(() => {
    const m = {}
    for (const l of lists) m[l.id] = cards.filter((c) => c.listId === l.id).sort((a, b) => (a.position || 0) - (b.position || 0))
    return m
  }, [lists, cards])

  const addList = async () => {
    const name = window.prompt('ชื่อคอลัมน์ใหม่')?.trim()
    if (!name) return
    const ref = await addDoc(collection(db, 'boardLists'), {
      boardId: DEFAULT_BOARD_ID, name, position: lists.length, createdAt: serverTimestamp(),
    })
    writeAuditLog({ action: 'create', entityType: 'boardList', entityId: ref.id, summary: `เพิ่มคอลัมน์ "${name}"` })
  }

  const addCard = async (listId) => {
    const title = (newCardTitle[listId] || '').trim()
    if (!title) return
    const ref = await addDoc(collection(db, 'boardCards'), {
      boardId: DEFAULT_BOARD_ID, listId, title, description: '', position: (cardsByList[listId]?.length || 0),
      dueDate: null, assignedToStaffId: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
    writeAuditLog({ action: 'create', entityType: 'boardCard', entityId: ref.id, summary: `เพิ่มการ์ด "${title}"` })
    setNewCardTitle((s) => ({ ...s, [listId]: '' }))
  }

  const removeCard = async (c) => {
    if (!window.confirm(`ลบการ์ด "${c.title}" ถาวร?`)) return
    await deleteDoc(doc(db, 'boardCards', c.id))
    writeAuditLog({ action: 'delete', entityType: 'boardCard', entityId: c.id, summary: `ลบการ์ด "${c.title}"` })
  }

  const setDueDate = async (c, v) => {
    await updateDoc(doc(db, 'boardCards', c.id), { dueDate: v || null, updatedAt: serverTimestamp() })
  }

  const onDrop = async (listId) => {
    if (!dragCardId) return
    const c = cards.find((x) => x.id === dragCardId)
    if (!c || c.listId === listId) { setDragCardId(null); return }
    await updateDoc(doc(db, 'boardCards', dragCardId), { listId, position: (cardsByList[listId]?.length || 0), updatedAt: serverTimestamp() })
    writeAuditLog({ action: 'update', entityType: 'boardCard', entityId: dragCardId, summary: `ย้ายการ์ด "${c.title}"` })
    setDragCardId(null)
  }

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'field']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div><h1>บอร์ดวางแผน</h1><p>ลากการ์ดข้ามคอลัมน์เพื่อย้ายสถานะ</p></div>
              <button className="admin-btn-primary" onClick={addList}>+ เพิ่มคอลัมน์</button>
            </div>

            {loading ? <p>กำลังโหลดข้อมูล...</p> : (
              <div className="admin-board-row">
                {lists.map((l) => (
                  <div
                    key={l.id}
                    className="admin-card admin-board-col"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(l.id)}
                  >
                    <h4>{l.name} ({cardsByList[l.id]?.length || 0})</h4>
                    <div className="admin-board-cards">
                      {(cardsByList[l.id] || []).map((c) => (
                        <div key={c.id} className="admin-board-card" draggable onDragStart={() => setDragCardId(c.id)}>
                          <div className="admin-board-card-title">{c.title}</div>
                          <input
                            type="date"
                            value={c.dueDate || ''}
                            onChange={(e) => setDueDate(c, e.target.value)}
                            className="admin-board-card-date"
                          />
                          <button className="admin-btn-danger" style={{ fontSize: '.75rem' }} onClick={() => removeCard(c)}>ลบ</button>
                        </div>
                      ))}
                    </div>
                    <div className="admin-board-add-card">
                      <input
                        placeholder="เพิ่มการ์ด..."
                        value={newCardTitle[l.id] || ''}
                        onChange={(e) => setNewCardTitle((s) => ({ ...s, [l.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && addCard(l.id)}
                      />
                      <button className="admin-btn-primary" onClick={() => addCard(l.id)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
