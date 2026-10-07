/* helpme4u.com — one domain for both sites (Cloudflare Worker, Custom Domain)
     /admin, /admin.*, /admin/*, /team, /team/*, and /api (exact, ?action=…)  → admin-helpme.pages.dev (หลังบ้าน)
     everything else (/, /api/cctv, /api/geo, assets, sw.js …)                 → umplus-help.pages.dev (หน้าบ้าน Help Me)
   The upstream sites stay the single source of truth: a deploy to either Pages project shows up here immediately. */
const PUBLIC = 'https://umplus-help.pages.dev';
const ADMIN = 'https://admin-helpme.pages.dev';
const isAdmin = p => p === '/api' || p === '/admin' || p.startsWith('/admin.') || p.startsWith('/admin/') || p === '/team' || p.startsWith('/team/');

export default {
  async fetch(req) {
    const url = new URL(req.url);
    if (url.hostname === 'www.helpme4u.com') { url.hostname = 'helpme4u.com'; return Response.redirect(url.toString(), 301); }
    const origin = isAdmin(url.pathname) ? ADMIN : PUBLIC;
    const up = new URL(url.pathname + url.search, origin);
    const init = { method: req.method, headers: new Headers(req.headers), redirect: 'manual' };
    if (!['GET', 'HEAD'].includes(req.method)) init.body = req.body;
    init.headers.delete('host');
    const res = await fetch(up, init);
    // keep the visitor on helpme4u.com when an upstream redirects to its own pages.dev host
    const loc = res.headers.get('location');
    if (loc) {
      const l = new URL(loc, origin);
      if (l.origin === PUBLIC || l.origin === ADMIN) {
        const h = new Headers(res.headers);
        h.set('location', 'https://' + url.hostname + l.pathname + l.search + l.hash);
        return new Response(res.body, { status: res.status, headers: h });
      }
    }
    return res;
  },
};
