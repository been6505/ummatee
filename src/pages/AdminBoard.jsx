import { useEffect, useMemo, useState } from 'react'
import IdeaMap from '../components/IdeaMap.jsx'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import CommentThread from '../components/CommentThread.jsx'
import { useStaffDirectory, memberLabel, findMember } from '../data/staffDirectory.js'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { writeAuditLog } from '../lib/auditLog.js'
import ListSkeleton from '../components/ListSkeleton.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { withSearchTokens } from '../lib/searchIndex.js'
// ฟิลด์ที่เอาไปสร้างดัชนีคำค้น — ต้องตรงกับ SEARCH_COLLECTIONS ใน lib/searchIndex.js
const SEARCH_FIELDS = ['title']

// บอร์ดวางแผนสไตล์ Trello (/admin/board) — v1 ใช้บอร์ดเดียว (default board) ตาม Next.js เวอร์ชันเดิม
// ใช้ collection แบบ flat (boardLists มี boardId, boardCards มี listId+boardId) ตามแบบที่ chats/{id}/messages
// เป็น subcollection จริงในโปรเจกต์นี้ แต่ที่นี่เลือก flat แทนเพราะต้อง query ข้าม list ได้ง่าย (เช่นหน้า dashboard
// นับการ์ดใกล้ครบกำหนดทั้งบอร์ด) ซึ่งทำกับ subcollection ของ list แต่ละอันลำบากกว่า (ต้อง query ซ้อนหลายชั้น)
const DEFAULT_BOARD_ID = 'default'
const DEFAULT_LISTS = ['ต้องทำ', 'กำลังทำ', 'เสร็จแล้ว']

