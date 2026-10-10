import { AsyncLocalStorage } from 'node:async_hooks';

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
  `CREATE TABLE IF NOT EXISTS zones (id TEXT PRIMARY KEY, name TEXT, color TEXT, lat REAL, lng REAL, radius INTEGER, note TEXT, active INTEGER, updatedAt INTEGER, by_ TEXT)`,
  `CREATE TABLE IF NOT EXISTS covered_extra (n INTEGER PRIMARY KEY AUTOINCREMENT, org TEXT, date TEXT, items TEXT, qty TEXT, place TEXT, location TEXT, by_ TEXT, createdAt INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sync_queue (n INTEGER PRIMARY KEY AUTOINCREMENT, tbl TEXT, rid TEXT)`,
  `CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, url TEXT UNIQUE, source TEXT, postedAt INTEGER, foundAt INTEGER, title TEXT, text TEXT,
    district TEXT, address TEXT, lat REAL, lng REAL, needs TEXT, urgency INTEGER, people TEXT, names TEXT, phone TEXT, flags TEXT,
    status TEXT, reason TEXT, caseId TEXT, by_ TEXT, updatedAt INTEGER)`,
  `CREATE INDEX IF NOT EXISTS leads_status ON leads(status, postedAt)`,
  `CREATE TABLE IF NOT EXISTS chat (n INTEGER PRIMARY KEY AUTOINCREMENT, team TEXT, sender TEXT, name TEXT, text TEXT, caseId TEXT, lat REAL, lng REAL, at INTEGER, readHq INTEGER DEFAULT 0, readTeam INTEGER DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS chat_team ON chat(team, n)`,
  `CREATE TABLE IF NOT EXISTS team_track (n INTEGER PRIMARY KEY AUTOINCREMENT, team TEXT, lat REAL, lng REAL, accuracy INTEGER, battery INTEGER, speed REAL, at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS team_track_team ON team_track(team, n)`,
  `CREATE INDEX IF NOT EXISTS team_track_at ON team_track(team, at)`,
  `CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, secret TEXT, mode TEXT, team TEXT, caller TEXT, name TEXT, createdAt INTEGER, endedAt INTEGER)`,
  `CREATE TABLE IF NOT EXISTS call_sig (n INTEGER PRIMARY KEY AUTOINCREMENT, call TEXT, peer TEXT, dest TEXT, kind TEXT, data TEXT, at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS call_sig_call ON call_sig(call, n)`,
  `CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, kind TEXT, status TEXT, name TEXT, phone TEXT, province TEXT, wrPref TEXT, username TEXT, salt TEXT, hash TEXT, data TEXT, result TEXT, fails INTEGER DEFAULT 0, lockUntil INTEGER, ip TEXT, createdAt INTEGER, decidedAt INTEGER, decidedBy TEXT, note TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS applications_u ON applications(kind, username)`,
  `CREATE TABLE IF NOT EXISTS wr_users (id TEXT PRIMARY KEY, warroom TEXT, username TEXT, name TEXT, role TEXT, salt TEXT, hash TEXT, active INTEGER, fails INTEGER DEFAULT 0, lockUntil INTEGER, lastLogin INTEGER, createdAt INTEGER, by_ TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS wr_users_u ON wr_users(warroom, username)`,
  `CREATE TABLE IF NOT EXISTS wr_sessions (token TEXT PRIMARY KEY, userId TEXT, warroom TEXT, expires INTEGER, at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS staff (id TEXT PRIMARY KEY, username TEXT UNIQUE, name TEXT, role TEXT, salt TEXT, hash TEXT, active INTEGER, fails INTEGER DEFAULT 0, lockUntil INTEGER, lastLogin INTEGER, createdAt INTEGER, by_ TEXT)`,
  `CREATE TABLE IF NOT EXISTS staff_sessions (token TEXT PRIMARY KEY, staffId TEXT, expires INTEGER, at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS tickets (t TEXT PRIMARY KEY, k TEXT, exp INTEGER)`,
  `CREATE TABLE IF NOT EXISTS warrooms (id TEXT PRIMARY KEY, name TEXT, color TEXT, lat REAL, lng REAL, radius INTEGER, districts TEXT, address TEXT, phone TEXT, lead TEXT, note TEXT, active INTEGER, createdAt INTEGER, updatedAt INTEGER, by_ TEXT)`,
  `CREATE TABLE IF NOT EXISTS intel (kind TEXT, k TEXT, at INTEGER, seen INTEGER, title TEXT, body TEXT, level TEXT, src TEXT, province TEXT, lat REAL, lng REAL, val REAL, data TEXT, PRIMARY KEY (kind, k))`,
  `CREATE INDEX IF NOT EXISTS intel_seen ON intel(kind, seen)`,
  `CREATE TABLE IF NOT EXISTS case_photo (n INTEGER PRIMARY KEY AUTOINCREMENT, caseId TEXT, team TEXT, kind TEXT, at INTEGER, lat REAL, lng REAL, size INTEGER, img BLOB)`,
  `CREATE INDEX IF NOT EXISTS case_photo_case ON case_photo(caseId, n)`,
  `CREATE TABLE IF NOT EXISTS road_q (n INTEGER PRIMARY KEY AUTOINCREMENT, team TEXT, at INTEGER, lat REAL, lng REAL, rms REAL, peak REAL, bumps INTEGER, spd REAL)`,
  `CREATE INDEX IF NOT EXISTS road_q_at ON road_q(at)`,
  `CREATE TABLE IF NOT EXISTS team_route (team TEXT PRIMARY KEY, caseId TEXT, data TEXT, at INTEGER, by_ TEXT)`,
  `CREATE TABLE IF NOT EXISTS ptt (n INTEGER PRIMARY KEY AUTOINCREMENT, ch TEXT, sender TEXT, kind TEXT, name TEXT, dur REAL, at INTEGER, audio BLOB)`,
  `CREATE INDEX IF NOT EXISTS ptt_at ON ptt(at)`,
  `CREATE TABLE IF NOT EXISTS board (id TEXT PRIMARY KEY, room TEXT, title TEXT, body TEXT, status TEXT, lat REAL, lng REAL, place TEXT, cases TEXT, due INTEGER, dueEnd INTEGER, allDay INTEGER, assignee TEXT, color TEXT, imgs TEXT, createdAt INTEGER, updatedAt INTEGER, by_ TEXT, deleted INTEGER DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS board_room ON board(room, deleted)`,
  `CREATE TABLE IF NOT EXISTS board_img (id TEXT PRIMARY KEY, cardId TEXT, room TEXT, data TEXT, at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS rallies (id TEXT PRIMARY KEY, lat REAL, lng REAL, label TEXT, note TEXT, teams TEXT, caseId TEXT, warroom TEXT, createdAt INTEGER, by_ TEXT, closedAt INTEGER)`,
  `CREATE TABLE IF NOT EXISTS rally_resp (rallyId TEXT, team TEXT, status TEXT, at INTEGER, note TEXT, PRIMARY KEY (rallyId, team))`,
  `CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, action TEXT, cat TEXT, role TEXT, actor TEXT, target TEXT, summary TEXT, data TEXT, ip TEXT, undo TEXT, undone INTEGER)`,
  `CREATE INDEX IF NOT EXISTS audit_at ON audit(at)`,
  `CREATE INDEX IF NOT EXISTS cases_status_vol ON cases(status, volunteer)`,
  `CREATE TABLE IF NOT EXISTS feedback (n INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, page TEXT, by_ TEXT, room TEXT, text TEXT, done INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS broadcasts (id TEXT PRIMARY KEY, level TEXT, title TEXT, body TEXT, link TEXT, scope TEXT, provinces TEXT, districts TEXT, lat REAL, lng REAL, radiusKm REAL, createdAt INTEGER, expiresAt INTEGER, cancelledAt INTEGER, by_ TEXT, warroom TEXT)`,
  `CREATE TABLE IF NOT EXISTS hazard_reports (id TEXT PRIMARY KEY, type TEXT, lat REAL, lng REAL, radiusM INTEGER, note TEXT, level TEXT, createdAt INTEGER, expiresAt INTEGER, closedAt INTEGER, by_ TEXT)`,
  `CREATE TABLE IF NOT EXISTS warroom_staff (id TEXT PRIMARY KEY, wr TEXT, name TEXT, role TEXT, phone TEXT, shift TEXT, note TEXT, active INTEGER, updatedAt INTEGER)`
];
const BACKUP_TABLES = { cases: 'id', roster: 'id', stock: 'id', places: 'id', stock_log: 'n', zones: 'id' };
const BACKUP_OMIT = { cases: ['token', 'ipHash', 'clientId'], roster: ['token'] };
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
    for (const [t, col] of [['roster', 'token TEXT'], ['roster', 'sosAt INTEGER'], ['roster', 'sosAck INTEGER'], ['teams_live', 'battery INTEGER'], ['teams_live', 'appAt INTEGER'], ['teams_live', 'speed REAL'],
      ['teams_live', 'heading REAL'], ['chat', 'kind TEXT'], ['chat', 'link TEXT'], ['roster', 'warroom TEXT'], ['stock', 'warroom TEXT'], ['warrooms', 'kind TEXT'], ['warrooms', 'province TEXT'], ['roster', 'gmaps TEXT'],
      ['cases', 'src TEXT'], ['cases', 'hmHash TEXT'], ['cases', 'hmStatus TEXT'], ['cases', 'hmVolunteer TEXT'], ['cases', 'hmUpdatedAt INTEGER'], ['cases', 'localAt INTEGER'],
      ['cases', 'sevSet INTEGER'], ['cases', 'intake TEXT'], ['cases', 'teamMemo TEXT'], ['cases', 'teamArrivedAt INTEGER'], ['cases', 'teamMemoAt INTEGER'], ['teams_live', 'alt REAL'], ['teams_live', 'charging INTEGER'], ['teams_live', 'sig INTEGER'], ['teams_live', 'net TEXT'], ['teams_live', 'carrier TEXT'], ['teams_live', 'temp REAL'], ['teams_live', 'hum REAL'], ['teams_live', 'wxAt INTEGER'], ['teams_live', 'devAt INTEGER'], ['ptt', 'talk TEXT'], ['rallies', 'isAll INTEGER'], ['cases', 'teamIssue TEXT'], ['cases', 'teamIssueAt INTEGER'], ['cases', 'sevBy TEXT'], ['audit', 'undo TEXT'], ['audit', 'undone INTEGER'], ['cases', 'photos TEXT'], ['cases', 'province TEXT'], ['cases', 'org TEXT'], ['cases', 'dupOf TEXT'], ['cases', 'glat REAL'], ['cases', 'glng REAL'], ['cases', 'glabel TEXT'], ['cases', 'gtry INTEGER'], ['cases', 'gai INTEGER'], ['cases', 'pickedAt INTEGER'], ['cases', 'doneAt INTEGER'], ['cases', 'pinCheck TEXT'], ['cases', 'levelText TEXT'], ['cases', 'photoAi TEXT'], ['cases', 'hqNote TEXT'], ['cases', 'teamDoneAt INTEGER'], ['cases', 'teamNote TEXT'], ['warrooms', 'token TEXT']]) { try { await db.prepare(`ALTER TABLE ${t} ADD COLUMN ${col}`).run(); } catch (e) {} }
    await db.prepare('CREATE INDEX IF NOT EXISTS roster_token ON roster(token)').run();
    const c = await db.prepare('SELECT COUNT(*) n FROM stock').first();
    if (!c.n) {
      const now = Date.now();
      await db.batch(STOCK_SEED.map((x, i) => db.prepare('INSERT INTO stock (id,name,unit,category,qty,min,needed,note,updatedAt) VALUES (?,?,?,?,0,NULL,?,?,?)')
        .bind('S' + String(i + 1).padStart(2, '0'), x[0], x[1], x[2], x[0] === 'รองเท้าบูท' ? 1 : 0, '', now)));
    }
    if (!await getMeta(db, 'backup_seeded')) {
      await db.batch(Object.entries(BACKUP_TABLES).map(([t, k]) => db.prepare(`INSERT INTO sync_queue (tbl,rid) SELECT '${t}', ${k} FROM ${t}`)));
      await setMeta(db, 'backup_seeded', String(Date.now()));
    }
  })().catch(e => { ready = null; throw e; });
  return ready;
}

