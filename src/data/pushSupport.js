// ตรรกะล้วนของการแจ้งเตือน (push) — แยกไว้ให้เทสต์ได้โดยไม่ต้องมี browser API จริง
//
// เว็บนี้ไม่มี Cloud Functions (แผน Spark) การ "ส่ง" แจ้งเตือนจึงต้องทำจากข้างนอก
// ดู docs/push-notifications-setup.md — ฝั่งเว็บมีหน้าที่แค่ขอสิทธิ์และเก็บ token เท่านั้น

// VAPID public key ใส่ผ่าน env ตอน build (ไม่ใช่ความลับ — เป็น public key)
// ถ้ายังไม่ได้ตั้ง ระบบแจ้งเตือนต้อง "ปิดสนิท" ไม่ใช่ขึ้นปุ่มแล้วกดไม่ได้
export const VAPID_KEY = import.meta.env?.VITE_FCM_VAPID_KEY || ''

// เหตุผลที่ใช้ไม่ได้ — คืนเป็นข้อความอธิบาย ไม่ใช่แค่ true/false
// เพราะแต่ละกรณีผู้ใช้ต้องทำคนละอย่าง และบางกรณีทำอะไรไม่ได้เลย
export const UNSUPPORTED = {
  notConfigured: 'ระบบแจ้งเตือนยังไม่ได้ตั้งค่า',
  noApi: 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน',
  iosNeedsInstall: 'บน iPhone/iPad ต้องกด "เพิ่มไปยังหน้าจอโฮม" ก่อน จึงจะเปิดแจ้งเตือนได้',
  denied: 'คุณเคยปิดการแจ้งเตือนไว้ — ต้องเปิดใหม่ในการตั้งค่าเบราว์เซอร์',
}

// env: { hasNotification, hasServiceWorker, hasPushManager, permission, isIOS, isStandalone, vapidKey }
// คืน null = ใช้ได้ / คืนสตริง = ใช้ไม่ได้เพราะเหตุนี้
export function pushBlockedReason(env) {
  const e = env || {}
  if (!e.vapidKey) return UNSUPPORTED.notConfigured
  if (!e.hasNotification || !e.hasServiceWorker || !e.hasPushManager) {
    // iOS < 16.4 ไม่มี PushManager เลย และต่อให้มี ก็ต้องติดตั้งเป็นแอปก่อน
    // ตอบให้ตรงกรณีของ iPhone จะช่วยได้มากกว่าบอกลอย ๆ ว่า "ไม่รองรับ"
    if (e.isIOS && !e.isStandalone) return UNSUPPORTED.iosNeedsInstall
    return UNSUPPORTED.noApi
  }
  // Safari บน iOS รองรับ web push ตั้งแต่ 16.4 แต่เฉพาะตอนเปิดจากหน้าจอโฮมเท่านั้น
  // ถ้าเปิดในแท็บ Safari ปกติ ขอสิทธิ์ไปก็ไม่มีอะไรเกิดขึ้น
  if (e.isIOS && !e.isStandalone) return UNSUPPORTED.iosNeedsInstall
  if (e.permission === 'denied') return UNSUPPORTED.denied
  return null
}

export const isSubscribed = (permission) => permission === 'granted'

// doc ที่เก็บลง Firestore — key ของ doc คือตัว token เอง (กันซ้ำในตัว ไม่ต้องไปหาว่ามีอยู่แล้วไหม)
// ตั้งใจไม่เก็บอะไรที่ระบุตัวบุคคลได้ ไม่มี uid/อีเมล/ไอพี — ผู้ใช้ฝั่งนี้ไม่ได้ล็อกอินอยู่แล้ว
// เก็บ lang ไว้เผื่อส่งข้อความตามภาษา และ updatedAt ไว้ล้าง token ที่ตายแล้วทีหลัง
export function buildTokenDoc({ token, lang, now }) {
  const t = String(token || '').trim()
  if (!t || t.length > 4096) return { ok: false, error: 'token ไม่ถูกต้อง' }
  return {
    ok: true,
    value: {
      lang: ['th', 'en', 'ar'].includes(lang) ? lang : 'th',
      updatedAt: Number(now) || 0,
    },
    id: t,
  }
}
