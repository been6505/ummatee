import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { hasStaffRole } from '../useStaffRole.js'

// แดชบอร์ดสรุปตาม role (/admin/staff-dashboard) — ชื่อไฟล์ AdminDashboard2 กันชนกับ AdminHome.jsx เดิม (หน้าแรกแอดมิน)
// social role: ข้าม stat ของ CRM/บอร์ด (ไม่มีสิทธิ์อยู่แล้วตาม firestore.rules) เหลือแค่ contentPosts (ถือเป็น
// ส่วน "โซเชียล/โพสต์" ของเว็บนี้ — โปรเจกต์นี้มี AdminCalendar.jsx ที่จัดการ contentPosts collection อยู่แล้ว)
const THB = (n) => '฿' + Number(n || 0).toLocaleString('th-TH')

function useCollectionCount(name, enabled) {
  const [docs, setDocs] = useState([])
  useEffect(() => {
    if (!enabled) return
    const unsub = onSnapshot(collection(db, name), (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {})
    return unsub
  }, [enabled])
  return docs
}

export default function AdminDashboard2() {
  return (
    <StaffRoleGuard allowedRoles={['admin', 'staff', 'social', 'field']}>
      {(staff) => <DashboardBody staff={staff} />}
    </StaffRoleGuard>
  )
}

function DashboardBody({ staff }) {
  const canSeeCrm = hasStaffRole(staff, ['admin', 'staff', 'field'])
  const partners = useCollectionCount('partnerOrganizations', canSeeCrm)
  const aidLocations = useCollectionCount('aidLocations', canSeeCrm)
  const speakers = useCollectionCount('speakers', canSeeCrm)
  const cards = useCollectionCount('boardCards', canSeeCrm)

  const peopleHelped = aidLocations.reduce((s, l) => s + (Number(l.peopleHelped) || 0), 0)
  const itemsDonated = aidLocations.reduce((s, l) => s + (Number(l.itemsDonatedCount) || 0), 0)
  const totalPaid = speakers.reduce((s, sp) => s + (Number(sp.totalPaid) || 0), 0)
  const soon = new Date(); soon.setDate(soon.getDate() + 7)
  const dueSoon = cards.filter((c) => c.dueDate && new Date(c.dueDate) <= soon).length

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div><h1>แดชบอร์ด Staff</h1><p>สรุปภาพรวมตามสิทธิ์ของบัญชี ({staff.role})</p></div>
        </div>

        {!canSeeCrm ? (
          <div className="admin-card"><p>บัญชี role "{staff.role}" ไม่มีสิทธิ์เข้าถึงข้อมูล CRM/บอร์ด — ดูข้อมูลโซเชียล/คอนเทนต์ได้ที่เมนู "ปฏิทิน"</p></div>
        ) : (
          <div className="admin-stats">
            <div className="admin-stat"><div className="v">{partners.length}</div><div className="l">องค์กรพันธมิตร</div></div>
            <div className="admin-stat"><div className="v">{peopleHelped.toLocaleString('th-TH')}</div><div className="l">คนที่ช่วยรวม</div></div>
            <div className="admin-stat"><div className="v">{itemsDonated.toLocaleString('th-TH')}</div><div className="l">ของบริจาครวม</div></div>
            <div className="admin-stat"><div className="v">{speakers.length}</div><div className="l">วิทยากร/อินฟลูเอนเซอร์</div></div>
            <div className="admin-stat"><div className="v">{THB(totalPaid)}</div><div className="l">ค่าตอบแทนวิทยากรรวม</div></div>
            <div className="admin-stat"><div className="v">{dueSoon}</div><div className="l">การ์ดใกล้ครบกำหนด (7 วัน)</div></div>
          </div>
        )}
      </div>
    </main>
  )
}
