import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock, faHandshake } from '@fortawesome/free-solid-svg-icons'

export default function AdminLogin() {
  const [mode, setMode] = useState(null) // null = choose, 'admin', 'volunteer'
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass)
    } catch {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setBusy(false)
    }
  }

  if (!mode) {
    return (
      <main className="admin-login">
        <div className="admin-login-box">
          <h2>เข้าสู่ระบบ</h2>
          <p>เลือกประเภทการเข้าสู่ระบบ</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            <button
              type="button"
              className="admin-login-role-btn"
              onClick={() => setMode('volunteer')}
            >
              <FontAwesomeIcon icon={faHandshake} style={{ fontSize: 24 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Volunteer</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>สำหรับอาสาสมัคร / Staff</div>
              </div>
            </button>
            <button
              type="button"
              className="admin-login-role-btn"
              onClick={() => setMode('admin')}
            >
              <FontAwesomeIcon icon={faLock} style={{ fontSize: 24 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Admin</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>สำหรับผู้ดูแลระบบ</div>
              </div>
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="admin-login">
      <form className="admin-login-box" onSubmit={submit}>
        <h2>
          <FontAwesomeIcon icon={mode === 'admin' ? faLock : faHandshake} />
          {' '}{mode === 'admin' ? 'Admin Login' : 'Volunteer Login'}
        </h2>
        <p>{mode === 'admin' ? 'หน้านี้สำหรับผู้ดูแลระบบเท่านั้น' : 'สำหรับอาสาสมัครและ Staff'}</p>
        <input
          type="email"
          placeholder="อีเมล"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
        <input
          type="password"
          placeholder="รหัสผ่าน"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />
        {error && <div className="admin-error">{error}</div>}
        <button type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
        <button
          type="button"
          className="admin-clear"
          style={{ marginTop: 12, width: '100%', textAlign: 'center' }}
          onClick={() => { setMode(null); setError(''); setEmail(''); setPass('') }}
        >
          ← กลับ
        </button>
      </form>
    </main>
  )
}
