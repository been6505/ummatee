/* UM+ บน Cloudflare Workers — API แทน Google Apps Script + ฐานข้อมูล D1
   ใช้ร่วมกัน: Worker ummatee-help (หน้าประชาชน + cron สำรอง) และ Pages admin-um-help (หลังบ้าน, ไฟล์นี้เป็น _worker.js) ผูก D1 ตัวเดียวกันชื่อ DB
   Secret: VOLUNTEER_KEY (รหัสทีม), SHEET_BACKUP_URL + SHEET_BACKUP_KEY (สำรองลง Google Sheet ทุก 1 นาที)
   รูปแบบคำขอเหมือน Code.gs เดิมทุกอย่าง: GET /api?action=... และ POST /api (JSON) */

const STATUSES = ['open', 'going', 'done'];
const LEVELS = ['ankle', 'knee', 'waist', 'chest', 'roof'];
const MAX = { name: 60, phone: 20, district: 40, address: 300, notes: 800, volunteer: 60 };
const TEAM_FRESH_MS = 3 * 3600e3;
const PLACE_TYPES = ['rescue', 'halal', 'kitchen'];
const ROSTER_STATUS = ['ready', 'out', 'rest'];
const VEHICLES = ['boat', 'truck', 'pickup', 'car', 'motorbike', 'foot', 'other'];
const STOCK_SEED = [
  ['บะหมี่กึ่งสำเร็จรูป', 'ห่อ', 'อาหาร'], ['ปลากระป๋อง', 'กระป๋อง', 'อาหาร'], ['ไข่', 'ฟอง', 'อาหาร'], ['ยูโร่ / ขนม', 'ชิ้น', 'อาหาร'],
  ['ข้าวสาร', 'ถุง', 'อาหาร'], ['น้ำดื่ม', 'แพ็ค', 'อาหาร'], ['ยาแก้แพ้', 'แผง', 'ยา'], ['พลาสเตอร์', 'ซอง', 'ยา'], ['ผงเกลือแร่', 'ซอง', 'ยา'],
  ['ยาพารา', 'แผง', 'ยา'], ['ยาฆ่าเชื้อรา', 'ชิ้น', 'ยา'], ['ยาแก้น้ำกัดเท้า (ขี้ผึ้ง)', 'ตลับ', 'ยา'], ['ยากันยุง', 'ขวด', 'ยา'], ['ยาหยอดตา', 'ขวด', 'ยา'],
  ['ยาทาผิวหนังอักเสบ', 'หลอด', 'ยา'], ['ยาป้องกันโรคฉี่หนู', 'แผง', 'ยา'], ['ชุดยารวม', 'ชุด', 'ยา'], ['น้ำเกลือ (100 ml)', 'ขวดเล็ก', 'ยา'],
  ['ถุงยังชีพ', 'ถุง', 'ถุงยังชีพ'], ['รองเท้าบูท', 'คู่', 'ของใช้']
];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, createdAt INTEGER, status TEXT, urgency INTEGER, name TEXT, phone TEXT, district TEXT,
    people INTEGER, address TEXT, lat REAL, lng REAL, level TEXT, needs TEXT, vulnerable TEXT, notes TEXT, volunteer TEXT, updatedAt INTEGER,
    token TEXT, clientId TEXT, households INTEGER, bags INTEGER, cctv TEXT, ipHash TEXT)`,
  `CREATE INDEX IF NOT EXISTS cases_client ON cases(clientId)`,
  `CREATE INDEX IF NOT EXISTS cases_updated ON cases(updatedAt)`,
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`,
  `CREATE TABLE IF NOT EXISTS teams_live (team TEXT PRIMARY KEY, lat REAL, lng REAL, accuracy INTEGER, caseId TEXT, updatedAt INTEGER)`,
  `CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, type TEXT, name TEXT, lat REAL, lng REAL, phone TEXT, note TEXT, active INTEGER, updatedAt INTEGER, by_ TEXT)`,
  `CREATE TABLE IF NOT EXISTS roster (id TEXT PRIMARY KEY, name TEXT, leader TEXT, phone TEXT, members INTEGER, vehicle TEXT, zone TEXT, status TEXT, note TEXT, active INTEGER, updatedAt INTEGER, by_ TEXT)`,
  `CREATE TABLE IF NOT EXISTS stock (id TEXT PRIMARY KEY, name TEXT, unit TEXT, category TEXT, qty INTEGER, min INTEGER, needed INTEGER, note TEXT, updatedAt INTEGER)`,
  `CREATE TABLE IF NOT EXISTS stock_log (n INTEGER PRIMARY KEY AUTOINCREMENT, time INTEGER, itemId TEXT, item TEXT, type TEXT, delta INTEGER, after INTEGER, note TEXT, caseId TEXT, by_ TEXT)`,
  // คิวสำรองข้อมูล: ทุกแถวที่เพิ่ม/แก้จะถูกจดไว้ แล้ว cron ส่งไป Google Sheet ส่งไม่ผ่านก็ค้างคิวไว้ส่งรอบหน้า
  `CREATE TABLE IF NOT EXISTS zones (id TEXT PRIMARY KEY, name TEXT, color TEXT, lat REAL, lng REAL, radius INTEGER, note TEXT, active INTEGER, updatedAt INTEGER, by_ TEXT)`,
  `CREATE TABLE IF NOT EXISTS covered_extra (n INTEGER PRIMARY KEY AUTOINCREMENT, org TEXT, date TEXT, items TEXT, qty TEXT, place TEXT, location TEXT, by_ TEXT, createdAt INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sync_queue (n INTEGER PRIMARY KEY AUTOINCREMENT, tbl TEXT, rid TEXT)`,
  // เคสที่เจอจากโซเชียล/Traffy (Hermes agent หรือปุ่มดึง) รอแอดมินคัด: รับเป็นเคสจริง หรือตัดทิ้ง · ไม่สำรองลงชีตจนกว่าจะรับเป็นเคส
  `CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, url TEXT UNIQUE, source TEXT, postedAt INTEGER, foundAt INTEGER, title TEXT, text TEXT,
    district TEXT, address TEXT, lat REAL, lng REAL, needs TEXT, urgency INTEGER, people TEXT, names TEXT, phone TEXT, flags TEXT,
    status TEXT, reason TEXT, caseId TEXT, by_ TEXT, updatedAt INTEGER)`,
  `CREATE INDEX IF NOT EXISTS leads_status ON leads(status, postedAt)`,
  // แชทระหว่างศูนย์ (hq) กับทีม · อ่านแล้ว/ยังไม่อ่าน แยกฝั่ง
  `CREATE TABLE IF NOT EXISTS chat (n INTEGER PRIMARY KEY AUTOINCREMENT, team TEXT, sender TEXT, name TEXT, text TEXT, caseId TEXT, lat REAL, lng REAL, at INTEGER, readHq INTEGER DEFAULT 0, readTeam INTEGER DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS chat_team ON chat(team, n)`,
  // เส้นทางของทีม (จุดที่ทีมผ่าน) ใช้ดูย้อนหลังในหน้าติดตามทีม · เก็บ 7 วัน
  `CREATE TABLE IF NOT EXISTS team_track (n INTEGER PRIMARY KEY AUTOINCREMENT, team TEXT, lat REAL, lng REAL, accuracy INTEGER, battery INTEGER, speed REAL, at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS team_track_team ON team_track(team, n)`
];
const BACKUP_TABLES = { cases: 'id', roster: 'id', stock: 'id', places: 'id', stock_log: 'n', zones: 'id' };
const BACKUP_OMIT = { cases: ['token', 'ipHash', 'clientId'], roster: ['token'] }; // ไม่ส่งรหัสติดตามเคสและข้อมูลกันสแปมไปที่ชีต
for (const [t, k] of Object.entries(BACKUP_TABLES)) {
  SCHEMA.push(`CREATE TRIGGER IF NOT EXISTS q_${t}_ins AFTER INSERT ON ${t} BEGIN INSERT INTO sync_queue (tbl,rid) VALUES ('${t}', NEW.${k}); END`);
  if (t !== 'stock_log') SCHEMA.push(`CREATE TRIGGER IF NOT EXISTS q_${t}_upd AFTER UPDATE ON ${t} BEGIN INSERT INTO sync_queue (tbl,rid) VALUES ('${t}', NEW.${k}); END`);
}
let ready = null;
async function init(db) {
  if (!ready) ready = (async () => {
    await db.batch(SCHEMA.map(s => db.prepare(s)));
    for (const col of ['expiry TEXT', 'location TEXT']) { try { await db.prepare('ALTER TABLE stock ADD COLUMN ' + col).run(); } catch (e) {} }
    try { await db.prepare('ALTER TABLE stock_log ADD COLUMN team TEXT').run(); } catch (e) {}
    try { await db.prepare('ALTER TABLE stock ADD COLUMN kit TEXT').run(); } catch (e) {}
    // ระบบสนับสนุนทีม: ลิงก์เฉพาะทีม (token) · SOS · แบตเตอรี่/ความเร็ว · สายโทรในแอป
    for (const [t, col] of [['roster', 'token TEXT'], ['roster', 'sosAt INTEGER'], ['roster', 'sosAck INTEGER'], ['teams_live', 'battery INTEGER'], ['teams_live', 'speed REAL'],
      ['teams_live', 'heading REAL'], ['chat', 'kind TEXT'], ['chat', 'link TEXT']]) { try { await db.prepare(`ALTER TABLE ${t} ADD COLUMN ${col}`).run(); } catch (e) {} }
    await db.prepare('CREATE INDEX IF NOT EXISTS roster_token ON roster(token)').run(); // ของในถุงยังชีพ 1 ถุง: [{id, qty}] // ทีม/รถที่รับของ (เช่น ถุงยังชีพขึ้นรถ)
    const c = await db.prepare('SELECT COUNT(*) n FROM stock').first();
    if (!c.n) {
      const now = Date.now();
      await db.batch(STOCK_SEED.map((x, i) => db.prepare('INSERT INTO stock (id,name,unit,category,qty,min,needed,note,updatedAt) VALUES (?,?,?,?,0,NULL,?,?,?)')
        .bind('S' + String(i + 1).padStart(2, '0'), x[0], x[1], x[2], x[0] === 'รองเท้าบูท' ? 1 : 0, '', now)));
    }
    // ครั้งแรกที่เปิดระบบสำรอง: ใส่ทุกแถวที่มีอยู่แล้วเข้าคิว จะได้สำรองครบ
    if (!await getMeta(db, 'backup_seeded')) {
      await db.batch(Object.entries(BACKUP_TABLES).map(([t, k]) => db.prepare(`INSERT INTO sync_queue (tbl,rid) SELECT '${t}', ${k} FROM ${t}`)));
      await setMeta(db, 'backup_seeded', String(Date.now()));
    }
  })().catch(e => { ready = null; throw e; });
  return ready;
}

