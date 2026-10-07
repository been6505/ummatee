/* helpme4u.com — Help Me homepage + HELP ME CENTRAL (ศูนย์สั่งการ) under one domain name (Cloudflare Worker, Custom Domains)
     helpme4u.com, www.helpme4u.com  → umplus-help.pages.dev (หน้าบ้าน Help Me)
     central.helpme4u.com            → admin-helpme.pages.dev (HELP ME CENTRAL · เดิมชื่อหลังบ้าน / Center)
     admin. / center.helpme4u.com    → ชื่อเดิม: หน้าเว็บย้ายไป central (301) · แต่ /api /team /call ยังตอบตรง
                                       เพราะลิงก์ทีม แอปติดตาม (Traccar) และลิงก์สายที่ส่งไปแล้วใช้โดเมนนี้อยู่ (บางแอปไม่ตามการย้าย)
   Center อยู่โดเมนย่อยแยกโดยตั้งใจ: แอปหน้าบ้านลง service worker ขอบเขต "/" บน helpme4u.com ที่แคชทุก GET ในโดเมน
   (ยกเว้นใต้ /api/) ถ้าหน้า Center อยู่บน helpme4u.com จะถูกแคชค้างบนเครื่องที่ใช้ร่วมกัน
   ลิงก์ CENTRAL บน helpme4u.com (/admin… /center… /central… /team… /call… /api) ส่งต่อไป central.helpme4u.com แบบ 308 (คง method + body) */
const PUBLIC = 'https://umplus-help.pages.dev';
const ADMIN = 'https://admin-helpme.pages.dev';
const CENTER_HOST = 'central.helpme4u.com', OLD_HOSTS = ['admin.helpme4u.com', 'center.helpme4u.com'];
const under = (p, b) => p === b || p.startsWith(b + '/') || p.startsWith(b + '.');
const isCenterPath = p => ['/api', '/admin', '/center', '/central', '/team', '/call'].some(b => under(p, b));
const keepOnOld = p => ['/api', '/team', '/call'].some(b => under(p, b));

export default {
  async fetch(req) {
    const url = new URL(req.url);
    if (url.hostname === 'www.helpme4u.com') { url.hostname = 'helpme4u.com'; return Response.redirect(url.toString(), 301); }
    if (OLD_HOSTS.includes(url.hostname) && !keepOnOld(url.pathname)) { url.hostname = CENTER_HOST; return Response.redirect(url.toString(), 301); }
    const center = url.hostname === CENTER_HOST || OLD_HOSTS.includes(url.hostname);
    if (!center && isCenterPath(url.pathname)) { url.hostname = CENTER_HOST; return Response.redirect(url.toString(), 308); }
    const origin = center ? ADMIN : PUBLIC;
    const up = new URL(url.pathname + url.search, origin);
    const init = { method: req.method, headers: new Headers(req.headers), redirect: 'manual' };
    if (!['GET', 'HEAD'].includes(req.method)) init.body = req.body;
    init.headers.delete('host');
    const res = await fetch(up, init);
    // keep the visitor on our hostname when an upstream redirects to its own pages.dev host
    const loc = res.headers.get('location');
    if (loc) {
      const l = new URL(loc, origin);
      if (l.origin === PUBLIC || l.origin === ADMIN) {
        const h = new Headers(res.headers);
        h.set('location', 'https://' + url.hostname + l.pathname + l.search + l.hash);
        return new Response(res.body, { status: res.status, headers: h });
      }
    }
    // หน้าบ้าน Help Me: ใส่แถบประกาศแจ้งเตือนรายพื้นที่ของ CENTRAL ลงในทุกหน้า HTML (ไม่ต้องแก้โค้ดของแอปหน้าบ้าน)
    if (!center && req.method === 'GET' && res.ok && String(res.headers.get('content-type') || '').includes('text/html')) {
      return new HTMLRewriter().on('head', { element(e) { e.append(`<script src="https://${CENTER_HOST}/bc.js" data-mode="public" defer></script>`, { html: true }); } }).transform(res);
    }
    return res;
  },
};
