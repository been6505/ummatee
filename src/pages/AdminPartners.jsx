import { useEffect, useMemo, useState } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { writeAuditLog } from '../lib/auditLog.js'
import { downloadCsv } from '../lib/csv.js'

// องค์กรพันธมิตร (/admin/partners) — CRM พื้นฐาน มิเรอร์จากเวอร์ชัน Next.js (PartnerOrganization model)
// partnerType: 'organization' (ค่าเริ่มต้น รวมของเก่าที่ไม่มี field นี้) | 'store' (ร้านค้าที่ผูกกับแคมเปญได้ที่ /admin/campaigns)
const EMPTY = { name: '', country: '', isInternational: false, type: '', contactName: '', contactPhone: '', contactEmail: '', website: '', notes: '', partnerType: 'organization' }

export default function AdminPartners() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const qy = query(collection(db, 'partnerOrganizations'), orderBy('name'))
    const unsub = onSnapshot(qy, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    if (!s) return list
    return list.filter((p) => [p.name, p.country, p.type, p.contactName].some((x) => (x || '').toLowerCase().includes(s)))
  }, [list, search])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const save = async () => {
    if (!form.name.trim()) { window.alert('กรอกชื่อองค์กร'); return }
    if (editId) {
      await updateDoc(doc(db, 'partnerOrganizations', editId), { ...form, updatedAt: serverTimestamp() })
      writeAuditLog({ action: 'update', entityType: 'partnerOrganization', entityId: editId, summary: `แก้ไของค์กร ${form.name}` })
    } else {
      const ref = await addDoc(collection(db, 'partnerOrganizations'), { ...form, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      writeAuditLog({ action: 'create', entityType: 'partnerOrganization', entityId: ref.id, summary: `เพิ่มองค์กร ${form.name}` })
    }
    setForm(EMPTY); setEditId(null)
  }

  const edit = (p) => { setEditId(p.id); setForm({ ...EMPTY, ...p, partnerType: p.partnerType || 'organization' }) }
  const cancel = () => { setEditId(null); setForm(EMPTY) }

  const remove = async (p) => {
    if (!window.confirm(`ลบ "${p.name}" ถาวร?`)) return
    await deleteDoc(doc(db, 'partnerOrganizations', p.id))
    writeAuditLog({ action: 'delete', entityType: 'partnerOrganization', entityId: p.id, summary: `ลบองค์กร ${p.name}` })
  }

  const exportCsv = () => {
    downloadCsv('partner-organizations.csv',
      ['ชื่อ', 'ประเภทพันธมิตร', 'ประเทศ', 'ต่างประเทศ', 'ประเภท', 'ผู้ติดต่อ', 'เบอร์โทร', 'อีเมล', 'เว็บไซต์', 'หมายเหตุ'],
      filtered.map((p) => [p.name, (p.partnerType || 'organization') === 'store' ? 'ร้านค้า' : 'องค์กร', p.country, p.isInternational ? 'ใช่' : 'ไม่', p.type, p.contactName, p.contactPhone, p.contactEmail, p.website, p.notes])
    )
  }

  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'field']}>
      {() => (
        <main className="admin-dash">
          <AdminNav />
          <div className="admin-wrap">
            <div className="admin-head">
              <div><h1>องค์กรพันธมิตร</h1><p>รายชื่อองค์กร/เครือข่ายพันธมิตรที่ทำงานร่วมกัน</p></div>
              <button className="admin-btn" onClick={exportCsv}>ส่งออก CSV</button>
            </div>

            <div className="admin-card" style={{ marginBottom: 20 }}>
              <h4>{editId ? 'แก้ไของค์กร' : 'เพิ่มองค์กรใหม่'}</h4>
              <div className="admin-form-grid">
                <label>ชื่อองค์กร<input value={form.name} onChange={set('name')} /></label>
                <label>ประเภทพันธมิตร
                  <select value={form.partnerType || 'organization'} onChange={set('partnerType')}>
                    <option value="organization">องค์กร</option>
                    <option value="store">ร้านค้า (ผูกกับแคมเปญได้)</option>
                  </select>
                </label>
                <label>ประเทศ<input value={form.country} onChange={set('country')} /></label>
                <label>ประเภท<input value={form.type} onChange={set('type')} placeholder="NGO, มูลนิธิ, ฯลฯ" /></label>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, display: 'flex' }}>
                  <input type="checkbox" checked={!!form.isInternational} onChange={set('isInternational')} /> องค์กรต่างประเทศ
                </label>
                <label>ผู้ติดต่อ<input value={form.contactName} onChange={set('contactName')} /></label>
                <label>เบอร์โทร<input value={form.contactPhone} onChange={set('contactPhone')} /></label>
                <label>อีเมล<input value={form.contactEmail} onChange={set('contactEmail')} /></label>
                <label>เว็บไซต์<input value={form.website} onChange={set('website')} /></label>
                <label>หมายเหตุ<input value={form.notes} onChange={set('notes')} /></label>
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
                <button className="admin-btn-primary" onClick={save}>{editId ? 'บันทึกการแก้ไข' : 'เพิ่มองค์กร'}</button>
                {editId && <button className="admin-btn" onClick={cancel}>ยกเลิก</button>}
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-card-head">
                <h4>รายชื่อองค์กร ({filtered.length})</h4>
                <input type="search" placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {loading ? <p>กำลังโหลดข้อมูล...</p> : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>ชื่อ</th><th>ประเภทพันธมิตร</th><th>ประเทศ</th><th>ประเภท</th><th>ผู้ติดต่อ</th><th></th></tr></thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{(p.partnerType || 'organization') === 'store' ? 'ร้านค้า' : 'องค์กร'}</td>
                          <td>{p.country}{p.isInternational ? ' (ต่างประเทศ)' : ''}</td>
                          <td>{p.type || '—'}</td>
                          <td>{p.contactName || '—'}</td>
                          <td style={{ display: 'flex', gap: 8 }}>
                            <button className="admin-btn" onClick={() => edit(p)}>แก้ไข</button>
                            <button className="admin-btn-danger" onClick={() => remove(p)}>ลบ</button>
                          </td>
                        </tr>
                      ))}
                      {filtered.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีข้อมูล</td></tr>}
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
