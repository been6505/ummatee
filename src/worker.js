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
  `CREATE TABLE IF NOT EXISTS sync_queue (n INTEGER PRIMARY KEY AUTOINCREMENT, tbl TEXT, rid TEXT)`
];
const BACKUP_TABLES = { cases: 'id', roster: 'id', stock: 'id', places: 'id', stock_log: 'n', zones: 'id' };
const BACKUP_OMIT = { cases: ['token', 'ipHash', 'clientId'] }; // ไม่ส่งรหัสติดตามเคสและข้อมูลกันสแปมไปที่ชีต
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
    try { await db.prepare('ALTER TABLE stock ADD COLUMN kit TEXT').run(); } catch (e) {} // ของในถุงยังชีพ 1 ถุง: [{id, qty}] // ทีม/รถที่รับของ (เช่น ถุงยังชีพขึ้นรถ)
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
  return results.map(t => ({ team: t.team, lat: t.lat, lng: t.lng, accuracy: t.accuracy, caseId: t.caseId || '', updatedAt: t.updatedAt }));
}
async function pingTeam(db, b) {
  const team = clean(b.team, MAX.volunteer);
  if (!team) return { ok: false, error: 'missing_team' };
  if (b.stop) { await db.prepare('DELETE FROM teams_live WHERE team=?').bind(team).run(); return { ok: true, stopped: true }; }
  const lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180);
  if (lat == null || lng == null) return { ok: false, error: 'bad_location' };
  await db.prepare('INSERT INTO teams_live (team,lat,lng,accuracy,caseId,updatedAt) VALUES (?,?,?,?,?,?) ON CONFLICT(team) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,caseId=excluded.caseId,updatedAt=excluded.updatedAt')
    .bind(team, lat, lng, clampInt(b.accuracy, 0, 100000, null), clean(b.caseId, 30), Date.now()).run();
  return { ok: true };
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
  const { results } = await db.prepare('SELECT id,name,leader,phone,members,vehicle,zone,status,note,updatedAt FROM roster WHERE active=1 ORDER BY name').all();
  return { ok: true, roster: results.map(r => ({ ...r, members: r.members == null ? '' : r.members })), live: await readTeams(db) };
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
  return cached('cctv-v2', 3600, async () => {
    const j = await fetch('https://traffic.longdo.com/camera.json', { headers: UA }).then(r => r.json());
    const cams = (j.item || []).filter(c => String(c.geocode || '').startsWith('10')).map(c => {
      const img = /X\.X\.X\.X/.test(c.imgurl || '') ? '' : (c.imgurl || '');
      const https = u => /^https:\/\/[^\s"'<>]+$/.test(u || '') ? u : ''; // ส่งต่อเฉพาะลิงก์ https
      return { id: c.camid, title: String(c.title || '').replace(/^\(กรุงเทพมหานคร\)\s*/, '').trim(), lat: Number(c.latitude), lng: Number(c.longitude), img: https(img), hls: https(c.hls_url), org: c.organization || '' };
    }).filter(c => isFinite(c.lat) && isFinite(c.lng));
    return { ok: true, time: Date.now(), cams };
  });
}

async function api(request, env) {
  const db = env.DB;
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
      case 'cctv': try { return json(await cctvData()); } catch (e) { return json({ ok: false, error: 'cctv_unavailable' }); }
      case 'zones': return json(vol ? await listZones(db) : { ok: false, error: 'not_volunteer' });
      case 'backup_status': return json(vol ? await backupStatus(env) : { ok: false, error: 'not_volunteer' });
      default: return json({ ok: true, service: 'umplus-cloudflare', time: new Date().toISOString() });
    }
  }
  if (request.method === 'POST') {
    let b = {};
    try { b = JSON.parse(await request.text() || '{}'); } catch (e) { return json({ ok: false, error: 'bad_json' }); }
    if (b.action === 'create') return json(await createCase(db, b, request.headers.get('cf-connecting-ip') || ''));
    if (b.action === 'track') return json(await trackCase(db, b));
    const needKey = { update: updateCase, ping: pingTeam, place: savePlace, roster_save: saveRoster, stock_item: saveStockItem, stock_move: moveStock, import_cases: importCases, zone_save: saveZone, bag_pack: packBags };
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
      const cors = /^https:\/\/(been6505\.github\.io|[a-z0-9-]+\.ummatee-help\.pages\.dev|admin-um-help\.pages\.dev|admin\.um\.help)$/.test(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' } : {};
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
