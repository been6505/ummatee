import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase.js'

const LINKS = [
  { href: '/admin/dashboard', label: '🏠 หน้าหลัก' },
  { href: '/admin/event/iftar2026', label: '🇵🇸 Iftar For Gaza' },
  { href: '/admin/register-event', label: '📷 เช็คอินหน้างาน' },
  { href: '/admin/missions/qurban2026', label: '🐑 Qurban 2026' },
  { href: '/admin/donations', label: '💰 เงินบริจาค' },
  { href: '/admin/calendar', label: '📅 ปฏิทิน' },
  { href: '/admin/shop', label: '🛍️ Um Shop' },
  { href: '/admin/financial-dashboard', label: '📊 แดชบอร์ดการเงิน' },
  { href: '/admin/volunteer', label: '🤝 อาสาสมัคร' },
  { href: '/admin/give', label: '🎁 ส่งต่อของ' },
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
          🛠️ Admin
        </div>

        {/* Desktop Menu */}
        <div className="admin-nav-links">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={path === l.href ? 'active' : ''}
            >
              {l.label}
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
          ☰
        </button>
      </nav>

      {/* Mobile Drawer */}
      <div className={`admin-drawer ${open ? 'show' : ''}`}>
        <button
          className="drawer-close"
          onClick={() => setOpen(false)}
          aria-label="ปิดเมนู"
        >
          ×
        </button>

        {LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className={path === l.href ? 'active' : ''}
            onClick={() => setOpen(false)}
          >
            {l.label}
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