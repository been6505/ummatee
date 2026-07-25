import { useEffect, useState } from 'react'
import AdminNav from '../components/AdminNav.jsx'
import AdminLogin from '../components/AdminLogin.jsx'
import useAdminAuth from '../useAdminAuth.js'
import { db } from '../firebase.js'
import { doc, onSnapshot } from 'firebase/firestore'
import { ACCOUNTS } from '../data/accounts.js'
import { isVolunteerEmail } from '../useAdminRole.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFlag, faCamera, faCow, faMoneyBill, faCalendar, faBagShopping, faHandshake, faGift, faEye, faChartBar, faGlobe, faComments } from '@fortawesome/free-solid-svg-icons'

const ALL_LINKS = [
  { href: '/admin/website', icon: faGlobe, title: 'จัดการเว็บ', desc: 'แบนเนอร์/ประกาศที่แสดงบนหน้าแรกของเว็บฝั่ง public' },
  { href: '/admin/chat', icon: faComments, title: 'แชท', desc: 'ตอบแชทจากผู้เยี่ยมชมเว็บไซต์ พร้อมแจ้งเตือนทาง LINE เมื่อมีข้อความใหม่' },
  { href: '/admin/event/iftar2026', icon: faFlag, title: 'Iftar For Gaza', desc: 'รายชื่อผู้ลงทะเบียน + กราฟสรุปข้อมูลผู้เข้าร่วมงาน', volunteer: true },
  { href: '/admin/qrcode', icon: faCamera, title: 'เช็คอินหน้างาน', desc: 'เปิดกล้องมือถือสแกน QR รหัส IFG เช็คอินผู้มาร่วมงาน', volunteer: true },
  { href: '/admin/give', icon: faGift, title: 'ส่งต่อของ', desc: 'รายการสิ่งของที่ผู้บริจาคลงทะเบียนมอบในงาน "ให้" ครั้งที่ 6', volunteer: true },
  { href: '/admin/missions/qurban2026', icon: faCow, title: 'Qurban 2026', desc: 'สรุปการแจกจ่ายกุรบาน 1447 / 2026 แยกตามประเทศ' },
  { href: '/admin/donations', icon: faMoneyBill, title: 'เงินบริจาค', desc: 'บันทึกและสรุปยอดบริจาคแยกตาม 7 บัญชี ibank' },
  { href: '/admin/calendar', icon: faCalendar, title: 'ปฏิทินคอนเทนต์', desc: 'วางแผนกิจกรรม ตั้งเวลาโพสต์ แนบรูป/วิดีโอ หลายแพลตฟอร์ม' },
  { href: '/admin/shop', icon: faBagShopping, title: 'Um Shop', desc: 'จัดการสินค้า เพิ่ม/แก้ไข/ลบ พร้อมค้นหา กรอง เรียงลำดับ' },
  { href: '/admin/volunteer', icon: faHandshake, title: 'อาสาสมัคร', desc: 'รายชื่อผู้สมัครอาสาสมัคร ค้นหา กรอง และ Export CSV' },
]

