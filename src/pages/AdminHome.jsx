import { useState } from 'react'

const ADMIN_PASS = 'ummatee2026'

const LINKS = [
  { href: '/admin/event/iftar2026', icon: '🇵🇸', title: 'Iftar For Gaza', desc: 'รายชื่อผู้ลงทะเบียน + กราฟสรุปข้อมูลผู้เข้าร่วมงาน' },
  { href: '/admin/missions/qurban2026', icon: '🐑', title: 'Qurban 2026', desc: 'สรุปการแจกจ่ายกุรบาน 1447 / 2026 แยกตามประเทศ' },
]

export default function AdminHome() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin-authed') === '1')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')

  if (!authed) {
    return (
      <main className="admin-login">
        <form
          className="admin-login-box"
          onSubmit={(e) => {
            e.preventDefault()
            if (pass === ADMIN_PASS) {
              sessionStorage.setItem('admin-authed', '1')
              setAuthed(true)
            } else {
              setError('รหัสผ่านไม่ถูกต้อง')
            }
          }}
        >
          <h2>🔒 Admin Login</h2>
          <p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
          <input
            type="password"
            placeholder="รหัสผ่าน"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoFocus
          />
          {error && <div className="admin-error">{error}</div>}
          <button type="submit">เข้าสู่ระบบ</button>
        </form>
      </main>
    )
  }

  return (
    <main className="admin-dash">
      <div className="admin-wrap">
        <div className="admin-head">
          <div>
            <h1>🛠️ Admin Dashboard</h1>
            <p>เลือกดูข้อมูลและกราฟสรุปของแต่ละกิจกรรม</p>
          </div>
          <button
            className="admin-logout"
            onClick={() => { sessionStorage.removeItem('admin-authed'); window.location.reload() }}
          >
            ออกจากระบบ
          </button>
        </div>

        <div className="admin-grid">
          {LINKS.map((l) => (
            <a key={l.href} className="admin-card admin-link-card" href={l.href}>
              <div className="he" style={{ fontSize: '2rem', marginBottom: 10 }}>{l.icon}</div>
              <h4>{l.title}</h4>
              <p style={{ color: 'var(--ink-soft)', fontSize: '.9rem', marginTop: 6 }}>{l.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
