import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation, faCopy, faCheck } from '@fortawesome/free-solid-svg-icons'

// ตรวจจับ in-app browser (Messenger/Instagram/LINE/TikTok/WeChat) — เบราว์เซอร์ในแอปพวกนี้มักบล็อก
// script บางตัว (เช่น Google reCAPTCHA ที่ Firebase App Check ใช้) ทำให้สั่งซื้อไม่ผ่านแบบเงียบๆ
// (ขึ้น error "Missing or insufficient permissions" ซึ่งดูเหมือนบั๊ก แต่จริงๆ คือ recaptcha ทำงานไม่ได้)
const isInAppBrowser = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|FB_IAB|MessengerForiOS|Instagram|Line\/|MicroMessenger|BytedanceWebview|TikTok/i.test(ua)
}

export default function InAppBrowserWarning() {
  const [show] = useState(isInAppBrowser)
  const [copied, setCopied] = useState(false)

  if (!show) return null

  const copyLink = () => {
    const url = window.location.href
    const onSuccess = () => { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(onSuccess).catch(() => {})
    } else {
      const el = document.createElement('textarea')
      el.value = url; el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el); el.select()
      try { document.execCommand('copy'); onSuccess() } catch { /* noop */ }
      document.body.removeChild(el)
    }
  }

  return (
    <div style={{
      background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 12,
      padding: '14px 16px', marginBottom: 16, fontSize: '.88rem', color: '#92400e',
    }}>
      <p style={{ fontWeight: 700, marginBottom: 6 }}>
        <FontAwesomeIcon icon={faTriangleExclamation} /> กำลังเปิดผ่านแอปแชท (Messenger/LINE/Instagram)
      </p>
      <p style={{ marginBottom: 10 }}>
        เบราว์เซอร์ในแอปแชทอาจทำให้ <b>สั่งซื้อไม่สำเร็จ</b> (ระบบยืนยันความปลอดภัยทำงานไม่ได้) —
        แนะนำให้คัดลอกลิงก์แล้วเปิดใน <b>Safari หรือ Chrome</b> ก่อนสั่งซื้อ
      </p>
      <button
        type="button"
        className="admin-btn"
        onClick={copyLink}
        style={{ background: '#fff' }}
      >
        <FontAwesomeIcon icon={copied ? faCheck : faCopy} /> {copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์หน้านี้'}
      </button>
    </div>
  )
}
