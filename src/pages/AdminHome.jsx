import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { db } from '../firebase.js'
import { doc, getDoc } from 'firebase/firestore'
import { ACCOUNTS } from '../data/accounts.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFlag, faCamera, faCow, faMoneyBill, faCalendar, faBagShopping, faHandshake, faGift, faEye, faChartBar } from '@fortawesome/free-solid-svg-icons'

const LINKS = [
  { href: '/admin/event/iftar2026', icon: faFlag, title: 'Iftar For Gaza', desc: 'รายชื่อผู้ลงทะเบียน + กราฟสรุปข้อมูลผู้เข้าร่วมงาน' },
  { href: '/admin/register-event', icon: faCamera, title: 'เช็คอินหน้างาน', desc: 'เปิดกล้องมือถือสแกน QR รหัส IFG เช็คอินผู้มาร่วมงาน' },
  { href: '/admin/missions/qurban2026', icon: faCow, title: 'Qurban 2026', desc: 'สรุปการแจกจ่ายกุรบาน 1447 / 2026 แยกตามประเทศ' },
  { href: '/admin/donations', icon: faMoneyBill, title: 'เงินบริจาค', desc: 'บันทึกและสรุปยอดบริจาคแยกตาม 7 บัญชี ibank' },
  { href: '/admin/calendar', icon: faCalendar, title: 'ปฏิทินคอนเทนต์', desc: 'วางแผนกิจกรรม ตั้งเวลาโพสต์ แนบรูป/วิดีโอ หลายแพลตฟอร์ม' },
  { href: '/admin/shop', icon: faBagShopping, title: 'Um Shop', desc: 'จัดการสินค้า เพิ่ม/แก้ไข/ลบ พร้อมค้นหา กรอง เรียงลำดับ' },
  { href: '/admin/volunteer', icon: faHandshake, title: 'อาสาสมัคร', desc: 'รายชื่อผู้สมัครอาสาสมัคร ค้นหา กรอง และ Export CSV' },
  { href: '/admin/give', icon: faGift, title: 'ส่งต่อของ', desc: 'รายการสิ่งของที่ผู้บริจาคลงทะเบียนมอบในงาน "ให้" ครั้งที่ 6' },
]

export default function AdminHome() {
  const { user, loading } = useAdminAuth()
  const [stats, setStats] = useState(null)
  const [siteViews, setSiteViews] = useState(null)

  useEffect(() => {
    if (!user) return
    getDoc(doc(db, 'stats', 'donation'))
      .then((snap) => { if (snap.exists()) setStats(snap.data()) })
      .catch(() => {})
    getDoc(doc(db, 'stats', 'site'))
      .then((snap) => { if (snap.exists()) setSiteViews(snap.data().views ?? 0) })
      .catch(() => {})
  }, [user])

  if (loading) return null
  if (!user) return <AdminLogin />

  const views = stats?.views ?? '—'
  const copies = stats?.copies ?? {}
  const totalCopies = Object.values(copies).reduce((s, v) => s + v, 0)

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">

        {/* ── ผู้เข้าชมเว็บไซต์ ── */}
        <div className="admin-card admin-visitors-card" style={{ marginBottom: 28 }}>
          <div className="admin-visitors-icon"><FontAwesomeIcon icon={faEye} /></div>
          <div>
            <div className="admin-visitors-num">
              {typeof siteViews === 'number' ? siteViews.toLocaleString() : '—'}
            </div>
            <div className="admin-visitors-label">ผู้เข้าชมเว็บไซต์ทั้งหมด</div>
            <div className="admin-visitors-sub">นับครั้งเดียวต่อการเข้าชม 1 ครั้ง (ไม่รวมหน้าแอดมิน)</div>
          </div>
        </div>

        {/* ── สถิติหน้าบริจาค ── */}
        <div className="admin-card" style={{ marginBottom: 28 }}>
          <div className="admin-card-head" style={{ marginBottom: 18 }}>
            <h4><FontAwesomeIcon icon={faChartBar} /> สถิติหน้า ร่วมบริจาค</h4>
          </div>
          <div className="admin-stats" style={{ marginBottom: 20 }}>
            <div className="admin-stat">
              <div className="v">{typeof views === 'number' ? views.toLocaleString() : views}</div>
              <div className="l">เข้าชมหน้าบริจาค</div>
            </div>
            <div className="admin-stat">
              <div className="v">{totalCopies > 0 ? totalCopies.toLocaleString() : '—'}</div>
              <div className="l">กดคัดลอกบัญชีทั้งหมด</div>
            </div>
            {typeof views === 'number' && views > 0 && totalCopies > 0 && (
              <div className="admin-stat">
                <div className="v">{Math.round((totalCopies / views) * 100)}%</div>
                <div className="l">อัตราการคัดลอก</div>
              </div>
            )}
          </div>

          {/* ตารางกดคัดลอกแยกบัญชี */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>บัญชี</th>
                  <th>เลขบัญชี</th>
                  <th style={{ textAlign: 'right' }}>กดคัดลอก</th>
                </tr>
              </thead>
              <tbody>
                {ACCOUNTS.map((a) => (
                  <tr key={a.key}>
                    <td>{a.icon} {a.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '.85rem' }}>{a.acc}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {copies[a.key] ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── เมนูแดชบอร์ด ── */}
        <div className="admin-grid">
          {LINKS.map((l) => (
            <a key={l.href} className="admin-card admin-link-card" href={l.href}>
              <div className="he" style={{ fontSize: '2rem', marginBottom: 10 }}><FontAwesomeIcon icon={l.icon} /></div>
              <h4>{l.title}</h4>
              <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', marginTop: 6 }}>{l.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
