/* Service worker หน้าทีม: เปิดหน้าได้แม้ไม่มีเน็ต
   - หน้า/ไฟล์ของหน้าทีม: ใช้จากเน็ตก่อน (รอไม่เกิน 4 วิ) ไม่ได้ = ใช้ที่เก็บไว้ · เก็บของใหม่ทุกครั้งที่โหลดสำเร็จ
   - /api ไม่เก็บ (ข้อมูลงานล่าสุดเก็บใน localStorage ของหน้าทีม · สิ่งที่กดตอนไม่มีเน็ตอยู่ในกล่องขาออก) */
const CACHE = 'hm-team-v18';
const CORE = ['./', './native-track.js?v=2', '../assets/helpme4u-logo.png', '../central/icons.js?v=10', './jsqr.min.js?v=1', '../central/verify.js?v=15', '../bc.js?v=2', '../assets/hm-icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('hm-team-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.pathname.startsWith('/api')) return;
  const same = url.origin === location.origin, font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return;
  const nav = req.mode === 'navigate';
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const key = nav ? new Request(new URL('./', self.registration.scope).href) : req; // หน้าทีมมี ?id=… ต่างกัน เก็บเป็นหน้าเดียว
    try {
      const res = await timeout(fetch(req), nav ? 4000 : 8000);
      if (res && (res.ok || res.type === 'opaque')) c.put(key, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      const hit = await c.match(key, { ignoreSearch: nav }) || await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
