// ฟอร์มล็อกอินผู้ดูแลระบบ ใช้ email/password ผ่าน Firebase Authentication
import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase.js'

export default function AdminLogin() {
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

  return (
    <main className="admin-login">
      <form className="admin-login-box" onSubmit={submit}>
        <h2>🔒 Admin Login</h2>
        <p>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
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
      </form>
    </main>
  )
}
