// UM+: เก็บหน้าเว็บไว้ในเครื่อง ให้เปิดเบอร์ฉุกเฉินได้แม้สัญญาณแย่
const CACHE='umplus-v9';
const SHELL=['./','./index.html','./styles.css','./emergency.css','./mobile.css','./hotlines.js','./location.js','./script.js','./assets/ummatee-logo.png','./assets/icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(SHELL.map(u=>c.add(u)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.hostname.includes('script.google')||url.hostname.includes('googleusercontent'))return; // ข้อมูลเคสต้องสดเสมอ
  if(url.origin===location.origin){
    e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));return r}).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));
  }
});
