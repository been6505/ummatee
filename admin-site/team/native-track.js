/* ตัวติดตามตำแหน่งของแอป "Help Me ทีม" (native · Capacitor)
   ใช้ไฟล์เดียวกันทั้งในหน้าทีมบนเว็บ (/team/native-track.js) และหน้าออฟไลน์ที่อยู่ในตัวแอป (สำเนาใน helpme-team-app/www)
   - เก็บค่าตั้ง (รหัสทีม/ที่อยู่ศูนย์) และคิวตำแหน่งไว้ในที่เก็บของแอป (Preferences) → เปิดแอปตอนไม่มีเน็ตก็เริ่มติดตามได้
   - ส่งสำเร็จจริงเมื่อเซิร์ฟเวอร์ตอบ OK เท่านั้น · ลิงก์ทีมใช้ไม่ได้ (403) = หยุดและแจ้ง ไม่ขึ้นสีเขียวหลอก
   - ส่งไม่ได้ = เก็บในคิว ลองใหม่ทุก 15 วิ และเมื่อเน็ตกลับมา (ไม่พึ่ง event online อย่างเดียว)
   - จำกัดถี่ ~1.5 วิ แต่เก็บจุดสุดท้ายไว้ส่งตามหลัง จุดที่ทีมหยุดจะไม่หาย · อยู่กับที่ (GPS ไม่ส่งจุดใหม่) ส่งจุดเดิมซ้ำทุก 20 วิ
   ใช้: NTRK.start({tk,host} หรือ {key,team,name,host}, onStatus) · NTRK.resume(onStatus) ใช้ค่าที่เคยเก็บไว้ */
