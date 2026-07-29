import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { auth } from '../firebase.js'
import { isFullAdminEmail, isSuperAdminEmail } from '../useAdminRole.js'
import { visibleStaffNav, flattenStaffNav } from '../data/staffNav.js'
import { hasStaffRole } from '../useStaffRole.js'

// แดชบอร์ดสรุปตาม role (/admin/staff-dashboard) — ชื่อไฟล์ AdminDashboard2 กันชนกับ AdminHome.jsx เดิม (หน้าแรกแอดมิน)
// social role: ข้าม stat ของ CRM/บอร์ด (ไม่มีสิทธิ์อยู่แล้วตาม firestore.rules) เหลือแค่ contentPosts (ถือเป็น
// ส่วน "โซเชียล/โพสต์" ของเว็บนี้ — โปรเจกต์นี้มี AdminCalendar.jsx ที่จัดการ contentPosts collection อยู่แล้ว)
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

function DashboardBody({ staff: staffProp }) {
  const staff = staffProp || {} // กัน null ไม่ให้ทั้งหน้าพัง ถ้า guard ปล่อยผ่านโดยยังไม่มี staff doc
  const canSeeCrm = hasStaffRole(staff, ['admin', 'staff', 'field'])
  // ทีมโซเชียลอ่าน contentPosts ได้แล้ว (ปฏิทินคอนเทนต์ย้ายมาอยู่เมนู staff) — เดิม role นี้เปิดแดชบอร์ด
  // มาแล้วเจอแค่ข้อความว่าไม่มีสิทธิ์ ไม่มีตัวเลขอะไรให้ดูเลยทั้งที่มีงานของตัวเองอยู่
  const canSeeContent = hasStaffRole(staff, ['admin', 'staff', 'social'])
  const posts = useCollectionCount('contentPosts', canSeeContent)
  // สถิติ CRM (พันธมิตร/จุดลงพื้นที่/วิทยากร/การ์ดบอร์ด) ถูกถอดออกจากหน้านี้แล้ว
  // จึงไม่เปิด onSnapshot ค้างไว้ทั้งสี่คอลเลกชัน — ดูตัวเลขเหล่านั้นได้ในหน้าของมันเอง
  const email = auth.currentUser?.email || ''
  const shortcuts = flattenStaffNav(
    visibleStaffNav(staff, { isOwner: isFullAdminEmail(email), isSuper: isSuperAdminEmail(email) })
  ).filter((s) => s.href !== '/admin/staff-dashboard' && s.group !== 'CRM')

  // สถานะโพสต์มีสองค่าจริงคือ draft กับ posted (ดู normStatus ใน AdminCalendar.jsx)
  // อะไรที่ยังไม่ใช่ posted ถือว่า "กำลังดำเนินการ" ทั้งหมด รวมโพสต์เก่าที่เคยเป็น 'scheduled'
  const postsPosted = posts.filter((p) => p.status === 'posted').length
  const postsInProgress = posts.length - postsPosted

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">
        <div className="admin-head">
          <div><h1>แดชบอร์ด Staff</h1><p>สรุปภาพรวมตามสิทธิ์ของบัญชี ({staff.role})</p></div>
        </div>

        {/* ตัวเลขคอนเทนต์อยู่บนสุด — เป็นสิ่งที่ทีมต้องเห็นก่อนทางลัดเมนู
            cols-3 บังคับ 3 คอลัมน์แถวเดียวและย่อฟอนต์/ระยะให้พอดีจอมือถือ */}
        {canSeeContent && (
          <div className="admin-stats cols-3">
            <div className="admin-stat"><div className="v">{posts.length}</div><div className="l">แผนคอนเทนต์ทั้งหมด</div></div>
            <div className="admin-stat"><div className="v">{postsInProgress}</div><div className="l">กำลังดำเนินการ</div></div>
            <div className="admin-stat"><div className="v">{postsPosted}</div><div className="l">โพสต์แล้ว</div></div>
          </div>
        )}

        {/* ทางลัดไปทุกหน้าที่บัญชีนี้เข้าได้ — ดึงจาก data/staffNav.js ตัวเดียวกับเมนูซ้าย
            เพิ่มเมนูใหม่ที่นั่นที่เดียวแล้วขึ้นทั้งสองที่ ไม่ต้องมาเพิ่มซ้ำจนหลุดกันทีหลัง
            ตัดหน้าแดชบอร์ดเองออก (กดแล้ววนอยู่ที่เดิม) และตัดกลุ่ม CRM ออกจากการ์ดทางลัด
            (ยังอยู่ในเมนูซ้ายตามเดิม) */}
        {shortcuts.length > 0 && (
          <div className="staff-shortcuts">
            {shortcuts.map((s) => (
              <a key={s.href} className="staff-shortcut" href={s.href}>
                <span className="staff-shortcut-icon"><FontAwesomeIcon icon={s.icon} /></span>
                <span className="staff-shortcut-label">
                  {s.label}
                  {s.group && <span className="staff-shortcut-group">{s.group}</span>}
                </span>
              </a>
            ))}
          </div>
        )}

        {!canSeeCrm && !canSeeContent && (
          <div className="admin-card"><p>บัญชี role "{staff.role}" ยังไม่มีสิทธิ์เข้าถึงข้อมูลส่วนไหนเลย — ติดต่อแอดมินเพื่อกำหนดสิทธิ์</p></div>
        )}
      </div>
    </main>
  )
}