export default function AdminHome() {
  const { user, loading } = useAdminAuth()
  const [stats, setStats] = useState(null)
  const [siteViews, setSiteViews] = useState(null)
  const [iftarCopies, setIftarCopies] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(false)

  // ใช้ onSnapshot แทน getDoc ครั้งเดียว — เดิมโหลดครั้งเดียวตอน mount ถ้าเปิดหน้านี้ค้างไว้แล้วมีคนกดคัดลอก/เข้าชม
  // ที่หน้าอื่น ตัวเลขจะไม่ขยับจนกว่าจะรีเฟรชเอง ดูเหมือนสถิติไม่เพิ่มทั้งที่จริงมีข้อมูลใหม่เข้ามาแล้ว
  useEffect(() => {
    if (!user) return
    let loadedCount = 0
    const markLoaded = () => { loadedCount++; if (loadedCount >= 3) setStatsLoading(false) }
    const onErr = (e) => { console.error('AdminHome stats subscribe failed:', e.code || e.message); setStatsError(true); markLoaded() }

    const unsub1 = onSnapshot(doc(db, 'stats', 'donation'), (snap) => { setStats(snap.exists() ? snap.data() : {}); markLoaded() }, onErr)
    const unsub2 = onSnapshot(doc(db, 'stats', 'site'), (snap) => { setSiteViews(snap.exists() ? snap.data().views ?? 0 : 0); markLoaded() }, onErr)
    const unsub3 = onSnapshot(doc(db, 'stats', 'iftar'), (snap) => { setIftarCopies(snap.exists() ? snap.data().copies ?? 0 : 0); markLoaded() }, onErr)

    return () => { unsub1(); unsub2(); unsub3() }
  }, [user])

  if (loading) return null
  if (!user) return <AdminLogin />

  const isVolunteer = isVolunteerEmail(user.email)
  const LINKS = isVolunteer ? ALL_LINKS.filter((l) => l.volunteer) : ALL_LINKS

  // ป้องกันค่าที่ไม่ใช่ตัวเลข (data เพี้ยนจากการแก้ doc มือ) ไม่ให้ทำให้ผลรวมกลายเป็น NaN แล้วสถิติหายเงียบๆ
  const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const views = toNum(stats?.views)
  const copies = stats?.copies ?? {}
  // ยอดคัดลอกบัญชีปาเลสไตน์ มาจาก 2 หน้า (Donation + Iftar For Gaza) ที่เก็บสถิติแยก doc กัน — รวมเป็นค่าเดียวตรงนี้
  const iftarPalestine = toNum(iftarCopies)
  const totalCopies = Object.values(copies).reduce((s, v) => s + toNum(v), 0) + iftarPalestine

  return (
    <main className="admin-dash">
      <AdminNav />
      <div className="admin-wrap">

        {/* ── ผู้เข้าชมเว็บไซต์ ── */}
        {!isVolunteer && (
          <div className="admin-card admin-visitors-card" style={{ marginBottom: 28 }}>
            <div className="admin-visitors-icon"><FontAwesomeIcon icon={faEye} /></div>
            <div>
              <div className="admin-visitors-num">{typeof siteViews === 'number' ? siteViews.toLocaleString() : '—'}</div>
              <div className="admin-visitors-label">ผู้เข้าชมเว็บไซต์ทั้งหมด</div>
              <div className="admin-visitors-sub">นับครั้งเดียวต่อการเข้าชม 1 ครั้ง (ไม่รวมหน้าแอดมิน)</div>
            </div>
          </div>
        )}

        {/* ── สถิติหน้าบริจาค ── */}
        {!isVolunteer && (
          <div className="admin-card" style={{ marginBottom: 28 }}>
            <div className="admin-card-head" style={{ marginBottom: 18 }}>
              <h4><FontAwesomeIcon icon={faChartBar} /> สถิติหน้า ร่วมบริจาค</h4>
            </div>

            {statsError && (
              <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '.88rem' }}>
                ⚠️ โหลดสถิติไม่ได้ — กรุณาลองรีเฟรชหน้าใหม่
              </div>
            )}

            <div className="admin-stats" style={{ marginBottom: 20 }}>
              <div className="admin-stat">
                <div className="v">{statsLoading ? '…' : views.toLocaleString()}</div>
                <div className="l">เข้าชมหน้าบริจาค</div>
              </div>
              <div className="admin-stat">
                <div className="v">{statsLoading ? '…' : totalCopies.toLocaleString()}</div>
                <div className="l">กดคัดลอกบัญชีทั้งหมด</div>
              </div>
              {!statsLoading && views > 0 && (
                <div className="admin-stat">
                  <div className="v">{(totalCopies / views).toFixed(2)}</div>
                  {/* ไม่ใช่ % ผู้เข้าชมที่คัดลอก — 1 คนกดคัดลอกได้หลายบัญชี ค่านี้จึงเป็นค่าเฉลี่ยครั้งต่อการเข้าชม เกิน 1 ได้ปกติ */}
                  <div className="l">คัดลอกเฉลี่ยต่อการเข้าชม (ครั้ง)</div>
                </div>
              )}
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>บัญชี</th><th>เลขบัญชี</th><th style={{ textAlign: 'right' }}>กดคัดลอก</th></tr>
                </thead>
                <tbody>
                  {ACCOUNTS.map((a) => (
                    <tr key={a.key}>
                      <td>{a.icon} {a.name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.85rem' }}>{a.acc}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {statsLoading ? '…' : toNum(copies[a.key]) + (a.key === 'palestine' ? iftarPalestine : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