window.NTRK = (() => {
  const C = window.Capacitor;
  const native = !!(C && C.isNativePlatform && C.isNativePlatform());
  const PL = n => C && C.Plugins && C.Plugins[n];
  const GAP = 1500, RETRY = 15000, QMAX = 300, BEAT = 20000; // ส่งถี่สุดทุก 1.5 วิ · อยู่กับที่ส่งซ้ำทุก 20 วิ (ศูนย์รู้ว่ายังออนไลน์)
  const S = { fix: null, offSince: 0, cfg: null, q: [], lastQ: 0, trail: null, trailT: null, retryT: null, busy: false, wid: null, on: null,
    st: { state: 'idle', at: 0, err: '' } };
  const get = async k => { try { const r = await PL('Preferences').get({ key: k }); return r && r.value ? JSON.parse(r.value) : null; } catch (e) { return null; } };
  const put = (k, v) => { try { return PL('Preferences').set({ key: k, value: JSON.stringify(v) }); } catch (e) {} };
  const emit = p => { if (p.err === 'offline' && !S.offSince) S.offSince = Date.now(); if (p.state === 'ok') S.offSince = 0; Object.assign(S.st, p); try { S.on && S.on({ ...S.st, queued: S.q.length }); } catch (e) {} };
  const saveQ = () => put('ntrk_q', S.q);

  /* ส่ง 1 จุด: คืน 'ok' | 'drop' (จุดเสีย ทิ้งได้) | 'fatal' (ลิงก์/รหัสใช้ไม่ได้) · โยน error = ลองใหม่ภายหลัง */
  // ข้อมูลเครื่องจากหน้าทีม (window.TELE): แบต · ชาร์จ · สัญญาณ · เครือข่าย · ค่าย
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
      // เข้าด้วยรหัสทีม (team_ping ไม่มีเวลาของจุด) ส่งเฉพาะจุดล่าสุด
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
  function enqueue(p) {
    if (S.st.state === 'fatal') return;
    S.q.push(p); if (S.q.length > QMAX) S.q = S.q.slice(-QMAX);
    S.lastQ = Date.now(); saveQ(); flush();
  }
  /* จำกัดถี่: ส่งทันทีถ้าห่างจากครั้งก่อน ≥ 8 วิ ไม่งั้นเก็บจุดล่าสุดไว้ แล้วส่งตามหลังเมื่อครบ 8 วิ */
  function onLoc(l) {
    const p = { lat: l.latitude, lng: l.longitude, acc: Math.round(l.accuracy || 0), vel: l.speed != null ? Math.round(l.speed * 3.6) : undefined,
      cog: l.bearing != null ? Math.round(l.bearing) : undefined, alt: l.altitude != null ? Math.round(l.altitude) : undefined, t: l.time || Date.now() };
    S.fix = p; put('ntrk_fix', p);
    const wait = GAP - (Date.now() - S.lastQ);
    if (wait <= 0) { S.trail = null; clearTimeout(S.trailT); S.trailT = null; enqueue(p); return; }
    S.trail = p;
    if (!S.trailT) S.trailT = setTimeout(() => { S.trailT = null; if (S.trail) { const t = S.trail; S.trail = null; enqueue(t); } }, wait);
  }
  async function watch() {
    const BG = PL('BackgroundGeolocation'); if (!BG) return;
    const old = await get('ntrk_wid'); // หน้าก่อน (เช่น หน้าออฟไลน์) เคยเปิดตัวติดตามไว้: ปิดก่อน ไม่ให้ซ้อน 2 ตัว
    if (old) { try { await BG.removeWatcher({ id: old }); } catch (e) {} }
    try {
      S.wid = await BG.addWatcher({ backgroundTitle: 'Help Me ทีม กำลังส่งตำแหน่ง', backgroundMessage: 'ศูนย์เห็นตำแหน่งทีมแบบเรียลไทม์',
        requestPermissions: true, stale: false, distanceFilter: 3 }, (l, err) => {
        if (err) { emit({ state: 'error', err: err.code === 'NOT_AUTHORIZED' ? 'denied' : String(err.message || err) }); return; }
        if (S.st.err === 'denied') emit({ err: '' });
        onLoc(l);
      });
      put('ntrk_wid', S.wid);
    } catch (e) { emit({ state: 'error', err: String(e.message || e) }); }
  }
  async function start(cfg, on) {
    if (!native) return false;
    S.on = on || S.on;
    const same = S.cfg && JSON.stringify(S.cfg) === JSON.stringify(cfg);
    S.cfg = cfg; put('ntrk_cfg', cfg);
    if (!same && S.st.state === 'fatal') emit({ state: 'idle', err: '' });
    if (!S.wid && !S.watching) { S.watching = true; S.q = (await get('ntrk_q')) || []; await watch(); } // กันเปิดตัวติดตามซ้อนเมื่อเรียก start ติดกัน
    clearInterval(S.retryT); S.retryT = setInterval(flush, RETRY);
    clearInterval(S.beatT); S.beatT = setInterval(() => { if (S.fix && Date.now() - S.lastQ > BEAT && S.st.state !== 'fatal') enqueue({ ...S.fix, t: Date.now(), vel: 0 }); }, 5000);
    addEventListener('online', flush);
    emit({}); flush();
    return true;
  }
  /* ไม่มีเน็ต: ข้อความ SMS ถึงเบอร์ศูนย์ พร้อมรหัสให้ระบบอ่านอัตโนมัติ #HM:<รหัสทีม>:<lat>,<lng>:<เวลา>[:SOS] */
  function smsText(p, kind, why, team) {
    const c = S.cfg || {}, hm = p ? new Date(p.t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '';
    const where = p ? `${p.lat.toFixed(5)},${p.lng.toFixed(5)} (±${p.acc || '?'} ม.) เวลา ${hm} https://maps.google.com/?q=${p.lat.toFixed(5)},${p.lng.toFixed(5)}` : 'หาพิกัดไม่ได้';
    const code = p && c.tk ? ` #HM:${c.tk}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}:${Math.floor(p.t / 1000)}${kind === 'SOS' ? ':SOS' : ''}` : '';
    return `Helpme+ ${kind || 'แจ้งตำแหน่ง'} ทีม ${team || c.team || ''}${why ? ' · ' + why : ''} · ${where}${code}`;
  }
  function smsHref(body) { const hq = String((S.cfg && S.cfg.hq) || '').replace(/[^\d+]/g, ''); return `sms:${hq}${/iPhone|iPad|Mac/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body)}`; }
  async function lastFix() { return S.fix || (await get('ntrk_fix')) || (S.q.length ? S.q[S.q.length - 1] : null); }
  async function resume(on) { const c = await get('ntrk_cfg'); return c ? start(c, on) : false; }
  return { native, start, resume, flush, smsText, smsHref, lastFix, offlineFor: () => S.offSince ? Date.now() - S.offSince : 0, status: () => ({ ...S.st, queued: S.q.length }),
    openSettings: () => { const BG = PL('BackgroundGeolocation'); if (BG) BG.openSettings(); } };
})();
