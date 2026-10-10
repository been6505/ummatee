const PUBLIC = 'https://umplus-help.pages.dev';
const ADMIN = 'https://admin-helpme.pages.dev';
const CENTER_HOST = 'central.helpme4u.com', OLD_HOSTS = ['admin.helpme4u.com', 'center.helpme4u.com'];
const under = (p, b) => p === b || p.startsWith(b + '/') || p.startsWith(b + '.');
const isCenterPath = p => ['/api', '/admin', '/center', '/central', '/team', '/call'].some(b => under(p, b));
const keepOnOld = p => ['/api', '/team', '/call'].some(b => under(p, b));

import { DurableObject } from 'cloudflare:workers';

export default {
  async scheduled(event, env, ctx) {
    const hit = () => fetch(ADMIN + '/api?action=hm_sync', { headers: { 'user-agent': 'helpme4u-router-cron' } }).catch(() => {});
    ctx.waitUntil((async () => { await hit(); await new Promise(r => setTimeout(r, 30e3)); await hit(); })());
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ptt/ws') return pttConnect(req, env, url);
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
    const loc = res.headers.get('location');
    if (loc) {
      const l = new URL(loc, origin);
      if (l.origin === PUBLIC || l.origin === ADMIN) {
        const h = new Headers(res.headers);
        h.set('location', 'https://' + url.hostname + l.pathname + l.search + l.hash);
        return new Response(res.body, { status: res.status, headers: h });
      }
    }
    if (!center && req.method === 'GET' && res.ok && String(res.headers.get('content-type') || '').includes('text/html')) {
      return new HTMLRewriter().on('head', { element(e) { e.append(`<script src="https://${CENTER_HOST}/bc.js" data-mode="public" defer></script>`, { html: true }); } }).transform(res);
    }
    return res;
  },
};

async function pttConnect(req, env, url) {
  if (req.headers.get('upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
  const q = new URLSearchParams({ action: 'ptt_auth' });
  for (const k of ['tk', 't', 'team']) if (url.searchParams.get(k)) q.set(k, url.searchParams.get(k));
  let who = null;
  try { const r = await fetch((env.ADMIN_ORIGIN || ADMIN) + '/api?' + q, { headers: { 'user-agent': 'helpme4u-ptt' } }); who = await r.json(); } catch (e) {}
  if (!who || !who.ok) return new Response('unauthorized', { status: 403 });
  const id = env.PTT.idFromName('hub'), stub = env.PTT.get(id);
  const h = new Headers(req.headers); h.set('x-ptt-who', encodeURIComponent(JSON.stringify({ name: who.name, kind: who.kind, chans: who.chans.map(c => c.id) })));
  return stub.fetch(new Request('https://ptt/ws', { headers: h }));
}
export class PttHub extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.floor = new Map();
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}')); }
  async fetch(req) {
    let who; try { who = JSON.parse(decodeURIComponent(req.headers.get('x-ptt-who') || '')); } catch (e) {}
    if (!who) return new Response('bad', { status: 400 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server); server.serializeAttachment({ ...who, talk: null });
    const busy = [...this.floor.entries()].filter(([ch]) => who.chans.includes(ch)).map(([ch, f]) => ({ ch, id: f.id, name: f.name, kind: f.kind }));
    server.send(JSON.stringify({ t: 'hello', chans: who.chans, live: busy }));
    return new Response(null, { status: 101, webSocket: client });
  }
  peers(ch, except) { return this.ctx.getWebSockets().filter(w => w !== except && (w.deserializeAttachment() || {}).chans?.includes(ch)); }
  release(ch, reason) { const f = this.floor.get(ch); if (!f) return; this.floor.delete(ch);
    try { const a = f.ws.deserializeAttachment(); if (a) { a.talk = null; f.ws.serializeAttachment(a); } } catch (e) {}
    const m = JSON.stringify({ t: 'end', ch, id: f.id, reason: reason || '' }); for (const w of this.peers(ch)) try { w.send(m); } catch (e) {} }
  sweep() { const now = Date.now(); for (const [ch, f] of this.floor) if (now - f.at > 40e3) this.release(ch, 'timeout'); }
  async webSocketMessage(ws, msg) {
    const a = ws.deserializeAttachment() || {};
    if (typeof msg !== 'string') {
      const ch = a.talk, f = ch && this.floor.get(ch); if (!f || f.ws !== ws) return;
      const tag = new TextEncoder().encode(f.id + '|'), out = new Uint8Array(tag.length + msg.byteLength); out.set(tag); out.set(new Uint8Array(msg), tag.length);
      for (const w of this.peers(ch, ws)) try { w.send(out); } catch (e) {}
      return; }
    let m; try { m = JSON.parse(msg); } catch (e) { return; }
    this.sweep();
    if (m.t === 'talk') {
      const ch = String(m.ch || ''); if (!a.chans.includes(ch)) { ws.send(JSON.stringify({ t: 'denied', ch })); return; }
      const f = this.floor.get(ch);
      if (f && f.ws !== ws) { ws.send(JSON.stringify({ t: 'busy', ch, name: f.name, kind: f.kind })); return; }
      if (a.talk && a.talk !== ch) this.release(a.talk);
      const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      this.floor.set(ch, { ws, id, at: Date.now(), name: a.name, kind: a.kind }); a.talk = ch; ws.serializeAttachment(a);
      ws.send(JSON.stringify({ t: 'granted', ch, id }));
      const s = JSON.stringify({ t: 'start', ch, id, name: a.name, kind: a.kind }); for (const w of this.peers(ch, ws)) try { w.send(s); } catch (e) {}
    } else if (m.t === 'end') { if (a.talk) { const f = this.floor.get(a.talk); if (f && f.ws === ws) this.release(a.talk); } }
  }
  async webSocketClose(ws) { const a = ws.deserializeAttachment() || {}; if (a.talk) { const f = this.floor.get(a.talk); if (f && f.ws === ws) this.release(a.talk, 'drop'); } }
  async webSocketError(ws) { return this.webSocketClose(ws); }
}
