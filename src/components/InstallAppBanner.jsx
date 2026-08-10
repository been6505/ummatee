import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark, faArrowUpFromBracket, faSquarePlus } from '@fortawesome/free-solid-svg-icons'
import {
  isStandalone, isIOS, isInstallDismissed, dismissInstall,
} from '../utils/installPrompt.js'

// แถบชวนติดตั้งแอปฝั่งผู้ใช้ (public) — เว็บนี้เป็น PWA ที่ติดตั้งได้อยู่แล้ว แต่ไม่เคยมีอะไรบอกผู้ใช้เลย
// มีแต่ฝั่งแอดมิน (InstallAdminApp.jsx) ที่มีปุ่มติดตั้ง
//
// ตั้งใจไม่เด้งทันทีที่เปิดหน้าแรก — รอ DELAY_MS ให้คนได้เห็นเนื้อหาก่อน ไม่งั้นมันคือป๊อปอัปขวางตั้งแต่วินาทีแรก
const DELAY_MS = 6000

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)

  useEffect(() => {
    if (isStandalone() || isInstallDismissed()) return

    let timer = 0
    const show = () => { timer = window.setTimeout(() => setVisible(true), DELAY_MS) }

    const onPrompt = (e) => {
      e.preventDefault() // กัน mini-infobar ของ Chrome ไว้ก่อน แล้วค่อยเรียก prompt() เองตอนผู้ใช้กดปุ่ม
      setDeferredPrompt(e)
      show()
    }
    const onInstalled = () => { setVisible(false); setDeferredPrompt(null); dismissInstall() }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    // iOS Safari ไม่ยิง beforeinstallprompt เลย (ติดตั้งด้วยโค้ดไม่ได้) — ต้องโชว์วิธีทำมือเอง
    if (isIOS()) show()

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // ยกปุ่มลอย (แชท/บริจาค/ตะกร้า) ขึ้นให้พ้นแถบ ไม่งั้นมันทับกันที่มุมล่างซ้าย
  useEffect(() => {
    document.documentElement.classList.toggle('has-install-banner', visible)
    return () => document.documentElement.classList.remove('has-install-banner')
  }, [visible])

  const close = () => { setVisible(false); dismissInstall() }

  const install = async () => {
    if (!deferredPrompt) { setIosHelp(true); return }
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    // ถ้าปฏิเสธ ก็จำไว้เหมือนกัน จะได้ไม่ตามตื๊อทุกครั้งที่เข้าเว็บ
    setVisible(false)
    dismissInstall(outcome === 'accepted')
  }

  if (!visible) return null

  return (
    <>
      <div className="install-banner" role="dialog" aria-label="ติดตั้งแอป Ummatee">
        <img src="/icon-192.png" alt="" className="install-banner-icon" width="44" height="44" />
        <div className="install-banner-text">
          <strong>ติดตั้งแอป Ummatee</strong>
          <span>เปิดเร็วขึ้น ติดตามข่าวการช่วยเหลือได้จากหน้าจอโฮม</span>
        </div>
        <button type="button" className="install-banner-cta" onClick={install}>ติดตั้ง</button>
        <button type="button" className="install-banner-close" onClick={close} aria-label="ปิด">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      {iosHelp && (
        <div className="install-ios-overlay" onClick={() => setIosHelp(false)}>
          <div className="install-ios-box" onClick={(e) => e.stopPropagation()}>
            <button className="install-ios-close" onClick={() => setIosHelp(false)} aria-label="ปิด">
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <h4>ติดตั้งบน iPhone / iPad</h4>
            <ol>
              <li>แตะปุ่ม <b>แชร์</b> <FontAwesomeIcon icon={faArrowUpFromBracket} /> ที่แถบล่างของ Safari</li>
              <li>เลื่อนลงแล้วแตะ <b>เพิ่มไปยังหน้าจอโฮม</b> <FontAwesomeIcon icon={faSquarePlus} /></li>
              <li>แตะ <b>เพิ่ม</b> มุมขวาบน</li>
            </ol>
            <p className="install-ios-note">ต้องเปิดผ่าน <b>Safari</b> เท่านั้น — ใน Chrome หรือแอปอื่นบน iPhone จะไม่มีเมนูนี้</p>
          </div>
        </div>
      )}
    </>
  )
}
