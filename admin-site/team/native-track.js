window.NTRK = (() => {
  const C = window.Capacitor;
  const native = !!(C && C.isNativePlatform && C.isNativePlatform());
  const PL = n => C && C.Plugins && C.Plugins[n];
  const GAP = 1500, RETRY = 15000, QMAX = 300, BEAT = 20000;
  const S = { fix: null, offSince: 0, cfg: null, q: [], lastQ: 0, trail: null, trailT: null, retryT: null, busy: false, wid: null, on: null,
    st: { state: 'idle', at: 0, err: '' } };
  const get = async k => { try { const r = await PL('Preferences').get({ key: k }); return r && r.value ? JSON.parse(r.value) : null; } catch (e) { return null; } };
  const put = (k, v) => { try { return PL('Preferences').set({ key: k, value: JSON.stringify(v) }); } catch (e) {} };
  const emit = p => { if (p.err === 'offline' && !S.offSince) S.offSince = Date.now(); if (p.state === 'ok') S.offSince = 0; Object.assign(S.st, p); try { S.on && S.on({ ...S.st, queued: S.q.length }); } catch (e) {} };
  const saveQ = () => put('ntrk_q', S.q);

  const tele = () => { const T = window.TELE || {}; return { batt: T.batt ?? undefined, chg: T.charging == null ? undefined : (T.charging ? 1 : 0), sig: T.sig ?? undefined, net: T.net || undefined, carrier: T.carrier || undefined }; };
  async function send(p) {
    const c = S.cfg;
    if (c.tk) {
      const r = await fetch(c.host + '/api/track/' + c.tk, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _type: 'location', lat: p.lat, lon: p.lng, acc: p.acc, vel: p.vel, cog: p.cog, tst: Math.floor(p.t / 1000), alt: p.alt, ...tele() }) });
      if (r.ok) return 'ok';
      if (r.status === 403) return 'fatal';
      if (r.status === 400) return 'drop';
      throw new Error('HTTP ' + r.status);
    }
    const r = await fetch(c.host + '/api', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'team_ping', key: c.key, team: c.team, name: c.name || '', lat: p.lat, lng: p.lng, accuracy: p.acc, speed: p.vel, heading: p.cog, alt: p.alt, battery: (window.TELE || {}).batt, charging: (window.TELE || {}).charging, sig: (window.TELE || {}).sig, net: (window.TELE || {}).net, carrier: (window.TELE || {}).carrier }) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json().catch(() => ({}));
    if (j.ok) return 'ok';
    if (j.error === 'not_volunteer' || j.error === 'bad_link') return 'fatal';
    return 'drop';
  }
  async function flush() {
    if (S.busy || !S.cfg || !S.q.length) return;
    S.busy = true;
    try {
      if (!S.cfg.tk && S.q.length > 1) S.q = S.q.slice(-1);
      while (S.q.length) {
        let res;
        try { res = await send(S.q[0]); }
        catch (e) { emit({ state: 'offline', err: 'offline' }); break; }
        if (res === 'fatal') { S.q = []; saveQ(); emit({ state: 'fatal', err: S.cfg.tk ? 'bad_link' : 'bad_key' }); break; }
        S.q.shift(); saveQ();
        if (res === 'ok') emit({ state: 'ok', at: Date.now(), err: '' });
      }
    } finally { S.busy = false; }
  }
  const dm = (a, b) => { const R = 6371e3, x = (b.lat - a.lat) * Math.PI / 180, y = (b.lng - a.lng) * Math.PI / 180, h = Math.sin(x / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const DS = () => PL('DeviceSense');
  async function svc() {
    const d = DS(); if (!d || !d.trackStart || !S.cfg || !S.cfg.tk || S.svc) return;
    try { await d.trackStart({ host: S.cfg.host, tk: S.cfg.tk }); } catch (e) { return; }
    S.svc = true; put('ntrk_svc', 1); flush();
    const BG = PL('BackgroundGeolocation'); if (BG && S.wid) { try { await BG.removeWatcher({ id: S.wid }); } catch (e) {} S.wid = null; put('ntrk_wid', null); }
    clearInterval(S.beatT); clearInterval(S.retryT);
    const poll = async () => { try { const r = await d.trackStatus(); if (r.fix) { S.fix = { ...r.fix, t: r.fix.t || r.fixAt }; put('ntrk_fix', S.fix); }
      if (r.err === 'denied') emit({ state: 'error', err: 'denied' }); else if (r.err === 'bad_link') emit({ state: 'fatal', err: 'bad_link' });
      else if (r.err === 'offline') emit({ state: 'offline', err: 'offline', queued: r.queued }); else if (r.okAt) emit({ state: 'ok', at: r.okAt, err: '' });
      S.battOpt = !!r.battOpt; if (!r.on && S.cfg) d.trackStart({ host: S.cfg.host, tk: S.cfg.tk }).catch(() => {}); } catch (e) {} };
    clearInterval(S.pollT); S.pollT = setInterval(poll, 4000); poll();
    if (!(await get('ntrk_bopt'))) { put('ntrk_bopt', 1); setTimeout(() => d.batteryOpt().catch(() => {}), 3000); }
  }
  function enqueue(p) {
    if (S.svc) return;
    S.lastSent = p;
    if (S.st.state === 'fatal') return;
    S.q.push(p); if (S.q.length > QMAX) S.q = S.q.slice(-QMAX);
    S.lastQ = Date.now(); saveQ(); flush();
  }
  function onLoc(l) {
    const p = { lat: l.latitude, lng: l.longitude, acc: Math.round(l.accuracy || 0), vel: l.speed != null ? Math.round(l.speed * 3.6) : undefined,
      cog: l.bearing != null ? Math.round(l.bearing) : undefined, alt: l.altitude != null ? Math.round(l.altitude) : undefined, t: l.time || Date.now() };
    S.fix = p; put('ntrk_fix', p);
    if ((p.vel == null || p.vel < 2) && S.lastSent && dm(S.lastSent, p) < 10 && Date.now() - S.lastQ < BEAT) return;
    const wait = GAP - (Date.now() - S.lastQ);
    if (wait <= 0) { S.trail = null; clearTimeout(S.trailT); S.trailT = null; enqueue(p); return; }
    S.trail = p;
    if (!S.trailT) S.trailT = setTimeout(() => { S.trailT = null; if (S.trail) { const t = S.trail; S.trail = null; enqueue(t); } }, wait);
  }
  async function watch() {
    const BG = PL('BackgroundGeolocation'); if (!BG) return;
    const old = await get('ntrk_wid');
    if (old) { try { await BG.removeWatcher({ id: old }); } catch (e) {} }
    try {
      S.wid = await BG.addWatcher({ backgroundTitle: 'Help Me ทีม กำลังส่งตำแหน่ง', backgroundMessage: 'ศูนย์เห็นตำแหน่งทีมแบบเรียลไทม์',
        requestPermissions: true, stale: false, distanceFilter: 3 }, (l, err) => {
        if (err) { emit({ state: 'error', err: err.code === 'NOT_AUTHORIZED' ? 'denied' : String(err.message || err) }); return; }
        if (S.st.err === 'denied') emit({ err: '' });
        onLoc(l); svc();
      });
      put('ntrk_wid', S.wid);
    } catch (e) { emit({ state: 'error', err: String(e.message || e) }); }
  }
  async function start(cfg, on) {
    if (!native) return false;
    S.on = on || S.on;
    const same = S.cfg && JSON.stringify(S.cfg) === JSON.stringify(cfg);
    if (!same) S.svc = false;
    if (cfg.tk && crypto.subtle) crypto.subtle.digest('SHA-256', new TextEncoder().encode(cfg.tk + ':sms')).then(d => { S.smsc = [...new Uint8Array(d)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join(''); }).catch(() => {});
    S.cfg = cfg; { const { key, ...safe } = cfg; put('ntrk_cfg', cfg.tk ? safe : cfg); }
    if (!same && S.st.state === 'fatal') emit({ state: 'idle', err: '' });
    if (!S.wid && !S.watching) { S.watching = true; S.q = (await get('ntrk_q')) || []; await watch(); }
    if ((await get('ntrk_svc')) && !S.svc) svc();
    if (S.svc) { emit({}); return true; }
    clearInterval(S.retryT); S.retryT = setInterval(flush, RETRY);
    clearInterval(S.beatT); S.beatT = setInterval(() => { if (S.fix && Date.now() - S.lastQ > BEAT && S.st.state !== 'fatal') enqueue({ ...S.fix, t: Date.now(), vel: 0 }); }, 5000);
    addEventListener('online', flush);
    emit({}); flush();
    return true;
  }
  function smsText(p, kind, why, team) {
    const c = S.cfg || {}, hm = p ? new Date(p.t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
    const where = p ? `${p.lat.toFixed(5)},${p.lng.toFixed(5)} (±${p.acc || '?'} ม.) เวลา ${hm} https://maps.google.com/?q=${p.lat.toFixed(5)},${p.lng.toFixed(5)}` : 'หาพิกัดไม่ได้';
    const code = p && c.tk ? ` #HM:${S.smsc || c.tk}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}:${Math.floor(p.t / 1000)}${kind === 'SOS' ? ':SOS' : ''}` : '';
    return `Helpme+ ${kind || 'แจ้งตำแหน่ง'} ทีม ${team || c.team || ''}${why ? ' · ' + why : ''} · ${where}${code}`;
  }
  function smsHref(body) { const hq = String((S.cfg && S.cfg.hq) || '').replace(/[^\d+]/g, ''); return `sms:${hq}${/iPhone|iPad|Mac/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`; }
  async function lastFix() { return S.fix || (await get('ntrk_fix')) || (S.q.length ? S.q[S.q.length - 1] : null); }
  async function resume(on) { const c = await get('ntrk_cfg'); return c ? start(c, on) : false; }
  return { native, start, resume, flush, smsText, smsHref, lastFix, offlineFor: () => S.offSince ? Date.now() - S.offSince : 0, status: () => ({ ...S.st, queued: S.q.length }), battOpt: () => !!S.battOpt, fixBatt: () => { const d = DS(); if (d && d.batteryOpt) d.batteryOpt().catch(() => {}); },
    openSettings: () => { const BG = PL('BackgroundGeolocation'); if (BG) BG.openSettings(); } };
})();
