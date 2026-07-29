import { useEffect, useMemo, useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { writeAuditLog } from '../lib/auditLog.js'
import { withSearchTokens } from '../lib/searchIndex.js'

import FileAttachments from '../components/FileAttachments.jsx'
import ExportButtons from '../components/ExportButtons.jsx'
// ยังต้อง import downloadCsv ตรงๆ ด้วย เพราะรายชื่อผู้ลงทะเบียนของแต่ละงาน (exportRegsCsv) ไม่ได้ใช้
// ExportButtons — ข้อมูลขึ้นกับงานที่เลือกอยู่ ไม่ใช่ชุดเดียวของทั้งหน้า
import { downloadCsv } from '../lib/csv.js'
import ListSkeleton from '../components/ListSkeleton.jsx'
// ฟิลด์ที่เอาไปสร้างดัชนีคำค้น — ต้องตรงกับ SEARCH_COLLECTIONS ใน lib/searchIndex.js
const SEARCH_FIELDS = ['name', 'location']

// งาน/อีเวนต์ทั่วไป (/admin/events) — ข้อ 3 ของแผน admin-intranet-plan.md
// eventRegistrations เป็น flat collection (มี eventId อ้างอิง) — สาธารณะ create ได้ (ลงทะเบียนเอง)
// แต่ยังไม่มีหน้าฟอร์มสาธารณะในรอบนี้ (ขอบเขตงานนี้คือฝั่งแอดมินเท่านั้น ตามที่ระบุในแผน)
const STATUS_LABEL = { planning: 'วางแผน', confirmed: 'ยืนยันแล้ว', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก' }
const STATUS_COLOR = { planning: '#999', confirmed: '#2e7d52', completed: '#1565c0', cancelled: '#c0392b' }

const EMPTY = {
  name: '', description: '', startAt: '', endAt: '', location: '', budget: '', targetAttendees: '',
  campaignId: '', status: 'planning',
}

export default function AdminEvents() {
  const [list, setList] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [openEventId, setOpenEventId] = useState(null)
  const [regs, setRegs] = useState([])

  useEffect(() => {
    const qy = query(collection(db, 'events'), orderBy('startAt', 'desc'))
    const unsub = onSnapshot(qy, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'campaigns'), (snap) => setCampaigns(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [])

  useEffect(() => {
    if (!openEventId) { setRegs([]); return }
    const qy = query(collection(db, 'eventRegistrations'), where('eventId', '==', openEventId))
    const unsub = onSnapshot(qy, (snap) => setRegs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [openEventId])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return list
    return list.filter((e) => [e.name, e.location, e.status].some((x) => (x || '').toLowerCase().includes(s)))
  }, [list, search])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.name.trim()) { window.alert('กรอกชื่องาน'); return }
    if (!form.startAt) { window.alert('กรอกวันเวลาเริ่มงาน'); return }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      startAt: form.startAt,
      endAt: form.endAt || null,
      location: form.location.trim(),
      budget: Number(form.budget) || 0,
      targetAttendees: Number(form.targetAttendees) || 0,
      campaignId: form.campaignId || null,
      status: form.status,
      updatedAt: serverTimestamp(),
    }
    if (editId) {
      await updateDoc(doc(db, 'events', editId), withSearchTokens(payload, SEARCH_FIELDS))
      writeAuditLog({ action: 'update', entityType: 'event', entityId: editId, summary: `แก้ไขงาน ${payload.name}` })
    } else {
      const ref = await addDoc(collection(db, 'events'), withSearchTokens({ ...payload, createdAt: serverTimestamp() }, SEARCH_FIELDS))
      writeAuditLog({ action: 'create', entityType: 'event', entityId: ref.id, summary: `เพิ่มงาน ${payload.name}` })
    }
    setForm(EMPTY); setEditId(null)
  }

  const edit = (e) => {
    setEditId(e.id)
    setForm({
      name: e.name || '', description: e.description || '', startAt: e.startAt || '', endAt: e.endAt || '',
      location: e.location || '', budget: e.budget || '', targetAttendees: e.targetAttendees || '',
      campaignId: e.campaignId || '', status: e.status || 'planning',
    })
  }
  const cancel = () => { setEditId(null); setForm(EMPTY) }

  const remove = async (e) => {
    if (!window.confirm(`ลบงาน "${e.name}" ถาวร?`)) return
    await deleteDoc(doc(db, 'events', e.id))
    writeAuditLog({ action: 'delete', entityType: 'event', entityId: e.id, summary: `ลบงาน ${e.name}` })
    if (openEventId === e.id) setOpenEventId(null)
  }

  const toggleCheckIn = async (r) => {
    await updateDoc(doc(db, 'eventRegistrations', r.id), {
      checkedIn: !r.checkedIn,
      checkedInAt: !r.checkedIn ? serverTimestamp() : null,
    })
    writeAuditLog({ action: 'update', entityType: 'eventRegistration', entityId: r.id, summary: `${!r.checkedIn ? 'เช็คอิน' : 'ยกเลิกเช็คอิน'} ${r.name}` })
  }

  const removeReg = async (r) => {
    if (!window.confirm(`ลบผู้ลงทะเบียน "${r.name}" ถาวร?`)) return
    await deleteDoc(doc(db, 'eventRegistrations', r.id))
    writeAuditLog({ action: 'delete', entityType: 'eventRegistration', entityId: r.id, summary: `ลบผู้ลงทะเบียน ${r.name}` })
  }

  // สร้างชุดข้อมูลครั้งเดียว ใช้ได้ทั้งดาวน์โหลด CSV และส่งเข้า Google Sheets (ดู ExportButtons.jsx)
  const buildExport = () => ({
    filename: 'events.csv',
    sheetName: 'งานอีเวนต์',
    headers: ['ชื่องาน', 'วันเวลาเริ่ม', 'วันเวลาสิ้นสุด', 'สถานที่', 'งบ', 'เป้าผู้เข้าร่วม', 'สถานะ'],
    rows: filtered.map((e) => [e.name, e.startAt, e.endAt, e.location, e.budget, e.targetAttendees, STATUS_LABEL[e.status] || e.status]),
  })

  const exportRegsCsv = (eventName) => {
    downloadCsv(`event-registrations-${eventName}.csv`,
      ['ชื่อ', 'เบอร์โทร', 'อีเมล', 'เช็คอินแล้ว'],
      regs.map((r) => [r.name, r.phone, r.email || '', r.checkedIn ? 'ใช่' : 'ไม่'])
    )
  }

  const openEvent = list.find((e) => e.id === openEventId)

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'field']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div><h1>งาน / อีเวนต์</h1><p>วางแผนงาน จัดการผู้ลงทะเบียน และเช็คอินหน้างาน</p></div>
              <ExportButtons build={buildExport} />
            </div>

            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>{editId ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}</h4>
              <div className="admin-form-grid">
                <label>ชื่องาน<input value={form.name} onChange={set('name')} /></label>
                <label>สถานที่<input value={form.location} onChange={set('location')} /></label>
                <label>วันเวลาเริ่ม<input type="datetime-local" value={form.startAt} onChange={set('startAt')} /></label>
                <label>วันเวลาสิ้นสุด<input type="datetime-local" value={form.endAt} onChange={set('endAt')} /></label>
                <label>งบประมาณ (บาท)<input type="number" value={form.budget} onChange={set('budget')} /></label>
                <label>เป้าผู้เข้าร่วม (คน)<input type="number" value={form.targetAttendees} onChange={set('targetAttendees')} /></label>
                <label>แคมเปญที่เกี่ยวข้อง
                  <select value={form.campaignId} onChange={set('campaignId')}>
                    <option value="">-- ไม่ระบุ --</option>
                    {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label>สถานะ
                  <select value={form.status} onChange={set('status')}>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label>รายละเอียด<input value={form.description} onChange={set('description')} /></label>
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
                <button className="admin-btn-primary" onClick={save}>{editId ? 'บันทึกการแก้ไข' : 'เพิ่มงาน'}</button>
                {editId && <button className="admin-btn" onClick={cancel}>ยกเลิก</button>}
              </div>
              {/* แนบไฟล์ได้เฉพาะตอนแก้ของที่บันทึกแล้ว — ของใหม่ยังไม่มี id ให้ผูกไฟล์ */}
              {editId && (
                <div style={{ marginTop: 4 }}>
                  <FileAttachments entityType="event" entityId={editId} />
                </div>
              )}
            </div>

            <div className="admin-card-head" style={{ marginBottom: 12 }}>
              <h4>รายการงาน ({filtered.length})</h4>
              <input type="search" placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {loading ? <ListSkeleton /> : (
              <div className="admin-table-wrap" style={{ marginBottom: 20 }}>
                <table className="admin-table">
                  <thead><tr><th>ชื่องาน</th><th>วันเวลา</th><th>สถานที่</th><th>สถานะ</th><th></th></tr></thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr key={e.id}>
                        <td>{e.name}</td>
                        <td>{e.startAt ? new Date(e.startAt).toLocaleString('th-TH') : '—'}</td>
                        <td>{e.location || '—'}</td>
                        <td><span style={{ fontSize: '.78rem', padding: '2px 10px', borderRadius: 99, color: '#fff', background: STATUS_COLOR[e.status] || '#999' }}>{STATUS_LABEL[e.status] || e.status}</span></td>
                        <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button className="admin-btn" onClick={() => setOpenEventId(openEventId === e.id ? null : e.id)}>ผู้ลงทะเบียน</button>
                          <button className="admin-btn" onClick={() => edit(e)}>แก้ไข</button>
                          <button className="admin-btn-danger" onClick={() => remove(e)}>ลบ</button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีข้อมูล</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {openEvent && (
              <div className="admin-card">
                <div className="admin-card-head">
                  <h4>ผู้ลงทะเบียน — {openEvent.name} ({regs.length})</h4>
                  <button className="admin-btn" onClick={() => exportRegsCsv(openEvent.name)}>ส่งออก CSV</button>
                </div>
                <p style={{ color: 'var(--ink-soft)', fontSize: '.82rem', marginBottom: 10 }}>
                  หน้านี้ยังไม่มีฟอร์มลงทะเบียนสาธารณะ — Firestore rules อนุญาต create แบบสาธารณะไว้แล้ว (validEventReg)
                  รอทำหน้าฟอร์มแยกในรอบถัดไป ระหว่างนี้เพิ่มผู้ลงทะเบียนเองผ่าน Firebase Console ได้
                </p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>ชื่อ</th><th>เบอร์โทร</th><th>อีเมล</th><th>เช็คอิน</th><th></th></tr></thead>
                    <tbody>
                      {regs.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td>{r.phone}</td>
                          <td>{r.email || '—'}</td>
                          <td>{r.checkedIn ? '✓ เช็คอินแล้ว' : '—'}</td>
                          <td style={{ display: 'flex', gap: 8 }}>
                            <button className="admin-btn" onClick={() => toggleCheckIn(r)}>{r.checkedIn ? 'ยกเลิกเช็คอิน' : 'เช็คอิน'}</button>
                            <button className="admin-btn-danger" onClick={() => removeReg(r)}>ลบ</button>
                          </td>
                        </tr>
                      ))}
                      {regs.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีผู้ลงทะเบียน</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
