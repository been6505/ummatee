import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import ListSkeleton from '../components/ListSkeleton.jsx'
import SuperAdminOnly from '../components/SuperAdminOnly.jsx'

// ประวัติการเปลี่ยนแปลง (/admin/audit-log) — เฉพาะ admin เท่านั้น อ่านอย่างเดียว ไล่จากใหม่ไปเก่า
// ⚠️ ข้อจำกัด: เขียนจาก client SDK คู่กับการแก้ข้อมูลจริง (ไม่ใช่ transaction ฝั่งเซิร์ฟเวอร์) — client ที่ตั้งใจ
// แฮ็กสามารถแก้ข้อมูลจริงสำเร็จโดยข้ามการเขียน log นี้ได้ ดูรายละเอียดใน src/lib/auditLog.js
const ENTITY_LABEL = { partnerOrganization: 'องค์กรพันธมิตร', aidLocation: 'จุดลงพื้นที่', speaker: 'วิทยากร', boardCard: 'การ์ดบอร์ด', staff: 'Staff' }

// เข้าได้เฉพาะแอดมินสูงสุดบัญชีเดียว (ตรงกับ isSuperAdmin() ใน firestore.rules)
// ซ่อนเมนูอย่างเดียวไม่พอ — คนอื่นพิมพ์ URL เข้ามาตรงๆ ได้ ต้องกันที่หน้าด้วย

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    const qy = query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'), limit(500))
    const unsub = onSnapshot(qy, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const filtered = useMemo(() => filterType === 'all' ? logs : logs.filter((l) => l.entityType === filterType), [logs, filterType])
  const types = useMemo(() => [...new Set(logs.map((l) => l.entityType))], [logs])

  const timeLabel = (ts) => {
    if (!ts) return ''
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <SuperAdminOnly>
      <main className="admin-dash">
        <AdminNav />
        <div className="admin-wrap">
          <div className="admin-head">
            <div><h1>ประวัติการเปลี่ยนแปลง (Audit Log)</h1><p>บันทึกทุกครั้งที่มีการแก้ไขข้อมูล CRM/บอร์ด/staff</p></div>
          </div>

          <div className="admin-card">
            <div className="admin-card-head">
              <h4>รายการ ({filtered.length})</h4>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">ทุกประเภท</option>
                {types.map((t) => <option key={t} value={t}>{ENTITY_LABEL[t] || t}</option>)}
              </select>
            </div>
            {loading ? <ListSkeleton /> : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>เวลา</th><th>ผู้ทำรายการ</th><th>การกระทำ</th><th>ประเภท</th><th>รายละเอียด</th></tr></thead>
                  <tbody>
                    {filtered.map((l) => (
                      <tr key={l.id}>
                        <td>{timeLabel(l.createdAt)}</td>
                        <td>{l.staffEmail}</td>
                        <td>{l.action}</td>
                        <td>{ENTITY_LABEL[l.entityType] || l.entityType}</td>
                        <td>{l.summary}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีประวัติ</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </SuperAdminOnly>
  )
}
