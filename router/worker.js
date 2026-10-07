/* helpme4u.com — Help Me homepage + admin under one domain name (Cloudflare Worker, Custom Domains)
     helpme4u.com, www.helpme4u.com  → umplus-help.pages.dev (หน้าบ้าน Help Me)
     admin.helpme4u.com              → admin-helpme.pages.dev (หลังบ้าน)
   The admin lives on its own subdomain on purpose: the public app registers a service worker with
   scope "/" on helpme4u.com that caches same-origin GETs (and only skips paths under /api/), so admin
   pages or the admin API on helpme4u.com would be cached, replayed stale and kept on shared phones.
   Old admin links on helpme4u.com (/admin…, /team…, /api) are 308-redirected (method + body kept).
   The upstream sites stay the single source of truth: a deploy to either Pages project shows up here. */
const PUBLIC = 'https://umplus-help.pages.dev';
const ADMIN = 'https://admin-helpme.pages.dev';
const ADMIN_HOST = 'admin.helpme4u.com';
const isAdminPath = p => p === '/api' || p === '/admin' || p.startsWith('/admin.') || p.startsWith('/admin/') || p === '/team' || p.startsWith('/team/');

export default {
  async fetch(req) {
    const url = new URL(req.url);
    if (url.hostname === 'www.helpme4u.com') { url.hostname = 'helpme4u.com'; return Response.redirect(url.toString(), 301); }
    if (url.hostname !== ADMIN_HOST && isAdminPath(url.pathname)) {
      url.hostname = ADMIN_HOST;
      return Response.redirect(url.toString(), 308);
    }
    const origin = url.hostname === ADMIN_HOST ? ADMIN : PUBLIC;
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
    return res;
  },
};
