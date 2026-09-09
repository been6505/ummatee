// โหลดหน้าใหม่อัตโนมัติเมื่อ service worker เวอร์ชันใหม่เข้ามาทำงานแทน
//
// ปัญหาที่แก้: เว็บนี้เป็น PWA (vite-plugin-pwa, registerType 'autoUpdate') ซึ่ง "อัปเดตตัว SW เอง"
// ก็จริง แต่หน้าที่เปิดค้างอยู่ยังรัน JS ก้อนเก่าที่โหลดไปแล้วต่อไป จนกว่าผู้ใช้จะปิดแล้วเปิดใหม่
// ⇒ deploy ของใหม่ไปแล้วแต่ผู้ใช้ยังเห็นของเก่า และไม่มีอะไรบอกว่าต้องรีเฟรช
// (เจอจริง: แก้ให้ขึ้นกล่องแจ้งเตือนกลางจอแล้ว deploy แล้ว แต่มือถือยังโชว์ข้อความแบบเก่าอยู่)
//
// controllerchange ยิงเมื่อ SW ตัวใหม่ claim หน้านี้แล้ว = ถึงเวลาโหลดใหม่เพื่อรับโค้ดชุดใหม่
export function initSwAutoReload() {
  if (!('serviceWorker' in navigator)) return

  // ตอนติดตั้งครั้งแรกสุด (ยังไม่เคยมี controller) controllerchange ก็ยิงเหมือนกัน
  // แต่กรณีนั้นโค้ดที่รันอยู่ใหม่อยู่แล้ว ไม่ต้องรีโหลดให้ผู้ใช้สะดุด
  const hadController = !!navigator.serviceWorker.controller
  let reloading = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true // กันรีโหลดวนซ้ำถ้าอีเวนต์ยิงมากกว่าหนึ่งครั้ง
    window.location.reload()
  })
}
