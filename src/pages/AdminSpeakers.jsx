import { useEffect, useMemo, useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { writeAuditLog } from '../lib/auditLog.js'
import { withSearchTokens } from '../lib/searchIndex.js'

import ExportButtons from '../components/ExportButtons.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
// ฟิลด์ที่เอาไปสร้างดัชนีคำค้น — ต้องตรงกับ SEARCH_COLLECTIONS ใน lib/searchIndex.js
const SEARCH_FIELDS = ['name', 'type']

// วิทยากร/อินฟลูเอนเซอร์ (/admin/speakers) — มิเรอร์จากเวอร์ชัน Next.js (Speaker model)
const EMPTY = { name: '', type: 'speaker', regionsWorked: '', totalPaid: '', contactInfo: '', notes: '' }
const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

export default function AdminSpeakers() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const qy = query(collection(db, 'speakers'), orderBy('name'))
    const unsub = onSnapshot(qy, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return list
    return list.filter((p) => [p.name, p.contactInfo].some((x) => (x || '').toLowerCase().includes(s)))
  }, [list, search])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.name.trim()) { window.alert('กรอกชื่อ'); return }
    const payload = {
      name: form.name, type: form.type,
      regionsWorked: form.regionsWorked.split(',').map((s) => s.trim()).filter(Boolean),
      totalPaid: Number(form.totalPaid) || 0,
      contactInfo: form.contactInfo, notes: form.notes,
    }
    if (editId) {
      await updateDoc(doc(db, 'speakers', editId), withSearchTokens({ ...payload, updatedAt: serverTimestamp() }, SEARCH_FIELDS))
      writeAuditLog({ action: 'update', entityType: 'speaker', entityId: editId, summary: `แก้ไขวิทยากร ${form.name}` })
    } else {
      const ref = await addDoc(collection(db, 'speakers'), withSearchTokens({ ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, SEARCH_FIELDS))
      writeAuditLog({ action: 'create', entityType: 'speaker', entityId: ref.id, summary: `เพิ่มวิทยากร ${form.name}` })
    }
    setForm(EMPTY); setEditId(null)
  }

  const edit = (p) => { setEditId(p.id); setForm({ ...EMPTY, ...p, regionsWorked: (p.regionsWorked || []).join(', '), totalPaid: String(p.totalPaid ?? '') }) }
  const cancel = () => { setEditId(null); setForm(EMPTY) }

  const remove = async (p) => {
    if (!window.confirm(`ลบ "${p.name}" ถาวร?`)) return
    await deleteDoc(doc(db, 'speakers', p.id))
    writeAuditLog({ action: 'delete', entityType: 'speaker', entityId: p.id, summary: `ลบวิทยากร ${p.name}` })
  }

  // สร้างชุดข้อมูลครั้งเดียว ใช้ได้ทั้งดาวน์โหลด CSV และส่งเข้า Google Sheets (ดู ExportButtons.jsx)
  const buildExport = () => ({
    filename: 'speakers.csv',
    sheetName: 'วิทยากร',
    headers: ['ชื่อ', 'ประเภท', 'พื้นที่ทำงาน', 'ค่าตอบแทนรวม', 'ติดต่อ', 'หมายเหตุ'],
    rows: filtered.map((p) => [p.name, p.type, (p.regionsWorked || []).join('; '), p.totalPaid || 0, p.contactInfo, p.notes]),
  })

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'field']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div><h1>วิทยากร / อินฟลูเอนเซอร์</h1><p>รายชื่อวิทยากรและอินฟลูเอนเซอร์ที่เคยร่วมงาน</p></div>
              <ExportButtons build={buildExport} />
            </div>

            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>{editId ? 'แก้ไขวิทยากร' : 'เพิ่มวิทยากรใหม่'}</h4>
              <div className="admin-form-grid">
                <label>ชื่อ<input value={form.name} onChange={set('name')} /></label>
                <label>ประเภท
                  <select value={form.type} onChange={set('type')}>
                    <option value="speaker">วิทยากร</option>
                    <option value="influencer">อินฟลูเอนเซอร์</option>
                  </select>
                </label>
                <label>พื้นที่ทำงาน (คั่นด้วย ,)<input value={form.regionsWorked} onChange={set('regionsWorked')} /></label>
                <label>ค่าตอบแทนรวม (บาท)<input type="number" value={form.totalPaid} onChange={set('totalPaid')} /></label>
                <label>ช่องทางติดต่อ<input value={form.contactInfo} onChange={set('contactInfo')} /></label>
                <label>หมายเหตุ<input value={form.notes} onChange={set('notes')} /></label>
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
                <button className="admin-btn-primary" onClick={save}>{editId ? 'บันทึกการแก้ไข' : 'เพิ่มวิทยากร'}</button>
                {editId && <button className="admin-btn" onClick={cancel}>ยกเลิก</button>}
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-head">
                <h4>รายชื่อ ({filtered.length})</h4>
                <input type="search" placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {loading ? <ListSkeleton /> : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>ชื่อ</th><th>ประเภท</th><th>พื้นที่</th><th>ค่าตอบแทนรวม</th><th></th></tr></thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{p.type === 'influencer' ? 'อินฟลูเอนเซอร์' : 'วิทยากร'}</td>
                          <td>{(p.regionsWorked || []).join(', ') || '—'}</td>
                          <td>{THB(p.totalPaid)}</td>
                          <td style={{ display: 'flex', gap: 8 }}>
                            <button className="admin-btn" onClick={() => edit(p)}>แก้ไข</button>
                            <button className="admin-btn-danger" onClick={() => remove(p)}>ลบ</button>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีข้อมูล</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      )}
    </StaffRoleGuard>
  )
}
