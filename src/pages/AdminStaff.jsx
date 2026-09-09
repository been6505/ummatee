import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import { writeAuditLog } from '../lib/auditLog.js'
import ListSkeleton from '../components/ListSkeleton.jsx'
import SuperAdminOnly from '../components/SuperAdminOnly.jsx'
import { syncStaffDirectory } from '../data/staffDirectory.js'

// จัดการบัญชี staff (/admin/staff) — เฉพาะ admin เท่านั้น เปลี่ยน role/active ได้
// ไม่มีปุ่ม "เพิ่ม staff" ตรงนี้ เพราะบัญชีสมัครตัวเองอัตโนมัติตอนล็อกอินครั้งแรก แต่ได้ role 'pending'
// ที่ยังไม่มีสิทธิ์อะไรเลย (ดู src/useStaffRole.js) — แอดมินต้องมาเลื่อน role ให้ที่หน้านี้ก่อนถึงใช้งานได้
const ROLES = ['pending', 'admin', 'staff', 'social', 'field']
const ROLE_LABEL = { pending: 'รออนุมัติ (ยังเข้าใช้ไม่ได้)', admin: 'แอดมิน', staff: 'พนักงาน', social: 'ทีมโซเชียล', field: 'ทีมภาคสนาม' }

// เข้าได้เฉพาะแอดมินสูงสุดบัญชีเดียว (ตรงกับ isSuperAdmin() ใน firestore.rules)
// ซ่อนเมนูอย่างเดียวไม่พอ — คนอื่นพิมพ์ URL เข้ามาตรงๆ ได้ ต้องกันที่หน้าด้วย

export default function AdminStaff() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const qy = query(collection(db, 'staff'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(qy, (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  // สมุดรายชื่อ (staffDirectory) เป็นสำเนาย่อของ staff/ ที่ทีมงานทั่วไปอ่านได้ ไว้ให้เลือกผู้รับผิดชอบงาน
  // ต้องซิงก์ทุกครั้งที่ role/active เปลี่ยน ไม่งั้นคนที่เพิ่งถูกอนุมัติจะยังไม่โผล่ในช่องเลือก
  // และคนที่เพิ่งถูกปิดใช้งานจะยังถูกมอบหมายงานได้อยู่ (ไม่มี Cloud Functions จึงซิงก์จากหน้านี้)
  const [syncing, setSyncing] = useState('')
  const resync = async (nextList) => {
    setSyncing('กำลังอัปเดตสมุดรายชื่อ…')
    try {
      const n = await syncStaffDirectory(nextList)
      setSyncing(`อัปเดตสมุดรายชื่อแล้ว (${n} คน)`)
    } catch (e) {
      setSyncing('อัปเดตสมุดรายชื่อไม่สำเร็จ: ' + e.message)
    }
  }

  const setRole = async (s, role) => {
    if (role === s.role) return
    if (!window.confirm(`เปลี่ยน role ของ ${s.email} เป็น "${ROLE_LABEL[role]}"?`)) return
    await updateDoc(doc(db, 'staff', s.id), { role })
    writeAuditLog({ action: 'update', entityType: 'staff', entityId: s.id, summary: `เปลี่ยน role ${s.email} เป็น ${role}` })
    // ใช้ค่าที่เพิ่งตั้ง ไม่รอ snapshot รอบถัดไป — ไม่งั้นซิงก์ด้วยข้อมูลเก่าไปหนึ่งรอบ
    await resync(list.map((x) => (x.id === s.id ? { ...x, role } : x)))
  }

  const toggleActive = async (s) => {
    const active = !s.active
    await updateDoc(doc(db, 'staff', s.id), { active })
    writeAuditLog({ action: 'update', entityType: 'staff', entityId: s.id, summary: `${s.active ? 'ปิด' : 'เปิด'}ใช้งาน ${s.email}` })
    await resync(list.map((x) => (x.id === s.id ? { ...x, active } : x)))
  }

  return (
    <SuperAdminOnly>
      <main className="admin-dash">
        <AdminNav />
        <div className="admin-wrap">
          <div className="admin-head">
            <div>
              <h1>จัดการ Staff</h1>
              <p>ดู/ปรับ role และเปิดปิดใช้งานบัญชี staff ที่ล็อกอินเข้ามาแล้ว</p>
            </div>
            {/* ปุ่มซิงก์ด้วยมือ — ปกติซิงก์เองทุกครั้งที่เปลี่ยน role/สถานะอยู่แล้ว ปุ่มนี้ไว้กู้กรณีซิงก์รอบก่อนล้ม
                (เช่นเน็ตหลุดกลางคัน) ซึ่งจะทำให้ช่องเลือกผู้รับผิดชอบไม่ตรงกับรายชื่อทีมจริง */}
            <div style={{ textAlign: 'right' }}>
              <button className="admin-btn" onClick={() => resync(list)} disabled={loading}>
                อัปเดตสมุดรายชื่อทีม
              </button>
              {syncing && <p style={{ fontSize: '.82rem', color: 'var(--ink-soft)', margin: '6px 0 0' }}>{syncing}</p>}
            </div>
          </div>

          {loading ? <ListSkeleton /> : (
            <div className="admin-card">
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>อีเมล</th><th>ชื่อ</th><th>Role</th><th>สถานะ</th><th></th></tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.id} className={s.role === 'pending' ? 'staff-pending-row' : ''}>
                        <td>{s.email}{s.role === 'pending' && <span className="staff-pending-tag">รออนุมัติ</span>}</td>
                        <td>{s.name || '—'}</td>
                        <td>
                          <select value={s.role} onChange={(e) => setRole(s, e.target.value)}>
                            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          </select>
                        </td>
                        <td>{s.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</td>
                        <td>
                          <button className={s.active ? 'admin-btn-danger' : 'admin-btn-primary'} onClick={() => toggleActive(s)}>
                            {s.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {list.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#999' }}>ยังไม่มีใครล็อกอินเข้าระบบ staff เลย</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </SuperAdminOnly>
  )
}
