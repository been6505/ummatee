import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faXmark } from '@fortawesome/free-solid-svg-icons'

// ปุ่ม "ติดตั้งแอปแอดมิน" ในเมนู admin — ใช้ manifest แยกของโซนแอดมิน (admin-manifest.webmanifest, สลับให้อัตโนมัติใน App.jsx)
// Android/Chrome: ดัก beforeinstallprompt แล้วเรียก prompt() ให้กดติดตั้งได้เลยในตัว
// iOS Safari ไม่รองรับ beforeinstallprompt (ติดตั้งผ่านโค้ดไม่ได้) เลยโชว์ขั้นตอนมือแทน

const isStandalone = () =>
  (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) || window.navigator?.standalone === true

const isIOS = () => typeof window !== 'undefined' && /iphone|ipad|ipod/i.test(window.navigator.userAgent)

export default function InstallAdminApp() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [showIOSHelp, setShowIOSHelp] = useState(false)

  useEffect(() => {
    if (installed) return
    const onPrompt = (e) => { e.preventDefault(); setDeferredPrompt(e) }
    const onInstalled = () => { setInstalled(true); setDeferredPrompt(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [installed])

  if (installed) return null
  if (!deferredPrompt && !isIOS()) return null // เบราว์เซอร์นี้ยังไม่ trigger prompt และไม่ใช่ iOS — ยังไม่มีอะไรให้กด

  const handleClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
    } else if (isIOS()) {
      setShowIOSHelp(true)
    }
  }

  return (
    <>
      <button type="button" className="admin-nav-install" onClick={handleClick}>
        <FontAwesomeIcon icon={faDownload} /> ติดตั้งแอปแอดมิน
      </button>

      {showIOSHelp && (
        <div className="admin-install-ios-overlay" onClick={() => setShowIOSHelp(false)}>
          <div className="admin-install-ios-box" onClick={(e) => e.stopPropagation()}>
            <button className="admin-install-ios-close" onClick={() => setShowIOSHelp(false)} aria-label="ปิด">
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <h4>ติดตั้งแอปแอดมินบน iPhone/iPad</h4>
            <ol>
              <li>แตะปุ่ม <b>แชร์</b> (ไอคอนสี่เหลี่ยมมีลูกศรชี้ขึ้น) แถบด้านล่างของ Safari</li>
              <li>เลื่อนหาแล้วแตะ <b>"เพิ่มไปยังหน้าจอโฮม"</b></li>
              <li>แตะ <b>"เพิ่ม"</b> มุมขวาบน</li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
