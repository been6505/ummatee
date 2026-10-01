/* Service worker: network-first เก็บหน้าไว้ใช้ตอนสัญญาณแย่ · เปลี่ยน CACHE ทุกครั้งที่แก้ไฟล์ */
const CACHE='ummatee-v9';
const SHELL=['./','./index.html','./app.css','./icons.js','./geocode.js','./location.js','./hotlines.js','./script.js','./manifest.webmanifest','./assets/ummatee-logo.png','./assets/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>u+(u.endsWith('/')?'':'')))).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==CACHE+'-ext').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.hostname.includes('script.google')||url.hostname.includes('googleusercontent')||url.hostname.includes('photon.komoot'))return; /* ข้อมูลสดเสมอ */
  if(url.hostname==='unpkg.com'||url.hostname==='fonts.gstatic.com'||url.hostname==='fonts.googleapis.com'){
    e.respondWith(caches.open(CACHE+'-ext').then(async c=>{const hit=await c.match(req);if(hit)return hit;const r=await fetch(req);if(r.ok||r.type==='opaque')c.put(req,r.clone());return r}));return}
  if(url.origin!==location.origin)return;
  e.respondWith(fetch(req).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r})
    .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||(req.mode==='navigate'?caches.match('./index.html'):undefined))));
});
