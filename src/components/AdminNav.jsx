import { useState } from 'react'

const LINKS = [
  { href: '/admin/dashboard', label: '🏠 หน้าหลัก' },
  { href: '/admin/event/iftar2026', label: '🇵🇸 Iftar For Gaza' },
  { href: '/admin/missions/qurban2026', label: '🐑 Qurban 2026' },
]

export default function AdminNav() {
  const path = window.location.pathname
  const [open, setOpen] = useState(false)

  const logout = () => {
    sessionStorage.removeItem('admin-authed')
    window.location.reload()
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
        >
          ☰
        </button>
      </nav>

      {/* Mobile Drawer */}
      <div className={`admin-drawer ${open ? 'show' : ''}`}>
        <button
          className="drawer-close"
          onClick={() => setOpen(false)}
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