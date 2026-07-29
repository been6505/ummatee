import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase.js'
import AdminNav from '../components/AdminNav.jsx'
import StaffRoleGuard from '../components/StaffRoleGuard.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { auth } from '../firebase.js'
import { isFullAdminEmail, isSuperAdminEmail } from '../useAdminRole.js'
import { visibleStaffNav, flattenStaffNav } from '../data/staffNav.js'
import { backfillSearchIndex } from '../lib/searchBackfill.js'
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
  ).filter((s) => s.href !== '/admin/staff-dashboard')

  // สร้างดัชนีคำค้นให้ข้อมูลเก่า — ข้อมูลที่บันทึกหลังจากนี้ได้ดัชนีอัตโนมัติอยู่แล้ว
  // ปุ่มนี้มีไว้เติมให้ของที่สร้างไว้ก่อนมีฟีเจอร์ (กดซ้ำได้ ระบบข้ามรายการที่ดัชนีตรงอยู่แล้ว)
  const [indexing, setIndexing] = useState(false)
  const [indexResult, setIndexResult] = useState(null)
  const runBackfill = async () => {
    if (indexing) return
    setIndexing(true); setIndexResult(null)
    try { setIndexResult(await backfillSearchIndex(setIndexResult)) }
    catch (e) { window.alert('สร้างดัชนีไม่สำเร็จ: ' + e.message) }
    finally { setIndexing(false) }
  }

  const soon = new Date(); soon.setDate(soon.getDate() + 7)
  // โพสต์ที่ยังไม่ได้โพสต์และถึงกำหนดภายใน 7 วัน — ตัวเลขที่ทีมโซเชียลต้องรีบเห็นที่สุด
  const soonKey = soon.toISOString().slice(0, 10)
  const todayKey = new Date().toISOString().slice(0, 10)
  const postsDueSoon = posts.filter((p) => p.status !== 'posted' && p.date && p.date >= todayKey && p.date <= soonKey).length
  const postsWaiting = posts.filter((p) => p.approvalStatus === 'pending').length

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
            <div className="admin-stat"><div className="v">{postsDueSoon}</div><div className="l">ถึงกำหนดโพสต์ใน 7 วัน</div></div>
            <div className="admin-stat"><div className="v">{postsWaiting}</div><div className="l">รออนุมัติ</div></div>
          </div>
        )}

        {/* ทางลัดไปทุกหน้าที่บัญชีนี้เข้าได้ — ดึงจาก data/staffNav.js ตัวเดียวกับเมนูซ้าย
            เพิ่มเมนูใหม่ที่นั่นที่เดียวแล้วขึ้นทั้งสองที่ ไม่ต้องมาเพิ่มซ้ำจนหลุดกันทีหลัง
            ตัดหน้าแดชบอร์ดเองออก (กดแล้ววนอยู่ที่เดิม) และแผ่กลุ่ม CRM ออกเป็นรายการเดี่ยว */}
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

        {/* เครื่องมือดัชนีค้นหา — ให้เฉพาะ role admin เพราะเป็นการเขียนทับข้อมูลหลาย collection พร้อมกัน */}
        {hasStaffRole(staff, ['admin']) && (
          <div className="admin-card" style={{ marginBottom: 20 }}>
            <h4>ดัชนีค้นหา</h4>
            <p style={{ color: 'var(--ink-soft)', fontSize: '.85rem', marginBottom: 12, lineHeight: 1.7 }}>
              ช่องค้นหาด้านบนหาเจอแม้พิมพ์คำที่อยู่กลางชื่อ (เช่น "ขนนก" เจอ "เสื้อลายขนนก")
              ข้อมูลที่บันทึกใหม่ได้ดัชนีอัตโนมัติ — กดปุ่มนี้เพื่อเติมให้ข้อมูลที่สร้างไว้ก่อนหน้า
              (กดซ้ำได้ ระบบข้ามรายการที่ดัชนีตรงอยู่แล้ว)
            </p>
            <button className="admin-btn-primary" onClick={runBackfill} disabled={indexing}>
              {indexing ? 'กำลังสร้างดัชนี...' : 'สร้าง/อัปเดตดัชนีค้นหา'}
            </button>
            {indexResult && (
              <div className="admin-table-wrap" style={{ marginTop: 14 }}>
                <table className="admin-table">
                  <thead><tr><th>ข้อมูล</th><th style={{ textAlign: 'right' }}>ทั้งหมด</th><th style={{ textAlign: 'right' }}>อัปเดต</th><th style={{ textAlign: 'right' }}>ข้าม</th><th></th></tr></thead>
                  <tbody>
                    {indexResult.map((r) => (
                      <tr key={r.col}>
                        <td>{r.label}</td>
                        <td style={{ textAlign: 'right' }}>{r.total}</td>
                        <td style={{ textAlign: 'right' }}>{r.updated}</td>
                        <td style={{ textAlign: 'right', color: 'var(--ink-soft)' }}>{r.skipped}</td>
                        <td style={{ color: '#c0392b', fontSize: '.82rem' }}>{r.error || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!canSeeCrm && !canSeeContent && (
          <div className="admin-card"><p>บัญชี role "{staff.role}" ยังไม่มีสิทธิ์เข้าถึงข้อมูลส่วนไหนเลย — ติดต่อแอดมินเพื่อกำหนดสิทธิ์</p></div>
        )}
      </div>
    </main>
  )
}
