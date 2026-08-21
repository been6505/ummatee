import { useState } from 'react'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { isAdminEmail } from '../useAdminRole.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock, faHandshake } from '@fortawesome/free-solid-svg-icons'

// โลโก้ Google ตามไกด์ไลน์ (ห้ามใช้ไอคอนตัว G ที่วาดเอง/สีเดียวบนปุ่ม Sign in with Google)
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34 4.3 29.3 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22 22-9.8 22-22c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34 4.3 29.3 2 24 2 15.6 2 8.5 6.8 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 46c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 37.1 26.7 38 24 38c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C8.4 41.2 15.6 46 24 46z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C40.8 36 44 30.6 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  )
}

// แปลง error code ของ Firebase Auth เป็นข้อความไทยที่บอกวิธีแก้ได้จริง
// (โดยเฉพาะ operation-not-allowed ที่ต้องไปเปิดใน Firebase Console ไม่ใช่ปัญหาที่โค้ด)
const GOOGLE_ERROR = {
  'auth/operation-not-allowed': 'ยังไม่ได้เปิดใช้งาน Google ใน Firebase Console → Authentication → Sign-in method',
  'auth/unauthorized-domain': 'โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Console → Authentication → Settings → Authorized domains',
  'auth/popup-blocked': 'เบราว์เซอร์บล็อกป๊อปอัป กรุณาอนุญาตป๊อปอัปของเว็บนี้แล้วลองใหม่',
  'auth/account-exists-with-different-credential': 'อีเมลนี้เคยสมัครด้วยรหัสผ่านไว้แล้ว กรุณาเข้าสู่ระบบด้วยอีเมล/รหัสผ่านแทน',
}

// เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน — เดิมจับ error แล้วขึ้น "อีเมลหรือรหัสผ่านไม่ถูกต้อง" ทุกกรณี
// ทำให้แยกไม่ออกเลยว่าเป็นรหัสผิดจริง หรือโดนล็อกชั่วคราวเพราะลองหลายครั้ง หรือเน็ตมีปัญหา
// หรือยังไม่ได้เปิด provider ใน Firebase Console — สามอย่างหลังแก้คนละทางกับ "พิมพ์รหัสใหม่"
//
// ตั้งใจคง invalid-credential / user-not-found / wrong-password ให้เป็นข้อความกลางเหมือนเดิม
// เพราะการบอกว่า "ไม่มีบัญชีนี้" คือการยืนยันให้คนนอกรู้ว่าอีเมลไหนมีอยู่จริงในระบบ
const LOGIN_ERROR = {
  'auth/too-many-requests': 'ลองผิดหลายครั้งเกินไป Firebase ระงับการเข้าสู่ระบบจากเครื่องนี้ชั่วคราว — รอสักครู่แล้วลองใหม่ หรือใช้ "เข้าสู่ระบบด้วย Google" แทน',
  'auth/network-request-failed': 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
  'auth/user-disabled': 'บัญชีนี้ถูกปิดใช้งานอยู่ — เปิดคืนได้ที่ Firebase Console → Authentication → Users',
  'auth/operation-not-allowed': 'ยังไม่ได้เปิดวิธีเข้าสู่ระบบแบบอีเมล/รหัสผ่านใน Firebase Console → Authentication → Sign-in method',
  'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
}

export default function AdminLogin() {
  const [mode, setMode] = useState(null) // null = choose, 'admin', 'volunteer'
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const signInGoogle = async () => {
    setError('')
    setBusy(true)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' }) // ให้เลือกบัญชีทุกครั้ง ไม่ auto-login บัญชีเดิม
      await signInWithPopup(auth, provider)
    } catch (err) {
      // ผู้ใช้ปิดป๊อปอัปเอง/กดยกเลิก ไม่ใช่ข้อผิดพลาด ไม่ต้องขึ้นข้อความ
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') return
      setError(GOOGLE_ERROR[err?.code] || `เข้าสู่ระบบด้วย Google ไม่สำเร็จ (${err?.code || 'ไม่ทราบสาเหตุ'})`)
    } finally {
      setBusy(false)
    }
  }

  const googleButton = (
    <button type="button" className="admin-google-btn" onClick={signInGoogle} disabled={busy}>
      <GoogleLogo /> เข้าสู่ระบบด้วย Google
    </button>
  )

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass)
    } catch (err) {
      // ต่อท้ายด้วย code เสมอเมื่อเป็นสาเหตุที่ไม่รู้จัก — ไม่งั้นเวลาเจอปัญหาจริงจะไม่มีอะไรให้ไล่ต่อเลย
      setError(LOGIN_ERROR[err?.code] || `อีเมลหรือรหัสผ่านไม่ถูกต้อง${err?.code ? ` (${err.code})` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  // ล็อกอินสำเร็จแต่อีเมลไม่อยู่ใน allowlist — ต้องบอกให้ชัดว่า "ไม่มีสิทธิ์" ไม่ใช่โชว์ฟอร์มล็อกอินเปล่าๆ
  // (ไม่งั้นคนที่กด Sign in with Google แล้วเด้งกลับมาหน้าเดิมจะนึกว่าปุ่มเสีย แล้วกดวนไปเรื่อยๆ)
  const signedIn = auth.currentUser
  if (signedIn && !isAdminEmail(signedIn.email || '')) {
    return (
      <main className="admin-login">
        <div className="admin-login-box">
          <h2>ไม่มีสิทธิ์เข้าถึง</h2>
          <p>
            บัญชี <strong>{signedIn.email}</strong> ไม่มีสิทธิ์เข้าหน้าผู้ดูแลระบบ<br />
            หากคุณเป็นพนักงาน กรุณาแจ้งแอดมินให้กำหนดสิทธิ์ให้ก่อน
          </p>
          <button type="button" className="admin-login-role-btn" style={{ marginTop: 16 }} onClick={() => signOut(auth)}>
            <div style={{ fontWeight: 700 }}>ออกจากระบบ / เข้าด้วยบัญชีอื่น</div>
          </button>
        </div>
      </main>
    )
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
          <div className="admin-login-divider"><span>หรือ</span></div>
          {googleButton}
          {error && <div className="admin-error" style={{ marginTop: 12 }}>{error}</div>}
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
        <div className="admin-login-divider"><span>หรือ</span></div>
        {googleButton}
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