const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const clampInt = (v, lo, hi, d) => { const n = parseInt(v, 10); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); };
const num = (v, lo, hi) => { const n = Number(v); return (v === '' || v == null || isNaN(n) || n < lo || n > hi) ? null : Math.round(n * 1e6) / 1e6; };
const list = a => (Array.isArray(a) ? a : []).map(x => clean(x, 40).replace(/,/g, '')).filter(Boolean).slice(0, 12);
const maskPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length < 4 ? '***' : 'xxx-xxx-' + d.slice(-4); };
const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(b => b.toString(16).padStart(2, '0')).join(''); };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const ctEq = (a, b) => { a = String(a || ''); b = String(b || ''); if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
function keyEq(real, k) { if (!real || !k || real.length !== k.length) return false; let d = 0; for (let i = 0; i < real.length; i++) d |= real.charCodeAt(i) ^ k.charCodeAt(i); return d === 0; }
function isVol(env, key) {
  const k = String(key || '');
  return keyEq(String(env.VOLUNTEER_KEY || ''), k) || keyEq(String(env.VOLUNTEER_KEY_OLD || ''), k);
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

async function kbOrderGet(db) { let m = {}; try { m = JSON.parse(await getMeta(db, 'kb_order') || '{}'); } catch (e) {} return { ok: true, order: m }; }
async function kbOrderSave(db, b) {
  const ids = (Array.isArray(b.ids) ? b.ids : []).map(x => clean(x, 40)).filter(Boolean).slice(0, 400);
  if (!ids.length) return { ok: false, error: 'no_ids' };
  let m = {}; try { m = JSON.parse(await getMeta(db, 'kb_order') || '{}'); } catch (e) {}
  ids.forEach((id, i) => { m[id] = i; });
  const keys = Object.keys(m); if (keys.length > 3000) keys.slice(0, keys.length - 3000).forEach(k => delete m[k]);
  await setMeta(db, 'kb_order', JSON.stringify(m)); await bumpRev(db);
  return { ok: true };
}
async function bumpRev(db) { await db.prepare("INSERT INTO meta (k,v) VALUES ('rev',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(String(Date.now())).run(); }
const km = (a, b, c, d) => { const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(''); }

const aiText = out => { if (!out) return ''; if (typeof out.response === 'string') return out.response; if (out.response && typeof out.response === 'object') return JSON.stringify(out.response); const m = out.choices && out.choices[0] && out.choices[0].message; return m && typeof m.content === 'string' ? m.content : ''; };
const noPin = r => r.lat == null || r.lat === '' || !Number(r.lat);
const INTAKE_KEYS = { name: 80, phone: 30, car: 300, handoff: 300, water: 60, risks: 400, latest: 20, items: 600 };
function parseIntake(v) { if (!v) return null; try { const o = JSON.parse(v); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
function cleanIntake(x) { const o = {}; if (!x || typeof x !== 'object') return o; for (const [k, m] of Object.entries(INTAKE_KEYS)) { const v = String(x[k] == null ? '' : x[k]).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, m); if (v) o[k] = v; } return o; }
function outCase(r, full) {
  const o = { id: r.id, createdAt: r.createdAt, status: r.status, urgency: r.urgency, name: r.name || '', phone: r.phone || '', district: r.district || '',
    people: r.people, address: r.address || '', lat: r.lat == null ? '' : r.lat, lng: r.lng == null ? '' : r.lng, level: r.level || '',
    needs: r.needs ? String(r.needs).split(/\s*,\s*/).filter(Boolean) : [], vulnerable: r.vulnerable ? String(r.vulnerable).split(/\s*,\s*/).filter(Boolean) : [],
    notes: r.notes || '', volunteer: r.volunteer || '', updatedAt: r.updatedAt, households: r.households == null ? '' : r.households,
    bags: r.bags == null ? '' : r.bags, cctv: r.cctv || '', pickedAt: r.pickedAt || null, doneAt: r.doneAt || null, dupOf: r.dupOf || '', hqNote: r.hqNote || '', teamDoneAt: r.teamDoneAt || null, teamNote: r.teamNote || '', teamMemo: r.teamMemo || '', teamMemoAt: r.teamMemoAt || null, teamArrivedAt: r.teamArrivedAt || null, teamIssue: r.teamIssue || '', teamIssueAt: r.teamIssueAt || null, sevSet: r.sevSet || null, sevBy: r.sevBy || '', intake: parseIntake(r.intake) };
  if (noPin(r) && r.glat != null) { o.lat = r.glat; o.lng = r.glng; o.pinCheck = { status: 'geocoded', label: r.glabel || '' }; }
  if (!full) { o.phone = maskPhone(o.phone); o.name = o.name ? o.name.slice(0, 1) + '***' : ''; o.notes = ''; o.intake = null; }
  return o;
}

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
const TH_BOX = [97.3, 5.6, 105.7, 20.5];
const inTH = (lat, lng) => lng >= TH_BOX[0] && lng <= TH_BOX[2] && lat >= TH_BOX[1] && lat <= TH_BOX[3];
function geoQueries(c) {
  const cut = x => String(x || '').split(/แขวง|ตำบล|เขต|อำเภอ|จังหวัด|กรุงเทพ|กทม|\d{5}/)[0].replace(/[.\/,()]+$/g, '').trim();
  let a = String(c.address || '').replace(/\(?จุดสังเกต[^)]*\)?/g, ' ').replace(/(^|[\s.])ต\.\s*/g, '$1ตำบล').replace(/(^|[\s.])อ\.\s*/g, '$1อำเภอ').replace(/(^|[\s.])จ\.\s*/g, '$1จังหวัด')
    .replace(/กทม\.?|กรุงเทพฯ/g, ' กรุงเทพมหานคร ').replace(/\s+/g, ' ').trim();
  const bkk = /กรุงเทพ/.test(a + (c.province || ''));
  let prov = bkk ? 'กรุงเทพมหานคร' : cut(String(c.province || '').replace(/^จังหวัด/, '')) || cut((a.match(/จังหวัด\s*(\S+)/) || [])[1]);
  if (!prov) { const m = a.match(/(ฉะเชิงเทรา|ปทุมธานี|นนทบุรี|สมุทรปราการ|พระนครศรีอยุธยา|อยุธยา|นครนายก|ปราจีนบุรี|อุดรธานี|นครปฐม)/); if (m) prov = m[1] === 'อยุธยา' ? 'พระนครศรีอยุธยา' : m[1]; }
  const tambon = cut((a.match(/(?:ตำบล|แขวง)\s*([ก-ฮ][^\s,]*)/) || [])[1]);
  const amphoe = cut((a.match(/(?:อำเภอ|เขต)\s*([ก-ฮ][^\s,]*)/) || [])[1]) || cut(c.district);
  const T = bkk ? 'แขวง' : 'ตำบล', A = bkk ? 'เขต' : 'อำเภอ', q = [];
  if (a) q.push([a.replace(/\b\d{5}\b/g, '').trim(), 'ที่อยู่']);
  if (tambon) { q.push([`${T}${tambon} ${amphoe ? A + amphoe : ''} ${prov}`.replace(/\s+/g, ' ').trim(), T]); q.push([`${tambon} ${prov}`.trim(), T]); }
  if (amphoe) q.push([`${A}${amphoe} ${prov}`.trim(), A]);
  const must = [tambon, amphoe].map(x => String(x || '').replace(/^เมือง/, '')).filter(x => /^[ก-๙]{2,}/.test(x));
  return { q: must.length ? q.filter((x, i, arr) => x[0] && arr.findIndex(y => y[0] === x[0]) === i) : [], prov, must };
}
async function geoLookup(q, prov, must = []) {
  const ok = label => !must.length || must.some(m => label.includes(m));
  const UA = { 'user-agent': 'HelpMe-CENTRAL/1.0 (central.helpme4u.com)', 'accept-language': 'th' };
  try {
    const r = await fetch('https://photon.komoot.io/api?limit=5&lang=default&bbox=' + TH_BOX.join(',') + '&q=' + encodeURIComponent(q), { headers: UA, cf: { cacheTtl: 86400 } });
    if (r.ok) { const j = await r.json(); const f = (j.features || []).map(x => ({ lat: x.geometry.coordinates[1], lng: x.geometry.coordinates[0], p: x.properties || {} }))
      .filter(x => inTH(x.lat, x.lng)).sort((a, b) => (prov && String(b.p.state || '').includes(prov) ? 1 : 0) - (prov && String(a.p.state || '').includes(prov) ? 1 : 0))[0];
      const lb = f ? [f.p.name, f.p.district || f.p.county, f.p.city, f.p.state].filter(Boolean).join(' · ') : '';
      if (f && (!prov || String(f.p.state || '').includes(prov) || String(f.p.name || '').includes(prov)) && ok(lb)) return { lat: f.lat, lng: f.lng, label: lb }; }
  } catch (e) {}
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=th&q=' + encodeURIComponent(q), { headers: UA, cf: { cacheTtl: 86400 } });
    if (r.ok) { const j = await r.json(); const f = (j || []).find(x => inTH(+x.lat, +x.lon) && (!prov || String(x.display_name || '').includes(prov)));
      if (f && ok(String(f.display_name || ''))) return { lat: +f.lat, lng: +f.lon, label: String(f.display_name || '').split(',').slice(0, 3).join(' · ') }; }
  } catch (e) {}
  return null;
}
const AI_GEO = false;
async function aiGeo(env, c) {
  if (!env.AI) return null;
  let j = null;
  try {
    const out = await env.AI.run(HERMES_MODELS[0], { messages: [
      { role: 'system', content: 'คุณเป็นผู้เชี่ยวชาญภูมิศาสตร์ประเทศไทย อ่านที่อยู่ภาษาไทยที่เขียนไม่ครบ/สะกดผิด แล้วตอบเป็น JSON อย่างเดียว: {"province":"ชื่อจังหวัดเต็ม","amphoe":"อำเภอหรือเขต (ไม่มีคำนำหน้า)","tambon":"ตำบลหรือแขวง (ไม่มีคำนำหน้า)","place":"ชื่อสถานที่สำคัญ/หมู่บ้าน/มัสยิด/วัด ถ้ามี","road":"ถนนหรือซอย ถ้ามี","queries":["คำค้นแผนที่ 1-3 แบบ เรียงจากละเอียดไปกว้าง"],"confidence":0-100} ถ้าไม่รู้ให้เว้นว่าง ห้ามเดามั่ว' },
      { role: 'user', content: `ที่อยู่: ${c.address}\nเขต/อำเภอที่ระบบรู้: ${c.district || '-'}\nจังหวัดที่ระบบรู้: ${c.province || '-'}` }], max_tokens: 300, temperature: 0 });
    const t = aiText(out); const m = t.match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : null;
  } catch (e) { return null; }
  if (!j || (Number(j.confidence) || 0) < 50 || !j.province) return null;
  const prov = String(j.province).replace(/^จังหวัด/, '').replace(/^กรุงเทพฯ?$|^กทม$/, 'กรุงเทพมหานคร').trim();
  if (c.province && !String(c.province).includes(prov) && !prov.includes(String(c.province))) return null;
  const am = String(j.amphoe || '').replace(/^(อำเภอ|เขต)/, '').trim(), tb = String(j.tambon || '').replace(/^(ตำบล|แขวง)/, '').trim();
  const must = [tb, am].map(x => x.replace(/^เมือง/, '')).filter(x => /^[ก-๙]{2,}/.test(x));
  const qs = [...(Array.isArray(j.queries) ? j.queries : []).map(String), [j.place, am, prov].filter(Boolean).join(' '), [j.road, am, prov].filter(Boolean).join(' '), tb && `${tb} ${am} ${prov}`, am && `${am} ${prov}`]
    .map(x => String(x || '').trim()).filter((x, i, a) => x.length > 3 && a.indexOf(x) === i).slice(0, 5);
  const sk = x => String(x || '').replace(/[ะ-ฺเ-๎\s.\-,()/]/g, '');
  const addrSk = sk(c.address), GEN = /^(คลอง|หมู่|บ้าน|ซอย|ถนน|มัสยิด|วัด|ตลาด|โรงเรียน|ชุมชน|จังหวัด|อำเภอ|ตำบล|แขวง|เขต|สถานี|ประเทศไทย|เมือง|บึง|หนอง|ทุ่ง|นา)/,
    inAddr = label => String(label).split(/[·,\s]+/).map(w => w.replace(GEN, '')).filter(w => !/\d/.test(w)).map(sk).some(t => t.length >= 4 && addrSk.includes(t));
  for (const q of qs) { const hit = await geoLookup(q, prov, must.filter(m => addrSk.includes(sk(m)))); if (hit && inAddr(hit.label)) return { ...hit, level: 'AI อ่านที่อยู่' + (j.place && q.includes(j.place) ? '' : am ? ' (อำเภอ/ตำบล)' : '') }; }
  return null;
}
async function geocodePass(env, db, n = 4) {
  const now = Date.now();
  const { results } = await db.prepare("SELECT id,address,district,province FROM cases WHERE (lat IS NULL OR lat='' OR lat=0) AND glat IS NULL AND status<>'done' AND COALESCE(dupOf,'')='' AND COALESCE(address,'')<>'' AND COALESCE(gtry,0)<? ORDER BY createdAt DESC LIMIT ?").bind(now - 6 * 3600e3, n).all();
  let found = 0;
  for (const c of results) {
    const { q, prov, must } = geoQueries(c); let hit = null;
    for (const [qq, lv] of q) { hit = await geoLookup(qq, prov, must); if (hit) { hit.level = lv; break; } }
    if (hit) { found++; await db.prepare('UPDATE cases SET glat=?,glng=?,glabel=?,gtry=?,updatedAt=? WHERE id=?').bind(hit.lat, hit.lng, `ระดับ${hit.level} · ${hit.label}`.slice(0, 160), now, now, c.id).run(); }
    else await db.prepare('UPDATE cases SET gtry=? WHERE id=?').bind(now, c.id).run();
  }
  const { results: hard } = AI_GEO ? await db.prepare("SELECT id,address,district,province FROM cases WHERE (lat IS NULL OR lat='' OR lat=0) AND glat IS NULL AND status<>'done' AND COALESCE(dupOf,'')='' AND COALESCE(address,'')<>'' AND gtry IS NOT NULL AND COALESCE(gai,0)<? ORDER BY createdAt DESC LIMIT 2").bind(now - 864e5).all() : { results: [] };
  let ai = 0;
  for (const c of hard) {
    const hit = await aiGeo(env, c);
    if (hit) { ai++; found++; await db.prepare('UPDATE cases SET glat=?,glng=?,glabel=?,gai=?,updatedAt=? WHERE id=?').bind(hit.lat, hit.lng, `ระดับ${hit.level} · ${hit.label}`.slice(0, 160), now, now, c.id).run(); }
    else await db.prepare('UPDATE cases SET gai=? WHERE id=?').bind(now, c.id).run();
  }
  if (found) await bumpRev(db);
  return { tried: results.length, found, ai, aiTried: hard.length };
}
const HERMES_MODELS = ['@cf/aisingapore/gemma-sea-lion-v4-27b-it', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'];
async function aiChat(db, b) {
  if (!ENV || !ENV.AI) return { ok: false, error: 'ai_unavailable' };
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-16).map(m => ({ role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user', content: String(m.content || '').slice(0, 16000) }));
  if (!msgs.length) return { ok: false, error: 'empty' };
  if (!WRC) await withIntel(db, msgs);
  trimMsgs(msgs);
  let err = '';
  for (const model of HERMES_MODELS) {
    try {
      const out = await ENV.AI.run(model, { messages: msgs, max_tokens: Math.min(Number(b.max_tokens) || 900, 1500), temperature: Math.min(Math.max(Number(b.temperature) || 0.3, 0), 1) });
      const content = out && (typeof out.response === 'string' ? out.response : out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content) || '';
      if (content) return { ok: true, model, content };
    } catch (e) { err = String(e && e.message || e).slice(0, 200); }
  }
  return { ok: false, error: 'ai_failed', detail: err };
}
function aiMsgs(b) {
  return (Array.isArray(b.messages) ? b.messages : []).slice(-16).map(m => ({ role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user', content: String(m.content || '').slice(0, 16000) }));
}
function trimMsgs(msgs, max = 22000) {
  let total = msgs.reduce((a, m) => a + m.content.length, 0);
  const first = msgs.findIndex(m => m.role === 'user');
  while (total > max) { const i = msgs.findIndex((m, k) => k !== first && k < msgs.length - 1 && m.role !== 'system'); if (i < 0) break; total -= msgs[i].content.length; msgs.splice(i, 1); }
  if (total > max) { const n = msgs.find(m => m._intel); if (n) { const cut = Math.max(800, n.content.length - (total - max)); total -= n.content.length - cut; n.content = n.content.slice(0, cut); } }
  msgs.forEach(m => { delete m._intel; });
}
async function aiStream(b, db) {
  if (!ENV || !ENV.AI) return null;
  const msgs = aiMsgs(b);
  if (!msgs.length) return null;
  if (db && !WRC) await withIntel(db, msgs);
  trimMsgs(msgs);
  for (const model of HERMES_MODELS) {
    try {
      const st = await ENV.AI.run(model, { messages: msgs, stream: true, max_tokens: Math.min(Number(b.max_tokens) || 700, 1500), temperature: Math.min(Math.max(Number(b.temperature) || 0.3, 0), 1) });
      return new Response(st, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', 'x-ai-model': model } });
    } catch (e) {}
  }
  return null;
}
async function intelUpsert(db, rows) {
  const now = Date.now(), st = rows.map(r => db.prepare(`INSERT INTO intel (kind,k,at,seen,title,body,level,src,province,lat,lng,val,data) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(kind,k) DO UPDATE SET seen=excluded.seen, at=excluded.at, title=excluded.title, body=excluded.body, level=excluded.level, val=excluded.val, data=excluded.data, src=excluded.src, province=excluded.province, lat=excluded.lat, lng=excluded.lng`)
    .bind(r.kind, String(r.k).slice(0, 200), r.at || now, now, clean(r.title, 300), clean(r.body, 1500), r.level || '', r.src || '', r.province || '', r.lat ?? null, r.lng ?? null, r.val ?? null, r.data ? JSON.stringify(r.data).slice(0, 2000) : null));
  for (let i = 0; i < st.length; i += 80) await db.batch(st.slice(i, i + 80));
  return rows.length;
}
async function intelTick(env, db, force) {
  const last = Number(await getMeta(db, 'intel_at')) || 0;
  if (!force && Date.now() - last < 15 * 60e3) return { skipped: true };
  await setMeta(db, 'intel_at', String(Date.now()));
  const res = {}, now = Date.now();
  try { const n = await newsData();
    res.news = await intelUpsert(db, [
      ...n.warnings.map(w => ({ kind: 'warning', k: (w.title + '|' + (w.announced || '')).slice(0, 200), at: w.announced || now, title: w.title, body: w.text, level: (!w.end || w.end > now) && (!w.start || w.start <= now) ? 'live' : '', src: 'กรมอุตุนิยมวิทยา', data: { start: w.start, end: w.end, url: w.url } })),
      ...n.quakes.map(q => ({ kind: 'quake', k: q.time + '|' + q.place, at: q.time, title: `แผ่นดินไหว ${q.mag} · ${q.place}`, val: q.mag, lat: q.lat, lng: q.lng, src: 'กรมอุตุนิยมวิทยา' })),
      ...n.news.map(x => ({ kind: 'news', k: x.link, at: x.time || now, title: x.title, src: x.source, level: (x.tags || []).join(','), data: { link: x.link } }))]); } catch (e) { res.newsErr = String(e.message || e).slice(0, 80); }
  try { const w = await waterData();
    res.water = await intelUpsert(db, [
      ...w.sensors.filter(x => x.now != null && x.now >= 5 && x.status !== 'malfunction').map(x => ({ kind: 'road_water', k: x.code || x.name, at: x.t || now, title: `${x.name}${x.road ? ' · ' + x.road : ''}`, val: x.now, province: 'กรุงเทพมหานคร', lat: x.lat, lng: x.lng, src: 'สำนักการระบายน้ำ กทม.', data: { district: x.district, max: x.max } })),
      ...w.stations.filter(x => x.situation >= 3).map(x => ({ kind: 'river', k: String(x.id), at: x.t || now, title: x.name, val: x.diff, level: String(x.situation), lat: x.lat, lng: x.lng, src: 'ThaiWater ' + (x.agency || ''), data: { level: x.level, bank: x.bank } })),
      { kind: 'water_sum', k: 'bkk', at: now, title: 'สรุปน้ำ กทม.', val: w.sensors.filter(x => x.now >= 5).length, data: { sensors: w.sensors.length, wet: w.sensors.filter(x => x.now >= 5).length, deep: w.sensors.filter(x => x.now >= 20).length, stationsHigh: w.stations.filter(x => x.situation >= 4).length } }]); } catch (e) { res.waterErr = String(e.message || e).slice(0, 80); }
  try { const dm = await damData(), lv = p => p >= 100 ? 'over' : p >= 80 ? 'high' : '';
    res.dam = await intelUpsert(db, [...dm.large, ...dm.medium.filter(x => x.pct >= 100)].map(x => ({ kind: 'dam', k: x.size + ':' + x.id, at: x.t, title: (x.size === 'large' ? 'เขื่อน' : '') + x.name, val: x.pct, level: lv(x.pct || 0) + (x.size === 'large' ? ',large' : ''), lat: x.lat, lng: x.lng, src: 'ThaiWater/' + (x.agency || 'ชป.'), data: { inflow: x.inflow, released: x.released, spilled: x.spilled, storage: x.storage, date: x.date } }))); } catch (e) { res.damErr = String(e.message || e).slice(0, 80); }
  const satLast = Number(await getMeta(db, 'intel_sat_at')) || 0;
  if (env.GISTDA_KEY && (force || Date.now() - satLast >= 30 * 60e3)) try {
    await setMeta(db, 'intel_sat_at', String(Date.now()));
    const { results: cs } = await db.prepare("SELECT id,province,district,COALESCE(lat,glat) lat,COALESCE(lng,glng) lng FROM cases WHERE status<>'done' AND COALESCE(hmStatus,'')<>'skip' AND COALESCE(dupOf,'')='' AND COALESCE(lat,glat) IS NOT NULL").all();
    const S = 0.04, gc = new Map(); cs.forEach(c => { if (!c.lat || !c.lng) return; const k = Math.floor(c.lng / S) + ',' + Math.floor(c.lat / S); if (!gc.has(k)) gc.set(k, []); gc.get(k).push(c); });
    const allCells = [...gc].sort((x, y) => x[0] < y[0] ? -1 : 1), off = (Number(await getMeta(db, 'intel_sat_off')) || 0) % Math.max(1, allCells.length);
    const rows = [], cells = [...allCells.slice(off), ...allCells.slice(0, off)].slice(0, 20);
    await setMeta(db, 'intel_sat_off', String(allCells.length > 20 ? off + 20 : 0));
    for (let i = 0; i < cells.length; i += 8) await Promise.all(cells.slice(i, i + 8).map(async ([k, list]) => { const [cx, cy] = k.split(',').map(Number);
      try { const feats = await gistdaCell(env, cx, cy);
        list.forEach(c => { let inside = false, best = Infinity, date = ''; for (const f of feats) { if (f.d > date) date = f.d; if (!inside && inGeom(c.lat, c.lng, f.g)) inside = true; const d = inside ? 0 : geomDist(c.lat, c.lng, f.g); if (d < best) best = d; }
          rows.push({ kind: 'sat_case', k: c.id, at: now, title: inside ? 'อยู่ในพื้นที่น้ำท่วม' : isFinite(best) ? `น้ำท่วมห่าง ${Math.round(best)} ม.` : 'ไม่พบน้ำท่วมใน 4 กม.', val: inside ? 0 : isFinite(best) ? Math.round(best) : null, level: inside ? 'inside' : best <= 1000 ? 'near' : 'none', province: c.province || '', lat: c.lat, lng: c.lng, src: 'GISTDA', data: { date, district: c.district || '' } }); }); } catch (e) {} }));
    res.sat = await intelUpsert(db, rows);
  } catch (e) { res.satErr = String(e.message || e).slice(0, 80); }
  await db.prepare('DELETE FROM intel WHERE seen<?').bind(now - 14 * 864e5).run();
  return res;
}
async function intelBrief(db) {
  return cached('intel-brief-v2', 120, async () => {
    const now = Date.now(), q = (sql, ...v) => db.prepare(sql).bind(...v).all().then(r => r.results);
    const [warn, quake, news, road, river, wsum, sat, bc, hz, at, dams] = await Promise.all([
      q("SELECT title,body,data FROM intel WHERE kind='warning' AND level='live' AND seen>? ORDER BY at DESC LIMIT 3", now - 2 * 3600e3),
      q("SELECT title,at FROM intel WHERE kind='quake' AND at>? ORDER BY val DESC LIMIT 3", now - 2 * 864e5),
      q("SELECT title,src,at FROM intel WHERE kind='news' AND at>? ORDER BY at DESC LIMIT 10", now - 2 * 864e5),
      q("SELECT title,val,data FROM intel WHERE kind='road_water' AND seen>? ORDER BY val DESC LIMIT 6", now - 2 * 3600e3),
      q("SELECT title,level,val FROM intel WHERE kind='river' AND seen>? ORDER BY CAST(level AS INTEGER) DESC LIMIT 6", now - 6 * 3600e3),
      q("SELECT data,at FROM intel WHERE kind='water_sum' AND k='bkk'"),
      q("SELECT k,title,level,province,data FROM intel WHERE kind='sat_case' AND seen>? AND level IN ('inside','near')", now - 3 * 3600e3),
      q('SELECT level,title,scope,provinces,districts FROM broadcasts WHERE cancelledAt IS NULL AND expiresAt>? ORDER BY createdAt DESC LIMIT 5', now).catch(() => []),
      q('SELECT type,note,level FROM hazard_reports WHERE closedAt IS NULL AND expiresAt>? ORDER BY createdAt DESC LIMIT 5', now).catch(() => []),
      getMeta(db, 'intel_at'),
      q("SELECT title,val,level,data FROM intel WHERE kind='dam' AND seen>? AND (level LIKE 'over%' OR level LIKE 'high%') ORDER BY val DESC LIMIT 400", now - 3 * 3600e3)]);
    const t = x => new Date(x).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const L = [];
    if (warn.length) L.push('ประกาศเตือนภัยกรมอุตุฯ ที่มีผลตอนนี้: ' + warn.map(w => w.title).join(' | '));
    if (bc.length) L.push('ประกาศของศูนย์ที่ยังมีผล: ' + bc.map(b => `[${b.level}] ${b.title} (${b.scope === 'all' ? 'ทุกพื้นที่' : b.provinces || b.districts || 'รัศมี'})`).join(' | '));
    if (wsum[0]) { const d = JSON.parse(wsum[0].data || '{}'); L.push(`น้ำบนถนน กทม. (เซ็นเซอร์ ${d.sensors || 0} จุด): มีน้ำ ${d.wet || 0} จุด · ลึก ≥20 ซม. ${d.deep || 0} จุด · สถานีน้ำ กทม. วิกฤต ${d.stationsHigh || 0} สถานี`); }
    if (road.length) L.push('ถนนน้ำลึกสุด: ' + road.map(r => `${r.title} ${r.val} ซม.`).join(', '));
    if (river.length) L.push('ระดับน้ำคลอง/แม่น้ำสูง (ThaiWater ระดับ 3–5): ' + river.map(r => `${r.title} (ระดับ ${r.level})`).join(', '));
    if (dams.length) { const big = dams.filter(d => /large/.test(d.level)), med = dams.filter(d => !/large/.test(d.level)), f = d => { const x = JSON.parse(d.data || '{}'); return `${d.title} ${Math.round(d.val)}%${x.inflow != null ? ` (ไหลเข้า ${x.inflow} · ระบาย ${x.released ?? '-'} ล้าน ลบ.ม./วัน)` : ''}`; };
      if (big.length) L.push('เขื่อนใหญ่น้ำมาก (≥80% ความจุ · ThaiWater/กรมชลประทาน): ' + big.map(f).join(', '));
      if (med.length) L.push(`อ่างเก็บน้ำขนาดกลางเกิน 100% (${med.length} แห่ง): ` + med.slice(0, 10).map(d => `${d.title} ${Math.round(d.val)}%`).join(', ')); }
    if (sat.length) { const ins = sat.filter(s => s.level === 'inside'), byP = {}; sat.forEach(s => { const p = s.province || 'ไม่ทราบจังหวัด'; byP[p] = (byP[p] || 0) + 1; });
      L.push(`ดาวเทียม GISTDA (น้ำท่วม 7 วัน): เคสที่ยังไม่เสร็จอยู่ในพื้นที่น้ำท่วม ${ins.length} เคส · ห่างน้ำท่วม ≤1 กม. ${sat.length - ins.length} เคส · รายจังหวัด ${Object.entries(byP).map(([p, n]) => p + ' ' + n).join(', ')}` + (ins.length ? ' · เคสในน้ำท่วม: ' + ins.slice(0, 12).map(s => '#' + s.k).join(' ') : '')); }
    const HZT = { sinkhole: 'หลุมยุบ/ถนนทรุด', landslide: 'ดินโคลนถล่ม', flashflood: 'น้ำป่าไหลหลาก', current: 'น้ำไหลแรง', electric: 'ไฟฟ้ารั่ว', fire: 'ไฟไหม้', other: 'ภัยอื่น ๆ' };
    if (hz.length) L.push('รายงานภัยจากศูนย์: ' + hz.map(h => `${HZT[h.type] || h.type}${h.note ? ' ' + h.note : ''}`).join(' | '));
    if (quake.length) L.push('แผ่นดินไหวใกล้ไทย 2 วัน: ' + quake.map(x => x.title).join(' | '));
    if (news.length) L.push('ข่าวภัยพิบัติล่าสุด: ' + news.map(n => `${n.title} (${n.src} ${t(n.at)})`).join(' | '));
    return { at: Number(at) || 0, text: L.length ? `ข้อมูลสถานการณ์จากฐานข้อมูล Helpme+ (รวบรวมล่าสุด ${at ? t(Number(at)) : '-'}):\n- ` + L.join('\n- ') : '' };
  });
}
async function withIntel(db, msgs) {
  try { const b = await intelBrief(db); if (!b.text) return;
    const note = { _intel: true, role: 'system', content: b.text.slice(0, 4000) + '\nใช้ข้อมูลนี้ประกอบการวิเคราะห์ (อ้างแหล่งที่มาเมื่อใช้ เช่น GISTDA, ThaiWater, กรมอุตุฯ) · ถ้าข้อมูลขัดกับรายงานผู้แจ้ง ให้บอกและแนะนำให้โทรยืนยัน' };
    const i = msgs.findIndex(m => m.role !== 'system'); msgs.splice(i < 0 ? msgs.length : i, 0, note);
  } catch (e) {}
}
const DC_DEF = { url: '', newCrit: true, sos: true, critWait: true, summaryH: 3, lastSum: 0, since: 0 };
const DC_RE = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
async function dcCfg(db) { try { return { ...DC_DEF, ...JSON.parse(await getMeta(db, 'dc_cfg') || '{}') }; } catch (e) { return { ...DC_DEF }; } }
const dcPublic = c => ({ ok: true, connected: !!c.url, hook: c.url ? '…' + c.url.slice(-6) : '', newCrit: c.newCrit, sos: c.sos, critWait: c.critWait, summaryH: c.summaryH, lastSum: c.lastSum || null });
async function dcPost(url, body) {
  const r = await fetch(url + '?wait=true', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'AI HELP', allowed_mentions: { parse: [] }, ...body }) });
  return r.ok;
}
const dcLink = c => 'https://central.helpme4u.com/central.html#' + encodeURIComponent(c.src === 'helpme' ? 'hm-' + c.id : c.id);
const dcAgo = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 60 ? m + ' นาที' : m < 1440 ? Math.floor(m / 60) + ' ชม.' : Math.floor(m / 1440) + ' วัน'; };
const dcCase = c => `**${(String(c.needs || '').split(/\s*,\s*/).filter(Boolean).join(', ') || 'ขอความช่วยเหลือ').slice(0, 80)}** · ${c.people || 1} คน · ${[c.district, c.province].filter(Boolean).join(' ') || 'ไม่ระบุพื้นที่'} · แจ้ง ${dcAgo(c.createdAt)}ก่อน\n[เปิดเคส #${c.id}](${dcLink(c)})`;
async function dcSummary(env, db) {
  const { results } = await db.prepare("SELECT id,createdAt,status,urgency,needs,people,district,province,volunteer,src,doneAt,updatedAt FROM cases WHERE COALESCE(dupOf,'')=''").all();
  const now = Date.now(), open = results.filter(c => c.status !== 'done'), wait = open.filter(c => c.status !== 'going');
  const crit = wait.filter(c => Number(c.urgency) >= 3), done24 = results.filter(c => c.status === 'done' && (c.doneAt || c.updatedAt) > now - 864e5).length;
  const { results: teams } = await db.prepare('SELECT name,status FROM roster WHERE active=1').all();
  const byArea = {}; wait.forEach(c => { const k = c.district || c.province || 'ไม่ระบุ'; byArea[k] = (byArea[k] || 0) + 1; });
  const areas = Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} ${n}`).join(' · ');
  const facts = `รอช่วย ${wait.length} เคส (ด่วนมาก ${crit.length}) · กำลังไป ${open.length - wait.length} · ช่วยแล้ว 24 ชม. ${done24} · รอเกิน 24 ชม. ${wait.filter(c => now - c.createdAt > 864e5).length} · ทีม ${teams.length} (พร้อม ${teams.filter(t => t.status === 'ready').length}) · พื้นที่รอมากสุด: ${areas || '-'}`;
  let text = '';
  try {
    const top = wait.sort((a, b) => (Number(b.urgency) || 1) - (Number(a.urgency) || 1) || a.createdAt - b.createdAt).slice(0, 12).map(c => `#${c.id} ระดับ${c.urgency || 1} ${String(c.needs || '').slice(0, 40)} ${c.people || 1}คน ${c.district || ''} รอ${dcAgo(c.createdAt)}`).join('\n');
    const out = await env.AI.run(HERMES_MODELS[0], { messages: [{ role: 'system', content: 'คุณคือ AI HELP ผู้ช่วยศูนย์สั่งการภัยพิบัติ เขียนสรุปสถานการณ์สำหรับทีมงานใน Discord ภาษาไทย 3-5 ข้อสั้น ๆ บอกจุดน่าห่วงและสิ่งที่ควรทำต่อ ห้ามใส่ชื่อหรือเบอร์โทร' }, { role: 'user', content: facts + '\nเคสรอที่สำคัญ:\n' + top }], max_tokens: 400, temperature: 0.3 });
    text = aiText(out).trim();
  } catch (e) {}
  return { facts, text };
}
async function discordTick(env, db, force) {
  const c = await dcCfg(db); if (!c.url) return { ok: false, error: 'not_connected' };
  const now = Date.now(); let sent = []; try { sent = JSON.parse(await getMeta(db, 'dc_sent') || '[]'); } catch (e) {}
  const S = new Set(sent), embeds = [], mark = k => { S.add(k); sent.push(k); };
  const { results } = await db.prepare("SELECT id,createdAt,status,urgency,needs,people,district,province,volunteer,src FROM cases WHERE status<>'done' AND COALESCE(dupOf,'')='' AND createdAt>?").bind(now - 3 * 864e5).all();
  if (c.newCrit) for (const x of results) if (Number(x.urgency) >= 3 && x.createdAt > (c.since || now) && !S.has('n' + x.id)) { mark('n' + x.id); embeds.push({ color: 0xE5383B, title: '🚨 เคสด่วนมากใหม่', description: dcCase(x) }); }
  if (c.critWait) for (const x of results) if (Number(x.urgency) >= 3 && x.status !== 'going' && !String(x.volunteer || '').trim() && now - x.createdAt > 30 * 60e3 && x.createdAt + 30 * 60e3 > (c.since || now) && !S.has('w' + x.id)) { mark('w' + x.id); embeds.push({ color: 0xF57C00, title: '⏰ เคสด่วนมากรอเกิน 30 นาที ยังไม่มีทีม', description: dcCase(x) }); }
  if (c.sos) { const { sos } = await alertsList(db); for (const t of sos) { const k = 's' + t.id + ':' + t.sosAt; if (S.has(k) || t.sosAt < (c.since || now) - 60e3) continue; mark(k);
    embeds.push({ color: 0xC62828, title: '🆘 SOS จากทีม ' + t.name, description: `กด SOS เมื่อ ${dcAgo(t.sosAt)}ก่อน${t.lat != null ? ` · [ตำแหน่งทีม](https://maps.google.com/?q=${(+t.lat).toFixed(5)},${(+t.lng).toFixed(5)})` : ''}\n[เปิด CENTRAL](https://central.helpme4u.com/central/warroom/)` }); } }
  let posted = 0;
  for (let i = 0; i < embeds.length && i < 30; i += 10) { if (await dcPost(c.url, { embeds: embeds.slice(i, i + 10) })) posted++; }
  if (embeds.length && posted) await setMeta(db, 'dc_sent', JSON.stringify(sent.slice(-800)));
  if (force === 'summary' || (c.summaryH > 0 && now - (c.lastSum || 0) >= c.summaryH * 3600e3 && c.lastSum)) {
    const s = await dcSummary(env, db);
    await dcPost(c.url, { embeds: [{ color: 0x2D45C8, title: '📊 สรุปสถานการณ์ · ' + new Date(now).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), description: (s.text ? s.text + '\n\n' : '') + '`' + s.facts + '`\n[เปิดแดชบอร์ด](https://central.helpme4u.com/central/dashboard/)' }] });
    c.lastSum = now; await setMeta(db, 'dc_cfg', JSON.stringify(c)); posted++;
  } else if (!c.lastSum) { c.lastSum = now; await setMeta(db, 'dc_cfg', JSON.stringify(c)); }
  return { ok: true, alerts: embeds.length, posted };
}
async function discordSave(db, b) {
  if (WRC) return { ok: false, error: 'central_only' };
  const c = await dcCfg(db), d = b.discord || {};
  if (d.url !== undefined) { const u = String(d.url || '').trim(); if (u && !DC_RE.test(u)) return { ok: false, error: 'bad_webhook' }; if (u && u !== c.url) c.since = Date.now(); c.url = u; }
  for (const k of ['newCrit', 'sos', 'critWait']) if (d[k] !== undefined) c[k] = !!d[k];
  if (d.summaryH !== undefined) c.summaryH = [0, 1, 2, 3, 6, 12, 24].includes(Number(d.summaryH)) ? Number(d.summaryH) : 3;
  await setMeta(db, 'dc_cfg', JSON.stringify(c));
  return dcPublic(c);
}
async function discordTest(db, b) {
  if (WRC) return { ok: false, error: 'central_only' };
  const c = await dcCfg(db); if (!c.url) return { ok: false, error: 'not_connected' };
  if (b.kind === 'summary') { await discordTick(ENV, db, 'summary'); return { ok: true }; }
  const ok = await dcPost(c.url, { embeds: [{ color: 0x2E9E57, title: '✅ AI HELP เชื่อมต่อกับห้องนี้แล้ว', description: 'จะแจ้งเตือน: ' + [c.newCrit && 'เคสด่วนมากใหม่', c.sos && 'SOS จากทีม', c.critWait && 'เคสด่วนมากรอเกิน 30 นาที', c.summaryH && `สรุปทุก ${c.summaryH} ชม.`].filter(Boolean).join(' · ') }] });
  return ok ? { ok: true } : { ok: false, error: 'discord_rejected' };
}
async function saveFeedback(db, b) {
  const text = clean(b.text, 1000);
  if (!text) return { ok: false, error: 'empty' };
  await db.prepare('INSERT INTO feedback (at,page,by_,room,text,done) VALUES (?,?,?,?,?,0)')
    .bind(Date.now(), clean(b.page, 200), clean(b.by, 60), WRC ? WRC.id : '', text).run();
  return { ok: true };
}
async function doneFeedback(db, b) {
  if (WRC) return { ok: false, error: 'central_only' };
  await db.prepare('UPDATE feedback SET done=? WHERE n=?').bind(b.done === false ? 0 : 1, Number(b.n) || 0).run();
  return { ok: true };
}
async function updateCase(db, b) {
  if (!STATUSES.includes(b.status)) return { ok: false, error: 'bad_status' };
  const r = await db.prepare('SELECT * FROM cases WHERE id=?').bind(String(b.id)).first();
  if (!r) return { ok: false, error: 'not_found' };
  if (b.expectStatus && r.status !== b.expectStatus) return { ok: false, error: 'status_changed', status: r.status };
  const meta = !!(b.bagsOnly || b.metaOnly);
  const sets = [], vals = [];
  let bags = null;
  if (b.bags !== undefined && b.bags !== null) { bags = b.bags === '' ? null : clampInt(b.bags, 0, 9999, 0); sets.push('bags=?'); vals.push(bags); }
  if (b.cctv !== undefined && ['flood', 'clear', ''].includes(String(b.cctv))) {
    const t = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    sets.push('cctv=?'); vals.push(b.cctv ? b.cctv + '|' + t : '');
  }
  if (b.dupOf !== undefined) { sets.push('dupOf=?'); vals.push(clean(b.dupOf, 40)); }
  if (b.sevSet !== undefined) { const v = b.sevSet === '' || b.sevSet === null ? null : clampInt(b.sevSet, 1, 3, null); sets.push('sevSet=?', 'sevBy=?'); vals.push(v, v ? clean(b.by, 60) : null); }
  if (b.people !== undefined && b.people !== '') { sets.push('people=?'); vals.push(clampInt(b.people, 1, 9999, 1)); }
  if (b.households !== undefined) { sets.push('households=?'); vals.push(b.households === '' ? null : clampInt(b.households, 1, 9999, 1)); }
  if (b.intake !== undefined && b.intake !== null) { const o = cleanIntake(b.intake); o.by = clean(b.by, 60); o.at = Date.now(); sets.push('intake=?'); vals.push(JSON.stringify(o)); }
  if (b.hqNote !== undefined && b.hqNote !== null) { sets.push('hqNote=?'); vals.push(clean(b.hqNote, 500)); }
  if (!meta) {
    sets.push('status=?', 'updatedAt=?', 'localAt=?'); vals.push(b.status, Date.now(), Date.now());
    if (b.status === 'going' && r.status !== 'going' && !r.pickedAt) { sets.push('pickedAt=?'); vals.push(Date.now()); }
    if (b.status === 'done' && r.status !== 'done') { sets.push('doneAt=?'); vals.push(Date.now()); if (!r.pickedAt) { sets.push('pickedAt=?'); vals.push(Date.now()); } }
    const vol = clean(b.volunteer, MAX.volunteer), prevVol = String(r.volunteer || '').replace(/^'/, '').trim();
    const reset = b.status === 'open' || (b.status === 'going' && vol && vol !== prevVol);
    if (reset || b.status === 'done') sets.push('teamIssue=NULL', 'teamIssueAt=NULL');
    if (b.status === 'going' && b.helped === true) { sets.push('teamDoneAt=?'); vals.push(r.teamDoneAt && !reset ? r.teamDoneAt : Date.now()); if (reset) sets.push("teamNote=''"); }
    else if (reset) sets.push('teamDoneAt=NULL', "teamNote=''");
    if (reset) sets.push('teamArrivedAt=NULL');
    else if (b.status === 'going' && b.helped === false) sets.push('teamDoneAt=NULL');
    if (b.status === 'open') sets.push("volunteer=''");
    else if (b.volunteer) { sets.push('volunteer=?'); vals.push(clean(b.volunteer, MAX.volunteer)); }
  }
  if (sets.length) await db.prepare(`UPDATE cases SET ${sets.join(',')} WHERE id=?`).bind(...vals, r.id).run();
  if (!meta && b.status === 'going') { const nv = clean(b.volunteer, MAX.volunteer).replace(/^'/, ''), pv = String(r.volunteer || '').replace(/^'/, '').trim();
    if (nv && (nv !== pv || r.status !== 'going')) { const needs = String(r.needs || '').split(/\s*,\s*/).filter(Boolean).join(', ') || 'ขอความช่วยเหลือ';
      try { await chatSend(db, { team: nv, from: 'hq', name: clean(b.by, 60), text: `ศูนย์มอบเคส #${r.id} · ${needs} · ${r.people || 1} คน${r.district ? ' · ' + r.district : ''}`, kind: 'case', caseId: r.id }); } catch (e) {} } }
  await bumpRev(db);
  return { ok: true, bags, bagsSupported: true };
}
async function liveStream(db, p) {
  const sc = WRC ? await wrScope(db) : null, enc = new TextEncoder(), { readable, writable } = new TransformStream(), w = writable.getWriter();
  let last = Number(p.since) || 0;
  (async () => {
    await w.write(enc.encode('retry: 800\n\n'));
    let rv = '', cr = '';
    for (let i = 0; i < 30; i++) {
      if (i % 2 === 0) { const { results: mm } = await db.prepare("SELECT k,v FROM meta WHERE k IN ('rev','chat_rev')").all(); const m = Object.fromEntries(mm.map(x => [x.k, x.v]));
        if (i === 0 || (m.rev || '') !== rv || (m.chat_rev || '') !== cr) { rv = m.rev || ''; cr = m.chat_rev || ''; await w.write(enc.encode('event: rev\ndata: ' + JSON.stringify({ rev: rv, chat: cr }) + '\n\n')); } }
      const { results } = await db.prepare('SELECT team,lat,lng,accuracy,caseId,updatedAt,battery,speed,heading,alt,charging,sig,net,carrier,temp,hum,devAt FROM teams_live WHERE updatedAt>?').bind(last || Date.now() - TEAM_FRESH_MS).all();
      const rows = sc ? results.filter(r => sc.teams.has(r.team)) : results;
      if (results.length) last = Math.max(last, ...results.map(r => Number(r.updatedAt) || 0));
      if (rows.length) await w.write(enc.encode('data: ' + JSON.stringify(rows.map(t => ({ ...t, caseId: t.caseId || '' }))) + '\n\n'));
      else if (i % 10 === 9) await w.write(enc.encode(': hb\n\n'));
      await new Promise(r => setTimeout(r, 1000));
    }
    await w.close();
  })().catch(() => { try { w.abort(); } catch (e) {} });
  return new Response(readable, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
}
function teamStream(db, team) {
  const enc = new TextEncoder(), { readable, writable } = new TransformStream(), w = writable.getWriter();
  (async () => {
    await w.write(enc.encode('retry: 1500\n\n'));
    let rv = null, cr = null;
    for (let i = 0; i < 25; i++) {
      const { results } = await db.prepare('SELECT k,v FROM meta WHERE k IN (?,?)').bind('rev', 'chat_rev:' + team).all();
      const m = Object.fromEntries(results.map(x => [x.k, x.v])), r = m.rev || '', c = m['chat_rev:' + team] || '';
      if (rv !== null && c !== cr) await w.write(enc.encode('event: chat\ndata: ' + c + '\n\n'));
      if (rv !== null && r !== rv) await w.write(enc.encode('event: rev\ndata: ' + r + '\n\n'));
      if (rv === null || (i % 10 === 9)) await w.write(enc.encode(': hb\n\n'));
      rv = r; cr = c; await new Promise(z => setTimeout(z, 1500));
    }
    await w.close();
  })().catch(() => { try { w.abort(); } catch (e) {} });
  return new Response(readable, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' } });
}
async function casePhotos(db, id) { const { results } = await db.prepare('SELECT n,team,kind,at,lat,lng,size FROM case_photo WHERE caseId=? ORDER BY n').bind(clean(id, 40)).all(); return { ok: true, photos: results }; }
async function casePhotoImg(db, n, team) {
  const r = await db.prepare('SELECT img,caseId FROM case_photo WHERE n=?').bind(Number(n) || 0).first(); if (!r) return new Response('not found', { status: 404 });
  if (team) { const c = await db.prepare('SELECT volunteer FROM cases WHERE id=?').bind(r.caseId).first(); if (!c || String(c.volunteer || '').replace(/^'/, '').trim() !== team) return new Response('forbidden', { status: 403 }); }
  return new Response(new Uint8Array(r.img), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=604800' } });
}
function cleanPts(a, max) { return (Array.isArray(a) ? a : []).slice(0, max).map(p => Array.isArray(p) ? [num(p[0], -90, 90), num(p[1], -180, 180)] : [num(p && p.lat, -90, 90), num(p && p.lng, -180, 180)]).filter(p => p[0] != null && p[1] != null).map(p => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]); }
async function routeSet(db, b) {
  const team = clean(b.team, MAX.volunteer), caseId = clean(b.caseId, 40);
  if (!team || !caseId) return { ok: false, error: 'missing' };
  if (WRC) { const sc = await wrScope(db); if (!sc.teams.has(team)) return { ok: false, error: 'not_in_room' }; }
  const coords = cleanPts(b.coords, 1500); if (coords.length < 2) return { ok: false, error: 'no_route' };
  const d = { caseId, coords, via: cleanPts(b.via, 20), avoid: cleanPts(b.avoid, 60), km: Math.round((Number(b.km) || 0) * 10) / 10, min: Math.round(Number(b.min) || 0), hits: clampInt(b.hits, 0, 999, 0), note: clean(b.note, 300), engine: clean(b.engine, 20) };
  const by = clean(b.by, 60), now = Date.now();
  await db.prepare('INSERT INTO team_route (team,caseId,data,at,by_) VALUES (?,?,?,?,?) ON CONFLICT(team) DO UPDATE SET caseId=excluded.caseId,data=excluded.data,at=excluded.at,by_=excluded.by_').bind(team, caseId, JSON.stringify(d), now, by).run();
  await chatSend(db, { team, from: 'hq', name: by, caseId, text: `🧭 ศูนย์ส่งเส้นทางแนะนำไปเคส #${caseId} · ${d.km} กม. · ~${d.min} นาที${d.hits ? '' : ' · เลี่ยงจุดน้ำท่วมแล้ว'}${d.note ? '\n' + d.note : ''}` });
  await bumpRev(db); return { ok: true, at: now };
}
async function routeClear(db, b) { const team = clean(b.team, MAX.volunteer); if (WRC) { const sc = await wrScope(db); if (!sc.teams.has(team)) return { ok: false, error: 'not_in_room' }; } await db.prepare('DELETE FROM team_route WHERE team=?').bind(team).run(); await bumpRev(db); return { ok: true }; }
async function routeList(db) {
  const { results } = await db.prepare('SELECT team,caseId,data,at,by_ FROM team_route WHERE at>?').bind(Date.now() - 24 * 3600e3).all();
  let rows = results; if (WRC) { const sc = await wrScope(db); rows = rows.filter(r => sc.teams.has(r.team)); }
  return { ok: true, routes: rows.map(r => { let d = {}; try { d = JSON.parse(r.data); } catch (e) {} return { team: r.team, caseId: r.caseId, at: r.at, by: r.by_, ...d }; }) };
}
async function pttAuth(env, db, p, vol) {
  const rooms = (await db.prepare('SELECT id,name FROM warrooms WHERE active=1 ORDER BY name').all()).results;
  const roomName = id => (rooms.find(r => r.id === id) || {}).name || id, wrl = id => { const n = roomName(id); return /^war\s*room/i.test(n) ? n : 'War Room ' + n; };
  if (WRC) { const sc = await wrScope(db); return { ok: true, kind: 'hq', name: wrl(WRC.id), chans: [{ id: 'wr:' + WRC.id, label: wrl(WRC.id) }, ...[...sc.teams].map(t => ({ id: 'tm:' + t, label: 'ส่วนตัว · ' + t }))] }; }
  if (vol && !p.tk && !p.team) { const teams = (await db.prepare('SELECT name FROM roster WHERE active=1 ORDER BY name').all()).results;
    return { ok: true, kind: 'hq', name: 'ศูนย์', chans: [{ id: 'all', label: 'ช่องรวม' }, ...rooms.map(r => ({ id: 'wr:' + r.id, label: wrl(r.id) })), ...teams.map(t => ({ id: 'tm:' + t.name, label: 'ส่วนตัว · ' + t.name }))] }; }
  const t = await teamFrom(env, db, p); if (!t) return { ok: false, error: 'bad_link' };
  const ch = [{ id: 'all', label: 'ช่องรวม' }]; if (t.row && t.row.warroom) ch.push({ id: 'wr:' + t.row.warroom, label: wrl(t.row.warroom) });
  ch.push({ id: 'tm:' + t.name, label: 'ส่วนตัวกับศูนย์' });
  return { ok: true, kind: 'team', name: t.name, chans: ch };
}
const PTT_MAX = 700e3;
function b64bytes(s) { const bin = atob(String(s || '').replace(/^data:[^,]*,/, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
async function pttSend(db, who, b) {
  let a; try { a = b64bytes(b.audio); } catch (e) { return { ok: false, error: 'bad_audio' }; }
  if (a.length < 400 || a.length > PTT_MAX * 2 || String.fromCharCode(a[0], a[1], a[2], a[3]) !== 'RIFF') return { ok: false, error: 'bad_audio' };
  const ch = clean(b.ch, 80) || 'all'; if (who.chans && !who.chans.includes(ch)) return { ok: false, error: 'bad_channel' };
  const now = Date.now(), r = await db.prepare('INSERT INTO ptt (ch,sender,kind,name,dur,at,audio,talk) VALUES (?,?,?,?,?,?,?,?)')
    .bind(ch, clean(who.sender, 80), who.kind, clean(b.name || who.name || '', 60), Math.min(60, Math.max(0, Number(b.dur) || 0)), now, a, clean(b.talk, 20)).run();
  const n = r.meta && r.meta.last_row_id; await pttToChat(db, who, ch, n, Number(b.dur) || 0).catch(() => {});
  return { ok: true, n, at: now };
}
async function pttToChat(db, who, ch, n, dur) {
  if (!n) return;
  const chName = ch === 'all' ? 'ช่องรวม' : ch.startsWith('wr:') ? 'War Room' : 'ส่วนตัว', text = `🎙️ วอ · ${chName} · ${Math.max(1, Math.round(dur))} วิ`, link = '/api?action=ptt_audio&n=' + n;
  let teams = [];
  if (who.kind === 'team') teams = [who.sender];
  else if (ch.startsWith('tm:')) teams = [ch.slice(3)];
  else if (ch === 'all') teams = (await db.prepare('SELECT name FROM roster WHERE active=1').all()).results.map(r => r.name);
  else if (ch.startsWith('wr:')) teams = (await db.prepare('SELECT name FROM roster WHERE active=1 AND warroom=?').bind(ch.slice(3)).all()).results.map(r => r.name);
  for (const team of teams.slice(0, 200)) await chatSend(db, { team, from: who.kind === 'team' ? 'team' : 'hq', name: who.kind === 'team' ? who.name : who.name || who.sender, text, kind: 'voice', link });
}
async function pttList(db, p, chans) {
  const since = Number(p.since) || 0;
  const { results } = await db.prepare('SELECT n,ch,sender,kind,name,dur,at,talk FROM ptt WHERE n>? AND at>? ORDER BY n DESC LIMIT 80').bind(since, Date.now() - 6 * 3600e3).all();
  return { ok: true, items: results.filter(r => chans.includes(r.ch || 'all')).slice(0, 40).reverse(), now: Date.now() };
}
async function pttAudio(db, p) {
  const r = await db.prepare('SELECT audio FROM ptt WHERE n=?').bind(Number(p.n) || 0).first();
  if (!r || !r.audio) return new Response('not found', { status: 404 });
  return new Response(new Uint8Array(r.audio), { headers: { 'content-type': 'audio/wav', 'cache-control': 'private, max-age=86400' } });
}
async function readTeams(db) {
  const { results } = await db.prepare('SELECT * FROM teams_live WHERE updatedAt>?').bind(Date.now() - TEAM_FRESH_MS).all();
  return results.map(t => ({ team: t.team, lat: t.lat, lng: t.lng, accuracy: t.accuracy, caseId: t.caseId || '', updatedAt: t.updatedAt,
    battery: t.battery == null ? null : t.battery, speed: t.speed == null ? null : t.speed, heading: t.heading == null ? null : t.heading,
    alt: t.alt ?? null, charging: t.charging ?? null, sig: t.sig ?? null, net: t.net || null, carrier: t.carrier || null, temp: t.temp ?? null, hum: t.hum ?? null, devAt: t.devAt || null }));
}
async function smsIn(db, request, url) {
  const q = Object.fromEntries(url.searchParams); let b = {};
  if (request.method === 'POST') { const txt = await request.text(); try { b = JSON.parse(txt || '{}'); } catch (e) { for (const [k, v] of new URLSearchParams(txt)) b[k] = v; } }
  const secret = await getMeta(db, 'sms_secret'), key = String(q.k || b.k || b.key || '');
  if (!secret || !ctEq(key, secret)) return json({ ok: false, error: 'bad_key' }, 403);
  const text = String(b.text || b.message || b.msg || b.body || b.content || b.sms || q.text || q.message || '');
  const now = Date.now(); let n = 0;
  for (const m of text.matchAll(/#HM:([a-z0-9]{10,40}):(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)(?::(\d{9,10}))?(:SOS)?/gi)) {
    const row = await db.prepare('SELECT id,name FROM roster WHERE token=? AND active=1').bind(m[1].toLowerCase()).first();
    const lat = num(m[2], -90, 90), lng = num(m[3], -180, 180);
    if (!row || lat == null || lng == null) continue;
    const t0 = Number(m[4]) * 1000, t = t0 && t0 > now - 3 * 864e5 && t0 <= now + 60e3 ? t0 : now;
    await db.batch([
      db.prepare('INSERT INTO teams_live (team,lat,lng,accuracy,caseId,updatedAt) VALUES (?,?,?,?,?,?) ON CONFLICT(team) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,updatedAt=excluded.updatedAt WHERE excluded.updatedAt>=teams_live.updatedAt').bind(row.name, lat, lng, null, '', t),
      db.prepare('INSERT INTO team_track (team,lat,lng,accuracy,battery,speed,at) VALUES (?,?,?,?,?,?,?)').bind(row.name, lat, lng, null, null, null, t),
    ]);
    const sos = !!m[5] || /\bSOS\b/.test(text);
    if (sos) await db.prepare('UPDATE roster SET sosAt=?, sosAck=NULL WHERE id=?').bind(now, row.id).run();
    await chatSend(db, { team: row.name, from: 'team', name: 'SMS', kind: sos ? 'sos' : '', text: (sos ? 'SOS ทาง SMS · ' : '📩 ส่งตำแหน่งทาง SMS (ไม่มีเน็ต)') + (t < now - 120e3 ? ' · ตำแหน่งเมื่อ ' + new Date(t).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) : ''), lat, lng });
    n++;
  }
  if (n) await bumpRev(db);
  return json({ ok: true, updated: n });
}
async function smsCfg(db, b) {
  if (WRC) return { ok: false, error: 'central_only' };
  let s = await getMeta(db, 'sms_secret');
  if (!s || b.renew) { s = rand(24); await setMeta(db, 'sms_secret', s); }
  return { ok: true, secret: s };
}
async function trackApp(db, request, url, pathTk) {
  const q = Object.fromEntries(url.searchParams);
  let body = {};
  if (request.method === 'POST') {
    const txt = await request.text();
    try { body = JSON.parse(txt || '{}'); } catch (e) { for (const [k, v] of new URLSearchParams(txt)) q[k] = v; }
  }
  const loc = body.location || (Array.isArray(body.locations) ? body.locations[body.locations.length - 1] : null);
  let tk = pathTk || q.id || q.deviceid || q.device_id || body.device_id || body.deviceId || (loc && loc.extras && loc.extras.device_id) || '';
  tk = String(tk).toLowerCase().replace(/[^a-z0-9]/g, '');
  const out = (o, st = 200) => json(o, st);
  if (tk.length < 10) return out({ ok: false, error: 'missing_id' }, 400);
  const row = await db.prepare('SELECT name FROM roster WHERE token=? AND active=1').bind(tk).first();
  if (!row) return out({ ok: false, error: 'bad_link' }, 403);
  let p;
  if (loc && loc.coords) {
    const c = loc.coords, lv = loc.battery && loc.battery.level;
    p = { lat: c.latitude, lng: c.longitude, acc: c.accuracy, speed: c.speed >= 0 ? c.speed * 3.6 : null, heading: c.heading >= 0 ? c.heading : null,
      batt: lv >= 0 && lv <= 1 ? Math.round(lv * 100) : null, t: Date.parse(loc.timestamp), alt: c.altitude };
  } else if (body._type === 'location') {
    p = { lat: body.lat, lng: body.lon, acc: body.acc, speed: body.vel, heading: body.cog, batt: body.batt, t: Number(body.tst) * 1000, alt: body.alt };
  } else if (body._type) {
    return json([]);
  } else {
    const ts = q.timestamp;
    p = { lat: q.lat, lng: q.lon ?? q.lng, acc: q.accuracy ?? q.hdop, speed: q.speed != null && q.speed !== '' ? Number(q.speed) * 1.852 : null, heading: q.bearing ?? q.heading,
      batt: q.batt ?? q.battery, t: /^\d{9,10}$/.test(ts || '') ? ts * 1000 : /^\d{12,13}$/.test(ts || '') ? Number(ts) : Date.parse(ts || '') };
  }
  const lat = num(p.lat, -90, 90), lng = num(p.lng, -180, 180);
  if (lat == null || lng == null || (lat === 0 && lng === 0)) return out({ ok: false, error: 'bad_location' }, 400);
  const now = Date.now(), t = isFinite(p.t) && p.t > now - 7 * 864e5 && p.t <= now + 60e3 ? Math.min(p.t, now) : now;
  const acc = clampInt(p.acc, 0, 100000, null), batt = clampInt(p.batt, 0, 100, null), speed = num(p.speed, 0, 300), heading = num(p.heading, 0, 360);
  await db.batch([
    db.prepare('INSERT INTO teams_live (team,lat,lng,accuracy,caseId,updatedAt,battery,speed,heading) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(team) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,updatedAt=excluded.updatedAt,battery=excluded.battery,speed=excluded.speed,heading=excluded.heading WHERE excluded.updatedAt>=teams_live.updatedAt')
      .bind(row.name, lat, lng, acc, '', t, batt, speed, heading),
    db.prepare('INSERT INTO team_track (team,lat,lng,accuracy,battery,speed,at) VALUES (?,?,?,?,?,?,?)').bind(row.name, lat, lng, acc, batt, speed, t),
    db.prepare('UPDATE teams_live SET appAt=? WHERE team=?').bind(now, row.name),
  ]);
  await saveTele(db, row.name, { alt: p.alt, sig: body.sig, net: body.net, carrier: body.carrier, charging: body.chg }, lat, lng).catch(() => {});
  return body._type ? json([]) : out({ ok: true });
}
async function saveTele(db, team, b, lat, lng) {
  const alt = num(b.alt ?? b.altitude, -500, 9000), chg = b.charging === true || b.charging === 1 || b.charging === '1' || b.chg === 1 ? 1 : b.charging === false || b.charging === 0 || b.charging === '0' || b.chg === 0 ? 0 : null;
  const sig = clampInt(b.sig, 0, 4, null), net = clean(b.net, 20) || null, carrier = clean(b.carrier, 40) || null;
  if (alt != null || chg != null || sig != null || net || carrier)
    await db.prepare('UPDATE teams_live SET alt=COALESCE(?,alt),charging=COALESCE(?,charging),sig=COALESCE(?,sig),net=COALESCE(?,net),carrier=COALESCE(?,carrier),devAt=? WHERE team=?').bind(alt, chg, sig, net, carrier, Date.now(), team).run();
  const row = await db.prepare('SELECT wxAt FROM teams_live WHERE team=?').bind(team).first();
  if (row && Date.now() - (Number(row.wxAt) || 0) > 10 * 60e3) {
    await db.prepare('UPDATE teams_live SET wxAt=? WHERE team=?').bind(Date.now(), team).run();
    const job = (async () => { const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,relative_humidity_2m&timezone=Asia%2FBangkok`, { headers: UA });
      const j = await r.json(), c = j && j.current; if (c) await db.prepare('UPDATE teams_live SET temp=?,hum=? WHERE team=?').bind(num(c.temperature_2m, -50, 70), num(c.relative_humidity_2m, 0, 100), team).run(); })().catch(() => {});
    if (CTX && CTX.waitUntil) CTX.waitUntil(job); else await job;
  }
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
  await saveTele(db, team, b, lat, lng).catch(() => {});
  const last = await db.prepare('SELECT lat,lng,at FROM team_track WHERE team=? ORDER BY n DESC LIMIT 1').bind(team).first();
  if (!last || km(last.lat, last.lng, lat, lng) > 0.02 || now - last.at > 120e3) {
    await db.prepare('INSERT INTO team_track (team,lat,lng,accuracy,battery,speed,at) VALUES (?,?,?,?,?,?,?)').bind(team, lat, lng, acc, batt, speed, now).run();
  }
  return { ok: true };
}
async function teamTrack(db, p) {
  const team = clean(p.team, MAX.volunteer);
  if (!team) return { ok: false, error: 'missing_team' };
  const { results } = await db.prepare('SELECT lat,lng,accuracy,battery,speed,at FROM team_track WHERE team=? AND at>? ORDER BY at, n LIMIT 3000')
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
  await bumpRev(db);
  return { ok: true, id };
}
async function listRoster(db) {
  const { results } = await db.prepare('SELECT id,name,leader,phone,members,vehicle,zone,status,note,updatedAt,token,sosAt,sosAck,warroom,gmaps FROM roster WHERE active=1 ORDER BY name').all();
  const miss = results.filter(r => !r.token);
  if (miss.length) { for (const r of miss) r.token = teamToken(); await db.batch(miss.map(r => db.prepare('UPDATE roster SET token=? WHERE id=?').bind(r.token, r.id))); }
  for (const r of results) r.view = r.token ? await viewId(r.token) : '';
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
  const live = await db.prepare('SELECT lat,lng,accuracy,updatedAt,appAt FROM teams_live WHERE team=?').bind(t.name).first();
  const { results: stock } = await db.prepare('SELECT name FROM stock ORDER BY category, name').all();
  const stk = {};
  if (results.length) { const { results: sl } = await db.prepare("SELECT caseId,item,delta FROM stock_log WHERE type='out' AND caseId<>'' AND caseId IN (SELECT id FROM cases WHERE volunteer IN (?,?) AND (status='going' OR (status='done' AND updatedAt>?)))").bind(t.name, "'" + t.name, now - 86400e3).all();
    sl.forEach(l => { (stk[l.caseId] = stk[l.caseId] || []).push({ item: l.item, qty: Math.abs(l.delta) }); }); }
  results.forEach(c => { c._stk = stk[String(c.id)] || []; });
  return { ok: true, team: { id: r.id || '', name: t.name, leader: r.leader || '', phone: r.phone || '', members: r.members ?? '', vehicle: r.vehicle || '', zone: r.zone || '',
      status: r.status || '', sosAt: r.sosAt || null, sosAck: r.sosAck || null, gmaps: r.gmaps || '', view: r.token ? await viewId(r.token) : '', inRoster: !!r.id },
    hqPhone: await getMeta(db, 'hq_phone'), cases: results.map(c => ({ ...outCase(c, true), supplies: c._stk })), live: live || null, supplies: stock.map(s => s.name), now,
    rallies: await teamRallies(db, t.name), stats: await teamStats(db, t.name, now), route: await teamRoute(db, t.name) };
}
async function teamCases(db) {
  const { results } = await db.prepare("SELECT * FROM cases WHERE status='open' AND COALESCE(dupOf,'')='' ORDER BY urgency DESC, createdAt DESC LIMIT 400").all();
  return { ok: true, cases: results.map(c => { const ph = (String(c.photos || '').match(/[-\w]{25,}/g) || []).length, o = outCase(c, true);
    return { ...o, photos: ph }; }), now: Date.now() };
}
async function teamRoute(db, name) { const r = await db.prepare('SELECT caseId,data,at,by_ FROM team_route WHERE team=? AND at>?').bind(name, Date.now() - 24 * 3600e3).first(); if (!r) return null; try { return { ...JSON.parse(r.data), at: r.at, by: r.by_ }; } catch (e) { return null; } }
async function teamStats(db, name, now) {
  const DONE = "(status='done' OR COALESCE(teamDoneAt,0)>0)", AT = 'COALESCE(teamDoneAt,doneAt,updatedAt)';
  const a = await db.prepare(`SELECT COUNT(*) n, SUM(CASE WHEN ${DONE} THEN 1 ELSE 0 END) helped, SUM(CASE WHEN ${DONE} THEN MAX(COALESCE(people,1),1) ELSE 0 END) ppl, MIN(createdAt) since FROM cases WHERE volunteer IN (?,?) AND COALESCE(dupOf,'')=''`).bind(name, "'" + name).first() || {};
  const { results } = await db.prepare(`SELECT ${AT} t, MAX(COALESCE(people,1),1) p FROM cases WHERE volunteer IN (?,?) AND ${DONE} AND ${AT}>? AND COALESCE(dupOf,'')=''`).bind(name, "'" + name, now - 8 * 864e5).all();
  return { total: a.n || 0, helped: a.helped || 0, people: a.ppl || 0, since: a.since || null, week: results.map(r => [Number(r.t) || 0, Number(r.p) || 1]) };
}
async function callStart(db, team, from, b) {
  if (!team) return { ok: false, error: 'missing_team' };
  const mode = b.mode === 'video' ? 'video' : 'voice';
  const link = await callCreate(db, { team, from, mode, name: b.name });
  await chatSend(db, { team, from, name: b.name, text: mode === 'voice' ? 'โทรด้วยเสียง' : 'วิดีโอคอล', kind: 'call', link, caseId: b.caseId });
  return { ok: true, link, mode };
}
const CALL_KINDS = ['hello', 'offer', 'answer', 'ice', 'bye'];
async function callCreate(db, { team, from, mode, name }) {
  const id = rand(6), secret = rand(12), now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO calls (id,secret,mode,team,caller,name,createdAt) VALUES (?,?,?,?,?,?,?)').bind(id, secret, mode, team, from, clean(name, 60), now),
    db.prepare('DELETE FROM call_sig WHERE at<?').bind(now - 864e5),
    db.prepare('DELETE FROM calls WHERE createdAt<?').bind(now - 7 * 864e5),
  ]);
  return `/call/#${id}.${secret}`;
}
async function callAuth(db, b) {
  const [id, secret] = String(b.c || '').split('.');
  if (!/^[0-9a-f]{12}$/.test(id || '') || !/^[0-9a-f]{24}$/.test(secret || '')) return null;
  const c = await db.prepare('SELECT * FROM calls WHERE id=?').bind(id).first();
  if (!c || c.secret.length !== secret.length) return null;
  let d = 0; for (let i = 0; i < secret.length; i++) d |= c.secret.charCodeAt(i) ^ secret.charCodeAt(i);
  return d === 0 && Date.now() - c.createdAt < 864e5 ? c : null;
}
async function iceServers(env) {
  const stun = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return { servers: stun, turn: false };
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST', headers: { authorization: 'Bearer ' + env.TURN_KEY_API_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify({ ttl: 6 * 3600 }), signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    if (r.ok && j.iceServers) return { servers: [].concat(j.iceServers), turn: true };
  } catch (e) {}
  return { servers: stun, turn: false };
}
const CALL_POST = {
  call_poll: async (db, c, b, env) => {
    const since = Math.max(0, Number(b.since) || 0), peer = clean(b.peer, 20);
    const { results } = await db.prepare('SELECT n,peer,dest,kind,data,at FROM call_sig WHERE call=? AND n>? AND peer<>? AND (dest=? OR dest=\'\') ORDER BY n LIMIT 200').bind(c.id, since, peer, peer).all();
    const out = { ok: true, now: Date.now(), sigs: results };
    if (!since) Object.assign(out, { mode: c.mode, team: c.team, caller: c.caller, name: c.name, createdAt: c.createdAt, ice: await iceServers(env) });
    return out;
  },
  call_send: async (db, c, b) => {
    const kind = CALL_KINDS.includes(b.kind) ? b.kind : '', peer = clean(b.peer, 20), data = typeof b.data === 'string' ? b.data : JSON.stringify(b.data ?? '');
    if (!kind || !/^[a-z0-9]{6,20}$/.test(peer) || data.length > 30000) return { ok: false, error: 'bad_signal' };
    const cnt = await db.prepare('SELECT COUNT(*) n FROM call_sig WHERE call=?').bind(c.id).first();
    if (cnt.n > 3000) return { ok: false, error: 'too_many' };
    const r = await db.prepare('INSERT INTO call_sig (call,peer,dest,kind,data,at) VALUES (?,?,?,?,?,?)').bind(c.id, peer, clean(b.to, 20), kind, data, Date.now()).run();
    return { ok: true, n: r.meta.last_row_id };
  },
};
const RALLY_ST = ['going', 'arrived', 'declined'];
const rallyTargets = r => String(r.teams || '').split('\n').filter(Boolean);
async function rallyAllTeams(db) {
  const { results } = await db.prepare("SELECT name FROM roster WHERE active=1 AND COALESCE(status,'ready')<>'rest'" + (WRC ? ' AND warroom=?' : '')).bind(...(WRC ? [WRC.id] : [])).all();
  return results.map(x => x.name);
}
async function rallySave(db, b) {
  const lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180);
  if (lat == null || lng == null) return { ok: false, error: 'missing_location' };
  const list = Array.isArray(b.teams) ? [...new Set(b.teams.map(t => clean(t, MAX.volunteer)).filter(Boolean))].slice(0, 100) : [];
  if (b.all !== true && !list.length) return { ok: false, error: 'no_teams' };
  const targets = b.all === true ? await rallyAllTeams(db) : list;
  if (!targets.length) return { ok: false, error: 'no_teams' };
  const id = 'R' + rand(5), now = Date.now(), r = { id, lat, lng, label: clean(b.label, 120) || 'จุดรวมพล', note: clean(b.note, 300), teams: targets.join('\n'), caseId: clean(b.caseId, 40), warroom: WRC ? WRC.id : '' };
  const by = clean(b.by, 60) || 'ศูนย์', text = clean(`📣 เรียกรวมพล: ${r.label}${r.note ? ' · ' + r.note : ''}`, 1000);
  const st = [db.prepare('INSERT INTO rallies (id,lat,lng,label,note,teams,caseId,warroom,createdAt,by_,isAll) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, lat, lng, r.label, r.note, r.teams, r.caseId, r.warroom, now, clean(b.by, 60), b.all === true ? 1 : 0),
    ...targets.map(t => db.prepare('INSERT INTO chat (team,sender,name,text,caseId,lat,lng,at,readHq,readTeam,kind,link) VALUES (?,?,?,?,?,?,?,?,1,0,?,?)').bind(clean(t, MAX.volunteer), 'hq', by, text, r.caseId, lat, lng, now, '', ''))];
  for (let i = 0; i < st.length; i += 80) await db.batch(st.slice(i, i + 80));
  await setMeta(db, 'chat_rev', String(now)); await bumpRev(db);
  return { ok: true, id, sent: targets.length };
}
async function rallyClose(db, b) { const id = clean(b.id, 20); const r = await db.prepare('SELECT * FROM rallies WHERE id=?').bind(id).first(); if (!r) return { ok: false, error: 'not_found' };
  if (WRC && r.warroom !== WRC.id) return { ok: false, error: 'not_in_room' };
  await db.prepare('UPDATE rallies SET closedAt=? WHERE id=? AND closedAt IS NULL').bind(Date.now(), id).run(); await bumpRev(db); return { ok: true }; }
async function rallyList(db) {
  const { results } = await db.prepare('SELECT * FROM rallies WHERE closedAt IS NULL AND createdAt>?' + (WRC ? ' AND warroom=?' : '') + ' ORDER BY createdAt DESC LIMIT 20').bind(Date.now() - 3 * 864e5, ...(WRC ? [WRC.id] : [])).all();
  if (!results.length) return { ok: true, rallies: [] };
  const { results: resp } = await db.prepare(`SELECT rallyId,team,status,at,note FROM rally_resp WHERE rallyId IN (${results.map(() => '?').join(',')})`).bind(...results.map(r => r.id)).all();
  return { ok: true, rallies: results.map(r => ({ id: r.id, lat: r.lat, lng: r.lng, label: r.label, note: r.note || '', all: r.isAll === 1 || r.teams === '*', teams: rallyTargets(r), caseId: r.caseId || '', createdAt: r.createdAt, by: r.by_ || '', resp: resp.filter(x => x.rallyId === r.id) })) };
}
async function teamRallies(db, name) {
  const { results } = await db.prepare("SELECT r.id,r.lat,r.lng,r.label,r.note,r.caseId,r.createdAt,x.status my FROM rallies r LEFT JOIN rally_resp x ON x.rallyId=r.id AND x.team=? WHERE r.closedAt IS NULL AND r.createdAt>? AND instr(char(10)||r.teams||char(10), char(10)||?||char(10))>0 ORDER BY r.createdAt DESC LIMIT 10")
    .bind(name, Date.now() - 3 * 864e5, name).all();
  return results.map(r => ({ id: r.id, lat: r.lat, lng: r.lng, label: r.label, note: r.note || '', caseId: r.caseId || '', createdAt: r.createdAt, my: r.my || '' }));
}
const BOARD_ST = ['todo', 'doing', 'done'], BOARD_COLORS = ['', 'red', 'orange', 'green', 'blue', 'purple'];
const boardRoom = v => WRC ? WRC.id : (clean(v, 30).replace(/[^\w-]/g, '') || 'central');
const boardOut = c => ({ id: c.id, room: c.room, title: c.title, body: c.body || '', status: c.status, lat: c.lat, lng: c.lng, place: c.place || '', cases: String(c.cases || '').split(',').filter(Boolean),
  due: c.due || null, dueEnd: c.dueEnd || null, allDay: !!c.allDay, assignee: c.assignee || '', color: c.color || '', imgs: String(c.imgs || '').split(',').filter(Boolean), createdAt: c.createdAt, updatedAt: c.updatedAt, by: c.by_ || '' });
async function boardList(db, p) {
  const room = boardRoom(p.room);
  const { results } = await db.prepare('SELECT * FROM board WHERE room=? AND deleted=0 ORDER BY COALESCE(due, 9e15), createdAt LIMIT 500').bind(room).all();
  return { ok: true, room, cards: results.map(boardOut), rev: await getMeta(db, 'board_rev:' + room) || '0' };
}
async function boardSave(db, b) {
  const c = b.card || {}, room = boardRoom(c.room), now = Date.now(), id = clean(c.id, 20).replace(/[^\w-]/g, '');
  const old = id ? await db.prepare('SELECT * FROM board WHERE id=? AND deleted=0').bind(id).first() : null;
  if (id && (!old || old.room !== room)) return { ok: false, error: 'not_found' };
  const title = clean(c.title, 140); if (!title) return { ok: false, error: 'missing_title' };
  const lat = num(c.lat, -90, 90), lng = num(c.lng, -180, 180), ts = v => { const n = Number(v); return n > 1e12 && n < 1e13 ? Math.round(n) : null; };
  const v = [room, title, clean(c.body, 4000), BOARD_ST.includes(c.status) ? c.status : 'todo', lat, lat == null ? null : lng, clean(c.place, 200),
    (Array.isArray(c.cases) ? c.cases : []).map(x => clean(x, 40)).filter(Boolean).slice(0, 30).join(','), ts(c.due), ts(c.dueEnd), c.allDay ? 1 : 0, clean(c.assignee, 80), BOARD_COLORS.includes(c.color) ? c.color : '', now, clean(b.by, 60)];
  if (old) await db.prepare('UPDATE board SET room=?,title=?,body=?,status=?,lat=?,lng=?,place=?,cases=?,due=?,dueEnd=?,allDay=?,assignee=?,color=?,updatedAt=?,by_=? WHERE id=?').bind(...v, id).run();
  const nid = old ? id : 'B' + rand(5);
  if (!old) await db.prepare('INSERT INTO board (room,title,body,status,lat,lng,place,cases,due,dueEnd,allDay,assignee,color,updatedAt,by_,id,createdAt,imgs) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...v, nid, now, '').run();
  await setMeta(db, 'board_rev:' + room, String(now));
  return { ok: true, id: nid };
}
async function boardMove(db, b) {
  const c = await db.prepare('SELECT room FROM board WHERE id=? AND deleted=0').bind(clean(b.id, 20)).first();
  if (!c || c.room !== boardRoom(c.room)) return { ok: false, error: 'not_found' };
  if (!BOARD_ST.includes(b.status)) return { ok: false, error: 'bad_status' };
  await db.prepare('UPDATE board SET status=?, updatedAt=?, by_=? WHERE id=?').bind(b.status, Date.now(), clean(b.by, 60), clean(b.id, 20)).run();
  await setMeta(db, 'board_rev:' + c.room, String(Date.now())); return { ok: true };
}
async function boardDelete(db, b) {
  const c = await db.prepare('SELECT room FROM board WHERE id=? AND deleted=0').bind(clean(b.id, 20)).first();
  if (!c || c.room !== boardRoom(c.room)) return { ok: false, error: 'not_found' };
  await db.prepare('UPDATE board SET deleted=1, updatedAt=? WHERE id=?').bind(Date.now(), clean(b.id, 20)).run();
  await setMeta(db, 'board_rev:' + c.room, String(Date.now())); return { ok: true };
}
async function boardImgAdd(db, b) {
  const c = await db.prepare('SELECT room,imgs FROM board WHERE id=? AND deleted=0').bind(clean(b.cardId, 20)).first();
  if (!c || c.room !== boardRoom(c.room)) return { ok: false, error: 'not_found' };
  const data = String(b.data || ''); if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data) || data.length > 1200000) return { ok: false, error: 'bad_image' };
  const imgs = String(c.imgs || '').split(',').filter(Boolean); if (imgs.length >= 12) return { ok: false, error: 'too_many' };
  const id = 'I' + rand(6); imgs.push(id);
  await db.batch([db.prepare('INSERT INTO board_img (id,cardId,room,data,at) VALUES (?,?,?,?,?)').bind(id, clean(b.cardId, 20), c.room, data, Date.now()),
    db.prepare('UPDATE board SET imgs=?, updatedAt=? WHERE id=?').bind(imgs.join(','), Date.now(), clean(b.cardId, 20))]);
  await setMeta(db, 'board_rev:' + c.room, String(Date.now())); return { ok: true, id };
}
async function boardImgDel(db, b) {
  const i = await db.prepare('SELECT cardId,room FROM board_img WHERE id=?').bind(clean(b.id, 20)).first();
  if (!i || i.room !== boardRoom(i.room)) return { ok: false, error: 'not_found' };
  const c = await db.prepare('SELECT imgs FROM board WHERE id=?').bind(i.cardId).first();
  await db.batch([db.prepare('DELETE FROM board_img WHERE id=?').bind(clean(b.id, 20)), db.prepare('UPDATE board SET imgs=?, updatedAt=? WHERE id=?').bind(String((c || {}).imgs || '').split(',').filter(x => x && x !== clean(b.id, 20)).join(','), Date.now(), i.cardId)]);
  await setMeta(db, 'board_rev:' + i.room, String(Date.now())); return { ok: true };
}
async function boardImg(db, p) { const i = await db.prepare('SELECT room,data FROM board_img WHERE id=?').bind(clean(p.id, 20)).first(); if (!i || i.room !== boardRoom(i.room)) return { ok: false, error: 'not_found' }; return { ok: true, data: i.data }; }
const TEAM_POST = {
  rally_resp: async (db, t, b) => {
    const r = await db.prepare('SELECT * FROM rallies WHERE id=? AND closedAt IS NULL').bind(clean(b.id, 20)).first();
    if (!r || !rallyTargets(r).includes(t.name)) return { ok: false, error: 'not_found' };
    if (!RALLY_ST.includes(b.status)) return { ok: false, error: 'bad_status' };
    await db.prepare('INSERT INTO rally_resp (rallyId,team,status,at,note) VALUES (?,?,?,?,?) ON CONFLICT(rallyId,team) DO UPDATE SET status=excluded.status, at=excluded.at, note=excluded.note').bind(r.id, t.name, b.status, Date.now(), clean(b.note, 200)).run();
    await chatSend(db, { team: t.name, from: 'team', name: b.name, text: `รวมพล "${r.label}": ${{ going: 'กำลังไป', arrived: 'ถึงจุดรวมพลแล้ว', declined: 'ไม่สะดวกไป' }[b.status]}${b.note ? ' · ' + clean(b.note, 200) : ''}`, lat: b.lat, lng: b.lng });
    await bumpRev(db); return { ok: true };
  },
  team_profile: async (db, t, b) => {
    if (!t.row) return { ok: false, error: 'not_in_roster' };
    const p = b.profile || {}, sets = [], vals = [];
    if (p.leader !== undefined) { sets.push('leader=?'); vals.push(clean(p.leader, 60)); }
    if (p.phone !== undefined) { sets.push('phone=?'); vals.push(clean(p.phone, 20).replace(/[^\d+\-\s]/g, '')); }
    if (p.members !== undefined) { sets.push('members=?'); vals.push(p.members === '' ? null : clampInt(p.members, 0, 999, null)); }
    if (p.vehicle !== undefined) { sets.push('vehicle=?'); vals.push(VEHICLES.includes(p.vehicle) ? p.vehicle : ''); }
    if (p.zone !== undefined) { sets.push('zone=?'); vals.push(clean(p.zone, 80)); }
    if (!sets.length) return { ok: false, error: 'nothing' };
    sets.push('updatedAt=?', 'by_=?'); vals.push(Date.now(), clean('ทีม ' + t.name, 60));
    await db.prepare(`UPDATE roster SET ${sets.join(',')} WHERE id=?`).bind(...vals, t.row.id).run();
    await bumpRev(db); return { ok: true };
  },
  ptt_send: async (db, t, b) => { const au = await pttAuth(ENV, db, { ...b, tk: b.tk || '', team: t.name }, false); return pttSend(db, { sender: t.name, kind: 'team', name: b.name, chans: (au.chans || []).map(c => c.id) }, b); },
  team_ping: (db, t, b) => pingTeam(db, { ...b, team: t.name }),
  road_q: async (db, t, b) => {
    const pts = (Array.isArray(b.pts) ? b.pts : []).slice(0, 120), now = Date.now(), st = [];
    for (const p of pts) { const lat = num(p.lat, -90, 90), lng = num(p.lng, -180, 180), at = Number(p.at); if (lat == null || lng == null || !lat || !lng) continue;
      st.push(db.prepare('INSERT INTO road_q (team,at,lat,lng,rms,peak,bumps,spd) VALUES (?,?,?,?,?,?,?,?)').bind(t.name, at > now - 7 * 864e5 && at <= now + 6e4 ? at : now, lat, lng, num(p.rms, 0, 50) || 0, num(p.peak, 0, 80) || 0, clampInt(p.bumps, 0, 999, 0), num(p.spd, 0, 250) || 0)); }
    if (st.length) await db.batch(st); return { ok: true, n: st.length }; },
  team_status: async (db, t, b) => {
    if (!t.row) return { ok: false, error: 'not_in_roster' };
    if (!ROSTER_STATUS.includes(b.status)) return { ok: false, error: 'bad_status' };
    await db.prepare('UPDATE roster SET status=?, updatedAt=? WHERE id=?').bind(b.status, Date.now(), t.row.id).run();
    return { ok: true, status: b.status };
  },
  case_photo_add: async (db, t, b) => {
    const c = await db.prepare('SELECT id,volunteer,status FROM cases WHERE id=?').bind(clean(b.id, 30)).first();
    if (!c || String(c.volunteer || '').replace(/^'/, '').trim() !== t.name) return { ok: false, error: 'not_your_case' };
    let a; try { a = b64bytes(b.img); } catch (e) { return { ok: false, error: 'bad_image' }; }
    if (a.length < 2000 || a.length > 1500e3 || a[0] !== 0xFF || a[1] !== 0xD8) return { ok: false, error: 'bad_image' };
    const n = await db.prepare('SELECT COUNT(*) n FROM case_photo WHERE caseId=?').bind(c.id).first();
    if (n && n.n >= 20) return { ok: false, error: 'too_many' };
    const r = await db.prepare('INSERT INTO case_photo (caseId,team,kind,at,lat,lng,size,img) VALUES (?,?,?,?,?,?,?,?)').bind(c.id, t.name, 'handoff', Date.now(), num(b.lat, -90, 90), num(b.lng, -180, 180), a.length, a).run();
    await bumpRev(db); return { ok: true, n: r.meta && r.meta.last_row_id, count: (n ? n.n : 0) + 1 };
  },
  team_case: async (db, t, b) => {
    const c = await db.prepare('SELECT id,volunteer,status FROM cases WHERE id=?').bind(clean(b.id, 30)).first();
    if (!c || String(c.volunteer || '').replace(/^'/, '').trim() !== t.name) return { ok: false, error: 'not_your_case' };
    if (b.step === 'memo') { const m = clean(b.note, 500); if (!m) return { ok: false, error: 'empty' }; const now = Date.now();
      await db.prepare('UPDATE cases SET teamMemo=?, teamMemoAt=?, updatedAt=? WHERE id=?').bind(m, now, now, c.id).run(); await bumpRev(db);
      await chatSend(db, { team: t.name, from: 'team', name: b.name, text: `หมายเหตุเคส #${c.id}: ${m}`, caseId: c.id, lat: b.lat, lng: b.lng }); return { ok: true }; }
    if (b.step === 'arrived') { const now = Date.now(); await db.prepare('UPDATE cases SET teamArrivedAt=COALESCE(teamArrivedAt,?), updatedAt=? WHERE id=?').bind(now, now, c.id).run(); await bumpRev(db); await chatSend(db, { team: t.name, from: 'team', name: b.name, text: `ถึงจุดเคส #${c.id} แล้ว`, caseId: c.id, lat: b.lat, lng: b.lng }); return { ok: true }; }
    if (b.step === 'issue') { if (c.status !== 'going') return { ok: false, error: 'bad_step' }; const ISS = { blocked: 'เข้าไม่ถึง', notfound: 'ไม่เจอบ้าน', evacuated: 'อพยพไปแล้ว', noanswer: 'ติดต่อผู้แจ้งไม่ได้', need: 'ต้องการกำลังเสริม' }, why = ISS[b.issue] || 'ปัญหาอื่น';
      await db.prepare('UPDATE cases SET teamIssue=?, teamIssueAt=?, updatedAt=? WHERE id=?').bind(why + (b.note ? ' · ' + clean(b.note, 200) : ''), Date.now(), Date.now(), c.id).run(); await bumpRev(db);
      await chatSend(db, { team: t.name, from: 'team', name: b.name, text: `แจ้งปัญหาเคส #${c.id}: ${why}${b.note ? ' · ' + clean(b.note, 200) : ''}`, caseId: c.id, lat: b.lat, lng: b.lng }); return { ok: true }; }
    if (b.step !== 'done' || c.status !== 'going') return { ok: false, error: 'bad_step' };
    const ph = await db.prepare("SELECT COUNT(*) n FROM case_photo WHERE caseId=? AND kind='handoff'").bind(c.id).first(), phn = ph ? ph.n : 0;
    const sets = ['teamDoneAt=?', 'teamNote=?', 'updatedAt=?', 'teamIssue=NULL', 'teamIssueAt=NULL'], vals = [Date.now(), clean(b.note, 300), Date.now()];
    if (b.bags !== undefined && b.bags !== '' && b.bags !== null) { sets.push('bags=?'); vals.push(clampInt(b.bags, 0, 9999, 0)); }
    await db.prepare(`UPDATE cases SET ${sets.join(',')} WHERE id=?`).bind(...vals, c.id).run();
    await bumpRev(db);
    await chatSend(db, { team: t.name, from: 'team', name: b.name, text: `ช่วยเหลือแล้ว · เคส #${c.id}`, caseId: c.id });
    return { ok: true, teamDone: true };
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
  team_gmaps: (db, t, b) => setTeamGmaps(db, t.name, b.gmaps),
  env_check: (db, t, b) => envCheck(ENV, b),
  chat_read: (db, t, b) => chatRead(db, { team: t.name, side: 'team' })
};
async function alertsList(db) {
  const now = Date.now();
  const { results: sos } = await db.prepare('SELECT r.id,r.name,r.phone,r.sosAt,r.sosAck,l.lat,l.lng FROM roster r LEFT JOIN teams_live l ON l.team=r.name WHERE r.active=1 AND r.sosAt>? AND (r.sosAck IS NULL OR r.sosAck<r.sosAt)').bind(now - 12 * 3600e3).all();
  const { results: calls } = await db.prepare("SELECT n,team,name,text,link,at FROM chat WHERE kind='call' AND sender='team' AND at>? ORDER BY n DESC LIMIT 5").bind(now - 120e3).all();
  return { sos, calls, silent: await silentTeams(db) };
}
async function silentTeams(db) {
  const now = Date.now();
  let list = null; try { const c = JSON.parse(await getMeta(db, 'silent_cache') || 'null'); if (c && now - c.at < 60e3) list = c.list; } catch (e) {}
  if (!list) {
    const { results: q } = await db.prepare(`SELECT r.id, r.name, r.phone, r.gmaps, COUNT(c.id) n, MAX(COALESCE(c.pickedAt,0)) picked, l.updatedAt loc, l.lat, l.lng,
        (SELECT MAX(at) FROM chat WHERE team=r.name AND sender='team') msg
      FROM roster r JOIN cases c ON c.status='going' AND c.volunteer IN (r.name, '''' || r.name) LEFT JOIN teams_live l ON l.team=r.name
      WHERE r.active=1 GROUP BY r.id`).all();
    list = q.filter(t => !(t.gmaps && !t.loc)).map(t => ({ id: t.id, name: t.name, phone: t.phone || '', cases: t.n, last: Math.max(t.loc || 0, t.msg || 0, t.picked || 0) || null, lat: t.lat, lng: t.lng }))
      .filter(t => now - (t.last || 0) > 30 * 60e3);
    await setMeta(db, 'silent_cache', JSON.stringify({ at: now, list }));
  }
  if (!list.length) return [];
  const { results: acks } = await db.prepare(`SELECT k,v FROM meta WHERE k IN (${list.map(() => '?').join(',')})`).bind(...list.map(t => 'silent_ack:' + t.name)).all();
  const ack = new Map(acks.map(a => [a.k.slice(11), Number(a.v)]));
  return list.filter(t => !(ack.get(t.name) > now - 30 * 60e3));
}
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
const satDate = s => { const d = [...String(s || '').matchAll(/_(20\d{6})_/g)].map(m => m[1]).sort().pop(); return d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : ''; };
function inRing(lat, lng, ring) { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; } return c; }
function inGeom(lat, lng, g) { const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; return polys.some(p => p.length && inRing(lat, lng, p[0]) && !p.slice(1).some(h => inRing(lat, lng, h))); }
function geomDist(lat, lng, g) { const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []; let best = Infinity;
  for (const p of polys) for (const [x, y] of (p[0] || [])) best = Math.min(best, km(lat, lng, y, x) * 1000); return best; }
async function gistdaCell(env, cx, cy) {
  return cached(`gd7:${cx},${cy}`, 1800, async () => {
    const S = 0.04, w = cx * S - 0.01, so = cy * S - 0.01, e = (cx + 1) * S + 0.01, n = (cy + 1) * S + 0.01;
    const r = await fetch(`https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/7days?bbox=${w.toFixed(3)},${so.toFixed(3)},${e.toFixed(3)},${n.toFixed(3)}&limit=1000`,
      { headers: { 'API-Key': env.GISTDA_KEY, ...UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('gistda ' + r.status);
    const j = await r.json();
    return (j.features || []).filter(f => f.geometry).map(f => ({ g: f.geometry, a: Math.round(f.properties?.f_area || 0), d: satDate(f.properties?.file_name) }));
  });
}
async function envCheck(env, b) {
  const pts = [...new Map((Array.isArray(b.points) ? b.points : []).map(p => [num(p.lat, -90, 90), num(p.lng, -180, 180)]).filter(([a, o]) => a != null && o != null && (a || o))
    .map(([a, o]) => [a.toFixed(3) + ',' + o.toFixed(3), { k: a.toFixed(3) + ',' + o.toFixed(3), lat: +a.toFixed(3), lng: +o.toFixed(3) }])).values()].slice(0, 300);
  const out = {};
  pts.forEach(p => { out[p.k] = {}; });
  const cells = new Map(); pts.forEach(p => { const c = (Math.round(p.lat / 0.02) * 0.02).toFixed(2) + ',' + (Math.round(p.lng / 0.02) * 0.02).toFixed(2); if (!cells.has(c)) cells.set(c, []); cells.get(c).push(p); });
  const ck = [...cells.keys()];
  for (let i = 0; i < ck.length; i += 100) {
    const part = ck.slice(i, i + 100), la = part.map(c => c.split(',')[0]).join(','), lo = part.map(c => c.split(',')[1]).join(',');
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&hourly=precipitation&past_hours=24&forecast_hours=3&timezone=Asia%2FBangkok`, { headers: UA, signal: AbortSignal.timeout(12000) });
      const j = await r.json(), arr = Array.isArray(j) ? j : [j];
      arr.forEach((x, k) => { const h = (x.hourly || {}).precipitation || [], sum = a => Math.round(a.reduce((s, v) => s + (Number(v) || 0), 0) * 10) / 10;
        const rain = { h24: sum(h.slice(0, 24)), h3: sum(h.slice(21, 24)), next3: sum(h.slice(24, 27)) };
        (cells.get(part[k]) || []).forEach(p => { out[p.k].rain = rain; }); });
    } catch (e) {}
  }
  if (env.GISTDA_KEY) {
    const S = 0.04, gc = new Map(); pts.forEach(p => { const c = Math.floor(p.lng / S) + ',' + Math.floor(p.lat / S); if (!gc.has(c)) gc.set(c, []); gc.get(c).push(p); });
    const cellsAll = [...gc], doCells = cellsAll.slice(0, 40);
    cellsAll.slice(40).forEach(([, list]) => list.forEach(p => { out[p.k].sat = { pending: true }; }));
    for (let i = 0; i < doCells.length; i += 8) await Promise.all(doCells.slice(i, i + 8).map(async ([c, list]) => {
      const [cx, cy] = c.split(',').map(Number);
      try {
        const feats = await gistdaCell(env, cx, cy);
        list.forEach(p => { let inside = null, best = Infinity, near = 0, date = '';
          for (const f of feats) { if (f.d > date) date = f.d; if (!inside && inGeom(p.lat, p.lng, f.g)) inside = f;
            const d = inside === f ? 0 : geomDist(p.lat, p.lng, f.g); if (d < best) best = d; if (d <= 500) near++; }
          out[p.k].sat = { inside: !!inside, dM: isFinite(best) ? Math.round(best) : null, near, area: inside ? inside.a : 0, date: inside ? inside.d : date, period: '7days', n: feats.length }; });
      } catch (e) { list.forEach(p => { out[p.k].sat = { error: true }; }); }
    }));
  }
  return { ok: true, time: Date.now(), gistda: !!env.GISTDA_KEY, points: out };
}

const PROV_LL = {'กรุงเทพมหานคร':[13.756,100.502],'กระบี่':[8.086,98.906],'กาญจนบุรี':[14.023,99.533],'กาฬสินธุ์':[16.432,103.506],'กำแพงเพชร':[16.483,99.522],'ขอนแก่น':[16.441,102.836],'จันทบุรี':[12.611,102.104],'ฉะเชิงเทรา':[13.69,101.077],'ชลบุรี':[13.361,100.985],'ชัยนาท':[15.186,100.125],'ชัยภูมิ':[15.807,102.032],'ชุมพร':[10.493,99.18],'เชียงราย':[19.91,99.841],'เชียงใหม่':[18.788,98.985],'ตรัง':[7.558,99.611],'ตราด':[12.243,102.515],'ตาก':[16.884,99.126],'นครนายก':[14.206,101.213],'นครปฐม':[13.82,100.062],'นครพนม':[17.392,104.769],'นครราชสีมา':[14.979,102.098],'นครศรีธรรมราช':[8.432,99.963],'นครสวรรค์':[15.704,100.137],'นนทบุรี':[13.862,100.514],'นราธิวาส':[6.426,101.823],'น่าน':[18.783,100.779],'บึงกาฬ':[18.36,103.646],'บุรีรัมย์':[14.993,103.103],'ปทุมธานี':[14.02,100.525],'ประจวบคีรีขันธ์':[11.812,99.797],'ปราจีนบุรี':[14.05,101.372],'ปัตตานี':[6.869,101.25],'พระนครศรีอยุธยา':[14.353,100.568],'พะเยา':[19.166,99.902],'พังงา':[8.451,98.525],'พัทลุง':[7.617,100.078],'พิจิตร':[16.442,100.349],'พิษณุโลก':[16.821,100.265],'เพชรบุรี':[13.112,99.94],'เพชรบูรณ์':[16.419,101.16],'แพร่':[18.145,100.141],'ภูเก็ต':[7.89,98.398],'มหาสารคาม':[16.184,103.301],'มุกดาหาร':[16.545,104.723],'แม่ฮ่องสอน':[19.301,97.969],'ยโสธร':[15.794,104.145],'ยะลา':[6.541,101.281],'ร้อยเอ็ด':[16.053,103.652],'ระนอง':[9.966,98.635],'ระยอง':[12.682,101.278],'ราชบุรี':[13.536,99.817],'ลพบุรี':[14.8,100.653],'ลำปาง':[18.289,99.49],'ลำพูน':[18.574,99.008],'เลย':[17.486,101.722],'ศรีสะเกษ':[15.118,104.322],'สกลนคร':[17.155,104.148],'สงขลา':[7.189,100.595],'สตูล':[6.623,100.067],'สมุทรปราการ':[13.599,100.597],'สมุทรสงคราม':[13.409,100.002],'สมุทรสาคร':[13.547,100.274],'สระแก้ว':[13.824,102.065],'สระบุรี':[14.529,100.911],'สิงห์บุรี':[14.888,100.401],'สุโขทัย':[17.007,99.823],'สุพรรณบุรี':[14.474,100.117],'สุราษฎร์ธานี':[9.14,99.333],'สุรินทร์':[14.882,103.493],'หนองคาย':[17.878,102.742],'หนองบัวลำภู':[17.204,102.44],'อ่างทอง':[14.589,100.455],'อำนาจเจริญ':[15.866,104.626],'อุดรธานี':[17.415,102.787],'อุตรดิตถ์':[17.62,100.099],'อุทัยธานี':[15.383,100.025],'อุบลราชธานี':[15.244,104.847]};
const HILLY = new Set('เชียงราย เชียงใหม่ แม่ฮ่องสอน น่าน พะเยา แพร่ ลำปาง ลำพูน อุตรดิตถ์ ตาก สุโขทัย พิษณุโลก เพชรบูรณ์ เลย กาญจนบุรี ราชบุรี เพชรบุรี ประจวบคีรีขันธ์ ชุมพร ระนอง สุราษฎร์ธานี นครศรีธรรมราช กระบี่ พังงา ภูเก็ต ตรัง สตูล ยะลา นราธิวาส จันทบุรี ตราด นครนายก ปราจีนบุรี สระบุรี ชัยภูมิ กำแพงเพชร อุทัยธานี'.split(' '));
const HZ_TYPES = ['sinkhole', 'landslide', 'flashflood', 'quake', 'tsunami', 'fire', 'storm', 'hail', 'heavyrain', 'flood', 'other'];
async function hazardsData(env) {
  return cached('hazards-v2', 600, async () => {
    const out = { ok: true, time: Date.now(), quakes: [], fires: [], gdacs: [], weather: [], errors: [] };
    const get = (u, h = UA, ms = 15000) => fetch(u, { headers: h, signal: AbortSignal.timeout(ms) }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r; });
    const names = Object.keys(PROV_LL), d10 = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10), today = new Date().toISOString().slice(0, 10);
    const [usgs, tmdq, fire, gd, om] = await Promise.allSettled([
      get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson').then(r => r.json()),
      get(`https://data.tmd.go.th/api/DailySeismicEvent/v1/?${TMD_KEY}`).then(r => r.text()),
      env.GISTDA_KEY ? get('https://api-gateway.gistda.or.th/api/2.0/resources/features/viirs/1day?bbox=97.3,5.6,105.7,20.5&limit=1000', { 'API-Key': env.GISTDA_KEY, ...UA }, 20000).then(r => r.json()) : Promise.reject(new Error('no key')),
      get(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC;EQ;FL;VO;WF;DR&fromDate=${d10}&toDate=${today}&alertlevel=Green;Orange;Red`).then(r => r.json()),
      get(`https://api.open-meteo.com/v1/forecast?latitude=${names.map(n => PROV_LL[n][0]).join(',')}&longitude=${names.map(n => PROV_LL[n][1]).join(',')}&hourly=precipitation,weather_code,wind_gusts_10m&past_hours=24&forecast_hours=6&timezone=Asia%2FBangkok`).then(r => r.json()),
    ]);
    const inRegion = (lat, lng) => lat > -2 && lat < 28 && lng > 88 && lng < 112;
    if (usgs.status === 'fulfilled') out.quakes = (usgs.value.features || []).filter(f => inRegion(f.geometry.coordinates[1], f.geometry.coordinates[0])).map(f => ({ src: 'USGS',
      lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], depth: f.geometry.coordinates[2], mag: f.properties.mag, place: f.properties.place, time: f.properties.time, tsunami: !!f.properties.tsunami, url: f.properties.url }));
    else out.errors.push('usgs');
    if (tmdq.status === 'fulfilled') xmlAll(tmdq.value, 'DailyEarthquakes').forEach(x => { const q = { src: 'กรมอุตุฯ', place: xmlOne(x, 'OriginThai'), time: tmdTime(xmlOne(x, 'DateTimeThai')), mag: +xmlOne(x, 'Magnitude'), depth: +xmlOne(x, 'Depth'), lat: +xmlOne(x, 'Latitude'), lng: +xmlOne(x, 'Longitude'), tsunami: false };
      if (q.time && Date.now() - q.time < 7 * 864e5 && q.mag >= 2.5 && inRegion(q.lat, q.lng) && !out.quakes.some(u => Math.abs(u.time - q.time) < 120e3 && km(u.lat, u.lng, q.lat, q.lng) < 80)) out.quakes.push(q); });
    if (fire.status === 'fulfilled') out.fires = (fire.value.features || []).filter(f => f.properties?.ct_en === 'Thailand' || f.properties?.pv_tn).map(f => { const p = f.properties || {};
      return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], conf: p.confidence || '', frp: p.frp, time: (p.timestamp || 0) * 1000, province: p.pv_tn || '', amphoe: p.ap_tn || '', lu: p.lu_name || '' }; });
    else out.errors.push('fires');
    if (gd.status === 'fulfilled') out.gdacs = (gd.value.features || []).filter(f => f.geometry && inRegion(f.geometry.coordinates[1], f.geometry.coordinates[0])).map(f => { const p = f.properties || {};
      return { type: p.eventtype, level: p.alertlevel, name: p.name || p.eventname || '', lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], from: p.fromdate, to: p.todate, country: p.country || '', url: (p.url || {}).report || '' }; });
    else out.errors.push('gdacs');
    if (om.status === 'fulfilled') (Array.isArray(om.value) ? om.value : [om.value]).forEach((x, i) => { const h = x.hourly || {}, pr = h.precipitation || [], wc = h.weather_code || [], gu = h.wind_gusts_10m || [], n = names[i];
      const sum = a => Math.round(a.reduce((s, v) => s + (Number(v) || 0), 0) * 10) / 10, max = a => Math.max(0, ...a.map(v => Number(v) || 0));
      const past = pr.slice(0, 24), next = pr.slice(24), wNext = wc.slice(18), w = { province: n, lat: PROV_LL[n][0], lng: PROV_LL[n][1],
        rain24: sum(past), rain3: sum(pr.slice(21, 24)), next6: sum(next), maxHour: max(pr.slice(18)), gust: Math.round(max(gu.slice(18))),
        hail: wNext.some(c => c === 96 || c === 99), thunder: wNext.some(c => c >= 95) };
      w.heavy = w.maxHour >= 20 || w.rain24 >= 90 || w.next6 >= 50; w.storm = w.thunder || w.gust >= 60;
      const hill = HILLY.has(n), wet = Math.max(w.rain24, w.rain24 - w.rain3 + w.next6);
      w.slide = hill && wet >= 150 ? 'high' : hill && wet >= 90 ? 'mid' : '';
      if (w.heavy || w.storm || w.hail || w.slide || w.rain24 >= 35) out.weather.push(w); });
    else out.errors.push('weather');
    out.quakes.sort((a, b) => b.time - a.time);
    return out;
  });
}
async function hazardList(db, env) {
  const [base, rep] = await Promise.all([hazardsData(env).catch(() => ({ ok: true, quakes: [], fires: [], gdacs: [], weather: [], errors: ['hazards'] })),
    db.prepare('SELECT * FROM hazard_reports WHERE closedAt IS NULL AND expiresAt>? ORDER BY createdAt DESC LIMIT 200').bind(Date.now()).all()]);
  return { ...base, reports: rep.results.map(r => ({ id: r.id, type: r.type, lat: r.lat, lng: r.lng, radiusM: r.radiusM, note: r.note || '', level: r.level || 'warn', createdAt: r.createdAt, expiresAt: r.expiresAt })) };
}
async function saveHazard(db, b) {
  const h = b.hazard || {}, lat = num(h.lat, -90, 90), lng = num(h.lng, -180, 180), now = Date.now();
  if (lat == null || lng == null) return { ok: false, error: 'missing_location' };
  const id = 'H' + rand(5), hours = Math.min(720, Math.max(1, Number(h.hours) || 48));
  await db.prepare('INSERT INTO hazard_reports (id,type,lat,lng,radiusM,note,level,createdAt,expiresAt,by_) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(id, HZ_TYPES.includes(h.type) ? h.type : 'other', lat, lng, clampInt(h.radiusM, 0, 50000, 0) || null, clean(h.note, 300), ['info', 'warn', 'danger'].includes(h.level) ? h.level : 'warn', now, now + hours * 3600e3, clean(b.by, 60)).run();
  return { ok: true, id };
}
async function closeHazard(db, b) { const r = await db.prepare('UPDATE hazard_reports SET closedAt=? WHERE id=? AND closedAt IS NULL').bind(Date.now(), clean(b.id, 20)).run(); return r.meta.changes ? { ok: true } : { ok: false, error: 'not_found' }; }

const BC_LEVELS = ['info', 'warn', 'danger'], BC_SCOPES = ['all', 'province', 'district', 'circle'];
const bcOut = b => ({ id: b.id, level: b.level, title: b.title, body: b.body || '', link: b.link || '', scope: b.scope,
  provinces: String(b.provinces || '').split(',').filter(Boolean), districts: String(b.districts || '').split(',').filter(Boolean),
  lat: b.lat, lng: b.lng, radiusKm: b.radiusKm, createdAt: b.createdAt, expiresAt: b.expiresAt, cancelledAt: b.cancelledAt || null });
async function listBroadcasts(db, all) {
  const now = Date.now();
  const q = all ? db.prepare('SELECT * FROM broadcasts WHERE createdAt>? ORDER BY createdAt DESC LIMIT 200').bind(now - 30 * 864e5)
    : db.prepare('SELECT * FROM broadcasts WHERE cancelledAt IS NULL AND expiresAt>? ORDER BY createdAt DESC LIMIT 50').bind(now);
  const { results } = await q.all();
  return { ok: true, now, broadcasts: results.map(b => all ? { ...bcOut(b), by: b.by_ || '', warroom: b.warroom || '' } : bcOut(b)) };
}
async function saveBroadcast(db, b) {
  const x = b.broadcast || {}, now = Date.now();
  const level = BC_LEVELS.includes(x.level) ? x.level : 'info', scope = BC_SCOPES.includes(x.scope) ? x.scope : 'all';
  const title = clean(x.title, 120), body = clean(x.body, 1000), link = /^https:\/\/[^\s<>"']{4,300}$/.test(String(x.link || '')) ? String(x.link) : '';
  if (!title) return { ok: false, error: 'missing_title' };
  const list = (v, n) => (Array.isArray(v) ? v : String(v || '').split(/[,\n]/)).map(y => clean(y, 40).replace(/^(เขต|จังหวัด|จ\.)\s*/, '')).filter(Boolean).slice(0, n);
  const provinces = scope === 'province' ? list(x.provinces, 20).map(provName) : [], districts = scope === 'district' ? list(x.districts, 60) : [];
  const lat = scope === 'circle' ? num(x.lat, -90, 90) : null, lng = scope === 'circle' ? num(x.lng, -180, 180) : null, radiusKm = scope === 'circle' ? num(x.radiusKm, 0.1, 300) : null;
  if (scope === 'province' && !provinces.length || scope === 'district' && !districts.length || scope === 'circle' && (lat == null || lng == null || radiusKm == null)) return { ok: false, error: 'missing_area' };
  const hours = Math.min(168, Math.max(1, Number(x.hours) || 24)), id = 'B' + rand(5);
  await db.prepare('INSERT INTO broadcasts (id,level,title,body,link,scope,provinces,districts,lat,lng,radiusKm,createdAt,expiresAt,by_,warroom) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, level, title, body, link, scope, provinces.join(','), districts.join(','), lat, lng, radiusKm, now, now + hours * 3600e3, clean(b.by, 60), clean(x.warroom, 20)).run();
  await setMeta(db, 'bc_rev', String(now));
  return { ok: true, id };
}
async function cancelBroadcast(db, b) {
  const r = await db.prepare('UPDATE broadcasts SET cancelledAt=? WHERE id=? AND cancelledAt IS NULL').bind(Date.now(), clean(b.id, 20)).run();
  await setMeta(db, 'bc_rev', String(Date.now()));
  return r.meta.changes ? { ok: true } : { ok: false, error: 'not_found' };
}
async function viewId(token) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token + ':view')); return [...new Uint8Array(d)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(''); }
async function liveView(db, v) {
  v = String(v || '').toLowerCase();
  if (!/^[0-9a-f]{16}$/.test(v)) return { ok: false, error: 'bad_link' };
  const { results } = await db.prepare("SELECT name,status,token,vehicle,members FROM roster WHERE active=1 AND token IS NOT NULL AND token<>''").all();
  let t = null; for (const r of results) if (await viewId(r.token) === v) { t = r; break; }
  if (!t) return { ok: false, error: 'bad_link' };
  const live = await db.prepare('SELECT lat,lng,accuracy,updatedAt,speed,heading,battery FROM teams_live WHERE team=?').bind(t.name).first();
  const { results: pts } = await db.prepare('SELECT lat,lng,at FROM team_track WHERE team=? AND at>? ORDER BY at, n LIMIT 1500').bind(t.name, Date.now() - 6 * 3600e3).all();
  return { ok: true, team: t.name, status: t.status || '', vehicle: t.vehicle || '', live: live || null, track: pts, now: Date.now() };
}
const GMAPS_RE = /^https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.(?:com|co\.th)\/maps|maps\.google\.(?:com|co\.th))\/[^\s<>"']{0,300}$/i;
async function setTeamGmaps(db, team, link) {
  const m = String(link || '').match(/https:\/\/[^\s<>"']+/), url = m ? m[0] : '';
  if (url && !GMAPS_RE.test(url)) return { ok: false, error: 'not_gmaps' };
  const r = await db.prepare('UPDATE roster SET gmaps=?, updatedAt=? WHERE name=? AND active=1').bind(url, Date.now(), team).run();
  if (url) await chatSend(db, { team, from: 'team', text: 'แชร์ตำแหน่งสดผ่าน Google Maps: ' + url });
  return r.meta.changes ? { ok: true, gmaps: url } : { ok: false, error: 'not_in_roster' };
}

const WR_ROLES = ['lead', 'ops', 'dispatch', 'stock', 'comms', 'medic', 'staff'];
async function listWarrooms(db) {
  const { results: rooms } = await db.prepare('SELECT * FROM warrooms WHERE active=1 ORDER BY createdAt').all();
  const miss = rooms.filter(r => !r.token); if (miss.length) { miss.forEach(r => { r.token = rand(12); }); await db.batch(miss.map(r => db.prepare('UPDATE warrooms SET token=? WHERE id=?').bind(r.token, r.id))); }
  const { results: staff } = await db.prepare('SELECT * FROM warroom_staff WHERE active=1 ORDER BY wr, role, name').all();
  const { results: teams } = await db.prepare("SELECT name, warroom FROM roster WHERE active=1 AND warroom IS NOT NULL AND warroom<>''").all();
  return { ok: true, warrooms: rooms.map(({ token, ...r }) => ({ ...r, ...(WRC ? {} : { linkKey: token }), kind: r.kind || 'zone', province: r.province || '', districts: String(r.districts || '').split(',').map(x => x.trim()).filter(Boolean) })), staff, teams };
}
async function saveWarroom(db, b) {
  const w = b.warroom || {}, id = clean(w.id, 20).replace(/[^\w-]/g, '') || ('W' + rand(3)), now = Date.now();
  if (w.active === false) {
    await db.batch([db.prepare('UPDATE warrooms SET active=0, updatedAt=? WHERE id=?').bind(now, id), db.prepare("UPDATE roster SET warroom='' WHERE warroom=?").bind(id)]);
    return { ok: true, id };
  }
  const kind = w.kind === 'province' ? 'province' : 'zone', province = provName(clean(w.province, 40));
  if (kind === 'province' && !province) return { ok: false, error: 'missing_province' };
  if (kind === 'province' && await db.prepare("SELECT id FROM warrooms WHERE active=1 AND kind='province' AND province=? AND id<>?").bind(province, id).first()) return { ok: false, error: 'province_exists' };
  const name = clean(w.name, 60) || (kind === 'province' ? 'ศูนย์ประสานงานจังหวัด' + province : '');
  if (!name) return { ok: false, error: 'missing_name' };
  const lat = num(w.lat, -90, 90), lng = num(w.lng, -180, 180);
  const districts = (Array.isArray(w.districts) ? w.districts : String(w.districts || '').split(/[,\n]/)).map(x => clean(x, 40).replace(/^เขต\s*/, '')).filter(Boolean).slice(0, 60).join(',');
  await db.prepare(`INSERT INTO warrooms (id,kind,province,name,color,lat,lng,radius,districts,address,phone,lead,note,active,createdAt,updatedAt,by_,token) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,province=excluded.province,name=excluded.name,color=excluded.color,lat=excluded.lat,lng=excluded.lng,radius=excluded.radius,districts=excluded.districts,address=excluded.address,phone=excluded.phone,lead=excluded.lead,note=excluded.note,active=1,updatedAt=excluded.updatedAt,by_=excluded.by_`)
    .bind(id, kind, province, name, /^#[0-9a-f]{6}$/i.test(w.color || '') ? w.color : '#2D45C8', lat, lng, clampInt(w.radius, 0, 200000, 0) || null, districts, clean(w.address, 200),
      clean(w.phone, 20).replace(/[^\d+\-\s]/g, ''), clean(w.lead, 60), clean(w.note, 500), now, now, clean(b.by, 60), rand(12)).run();
  return { ok: true, id };
}
async function saveWarroomStaff(db, b) {
  const m = b.staff || {}, id = clean(m.id, 20).replace(/[^\w-]/g, '') || ('P' + rand(4));
  if (m.active === false) { await db.prepare('UPDATE warroom_staff SET active=0, updatedAt=? WHERE id=?').bind(Date.now(), id).run(); return { ok: true, id }; }
  const wr = clean(m.wr, 20), name = clean(m.name, 60);
  if (!wr || !name) return { ok: false, error: 'missing' };
  if (!await db.prepare('SELECT id FROM warrooms WHERE id=? AND active=1').bind(wr).first()) return { ok: false, error: 'no_warroom' };
  await db.prepare(`INSERT INTO warroom_staff (id,wr,name,role,phone,shift,note,active,updatedAt) VALUES (?,?,?,?,?,?,?,1,?)
    ON CONFLICT(id) DO UPDATE SET wr=excluded.wr,name=excluded.name,role=excluded.role,phone=excluded.phone,shift=excluded.shift,note=excluded.note,active=1,updatedAt=excluded.updatedAt`)
    .bind(id, wr, name, WR_ROLES.includes(m.role) ? m.role : 'staff', clean(m.phone, 20).replace(/[^\d+\-\s]/g, ''), clean(m.shift, 40), clean(m.note, 200), Date.now()).run();
  return { ok: true, id };
}
const RQ = new AsyncLocalStorage();
Object.defineProperty(globalThis, 'WRC', { configurable: true, get() { const s = RQ.getStore(); return s ? s.wrc : null; }, set(v) { const s = RQ.getStore(); if (s) s.wrc = v; } });
Object.defineProperty(globalThis, 'CTX', { configurable: true, get() { const s = RQ.getStore(); return s ? s.ctx : null; }, set(v) { const s = RQ.getStore(); if (s) s.ctx = v; } });
const WR_GET_OK = new Set(['rev', 'chat_rev', 'chat_threads', 'helpme_cases', 'list', 'news', 'roster', 'stock', 'teams', 'warrooms', 'wr_users', 'apps_list', 'chat', 'team_track',
  'warroom_public', 'warrooms_public', 'cctv', 'water', 'dams', 'rallies', 'live_stream', 'route_list', 'road_q', 'photo_index', 'case_photos', 'case_photo', 'ptt_auth', 'ptt_list', 'ptt_audio', 'board_list', 'board_img', 'gistda_status', 'outreach', 'sheet_places', 'covered', 'broadcasts', 'places', 'hazards', 'env_check']);
const WR_POST_OK = new Set(['route_set', 'route_clear', 'ptt_send', 'board_save', 'board_move', 'board_delete', 'board_img_add', 'board_img_del', 'rally_save', 'rally_close', 'silent_ack', 'update', 'chat_send', 'chat_read', 'sos_ack', 'hq_call', 'roster_save', 'team_link', 'team_warroom', 'warroom_save', 'warroom_staff', 'stock_item', 'stock_move',
  'wr_user_save', 'wr_logout', 'app_decide', 'feedback_save', 'ai_chat', 'env_check']);
const caseProv = c => { if (c.province) return provName(c.province); const a = String(c.address || ''), m = a.match(/(?:จ\.|จังหวัด)\s*([ก-๙]{3,})/);
  if (m) return provName(m[1]); return /กรุงเทพ|กทม/.test(a) ? 'กรุงเทพมหานคร' : ''; };
const normDist = d => String(d || '').replace(/^(เขต|อำเภอ)\s*/, '').replace(/\s+/g, '');
const kmDist = (a, b, c, d) => { const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
async function wrScope(db) {
  const st = RQ.getStore(); if (st && st.scope) return st.scope;
  const r = WRC && await db.prepare('SELECT * FROM warrooms WHERE id=? AND active=1').bind(WRC.id).first();
  let sc = { none: true, zones: new Set(), teams: new Set() };
  if (r) {
    const d = String(r.districts || '').split(',').map(x => x.trim()).filter(Boolean);
    const zones = new Set([r.id]);
    if (r.kind === 'province') { const { results } = await db.prepare('SELECT id FROM warrooms WHERE active=1 AND province=?').bind(r.province || '').all(); results.forEach(z => zones.add(z.id)); }
    const { results: tm } = await db.prepare(`SELECT name FROM roster WHERE active=1 AND warroom IN (${[...zones].map(() => '?').join(',')})`).bind(...zones).all();
    sc = { r, all: d.includes('*'), d: d.map(normDist), zones, teams: new Set(tm.map(t => t.name)) };
  }
  if (st) st.scope = sc; return sc;
}
function inScope(c, sc) {
  if (!sc || sc.none) return false; if (sc.all) return true;
  const v = String(c.volunteer || '').replace(/^'/, '').trim(); if (v && sc.teams.has(v)) return true;
  const r = sc.r, pv = caseProv(c), lat = Number(c.lat), lng = Number(c.lng), pin = isFinite(lat) && isFinite(lng) && lat !== 0;
  if (r.kind === 'province') { if (pv && pv === r.province) return true; const ctr = r.lat != null ? [r.lat, r.lng] : PROV_LL[r.province]; return !!(pin && ctr && kmDist(ctr[0], ctr[1], lat, lng) <= 20); }
  if (r.province && pv && pv !== r.province) return false;
  if (sc.d.length && c.district && sc.d.includes(normDist(c.district))) return true;
  return !!(r.radius && r.lat != null && pin && kmDist(r.lat, r.lng, lat, lng) * 1000 <= r.radius);
}
async function wrGet(env, db, p) {
  const sc = await wrScope(db);
  switch (p.action) {
    case 'list': { const { results } = await db.prepare("SELECT * FROM cases WHERE updatedAt>? AND COALESCE(src,'')<>'helpme'").bind(Number(p.since) || 0).all();
      return { ok: true, cases: results.filter(c => inScope(c, sc)).map(r => outCase(r, true)), volunteer: true }; }
    case 'helpme_cases': { const r = await helpmeCases(env, db); if (r && r.cases) r.cases = r.cases.filter(c => inScope(c, sc)); return r; }
    case 'roster': { const r = await listRoster(db); r.roster = r.roster.filter(t => sc.teams.has(t.name)); r.live = (r.live || []).filter(l => sc.teams.has(l.team)); return r; }
    case 'teams': return { ok: true, teams: (await readTeams(db)).filter(l => sc.teams.has(l.team)) };
    case 'chat': case 'team_track': return sc.teams.has(clean(p.team, MAX.volunteer)) ? null : { ok: false, error: 'not_in_room' };
    case 'chat_threads': { const r = await chatThreads(db); r.threads = r.threads.filter(t => sc.teams.has(t.team));
      if (r.alerts) r.alerts = { sos: (r.alerts.sos || []).filter(x => sc.teams.has(x.name)), calls: (r.alerts.calls || []).filter(x => sc.teams.has(x.team)), silent: (r.alerts.silent || []).filter(x => sc.teams.has(x.name)) }; return r; }
    case 'stock': { const r = await listStock(db); r.items = r.items.filter(i => !i.warroom || sc.zones.has(i.warroom)); const ids = new Set(r.items.map(i => i.id)); r.log = (r.log || []).filter(l => ids.has(l.itemId)); return r; }
  }
  return null;
}
async function wrPostCheck(db, b) {
  const sc = await wrScope(db); if (sc.none) return 'no_room';
  const teamOk = async name => sc.teams.has(clean(name, MAX.volunteer));
  switch (b.action) {
    case 'update': { const c = await db.prepare('SELECT * FROM cases WHERE id=?').bind(String(b.id)).first(); return c && inScope(c, sc) ? '' : 'not_in_room'; }
    case 'chat_send': case 'chat_read': case 'hq_call': case 'silent_ack': return await teamOk(b.team) ? '' : 'not_in_room';
    case 'rally_save': if (b.all === true) return ''; for (const t of (Array.isArray(b.teams) ? b.teams : [])) if (!await teamOk(t)) return 'not_in_room'; return '';
    case 'sos_ack': { const t = await db.prepare('SELECT warroom FROM roster WHERE id=?').bind(clean(b.id, 20)).first(); return t && sc.zones.has(t.warroom) ? '' : 'not_in_room'; }
    case 'team_link': { const t = await db.prepare('SELECT warroom FROM roster WHERE id=? OR name=?').bind(clean(b.id, 20), clean(b.team, MAX.volunteer)).first(); return t && sc.zones.has(t.warroom) ? '' : 'not_in_room'; }
    case 'roster_save': { const id = clean((b.team || {}).id, 20); if (!id) return ''; const t = await db.prepare('SELECT warroom FROM roster WHERE id=?').bind(id).first(); return !t || sc.zones.has(t.warroom) ? '' : 'not_in_room'; }
    case 'team_warroom': { const t = await db.prepare('SELECT warroom FROM roster WHERE name=? AND active=1').bind(clean(b.team, MAX.volunteer)).first(); const to = clean(b.warroom, 20);
      return t && (!t.warroom || sc.zones.has(t.warroom)) && (!to || sc.zones.has(to)) ? '' : 'not_in_room'; }
    case 'warroom_staff': { const m = b.staff || {}; if (m.wr && !sc.zones.has(clean(m.wr, 20))) return 'not_in_room';
      const id = clean(m.id, 20); if (id) { const o = await db.prepare('SELECT wr FROM warroom_staff WHERE id=?').bind(id).first(); if (o && !sc.zones.has(o.wr)) return 'not_in_room'; } return ''; }
    case 'stock_item': { const id = String((b.item || {}).id || ''); const o = id && await db.prepare('SELECT warroom FROM stock WHERE id=?').bind(id).first();
      if (o && !sc.zones.has(o.warroom)) return 'not_in_room'; b.item = { ...(b.item || {}), warroom: o ? o.warroom : WRC.id }; return ''; }
    case 'stock_move': { const o = await db.prepare('SELECT warroom FROM stock WHERE id=?').bind(String(b.itemId)).first(); return o && sc.zones.has(o.warroom) ? '' : 'not_in_room'; }
  }
  return '';
}
const WR_DENY = ['warroom_link', 'backup_now', 'hq_phone', 'import_cases', 'lead_settings', 'discord_save', 'discord_test', 'sms_cfg', 'feedback_done'];
const AUDIT_SKIP = new Set(['road_q', 'case_photo_add', 'ticket', 'staff_login', 'staff_logout', 'ptt_send', 'kb_order', 'board_img_add', 'intel_refresh', 'audit_undo', 'ping', 'team_ping', 'chat_read', 'ai_chat', 'env_check', 'track', 'call_start', 'call_send', 'call_end', 'call_poll', 'call_join', 'call_answer']);
const AUDIT_TH = { staff_save: 'บันทึกบัญชีเจ้าหน้าที่', route_set: 'ส่งเส้นทางแนะนำให้ทีม', route_clear: 'ยกเลิกเส้นทางแนะนำ', team_profile: 'ทีมแก้โปรไฟล์', board_save: 'บอร์ดงาน: บันทึกการ์ด', board_move: 'บอร์ดงาน: ย้ายการ์ด', board_delete: 'บอร์ดงาน: ลบการ์ด', board_img_del: 'บอร์ดงาน: ลบรูป', rally_save: 'เรียกรวมพล', rally_close: 'ปิดรวมพล', rally_resp: 'ทีมตอบรวมพล', silent_ack: 'รับทราบทีมเงียบ', update: 'แก้เคส', create: 'แจ้งเคสใหม่', place: 'บันทึกสถานที่', import_cases: 'นำเข้าเคส', covered_add: 'เพิ่มพื้นที่มอบแล้ว', bag_pack: 'แพ็คถุงยังชีพ',
  lead_add: 'เพิ่มเคสจากโซเชียล', lead_decide: 'คัดเคสจากโซเชียล', lead_settings: 'ตั้งค่าคัดเคสโซเชียล', lead_pull: 'ดึงเคสโซเชียล',
  roster_save: 'บันทึกทีม', team_link: 'สร้างลิงก์ทีมใหม่', team_warroom: 'ย้ายทีมไป War Room', team_gmaps: 'ตั้งลิงก์ Google Maps ทีม',
  team_status: 'ทีมเปลี่ยนสถานะ', team_case: 'ทีมอัปเดตเคส', team_sos: 'ทีมส่ง/ยกเลิก SOS', sos_ack: 'รับทราบ SOS', hq_call: 'ศูนย์โทรหาทีม',
  stock_item: 'แก้รายการสต็อก', stock_move: 'รับ/จ่ายสต็อก', chat_send: 'ส่งแชท', broadcast_save: 'ส่งประกาศ', broadcast_cancel: 'ยกเลิกประกาศ',
  warroom_save: 'บันทึก War Room', warroom_link: 'สร้างลิงก์ War Room ใหม่', warroom_staff: 'แก้ทีมงาน War Room', wr_user_save: 'แก้บัญชีผู้ใช้ War Room',
  wr_login: 'เข้าสู่ระบบ War Room', wr_logout: 'ออกจากระบบ War Room', app_apply: 'สมัครใช้งาน', app_login: 'ผู้สมัครเข้าสู่ระบบ', app_decide: 'อนุมัติ/ปฏิเสธใบสมัคร',
  zone_save: 'บันทึกโซน', hazard_save: 'บันทึกจุดอันตราย', hazard_close: 'ปิดจุดอันตราย', hq_phone: 'ตั้งเบอร์ศูนย์', sms_cfg: 'ตั้งค่า SMS',
  discord_save: 'ตั้งค่า Discord', discord_test: 'ทดสอบ Discord', feedback_save: 'ส่งความคิดเห็น', feedback_done: 'ปิดความคิดเห็น', backup_now: 'สำรองข้อมูล' };
const AUDIT_CAT = a => /^(update|create|place|import_cases|covered_add|lead_)/.test(a) ? 'case' : /^(roster_save|team_|sos_ack|hq_call)/.test(a) ? 'team' : /^(stock_|bag_pack)/.test(a) ? 'stock'
  : /^(warroom_|wr_|app_)/.test(a) ? 'warroom' : /^(chat_send|broadcast_)/.test(a) ? 'chat' : 'settings';
const AUDIT_SECRET = /^(key|k|tk|password|pass|pw|newPassword|oldPassword|hash|salt|token|secret|webhook|url)$/i;
function auditClean(v, d = 0) {
  if (v == null || d > 3) return v == null ? v : '…';
  if (Array.isArray(v)) return v.slice(0, 20).map(x => auditClean(x, d + 1));
  if (typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) { if (k === 'action') continue; o[k] = AUDIT_SECRET.test(k) ? (x ? '•••' : x) : auditClean(x, d + 1); } return o; }
  return typeof v === 'string' && v.length > 300 ? v.slice(0, 300) + '…' : v;
}
async function auditLog(env, st, res) {
  let j = null; try { j = await res.json(); } catch (e) {}
  if (!j || !j.ok || j.skipped) return;
  const b = st.body, a = String(b.action || ''), db = env.DB;
  if (a === 'sms_cfg' && !b.renew) return;
  let actor = '', role = '';
  if (st.wrc) { role = 'warroom'; actor = `War Room ${st.wrc.name || st.wrc.id}` + (st.wrc.user ? ` · ${st.wrc.user.name || st.wrc.user.username}` : ' · ลิงก์หัวหน้า'); }
  else if (b.tk || (['team_status', 'team_case', 'team_sos', 'team_ping'].includes(a) && !(st.k0 && isVol(env, st.k0)))) { role = 'team'; let n = b.team || ''; if (b.tk) { const r = await db.prepare('SELECT name FROM roster WHERE token=?').bind(String(b.tk).toLowerCase()).first().catch(() => null); n = r ? r.name : n; } actor = 'ทีม ' + (n || '?') + (b.name ? ` · ${b.name}` : ''); }
  else if (st.k0 && isVol(env, st.k0)) { role = 'central'; actor = 'CENTRAL' + (st.staff ? ` · ${st.staff.name} (@${st.staff.username})` : b.by ? ` · ${b.by} (รหัสกลาง)` : ' · รหัสกลาง'); }
  else if (a === 'wr_login') { role = 'warroom'; actor = `War Room ${b.warroom || ''} · ${b.username || ''}`; }
  else { role = 'public'; actor = a === 'wr_login' || a === 'app_login' ? 'ผู้ใช้ ' + (b.username || '') : a === 'app_apply' ? 'ผู้สมัคร ' + (b.username || b.name || '') : 'ผู้ใช้ทั่วไป'; }
  const tg = b.id || (b.team && typeof b.team === 'object' ? b.team.name || b.team.id : b.team) || (b.item && b.item.name) || (b.warroom && typeof b.warroom === 'object' ? b.warroom.name || b.warroom.id : b.warroom) || (b.user && (b.user.username || b.user.name)) || (b.staff && b.staff.name) || b.username || j.id || '';
  const bits = [];
  if (a === 'update') { if (b.status && !b.bagsOnly && !b.metaOnly) bits.push('สถานะ → ' + (b.helped === true ? 'ช่วยเหลือแล้ว' : b.helped === false ? 'ทีมกำลังไป' : { open: 'รอความช่วยเหลือ', going: 'มอบให้ทีม', done: 'ปิดเคส' }[b.status] || b.status)); if (b.volunteer && b.status === 'going' && !b.metaOnly && !b.bagsOnly) bits.push('ทีม ' + b.volunteer);
    if (b.hqNote !== undefined && b.hqNote !== null) bits.push('หมายเหตุ: ' + String(b.hqNote).slice(0, 80)); if (b.bags !== undefined && b.bags !== null) bits.push('ถุง ' + (b.bags === '' ? 'ล้าง' : b.bags)); if (b.cctv !== undefined) bits.push('CCTV ' + (b.cctv || 'ล้าง')); if (b.dupOf !== undefined) bits.push(b.dupOf ? 'ซ้ำกับ #' + b.dupOf : 'ยกเลิกเคสซ้ำ'); if (b.people !== undefined) bits.push('จำนวนคน ' + b.people); if (b.households !== undefined) bits.push('ครัวเรือน ' + (b.households === '' ? 'ล้าง' : b.households)); if (b.sevSet !== undefined) bits.push(b.sevSet === '' || b.sevSet === null ? 'ระดับ → ใช้ของระบบ' : 'ระดับ → ' + ({ 1: 'ทั่วไป', 2: 'เร่งด่วน', 3: 'วิกฤต' }[b.sevSet] || b.sevSet)); }
  else if (a === 'team_case') bits.push(b.step === 'done' ? 'แจ้งช่วยเหลือแล้ว' : b.step === 'arrived' ? 'ถึงจุดแล้ว' : b.step || '');
  else if (a === 'team_status') bits.push('→ ' + b.status);
  else if (a === 'stock_move') bits.push(`${b.type === 'out' ? 'จ่าย' : b.type === 'in' ? 'รับ' : b.type || ''} ${b.qty || ''}`.trim());
  else if (a === 'chat_send') bits.push(String(b.text || '').slice(0, 80));
  else if (a === 'app_decide') bits.push(b.approve ? 'อนุมัติ' : 'ปฏิเสธ');
  else if (b.note) bits.push(String(b.note).slice(0, 80));
  const summary = [AUDIT_TH[a] || a, tg ? (a === 'update' || a === 'team_case' ? '#' + tg : String(tg)) : '', bits.filter(Boolean).join(' · ')].filter(Boolean).join(' · ');
  let undo = null;
  if (st.before && st.after !== undefined) { const u = st.before, key = st.afterKey, after = st.after;
    if (key) {
      const cols = [...new Set([...Object.keys(u.row || {}), ...Object.keys(after || {})])].filter(c => !UNDO_IGNORE.has(c) && JSON.stringify((u.row || {})[c] ?? null) !== JSON.stringify((after || {})[c] ?? null));
      if (cols.length) undo = { t: u.t, pk: u.pk, key: String(key), before: u.row, after, cols }; } }
  await db.prepare('INSERT INTO audit (at,action,cat,role,actor,target,summary,data,ip,undo) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(Date.now(), a, AUDIT_CAT(a), role, clean(actor, 120), clean(String(tg), 120), clean(summary, 400), JSON.stringify(auditClean(b)).slice(0, 3000), clean(st.ip, 60), undo ? JSON.stringify(undo) : null).run();
  if (Math.random() < 0.01) await db.prepare('DELETE FROM audit WHERE at<?').bind(Date.now() - 180 * 864e5).run();
}
const UNDO_SPEC = {
  update: { t: 'cases', k: b => b.id }, team_case: { t: 'cases', k: b => b.id },
  roster_save: { t: 'roster', k: b => (b.team || {}).id, kr: j => j.id }, sos_ack: { t: 'roster', k: b => b.id },
  team_warroom: { t: 'roster', byName: true, k: b => b.team },
  stock_item: { t: 'stock', k: b => (b.item || {}).id, kr: j => j.id }, stock_move: { t: 'stock', k: b => b.itemId },
  warroom_save: { t: 'warrooms', k: b => (b.warroom || {}).id, kr: j => j.id }, warroom_staff: { t: 'warroom_staff', k: b => (b.staff || {}).id, kr: j => j.id },
  hq_phone: { t: 'meta', pk: 'k', k: () => 'hq_phone' },
};
const UNDO_IGNORE = new Set(['updatedAt', 'localAt']);
async function undoAfter(env, st, res) {
  let j = null; try { j = await res.json(); } catch (e) {}
  if (!j || !j.ok) return;
  const u = st.before, sp = UNDO_SPEC[st.body.action], key = u.key || (sp.kr ? sp.kr(j) : '');
  st.afterKey = key ? String(key) : '';
  st.after = key ? await env.DB.prepare(`SELECT * FROM ${u.t} WHERE ${u.pk}=?`).bind(String(key)).first() : null;
}
async function undoSnap(db, b) {
  const sp = UNDO_SPEC[b.action], pk = sp.pk || 'id'; let key = clean(sp.k(b) == null ? '' : String(sp.k(b)), 60);
  if (sp.byName && key) { const r = await db.prepare(`SELECT id FROM ${sp.t} WHERE name=? AND active=1`).bind(key).first(); key = r ? r.id : ''; }
  const row = key ? await db.prepare(`SELECT * FROM ${sp.t} WHERE ${pk}=?`).bind(key).first() : null;
  return { t: sp.t, pk, key: row ? key : (sp.kr ? '' : key), row: row || null };
}
async function auditUndo(db, b) {
  const a = await db.prepare('SELECT * FROM audit WHERE id=?').bind(clampInt(b.id, 0, 1e12, 0)).first();
  if (!a || !a.undo) return { ok: false, error: 'cannot_undo' };
  if (a.undone) return { ok: false, error: 'already_undone' };
  const u = JSON.parse(a.undo), cur = await db.prepare(`SELECT * FROM ${u.t} WHERE ${u.pk}=?`).bind(u.key).first();
  const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
  const isStock = u.t === 'stock' && u.before && u.after && u.cols.includes('qty');
  const changed = u.cols.filter(c => !(isStock && (c === 'qty' || c === 'updatedAt')) && !same((cur || {})[c], (u.after || {})[c]));
  if (changed.length && !b.force) return { ok: false, error: 'changed_since', cols: changed };
  const now = Date.now(), cols0 = u.cols.filter(c => c !== u.pk);
  if (!u.before) {
    if (cur && 'active' in cur) await db.prepare(`UPDATE ${u.t} SET active=0 WHERE ${u.pk}=?`).bind(u.key).run();
    else await db.prepare(`DELETE FROM ${u.t} WHERE ${u.pk}=?`).bind(u.key).run();
  } else if (!cur) {
    const ks = Object.keys(u.before); await db.prepare(`INSERT INTO ${u.t} (${ks.join(',')}) VALUES (${ks.map(() => '?').join(',')})`).bind(...ks.map(k => u.before[k])).run();
  } else if (isStock) {
    const delta = (Number(u.before.qty) || 0) - (Number(u.after.qty) || 0), nq = (Number(cur.qty) || 0) + delta;
    if (nq < 0) return { ok: false, error: 'not_enough', qty: cur.qty };
    const rest = cols0.filter(c => c !== 'qty' && c !== 'updatedAt'), sets = ['qty=?', 'updatedAt=?', ...rest.map(c => `${c}=?`)], vals = [nq, now, ...rest.map(c => u.before[c] ?? null)];
    const w = await db.prepare(`UPDATE stock SET ${sets.join(',')} WHERE id=? AND qty=?`).bind(...vals, u.key, cur.qty).run();
    if (!w.meta.changes) return { ok: false, error: 'conflict_retry' };
    await db.prepare("UPDATE stock_log SET caseId='', note=COALESCE(note,'') || ' (ย้อนกลับแล้ว)' WHERE n=(SELECT n FROM stock_log WHERE itemId=? AND after=? AND type IN ('in','out','set') ORDER BY n DESC LIMIT 1)").bind(u.key, u.after.qty).run();
    u.before.qty = nq;
  } else if (cols0.length) {
    const sets = cols0.map(c => `${c}=?`), vals = cols0.map(c => u.before[c] ?? null);
    if ('updatedAt' in cur) { sets.push('updatedAt=?'); vals.push(now); }
    if (u.t === 'cases') { sets.push('localAt=?'); vals.push(now); }
    await db.prepare(`UPDATE ${u.t} SET ${sets.join(',')} WHERE ${u.pk}=?`).bind(...vals, u.key).run();
  }
  if (u.t === 'stock' && u.before && cur && u.before.qty !== cur.qty)
    await db.prepare('INSERT INTO stock_log (time,itemId,item,type,delta,after,note,caseId,by_,team) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(now, u.key, cur.name, 'undo', (u.before.qty || 0) - (cur.qty || 0), u.before.qty, 'ย้อนกลับการแก้ไข', '', clean(b.by, 60), '').run();
  await db.prepare('UPDATE audit SET undone=? WHERE id=?').bind(now, a.id).run();
  await db.prepare('INSERT INTO audit (at,action,cat,role,actor,target,summary,data,ip) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(now, 'audit_undo', a.cat, 'central', clean('CENTRAL' + (b.by ? ' · ' + b.by : ''), 120), a.target, clean('ย้อนกลับ: ' + a.summary, 400), JSON.stringify({ id: a.id, force: !!b.force }), '').run();
  await bumpRev(db);
  return { ok: true };
}
async function auditList(db, p) {
  const w = [], v = [], lim = clampInt(p.limit, 1, 200, 50);
  if (p.cat && /^(case|team|stock|warroom|chat|settings)$/.test(p.cat)) { w.push('cat=?'); v.push(p.cat); }
  if (p.role && /^(central|warroom|team|public)$/.test(p.role)) { w.push('role=?'); v.push(p.role); }
  if (p.before) { w.push('id<?'); v.push(clampInt(p.before, 0, 1e12, 0)); }
  if (p.q) { const q = '%' + clean(p.q, 60).replace(/[%_]/g, '') + '%'; w.push('(summary LIKE ? OR actor LIKE ? OR target LIKE ?)'); v.push(q, q, q); }
  const { results } = await db.prepare(`SELECT id,at,action,cat,role,actor,target,summary,data,(undo IS NOT NULL) AS canUndo,undone FROM audit${w.length ? ' WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`).bind(...v, lim).all();
  return { ok: true, items: results, more: results.length === lim };
}
async function wrAuth(db, key) {
  const k = String(key || '');
  if (/^wr_[a-z0-9]{16,40}$/.test(k)) { const r = await db.prepare('SELECT id,name FROM warrooms WHERE active=1 AND token=?').bind(k.slice(3)).first(); return r ? { ...r, role: 'lead', via: 'link' } : null; }
  if (/^wru_[a-f0-9]{48}$/.test(k)) {
    const s = await db.prepare('SELECT s.userId,s.warroom,s.expires,u.username,u.name AS uname,u.role,u.active,w.name FROM wr_sessions s JOIN wr_users u ON u.id=s.userId JOIN warrooms w ON w.id=s.warroom WHERE s.token=? AND w.active=1').bind(k.slice(4)).first();
    if (!s || !s.active || s.expires < Date.now()) return null;
    return { id: s.warroom, name: s.name, role: s.role || 'staff', via: 'user', user: { id: s.userId, username: s.username, name: s.uname || '' } };
  }
  return null;
}
const APP_KIND = ['warroom', 'volunteer'];
const appClean = d => { const o = {}; for (const [k, v] of Object.entries(d || {}).slice(0, 60)) { const kk = String(k).replace(/[^\w]/g, '').slice(0, 30); if (!kk) continue;
  o[kk] = Array.isArray(v) ? v.slice(0, 30).map(x => clean(x, 60)) : typeof v === 'number' ? v : typeof v === 'boolean' ? v : clean(v, 500); } return o; };
async function appApply(db, b, ip) {
  const kind = APP_KIND.includes(b.kind) ? b.kind : '', d = appClean(b.data), un = WR_USER(b.username), pw = String(b.password || '');
  if (!UN_OK(b.username)) return { ok: false, error: 'bad_username' };
  if (!kind) return { ok: false, error: 'bad_kind' };
  const name = clean(kind === 'warroom' ? d.orgName : d.fullName, 80), phone = clean(d.phone, 20).replace(/[^\d+\-\s]/g, '');
  if (!name || phone.replace(/\D/g, '').length < 9) return { ok: false, error: 'missing' };
  if (!un || un.length < 3) return { ok: false, error: 'bad_username' };
  if (pw.length < 6) return { ok: false, error: 'short_password' };
  const now = Date.now(), recent = await db.prepare('SELECT COUNT(*) n FROM applications WHERE ip=? AND createdAt>?').bind(ip, now - 3600e3).first();
  if (recent && recent.n >= 5) return { ok: false, error: 'too_many' };
  if (await db.prepare('SELECT id FROM applications WHERE kind=? AND username=?').bind(kind, un).first()) return { ok: false, error: 'username_taken' };
  const id = 'A' + rand(5), salt = rand(8);
  await db.prepare('INSERT INTO applications (id,kind,status,name,phone,province,wrPref,username,salt,hash,data,ip,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, kind, 'pending', name, phone, provName(clean(d.province, 40)) || clean(d.province, 40), clean(d.warroom, 20), un, salt, await pwHash(pw, salt), JSON.stringify(d), ip, now).run();
  await bumpRev(db);
  return { ok: true, id, status: 'pending' };
}
async function appLogin(db, b) {
  const kind = APP_KIND.includes(b.kind) ? b.kind : '', un = WR_USER(b.username), pw = String(b.password || ''), now = Date.now();
  const a = kind && un && await db.prepare('SELECT * FROM applications WHERE kind=? AND username=?').bind(kind, un).first();
  if (!a) return { ok: false, error: 'bad_login' };
  if (a.lockUntil && a.lockUntil > now) return { ok: false, error: 'locked' };
  if (await pwHash(pw, a.salt) !== a.hash) { const f = (a.fails || 0) + 1; await db.prepare('UPDATE applications SET fails=?, lockUntil=? WHERE id=?').bind(f >= 5 ? 0 : f, f >= 5 ? now + 10 * 60e3 : null, a.id).run(); return { ok: false, error: f >= 5 ? 'locked' : 'bad_login' }; }
  await db.prepare('UPDATE applications SET fails=0, lockUntil=NULL WHERE id=?').bind(a.id).run();
  const res = J0(a.result), out = { ok: true, kind, status: a.status, name: a.name, note: a.note || '' };
  if (a.status !== 'approved') return out;
  if (kind === 'warroom' && res.warroom) { const r = await wrLogin(db, { warroom: res.warroom, username: un, password: pw }); return r.ok ? { ...out, ...r } : { ...out, error: r.error }; }
  if (kind === 'volunteer' && res.team) { const t = await db.prepare('SELECT token,name,warroom FROM roster WHERE id=? AND active=1').bind(res.team).first(); if (t) return { ...out, team: { name: t.name, link: '/team/?id=' + t.token } }; }
  return out;
}
const J0 = v => { try { return v ? JSON.parse(v) : {}; } catch (e) { return {}; } };
async function appsList(db) {
  if (WRC && WRC.role !== 'lead') return { ok: false, error: 'lead_only' };
  const q = WRC ? db.prepare("SELECT * FROM applications WHERE kind='volunteer' AND wrPref=? ORDER BY status='pending' DESC, createdAt DESC LIMIT 200").bind(WRC.id)
    : db.prepare("SELECT * FROM applications ORDER BY status='pending' DESC, createdAt DESC LIMIT 300");
  const { results } = await q.all();
  return { ok: true, apps: results.map(a => ({ id: a.id, kind: a.kind, status: a.status, name: a.name, phone: a.phone, province: a.province, wrPref: a.wrPref || '', username: a.username, data: J0(a.data), result: J0(a.result), createdAt: a.createdAt, decidedAt: a.decidedAt, decidedBy: a.decidedBy || '', note: a.note || '' })) };
}
async function appDecide(db, b) {
  const a = await db.prepare('SELECT * FROM applications WHERE id=?').bind(clean(b.id, 20)).first();
  if (!a) return { ok: false, error: 'not_found' };
  if (WRC && (WRC.role !== 'lead' || a.kind !== 'volunteer' || a.wrPref !== WRC.id)) return { ok: false, error: 'lead_only' };
  if (a.status === 'approved' && b.approve) return { ok: false, error: 'already' };
  const now = Date.now(), by = clean(b.by || (WRC && WRC.user ? WRC.user.username : WRC ? WRC.name : 'CENTRAL'), 60), d = J0(a.data);
  if (!b.approve) { await db.prepare("UPDATE applications SET status='rejected', decidedAt=?, decidedBy=?, note=? WHERE id=?").bind(now, by, clean(b.note, 300), a.id).run(); return { ok: true, status: 'rejected' }; }
  let result = {};
  if (a.kind === 'warroom') {
    if (WRC) return { ok: false, error: 'central_only' };
    const r = await saveWarroom(db, { by, warroom: { name: clean(d.roomName || a.name, 60), kind: 'zone', province: a.province, districts: d.districts || '', address: clean(d.address, 200), phone: a.phone, lead: clean(d.contact, 60),
      lat: d.lat, lng: d.lng, radius: d.lat ? 5000 : 0, note: 'สมัครผ่านหน้า /join · ' + clean(d.capSummary || '', 300) } });
    if (!r.ok) return r;
    await db.prepare('INSERT OR IGNORE INTO wr_users (id,warroom,username,name,role,salt,hash,active,createdAt,by_) VALUES (?,?,?,?,?,?,?,1,?,?)')
      .bind('U' + rand(5), r.id, a.username, clean(d.contact || a.name, 60), 'lead', a.salt, a.hash, now, 'สมัคร').run();
    result = { warroom: r.id };
  } else {
    const wr = WRC ? WRC.id : clean(b.warroom || a.wrPref, 20);
    const veh = (d.equipment || []).includes('เรือ') ? 'boat' : (d.equipment || []).some(x => /รถสูง|6 ล้อ/.test(x)) ? 'truck' : (d.equipment || []).includes('รถกระบะ') ? 'pickup' : 'foot';
    let nm = clean((d.groupName || a.name), 60), r = await saveRoster(db, { by, team: { name: nm, leader: a.name, phone: a.phone, members: Number(d.groupSize) || 1, vehicle: veh, zone: clean(d.area, 80), note: 'จิตอาสา · ' + (d.skills || []).join(', ').slice(0, 250) } });
    if (!r.ok && r.error === 'duplicate_name') { nm = clean(nm + ' (' + a.username + ')', 60); r = await saveRoster(db, { by, team: { name: nm, leader: a.name, phone: a.phone, members: Number(d.groupSize) || 1, vehicle: veh, zone: clean(d.area, 80), note: 'จิตอาสา' } }); }
    if (!r.ok) return r;
    await db.prepare('UPDATE roster SET token=?, warroom=? WHERE id=?').bind(teamToken(), wr || '', r.id).run();
    result = { team: r.id, warroom: wr || '' };
  }
  await db.prepare("UPDATE applications SET status='approved', result=?, decidedAt=?, decidedBy=?, note=? WHERE id=?").bind(JSON.stringify(result), now, by, clean(b.note, 300), a.id).run();
  await bumpRev(db);
  return { ok: true, status: 'approved', ...result };
}
async function pwHash(pw, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, k, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const WR_USER = u => String(u || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 32);
const UN_OK = u => /^[a-z0-9._-]{3,32}$/.test(String(u || '').trim().toLowerCase());
async function ipLimit(db, ip, kind, max = 30, win = 600e3) {
  if (!ip) return true; const k = 'rl:' + kind + ':' + ip, now = Date.now(); let o = {}; try { o = JSON.parse(await getMeta(db, k) || '{}'); } catch (e) {}
  if (!o.t || now - o.t > win) o = { t: now, n: 0 }; o.n++; await setMeta(db, k, JSON.stringify(o)); return o.n <= max;
}
async function staffAuth(db, key) {
  const k = String(key || ''); if (!/^st_[a-f0-9]{48}$/.test(k)) return null;
  const r = await db.prepare('SELECT s.expires,u.id,u.username,u.name,u.role,u.active FROM staff_sessions s JOIN staff u ON u.id=s.staffId WHERE s.token=?').bind(k.slice(3)).first();
  return r && r.active && r.expires > Date.now() ? { id: r.id, username: r.username, name: r.name || r.username, role: r.role || 'staff' } : null;
}
async function staffLogin(db, b) {
  const un = WR_USER(b.username), pw = String(b.password || ''); if (!un || !pw) return { ok: false, error: 'missing' };
  const u = await db.prepare('SELECT * FROM staff WHERE username=? AND active=1').bind(un).first(), now = Date.now();
  if (!u) { await pwHash(pw, 'x'); return { ok: false, error: 'bad_login' }; }
  if (u.lockUntil && u.lockUntil > now) return { ok: false, error: 'locked', until: u.lockUntil };
  if (await pwHash(pw, u.salt) !== u.hash) { const f = (u.fails || 0) + 1; await db.prepare('UPDATE staff SET fails=?, lockUntil=? WHERE id=?').bind(f >= 5 ? 0 : f, f >= 5 ? now + 15 * 60e3 : null, u.id).run(); return { ok: false, error: f >= 5 ? 'locked' : 'bad_login' }; }
  const tok = rand(24);
  await db.batch([db.prepare('INSERT INTO staff_sessions (token,staffId,expires,at) VALUES (?,?,?,?)').bind(tok, u.id, now + 30 * 864e5, now), db.prepare('UPDATE staff SET fails=0, lockUntil=NULL, lastLogin=? WHERE id=?').bind(now, u.id)]);
  if (Math.random() < 0.05) await db.prepare('DELETE FROM staff_sessions WHERE expires<?').bind(now).run();
  return { ok: true, key: 'st_' + tok, name: u.name || u.username, role: u.role || 'staff' };
}
async function staffLogout(db, b) { const k = String(b.key || ''); if (/^st_[a-f0-9]{48}$/.test(k)) await db.prepare('DELETE FROM staff_sessions WHERE token=?').bind(k.slice(3)).run(); return { ok: true }; }
const staffAdmin = () => { const st = RQ.getStore(); return !!st && !st.wrc && (!st.staff || st.staff.role === 'admin'); };
async function staffList(db) {
  if (!staffAdmin()) return { ok: false, error: 'admin_only' };
  const { results } = await db.prepare('SELECT id,username,name,role,active,lastLogin,createdAt,lockUntil FROM staff ORDER BY active DESC, name').all();
  const st = RQ.getStore(); return { ok: true, staff: results, me: st && st.staff ? st.staff.id : 'master' };
}
async function staffSave(db, b) {
  if (!staffAdmin()) return { ok: false, error: 'admin_only' };
  const u = b.staff || {}, id = clean(u.id, 20).replace(/[^\w-]/g, ''), un = WR_USER(u.username), pw = String(u.password || ''), now = Date.now();
  const role = u.role === 'admin' ? 'admin' : 'staff', name = clean(u.name, 60), active = u.active === false ? 0 : 1;
  if (pw && pw.length < 8) return { ok: false, error: 'weak_password' };
  if (!id) {
    if (!un || !pw) return { ok: false, error: 'missing' };
    if (await db.prepare('SELECT id FROM staff WHERE username=?').bind(un).first()) return { ok: false, error: 'duplicate_user' };
    const nid = 'S' + rand(4), salt = rand(16);
    await db.prepare('INSERT INTO staff (id,username,name,role,salt,hash,active,fails,createdAt,by_) VALUES (?,?,?,?,?,?,?,0,?,?)').bind(nid, un, name || un, role, salt, await pwHash(pw, salt), 1, now, clean(b.by, 60)).run();
    return { ok: true, id: nid };
  }
  const cur = await db.prepare('SELECT * FROM staff WHERE id=?').bind(id).first(); if (!cur) return { ok: false, error: 'not_found' };
  const sets = ['name=?', 'role=?', 'active=?'], vals = [name || cur.name, role, active];
  if (pw) { const salt = rand(16); sets.push('salt=?', 'hash=?', 'fails=0', 'lockUntil=NULL'); vals.push(salt, await pwHash(pw, salt)); }
  await db.prepare(`UPDATE staff SET ${sets.join(',')} WHERE id=?`).bind(...vals, id).run();
  if (pw || !active) await db.prepare('DELETE FROM staff_sessions WHERE staffId=?').bind(id).run();
  return { ok: true, id };
}
async function ticketMake(db, env, key) {
  const t = rand(20), now = Date.now(), k = isVol(env, key) ? '*' : String(key || '').slice(0, 80);
  await db.prepare('INSERT INTO tickets (t,k,exp) VALUES (?,?,?)').bind(t, k, now + 12 * 3600e3).run();
  if (Math.random() < 0.05) await db.prepare('DELETE FROM tickets WHERE exp<?').bind(now).run();
  return { ok: true, t, exp: now + 12 * 3600e3 };
}
async function ticketKey(db, env, t) { if (!/^[a-f0-9]{40}$/.test(String(t || ''))) return ''; const r = await db.prepare('SELECT k,exp FROM tickets WHERE t=?').bind(t).first(); return r && r.exp > Date.now() ? (r.k === '*' ? env.VOLUNTEER_KEY : r.k) : ''; }
async function keyGuard(db, env, request, key) {
  if (!key) return true; const ip = request.headers.get('cf-connecting-ip') || ''; if (!ip) return true;
  let o = {}; try { o = JSON.parse(await getMeta(db, 'rl:key:' + ip) || '{}'); } catch (e) {}
  return !(o.t && Date.now() - o.t < 900e3 && (o.k || []).length > 20);
}
async function keyFail(db, request, key) {
  const ip = request.headers.get('cf-connecting-ip') || ''; if (!ip) return; const m = 'rl:key:' + ip, now = Date.now();
  let o = {}; try { o = JSON.parse(await getMeta(db, m) || '{}'); } catch (e) {} if (!o.t || now - o.t > 900e3) o = { t: now, k: [] };
  const h = String(key).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  if (!o.k.includes(h)) { o.k.push(h); if (o.k.length > 40) o.k = o.k.slice(-40); await setMeta(db, m, JSON.stringify(o)); }
}
async function wrLogin(db, b) {
  const wr = clean(b.warroom, 20), un = WR_USER(b.username), pw = String(b.password || '');
  if (!wr || !un || !pw) return { ok: false, error: 'missing' };
  const room = await db.prepare('SELECT id,name FROM warrooms WHERE id=? AND active=1').bind(wr).first();
  const u = room && await db.prepare('SELECT * FROM wr_users WHERE warroom=? AND username=? AND active=1').bind(wr, un).first();
  const now = Date.now();
  if (!u) return { ok: false, error: 'bad_login' };
  if (u.lockUntil && u.lockUntil > now) return { ok: false, error: 'locked', until: u.lockUntil };
  if (await pwHash(pw, u.salt) !== u.hash) {
    const f = (u.fails || 0) + 1;
    await db.prepare('UPDATE wr_users SET fails=?, lockUntil=? WHERE id=?').bind(f >= 5 ? 0 : f, f >= 5 ? now + 10 * 60e3 : null, u.id).run();
    return { ok: false, error: f >= 5 ? 'locked' : 'bad_login' };
  }
  const tok = rand(24);
  await db.batch([db.prepare('INSERT INTO wr_sessions (token,userId,warroom,expires,at) VALUES (?,?,?,?,?)').bind(tok, u.id, wr, now + 30 * 864e5, now),
    db.prepare('UPDATE wr_users SET fails=0, lockUntil=NULL, lastLogin=? WHERE id=?').bind(now, u.id)]);
  if (Math.random() < 0.05) await db.prepare('DELETE FROM wr_sessions WHERE expires<?').bind(now).run();
  return { ok: true, key: 'wru_' + tok, warroom: { id: room.id, name: room.name }, user: { username: u.username, name: u.name || '', role: u.role } };
}
const wrLead = () => WRC && WRC.role === 'lead';
async function wrUsers(db) {
  if (!WRC) return { ok: false, error: 'warroom_only' };
  const { results } = await db.prepare('SELECT id,username,name,role,active,lastLogin,createdAt,by_ FROM wr_users WHERE warroom=? ORDER BY active DESC, role, username').bind(WRC.id).all();
  return { ok: true, me: { role: WRC.role, via: WRC.via, user: WRC.user || null }, warroom: { id: WRC.id, name: WRC.name }, users: wrLead() ? results : results.filter(u => WRC.user && u.id === WRC.user.id) };
}
async function wrUserSave(db, b) {
  if (!WRC) return { ok: false, error: 'warroom_only' };
  const un = WR_USER(b.username), pw = String(b.password || ''), self = WRC.user && (b.id === WRC.user.id);
  if (!wrLead() && !self) return { ok: false, error: 'lead_only' };
  if (b.id) {
    const u = await db.prepare('SELECT * FROM wr_users WHERE id=? AND warroom=?').bind(clean(b.id, 20), WRC.id).first();
    if (!u) return { ok: false, error: 'not_found' };
    const sets = [], vals = [];
    if (b.name !== undefined) { sets.push('name=?'); vals.push(clean(b.name, 60)); }
    if (wrLead() && ['lead', 'staff'].includes(b.role) && !self) { sets.push('role=?'); vals.push(b.role); }
    if (wrLead() && b.active !== undefined && !self) { sets.push('active=?'); vals.push(b.active ? 1 : 0); }
    if (pw) { if (pw.length < 6) return { ok: false, error: 'short_password' }; const salt = rand(8); sets.push('salt=?', 'hash=?', 'fails=0', 'lockUntil=NULL'); vals.push(salt, await pwHash(pw, salt)); }
    if (sets.length) await db.prepare(`UPDATE wr_users SET ${sets.join(',')} WHERE id=?`).bind(...vals, u.id).run();
    if (pw || b.active === false) await db.prepare('DELETE FROM wr_sessions WHERE userId=?').bind(u.id).run();
    return { ok: true };
  }
  if (!UN_OK(b.username)) return { ok: false, error: 'bad_username' };
  if (pw.length < 6) return { ok: false, error: 'short_password' };
  const dup = await db.prepare('SELECT id FROM wr_users WHERE warroom=? AND username=?').bind(WRC.id, un).first();
  if (dup) return { ok: false, error: 'username_taken' };
  const id = 'U' + rand(5), salt = rand(8);
  await db.prepare('INSERT INTO wr_users (id,warroom,username,name,role,salt,hash,active,createdAt,by_) VALUES (?,?,?,?,?,?,?,1,?,?)')
    .bind(id, WRC.id, un, clean(b.name, 60), b.role === 'lead' ? 'lead' : 'staff', salt, await pwHash(pw, salt), Date.now(), clean(WRC.user ? WRC.user.username : 'ลิงก์ห้อง', 60)).run();
  return { ok: true, id, username: un };
}
async function wrLogout(db, b) { const k = String(b.key || ''); if (/^wru_[a-f0-9]{48}$/.test(k)) await db.prepare('DELETE FROM wr_sessions WHERE token=?').bind(k.slice(4)).run(); return { ok: true }; }
async function warroomLink(db, b) {
  const id = clean(b.id, 20), r = await db.prepare('SELECT id,token FROM warrooms WHERE id=? AND active=1').bind(id).first();
  if (!r) return { ok: false, error: 'no_warroom' };
  let token = r.token;
  if (!token || b.renew) { token = rand(12); await db.prepare('UPDATE warrooms SET token=?, updatedAt=? WHERE id=?').bind(token, Date.now(), id).run();
    if (b.renew) await db.prepare('DELETE FROM wr_sessions WHERE warroom=?').bind(id).run(); }
  return { ok: true, id, token };
}
async function setTeamWarroom(db, b) {
  const team = clean(b.team, MAX.volunteer), wr = clean(b.warroom, 20).replace(/[^\w-]/g, '');
  if (!team) return { ok: false, error: 'missing_team' };
  if (wr && !await db.prepare("SELECT id FROM warrooms WHERE id=? AND active=1 AND COALESCE(kind,'zone')='zone'").bind(wr).first()) return { ok: false, error: 'no_warroom' };
  const r = await db.prepare('UPDATE roster SET warroom=?, updatedAt=? WHERE name=? AND active=1').bind(wr, Date.now(), team).run();
  return r.meta.changes ? { ok: true } : { ok: false, error: 'not_found' };
}
async function listStock(db) {
  const { results: items } = await db.prepare('SELECT * FROM stock ORDER BY id').all();
  const { results: log } = await db.prepare('SELECT time,itemId,item,type,delta,after,note,caseId,by_ AS "by",team FROM stock_log ORDER BY n DESC LIMIT 1000').all();
  return { ok: true, items: items.map(i => ({ ...i, min: i.min == null ? '' : i.min, needed: !!i.needed, expiry: i.expiry || '', location: i.location || '', warroom: i.warroom || '', kit: parseKit(i.kit) })), log: log.map(l => ({ ...l, team: l.team || '' })) };
}
function parseKit(v) { try { const a = typeof v === 'string' ? JSON.parse(v || '[]') : v; return (Array.isArray(a) ? a : []).map(x => ({ id: clean(x.id, 20), qty: clampInt(x.qty, 1, 9999, 1) })).filter(x => x.id).slice(0, 30); } catch (e) { return []; } }
async function saveStockItem(db, b) {
  const t = b.item || {}, name = clean(t.name, 80);
  if (!name) return { ok: false, error: 'missing_name' };
  const id = t.id && await db.prepare('SELECT id FROM stock WHERE id=?').bind(String(t.id)).first() ? String(t.id) : 'S' + rand(3);
  const min = t.min === '' || t.min == null ? null : clampInt(t.min, 0, 1e7, null);
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(String(t.expiry || '')) ? t.expiry : '';
  const kit = t.kit === undefined ? ((await db.prepare('SELECT kit FROM stock WHERE id=?').bind(id).first()) || {}).kit || '[]' : JSON.stringify(parseKit(t.kit).filter(x => x.id !== id));
  const wr = t.warroom === undefined ? ((await db.prepare('SELECT warroom FROM stock WHERE id=?').bind(id).first()) || {}).warroom || '' : clean(t.warroom, 20).replace(/[^\w-]/g, '');
  await db.prepare(`INSERT INTO stock (id,name,unit,category,qty,min,needed,note,updatedAt,expiry,location,kit,warroom) VALUES (?,?,?,?,0,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,unit=excluded.unit,category=excluded.category,min=excluded.min,needed=excluded.needed,note=excluded.note,updatedAt=excluded.updatedAt,expiry=excluded.expiry,location=excluded.location,kit=excluded.kit,warroom=excluded.warroom`)
    .bind(id, name, clean(t.unit, 20), clean(t.category, 30), min, t.needed ? 1 : 0, clean(t.note, 200), Date.now(), expiry, clean(t.location, 60), kit, wr).run();
  return { ok: true, id };
}
async function moveStock(db, b) {
  const type = ['in', 'out', 'set'].includes(b.type) ? b.type : '', amount = clampInt(b.amount, 0, 1e7, -1);
  if (!type || amount < 0) return { ok: false, error: 'bad_amount' };
  const it = await db.prepare('SELECT * FROM stock WHERE id=?').bind(String(b.itemId)).first();
  if (!it) return { ok: false, error: 'not_found' };
  const before = Number(it.qty) || 0, after = type === 'in' ? before + amount : type === 'out' ? before - amount : amount;
  if (after < 0) return { ok: false, error: 'not_enough', qty: before };
  const u = await db.prepare('UPDATE stock SET qty=?, updatedAt=? WHERE id=? AND qty=?').bind(after, Date.now(), it.id, before).run();
  if (!u.meta.changes) return { ok: false, error: 'conflict_retry' };
  await db.prepare('INSERT INTO stock_log (time,itemId,item,type,delta,after,note,caseId,by_,team) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(Date.now(), it.id, it.name, type, after - before, after, clean(b.note, 200), clean(b.caseId, 30), clean(b.by, 60), clean(b.team, MAX.volunteer)).run();
  return { ok: true, qty: after };
}
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
    if (r.meta.changes) added++;
  }
  if (added) await bumpRev(db);
  return { ok: true, added, total: rows.length };
}

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

async function cached(key, ttl, load) {
  const cache = caches.default, req = new Request('https://umplus.cache/' + key);
  const hit = await cache.match(req);
  if (hit) return hit.json();
  const data = await load();
  await cache.put(req, new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + ttl } }));
  return data;
}
const UA = { 'user-agent': 'UMplus-flood-help/1.0 (+https://admin-um-help.pages.dev)' };

const TMD_KEY = 'uid=api&ukey=api12345';
const xmlDec = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
const xmlAll = (s, tag) => [...String(s).matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]);
const xmlOne = (s, tag) => xmlDec(xmlAll(s, tag)[0] || '');
const tmdTime = t => { const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/.exec(t || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], m[4] - 7, +m[5]) : null; };
const NEWS_FEEDS = [['ไทยรัฐ', 'https://www.thairath.co.th/rss/news'], ['มติชน', 'https://www.matichon.co.th/feed'], ['ข่าวสด', 'https://www.khaosod.co.th/feed'], ['ประชาชาติธุรกิจ', 'https://www.prachachat.net/feed']];
const NEWS_TAGS = [['flood', /น้ำท่วม|น้ำป่า|ล้นตลิ่ง|น้ำหลาก|ระบายน้ำ|เขื่อน|อพยพ|ท่วมขัง|ท่วมสูง|ระดับน้ำ/], ['storm', /พายุ|ฝนตก|ฝนหนัก|ฝนถล่ม|ลูกเห็บ|ลมกระโชก|มรสุม|ดีเปรสชัน|กรมอุตุ|อุตุฯ|คลื่นลมแรง|พยากรณ์อากาศ|สภาพอากาศ/], ['quake', /แผ่นดินไหว|สึนามิ|ดินถล่ม|โคลนถล่ม/], ['alert', /เตือนภัย|ประกาศเตือน|เฝ้าระวัง|ภัยพิบัติ|ปภ\.|บรรเทาสาธารณภัย|ฉุกเฉิน/]];
async function newsData() {
  return cached('news-v7', 600, async () => {
    const out = { ok: true, time: Date.now(), warnings: [], quakes: [], news: [], errors: [] };
    const get = (u, ms = 12000, h = UA) => fetch(u, { headers: h, signal: AbortSignal.timeout(ms) }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
    const [w, q, ...n] = await Promise.allSettled([
      get(`https://data.tmd.go.th/api/WeatherWarningNews/v2/?${TMD_KEY}`),
      get(`https://data.tmd.go.th/api/DailySeismicEvent/v1/?${TMD_KEY}`),
      ...NEWS_FEEDS.map(([, u]) => get(u, 10000, { 'user-agent': 'Mozilla/5.0 (compatible; UMplus flood help feed reader)', accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8' })),
    ]);
    if (w.status === 'fulfilled') out.warnings = xmlAll(w.value, 'Warning').map(x => ({
      title: xmlOne(x, 'TitleThai').replace(/\s+/g, ' '), text: xmlOne(x, 'DescriptionThai').replace(/\s+/g, ' ').slice(0, 1500),
      announced: tmdTime(xmlOne(x, 'AnnounceDate')), start: tmdTime(xmlOne(x, 'EffectStartDate')), end: tmdTime(xmlOne(x, 'EffectEndDate')),
      url: xmlOne(x, 'WebUrlThai'), contact: xmlOne(x, 'ContactThai'),
    })).filter(x => x.title).sort((a, b) => (b.announced || 0) - (a.announced || 0));
    else out.errors.push('tmd_warning: ' + String(w.reason && w.reason.message || w.reason).slice(0, 120));
    if (q.status === 'fulfilled') out.quakes = xmlAll(q.value, 'DailyEarthquakes').map(x => ({
      place: xmlOne(x, 'OriginThai'), time: tmdTime(xmlOne(x, 'DateTimeThai')), mag: +xmlOne(x, 'Magnitude'), depth: +xmlOne(x, 'Depth'),
      lat: +xmlOne(x, 'Latitude'), lng: +xmlOne(x, 'Longitude'),
    })).filter(x => x.time && Date.now() - x.time < 3 * 864e5 && x.lat > -2 && x.lat < 28 && x.lng > 88 && x.lng < 112)
      .sort((a, b) => b.time - a.time).slice(0, 20);
    else out.errors.push('tmd_quake: ' + String(q.reason && q.reason.message || q.reason).slice(0, 120));
    const seen = new Set(), names = NEWS_FEEDS.map(f => f[0]);
    n.forEach((r, i) => {
      if (r.status !== 'fulfilled') { out.errors.push(names[i] + ': ' + String(r.reason && r.reason.message || r.reason).slice(0, 80)); return; }
      xmlAll(r.value, 'item').forEach(it => {
        const source = names[i];
        let title = xmlOne(it, 'title').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
        const tags = NEWS_TAGS.filter(([, re]) => re.test(title)).map(([k]) => k);
        if (!title || !(tags.some(t => t !== 'alert') || /ภัยพิบัติ|ปภ\.|บรรเทาสาธารณภัย|เตือนภัย/.test(title))) return;
        const key = title.replace(/[\s"'“”‘’]/g, '').slice(0, 40);
        if (seen.has(key)) return;
        const link = xmlOne(it, 'link').trim(), t = Date.parse(xmlOne(it, 'pubDate'));
        if (!/^https:\/\//.test(link) || (!isNaN(t) && Date.now() - t > 3 * 864e5)) return;
        seen.add(key);
        out.news.push({ title, source, link, time: isNaN(t) ? null : t, tags });
      });
    });
    out.news.sort((a, b) => (b.time || 0) - (a.time || 0)); out.news = out.news.slice(0, 80);
    return out;
  });
}
async function damData() {
  return cached('dams-v1', 3600, async () => {
    const j = await fetch('https://api-v3.thaiwater.net/api/v1/thaiwater30/analyst/dam', { headers: UA, signal: AbortSignal.timeout(25000) }).then(r => r.json());
    const d = (j && j.data) || {}, today = Date.now() - 3 * 864e5;
    const map = (r, size) => { const m = r.dam || {}, t = Date.parse(String(r.dam_date || '').slice(0, 10) + 'T00:00:00+07:00') || 0;
      return { id: m.id, name: (m.dam_name || {}).th || (m.dam_name || {}).en || '', size, lat: Number(m.dam_lat), lng: Number(m.dam_long), date: String(r.dam_date || '').slice(0, 10), t,
        pct: r.dam_storage_percent == null ? null : Number(r.dam_storage_percent), storage: r.dam_storage == null ? null : Number(r.dam_storage), inflow: r.dam_inflow == null ? null : Number(r.dam_inflow),
        released: r.dam_released == null ? null : Number(r.dam_released), spilled: r.dam_spilled == null ? null : Number(r.dam_spilled), agency: (((r.agency || {}).agency_shortname || {}).th || '').trim() }; };
    const large = (d.dam_daily || []).map(r => map(r, 'large')).filter(x => x.name && x.t >= today);
    const medium = (d.dam_medium || []).map(r => map(r, 'medium')).filter(x => x.name && x.t >= today && x.pct != null);
    return { ok: true, time: Date.now(), large, medium };
  });
}
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
async function cctvData() {
  return cached('cctv-v3', 3600, async () => {
    const j = await fetch('https://traffic.longdo.com/camera.json', { headers: UA }).then(r => r.json());
    const cams = (j.item || []).filter(c => String(c.geocode || '').startsWith('10') || c.hls_url).map(c => {
      const img = /X\.X\.X\.X/.test(c.imgurl || '') ? '' : (c.imgurl || '');
      const https = u => /^https:\/\/[^\s"'<>]+$/.test(u || '') ? u : '';
      return { id: c.camid, title: String(c.title || '').replace(/^\(กรุงเทพมหานคร\)\s*/, '').trim(), lat: Number(c.latitude), lng: Number(c.longitude), img: https(img), hls: https(c.hls_url), org: c.organization || '' };
    }).filter(c => isFinite(c.lat) && isFinite(c.lng));
    return { ok: true, time: Date.now(), cams };
  });
}
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
  let named = 0;
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
const HELPME_API = 'https://script.google.com/macros/s/AKfycbyWeVDhToFJntjTGHprDEByEfRFdSbOidlR7QhJ6xG1bz7co2gCRkTGIoKDI9tJqGkWTw/exec';
const HELPME_API2 = 'https://script.google.com/macros/s/AKfycbwxY1eDJnkqCInUCv9bye2WLd2HXuGUyVH9mElVCl5I04UFVI3VfoUr2yxMMFHEIvhW9A/exec';
async function apiCases(env) {
  const q = new URLSearchParams({ action: 'list', t: String(Math.floor(Date.now() / 60000)) }); if (env.HELPME_KEY) q.set('key', env.HELPME_KEY);
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 55000);
  try {
    const r = await fetch((env.HELPME_API2 || HELPME_API2) + '?' + q, { headers: UA, redirect: 'follow', signal: ctl.signal });
    if (!r.ok) throw new Error('hm_api_' + r.status);
    const j = await r.json(); if (!j || !Array.isArray(j.cases)) throw new Error('hm_api_bad');
    const ST = { open: 'open', going: 'going', done: 'done', skip: 'skip' };
    return j.cases.filter(c => c && c.id).map(c => { const address = String(c.address || '').trim(), photos = Array.isArray(c.photos) ? c.photos : String(c.photos || '').match(/[-\w]{25,}/g) || [];
      const u = Number(c.urgency) || HM_URG[String(c.urgency || '').trim()] || null;
      return { id: String(c.id), createdAt: Number(c.createdAt) || 0, updatedAt: Number(c.updatedAt) || Number(c.createdAt) || 0, status: ST[c.status] || HM_STATUS[c.status] || null,
        urgency: u ? Math.min(3, Math.max(1, u)) : null, name: String(c.name || ''), phone: String(c.phone || '').replace(/^'/, ''), notes: String(c.notes || c.details || ''),
        people: Number(c.people) || null, address, district: /^หมู่/.test(String(c.district || '')) ? '' : String(c.district || ''), addrDistrict: bkkDistrictOf(address),
        lat: c.approx ? null : num(c.lat, -90, 90), lng: c.approx ? null : num(c.lng, -180, 180), approx: !!c.approx,
        needs: Array.isArray(c.needs) ? c.needs : String(c.needs || '').split(/\s*,\s*/).filter(Boolean), volunteer: String(c.volunteer || ''), org: String(c.org || ''), pinSrc: '',
        pickedAt: Number(c.pickedAt) || 0, doneAt: Number(c.doneAt) || 0, photos }; });
  } finally { clearTimeout(tm); }
}
async function helpmeAllCases(env) {
  const [sh, api] = await Promise.all([sheetCases(env), apiCases(env)]);
  if (!api.length) throw new Error('hm_api_empty');
  const byId = new Map(sh.map(c => [String(c.id), c])), out = [], skip = [];
  for (const a of api) {
    const o = byId.get(a.id); byId.delete(a.id);
    if (a.status === 'skip') { skip.push(a.id); continue; }
    if (!o) { out.push({ ...a, status: a.status || 'open', urgency: a.urgency || 1, people: a.people || 1 }); continue; }
    const newer = (a.updatedAt || 0) >= (o.updatedAt || 0), m = { ...o };
    if (newer) Object.assign(m, { status: a.status || o.status, urgency: a.urgency || o.urgency, updatedAt: a.updatedAt, volunteer: a.volunteer || o.volunteer, org: a.org || o.org, pickedAt: a.pickedAt || o.pickedAt, doneAt: a.doneAt || o.doneAt, people: a.people || o.people, needs: a.needs.length ? a.needs : o.needs, level: a.level || o.level });
    for (const k of ['name', 'phone', 'notes', 'address']) if (!m[k] && a[k]) m[k] = a[k];
    if (!(m.photos || []).length && a.photos.length) m.photos = a.photos;
    if ((m.lat == null || m.lng == null) && a.lat != null && !a.approx) { m.lat = a.lat; m.lng = a.lng; }
    out.push(m);
  }
  for (const o of byId.values()) if (o.status !== 'skip') out.push(o); else skip.push(String(o.id));
  out.skipIds = skip; return out;
}
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
function sheetTime(v) {
  const m = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0; let y = +m[3]; if (y > 2400) y -= 543;
  return Date.UTC(y, +m[2] - 1, +m[1], +m[4], +m[5], +(m[6] || 0)) - 7 * 3600e3;
}
const BKK_DISTRICTS = ['พระนคร','ดุสิต','หนองจอก','บางรัก','บางเขน','บางกะปิ','ปทุมวัน','ป้อมปราบศัตรูพ่าย','พระโขนง','มีนบุรี','ลาดกระบัง','ยานนาวา','สัมพันธวงศ์','พญาไท','ธนบุรี','บางกอกใหญ่','ห้วยขวาง','คลองสาน','ตลิ่งชัน','บางกอกน้อย','บางขุนเทียน','ภาษีเจริญ','หนองแขม','ราษฎร์บูรณะ','บางพลัด','ดินแดง','บึงกุ่ม','สาทร','บางซื่อ','จตุจักร','บางคอแหลม','ประเวศ','คลองเตย','สวนหลวง','จอมทอง','ดอนเมือง','ราชเทวี','ลาดพร้าว','วัฒนา','บางแค','หลักสี่','สายไหม','คันนายาว','สะพานสูง','วังทองหลาง','คลองสามวา','บางนา','ทวีวัฒนา','ทุ่งครุ','บางบอน'].sort((a, b) => b.length - a.length);
const HM_STATUS = { 'ไม่เข้าเกณฑ์': 'skip', 'รอช่วย': 'open', 'รอความช่วยเหลือ': 'open', 'ทีมกำลังไป': 'going', 'กำลังไป': 'going', 'กำลังช่วย': 'going', 'ช่วยแล้ว': 'done', 'เสร็จแล้ว': 'done' };
const HM_URG = { 'ด่วนมาก': 3, 'วิกฤต': 3, 'เร่งด่วน': 2, 'ทั่วไป': 1 };
async function sheetCases(env) {
  const t = await sheetTab(env, 'cases'), h = t.header, col = n => h.indexOf(n), all = n => h.map((x, i) => x === n ? i : -1).filter(i => i >= 0);
  const v = (r, n) => { const i = col(n); return i < 0 ? '' : String(r[i] || '').trim(); };
  return t.rows.map(r => {
    const address = v(r, 'ที่อยู่'), dm = address.match(/เขต\s*([ก-๙]+)/) || [null, BKK_DISTRICTS.find(d => address.replace(/พระนครศรีอยุธยา/g, '').includes(d)) || ''];
    return { id: v(r, 'รหัสเคส'), createdAt: sheetTime(v(r, 'เวลาแจ้ง')), updatedAt: sheetTime(v(r, 'อัปเดตล่าสุด')),
      status: HM_STATUS[v(r, 'สถานะ')] || 'open', urgency: HM_URG[v(r, 'ความเร่งด่วน')] || 1, name: v(r, 'ชื่อ'), phone: v(r, 'เบอร์โทร').replace(/^'/, ''),
      notes: all('รายละเอียด').map(i => String(r[i] || '').trim()).filter(Boolean).join(' · '), people: Number(v(r, 'จำนวนคน')) || 1, address,
      district: dm ? dm[1] : '', addrDistrict: bkkDistrictOf(address), lat: num(v(r, 'ละติจูด'), -90, 90), lng: num(v(r, 'ลองจิจูด'), -180, 180), level: v(r, 'ระดับน้ำ'),
      needs: v(r, 'ต้องการ').split(/\s*,\s*/).filter(Boolean), volunteer: v(r, 'ทีมอาสา'), org: v(r, 'หน่วยงาน'), pinSrc: v(r, 'ที่มาของหมุด'),
      pickedAt: sheetTime(v(r, 'เวลารับเคส')), doneAt: sheetTime(v(r, 'เวลาช่วยเสร็จ')),
      photos: v(r, 'รูปภาพ').match(/[-\w]{25,}/g) || [] };
  }).filter(c => c.id);
}
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
  try { j = { ok: true, volunteer: true, cases: (await helpmeAllCases(env)).map(c => ({ ...c, approx: !!c.approx })), source: 'sheet+api' }; } catch (e) {}
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
const CCTV_AI_MODEL = '@cf/mistralai/mistral-small-3.1-24b-instruct';
const CCTV_AI_PROMPT = 'This is a traffic CCTV snapshot in Thailand. Decide if there is FLOOD WATER on the road. ' +
  'Answer "yes" ONLY if you clearly see standing or flowing water covering part of the road surface (water over lane markings, ' +
  'cars or people moving through water, water reaching kerbs or wheels). Dry asphalt, shadows, glare, or a wet sheen after rain are "no". ' +
  'Use "unclear" if the image is dark, blurry, blocked, frozen, or does not show a road. If unsure between yes and no, answer "unclear". ' +
  'Reply with JSON only: {"flood":"yes"|"no"|"unclear","depth_cm":number|null,"note":"<= 12 Thai words describing what you see"}.';
function camDistM(lat, lng, lat2, lng2) {
  const R = 6371000, r = Math.PI / 180, a = Math.sin((lat2 - lat) * r / 2) ** 2 + Math.cos(lat * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function b64(buf) { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
async function cctvAiOne(env, cam) {
  const stamp = cam.at || 'live' + Math.floor(Date.now() / 600000);
  return cached('cctv-ai-v4:' + cam.id + ':' + stamp, cam.at ? 1800 : 600, async () => {
    const r = await fetch(cam.img, { headers: UA, cf: { cacheTtl: 60 } });
    if (!r.ok) return { flood: 'unclear', note: 'โหลดภาพไม่ได้' };
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 2000 || buf.byteLength > 2_500_000) return { flood: 'unclear', note: 'ภาพใช้ไม่ได้' };
    const out = await env.AI.run(CCTV_AI_MODEL, {
      messages: [{ role: 'user', content: [{ type: 'text', text: CCTV_AI_PROMPT }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64(buf) } }] }],
      max_tokens: 120, temperature: 0 });
    const raw = out && (out.response ?? (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content));
    let j = raw && typeof raw === 'object' ? raw : {};
    if (typeof raw === 'string') { const m = raw.match(/\{[\s\S]*\}/); try { j = m ? JSON.parse(m[0]) : {}; } catch (e) {} }
    let flood = ['yes', 'no', 'unclear'].includes(j.flood) ? j.flood : 'unclear';
    const depth = Number(j.depth_cm);
    if (flood === 'yes' && isFinite(depth) && depth > 0 && depth < 10) flood = 'unclear';
    return { flood, depth: flood === 'yes' && isFinite(depth) && depth > 0 ? Math.min(300, Math.round(depth)) : null, note: clean(j.note, 80) };
  });
}
async function cctvAiCheck(env, p) {
  if (!env.AI) return { ok: false, error: 'ai_not_bound' };
  const lat = num(p.lat, -90, 90), lng = num(p.lng, -180, 180);
  if (lat == null || lng == null) return { ok: false, error: 'missing' };
  const now = Date.now() / 1000, all = (await allCams()).cams;
  const near = all.filter(c => c.img && (c.hls || (c.at > 0 && now - c.at < 3 * 3600)))
    .map(c => ({ ...c, d: Math.round(camDistM(lat, lng, c.lat, c.lng)) })).sort((a, b) => a.d - b.d);
  const nearest = near[0] ? { d: near[0].d, title: near[0].title } : null;
  near.splice(0, near.length, ...near.filter(c => c.d <= 5000).slice(0, 3));
  const checks = await Promise.all(near.map(async c => {
    try { return { id: c.id, title: c.title, d: c.d, at: c.at, img: c.img, ...(await cctvAiOne(env, c)) }; }
    catch (e) { return { id: c.id, title: c.title, d: c.d, at: c.at, img: c.img, flood: 'unclear', note: 'ตรวจไม่สำเร็จ' }; }
  }));
  const verdict = !checks.length ? 'none' : checks.some(c => c.flood === 'yes') ? 'flood' : checks.some(c => c.flood === 'no') ? 'clear' : 'unclear';
  return { ok: true, time: Date.now(), model: CCTV_AI_MODEL, verdict, checks, nearest };
}
async function allCams() {
  const [p, l] = await Promise.allSettled([popnixCams(), cctvData()]);
  const cams = [...(l.status === 'fulfilled' ? l.value.cams.filter(c => c.hls).map(c => ({ ...c, src: 'iTIC' })) : []), ...(p.status === 'fulfilled' ? p.value.cams : [])];
  if (!cams.length) throw new Error('no_cams');
  return { ok: true, time: Date.now(), cams, sources: { popnix: p.status === 'fulfilled', itic: l.status === 'fulfilled' } };
}
async function helpmeStats(env, db) {
  if (db) { const last = await getMeta(db, 'helpme_stats_last'), at = Number(await getMeta(db, 'helpme_stats_at')) || 0;
    if (last) {
      if (Date.now() - at > 60e3 && CTX && CTX.waitUntil) { await setMeta(db, 'helpme_stats_at', String(Date.now()));
        CTX.waitUntil(helpmeStatsLive(env, db).then(f => setMeta(db, 'helpme_stats_last', JSON.stringify(f))).catch(() => {})); }
      return { ...JSON.parse(last), cachedAt: at || null };
    } }
  try {
    const fresh = await helpmeStatsLive(env, db);
    if (db) { await setMeta(db, 'helpme_stats_last', JSON.stringify(fresh)); await setMeta(db, 'helpme_stats_at', String(Date.now())); }
    return fresh;
  } catch (e) {
    const last = db ? await getMeta(db, 'helpme_stats_last') : '';
    if (last) return { ...JSON.parse(last), stale: true };
    throw e;
  }
}
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
const normD = d => String(d || '').replace(/^เขต\s*/, '').replace(/\s+/g, '').trim();
function bkkDistrictOf(address) {
  for (const m of String(address || '').matchAll(/เขต\s*([ก-๙]+)/g)) {
    const d = [...BKK_DISTRICTS].sort((a, b) => b.length - a.length).find(x => m[1].startsWith(x));
    if (d) return d;
  }
  return '';
}
function pinPlace(p) {
  const d = String(p.district || '').replace(/^เขต\s*/, '').trim();
  if (d && BKK_DISTRICTS.includes(d)) return d;
  const st = String(p.state || '').trim();
  if (st && !/กรุงเทพ/.test(st)) return st.startsWith('จังหวัด') ? st : 'จังหวัด' + st;
  return '-';
}
async function checkPins(db, cases) {
  if (!db) return;
  const pinned = cases.filter(c => c.addrDistrict && c.lat != null && c.lng != null);
  if (!pinned.length) return;
  const rkey = c => 'hmp:' + c.lat.toFixed(5) + ',' + c.lng.toFixed(5), known = new Map();
  const keys = [...new Set(pinned.map(rkey))];
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
      const d = pinPlace(((await r.json()).features || [])[0]?.properties || {});
      known.set(k, d); await setMeta(db, k, d);
    } catch (e) {}
  }
  let searched = 0;
  const variants = c => {
    const full = String(c.address).split(' · ')[0].replace(/\(.*?\)/g, ' ').replace(/([ก-๙])(\d)/g, '$1 $2').replace(/\s+/g, ' ').trim().slice(0, 160);
    const street = full.split(/\s*แขวง/)[0].replace(/^(บ้านเลขที่|เลขที่)?\s*[\d/-]+\s*/, '').trim();
    const soi = street.replace(/\s*แยก.*$/, '').replace(/(\d+)\/\d+/, '$1').trim();
    const kw = (full.match(/แขวง\s*([ก-๙]+)/) || [])[1];
    const v = [[full, 'ที่อยู่'], [street, 'ซอย/ถนน'], [soi, 'ซอยหลัก'], [kw ? 'แขวง' + kw + ' เขต' + c.addrDistrict : '', 'แขวง'], ['เขต' + c.addrDistrict, 'เขต']];
    return v.filter(([q], i) => q && q.length >= 4 && v.findIndex(([x]) => x === q) === i);
  };
  for (const c of pinned) {
    const pinD = known.get(rkey(c));
    if (!pinD || pinD === '-' || normD(pinD) === normD(c.addrDistrict)) continue;
    const gkey = 'hmg2:' + String(c.address).slice(0, 160);
    let hit = await getMeta(db, gkey);
    if (!hit && searched < 12) {
      try {
        for (const [q, level] of variants(c)) {
          if (searched >= 12) { hit = ''; break; }
          searched++;
          const u = 'https://photon.komoot.io/api?limit=8&lang=default&lat=13.75&lon=100.6&bbox=100.3,13.45,100.98,14.0&q=' + encodeURIComponent(q + ' กรุงเทพ');
          const fs = ((await (await fetch(u, { headers: UA, cf: { cacheTtl: 86400 } })).json()).features || []);
          const f = fs.find(f => normD(f.properties && (f.properties.district || f.properties.county)) === normD(c.addrDistrict));
          if (f) { hit = [f.geometry.coordinates[1].toFixed(6), f.geometry.coordinates[0].toFixed(6), level, clean(f.properties.name || f.properties.street || '', 80)].join('|'); break; }
          hit = '-';
        }
        if (hit) await setMeta(db, gkey, hit);
      } catch (e) { hit = ''; }
    }
    const from = { lat: c.lat, lng: c.lng, district: pinD };
    if (hit && hit !== '-') {
      const [la, ln, level, label] = hit.split('|');
      c.pinCheck = { status: 'fixed', from, addrDistrict: c.addrDistrict, level, label };
      c.lat = Number(la); c.lng = Number(ln);
    } else if (hit === '-') c.pinCheck = { status: 'mismatch', from, addrDistrict: c.addrDistrict };
    else c.pinCheck = { status: 'pending', from, addrDistrict: c.addrDistrict };
  }
}
async function fixOwnPins(db, rows) {
  const cand = rows.filter(r => r.status !== 'done' && r.lat != null && r.lng != null && r.lat !== '' && /เขต/.test(r.address || ''));
  if (!cand.length) return;
  const objs = cand.map(r => {
    return { row: r, address: r.address, addrDistrict: bkkDistrictOf(r.address), lat: Number(r.lat), lng: Number(r.lng) };
  }).filter(o => o.addrDistrict && isFinite(o.lat) && isFinite(o.lng));
  if (!objs.length) return;
  await checkPins(db, objs);
  let changed = 0;
  for (const o of objs) {
    if (!o.pinCheck || o.pinCheck.status !== 'fixed') continue;
    const f = o.pinCheck.from, now = Date.now();
    const note = `[ปรับหมุดตามที่อยู่ ${new Date(now).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}] หมุดเดิม ${f.lat},${f.lng} (เขต${f.district}) ไม่ตรงกับ เขต${o.addrDistrict} ในที่อยู่ · หมุดใหม่ระดับ${o.pinCheck.level}`;
    const notes = clean([note, o.row.notes || ''].filter(Boolean).join('\n'), MAX.notes);
    await db.prepare('UPDATE cases SET lat=?, lng=?, notes=?, updatedAt=? WHERE id=?').bind(o.lat, o.lng, notes, now, o.row.id).run();
    Object.assign(o.row, { lat: o.lat, lng: o.lng, notes, updatedAt: now }); changed++;
  }
  if (changed) await bumpRev(db);
}
const HM_TEST = /\btest|ทดสอบ|เทส(?!โก้)/i;
const HM_LEVEL_CODE = { 'ข้อเท้า': 'ankle', 'ข้อเท้า–เข่า': 'knee', 'เข่า': 'knee', 'เข่า–เอว': 'waist', 'เอว': 'waist', 'เอว–อก': 'chest', 'อก': 'chest', 'อกขึ้นไป': 'chest', 'มิดหัว': 'roof' };
const HM_LEVEL_KEYWORDS = [[/มิดหัว|หลังคา/, 'roof'], [/อกขึ้นไป|เอว.อก|^อก/, 'chest'], [/เข่า.เอว|^เอว/, 'waist'], [/ข้อเท้า.เข่า|^เข่า/, 'knee'], [/^ข้อเท้า/, 'ankle']];
function hmLevelCode(text) {
  const t = String(text || '').split('(')[0].replace(/\s+/g, ' ').trim();
  if (HM_LEVEL_CODE[t]) return HM_LEVEL_CODE[t];
  const n = t.replace(/[-‐-―−]/g, '–').replace(/\s/g, '');
  if (HM_LEVEL_CODE[n]) return HM_LEVEL_CODE[n];
  for (const [re, code] of HM_LEVEL_KEYWORDS) if (re.test(n)) return code;
  return '';
}
const provName = s => { s = String(s || '').replace(/^จังหวัด\s*/, '').replace(/^จ\.\s*/, '').trim(); return /^(กรุงเทพ|กทม)/.test(s) ? 'กรุงเทพมหานคร' : s; };
async function fillProvinces(db, cases) {
  cases.forEach(c => {
    const a = String(c.address || ''), m = a.match(/(?:จ\.|จังหวัด)\s*([ก-๙]{3,})/);
    if (m) c.province = provName(m[1]);
    else if (/กรุงเทพ|กทม/.test(a) || BKK_DISTRICTS.includes(String(c.district || '').replace(/^เขต\s*/, ''))) c.province = 'กรุงเทพมหานคร';
  });
  if (!db) return;
  const need = cases.filter(c => !c.province && c.lat != null && c.lng != null && isFinite(c.lat));
  if (!need.length) return;
  const key = c => 'hmv:' + Number(c.lat).toFixed(3) + ',' + Number(c.lng).toFixed(3), keys = [...new Set(need.map(key))], known = new Map();
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
      const v = provName(p.state || (/กรุงเทพ/.test(p.city || '') ? 'กรุงเทพมหานคร' : '')) || '-';
      known.set(k, v); await setMeta(db, k, v);
    } catch (e) {}
  }
  need.forEach(c => { const v = known.get(key(c)); if (v && v !== '-') c.province = v; });
}
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
let hmSyncP = null;
async function hmNudge(env, db) {
  const now = Date.now(), last = Number(await getMeta(db, 'hm_nudge_at')) || 0;
  if (now - last < 8e3) { await setMeta(db, 'hm_nudge_pending', '1'); return { ok: true, queued: true }; }
  await setMeta(db, 'hm_nudge_at', String(now)); await setMeta(db, 'hm_nudge_pending', '');
  const run = (async () => {
    await new Promise(r => setTimeout(r, 2000));
    for (let i = 0; i < 3; i++) {
      try { await syncHelpme(env, db, true); } catch (e) {}
      if (await getMeta(db, 'hm_nudge_pending') !== '1') break;
      await setMeta(db, 'hm_nudge_pending', ''); await setMeta(db, 'hm_nudge_at', String(Date.now()));
    }
  })();
  if (CTX && CTX.waitUntil) CTX.waitUntil(run.catch(() => {})); else await run;
  return { ok: true, started: true };
}
async function syncHelpme(env, db, force) {
  if (hmSyncP) return hmSyncP;
  const last = Number(await getMeta(db, 'hm_sync_at')) || 0;
  if (!force && Date.now() - last < 25e3) return { ok: true, skipped: true, at: last };
  hmSyncP = (async () => {
    await setMeta(db, 'hm_sync_at', String(Date.now()));
    const src = await helpmeAllCases(env);
    const skipIds = src.skipIds || [];
    let skipped = 0;
    for (let i = 0; i < skipIds.length; i += 90) { const part = skipIds.slice(i, i + 90); const w = await db.prepare(`UPDATE cases SET hmStatus='skip', hmHash=NULL WHERE src='helpme' AND COALESCE(hmStatus,'')<>'skip' AND NOT (status='going' AND localAt IS NOT NULL) AND id IN (${part.map(() => '?').join(',')})`).bind(...part).run(); skipped += w.meta.changes || 0; }
    if (skipped) await bumpRev(db);
    const cases = src.filter(c => !HM_TEST.test([c.name, c.notes, c.address, (c.needs || []).join(' '), c.volunteer].join(' ')));
    await fillDistricts(db, cases); await checkPins(db, cases); await fillProvinces(db, cases);
    const known = new Map(), ids = cases.map(c => String(c.id));
    for (let i = 0; i < ids.length; i += 90) {
      const part = ids.slice(i, i + 90), { results } = await db.prepare(`SELECT id,hmHash,status,volunteer,hmStatus,hmVolunteer,localAt FROM cases WHERE id IN (${part.map(() => '?').join(',')})`).bind(...part).all();
      results.forEach(r => known.set(r.id, r));
    }
    const now = Date.now(), stmts = []; let inserted = 0, updated = 0;
    for (const c of cases) {
      const level = hmLevelCode(c.level), needs = (c.needs || []).join(', '), photos = JSON.stringify(c.photos || []), pin = c.pinCheck ? JSON.stringify(c.pinCheck) : '';
      const vol = String(c.volunteer || '').replace(/^'/, '');
      const data = [c.createdAt, c.updatedAt, c.status, vol, c.name, c.phone, c.notes, c.people, c.address, c.district, c.province, c.lat, c.lng, level, c.level, needs, c.org, c.pickedAt, c.doneAt, photos, pin, c.urgency];
      const hash = fnv(JSON.stringify(data)), row = known.get(String(c.id));
      if (row && row.hmHash === hash) continue;
      const fields = 'createdAt=?,hmUpdatedAt=?,name=?,phone=?,notes=?,people=?,address=?,district=?,province=?,lat=?,lng=?,level=?,levelText=?,needs=?,org=?,pickedAt=?,doneAt=?,photos=?,pinCheck=?,urgency=?,src=?,hmHash=?,hmStatus=?,hmVolunteer=?';
      const fv = [c.createdAt || now, c.updatedAt || null, clean(c.name, MAX.name), clean(c.phone, MAX.phone), clean(c.notes, MAX.notes), clampInt(c.people, 1, 99999, 1), clean(c.address, MAX.address),
        clean(c.district, MAX.district), clean(c.province, 40), c.lat, c.lng, level, clean(c.level, 60), needs, clean(c.org, 80), c.pickedAt || null, c.doneAt || null, photos, pin, clampInt(c.urgency, 1, 3, 1), 'helpme', hash, c.status, clean(vol, MAX.volunteer)];
      if (!row) {
        stmts.push(db.prepare(`INSERT INTO cases (id,status,volunteer,updatedAt,token,${fields.replace(/=\?/g, '')}) VALUES (?,?,?,?,?,${fv.map(() => '?').join(',')})`)
          .bind(String(c.id), c.status, clean(vol, MAX.volunteer), c.updatedAt || now, rand(16), ...fv)); inserted++;
      } else {
        const hmMoved = c.status !== row.hmStatus || clean(vol, MAX.volunteer) !== (row.hmVolunteer || '');
        const takeHm = hmMoved && (!row.localAt || (c.updatedAt || now) >= row.localAt);
        stmts.push(db.prepare(`UPDATE cases SET ${fields},status=?,volunteer=?,updatedAt=? WHERE id=?`)
          .bind(...fv, takeHm ? c.status : row.status, takeHm ? clean(vol, MAX.volunteer) : row.volunteer, now, String(c.id))); updated++;
      }
    }
    for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
    if (stmts.length) await bumpRev(db);
    const out = { ok: true, total: cases.length, inserted, updated, unchanged: cases.length - inserted - updated, at: Date.now() };
    await setMeta(db, 'hm_sync_result', JSON.stringify(out));
    return out;
  })().finally(() => { hmSyncP = null; });
  return hmSyncP;
}
const PHOTO_AI_PROMPT = 'This photo was sent by a person asking for flood rescue in Thailand. Look only at what is visible. ' +
  'Answer ONLY JSON: {"flood":"yes|no|unclear","depth_cm":number|null,"inside_house":true|false,"danger":"high|medium|low","note":"<=12 words, Thai"}. ' +
  'flood=yes only if standing flood water is clearly visible (not a wet road, puddle, river in its banks or reflection). depth_cm = water depth where people/houses are, estimated from legs, doors, cars, steps; null if unsure. ' +
  'inside_house=true if water is inside a building. danger=high if water is about waist-deep or more, fast current, people/elderly/children/patients stranded, or water near electrical outlets; medium if knee-deep; low otherwise.';
async function photoAiOne(env, id) {
  const r = await fetch(`https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w800`, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(15000) });
  if (!r.ok || !String(r.headers.get('content-type') || '').startsWith('image/')) return null;
  const buf = await r.arrayBuffer();
  if (buf.byteLength < 2000 || buf.byteLength > 3_000_000) return null;
  const out = await env.AI.run(CCTV_AI_MODEL, { messages: [{ role: 'user', content: [{ type: 'text', text: PHOTO_AI_PROMPT }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64(buf) } }] }], max_tokens: 140, temperature: 0 });
  const raw = out && (out.response ?? (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content));
  let j = raw && typeof raw === 'object' ? raw : {};
  if (typeof raw === 'string') { const m = raw.match(/\{[\s\S]*\}/); try { j = m ? JSON.parse(m[0]) : {}; } catch (e) {} }
  let flood = ['yes', 'no', 'unclear'].includes(j.flood) ? j.flood : 'unclear'; const depth = Number(j.depth_cm);
  if (flood === 'yes' && isFinite(depth) && depth > 0 && depth < 5) flood = 'unclear';
  return { flood, depth: flood === 'yes' && isFinite(depth) && depth > 0 ? Math.min(400, Math.round(depth)) : null, inside: !!j.inside_house && flood === 'yes', danger: ['high', 'medium', 'low'].includes(j.danger) ? j.danger : 'low', note: clean(j.note, 80) };
}
async function photoAiPass(env, db, max = 4) {
  if (!env.AI) return 0;
  const { results } = await db.prepare("SELECT id,photos,photoAi,status FROM cases WHERE src='helpme' AND photos IS NOT NULL AND photos NOT IN ('','[]') ORDER BY CASE status WHEN 'done' THEN 1 ELSE 0 END, createdAt DESC").all();
  let n = 0;
  for (const c of results) {
    if (n >= max) break;
    let ids = []; try { ids = JSON.parse(c.photos || '[]').filter(x => /^[-\w]{25,}$/.test(x)).slice(0, 3); } catch (e) {}
    if (!ids.length) continue;
    const key = fnv(ids.join(',')); let prev = null; try { prev = c.photoAi ? JSON.parse(c.photoAi) : null; } catch (e) {}
    if (prev && prev.key === key) continue;
    n++;
    const res = (await Promise.all(ids.map(id => photoAiOne(env, id).catch(() => null)))).filter(Boolean);
    const yes = res.filter(x => x.flood === 'yes'), rank = { high: 3, medium: 2, low: 1 };
    const sum = { key, at: Date.now(), n: res.length, flood: yes.length ? 'yes' : res.some(x => x.flood === 'no') ? 'no' : 'unclear',
      depth: yes.reduce((m, x) => Math.max(m, x.depth || 0), 0) || null, inside: yes.some(x => x.inside),
      danger: res.reduce((m, x) => rank[x.danger] > rank[m] ? x.danger : m, 'low'), note: (yes[0] || res[0] || {}).note || '' };
    await db.prepare('UPDATE cases SET photoAi=? WHERE id=?').bind(JSON.stringify(sum), c.id).run();
  }
  if (n) await bumpRev(db);
  return n;
}
async function helpmeCases(env, db) {
  let { results } = await db.prepare("SELECT * FROM cases WHERE src='helpme' AND COALESCE(hmStatus,'')<>'skip' ORDER BY createdAt").all();
  const last = Number(await getMeta(db, 'hm_sync_at')) || 0;
  if (!results.length) { try { await syncHelpme(env, db, true); } catch (e) {} ({ results } = await db.prepare("SELECT * FROM cases WHERE src='helpme' AND COALESCE(hmStatus,'')<>'skip' ORDER BY createdAt").all()); }
  else if (Date.now() - last > 180e3 && CTX && CTX.waitUntil) CTX.waitUntil(syncHelpme(env, db).catch(() => {}));
  const J = (v, d) => { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  return { ok: true, time: Date.now(), source: 'db', syncedAt: Number(await getMeta(db, 'hm_sync_at')) || null, cases: results.map(c => ({ id: c.id, createdAt: c.createdAt, updatedAt: c.updatedAt, doneAt: c.doneAt, status: c.status, urgency: c.urgency,
    people: c.people, lat: noPin(c) && c.glat != null ? c.glat : c.lat, lng: noPin(c) && c.glat != null ? c.glng : c.lng, needs: c.needs ? String(c.needs).split(/\s*,\s*/).filter(Boolean) : [], address: c.address || '', district: c.district || '', province: c.province || '', volunteer: c.volunteer || '',
    name: c.name || '', phone: c.phone || '', notes: c.notes || '', org: c.org || '', pickedAt: c.pickedAt || null, dupOf: c.dupOf || '', hqNote: c.hqNote || '', teamDoneAt: c.teamDoneAt || null, teamNote: c.teamNote || '', teamIssue: c.teamIssue || '', teamIssueAt: c.teamIssueAt || null, sevSet: c.sevSet || null, sevBy: c.sevBy || '', intake: parseIntake(c.intake), photos: J(c.photos, []), pinCheck: noPin(c) && c.glat != null ? { status: 'geocoded', label: c.glabel || '' } : J(c.pinCheck, null), photoAi: J(c.photoAi, null),
    level: c.level || '', levelText: c.levelText || '', bags: c.bags == null ? '' : c.bags, households: c.households == null ? '' : c.households, cctv: c.cctv || '', vulnerable: c.vulnerable ? String(c.vulnerable).split(/\s*,\s*/).filter(Boolean) : [] })) };
}
async function helpmeStatsLive(env, db) {
  return cached('helpme-stats-v4', 60, async () => {
    const cases = await helpmeAllCases(env); await fillDistricts(db, cases);
    const j = { ok: true, volunteer: true, cases };
    const TEST = HM_TEST, now = Date.now(), H = 3600e3;
    const all = (j.cases || []).filter(c => !TEST.test([c.name, c.notes, c.address, (c.needs || []).join(' '), c.volunteer].join(' ')));
    const P = c => Math.max(1, Number(c.people) || 1), sev = c => Math.min(3, Math.max(1, Number(c.urgency) || 1));
    const open = all.filter(c => c.status === 'open'), going = all.filter(c => c.status === 'going'), done = all.filter(c => c.status === 'done'), act = all.filter(c => c.status !== 'done');
    const med = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const p90 = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(.9 * s.length) - 1)]; };
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
      created: all.map(c => c.createdAt).filter(Boolean), finished: done.map(c => c.doneAt || c.updatedAt).filter(Boolean) };
  });
}
async function pullAll(db, b, env) {
  const [traffy, helpme] = await Promise.all([pullLeads(db).catch(e => ({ ok: false, error: String(e.message || e).slice(0, 80) })), pullHelpme(db, env).catch(e => ({ ok: false, error: String(e.message || e).slice(0, 80) }))]);
  const n = k => (traffy[k] || 0) + (helpme[k] || 0);
  return { ok: traffy.ok || helpme.ok, added: n('added'), rejected: n('rejected'), duplicate: n('duplicate'), scanned: n('scanned'), closed: helpme.closed || 0, filled: helpme.filled || 0, traffy, helpme };
}

async function chatSend(db, b) {
  const team = clean(b.team, MAX.volunteer), text = clean(b.text, 1000), from = b.from === 'team' ? 'team' : 'hq';
  const lat = num(b.lat, -90, 90), lng = num(b.lng, -180, 180);
  if (!team || (!text && lat == null)) return { ok: false, error: 'missing' };
  const kind = ['call', 'sos', 'case', 'voice'].includes(b.kind) ? b.kind : '';
  const link = kind === 'call' && (String(b.link || '').startsWith(MEET) || /^\/call\/#[0-9a-f]{12}\.[0-9a-f]{24}$/.test(String(b.link || ''))) ? String(b.link).slice(0, 300)
    : kind === 'voice' && /^\/api\?action=ptt_audio&n=\d+$/.test(String(b.link || '')) ? String(b.link) : '';
  const read = kind === 'voice' || !!b.read;
  const r = await db.prepare('INSERT INTO chat (team,sender,name,text,caseId,lat,lng,at,readHq,readTeam,kind,link) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(team, from, clean(b.name, 60), text, clean(b.caseId, 30), lat, lng, Date.now(), from === 'hq' || read ? 1 : 0, from === 'team' || read ? 1 : 0, kind, link).run();
  await setMeta(db, 'chat_rev', String(r.meta.last_row_id || Date.now()));
  await setMeta(db, 'chat_rev:' + team, String(r.meta.last_row_id || Date.now()));
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

const GISTDA_LAYERS = { '1day': 'flood/1day', '3days': 'flood/3days', '7days': 'flood/7days', '30days': 'flood/30days', freq: 'flood-freq' };
async function gistdaTile(env, layer, z, x, y) {
  if (!env.GISTDA_KEY) return new Response(null, { status: 404, headers: { 'x-gistda': 'no-key' } });
  const r = await fetch(`https://api-gateway.gistda.or.th/api/2.0/resources/maps/${GISTDA_LAYERS[layer]}/tms/${z}/${x}/${y}?api_key=${encodeURIComponent(env.GISTDA_KEY)}`,
    { headers: UA, cf: { cacheTtl: 1800, cacheEverything: true } });
  if (!r.ok || !String(r.headers.get('content-type') || '').startsWith('image/')) return new Response(null, { status: 502 });
  return new Response(r.body, { headers: { 'content-type': r.headers.get('content-type'), 'cache-control': 'public, max-age=1800' } });
}

let ENV = {};
async function api(request, env) {
  ENV = env;
  const db = env.DB;
  const gm = new URL(request.url).pathname.match(/^\/api\/gistda\/(1day|3days|7days|30days|freq)\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})(?:\.png)?$/);
  if (gm && request.method === 'GET') return gistdaTile(env, gm[1], gm[2], gm[3], gm[4]);
  if (request.method === 'GET' && new URL(request.url).searchParams.get('action') === 'news') { try { return json(await newsData()); } catch (e) { return json({ ok: false, error: 'news_unavailable' }); } }
  const trk = new URL(request.url).pathname.match(/^\/api\/track(?:\/([A-Za-z0-9]{10,40}))?\/?$/);
  if (!db) return json({ ok: false, error: 'no_database', hint: 'ผูก D1 ชื่อ DB กับโปรเจกต์ Pages ก่อน' }, 500);
  await init(db);
  const url = new URL(request.url);
  if (trk && ['GET', 'POST'].includes(request.method)) return trackApp(db, request, url, trk[1]);
  if (url.pathname.replace(/\/$/, '') === '/api/sms-in' && ['GET', 'POST'].includes(request.method)) return smsIn(db, request, url);
  if (request.method === 'GET') {
    const p = Object.fromEntries(url.searchParams);
    if (!p.key && request.headers.get('x-hm-key')) p.key = request.headers.get('x-hm-key');
    if (p.t && !p.key) p.key = await ticketKey(db, env, p.t);
    if (p.key && !await keyGuard(db, env, request, p.key)) return json({ ok: false, error: 'too_many' }, 429);
    WRC = await wrAuth(db, p.key); if (WRC) p.key = env.VOLUNTEER_KEY;
    { const sf = !WRC && await staffAuth(db, p.key); if (sf) { const st = RQ.getStore(); if (st) st.staff = sf; p.key = env.VOLUNTEER_KEY; } }
    if (p.key && !WRC && !isVol(env, p.key)) await keyFail(db, request, p.key);
    if (WRC) { if (!WR_GET_OK.has(p.action)) return json({ ok: false, error: 'central_only' }); const fr = await wrGet(env, db, p); if (fr) return json(fr); }
    const vol = isVol(env, p.key);
    switch (p.action) {
      case 'list': {
        const since = Number(p.since) || 0;
        const { results } = await db.prepare("SELECT * FROM cases WHERE updatedAt>? AND COALESCE(src,'')<>'helpme' ORDER BY createdAt").bind(since).all();
        if (vol) { const fx = fixOwnPins(db, results.map(r => ({ ...r }))).catch(() => {}); if (CTX && CTX.waitUntil) CTX.waitUntil(fx); }
        return json({ ok: true, cases: results.map(r => outCase(r, vol)), volunteer: vol });
      }
      case 'rev': { const r = await db.prepare("SELECT v FROM meta WHERE k='rev'").first(); return json({ ok: true, rev: r ? r.v : '0' }); }
      case 'live_stream': return vol ? liveStream(db, p) : json({ ok: false, error: 'not_volunteer' });
      case 'teams': {
        const t = await readTeams(db);
        if (vol) return json({ ok: true, teams: t });
        return json({ ok: true, public: true, teams: t.filter(x => Date.now() - x.updatedAt < 30 * 60e3).map(x => ({ team: x.team, lat: Math.round(x.lat * 1000) / 1000, lng: Math.round(x.lng * 1000) / 1000, updatedAt: x.updatedAt, busy: !!x.caseId })) });
      }
      case 'places': return json(await listPlaces(db));
      case 'roster': return json(vol ? await listRoster(db) : { ok: false, error: 'not_volunteer' });
      case 'stock': return json(vol ? await listStock(db) : { ok: false, error: 'not_volunteer' });
      case 'board_list': return json(vol ? await boardList(db, p) : { ok: false, error: 'not_volunteer' });
      case 'board_img': return json(vol ? await boardImg(db, p) : { ok: false, error: 'not_volunteer' });
      case 'rallies': return json(vol ? await rallyList(db) : { ok: false, error: 'not_volunteer' });
      case 'kb_order': return json(vol ? await kbOrderGet(db) : { ok: false, error: 'not_volunteer' });
      case 'intel_brief': return json(vol ? { ok: true, ...(await intelBrief(db)) } : { ok: false, error: 'not_volunteer' });
      case 'dams': try { return json(await damData()); } catch (e) { return json({ ok: false, error: 'dams_unavailable' }); }
      case 'water': try { return json(await waterData()); } catch (e) { return json({ ok: false, error: 'water_unavailable' }); }
      case 'outreach': return json(await helpmeOutreach(db, env));
      case 'sheet_places': try { const [s, n] = await Promise.all([sheetPoints(env, db, 'shelters').catch(() => []), sheetPoints(env, db, 'network').catch(() => [])]);
        return json({ ok: true, shelters: s.filter(x => x.lat != null), network: n.filter(x => x.lat != null) }); } catch (e) { return json({ ok: false, error: 'sheet_unavailable' }); }
      case 'cctv_ai': if (!vol) return json({ ok: false, error: 'not_volunteer' }); try { return json(await cctvAiCheck(env, p)); } catch (e) { return json({ ok: false, error: 'cctv_ai_unavailable' }); }
      case 'hm_nudge': return json(await hmNudge(env, db));
      case 'hm_sync': if (!vol && Date.now() - (Number(await getMeta(db, 'hm_tick_at')) || 0) < 25e3) return json({ ok: true, skipped: true });
        await setMeta(db, 'hm_tick_at', String(Date.now()));
        try { const r = await syncHelpme(env, db, false); let ai = 0, dc = null, intel = null, geo = null; const ex = Date.now() - (Number(await getMeta(db, 'hm_extra_at')) || 0) > 50e3;
        if (ex) { await setMeta(db, 'hm_extra_at', String(Date.now())); try { ai = await photoAiPass(env, db, 4); } catch (e) {} try { intel = await intelTick(env, db); } catch (e) {} try { dc = await discordTick(env, db); } catch (e) {} try { geo = await geocodePass(env, db, 4); } catch (e) {} } return json({ ...r, photoAi: ai, discord: dc && dc.ok ? dc.alerts : undefined, geo, intel }); } catch (e) { let intel = null; try { intel = await intelTick(env, db); } catch (e2) {} return json({ ok: false, error: 'sync_failed', detail: String(e.message || e).slice(0, 120), intel }); }
      case 'helpme_cases': if (!vol) return json({ ok: false, error: 'not_volunteer' }); try { return json(await helpmeCases(env, db)); } catch (e) { return json({ ok: false, error: 'helpme_unavailable' }); }
      case 'helpme_stats': if (!vol) return json({ ok: false, error: 'not_volunteer' }); try { return json(await helpmeStats(env, db)); } catch (e) { return json({ ok: false, error: 'helpme_unavailable' }); }
      case 'staff_list': return json(vol ? await staffList(db) : { ok: false, error: 'not_volunteer' });
      case 'staff_me': { const st = RQ.getStore(); return json(vol ? { ok: true, staff: st && st.staff || null, admin: staffAdmin() } : { ok: false, error: 'not_volunteer' }); }
      case 'audit_list': return json(vol ? await auditList(db, p) : { ok: false, error: 'not_volunteer' });
      case 'gistda_status': return json({ ok: true, enabled: !!env.GISTDA_KEY, layers: Object.keys(GISTDA_LAYERS) });
      case 'cctv': try { return json(await allCams()); } catch (e) { return json({ ok: false, error: 'cctv_unavailable' }); }
      case 'zones': return json(vol ? await listZones(db) : { ok: false, error: 'not_volunteer' });
      case 'warrooms': return json(vol ? await listWarrooms(db) : { ok: false, error: 'not_volunteer' });
      case 'broadcasts': return json(await listBroadcasts(db, false));
      case 'live_view': return json(await liveView(db, p.v));
      case 'hazards': try { return json(await hazardList(db, env)); } catch (e) { return json({ ok: false, error: 'hazards_unavailable' }); }
      case 'broadcasts_all': return json(vol ? await listBroadcasts(db, true) : { ok: false, error: 'not_volunteer' });
      case 'discord_cfg': return json(vol && !WRC ? dcPublic(await dcCfg(db)) : { ok: false, error: 'central_only' });
      case 'apps_list': return json(vol ? await appsList(db) : { ok: false, error: 'not_volunteer' });
      case 'warrooms_public': { const { results } = await db.prepare("SELECT id,name,province FROM warrooms WHERE active=1 ORDER BY province, name").all(); return json({ ok: true, warrooms: results }); }
      case 'warroom_public': { const r = await db.prepare('SELECT name FROM warrooms WHERE id=? AND active=1').bind(clean(p.id, 20)).first(); return json(r ? { ok: true, name: r.name } : { ok: false }); }
      case 'wr_users': return json(vol ? await wrUsers(db) : { ok: false, error: 'not_volunteer' });
      case 'feedback_list': {
        if (!vol || WRC) return json({ ok: false, error: 'central_only' });
        const { results } = await db.prepare('SELECT * FROM feedback ORDER BY done, at DESC LIMIT 200').all();
        return json({ ok: true, feedback: results.map(f => ({ n: f.n, at: f.at, page: f.page || '', by: f.by_ || '', room: f.room || '', text: f.text || '', done: !!f.done })) });
      }
      case 'covered': return json(await listCovered(db));
      case 'backup_status': return json(vol ? await backupStatus(env) : { ok: false, error: 'not_volunteer' });
      case 'leads': return json(vol ? await listLeads(db, p) : { ok: false, error: 'not_volunteer' });
      case 'chat': { if (p.tk) { const t = await teamFrom(env, db, p); return json(t ? await chatList(db, { ...p, team: t.name }) : { ok: false, error: 'bad_link' }); }
        return json(vol ? await chatList(db, p) : { ok: false, error: 'not_volunteer' }); }
      case 'photo_index': { if (!vol) return json({ ok: false, error: 'not_volunteer' }); const { results } = await db.prepare("SELECT caseId, n FROM case_photo WHERE kind='handoff' AND at>? ORDER BY n").bind(Date.now() - 30 * 864e5).all(); const m = {}; for (const r of results) (m[r.caseId] = m[r.caseId] || []).push(r.n); return json({ ok: true, m }); }
      case 'case_photos': { if (vol) return json(await casePhotos(db, p.id)); const t = p.tk && await teamFrom(env, db, p); if (!t) return json({ ok: false, error: 'not_volunteer' }); const c = await db.prepare('SELECT volunteer FROM cases WHERE id=?').bind(clean(p.id, 40)).first(); return json(c && String(c.volunteer || '').replace(/^'/, '').trim() === t.name ? await casePhotos(db, p.id) : { ok: false, error: 'not_your_case' }); }
      case 'case_photo': { if (vol) return casePhotoImg(db, p.n); const t = p.tk && await teamFrom(env, db, p); return t ? casePhotoImg(db, p.n, t.name) : new Response('forbidden', { status: 403 }); }
      case 'route_list': return json(vol ? await routeList(db) : { ok: false, error: 'not_volunteer' });
      case 'road_q': { if (!vol) return json({ ok: false, error: 'not_volunteer' }); const h = clampInt(p.hours, 1, 24 * 90, 72), G = 0.0003;
        const { results } = await db.prepare('SELECT ROUND(lat/?) gy, ROUND(lng/?) gx, AVG(rms) rms, MAX(peak) peak, SUM(bumps) bumps, COUNT(*) n, COUNT(DISTINCT team) teams, MAX(at) at, AVG(spd) spd FROM road_q WHERE at>? GROUP BY gy, gx ORDER BY at DESC LIMIT 6000').bind(G, G, Date.now() - h * 3600e3).all();
        return json({ ok: true, g: G, cells: results.map(r => [+(r.gy * G).toFixed(5), +(r.gx * G).toFixed(5), +(+r.rms).toFixed(2), +(+r.peak).toFixed(1), r.bumps, r.n, r.teams, r.at, Math.round(r.spd)]) }); }
      case 'ptt_auth': return json(vol || p.tk ? await pttAuth(env, db, p, vol) : { ok: false, error: 'not_volunteer' });
      case 'ptt_list': case 'ptt_audio': { const au = vol || p.tk ? await pttAuth(env, db, p, vol) : null; if (!au || !au.ok) return json({ ok: false, error: 'not_volunteer' }); const chans = au.chans.map(c => c.id);
        if (p.action === 'ptt_list') return json(await pttList(db, p, chans));
        const row = await db.prepare('SELECT ch FROM ptt WHERE n=?').bind(Number(p.n) || 0).first(); if (!row || !chans.includes(row.ch || 'all')) return new Response('not found', { status: 404 }); return pttAudio(db, p); }
      case 'team_me': { const t = await teamFrom(env, db, p); return json(t ? await teamMe(db, t) : { ok: false, error: p.tk ? 'bad_link' : 'not_volunteer' }); }
      case 'team_stream': { const t = await teamFrom(env, db, p); return t ? teamStream(db, t.name) : json({ ok: false, error: p.tk ? 'bad_link' : 'not_volunteer' }); }
      case 'team_cases': { const t = await teamFrom(env, db, p); return json(t ? await teamCases(db) : { ok: false, error: p.tk ? 'bad_link' : 'not_volunteer' }); }
      case 'team_track': return json(vol ? await teamTrack(db, p) : { ok: false, error: 'not_volunteer' });
      case 'chat_threads': return json(vol ? await chatThreads(db) : { ok: false, error: 'not_volunteer' });
      case 'chat_rev': return json(vol ? { ok: true, rev: await getMeta(db, 'chat_rev') || '0' } : { ok: false, error: 'not_volunteer' });
      default: return json({ ok: true, service: 'umplus-cloudflare', time: new Date().toISOString() });
    }
  }
  if (request.method === 'POST') {
    let b = {};
    try { b = JSON.parse(await request.text() || '{}'); } catch (e) { return json({ ok: false, error: 'bad_json' }); }
    { const st = RQ.getStore(); if (st && b && typeof b === 'object') { st.body = b; st.k0 = String(b.key || ''); st.ip = request.headers.get('cf-connecting-ip') || ''; if (/^st_/.test(st.k0)) Object.defineProperty(b, '_raw', { value: st.k0, enumerable: false }); } }
    if (b.action === 'app_apply') return json(await appApply(db, b, request.headers.get('cf-connecting-ip') || ''));
    if ((b.action === 'app_login' || b.action === 'wr_login') && !await ipLimit(db, request.headers.get('cf-connecting-ip') || '', 'login')) return json({ ok: false, error: 'too_many' });
    if (b.action === 'app_login') return json(await appLogin(db, b));
    if (b.action === 'wr_login') return json(await wrLogin(db, b));
    if (b.action === 'wr_logout') return json(await wrLogout(db, b));
    if (b.action === 'staff_login') { if (!await ipLimit(db, request.headers.get('cf-connecting-ip') || '', 'login')) return json({ ok: false, error: 'too_many' }); return json(await staffLogin(db, b)); }
    if (b.action === 'staff_logout') return json(await staffLogout(db, b));
    if (b.key && !await keyGuard(db, env, request, b.key)) return json({ ok: false, error: 'too_many' }, 429);
    WRC = await wrAuth(db, b.key);
    { const sf = !WRC && await staffAuth(db, b.key); if (sf) { const st = RQ.getStore(); if (st) { st.staff = sf; st.k0 = env.VOLUNTEER_KEY; } b.key = env.VOLUNTEER_KEY; b.by = sf.name; } }
    if (b.key && !WRC && !isVol(env, b.key) && !b.tk) await keyFail(db, request, b.key);
    if (b.action === 'ticket') { const st = RQ.getStore(), raw = st && st.staff ? st.body && st.body._raw : null; if (!WRC && !isVol(env, b.key)) return json({ ok: false, error: 'not_volunteer' }); return json(await ticketMake(db, env, raw || (WRC ? st.k0 : b.key))); }
    if (WRC) {
      if (WR_DENY.includes(b.action) || !WR_POST_OK.has(b.action) || (b.action === 'warroom_save' && clean((b.warroom || {}).id, 20) !== WRC.id)) return json({ ok: false, error: 'central_only' });
      const why = await wrPostCheck(db, b); if (why) return json({ ok: false, error: why });
      b.key = env.VOLUNTEER_KEY;
    }
    if (UNDO_SPEC[b.action]) { const st = RQ.getStore(); if (st) st.before = await undoSnap(db, b).catch(() => null); }
    if (b.action === 'ai_chat' && b.stream) {
      if (!isVol(env, b.key)) return json({ ok: false, error: 'not_volunteer' });
      const r = await aiStream(b, db);
      return r || json({ ok: false, error: 'ai_failed' });
    }
    if (b.action === 'create') return json(await createCase(db, b, request.headers.get('cf-connecting-ip') || ''));
    if (b.action === 'track') return json(await trackCase(db, b));
    if (CALL_POST[b.action]) { const c = await callAuth(db, b); return json(c ? await CALL_POST[b.action](db, c, b, env) : { ok: false, error: 'bad_call' }); }
    const needKey = { staff_save: staffSave, route_set: routeSet, route_clear: routeClear, ptt_send: async (db, b) => { const au = await pttAuth(ENV, db, b, true); return pttSend(db, { sender: au.name || 'ศูนย์', kind: 'hq', name: clean(b.by, 60), chans: (au.chans || []).map(c => c.id) }, b); }, kb_order: kbOrderSave, board_save: boardSave, board_move: boardMove, board_delete: boardDelete, board_img_add: boardImgAdd, board_img_del: boardImgDel, rally_save: rallySave, rally_close: rallyClose, silent_ack: async (db, b) => { await setMeta(db, 'silent_ack:' + clean(b.team, MAX.volunteer), String(Date.now())); return { ok: true }; }, intel_refresh: (db) => intelTick(ENV, db, true), audit_undo: auditUndo, update: updateCase, ping: pingTeam, place: savePlace, roster_save: saveRoster, stock_item: saveStockItem, stock_move: moveStock, covered_add: addCovered, import_cases: importCases, zone_save: saveZone, bag_pack: packBags,
      lead_add: addLeads, chat_send: (db, b) => chatSend(db, { ...b, kind: '', link: '' }), chat_read: chatRead, lead_decide: decideLead, lead_settings: saveLeadSettings,
      team_link: renewTeamLink, warroom_save: saveWarroom, warroom_link: warroomLink, broadcast_save: saveBroadcast, ai_chat: aiChat, sms_cfg: smsCfg, wr_user_save: wrUserSave, app_decide: appDecide, discord_save: discordSave, discord_test: discordTest, feedback_save: saveFeedback, feedback_done: doneFeedback, hazard_save: saveHazard, hazard_close: closeHazard, env_check: (db, b) => envCheck(ENV, b), broadcast_cancel: cancelBroadcast, team_gmaps: (db, b) => setTeamGmaps(db, clean(b.team, MAX.volunteer), b.gmaps), warroom_staff: saveWarroomStaff, team_warroom: setTeamWarroom, hq_phone: setHqPhone, sos_ack: ackSos, hq_call: (db, b) => callStart(db, clean(b.team, MAX.volunteer), 'hq', b) };
    if (TEAM_POST[b.action] && (b.tk || ['team_ping', 'team_status', 'team_case', 'team_sos', 'call_start', 'rally_resp', 'team_profile'].includes(b.action) || (b.action === 'ptt_send' && b.team))) {
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

async function handle(request, env, ctx) {
  {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const origin = request.headers.get('origin') || '';
      const cors = /^https:\/\/(been6505\.github\.io|[a-z0-9-]+\.ummatee-help\.pages\.dev|admin-um-help\.pages\.dev|admin-helpme\.pages\.dev|admin\.um\.help|(www\.|admin\.|center\.|central\.)?helpme4u\.com)$/.test(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' } : {};
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      let res;
      try { res = await api(request, env); }
      catch (e) { res = json({ ok: false, error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500); }
      { const st = RQ.getStore(); if (request.method === 'POST' && st && st.body && !AUDIT_SKIP.has(st.body.action)) {
        if (st.before) await undoAfter(env, st, res.clone()).catch(() => {});
        const p = auditLog(env, st, res.clone()).catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(p); } }
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    }
    const wr = url.pathname.match(/^\/wr\/([A-Za-z0-9]{3,20})\/?$/);
    if (wr) { const to = new URL('/central/warroom/', url); to.searchParams.set('wr', wr[1]); const k = url.searchParams.get('k'); if (k) to.searchParams.set('k', k); return Response.redirect(to.toString(), 302); }
    const old = url.pathname.match(/^\/(?:admin|center)(\.html|\/.*)?$/);
    if (old) { url.pathname = old[1] && old[1] !== '.html' ? '/central' + old[1] : '/central'; return Response.redirect(url.toString(), 301); }
    const res = await env.ASSETS.fetch(request);
    if (res.ok && request.method === 'GET') {
      const ver = url.searchParams.has('v') && /\.(js|css|png|jpe?g|svg|webp|woff2?|ico)$/.test(url.pathname), img = !ver && /^\/assets\/.+\.(png|jpe?g|svg|webp)$/.test(url.pathname);
      if (ver || img) { const h = new Headers(res.headers); h.set('cache-control', ver ? 'public, max-age=31536000, immutable' : 'public, max-age=604800'); return new Response(res.body, { status: res.status, headers: h }); }
    }
    return res;
  }
}
export default {
  fetch(request, env, ctx) { return RQ.run({ wrc: null, ctx }, () => handle(request, env, ctx)); },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      for (let i = 0; i < 5; i++) { const r = await backupToSheet(env); if (!r.ok || !r.more) break; }
    })());
  }
};
