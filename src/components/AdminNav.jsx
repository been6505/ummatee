// แถบเมนูด้านบนที่ใช้ร่วมกันทุกหน้า admin — มีลิงก์สลับหน้า + ปุ่มออกจากระบบ
// รายการลิงก์ในเมนู (path ต้องตรงกับ PATH_TO_PAGE ใน App.jsx)
const LINKS = [
  { href: '/admin/dashboard', label: '🏠 หน้าหลัก' },
  { href: '/admin/event/iftar2026', label: '🇵🇸 Iftar For Gaza' },
  { href: '/admin/missions/qurban2026', label: '🐑 Qurban 2026' },
]

export default function AdminNav() {
  // ใช้ path ปัจจุบันเพื่อไฮไลต์ลิงก์ของหน้าที่กำลังเปิดอยู่
  const path = window.location.pathname
  return (
    <nav className="admin-nav">
      <div className="admin-nav-wrap">
        <span className="admin-nav-brand">🛠️ Admin</span>
        <div className="admin-nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className={path === l.href ? 'active' : ''}>{l.label}</a>
          ))}
        </div>
        {/* ออกจากระบบ: ลบสถานะล็อกอินใน sessionStorage แล้วโหลดหน้าใหม่เพื่อกลับไปหน้า login */}
        <button
          className="admin-nav-logout"
          onClick={() => { sessionStorage.removeItem('admin-authed'); window.location.reload() }}
        >
          ออกจากระบบ
        </button>
      </div>
    </nav>
  )
}
