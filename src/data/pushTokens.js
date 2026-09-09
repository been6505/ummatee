// ขอสิทธิ์แจ้งเตือน + เก็บ FCM token ลง Firestore
//
// firebase/messaging ถูก import แบบ dynamic ทั้งหมด — ถ้า import ตรง ๆ จากไฟล์นี้
// Firebase SDK ทั้งก้อนจะถูกลากเข้า entry chunk ที่ทุกหน้าต้องโหลด (เหตุผลเดียวกับ ChatWidget ใน App.jsx)
import { VAPID_KEY, pushBlockedReason, buildTokenDoc } from './pushSupport.js'

const COL = 'pushTokens'

const env = () => ({
  vapidKey: VAPID_KEY,
  hasNotification: typeof Notification !== 'undefined',
  hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
  permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
  isIOS: typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent || ''),
  isStandalone:
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches === true || window.navigator?.standalone === true),
})

export const blockedReason = () => pushBlockedReason(env())
export const currentPermission = () =>
  (typeof Notification !== 'undefined' ? Notification.permission : 'default')

// คืน { ok, error }
export async function enablePush(lang = 'th') {
  const blocked = blockedReason()
  if (blocked) return { ok: false, error: blocked }

  const permission = await Notification.requestPermission()
  // ผู้ใช้กดปฏิเสธ = จบ ขอซ้ำไม่ได้อีกจากฝั่งเว็บ ต้องไปเปิดเองในตั้งค่าเบราว์เซอร์
  if (permission !== 'granted') return { ok: false, error: 'ยังไม่ได้อนุญาตการแจ้งเตือน' }

  try {
    const [{ app, db }, messaging, fs] = await Promise.all([
      import('../firebase.js'),
      import('firebase/messaging'),
      import('firebase/firestore'),
    ])
    const m = messaging.getMessaging(app)

    // ต้องส่ง service worker ของ FCM เข้าไปเอง ไม่งั้น SDK จะไปหา /firebase-messaging-sw.js
    // แล้วลงทะเบียนที่ scope '/' ซึ่งชนกับ service worker ของ workbox (vite-plugin-pwa) ที่ครอง scope นั้นอยู่
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    })

    const token = await messaging.getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })
    if (!token) return { ok: false, error: 'ขอ token ไม่สำเร็จ' }

    const built = buildTokenDoc({ token, lang, now: Date.now() })
    if (!built.ok) return built

    // ใช้ token เป็น doc id — เข้าเว็บซ้ำกี่ครั้งก็ทับ doc เดิม ไม่เกิดรายการซ้ำ
    await fs.setDoc(fs.doc(db, COL, built.id), built.value, { merge: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'เปิดการแจ้งเตือนไม่สำเร็จ: ' + (e?.message || e) }
  }
}
