// ตรรกะล้วนของแถบชวนติดตั้งแอป (InstallAppBanner.jsx) — แยกไฟล์ไว้ให้เทสต์ได้โดยไม่ต้องมี React/DOM จริง

const KEY = 'umInstallDismissed'

// ปิดไปแล้วให้เงียบ 30 วัน ไม่ใช่เงียบตลอดกาล — คนที่ปัดทิ้งเพราะรีบ ควรได้เห็นอีกสักครั้ง
// แต่ถ้าติดตั้งไปแล้วจริง ๆ ไม่ต้องถามอีกเลย
export const DISMISS_DAYS = 30
export const FOREVER = 'installed'

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches === true || window.navigator?.standalone === true)

export const isIOS = () =>
  typeof window !== 'undefined' && /iphone|ipad|ipod/i.test(window.navigator?.userAgent || '')

// แยกการตัดสินใจออกมาเป็นฟังก์ชันบริสุทธิ์ เทสต์ได้โดยไม่ต้องยุ่งกับ localStorage/นาฬิกาจริง
export function shouldStayHidden(stored, now, days = DISMISS_DAYS) {
  if (!stored) return false
  if (stored === FOREVER) return true
  const at = Number(stored)
  if (!Number.isFinite(at)) return false // ค่าขยะ (เช่นของเก่าคนละรูปแบบ) ถือว่ายังไม่เคยปิด
  return now - at < days * 24 * 60 * 60 * 1000
}

export function isInstallDismissed() {
  try {
    return shouldStayHidden(window.localStorage.getItem(KEY), Date.now())
  } catch {
    return false // โหมดส่วนตัวบางเบราว์เซอร์อ่าน localStorage ไม่ได้ — ไม่ควรทำให้แถบพังไปด้วย
  }
}

export function dismissInstall(forever = false) {
  try {
    window.localStorage.setItem(KEY, forever ? FOREVER : String(Date.now()))
  } catch { /* เขียนไม่ได้ก็ปล่อย — อย่างมากคือรอบหน้าเห็นแถบอีกครั้ง */ }
}