/* ---------- helpers ---------- */
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const clampInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); };
const num = (v, lo, hi) => { const n = Number(v); return (v === '' || v == null || isNaN(n) || n < lo || n > hi) ? null : Math.round(n * 1e6) / 1e6; };
const list = a => (Array.isArray(a) ? a : []).map(x => clean(x, 40).replace(/,/g, '')).filter(Boolean).slice(0, 12);
const maskPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length < 4 ? '***' : 'xxx-xxx-' + d.slice(-4); };
const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
function isVol(env, key) {
  const real = String(env.VOLUNTEER_KEY || ''), k = String(key || '');
  if (!real || !k || real.length !== k.length) return false;
  let d = 0; for (let i = 0; i < real.length; i++) d |= real.charCodeAt(i) ^ k.charCodeAt(i);
  return d === 0;
}
function urgency(c) {
  const label = String(c.urgencyLabel || ''), needs = c.needs.join(' ');
  if (label.includes('ด่วนมาก') || label.includes('ชีวิต') || c.level === 'chest' || c.level === 'roof' ||
      c.vulnerable.includes('bedridden') || c.vulnerable.includes('oxygen')) return 3;
  if (label.includes('เร็ว') || c.level === 'waist' || c.vulnerable.length || needs.includes('ผู้ป่วย') || needs.includes('อพยพ')) return 2;
  return 1;
}
function caseId() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const g = t => (p.find(x => x.type === t) || {}).value || '00';
  return 'C' + g('month') + g('day') + g('hour').replace('24', '00') + g('minute') + '-' + rand(2).toUpperCase();
}
async function getMeta(db, k) { const r = await db.prepare('SELECT v FROM meta WHERE k=?').bind(k).first(); return r ? r.v : ''; }
async function setMeta(db, k, v) { await db.prepare('INSERT INTO meta (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k, String(v)).run(); }
async function bumpRev(db) { await db.prepare("INSERT INTO meta (k,v) VALUES ('rev',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(String(Date.now())).run(); }
const km = (a, b, c, d) => { const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(''); }

function outCase(r, full) {
  const o = { id: r.id, createdAt: r.createdAt, status: r.status, urgency: r.urgency, name: r.name || '', phone: r.phone || '', district: r.district || '',
    people: r.people, address: r.address || '', lat: r.lat == null ? '' : r.lat, lng: r.lng == null ? '' : r.lng, level: r.level || '',
    needs: r.needs ? String(r.needs).split(/\s*,\s*/).filter(Boolean) : [], vulnerable: r.vulnerable ? String(r.vulnerable).split(/\s*,\s*/).filter(Boolean) : [],
    notes: r.notes || '', volunteer: r.volunteer || '', updatedAt: r.updatedAt, households: r.households == null ? '' : r.households,
    bags: r.bags == null ? '' : r.bags, cctv: r.cctv || '' };
  if (!full) { o.phone = maskPhone(o.phone); o.name = o.name ? o.name.slice(0, 1) + '***' : ''; o.notes = ''; }
  return o;
}

/* ---------- actions ---------- */
async function createCase(db, b, ip) {
  if (b.website) return { ok: true, id: 'ignored' };
  const c = {
    name: clean(b.name, MAX.name), phone: clean(b.phone, MAX.phone).replace(/[^\d+\-\s]/g, ''), district: clean(b.district, MAX.district),
    people: clampInt(b.people, 1, 999, 1), households: clampInt(b.households, 1, 999, 1), address: clean(b.address, MAX.address),
    lat: num(b.lat, -90, 90), lng: num(b.lng, -180, 180), level: LEVELS.includes(b.level) ? b.level : '',
    needs: list(b.needs), vulnerable: list(b.vulnerable), notes: clean(b.notes || b.details, MAX.notes), urgencyLabel: clean(b.urgencyLabel || b.urgency, 60)
  };
  const missing = [];
  if (c.phone.replace(/\D/g, '').length < 9) missing.push('phone');
  if (!c.address && (c.lat == null || c.lng == null)) missing.push('address_or_pin');
  if (missing.length) return { ok: false, error: 'missing', fields: missing };
  const cid = clean(b.clientId, 40).replace(/[^\w-]/g, '');
  if (cid) { const d = await db.prepare('SELECT id, token, urgency FROM cases WHERE clientId=?').bind(cid).first(); if (d) return { ok: true, id: d.id, token: d.token, urgency: d.urgency, duplicate: true }; }
  const ipHash = ip ? await sha('um+' + ip) : '';
  if (ipHash) { const r = await db.prepare('SELECT COUNT(*) n FROM cases WHERE ipHash=? AND createdAt>?').bind(ipHash, Date.now() - 10 * 60e3).first(); if (r.n >= 15) return { ok: false, error: 'too_many' }; }
  const now = Date.now(), id = caseId(), token = rand(16), u = urgency(c);
  await db.prepare(`INSERT INTO cases (id,createdAt,status,urgency,name,phone,district,people,address,lat,lng,level,needs,vulnerable,notes,volunteer,updatedAt,token,clientId,households,bags,cctv,ipHash)
    VALUES (?,?,'open',?,?,?,?,?,?,?,?,?,?,?,?,'',?,?,?,?,NULL,'',?)`)
    .bind(id, now, u, c.name, c.phone, c.district, c.people, c.address, c.lat, c.lng, c.level, c.needs.join(', '), c.vulnerable.join(', '), c.notes, now, token, cid || null, c.households, ipHash).run();
  await bumpRev(db);
  return { ok: true, id, urgency: u, token };
}
async function updateCase(db, b) {
  if (!STATUSES.includes(b.status)) return { ok: false, error: 'bad_status' };
  const r = await db.prepare('SELECT * FROM cases WHERE id=?').bind(String(b.id)).first();
  if (!r) return { ok: false, error: 'not_found' };
  const meta = !!(b.bagsOnly || b.metaOnly) && r.status === b.status;
  const sets = [], vals = [];
  let bags = null;
  if (b.bags !== undefined && b.bags !== null) { bags = b.bags === '' ? null : clampInt(b.bags, 0, 9999, 0); sets.push('bags=?'); vals.push(bags); }
  if (b.cctv !== undefined && ['flood', 'clear', ''].includes(String(b.cctv))) {
    const t = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    sets.push('cctv=?'); vals.push(b.cctv ? b.cctv + '|' + t : '');
  }
  if (!meta) {
    sets.push('status=?', 'updatedAt=?'); vals.push(b.status, Date.now());
    if (b.status === 'open') sets.push("volunteer=''");
    else if (b.volunteer) { sets.push('volunteer=?'); vals.push(clean(b.volunteer, MAX.volunteer)); }
  }
  if (sets.length) await db.prepare(`UPDATE cases SET ${sets.join(',')} WHERE id=?`).bind(...vals, r.id).run();
  await bumpRev(db);
  return { ok: true, bags, bagsSupported: true };
}
async function readTeams(db) {
  const { results } = await db.prepare('SELECT * FROM teams_live WHERE updatedAt>?').bind(Date.now() - TEAM_FRESH_MS).all();
  return results.map(t => ({ team: t.team, lat: t.lat, lng: t.lng, accuracy: t.accuracy, caseId: t.caseId || '', updatedAt: t.updatedAt,
    battery: t.battery == null ? null : t.battery, speed: t.speed == null ? null : t.speed, heading: t.heading == null ? null : t.heading }));
}
async function pingTeam(db, b) {
  const team = clean(b.team, MAX.volunteer);
  if (!team) return { ok: false, error: 'missing_team' };
  if (b.stop) { await db.prepare('DELETE FROM teams_live WHERE team=?').bind(team).run(); return { ok: true, stopped: true }; }
  const lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180);
  if (lat == null || lng == null) return { ok: false, error: 'bad_location' };
  const now = Date.now(), acc = clampInt(b.accuracy, 0, 100000, null), batt = clampInt(b.battery, 0, 100, null), speed = num(b.speed, 0, 200), heading = num(b.heading, 0, 360);
  await db.prepare('INSERT INTO teams_live (team,lat,lng,accuracy,caseId,updatedAt,battery,speed,heading) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(team) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,caseId=excluded.caseId,updatedAt=excluded.updatedAt,battery=excluded.battery,speed=excluded.speed,heading=excluded.heading')
    .bind(team, lat, lng, acc, clean(b.caseId, 30), now, batt, speed, heading).run();
  // จุดเส้นทาง: เก็บเมื่อขยับเกิน 20 ม. หรือห่างจุดก่อน 2 นาที
  const last = await db.prepare('SELECT lat,lng,at FROM team_track WHERE team=? ORDER BY n DESC LIMIT 1').bind(team).first();
  if (!last || km(last.lat, last.lng, lat, lng) > 0.02 || now - last.at > 120e3) {
    await db.prepare('INSERT INTO team_track (team,lat,lng,accuracy,battery,speed,at) VALUES (?,?,?,?,?,?,?)').bind(team, lat, lng, acc, batt, speed, now).run();
    if (Math.random() < 0.02) await db.prepare('DELETE FROM team_track WHERE at<?').bind(now - 7 * 86400e3).run();
  }
  return { ok: true };
}
async function teamTrack(db, p) {
  const team = clean(p.team, MAX.volunteer);
  if (!team) return { ok: false, error: 'missing_team' };
  const { results } = await db.prepare('SELECT lat,lng,accuracy,battery,speed,at FROM team_track WHERE team=? AND at>? ORDER BY n LIMIT 3000')
    .bind(team, Date.now() - clampInt(p.hours, 1, 168, 6) * 3600e3).all();
  return { ok: true, team, points: results };
}
const areaCache = new Map();
async function areaName(lat, lng) {
  const k = lat.toFixed(3) + ',' + lng.toFixed(3);
  if (areaCache.has(k)) return areaCache.get(k);
  let name = '';
  try {
    const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1`, { headers: { 'user-agent': 'UMplus-flood-help/1.0' }, cf: { cacheTtl: 1800 } });
    const p = ((await r.json()).features || [])[0]?.properties || {};
    name = [p.street, p.district || p.locality, p.city || p.county].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3).join(' · ');
  } catch (e) {}
  areaCache.set(k, name);
  return name;
}
async function trackCase(db, b) {
  const id = clean(b.id, 30), cidQ = clean(b.clientId, 40), token = clean(b.token, 64);
  if ((!id && !cidQ) || !token) return { ok: false, error: 'missing' };
  const r = id ? await db.prepare('SELECT * FROM cases WHERE id=?').bind(id).first() : await db.prepare('SELECT * FROM cases WHERE clientId=?').bind(cidQ).first();
  if (!r) return { ok: false, error: 'not_found' };
  if (!r.token || r.token !== token) return { ok: false, error: 'forbidden' };
  const out = { ok: true, id: r.id, status: r.status, volunteer: r.status === 'open' ? '' : (r.volunteer || ''), updatedAt: r.updatedAt, team: null };
  if (r.status === 'going' && r.volunteer) {
    const t = (await readTeams(db)).find(x => x.team === r.volunteer);
    if (t) out.team = { area: await areaName(t.lat, t.lng), km: r.lat != null ? Math.round(km(t.lat, t.lng, r.lat, r.lng) * 10) / 10 : null, updatedAt: t.updatedAt };
  }
  return out;
}
async function listPlaces(db) {
  const { results } = await db.prepare('SELECT id,type,name,lat,lng,phone,note,active,updatedAt FROM places WHERE active=1').all();
  return { ok: true, places: results.map(p => ({ ...p, active: true })) };
}
async function savePlace(db, b) {
  const type = PLACE_TYPES.includes(b.type) ? b.type : '', name = clean(b.name, 80), lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180);
  const active = b.active === false ? 0 : 1;
  if (b.id && !active) { await db.prepare('UPDATE places SET active=0, updatedAt=? WHERE id=?').bind(Date.now(), clean(b.id, 20)).run(); return { ok: true, id: b.id }; }
  if (!type || !name || lat == null || lng == null) return { ok: false, error: 'missing' };
  const id = clean(b.id, 20) || ('P' + Date.now().toString(36).toUpperCase() + rand(1).toUpperCase());
  await db.prepare('INSERT INTO places (id,type,name,lat,lng,phone,note,active,updatedAt,by_) VALUES (?,?,?,?,?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET type=excluded.type,name=excluded.name,lat=excluded.lat,lng=excluded.lng,phone=excluded.phone,note=excluded.note,active=1,updatedAt=excluded.updatedAt,by_=excluded.by_')
    .bind(id, type, name, lat, lng, clean(b.phone, 30).replace(/[^\d+\-\s,]/g, ''), clean(b.note, 300), Date.now(), clean(b.by, 60)).run();
  return { ok: true, id };
}
async function saveRoster(db, b) {
  const t = b.team || {}, name = clean(t.name, MAX.volunteer);
  if (!name) return { ok: false, error: 'missing_name' };
  const id = clean(t.id, 20).replace(/[^\w-]/g, '') || ('T' + rand(4));
  const old = await db.prepare('SELECT id FROM roster WHERE id=?').bind(id).first();
  if (!old) { const dup = await db.prepare('SELECT id FROM roster WHERE active=1 AND name=?').bind(name).first(); if (dup) return { ok: false, error: 'duplicate_name' }; }
  await db.prepare(`INSERT INTO roster (id,name,leader,phone,members,vehicle,zone,status,note,active,updatedAt,by_) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,leader=excluded.leader,phone=excluded.phone,members=excluded.members,vehicle=excluded.vehicle,zone=excluded.zone,status=excluded.status,note=excluded.note,active=excluded.active,updatedAt=excluded.updatedAt,by_=excluded.by_`)
    .bind(id, name, clean(t.leader, 60), clean(t.phone, 20).replace(/[^\d+\-\s]/g, ''), clampInt(t.members, 0, 999, null), VEHICLES.includes(t.vehicle) ? t.vehicle : '',
      clean(t.zone, 80), ROSTER_STATUS.includes(t.status) ? t.status : 'ready', clean(t.note, 300), t.active === false ? 0 : 1, Date.now(), clean(b.by, 60)).run();
  return { ok: true, id };
}
async function listRoster(db) {
  const { results } = await db.prepare('SELECT id,name,leader,phone,members,vehicle,zone,status,note,updatedAt,token,sosAt,sosAck FROM roster WHERE active=1 ORDER BY name').all();
  // ทีมที่ยังไม่มีลิงก์เฉพาะทีม: สร้างให้
  const miss = results.filter(r => !r.token);
  if (miss.length) { for (const r of miss) r.token = teamToken(); await db.batch(miss.map(r => db.prepare('UPDATE roster SET token=? WHERE id=?').bind(r.token, r.id))); }
  return { ok: true, roster: results.map(r => ({ ...r, members: r.members == null ? '' : r.members })), live: await readTeams(db), hqPhone: await getMeta(db, 'hq_phone') };
}
const teamToken = () => { const a = new Uint8Array(12); crypto.getRandomValues(a); return [...a].map(b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''); };
async function renewTeamLink(db, b) {
  const id = clean(b.id, 20), token = teamToken();
  const r = await db.prepare('UPDATE roster SET token=? WHERE id=? AND active=1').bind(token, id).run();
  return r.meta.changes ? { ok: true, id, token } : { ok: false, error: 'not_found' };
}
async function setHqPhone(db, b) { const p = clean(b.phone, 20).replace(/[^\d+\-\s]/g, ''); await setMeta(db, 'hq_phone', p); return { ok: true, hqPhone: p }; }
async function ackSos(db, b) { await db.prepare('UPDATE roster SET sosAck=? WHERE id=?').bind(Date.now(), clean(b.id, 20)).run(); await chatSend(db, { team: b.team, from: 'hq', name: b.by, text: 'ศูนย์รับทราบ SOS แล้ว กำลังประสานความช่วยเหลือ' }); return { ok: true }; }

/* ---------- ระบบสนับสนุนทีม: หน้ามือถือของทีมเข้าด้วยลิงก์เฉพาะทีม (?id=token) ไม่ต้องใช้รหัสกลาง
   ทีมทำได้เฉพาะเรื่องของทีมตัวเอง: ตำแหน่ง สถานะ เคสที่ได้รับ แชท SOS โทร */
const MEET = 'https://meet.ffmuc.net/';
async function teamFrom(env, db, p) {
  const tk = String(p.tk || '').replace(/[^a-z0-9]/g, '').slice(0, 40);
  if (tk.length >= 10) { const row = await db.prepare('SELECT * FROM roster WHERE token=? AND active=1').bind(tk).first(); return row ? { name: row.name, row } : null; }
  const name = clean(p.team, MAX.volunteer);
  if (name && isVol(env, p.key)) return { name, row: await db.prepare('SELECT * FROM roster WHERE name=? AND active=1').bind(name).first() };
  return null;
}
async function teamMe(db, t) {
  const r = t.row || {}, now = Date.now();
  const { results } = await db.prepare("SELECT * FROM cases WHERE volunteer IN (?,?) AND (status='going' OR (status='done' AND updatedAt>?)) ORDER BY status DESC, urgency DESC, createdAt")
    .bind(t.name, "'" + t.name, now - 86400e3).all();
  const live = await db.prepare('SELECT lat,lng,accuracy,updatedAt FROM teams_live WHERE team=?').bind(t.name).first();
  const { results: stock } = await db.prepare('SELECT name FROM stock ORDER BY category, name').all();
  return { ok: true, team: { id: r.id || '', name: t.name, leader: r.leader || '', phone: r.phone || '', members: r.members ?? '', vehicle: r.vehicle || '', zone: r.zone || '',
      status: r.status || '', sosAt: r.sosAt || null, sosAck: r.sosAck || null, inRoster: !!r.id },
    hqPhone: await getMeta(db, 'hq_phone'), cases: results.map(c => outCase(c, true)), live: live || null, supplies: stock.map(s => s.name), now };
}
async function callStart(db, team, from, b) {
  if (!team) return { ok: false, error: 'missing_team' };
  const mode = b.mode === 'video' ? 'video' : 'voice';
  const link = MEET + 'Helpmeplus-' + teamToken() + (mode === 'voice' ? '#config.startWithVideoMuted=true&config.startAudioOnly=true' : '');
  await chatSend(db, { team, from, name: b.name, text: mode === 'voice' ? 'โทรด้วยเสียง' : 'วิดีโอคอล', kind: 'call', link, caseId: b.caseId });
  return { ok: true, link, mode };
}
const TEAM_POST = {
  team_ping: (db, t, b) => pingTeam(db, { ...b, team: t.name }),
  team_status: async (db, t, b) => {
    if (!t.row) return { ok: false, error: 'not_in_roster' };
    if (!ROSTER_STATUS.includes(b.status)) return { ok: false, error: 'bad_status' };
    await db.prepare('UPDATE roster SET status=?, updatedAt=? WHERE id=?').bind(b.status, Date.now(), t.row.id).run();
    return { ok: true, status: b.status };
  },
  team_case: async (db, t, b) => {
    const c = await db.prepare('SELECT id,volunteer,status FROM cases WHERE id=?').bind(clean(b.id, 30)).first();
    if (!c || String(c.volunteer || '').replace(/^'/, '').trim() !== t.name) return { ok: false, error: 'not_your_case' };
    if (b.step === 'arrived') { await chatSend(db, { team: t.name, from: 'team', name: b.name, text: `ถึงจุดเคส #${c.id} แล้ว`, caseId: c.id, lat: b.lat, lng: b.lng }); return { ok: true }; }
    if (b.step !== 'done' || c.status !== 'going') return { ok: false, error: 'bad_step' };
    const r = await updateCase(db, { id: c.id, status: 'done', volunteer: t.name, bags: b.bags });
    await chatSend(db, { team: t.name, from: 'team', name: b.name, text: `ช่วยเคส #${c.id} เสร็จแล้ว${b.bags ? ` · แจก ${clampInt(b.bags, 0, 9999, 0)} ถุง` : ''}${b.note ? ' · ' + clean(b.note, 300) : ''}`, caseId: c.id });
    return r;
  },
  team_sos: async (db, t, b) => {
    const now = Date.now();
    if (t.row) await db.prepare('UPDATE roster SET sosAt=?, sosAck=NULL WHERE id=?').bind(b.cancel ? null : now, t.row.id).run();
    if (!b.cancel && num(b.lat, -90, 90) != null) await pingTeam(db, { ...b, team: t.name });
    await chatSend(db, { team: t.name, from: 'team', name: b.name, kind: b.cancel ? '' : 'sos', text: b.cancel ? 'ยกเลิก SOS แล้ว · ปลอดภัย' : 'SOS ขอความช่วยเหลือด่วน' + (b.text ? ' · ' + clean(b.text, 300) : ''), lat: b.cancel ? null : b.lat, lng: b.cancel ? null : b.lng });
    return { ok: true, sosAt: b.cancel ? null : now };
  },
  call_start: (db, t, b) => callStart(db, t.name, 'team', b),
  chat_send: (db, t, b) => chatSend(db, { ...b, team: t.name, from: 'team', kind: '', link: '' }),
  chat_read: (db, t, b) => chatRead(db, { team: t.name, side: 'team' })
};
/* SOS ที่ยังไม่มีใครรับทราบ + สายที่ทีมโทรเข้ามาภายใน 2 นาที (แสดงทุกหน้าหลังบ้าน) */
async function alertsList(db) {
  const now = Date.now();
  const { results: sos } = await db.prepare('SELECT r.id,r.name,r.phone,r.sosAt,r.sosAck,l.lat,l.lng FROM roster r LEFT JOIN teams_live l ON l.team=r.name WHERE r.active=1 AND r.sosAt>? AND (r.sosAck IS NULL OR r.sosAck<r.sosAt)').bind(now - 12 * 3600e3).all();
  const { results: calls } = await db.prepare("SELECT n,team,name,text,link,at FROM chat WHERE kind='call' AND sender='team' AND at>? ORDER BY n DESC LIMIT 5").bind(now - 120e3).all();
  return { sos, calls };
}
/* โซน: วงกลม (จุดศูนย์กลาง + รัศมี) ใช้จัดกลุ่มเคสและมอบหมายทีมรับผิดชอบ (roster.zone = ชื่อโซน) */
async function listZones(db) {
  const { results } = await db.prepare('SELECT id,name,color,lat,lng,radius,note,updatedAt FROM zones WHERE active=1 ORDER BY name').all();
  return { ok: true, zones: results };
}
async function saveZone(db, b) {
  const z = b.zone || {}, id = clean(z.id, 20).replace(/[^\w-]/g, '') || ('Z' + rand(3));
  if (z.active === false) { await db.prepare('UPDATE zones SET active=0, updatedAt=? WHERE id=?').bind(Date.now(), id).run(); return { ok: true, id }; }
  const name = clean(z.name, 60), lat = num(z.lat, -90, 90), lng = num(z.lng, -180, 180);
  if (!name || lat == null || lng == null) return { ok: false, error: 'missing' };
  const color = /^#[0-9a-f]{6}$/i.test(String(z.color || '')) ? z.color : '#2a78d6';
  await db.prepare(`INSERT INTO zones (id,name,color,lat,lng,radius,note,active,updatedAt,by_) VALUES (?,?,?,?,?,?,?,1,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color,lat=excluded.lat,lng=excluded.lng,radius=excluded.radius,note=excluded.note,active=1,updatedAt=excluded.updatedAt,by_=excluded.by_`)
    .bind(id, name, color, lat, lng, clampInt(z.radius, 100, 30000, 1500), clean(z.note, 200), Date.now(), clean(b.by, 60)).run();
  return { ok: true, id };
}
async function listStock(db) {
  const { results: items } = await db.prepare('SELECT * FROM stock ORDER BY id').all();
  const { results: log } = await db.prepare('SELECT time,itemId,item,type,delta,after,note,caseId,by_ AS "by",team FROM stock_log ORDER BY n DESC LIMIT 1000').all();
  return { ok: true, items: items.map(i => ({ ...i, min: i.min == null ? '' : i.min, needed: !!i.needed, expiry: i.expiry || '', location: i.location || '', kit: parseKit(i.kit) })), log: log.map(l => ({ ...l, team: l.team || '' })) };
}
function parseKit(v) { try { const a = typeof v === 'string' ? JSON.parse(v || '[]') : v; return (Array.isArray(a) ? a : []).map(x => ({ id: clean(x.id, 20), qty: clampInt(x.qty, 1, 9999, 1) })).filter(x => x.id).slice(0, 30); } catch (e) { return []; } }
async function saveStockItem(db, b) {
  const t = b.item || {}, name = clean(t.name, 80);
  if (!name) return { ok: false, error: 'missing_name' };
  const id = t.id && await db.prepare('SELECT id FROM stock WHERE id=?').bind(String(t.id)).first() ? String(t.id) : 'S' + rand(3);
  const min = t.min === '' || t.min == null ? null : clampInt(t.min, 0, 1e7, null);
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(String(t.expiry || '')) ? t.expiry : '';
  // ไม่ส่ง kit มา (เช่นแก้ชื่อ/หน่วยจากฟอร์มทั่วไป) = คงรายการในถุงเดิมไว้
  const kit = t.kit === undefined ? ((await db.prepare('SELECT kit FROM stock WHERE id=?').bind(id).first()) || {}).kit || '[]' : JSON.stringify(parseKit(t.kit).filter(x => x.id !== id));
  await db.prepare(`INSERT INTO stock (id,name,unit,category,qty,min,needed,note,updatedAt,expiry,location,kit) VALUES (?,?,?,?,0,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,unit=excluded.unit,category=excluded.category,min=excluded.min,needed=excluded.needed,note=excluded.note,updatedAt=excluded.updatedAt,expiry=excluded.expiry,location=excluded.location,kit=excluded.kit`)
    .bind(id, name, clean(t.unit, 20), clean(t.category, 30), min, t.needed ? 1 : 0, clean(t.note, 200), Date.now(), expiry, clean(t.location, 60), kit).run();
  return { ok: true, id };
}
async function moveStock(db, b) {
  const type = ['in', 'out', 'set'].includes(b.type) ? b.type : '', amount = clampInt(b.amount, 0, 1e7, -1);
  if (!type || amount < 0) return { ok: false, error: 'bad_amount' };
  const it = await db.prepare('SELECT * FROM stock WHERE id=?').bind(String(b.itemId)).first();
  if (!it) return { ok: false, error: 'not_found' };
  const before = Number(it.qty) || 0, after = type === 'in' ? before + amount : type === 'out' ? before - amount : amount;
  if (after < 0) return { ok: false, error: 'not_enough', qty: before };
  // ตรวจยอดเดิมอีกครั้งตอนเขียน กันสองคนจ่ายของพร้อมกัน
  const u = await db.prepare('UPDATE stock SET qty=?, updatedAt=? WHERE id=? AND qty=?').bind(after, Date.now(), it.id, before).run();
  if (!u.meta.changes) return { ok: false, error: 'conflict_retry' };
  await db.prepare('INSERT INTO stock_log (time,itemId,item,type,delta,after,note,caseId,by_,team) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(Date.now(), it.id, it.name, type, after - before, after, clean(b.note, 200), clean(b.caseId, 30), clean(b.by, 60), clean(b.team, MAX.volunteer)).run();
  return { ok: true, qty: after };
}
/* แพ็คถุงยังชีพ: ตัดของในคลังตามรายการในถุง × จำนวนถุง แล้วรับถุงเข้า (ทำใน batch เดียว = สำเร็จหรือไม่สำเร็จทั้งหมด) */
async function packBags(db, b) {
  const n = clampInt(b.amount, 1, 100000, 0);
  const bag = await db.prepare('SELECT * FROM stock WHERE id=?').bind(String(b.itemId)).first();
  if (!bag || !n) return { ok: false, error: 'not_found' };
  const kit = parseKit(bag.kit);
  if (!kit.length) return { ok: false, error: 'no_kit' };
  const ids = kit.map(k => k.id), { results } = await db.prepare(`SELECT * FROM stock WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
  const short = [];
  const parts = kit.map(k => { const it = results.find(r => r.id === k.id); const need = k.qty * n, have = it ? Number(it.qty) || 0 : 0; if (!it || have < need) short.push({ id: k.id, name: it ? it.name : k.id, need, have }); return { it, need, have }; });
  if (short.length) return { ok: false, error: 'not_enough', short, canPack: Math.min(...parts.map(p => Math.floor(p.have / (p.need / n)))) };
  const now = Date.now(), by = clean(b.by, 60), note = clean(b.note, 200), tag = `แพ็คถุงยังชีพ ${n} ถุง`;
  const st = [];
  for (const p of parts) {
    st.push(db.prepare('UPDATE stock SET qty=?, updatedAt=? WHERE id=?').bind(p.have - p.need, now, p.it.id));
    st.push(db.prepare('INSERT INTO stock_log (time,itemId,item,type,delta,after,note,caseId,by_,team) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(now, p.it.id, p.it.name, 'out', -p.need, p.have - p.need, tag + (note ? ' · ' + note : ''), '', by, ''));
  }
  const after = (Number(bag.qty) || 0) + n;
  st.push(db.prepare('UPDATE stock SET qty=?, updatedAt=? WHERE id=?').bind(after, now, bag.id));
  st.push(db.prepare('INSERT INTO stock_log (time,itemId,item,type,delta,after,note,caseId,by_,team) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(now, bag.id, bag.name, 'in', n, after, 'แพ็คจากของในคลัง' + (note ? ' · ' + note : ''), '', by, ''));
  await db.batch(st);
  return { ok: true, qty: after, used: parts.map(p => ({ id: p.it.id, name: p.it.name, qty: p.need })) };
}
async function importCases(db, b) {
  const rows = Array.isArray(b.cases) ? b.cases.slice(0, 200) : [];
  let added = 0;
  for (const c of rows) {
    const id = clean(c.id, 40); if (!id) continue;
    const r = await db.prepare(`INSERT OR IGNORE INTO cases (id,createdAt,status,urgency,name,phone,district,people,address,lat,lng,level,needs,vulnerable,notes,volunteer,updatedAt,token,clientId,households,bags,cctv)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,?,?,?)`).bind(id, Number(c.createdAt) || Date.now(), STATUSES.includes(c.status) ? c.status : 'open',
      clampInt(c.urgency, 1, 3, 1), clean(c.name, MAX.name), clean(String(c.phone || '').replace(/^'/, ''), MAX.phone), clean(c.district, MAX.district), clampInt(c.people, 1, 999, 1),
      clean(c.address, MAX.address), num(c.lat, -90, 90), num(c.lng, -180, 180), LEVELS.includes(c.level) ? c.level : '', list(c.needs).join(', '), list(c.vulnerable).join(', '),
      clean(c.notes, MAX.notes), clean(String(c.volunteer || '').replace(/^'/, ''), MAX.volunteer), Number(c.updatedAt) || Date.now(), rand(16),
      c.households === '' || c.households == null ? null : clampInt(c.households, 1, 999, null), c.bags === '' || c.bags == null ? null : clampInt(c.bags, 0, 9999, null), clean(c.cctv, 40)).run();
    if (r.meta.changes) added++; // changes นับรวมแถวที่ trigger ใส่คิวสำรอง จึงนับแค่ว่ามีเพิ่มหรือไม่
  }
  if (added) await bumpRev(db);
  return { ok: true, added, total: rows.length };
}

/* ---------- สำรองลง Google Sheet ---------- */
async function backupToSheet(env) {
  const db = env.DB;
  if (!db) return { ok: false, error: 'no_database' };
  if (!env.SHEET_BACKUP_URL || !env.SHEET_BACKUP_KEY) return { ok: false, error: 'backup_not_configured' };
  await init(db);
  const { results: q } = await db.prepare('SELECT n,tbl,rid FROM sync_queue ORDER BY n LIMIT 1000').all();
  if (!q.length) return { ok: true, sent: 0 };
  const byTable = {};
  for (const r of q) if (BACKUP_TABLES[r.tbl]) (byTable[r.tbl] = byTable[r.tbl] || new Set()).add(r.tbl === 'stock_log' ? Number(r.rid) : String(r.rid));
  const tables = {};
  let sent = 0;
  for (const [t, ids] of Object.entries(byTable)) {
    const k = BACKUP_TABLES[t], all = [...ids], rows = [];
    for (let i = 0; i < all.length; i += 90) {
      const part = all.slice(i, i + 90);
      const { results } = await db.prepare(`SELECT * FROM ${t} WHERE ${k} IN (${part.map(() => '?').join(',')})`).bind(...part).all();
      rows.push(...results);
    }
    tables[t] = rows.map(r => { const o = { ...r }; for (const c of BACKUP_OMIT[t] || []) delete o[c]; return o; });
    sent += rows.length;
  }
  let res;
  try {
    const r = await fetch(env.SHEET_BACKUP_URL, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key: env.SHEET_BACKUP_KEY, tables }) });
    try { res = await r.json(); } catch (e) { res = { ok: false, error: 'bad_response_' + r.status }; }
  } catch (e) { res = { ok: false, error: 'fetch_failed: ' + String(e && e.message || e).slice(0, 120) }; }
  if (!res.ok) { await setMeta(db, 'backup_error', new Date().toISOString() + ' ' + (res.error || 'unknown')); return res; }
  await db.prepare('DELETE FROM sync_queue WHERE n<=?').bind(q[q.length - 1].n).run();
  await setMeta(db, 'backup_at', Date.now());
  await setMeta(db, 'backup_error', '');
  return { ok: true, sent, more: q.length === 1000 };
}
async function backupStatus(env) {
  const db = env.DB;
  const pending = await db.prepare('SELECT COUNT(*) n FROM sync_queue').first();
  return { ok: true, configured: !!(env.SHEET_BACKUP_URL && env.SHEET_BACKUP_KEY), pending: pending.n,
    lastBackupAt: Number(await getMeta(db, 'backup_at')) || null, lastError: await getMeta(db, 'backup_error') };
}

/* ---------- ข้อมูลภายนอก (สาธารณะ ไม่มีข้อมูลส่วนตัว) : ดึงผ่าน Worker แล้วเก็บแคช ลดภาระต้นทาง ---------- */
async function cached(key, ttl, load) {
  const cache = caches.default, req = new Request('https://umplus.cache/' + key);
  const hit = await cache.match(req);
  if (hit) return hit.json();
  const data = await load();
  await cache.put(req, new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + ttl } }));
  return data;
}
const UA = { 'user-agent': 'UMplus-flood-help/1.0 (+https://admin-um-help.pages.dev)' };
// ระดับน้ำบนถนน: เซ็นเซอร์สำนักการระบายน้ำ กทม. + ระดับน้ำคลอง: ThaiWater (สสน.)
async function waterData() {
  return cached('water-v1', 300, async () => {
    const out = { ok: true, time: Date.now(), sensors: [], stations: [], errors: [] };
    const [dds, tw] = await Promise.allSettled([
      fetch('https://floodbangkok.bangkok.go.th/bkk/dds/services/api/floods/v1/items/sensor_now?limit=-1&fields=flood_now,flood_max,timestamp,sensor_profile.code,sensor_profile.name,sensor_profile.road,sensor_profile.district,sensor_profile.lat,sensor_profile.long,sensor_profile.device_status', { headers: UA }).then(r => r.json()),
      fetch('https://api-v3.thaiwater.net/api/v1/thaiwater30/public/waterlevel_load?province_code=10', { headers: UA }).then(r => r.json())
    ]);
    if (dds.status === 'fulfilled') out.sensors = (dds.value.data || []).map(x => { const p = x.sensor_profile || {}; return {
      code: p.code || '', name: p.name || '', road: p.road || '', district: p.district || '', lat: Number(p.lat), lng: Number(p.long),
      now: x.flood_now == null ? null : Number(x.flood_now), max: x.flood_max == null ? null : Number(x.flood_max),
      status: p.device_status || '', t: x.timestamp ? Date.parse(x.timestamp + (/[zZ+]/.test(x.timestamp.slice(-6)) ? '' : 'Z')) : 0 }; }).filter(x => isFinite(x.lat) && isFinite(x.lng));
    else out.errors.push('dds');
    if (tw.status === 'fulfilled') out.stations = ((tw.value.waterlevel_data || {}).data || []).map(x => { const st = x.station || {}; return {
      id: st.id, name: (st.tele_station_name || {}).th || (st.tele_station_name || {}).en || '', lat: Number(st.tele_station_lat), lng: Number(st.tele_station_long),
      level: x.waterlevel_msl == null ? null : Number(x.waterlevel_msl), bank: st.min_bank == null ? null : Number(st.min_bank), diff: x.diff_wl_bank == null ? null : Number(x.diff_wl_bank),
      situation: Number(x.situation_level) || 0, t: x.waterlevel_datetime ? Date.parse(x.waterlevel_datetime.replace(' ', 'T') + ':00+07:00') : 0, agency: ((x.agency || {}).agency_shortname || {}).th || '' }; }).filter(x => isFinite(x.lat) && isFinite(x.lng));
    else out.errors.push('thaiwater');
    return out;
  });
}
// กล้อง CCTV: iTIC Foundation (ผ่าน Longdo Traffic) เฉพาะกรุงเทพฯ
async function cctvData() {
  return cached('cctv-v3', 3600, async () => {
    const j = await fetch('https://traffic.longdo.com/camera.json', { headers: UA }).then(r => r.json());
    const cams = (j.item || []).filter(c => String(c.geocode || '').startsWith('10') || c.hls_url).map(c => { // กรุงเทพฯ ทุกตัว + กล้องภาพสดทั้งประเทศ
      const img = /X\.X\.X\.X/.test(c.imgurl || '') ? '' : (c.imgurl || '');
      const https = u => /^https:\/\/[^\s"'<>]+$/.test(u || '') ? u : ''; // ส่งต่อเฉพาะลิงก์ https
      return { id: c.camid, title: String(c.title || '').replace(/^\(กรุงเทพมหานคร\)\s*/, '').trim(), lat: Number(c.latitude), lng: Number(c.longitude), img: https(img), hls: https(c.hls_url), org: c.organization || '' };
    }).filter(c => isFinite(c.lat) && isFinite(c.lng));
    return { ok: true, time: Date.now(), cams };
  });
}
/* พื้นที่ที่องค์กรอื่นรับแล้ว: อ่านจาก Google Sheet ที่แชร์แบบ "ทุกคนที่มีลิงก์" แล้วแปลงลิงก์ Google Maps (maps.app.goo.gl) เป็นพิกัด
   แคชผลรวม 5 นาที และแคชพิกัดของแต่ละลิงก์ถาวรใน meta (ลิงก์เดิมไม่ต้อง resolve ซ้ำ) */
const COVERED_SHEET = '1QwVsFfWqNBP8qJMBBk_PrvbSm6gNFOF0CGwJl5BNaFc';
function parseCSV(t) { const rows = []; let row = [], cur = '', q = false; for (let i = 0; i < t.length; i++) { const ch = t[i];
  if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; }
  else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; } else cur += ch; }
  if (cur || row.length) { row.push(cur); rows.push(row); } return rows; }
function coordsFromUrl(u) { u = decodeURIComponent(String(u || ''));
  const pats = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|ll|query|destination|center)=(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/, /\/(?:search|place|dir)\/(-?\d+\.\d+),\s*\+?(-?\d+\.\d+)/];
  for (const re of pats) { const m = u.match(re); if (m) { const a = +m[1], b = +m[2]; if (a > 5 && a < 21 && b > 97 && b < 106) return [a, b]; } } return null; }
async function resolveMapLink(db, link) {
  if (!/^https?:\/\//.test(link)) return null; const k = 'covlink:' + link; const c = await getMeta(db, k);
  if (c) return c === '-' ? null : JSON.parse(c);
  let u = link, ll = coordsFromUrl(u);
  for (let i = 0; i < 4 && !ll; i++) { try { const r = await fetch(u, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (UMPlus relief map)' } });
    const loc = r.headers.get('location'); if (loc) { u = new URL(loc, u).toString(); ll = coordsFromUrl(u); continue; }
    if (r.ok) { const t = (await r.text()).slice(0, 200000); ll = coordsFromUrl(t.match(/https:\/\/www\.google\.[^"' ]*@-?\d+\.\d+,-?\d+\.\d+[^"' ]*/)?.[0] || t.match(/center=-?\d+\.\d+%2C-?\d+\.\d+/)?.[0]?.replace('%2C', ',') || ''); }
    break; } catch (e) { return null; } }
  await setMeta(db, k, ll ? JSON.stringify(ll) : '-'); return ll; }
async function listCovered(db) {
  const c = await getMeta(db, 'covered_cache'); if (c) { try { const o = JSON.parse(c); if (Date.now() - o.t < 5 * 60e3) return { ok: true, items: o.items, cached: true }; } catch (e) {} }
  const r = await fetch('https://docs.google.com/spreadsheets/d/' + COVERED_SHEET + '/gviz/tq?tqx=out:csv');
  if (!r.ok) return { ok: false, error: 'sheet_' + r.status };
  const all = parseCSV(await r.text()), h = (all[0] || []).map(x => String(x || '').replace(/\s+/g, ''));
  const col = (re, d) => { const i = h.findIndex(x => re.test(x)); return i < 0 ? d : i; };
  const cols = [col(/องค/, 0), col(/สถานที่|พื้นที่/, 1), col(/วันที่/, 2), col(/โลเค|ลิง[คก]|link|location/i, 3), col(/เขต|จังหวัด/, -1), col(/จำนวน|ชุด/, -1), col(/หมายเหตุ/, -1), col(/พิกัด/, -1), col(/รายการ|สิ่งของ/, -1)];
  const rows = all.slice(1).map(x => { const o = cols.map(i => i < 0 ? '' : x[i] || ''); if (!o[3]) o[3] = x.find(v => /https?:\/\//.test(v || '')) || ''; return o; }).filter(x => x[1] && String(x[1]).trim());
  const items = [];
  for (const x of rows) { const [org, area, date, link, district, sets, note, coord, what] = x.map(v => String(v || '').trim()); const ll = coordsFromUrl('@' + coord.replace(/\s+/g, '')) || coordsFromUrl('@' + link.replace(/\s+/g, '')) || (link ? await resolveMapLink(db, link) : null);
    items.push({ org, area, date, link, district, sets, note, items: what, lat: ll ? ll[0] : null, lng: ll ? ll[1] : null }); }
  // แถวที่กรอกผ่านฟอร์มบนเว็บนี้ (เก็บใน D1) — ข้ามถ้าชีตมีแถวเดียวกันแล้ว
  const seen = new Set(items.map(i => [i.org, i.area, i.date].join('|')));
  const { results: extra } = await db.prepare('SELECT * FROM covered_extra ORDER BY n').all();
  for (const e of extra || []) { if (seen.has([e.org, e.place, e.date].join('|'))) continue;
    const loc = String(e.location || ''), link = /^https?:\/\//.test(loc) ? loc : '';
    const ll = coordsFromUrl('@' + loc.replace(/\s+/g, '')) || (link ? await resolveMapLink(db, link) : null);
    items.push({ org: e.org, area: e.place, date: e.date, link, district: '', sets: e.qty, note: 'กรอกผ่านเว็บ', items: e.items, lat: ll ? ll[0] : null, lng: ll ? ll[1] : null }); }
  await setMeta(db, 'covered_cache', JSON.stringify({ t: Date.now(), items }));
  return { ok: true, items };
}
async function addCovered(db, b) {
  const r = b.row || {}, cut = (v, n) => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
  const v = { org: cut(r.org, 80), date: cut(r.date, 20), items: cut(r.items, 120), qty: cut(r.qty, 40), place: cut(r.place, 200), location: cut(r.location, 300) };
  if (!v.org || !v.place) return { ok: false, error: 'missing_fields' };
  if (v.location && !/^https?:\/\//i.test(v.location) && !/^-?\d{1,2}\.\d+\s*,\s*-?\d{2,3}\.\d+$/.test(v.location)) return { ok: false, error: 'bad_location' };
  await db.prepare('INSERT INTO covered_extra (org,date,items,qty,place,location,by_,createdAt) VALUES (?,?,?,?,?,?,?,?)').bind(v.org, v.date, v.items, v.qty, v.place, v.location, cut(b.by, 60), Date.now()).run();
  await setMeta(db, 'covered_cache', '');
  return { ok: true };
}

/* ---------- เคสจากโซเชียล (leads) ----------
   แหล่ง: Hermes agent ส่งเข้ามา (lead_add) หรือปุ่ม "ดึงเคสใหม่" อ่านคำร้อง Traffy Fondue ผ่านไฟล์ส่งออกสาธารณะของ Floodboard (lead_pull)
   ตัวกรอง: ตัดโพสต์เก่า (ก่อนเกิดเหตุ / เก่ากว่า N วัน / ปีก่อน) และโพสต์ขอเงินที่ไม่บอกสถานที่ · ติดธงบัญชีที่ซ้ำกับเคสอื่นต่างพื้นที่ */
const LEAD_STATUS = ['new', 'accepted', 'rejected'];
const BANK_WORDS = /(บัญชี|บช\.?|ธนาคาร|พร้อมเพย์|promptpay|โอน|บริจาค|กสิกร|ไทยพาณิชย์|กรุงไทย|กรุงเทพ|กรุงศรี|ออมสิน|ธ\.?ก\.?ส|ทีทีบี|ttb|kbank|scb|ktb|bbl|gsb)/i;
const ACCOUNT_RE = /(?<!\d)(\d{3}[- ]?\d[- ]?\d{5}[- ]?\d|\d{3}[- ]?\d{3}[- ]?\d{4}|\d{10,15})(?!\d)/g;
function moneyAccounts(text) {
  const out = new Set(); let m; ACCOUNT_RE.lastIndex = 0;
  while ((m = ACCOUNT_RE.exec(text))) { const w = text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 30); if (BANK_WORDS.test(w)) out.add(m[1].replace(/\D/g, '')); }
  return [...out];
}
async function leadSettings(db) {
  return { eventStart: await getMeta(db, 'leads_event_start') || '2026-09-24', maxAgeDays: Number(await getMeta(db, 'leads_max_age')) || 14 };
}
const bkkDate = s => Date.parse(s + 'T00:00:00+07:00');
/* คืน [เหตุผลที่ตัดทิ้ง หรือ '', ธง[]] — เหตุผลที่เป็นความผิดของคนกรอกวันที่ (ไม่มีวันที่/วันที่อนาคต) จะไม่ถูกจำ ส่งใหม่ได้ */
async function checkLead(db, l, st) {
  const flags = [], now = Date.now();
  if (!l.postedAt) return ['no_post_date', flags];
  if (l.postedAt > now + 3600e3) return ['post_date_in_future', flags];
  const start = bkkDate(st.eventStart);
  if (isFinite(start) && l.postedAt < start - 86400e3) return ['old_post_before_event', flags];
  if (l.postedAt < now - st.maxAgeDays * 86400e3) return ['old_post_too_old', flags];
  if (new Date(l.postedAt).getUTCFullYear() < new Date(now).getUTCFullYear()) return ['old_post_previous_year', flags];
  const text = [l.title, l.text].join(' ');
  const years = [...text.matchAll(/(?<!\d)(25[4-9]\d)(?!\d)/g)].map(m => +m[1] - 543).concat([...text.matchAll(/(?<!\d)(20[0-4]\d)(?!\d)/g)].map(m => +m[1]));
  if (years.length && Math.max(...years) < new Date(now).getUTCFullYear()) flags.push('past_year_text');
  const accts = moneyAccounts(text), hasPlace = !!(l.address || l.district) || l.lat != null;
  if (accts.length || /(พร้อมเพย์|promptpay|โอนเงิน|ขอรับบริจาค)/i.test(text)) { if (!hasPlace) return ['money_no_place', flags]; flags.push('asks_money'); }
  for (const a of accts) {
    flags.push('acct:' + a);
    const other = await db.prepare("SELECT id, district FROM leads WHERE flags LIKE ? AND status!='rejected' LIMIT 1").bind('%acct:' + a + '%').first();
    if (other && other.district !== l.district) flags.push('account_reused:' + other.id);
  }
  return ['', flags];
}
function readLead(x) {
  const t = v => typeof v === 'number' ? v : Date.parse(String(v || '')) || 0;
  return { url: clean(x.url, 400), source: clean(x.source, 30) || 'social', postedAt: t(x.postedAt || x.posted_at), title: clean(x.title, 160), text: clean(x.text, 2000),
    district: clean(x.district, MAX.district), address: clean(x.address || x.place, MAX.address), lat: num(x.lat, -90, 90), lng: num(x.lng ?? x.lon, -180, 180),
    needs: list(x.needs), urgency: clampInt(x.urgency, 1, 3, 1), people: clean(x.people, 60), names: list(x.names).join(', '),
    phone: clean(Array.isArray(x.phone) ? x.phone.join(', ') : x.phone || (x.contacts_public || []).join?.(', ') || '', 60).replace(/[^\d+\-\s,]/g, '') };
}
async function insertLead(db, l, st) {
  if (!/^https?:\/\//.test(l.url)) return { ok: false, error: 'missing_url' };
  const old = await db.prepare('SELECT id, status, reason FROM leads WHERE url=?').bind(l.url).first();
  if (old) return { ok: true, duplicate: true, id: old.id, status: old.status, reason: old.reason || '' };
  const [reason, flags] = await checkLead(db, l, st);
  if (reason === 'no_post_date' || reason === 'post_date_in_future') return { ok: false, error: reason };
  const id = 'L' + Date.now().toString(36).toUpperCase() + rand(2).toUpperCase(), now = Date.now();
  await db.prepare(`INSERT INTO leads (id,url,source,postedAt,foundAt,title,text,district,address,lat,lng,needs,urgency,people,names,phone,flags,status,reason,caseId,by_,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'','',?)`).bind(id, l.url, l.source, l.postedAt, now, l.title, l.text, l.district, l.address, l.lat, l.lng,
    l.needs.join(', '), l.urgency, l.people, l.names, l.phone, flags.join(','), reason ? 'rejected' : 'new', reason, now).run();
  for (const f of flags) if (f.startsWith('account_reused:')) await db.prepare("UPDATE leads SET flags = flags || ? WHERE id=? AND flags NOT LIKE ?").bind(',account_reused:' + id, f.slice(15), '%account_reused:' + id + '%').run();
  return { ok: true, id, status: reason ? 'rejected' : 'new', reason, flags: flags.filter(f => !f.startsWith('acct:')) };
}
async function addLeads(db, b) {
  const st = await leadSettings(db), rows = Array.isArray(b.leads) ? b.leads.slice(0, 100) : [b.lead || {}];
  const results = [];
  for (const x of rows) results.push(await insertLead(db, readLead(x), st));
  return { ok: true, results, added: results.filter(r => r.ok && !r.duplicate && r.status === 'new').length, rejected: results.filter(r => r.status === 'rejected' && !r.duplicate).length };
}
/* คำร้อง Traffy Fondue (ผ่าน Floodboard export) ที่เป็นคนขอความช่วยเหลือจริง ไม่ใช่เรื่องขยะ ท่อ ถนน ทรัพย์สิน */
// คำไทยสั้นชนกับคำอื่นง่าย: "ยา" อยู่ใน ยาว/ยาย, "เรือ" อยู่ใน บ้านเรือน, "อาหาร" อยู่ใน เศษอาหาร/ร้านอาหาร, "จมน้ำ" ใช้กับรถ/ประตูด้วย
const RX = { food: /(?<!เศษ|ร้าน|ขยะเศษ)อาหาร(?!เสริม)|ข้าวกล่อง/, boat: /เรือ(?!น)/, meds: /ยารักษา|ยาทา|ยาแก้|ยาสามัญ|น้ำกัดเท้า|ยาน้ำกัดเท้า/ };
const NEED_STRONG = new RegExp([/ถุงยังชีพ|น้ำดื่ม|ติดเตียง|ผู้ป่วย|ออกไม่ได้|ออกจากบ้านไม่ได้|ติดอยู่ใน|อพยพ|ช่วยด้วย|ไฟช็อต|ไฟดูด|ฟอกไต|ออกซิเจน|พลัดตก|คนพิการ|ตั้งครรภ์/.source, RX.food.source, RX.boat.source, RX.meds.source].join('|'));
const NEED_SOFT = /ขอความช่วยเหลือ|ช่วยเหลือด่วน|ผู้สูงอายุ|คนแก่|เด็กเล็ก/;
const NOT_PEOPLE = /ขยะ|ไฟส่องทาง|ไฟฟ้าส่องทาง|เสาไฟ|ถนนชำรุด|หลุม|รถจมน้ำ|รถเสียหาย|รถมาจอด|จอดรถ|ตู้เย็น|เครื่องใช้ไฟฟ้า|ค่าเสียหาย|เยียวยา|ลอกท่อ|ฝาท่อ|ท่อตัน|บริษัท|ออฟฟิศ|ร้านได้รับความเสียหาย|ไม่ได้รับความเป็นธรรม|วัชพืช/;
const CORE_PEOPLE = new RegExp([/ถุงยังชีพ|น้ำดื่ม|ติดเตียง|ผู้ป่วย|ออกไม่ได้|ออกจากบ้านไม่ได้|ติดอยู่ใน|ช่วยด้วย|ไฟช็อต|ไฟดูด|ผู้สูงอายุ|เด็กเล็ก/.source, RX.food.source].join('|'));
const NEED_LABELS = [[/ถุงยังชีพ/, 'ถุงยังชีพ'], [RX.food, 'อาหาร'], [/น้ำดื่ม/, 'น้ำดื่ม'], [RX.boat, 'เรือ'], [RX.meds, 'ยา'], [/อพยพ/, 'อพยพ'],
  [/สูบน้ำ|ระบายน้ำ/, 'สูบน้ำ'], [/กระสอบทราย/, 'กระสอบทราย'], [/ไฟช็อต|ไฟดูด|ระบบไฟ/, 'ช่างไฟ'], [/แพมเพิส|ผ้าอ้อม/, 'ผ้าอ้อม'], [/ฟอกไต|ผู้ป่วย|ติดเตียง/, 'ผู้ป่วย']];
function leadUrgency(t) {
  if (/ติดเตียง|ออกซิเจน|ฟอกไต|ไฟดูด|ติดอยู่ใน|ช่วยด้วย|พลัดตก|(คน|เด็ก|ผู้)\S{0,6}จมน้ำ/.test(t)) return 3;
  if (/ผู้ป่วย|ผู้สูงอายุ|คนแก่|เด็กเล็ก|ถุงยังชีพ|น้ำดื่ม|ไฟช็อต|ออกไม่ได้|ออกจากบ้านไม่ได้/.test(t) || RX.food.test(t) || RX.boat.test(t) || RX.meds.test(t)) return 2;
  return 1;
}
async function pullLeads(db) {
  const r = await fetch('https://floodboard.org/api/export/reports.csv', { headers: UA });
  if (!r.ok) return { ok: false, error: 'floodboard_' + r.status };
  const rows = parseCSV((await r.text()).replace(/^﻿/, '')), h = rows[0] || [], ix = k => h.indexOf(k);
  const st = await leadSettings(db), out = { ok: true, scanned: 0, matched: 0, added: 0, rejected: 0, duplicate: 0 };
  let named = 0; // ชื่อพื้นที่ (Photon) สูงสุด 25 ครั้งต่อรอบ กันเกินโควตา subrequest
  for (const x of rows.slice(1)) {
    if (x[ix('source')] !== 'traffy') continue;
    out.scanned++;
    const text = x[ix('text')] || '';
    const strong = NEED_STRONG.test(text);
    if (!strong && (!NEED_SOFT.test(text) || NOT_PEOPLE.test(text))) continue;
    if (NOT_PEOPLE.test(text) && !CORE_PEOPLE.test(text)) continue;
    out.matched++;
    if (await db.prepare('SELECT 1 FROM leads WHERE url=?').bind(x[ix('url')]).first()) { out.duplicate++; continue; }
    const lat = num(x[ix('lat')], -90, 90), lng = num(x[ix('lon')], -180, 180);
    const dm = text.match(/เขต[:\s]*([ก-๙]+)/);
    const l = { url: x[ix('url')], source: 'traffy', postedAt: Date.parse(x[ix('time_utc')]) || 0, title: text.slice(0, 90), text: text.slice(0, 2000),
      district: dm ? clean(dm[1], MAX.district) : '', address: lat != null && named++ < 25 ? await areaName(lat, lng) : '', lat, lng,
      needs: NEED_LABELS.filter(([re]) => re.test(text)).map(([, n]) => n), urgency: leadUrgency(text), people: '', names: '', phone: '' };
    const res = await insertLead(db, l, st);
    if (res.duplicate) out.duplicate++; else if (res.status === 'new') out.added++; else if (res.status === 'rejected') out.rejected++;
  }
  await setMeta(db, 'leads_pulled_at', Date.now());
  return out;
}
/* Help Me ช่วยด้วย (helpme-th.pages.dev · มูลนิธิอุมมะตี) — Apps Script แบบเดียวกับ Code.gs เดิม
   ไม่มีรหัส: ได้รายการสาธารณะ (ไม่มีชื่อ/เบอร์ พิกัดโดยประมาณ) · ตั้ง secret HELPME_KEY = รหัสทีมของ Help Me เพื่อได้ข้อมูลเต็ม
   เคสที่ Help Me ปิดแล้ว (done) จะถูกเอาออกจากคิวรอคัดเอง */
const HELPME_API = 'https://script.google.com/macros/s/AKfycbyWeVDhToFJntjTGHprDEByEfRFdSbOidlR7QhJ6xG1bz7co2gCRkTGIoKDI9tJqGkWTw/exec';
/* Google Sheet ของ Help Me = แหล่งข้อมูลหลัก (เร็วและนิ่งกว่า Apps Script)
   แท็บ: เคส · ลงพื้นที่ · ทีม · ศูนย์พักพิง · เครือข่าย — อ่านทาง export CSV ฝั่งเซิร์ฟเวอร์ แคช 1 นาที
   ชีตนี้มีชื่อและเบอร์ผู้แจ้ง: ส่งต่อให้หน้าเว็บเฉพาะคนที่มีรหัสทีม · ตัวเลขสถิติไม่มีข้อมูลส่วนตัว */
const HM_SHEET = '1GkGL0PrjuADwMmuSSj0KjW9WLH180eATD1RkmzEqGMs';
const HM_TABS = { cases: '689944118', outreach: '1011033103', teams: '1249688184', shelters: '1258451052', network: '1402005274' };
async function sheetTab(env, tab) {
  return cached('hmsheet-' + tab + '-v1', 60, async () => {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${env.HM_SHEET || HM_SHEET}/export?format=csv&gid=${HM_TABS[tab]}`, { headers: UA, redirect: 'follow' });
    if (!r.ok) throw new Error('sheet_' + r.status);
    const rows = parseCSV((await r.text()).replace(/^\uFEFF/, ''));
    if (!rows.length) throw new Error('sheet_empty');
    return { header: rows[0].map(x => String(x || '').trim()), rows: rows.slice(1).filter(r => r.some(v => String(v || '').trim())) };
  });
}
/* "27/9/2026, 19:10:13" หรือ "4/10/2026 15:43" (เวลาไทย) → ms · ปี พ.ศ. แปลงให้ */
function sheetTime(v) {
  const m = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0; let y = +m[3]; if (y > 2400) y -= 543;
  return Date.UTC(y, +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)) - 7 * 3600e3;
}
/* 50 เขตของกรุงเทพฯ — ใช้หาเขตจากที่อยู่ที่ไม่ได้เขียนคำว่า "เขต" (ชื่อยาวก่อน กัน "บางกะปิ" ไปจับ "บาง") */
const BKK_DISTRICTS = ['พระนคร','ดุสิต','หนองจอก','บางรัก','บางเขน','บางกะปิ','ปทุมวัน','ป้อมปราบศัตรูพ่าย','พระโขนง','มีนบุรี','ลาดกระบัง','ยานนาวา','สัมพันธวงศ์','พญาไท','ธนบุรี','บางกอกใหญ่','ห้วยขวาง','คลองสาน','ตลิ่งชัน','บางกอกน้อย','บางขุนเทียน','ภาษีเจริญ','หนองแขม','ราษฎร์บูรณะ','บางพลัด','ดินแดง','บึงกุ่ม','สาทร','บางซื่อ','จตุจักร','บางคอแหลม','ประเวศ','คลองเตย','สวนหลวง','จอมทอง','ดอนเมือง','ราชเทวี','ลาดพร้าว','วัฒนา','บางแค','หลักสี่','สายไหม','คันนายาว','สะพานสูง','วังทองหลาง','คลองสามวา','บางนา','ทวีวัฒนา','ทุ่งครุ','บางบอน'].sort((a, b) => b.length - a.length);
const HM_STATUS = { 'รอช่วย': 'open', 'รอความช่วยเหลือ': 'open', 'ทีมกำลังไป': 'going', 'กำลังไป': 'going', 'กำลังช่วย': 'going', 'ช่วยแล้ว': 'done', 'เสร็จแล้ว': 'done' };
const HM_URG = { 'ด่วนมาก': 3, 'วิกฤต': 3, 'เร่งด่วน': 2, 'ทั่วไป': 1 };
async function sheetCases(env) {
  const t = await sheetTab(env, 'cases'), h = t.header, col = n => h.indexOf(n), all = n => h.map((x, i) => x === n ? i : -1).filter(i => i >= 0);
  const v = (r, n) => { const i = col(n); return i < 0 ? '' : String(r[i] || '').trim(); };
  return t.rows.map(r => {
    const address = v(r, 'ที่อยู่'), dm = address.match(/เขต\s*([ก-๙]+)/) || [null, BKK_DISTRICTS.find(d => address.replace(/พระนครศรีอยุธยา/g, '').includes(d)) || '']; // "พระนคร" ไม่ใช่ อยุธยา
    return { id: v(r, 'รหัสเคส'), createdAt: sheetTime(v(r, 'เวลาแจ้ง')), updatedAt: sheetTime(v(r, 'อัปเดตล่าสุด')),
      status: HM_STATUS[v(r, 'สถานะ')] || 'open', urgency: HM_URG[v(r, 'ความเร่งด่วน')] || 1, name: v(r, 'ชื่อ'), phone: v(r, 'เบอร์โทร').replace(/^'/, ''),
      notes: all('รายละเอียด').map(i => String(r[i] || '').trim()).filter(Boolean).join(' · '), people: Number(v(r, 'จำนวนคน')) || 1, address,
      district: dm ? dm[1] : '', lat: num(v(r, 'ละติจูด'), -90, 90), lng: num(v(r, 'ลองจิจูด'), -180, 180), level: v(r, 'ระดับน้ำ'),
      needs: v(r, 'ต้องการ').split(/\s*,\s*/).filter(Boolean), volunteer: v(r, 'ทีมอาสา'), org: v(r, 'หน่วยงาน'), pinSrc: v(r, 'ที่มาของหมุด'),
      pickedAt: sheetTime(v(r, 'เวลารับเคส')), doneAt: sheetTime(v(r, 'เวลาช่วยเสร็จ')) };
  }).filter(c => c.id);
}
/* แท็บที่มีคอลัมน์พิกัด (ลิงก์ Google Maps หรือ "lat, lng") และ "แสดงบนแผนที่" */
async function sheetPoints(env, db, tab) {
  const t = await sheetTab(env, tab), h = t.header, pc = h.findIndex(x => x.startsWith('พิกัด')), show = h.indexOf('แสดงบนแผนที่');
  const out = [];
  for (const r of t.rows) {
    if (show >= 0 && /^(ไม่|no|false)/i.test(String(r[show] || '').trim())) continue;
    const loc = String(r[pc] || '').trim(), ll = coordsFromUrl('@' + loc.replace(/\s+/g, '')) || (/^https?:\/\//.test(loc) ? await resolveMapLink(db, loc) : null);
    const o = {}; h.forEach((k, i) => { if (k && i !== pc) o[k] = String(r[i] || '').trim(); });
    out.push({ ...o, lat: ll ? ll[0] : null, lng: ll ? ll[1] : null });
  }
  return out;
}
const HELPME_LEVEL = { ankle: 'ข้อเท้า', knee: 'เข่า', waist: 'เอว', chest: 'อก', roof: 'มิดหัว/หลังคา' };
async function pullHelpme(db, env) {
  let j = null;
  try { j = { ok: true, volunteer: true, cases: (await sheetCases(env)).map(c => ({ ...c, approx: false })), source: 'sheet' }; } catch (e) {}
  if (!j) {
    const q = new URLSearchParams({ action: 'list', t: String(Math.floor(Date.now() / 15000)) });
    if (env.HELPME_KEY) q.set('key', env.HELPME_KEY);
    const r = await fetch((env.HELPME_API || HELPME_API) + '?' + q, { headers: UA, redirect: 'follow' });
    if (!r.ok) return { ok: false, error: 'helpme_' + r.status };
    try { j = await r.json(); } catch (e) { return { ok: false, error: 'helpme_bad_json' }; }
    if (!j.ok) return { ok: false, error: 'helpme_' + (j.error || 'error') };
  }
  const st = await leadSettings(db), out = { ok: true, full: !!j.volunteer, scanned: 0, added: 0, rejected: 0, duplicate: 0, closed: 0, filled: 0 };
  for (const c of j.cases || []) {
    out.scanned++;
    const url = 'https://helpme-th.pages.dev/?case=' + encodeURIComponent(c.id);
    const old = await db.prepare('SELECT id, status, flags, names, phone FROM leads WHERE url=?').bind(url).first();
    if (old) {
      if (old.status === 'new' && c.status === 'done') {
        await db.prepare("UPDATE leads SET status='rejected', reason='resolved_at_source', by_='Help Me', updatedAt=? WHERE id=?").bind(Date.now(), old.id).run();
        out.closed++;
      } else if (old.status === 'new' && j.volunteer && !c.approx) {
        // ได้รายการเต็ม (HELPME_KEY): เติมชื่อ เบอร์ ที่อยู่ พิกัดจริง ให้เคสที่ยังรอคัด และเอาป้าย "ตำแหน่งโดยประมาณ" ออก
        const flags = String(old.flags || '').split(',').filter(f => f && f !== 'approx_location').join(',');
        const r2 = await db.prepare(`UPDATE leads SET names=?, phone=?, address=CASE WHEN ?<>'' THEN ? ELSE address END, lat=COALESCE(?,lat), lng=COALESCE(?,lng),
          text=CASE WHEN ?<>'' THEN ? ELSE text END, flags=?, updatedAt=? WHERE id=? AND (IFNULL(names,'')<>? OR IFNULL(phone,'')<>? OR flags<>? OR IFNULL(lat,0)<>IFNULL(?,IFNULL(lat,0)))`)
          .bind(clean(c.name, MAX.name), clean(c.phone, MAX.phone).replace(/[^\d+\-\s,]/g, ''), clean(c.address, MAX.address), clean(c.address, MAX.address),
            num(c.lat, -90, 90), num(c.lng, -180, 180), clean(c.notes, 2000), clean(c.notes, 2000), flags, Date.now(), old.id,
            clean(c.name, MAX.name), clean(c.phone, MAX.phone).replace(/[^\d+\-\s,]/g, ''), flags, num(c.lat, -90, 90)).run();
        if (r2.meta.changes) out.filled++; else out.duplicate++;
      } else out.duplicate++;
      continue;
    }
    if (c.status === 'done') continue;
    const needs = (Array.isArray(c.needs) ? c.needs : String(c.needs || '').split(/\s*,\s*/)).filter(Boolean);
    const lvl = HELPME_LEVEL[c.level] || '';
    const l = { url, source: 'helpme', postedAt: Number(c.createdAt) || 0,
      title: [needs.join(', ') || 'ขอความช่วยเหลือ', c.people ? c.people + ' คน' : '', lvl ? 'น้ำระดับ' + lvl : ''].filter(Boolean).join(' · '),
      text: [c.notes || '', c.status === 'going' && c.volunteer ? 'ทีมที่รับใน Help Me: ' + c.volunteer : '', c.org ? 'องค์กรที่รับใน Help Me: ' + c.org : '',
        c.approx ? 'ตำแหน่งโดยประมาณ (Help Me ไม่เปิดเผยพิกัดจริงแบบสาธารณะ)' : ''].filter(Boolean).join('\n').slice(0, 2000),
      district: clean(c.district, MAX.district), address: clean(c.address, MAX.address), lat: num(c.lat, -90, 90), lng: num(c.lng, -180, 180),
      needs: list(needs), urgency: clampInt(c.urgency, 1, 3, 1), people: c.people ? String(c.people) + ' คน' : '',
      names: j.volunteer ? clean(c.name, MAX.name) : '', phone: j.volunteer ? clean(c.phone, MAX.phone).replace(/[^\d+\-\s,]/g, '') : '' };
    const res = await insertLead(db, l, st);
    if (res.ok && res.id && c.approx) await db.prepare("UPDATE leads SET flags = CASE WHEN flags='' THEN 'approx_location' ELSE flags || ',approx_location' END WHERE id=?").bind(res.id).run();
    if (res.duplicate) out.duplicate++; else if (res.status === 'new') out.added++; else if (res.status === 'rejected') out.rejected++;
  }
  return out;
}
/* จุดที่องค์กรลงพื้นที่ (outreach) ของ Help Me — ข้อมูลสาธารณะ (ชื่อองค์กร วันที่ พิกัด ลิงก์ข่าว)
   Apps Script ช้า (บางครั้ง 30 วิ) และบางทีตอบเป็นหน้า HTML: แคช 5 นาทีที่ edge และเก็บชุดล่าสุดที่ดีไว้ใน meta ใช้แทนเมื่อดึงไม่ได้ */
async function helpmeOutreach(db, env) {
  try {
    const pts = await sheetPoints(env, db, 'outreach');
    const points = pts.filter(p => p.lat != null).map(p => ({ org: p['หน่วยงาน'] || '', date: p['วันที่ลงพื้นที่'] || '', lat: p.lat, lng: p.lng,
      detail: (p['รายละเอียด'] || '').slice(0, 300), link: /^https?:\/\//.test(p['ลิงก์โพสต์ (Facebook/LINE/อื่น ๆ)'] || '') ? p['ลิงก์โพสต์ (Facebook/LINE/อื่น ๆ)'] : '' }));
    if (points.length) { const out = { ok: true, time: Date.now(), points, source: 'sheet' }; await setMeta(db, 'helpme_outreach_last', JSON.stringify(out)); return out; }
  } catch (e) {}
  return helpmeOutreachApps(db, env);
}
async function helpmeOutreachApps(db, env) {
  // ดึงไม่สำเร็จล่าสุดไม่ถึง 10 นาที: ไม่รอ Apps Script ซ้ำ ส่งชุดล่าสุดที่ดีไปเลย (หน้าเว็บจะดึงตรงจาก Help Me เองถ้าไม่มี)
  const failAt = Number(await getMeta(db, 'helpme_outreach_fail_at')) || 0;
  if (Date.now() - failAt < 10 * 60e3) { const last = await getMeta(db, 'helpme_outreach_last'); return last ? { ...JSON.parse(last), stale: true } : { ok: false, error: 'helpme_unavailable', points: [] }; }
  try {
    return await cached('helpme-outreach-v1', 300, async () => {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 8000);
      try {
        const r = await fetch((env.HELPME_API || HELPME_API) + '?action=outreach&t=' + Math.floor(Date.now() / 300000), { headers: UA, signal: ctl.signal, redirect: 'follow' });
        const j = await r.json();
        if (!j || !Array.isArray(j.points)) throw new Error('bad');
        const points = j.points.filter(p => p && p.lat && p.lng).map(p => ({ org: clean(p.org, 80), date: clean(p.date, 30), lat: num(p.lat, -90, 90), lng: num(p.lng, -180, 180),
          detail: clean(p.detail, 300), link: /^https?:\/\//.test(p.link || '') ? clean(p.link, 400) : '' })).filter(p => p.lat != null && p.lng != null);
        const out = { ok: true, time: Date.now(), points };
        await setMeta(db, 'helpme_outreach_last', JSON.stringify(out));
        return out;
      } finally { clearTimeout(tm); }
    });
  } catch (e) {
    await setMeta(db, 'helpme_outreach_fail_at', Date.now());
    const last = await getMeta(db, 'helpme_outreach_last');
    return last ? { ...JSON.parse(last), stale: true } : { ok: false, error: 'helpme_unavailable', points: [] };
  }
}
/* กล้อง CCTV จาก POPNIX Flood (ผ่าน helpme-th.pages.dev/api/cctv ของมูลนิธิ) ~1,400 ตัว: กล้องจราจร กทม. · สำนักการระบายน้ำ · iTIC · นนทบุรี
   ภาพนิ่งล่าสุดของแต่ละตัวอยู่ที่ flood.pop.in.th · รวมกับกล้อง iTIC ที่มีภาพสด (HLS) จาก Longdo · แคช 2 นาที */
async function popnixCams() {
  return cached('popnix-cctv-v1', 120, async () => {
    const r = await fetch('https://helpme-th.pages.dev/api/cctv', { headers: UA });
    const j = await r.json();
    if (!j || !j.ok || !Array.isArray(j.cams)) throw new Error('popnix');
    const base = /^https:\/\/[a-z0-9.-]+$/.test(j.base || '') ? j.base : 'https://flood.pop.in.th';
    const cams = j.cams.map(c => { const f = (j.feeds || [])[c[0]] || {}; const path = /^\/[\w/-]*$/.test(f.path || '') ? f.path : '/cctv/';
      return { id: 'p' + c[0] + '-' + c[1], title: clean(c[2], 120), lat: Number(c[3]), lng: Number(c[4]), img: base + path + encodeURIComponent(c[1]) + '.jpg?t=' + (Number(c[5]) || 0),
        hls: '', org: clean(f.org, 60) || 'POPNIX', at: Number(c[5]) || 0, src: 'POPNIX Flood' }; }).filter(c => isFinite(c.lat) && isFinite(c.lng));
    return { ok: true, time: Date.now(), cams };
  });
}
async function allCams() {
  const [p, l] = await Promise.allSettled([popnixCams(), cctvData()]);
  const cams = [...(l.status === 'fulfilled' ? l.value.cams.filter(c => c.hls).map(c => ({ ...c, src: 'iTIC' })) : []), ...(p.status === 'fulfilled' ? p.value.cams : [])];
  if (!cams.length) throw new Error('no_cams');
  return { ok: true, time: Date.now(), cams, sources: { popnix: p.status === 'fulfilled', itic: l.status === 'fulfilled' } };
}
/* สถิติแบบหน้า #stats ของ Help Me — คำนวณจากรายการเคสเต็ม (HELPME_KEY) ส่งกลับเฉพาะตัวเลขรวม ไม่มีชื่อ/เบอร์ · แคช 2 นาที
   ตัดเคสทดสอบ (test / ทดสอบ / เทส) · เวลาช่วยเสร็จใช้ updatedAt ของเคสที่ปิดแล้ว (ค่าประมาณ แบบเดียวกับ Help Me) */
async function helpmeStats(env, db) {
  // Apps Script ของ Help Me บางช่วงตอบช้าเกิน 25 วิ: เก็บชุดล่าสุดที่ดีไว้ใน meta แล้วส่งชุดนั้น (บอกว่าเก่า) แทนการว่างเปล่า
  try {
    const fresh = await helpmeStatsLive(env, db);
    if (db) await setMeta(db, 'helpme_stats_last', JSON.stringify(fresh));
    return fresh;
  } catch (e) {
    const last = db ? await getMeta(db, 'helpme_stats_last') : '';
    if (last) return { ...JSON.parse(last), stale: true };
    throw e;
  }
}
/* เขตจากหมุด (ที่อยู่ใน Help Me เขียนอิสระ ส่วนใหญ่ไม่มีคำว่า "เขต"): ถาม Photon แล้วจำไว้ใน meta ทีละพิกัด (~100 ม.) · สูงสุด 25 จุดต่อรอบ */
async function fillDistricts(db, cases) {
  if (!db) return;
  const need = cases.filter(c => !c.district && c.lat != null && c.lng != null);
  if (!need.length) return;
  const key = c => 'hmd:' + c.lat.toFixed(3) + ',' + c.lng.toFixed(3), keys = [...new Set(need.map(key))], known = new Map();
  for (let i = 0; i < keys.length; i += 90) {
    const part = keys.slice(i, i + 90), { results } = await db.prepare(`SELECT k,v FROM meta WHERE k IN (${part.map(() => '?').join(',')})`).bind(...part).all();
    results.forEach(r => known.set(r.k, r.v));
  }
  let asked = 0;
  for (const k of keys) {
    if (known.has(k) || asked >= 25) continue; asked++;
    const [lat, lng] = k.slice(4).split(',').map(Number);
    try {
      const r = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1&lang=default`, { headers: UA, cf: { cacheTtl: 86400 } });
      const p = ((await r.json()).features || [])[0]?.properties || {};
      const d = String(p.district || p.county || p.city || '').replace(/^เขต\s*/, '').trim() || '-';
      known.set(k, d); await setMeta(db, k, d);
    } catch (e) {}
  }
  need.forEach(c => { const d = known.get(key(c)); if (d && d !== '-') c.district = d; });
}
const HM_TEST = /\btest|ทดสอบ|เทส(?!โก้)/i; // เคสทดสอบในชีต ไม่นับในสถิติ
/* เคส Help Me รายเคสสำหรับการ์ดตัวเลขของแดชบอร์ด (เฉพาะรหัสทีม) · ไม่ส่งชื่อ/เบอร์ */
// ระดับน้ำในชีต Help Me → รหัสของ Helpme+ (ช่วงใช้ค่าบน) ให้ผลตรวจพื้นที่คิดคะแนนได้ · "แห้ง" ไม่มีรหัส
const HM_LEVEL_CODE = { 'ข้อเท้า': 'ankle', 'ข้อเท้า–เข่า': 'knee', 'เข่า': 'knee', 'เข่า–เอว': 'waist', 'เอว': 'waist', 'เอว–อก': 'chest', 'อก': 'chest', 'อกขึ้นไป': 'chest', 'มิดหัว': 'roof' };
async function helpmeCases(env, db) {
  const cases = await sheetCases(env); await fillDistricts(db, cases);
  const all = cases.filter(c => !HM_TEST.test([c.name, c.notes, c.address, (c.needs || []).join(' '), c.volunteer].join(' ')));
  return { ok: true, time: Date.now(), cases: all.map(c => ({ id: c.id, createdAt: c.createdAt, updatedAt: c.updatedAt, doneAt: c.doneAt, status: c.status, urgency: c.urgency,
    people: c.people, lat: c.lat, lng: c.lng, needs: c.needs, address: c.address, district: c.district, volunteer: c.volunteer,
    // หน้าจัดการเคสใช้เคส Help Me เป็นข้อมูลหลัก จึงต้องมีชื่อ เบอร์ รายละเอียด (endpoint นี้ให้เฉพาะอาสาที่ล็อกอินแล้ว)
    name: c.name || '', phone: c.phone || '', notes: c.notes || '', org: c.org || '', pickedAt: c.pickedAt || null,
    level: HM_LEVEL_CODE[String(c.level || '').split(' (')[0].trim()] || '', levelText: c.level || '' })) };
}
async function helpmeStatsLive(env, db) {
  return cached('helpme-stats-v4', 60, async () => {
    const cases = await sheetCases(env); await fillDistricts(db, cases);
    const j = { ok: true, volunteer: true, cases }; // จาก Google Sheet ของ Help Me (ข้อมูลเต็ม)
    const TEST = HM_TEST, now = Date.now(), H = 3600e3;
    const all = (j.cases || []).filter(c => !TEST.test([c.name, c.notes, c.address, (c.needs || []).join(' '), c.volunteer].join(' ')));
    const P = c => Math.max(1, Number(c.people) || 1), sev = c => Math.min(3, Math.max(1, Number(c.urgency) || 1));
    const open = all.filter(c => c.status === 'open'), going = all.filter(c => c.status === 'going'), done = all.filter(c => c.status === 'done'), act = all.filter(c => c.status !== 'done');
    const med = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const p90 = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(.9 * s.length) - 1)]; };
    // เวลาจริงจากคอลัมน์ "เวลารับเคส / เวลาช่วยเสร็จ" ถ้ามี ไม่มีใช้ "อัปเดตล่าสุด" (ค่าประมาณ)
    const doneT = done.map(c => (c.doneAt || Number(c.updatedAt)) - Number(c.createdAt)).filter(x => x > 0 && x < 60 * 24 * H);
    const pickT = all.filter(c => c.pickedAt).map(c => c.pickedAt - c.createdAt).filter(x => x > 0 && x < 60 * 24 * H);
    const day0 = Math.floor((now + 7 * H) / 864e5) * 864e5 - 7 * H;
    const bump = (o, k, c) => { const x = o[k] || (o[k] = { open: 0, urg: 0, going: 0, done: 0, ppl: 0, total: 0 }); x.total++; x[c.status === 'done' ? 'done' : c.status === 'going' ? 'going' : 'open']++; if (c.status !== 'done' && sev(c) === 3) x.urg++; if (c.status !== 'done') x.ppl += P(c); };
    const districts = {}, needs = {}, levels = {}, orgs = {}, teams = {};
    for (const c of all) {
      bump(districts, String(c.district || '').replace(/^เขต/, '').trim() || 'ไม่ทราบเขต', c);
      for (const n of new Set((c.needs || []).map(x => String(x).replace(/:.*$/, '').trim()).filter(Boolean))) bump(needs, n, c);
      bump(levels, c.level || 'none', c);
      if (c.org) bump(orgs, c.org, c);
      if (c.volunteer && c.status !== 'open') bump(teams, String(c.volunteer).replace(/^'/, '').trim(), c);
    }
    const rows = (o, n) => Object.entries(o).map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.total - a.total).slice(0, n);
    const days = []; for (let i = 13; i >= 0; i--) { const s = day0 - i * 864e5; days.push({ day: s, n: all.filter(c => c.createdAt >= s && c.createdAt < s + 864e5).length, k: done.filter(c => c.updatedAt >= s && c.updatedAt < s + 864e5).length }); }
    return { ok: true, time: now, full: !!j.volunteer, total: all.length, open: open.length, going: going.length, done: done.length,
      urgent: act.filter(c => sev(c) === 3).length, today: all.filter(c => c.createdAt >= day0).length, doneToday: done.filter(c => (c.doneAt || c.updatedAt) >= day0).length,
      people: { act: act.reduce((s, c) => s + P(c), 0), urgent: act.filter(c => sev(c) === 3).reduce((s, c) => s + P(c), 0), done: done.reduce((s, c) => s + P(c), 0) },
      times: { doneN: doneT.length, doneMed: med(doneT), doneP90: p90(doneT), pickupN: pickT.length, pickupMed: med(pickT) }, source: 'sheet',
      waits: { over6: open.filter(c => now - c.createdAt > 6 * H).length, over24: open.filter(c => now - c.createdAt > 24 * H).length, over72: open.filter(c => now - c.createdAt > 72 * H).length },
      districts: rows(districts, 40), needs: rows(needs, 15), levels: rows(levels, 8), orgs: rows(orgs, 20), teams: rows(teams, 20), days,
      // เวลาแจ้ง / เวลาช่วยเสร็จรายเคส (ตัวเลขเวลาอย่างเดียว) ให้กราฟเคสใหม่ต่อวันของแดชบอร์ดแบ่งตามช่วงเวลาที่เลือกได้
      created: all.map(c => c.createdAt).filter(Boolean), finished: done.map(c => c.doneAt || c.updatedAt).filter(Boolean) };
  });
}
async function pullAll(db, b, env) {
  const [traffy, helpme] = await Promise.all([pullLeads(db).catch(e => ({ ok: false, error: String(e.message || e).slice(0, 80) })), pullHelpme(db, env).catch(e => ({ ok: false, error: String(e.message || e).slice(0, 80) }))]);
  const n = k => (traffy[k] || 0) + (helpme[k] || 0);
  return { ok: traffy.ok || helpme.ok, added: n('added'), rejected: n('rejected'), duplicate: n('duplicate'), scanned: n('scanned'), closed: helpme.closed || 0, filled: helpme.filled || 0, traffy, helpme };
}

/* ---------- แชทกับทีม ---------- */
async function chatSend(db, b) {
  const team = clean(b.team, MAX.volunteer), text = clean(b.text, 1000), from = b.from === 'team' ? 'team' : 'hq';
  const lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180);
  if (!team || (!text && lat == null)) return { ok: false, error: 'missing' };
  const kind = ['call', 'sos'].includes(b.kind) ? b.kind : '', link = kind === 'call' && String(b.link || '').startsWith(MEET) ? String(b.link).slice(0, 300) : '';
  const r = await db.prepare('INSERT INTO chat (team,sender,name,text,caseId,lat,lng,at,readHq,readTeam,kind,link) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(team, from, clean(b.name, 60), text, clean(b.caseId, 30), lat, lng, Date.now(), from === 'hq' ? 1 : 0, from === 'team' ? 1 : 0, kind, link).run();
  await setMeta(db, 'chat_rev', String(r.meta.last_row_id || Date.now()));
  return { ok: true, n: r.meta.last_row_id };
}
async function chatList(db, p) {
  const team = clean(p.team, MAX.volunteer), since = Number(p.since) || 0;
  if (!team) return { ok: false, error: 'missing_team' };
  const { results } = await db.prepare('SELECT n,team,sender,name,text,caseId,lat,lng,at,readHq,readTeam,kind,link FROM chat WHERE team=? AND n>? ORDER BY n DESC LIMIT 200').bind(team, since).all();
  return { ok: true, messages: results.reverse(), rev: await getMeta(db, 'chat_rev') || '0' };
}
async function chatThreads(db) {
  const { results } = await db.prepare(`SELECT team, MAX(n) last, SUM(CASE WHEN sender='team' AND readHq=0 THEN 1 ELSE 0 END) unread, MAX(at) at FROM chat GROUP BY team ORDER BY last DESC LIMIT 200`).all();
  const out = [];
  for (const t of results) { const m = await db.prepare('SELECT sender,name,text,lat,at,kind FROM chat WHERE n=?').bind(t.last).first(); out.push({ team: t.team, unread: t.unread || 0, at: t.at, last: m }); }
  return { ok: true, threads: out, rev: await getMeta(db, 'chat_rev') || '0', alerts: await alertsList(db) };
}
async function chatRead(db, b) {
  const team = clean(b.team, MAX.volunteer); if (!team) return { ok: false, error: 'missing_team' };
  if (b.side === 'team') await db.prepare("UPDATE chat SET readTeam=1 WHERE team=? AND sender='hq' AND readTeam=0").bind(team).run();
  else await db.prepare("UPDATE chat SET readHq=1 WHERE team=? AND sender='team' AND readHq=0").bind(team).run();
  return { ok: true };
}

async function listLeads(db, p) {
  const since = Date.now() - clampInt(p.days, 1, 120, 30) * 86400e3;
  const { results } = await db.prepare('SELECT * FROM leads WHERE foundAt>? ORDER BY postedAt DESC LIMIT 600').bind(since).all();
  return { ok: true, leads: results.map(l => ({ ...l, needs: l.needs ? l.needs.split(/\s*,\s*/).filter(Boolean) : [], names: l.names ? l.names.split(/\s*,\s*/).filter(Boolean) : [],
    flags: (l.flags || '').split(',').filter(f => f && !f.startsWith('acct:')), by: l.by_ })),
    settings: await leadSettings(db), pulledAt: Number(await getMeta(db, 'leads_pulled_at')) || null };
}
async function decideLead(db, b) {
  const l = await db.prepare('SELECT * FROM leads WHERE id=?').bind(clean(b.id, 30)).first();
  if (!l) return { ok: false, error: 'not_found' };
  const by = clean(b.by, 60), now = Date.now();
  if (b.decision === 'reject' || b.decision === 'reopen') {
    if (l.status === 'accepted') return { ok: false, error: 'already_case', caseId: l.caseId };
    await db.prepare('UPDATE leads SET status=?, reason=?, by_=?, updatedAt=? WHERE id=?').bind(b.decision === 'reject' ? 'rejected' : 'new', b.decision === 'reject' ? clean(b.reason, 120) || 'rejected_by_staff' : '', by, now, l.id).run();
    return { ok: true };
  }
  if (b.decision !== 'accept') return { ok: false, error: 'bad_decision' };
  if (l.status === 'accepted') return { ok: true, caseId: l.caseId, duplicate: true };
  const flags = (l.flags || '').split(',').filter(f => /^(asks_money|account_reused)/.test(f));
  if (flags.length && !b.confirmRisk) return { ok: false, error: 'flagged', flags };
  const id = caseId(), u = clampInt(b.urgency, 1, 3, l.urgency || 1);
  const notes = clean([`[จากโซเชียล ${l.source}] ${l.url}`, `โพสต์ ${new Date(l.postedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`, l.people ? 'จำนวน: ' + l.people : '', l.text].filter(Boolean).join('\n'), MAX.notes);
  await db.prepare(`INSERT INTO cases (id,createdAt,status,urgency,name,phone,district,people,address,lat,lng,level,needs,vulnerable,notes,volunteer,updatedAt,token,clientId,households,bags,cctv,ipHash)
    VALUES (?,?,'open',?,?,?,?,1,?,?,?,'',?,'',?,'',?,?,NULL,NULL,NULL,'','')`)
    .bind(id, l.postedAt || now, u, clean(l.names, MAX.name), clean(l.phone, MAX.phone), l.district, clean(l.address || l.title, MAX.address), l.lat, l.lng, l.needs, notes, now, rand(16)).run();
  await db.prepare("UPDATE leads SET status='accepted', caseId=?, by_=?, updatedAt=? WHERE id=?").bind(id, by, now, l.id).run();
  await bumpRev(db);
  return { ok: true, caseId: id };
}
async function saveLeadSettings(db, b) {
  if (b.eventStart !== undefined) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.eventStart))) return { ok: false, error: 'bad_date' }; await setMeta(db, 'leads_event_start', b.eventStart); }
  if (b.maxAgeDays !== undefined) await setMeta(db, 'leads_max_age', clampInt(b.maxAgeDays, 1, 90, 14));
  return { ok: true, settings: await leadSettings(db) };
}

/* พื้นที่น้ำท่วมจากดาวเทียม GISTDA (api-gateway.gistda.or.th) — ภาพแผนที่ (TMS ลำดับแบบ XYZ) ผ่านเซิร์ฟเวอร์นี้ ไม่เปิดเผย key
   ตั้ง secret GISTDA_KEY (สมัครฟรีที่ api-gateway.gistda.or.th) · แคชที่ edge 30 นาที */
const GISTDA_LAYERS = { '1day': 'flood/1day', '3days': 'flood/3days', '7days': 'flood/7days', '30days': 'flood/30days', freq: 'flood-freq' };
async function gistdaTile(env, layer, z, x, y) {
  if (!env.GISTDA_KEY) return new Response(null, { status: 404, headers: { 'x-gistda': 'no-key' } });
  const r = await fetch(`https://api-gateway.gistda.or.th/api/2.0/resources/maps/${GISTDA_LAYERS[layer]}/tms/${z}/${x}/${y}?api_key=${encodeURIComponent(env.GISTDA_KEY)}`,
    { headers: UA, cf: { cacheTtl: 1800, cacheEverything: true } });
  if (!r.ok || !String(r.headers.get('content-type') || '').startsWith('image/')) return new Response(null, { status: 502 });
  return new Response(r.body, { headers: { 'content-type': r.headers.get('content-type'), 'cache-control': 'public, max-age=1800' } });
}

async function api(request, env) {
  const db = env.DB;
  const gm = new URL(request.url).pathname.match(/^\/api\/gistda\/(1day|3days|7days|30days|freq)\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})(?:\.png)?$/);
  if (gm && request.method === 'GET') return gistdaTile(env, gm[1], gm[2], gm[3], gm[4]);
  if (!db) return json({ ok: false, error: 'no_database', hint: 'ผูก D1 ชื่อ DB กับโปรเจกต์ Pages ก่อน' }, 500);
  await init(db);
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const p = Object.fromEntries(url.searchParams), vol = isVol(env, p.key);
    switch (p.action) {
      case 'list': {
        const since = Number(p.since) || 0;
        const { results } = await db.prepare('SELECT * FROM cases WHERE updatedAt>? ORDER BY createdAt').bind(since).all();
        return json({ ok: true, cases: results.map(r => outCase(r, vol)), volunteer: vol });
      }
      case 'rev': { const r = await db.prepare("SELECT v FROM meta WHERE k='rev'").first(); return json({ ok: true, rev: r ? r.v : '0' }); }
      case 'teams': {
        const t = await readTeams(db);
        if (vol) return json({ ok: true, teams: t });
        return json({ ok: true, public: true, teams: t.filter(x => Date.now() - x.updatedAt < 30 * 60e3).map(x => ({ team: x.team, lat: Math.round(x.lat * 1000) / 1000, lng: Math.round(x.lng * 1000) / 1000, updatedAt: x.updatedAt, busy: !!x.caseId })) });
      }
      case 'places': return json(await listPlaces(db));
      case 'roster': return json(vol ? await listRoster(db) : { ok: false, error: 'not_volunteer' });
      case 'stock': return json(vol ? await listStock(db) : { ok: false, error: 'not_volunteer' });
      case 'water': try { return json(await waterData()); } catch (e) { return json({ ok: false, error: 'water_unavailable' }); }
      case 'outreach': return json(await helpmeOutreach(db, env));
      // ศูนย์พักพิง / เครือข่าย จากชีตของ Help Me (ข้อมูลสาธารณะของจุด ไม่ใช่ผู้ประสบภัย)
      case 'sheet_places': try { const [s, n] = await Promise.all([sheetPoints(env, db, 'shelters').catch(() => []), sheetPoints(env, db, 'network').catch(() => [])]);
        return json({ ok: true, shelters: s.filter(x => x.lat != null), network: n.filter(x => x.lat != null) }); } catch (e) { return json({ ok: false, error: 'sheet_unavailable' }); }
      case 'helpme_cases': if (!vol) return json({ ok: false, error: 'not_volunteer' }); try { return json(await helpmeCases(env, db)); } catch (e) { return json({ ok: false, error: 'helpme_unavailable' }); }
      case 'helpme_stats': if (!vol) return json({ ok: false, error: 'not_volunteer' }); try { return json(await helpmeStats(env, db)); } catch (e) { return json({ ok: false, error: 'helpme_unavailable' }); }
      case 'gistda_status': return json({ ok: true, enabled: !!env.GISTDA_KEY, layers: Object.keys(GISTDA_LAYERS) });
      case 'cctv': try { return json(await allCams()); } catch (e) { return json({ ok: false, error: 'cctv_unavailable' }); }
      case 'zones': return json(vol ? await listZones(db) : { ok: false, error: 'not_volunteer' });
      // ข้อมูลจากชีตสาธารณะ (ไม่มีข้อมูลผู้ประสบภัย) จึงไม่ต้องใช้รหัส · แคช 5 นาที
      case 'covered': return json(await listCovered(db));
      case 'backup_status': return json(vol ? await backupStatus(env) : { ok: false, error: 'not_volunteer' });
      case 'leads': return json(vol ? await listLeads(db, p) : { ok: false, error: 'not_volunteer' });
      case 'chat': { if (p.tk) { const t = await teamFrom(env, db, p); return json(t ? await chatList(db, { ...p, team: t.name }) : { ok: false, error: 'bad_link' }); }
        return json(vol ? await chatList(db, p) : { ok: false, error: 'not_volunteer' }); }
      case 'team_me': { const t = await teamFrom(env, db, p); return json(t ? await teamMe(db, t) : { ok: false, error: p.tk ? 'bad_link' : 'not_volunteer' }); }
      case 'team_track': return json(vol ? await teamTrack(db, p) : { ok: false, error: 'not_volunteer' });
      case 'chat_threads': return json(vol ? await chatThreads(db) : { ok: false, error: 'not_volunteer' });
      case 'chat_rev': return json(vol ? { ok: true, rev: await getMeta(db, 'chat_rev') || '0' } : { ok: false, error: 'not_volunteer' });
      default: return json({ ok: true, service: 'umplus-cloudflare', time: new Date().toISOString() });
    }
  }
  if (request.method === 'POST') {
    let b = {};
    try { b = JSON.parse(await request.text() || '{}'); } catch (e) { return json({ ok: false, error: 'bad_json' }); }
    if (b.action === 'create') return json(await createCase(db, b, request.headers.get('cf-connecting-ip') || ''));
    if (b.action === 'track') return json(await trackCase(db, b));
    const needKey = { update: updateCase, ping: pingTeam, place: savePlace, roster_save: saveRoster, stock_item: saveStockItem, stock_move: moveStock, covered_add: addCovered, import_cases: importCases, zone_save: saveZone, bag_pack: packBags,
      lead_add: addLeads, chat_send: (db, b) => chatSend(db, { ...b, kind: '', link: '' }), chat_read: chatRead, lead_decide: decideLead, lead_settings: saveLeadSettings,
      team_link: renewTeamLink, hq_phone: setHqPhone, sos_ack: ackSos, hq_call: (db, b) => callStart(db, clean(b.team, MAX.volunteer), 'hq', b) };
    // คำขอจากหน้ามือถือของทีม (ลิงก์เฉพาะทีม หรือรหัสกลาง + ชื่อทีม)
    if (TEAM_POST[b.action] && (b.tk || ['team_ping', 'team_status', 'team_case', 'team_sos', 'call_start'].includes(b.action))) {
      const t = await teamFrom(env, db, b);
      if (!t) return json({ ok: false, error: b.tk ? 'bad_link' : 'not_volunteer' });
      return json(await TEAM_POST[b.action](db, t, b));
    }
    if (b.action === 'lead_pull') return json(isVol(env, b.key) ? await pullAll(db, b, env) : { ok: false, error: 'not_volunteer' });
    if (b.action === 'backup_now') return json(isVol(env, b.key) ? await backupToSheet(env) : { ok: false, error: 'not_volunteer' });
    if (needKey[b.action]) {
      if (!isVol(env, b.key)) return json({ ok: false, error: 'not_volunteer' });
      return json(await needKey[b.action](db, b));
    }
    return json({ ok: false, error: 'unknown_action' });
  }
  return json({ ok: false, error: 'method' }, 405);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      // อนุญาตเว็บสำรองบน GitHub Pages เรียก API นี้ได้ (ใช้ฐานข้อมูลเดียวกัน)
      const origin = request.headers.get('origin') || '';
      const cors = /^https:\/\/(been6505\.github\.io|[a-z0-9-]+\.ummatee-help\.pages\.dev|admin-um-help\.pages\.dev|admin-helpme\.pages\.dev|admin\.um\.help)$/.test(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' } : {};
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      let res;
      try { res = await api(request, env); }
      catch (e) { res = json({ ok: false, error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500); }
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    }
    return env.ASSETS.fetch(request);
  },
  // cron (ตั้งใน wrangler config): ส่งแถวที่เปลี่ยนไป Google Sheet ส่งต่อจนคิวหมด สูงสุด 5 รอบต่อครั้ง
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      for (let i = 0; i < 5; i++) { const r = await backupToSheet(env); if (!r.ok || !r.more) break; }
    })());
  }
};
