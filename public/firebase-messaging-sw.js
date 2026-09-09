/* Service worker ของ Firebase Cloud Messaging — รับแจ้งเตือนตอนที่ผู้ใช้ไม่ได้เปิดเว็บอยู่
 *
 * ไฟล์นี้อยู่ใน public/ จึงถูกคัดลอกไป dist/ ตรง ๆ ไม่ผ่าน bundler
 * ⚠️ ห้ามใช้ import/export ที่นี่ — service worker ตัวนี้โหลดผ่าน importScripts() แบบ classic
 *
 * ⚠️ คนละตัวกับ sw.js ของ workbox (vite-plugin-pwa) ที่ครอง scope '/' อยู่
 * ตัวนี้ลงทะเบียนที่ scope '/firebase-cloud-messaging-push-scope' เท่านั้น (ดู data/pushTokens.js)
 * ถ้าปล่อยให้ทั้งคู่ชิง scope '/' ตัวหลังจะแทนที่ตัวแรก แล้วเว็บจะใช้งานออฟไลน์ไม่ได้
 *
 * config ชุดนี้เป็นค่าสาธารณะของ Firebase ฝั่ง client (ไม่ใช่ secret) — ต้องเขียนซ้ำที่นี่
 * เพราะ service worker อ่านตัวแปรจาก src/firebase.js ไม่ได้
 */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBYD1pYwC-ygjn2PFgLV7t7FYfgI0x56Mw',
  authDomain: 'ummatee-app.firebaseapp.com',
  projectId: 'ummatee-app',
  storageBucket: 'ummatee-app.firebasestorage.app',
  messagingSenderId: '703058924415',
  appId: '1:703058924415:web:31c5ac18c832ba5856804a',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {}
  const title = d.title || 'Ummatee'
  self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // รวมแจ้งเตือนเรื่องเดียวกันเป็นอันเดียว ไม่ให้เด้งซ้อนกันเป็นตั้ง
    tag: d.tag || 'ummatee-update',
    data: { url: d.url || '/updates' },
  })
})

// แตะแจ้งเตือนแล้วต้องพาไปที่หน้านั้น — และถ้าเปิดแอปค้างไว้อยู่แล้ว ให้สลับไปแท็บเดิม
// ไม่ใช่เปิดหน้าต่างใหม่ทับกันไปเรื่อย ๆ
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/updates'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus() }
      }
      return self.clients.openWindow(url)
    })
  )
})