export default function AdminBoard() {
  const [lists, setLists] = useState([])
  const [cards, setCards] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [newCardTitle, setNewCardTitle] = useState({})
  const [dragCardId, setDragCardId] = useState(null)
  const [tab, setTab] = useState('board')
  const { members: directory } = useStaffDirectory()
  // เปิดกล่องคุยได้ทีละใบ — ถ้า mount CommentThread ไว้ทุกการ์ด แต่ละใบจะเปิด listener ของตัวเอง
  // บอร์ดที่มีการ์ดหลายสิบใบก็เท่ากับ query ค้างไว้หลายสิบชุดพร้อมกันตั้งแต่เปิดหน้า
  const [openChatCardId, setOpenChatCardId] = useState(null)

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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'campaigns'), (snap) => setCampaigns(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [])

  const setCampaign = async (c, campaignId) => {
    await updateDoc(doc(db, 'boardCards', c.id), { campaignId: campaignId || null, updatedAt: serverTimestamp() })
  }

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
    const ref = await addDoc(collection(db, 'boardCards'), withSearchTokens({
      boardId: DEFAULT_BOARD_ID, listId, title, description: '', position: (cardsByList[listId]?.length || 0),
      dueDate: null, assignedToStaffId: null, campaignId: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }, SEARCH_FIELDS))
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

  // ฟิลด์ assignedToStaffId มีอยู่ในการ์ดตั้งแต่แรกแล้ว แต่ไม่เคยมีที่ให้กรอก — เขียน null ตอนสร้างแล้วจบ
  // ใส่ audit log ด้วย เพราะ "ใครมอบงานให้ใคร" เป็นข้อมูลที่ย้อนดูแล้วมีประโยชน์เวลางานตกหล่น
  const setAssignee = async (c, uid) => {
    await updateDoc(doc(db, 'boardCards', c.id), { assignedToStaffId: uid || null, updatedAt: serverTimestamp() })
    const who = uid ? memberLabel(findMember(directory, uid)) : 'ไม่มีผู้รับผิดชอบ'
    writeAuditLog({ action: 'update', entityType: 'boardCard', entityId: c.id, summary: `มอบหมาย "${c.title}" ให้ ${who}` })
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
              <div>
                <h1>บอร์ดวางแผน</h1>
                <p>{tab === 'board' ? 'ลากการ์ดข้ามคอลัมน์เพื่อย้ายสถานะ' : 'ลากไอเดียไปวางที่ไหนก็ได้ เชื่อมโยงกัน และกำหนดวันได้'}</p>
              </div>
              {tab === 'board' && <button className="admin-btn-primary" onClick={addList}>+ เพิ่มคอลัมน์</button>}
            </div>

            {/* สองมุมมองของงานเดียวกัน: คอลัมน์สถานะ (คัมบัง) กับผังไอเดีย (มายด์แมป)
                แยกข้อมูลกัน — ไอเดียยังไม่ใช่งานที่มีสถานะ ถ้าเอามาปนคอลัมน์จะต้องเลือกสถานะให้ทุกไอเดีย */}
            <div className="admin-cal-status-chips idea-tabs">
              <button type="button" className={tab === 'board' ? 'on' : ''} onClick={() => setTab('board')}>คอลัมน์งาน</button>
              <button type="button" className={tab === 'idea' ? 'on' : ''} onClick={() => setTab('idea')}>ไอเดีย (มายด์แมป)</button>
            </div>

            {tab === 'idea' ? <IdeaMap boardId={DEFAULT_BOARD_ID} /> : loading ? <ListSkeleton /> : (
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
                          <div className="admin-board-card-head">
                            <div className="admin-board-card-title">{c.title}</div>
                            {/* ปุ่มลบเป็นไอคอนมุมขวาบน โผล่ตอน hover — เดิมเป็นปุ่มแดงเต็มความกว้างที่ดึงสายตา
                                มากกว่าตัวเนื้อหาการ์ดเอง (บนจอสัมผัสไม่มี hover จึงตั้งให้แสดงตลอดด้วย media query) */}
                            <button className="admin-board-card-del" onClick={() => removeCard(c)} aria-label={`ลบการ์ด ${c.title}`} title="ลบการ์ด">
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                          <label className="admin-board-field">
                            <span>กำหนดส่ง</span>
                            <input
                              type="date"
                              value={c.dueDate || ''}
                              onChange={(e) => setDueDate(c, e.target.value)}
                              className="admin-board-card-date"
                            />
                          </label>
                          <label className="admin-board-field">
                            <span>ผู้รับผิดชอบ</span>
                            <select
                              className="admin-board-card-campaign"
                              value={c.assignedToStaffId || ''}
                              onChange={(e) => setAssignee(c, e.target.value)}
                            >
                              <option value="">— ยังไม่มอบหมาย —</option>
                              {/* คนที่ถูกมอบหมายไว้แต่ออกจากทีมไปแล้ว ต้องยังอยู่ในลิสต์ ไม่งั้น select
                                  หาค่าไม่เจอแล้วเด้งกลับเป็น "ยังไม่มอบหมาย" เงียบๆ ทั้งที่ข้อมูลยังอยู่ */}
                              {(c.assignedToStaffId && !directory.some((m) => m.uid === c.assignedToStaffId)
                                ? [...directory, findMember(directory, c.assignedToStaffId)]
                                : directory
                              ).map((m) => (
                                <option key={m.uid} value={m.uid}>
                                  {memberLabel(m)}{m.missing ? ' (ไม่อยู่ในทีมแล้ว)' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="admin-board-field">
                            <span>แคมเปญ</span>
                            <select
                              className="admin-board-card-campaign"
                              value={c.campaignId || ''}
                              onChange={(e) => setCampaign(c, e.target.value)}
                            >
                              <option value="">— ไม่ผูกแคมเปญ —</option>
                              {campaigns.map((camp) => <option key={camp.id} value={camp.id}>{camp.name}</option>)}
                            </select>
                          </label>

                          <button
                            type="button"
                            className="admin-board-chat-toggle"
                            onClick={() => setOpenChatCardId((id) => (id === c.id ? null : c.id))}
                          >
                            {openChatCardId === c.id ? 'ปิดการสนทนา' : 'คุยเรื่องงานนี้'}
                          </button>
                          {openChatCardId === c.id && (
                            <CommentThread entityType="boardCard" entityId={c.id} title="การสนทนา" />
                          )}
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
