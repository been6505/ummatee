import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHouse, faFlag, faCamera, faCow, faMoneyBill, faCalendar, faBagShopping, faChartBar, faHandshake, faGift, faBars, faXmark, faScrewdriverWrench, faEarthAsia } from '@fortawesome/free-solid-svg-icons'

const LINKS = [
  { href: '/admin/dashboard', icon: faHouse, label: 'หน้าหลัก' },
  { href: '/admin/event/iftar2026', icon: faFlag, label: 'Iftar For Gaza' },
  { href: '/admin/register-event', icon: faCamera, label: 'เช็คอินหน้างาน' },
  { href: '/admin/missions/qurban2026', icon: faCow, label: 'Qurban 2026' },
  { href: '/admin/donations', icon: faMoneyBill, label: 'เงินบริจาค' },
  { href: '/admin/calendar', icon: faCalendar, label: 'ปฏิทิน' },
  { href: '/admin/shop', icon: faBagShopping, label: 'Um Shop' },
  { href: '/admin/financial-dashboard', icon: faChartBar, label: 'แดชบอร์ดการเงิน' },
  { href: '/admin/volunteer', icon: faHandshake, label: 'อาสาสมัคร' },
  { href: '/admin/give', icon: faGift, label: 'ส่งต่อของ' },
  { href: '/admin/missions', icon: faEarthAsia, label: 'ภารกิจ' },
]

export default function AdminNav() {
  const path = window.location.pathname
  const [open, setOpen] = useState(false)

  const logout = () => {
    signOut(auth)
  }

  return (
    <>
      <nav className="admin-nav">
        <div className="admin-nav-brand">
          <FontAwesomeIcon icon={faScrewdriverWrench} /> Admin
        </div>

        {/* Desktop Menu */}
        <div className="admin-nav-links">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={path === l.href ? 'active' : ''}
            >
              <FontAwesomeIcon icon={l.icon} /> {l.label}
            </a>
          ))}

          {/* อีเมลของแอดมินที่ล็อกอินอยู่ */}
          {auth.currentUser?.email && (
            <span className="admin-nav-user">{auth.currentUser.email}</span>
          )}

          <button
            className="admin-nav-logout"
            onClick={logout}
          >
            ออกจากระบบ
          </button>
        </div>

        {/* Mobile Button */}
        <button
          className="admin-nav-toggle"
          onClick={() => setOpen(true)}
          aria-label="เปิดเมนู"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
      </nav>

      {/* Mobile Drawer */}
      <div className={`admin-drawer ${open ? 'show' : ''}`}>
        <button
          className="drawer-close"
          onClick={() => setOpen(false)}
          aria-label="ปิดเมนู"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className={path === l.href ? 'active' : ''}
            onClick={() => setOpen(false)}
          >
            <FontAwesomeIcon icon={l.icon} /> {l.label}
          </a>
        ))}

        {/* อีเมลของแอดมินที่ล็อกอินอยู่ */}
        {auth.currentUser?.email && (
          <span className="admin-nav-user">{auth.currentUser.email}</span>
        )}

        <button
          className="admin-nav-logout"
          onClick={logout}
        >
          ออกจากระบบ
        </button>
      </div>
    </>
  )
}