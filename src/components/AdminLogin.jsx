import { useEffect, useState } from 'react'
import { signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from 'firebase/auth'
import { auth } from '../firebase.js'
import { isAllowedEmail } from '../useAdminRole.js'
import { DENIED_KEY } from '../useAdminAuth.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock, faHandshake } from '@fortawesome/free-solid-svg-icons'

// โลโก้ Google แบบ inline — ไม่โหลดไฟล์จากภายนอก (CSP ของเว็บบล็อกโดเมนนอกอยู่แล้ว)
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.8 2.6 13.6l7.8 6.1C12.3 13.6 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.2-3.2-.5-4.7H24v9h12.6c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7.1-10.2 7.1-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.3c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6.1C.9 16 0 19.9 0 23.5s.9 7.5 2.6 10.9l7.8-6.1z" />
      <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.4-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.8 2.3-6.4 0-11.7-4.1-13.6-9.9l-7.8 6.1C6.5 42.2 14.6 47.5 24 47.5z" />
    </svg>
  )
}

const provider = new GoogleAuthProvider()
provider.setCustomParameters({ prompt: 'select_account' }) // ให้เลือกบัญชีทุกครั้ง ไม่เด้งเข้าบัญชีเดิมอัตโนมัติ

// แปลง error code ของ Firebase Auth เป็นข้อความที่บอกได้ว่าต้องไปแก้ที่ไหน
function googleErrorMessage(code) {
  if (code === 'auth/operation-not-allowed') return 'ยังไม่ได้เปิดใช้การล็อกอินด้วย Google — เปิดที่ Firebase Console › Authentication › Sign-in method'
  if (code === 'auth/unauthorized-domain') return 'โดเมนนี้ยังไม่ได้รับอนุญาตให้ล็อกอิน — เพิ่มที่ Firebase Console › Authentication › Settings › Authorized domains'
  if (code === 'auth/account-exists-with-different-credential') return 'อีเมลนี้เคยสมัครด้วยรหัสผ่านไว้แล้ว — ให้เข้าด้วยอีเมล/รหัสผ่านแทน'
  if (code === 'auth/network-request-failed') return 'เชื่อมต่อไม่สำเร็จ — ตรวจสัญญาณอินเทอร์เน็ตแล้วลองใหม่'
  return 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ' + (code ? ` (${code})` : '')
}

export default function AdminLogin() {
  const [mode, setMode] = useState(null) // null = เลือกประเภท, 'admin', 'volunteer'
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState(() => {
    // ถ้าเพิ่งถูกเตะออกเพราะอีเมลไม่อยู่ในรายชื่อผู้มีสิทธิ์ (ดู useAdminAuth) ให้บอกเหตุผลตรงนี้
    const denied = sessionStorage.getItem(DENIED_KEY)
    if (!denied) return ''
    sessionStorage.removeItem(DENIED_KEY)
    return `บัญชี ${denied} ไม่มีสิทธิ์เข้าใช้ระบบนี้ — ให้ใช้บัญชีของทีมงานอุมมะตี`
  })

  // เก็บ error จากการล็อกอินแบบ redirect (มือถือ/เบราว์เซอร์ที่บล็อก popup จะกลับมาที่หน้านี้)
  useEffect(() => {
    getRedirectResult(auth).catch((e) => setError(googleErrorMessage(e?.code)))
  }, [])

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

  const googleLogin = async () => {
    setError('')
    setGoogleBusy(true)
    try {
      const cred = await signInWithPopup(auth, provider)
      // ใครก็ล็อกอินด้วยบัญชี Google ตัวเองได้ — ต้องเช็ครายชื่อที่มีสิทธิ์เองอีกชั้น
      // (useAdminAuth เช็คซ้ำอีกที เผื่อทางที่ไม่ได้ผ่านปุ่มนี้ เช่น กลับมาจาก redirect หรือเซสชันเก่า)
      if (!isAllowedEmail(cred.user?.email)) {
        await signOut(auth).catch(() => {})
        sessionStorage.removeItem(DENIED_KEY)
        setError(`บัญชี ${cred.user?.email || ''} ไม่มีสิทธิ์เข้าใช้ระบบนี้ — ให้ใช้บัญชีของทีมงานอุมมะตี`)
      }
    } catch (e) {
      const code = e?.code
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') {
        // ผู้ใช้ปิดหน้าต่างเอง ไม่ต้องขึ้น error
      } else if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        // เบราว์เซอร์บล็อก popup (พบบ่อยใน in-app browser และ PWA บน iOS) — เปลี่ยนไปใช้ redirect
        try {
          await signInWithRedirect(auth, provider)
          return
        } catch (e2) {
          setError(googleErrorMessage(e2?.code))
        }
      } else {
        setError(googleErrorMessage(code))
      }
    } finally {
      setGoogleBusy(false)
    }
  }

  const googleButton = (
    <button type="button" className="admin-login-google" onClick={googleLogin} disabled={googleBusy}>
      <GoogleMark />
      {googleBusy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
    </button>
  )

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

          <div className="admin-login-or"><span>หรือ</span></div>
          {googleButton}
          {error && <div className="admin-error" style={{ marginTop: 14 }}>{error}</div>}
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

        <div className="admin-login-or"><span>หรือ</span></div>
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
