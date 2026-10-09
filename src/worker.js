import { AsyncLocalStorage } from 'node:async_hooks';
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
  `CREATE INDEX IF NOT EXISTS team_track_team ON team_track(team, n)`,
  // โทรในระบบ (WebRTC): ห้องสาย 1 ต่อ 1 + ข้อความนัดเชื่อมต่อ (offer/answer/ice) · เก็บ 1 วัน
  `CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, secret TEXT, mode TEXT, team TEXT, caller TEXT, name TEXT, createdAt INTEGER, endedAt INTEGER)`,
  `CREATE TABLE IF NOT EXISTS call_sig (n INTEGER PRIMARY KEY AUTOINCREMENT, call TEXT, peer TEXT, dest TEXT, kind TEXT, data TEXT, at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS call_sig_call ON call_sig(call, n)`,
  // War Room ย่อย: ศูนย์สั่งการแต่ละพื้นที่ (ขอบเขต = วงกลม และ/หรือรายชื่อเขต) + ทีมงานประจำห้อง
  `CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, kind TEXT, status TEXT, name TEXT, phone TEXT, province TEXT, wrPref TEXT, username TEXT, salt TEXT, hash TEXT, data TEXT, result TEXT, fails INTEGER DEFAULT 0, lockUntil INTEGER, ip TEXT, createdAt INTEGER, decidedAt INTEGER, decidedBy TEXT, note TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS applications_u ON applications(kind, username)`,
  `CREATE TABLE IF NOT EXISTS wr_users (id TEXT PRIMARY KEY, warroom TEXT, username TEXT, name TEXT, role TEXT, salt TEXT, hash TEXT, active INTEGER, fails INTEGER DEFAULT 0, lockUntil INTEGER, lastLogin INTEGER, createdAt INTEGER, by_ TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS wr_users_u ON wr_users(warroom, username)`,
  `CREATE TABLE IF NOT EXISTS wr_sessions (token TEXT PRIMARY KEY, userId TEXT, warroom TEXT, expires INTEGER, at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS warrooms (id TEXT PRIMARY KEY, name TEXT, color TEXT, lat REAL, lng REAL, radius INTEGER, districts TEXT, address TEXT, phone TEXT, lead TEXT, note TEXT, active INTEGER, createdAt INTEGER, updatedAt INTEGER, by_ TEXT)`,
  // ประกาศแจ้งเตือนรายพื้นที่ (ขึ้นที่หน้าบ้าน Help Me, หน้าทีม และทุกหน้า CENTRAL)
  `CREATE TABLE IF NOT EXISTS feedback (n INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, page TEXT, by_ TEXT, room TEXT, text TEXT, done INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS broadcasts (id TEXT PRIMARY KEY, level TEXT, title TEXT, body TEXT, link TEXT, scope TEXT, provinces TEXT, districts TEXT, lat REAL, lng REAL, radiusKm REAL, createdAt INTEGER, expiresAt INTEGER, cancelledAt INTEGER, by_ TEXT, warroom TEXT)`,
  // รายงานภัยที่ศูนย์ปักหมุดเอง (หลุมยุบ ดินถล่ม น้ำป่า ฯลฯ ที่ไม่มีแหล่งข้อมูลอัตโนมัติ)
  `CREATE TABLE IF NOT EXISTS hazard_reports (id TEXT PRIMARY KEY, type TEXT, lat REAL, lng REAL, radiusM INTEGER, note TEXT, level TEXT, createdAt INTEGER, expiresAt INTEGER, closedAt INTEGER, by_ TEXT)`,
  `CREATE TABLE IF NOT EXISTS warroom_staff (id TEXT PRIMARY KEY, wr TEXT, name TEXT, role TEXT, phone TEXT, shift TEXT, note TEXT, active INTEGER, updatedAt INTEGER)`
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
    for (const [t, col] of [['roster', 'token TEXT'], ['roster', 'sosAt INTEGER'], ['roster', 'sosAck INTEGER'], ['teams_live', 'battery INTEGER'], ['teams_live', 'appAt INTEGER'], ['teams_live', 'speed REAL'],
      ['teams_live', 'heading REAL'], ['chat', 'kind TEXT'], ['chat', 'link TEXT'], ['roster', 'warroom TEXT'], ['stock', 'warroom TEXT'], ['warrooms', 'kind TEXT'], ['warrooms', 'province TEXT'], ['roster', 'gmaps TEXT'],
      ['cases', 'src TEXT'], ['cases', 'hmHash TEXT'], ['cases', 'hmStatus TEXT'], ['cases', 'hmVolunteer TEXT'], ['cases', 'hmUpdatedAt INTEGER'], ['cases', 'localAt INTEGER'],
      ['cases', 'photos TEXT'], ['cases', 'province TEXT'], ['cases', 'org TEXT'], ['cases', 'dupOf TEXT'], ['cases', 'glat REAL'], ['cases', 'glng REAL'], ['cases', 'glabel TEXT'], ['cases', 'gtry INTEGER'], ['cases', 'gai INTEGER'], ['cases', 'pickedAt INTEGER'], ['cases', 'doneAt INTEGER'], ['cases', 'pinCheck TEXT'], ['cases', 'levelText TEXT'], ['cases', 'photoAi TEXT'], ['warrooms', 'token TEXT']]) { try { await db.prepare(`ALTER TABLE ${t} ADD COLUMN ${col}`).run(); } catch (e) {} }
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
const ctEq = (a, b) => { a = String(a || ''); b = String(b || ''); if (!a || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
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

const aiText = out => { if (!out) return ''; if (typeof out.response === 'string') return out.response; if (out.response && typeof out.response === 'object') return JSON.stringify(out.response); const m = out.choices && out.choices[0] && out.choices[0].message; return m && typeof m.content === 'string' ? m.content : ''; };
const noPin = r => r.lat == null || r.lat === '' || !Number(r.lat);
function outCase(r, full) {
  const o = { id: r.id, createdAt: r.createdAt, status: r.status, urgency: r.urgency, name: r.name || '', phone: r.phone || '', district: r.district || '',
    people: r.people, address: r.address || '', lat: r.lat == null ? '' : r.lat, lng: r.lng == null ? '' : r.lng, level: r.level || '',
    needs: r.needs ? String(r.needs).split(/\s*,\s*/).filter(Boolean) : [], vulnerable: r.vulnerable ? String(r.vulnerable).split(/\s*,\s*/).filter(Boolean) : [],
    notes: r.notes || '', volunteer: r.volunteer || '', updatedAt: r.updatedAt, households: r.households == null ? '' : r.households,
    bags: r.bags == null ? '' : r.bags, cctv: r.cctv || '', pickedAt: r.pickedAt || null, doneAt: r.doneAt || null, dupOf: r.dupOf || '' };
  if (noPin(r) && r.glat != null) { o.lat = r.glat; o.lng = r.glng; o.pinCheck = { status: 'geocoded', label: r.glabel || '' }; }
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
/* ---------- หาหมุดจากที่อยู่ ให้เคสที่ไม่มีพิกัด ----------
   cron ทุกนาที ทำครั้งละ 4 เคส · Photon → Nominatim · จำกัดในประเทศไทย · ขยายคำย่อ ต./อ./จ.
   เก็บใน glat/glng/glabel (ไม่ทับ lat/lng ที่ซิงจากชีต Help Me) · ค้นไม่เจอ = รอ 6 ชม. แล้วลองใหม่ */
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
  return { q: must.length ? q.filter((x, i, arr) => x[0] && arr.findIndex(y => y[0] === x[0]) === i) : [], prov, must }; // ไม่มีตำบล/อำเภอ = ที่อยู่กว้างเกิน ไม่เดา
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
/* AI อ่านที่อยู่ที่กำกวม (ชื่อมัสยิด/หมู่บ้าน/ซอย/คลอง สะกดผิด เขียนติดกัน) → จังหวัด/อำเภอ/ตำบล + คำค้น แล้วค้นหมุด
   ยอมรับเฉพาะผลที่อยู่ในจังหวัดที่ AI ระบุ (และอำเภอ/ตำบลตรงถ้ามี) · AI ไม่มั่นใจ = ไม่ปักหมุด */
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
  if (c.province && !String(c.province).includes(prov) && !prov.includes(String(c.province))) return null; // ขัดกับจังหวัดที่รู้อยู่แล้ว
  const am = String(j.amphoe || '').replace(/^(อำเภอ|เขต)/, '').trim(), tb = String(j.tambon || '').replace(/^(ตำบล|แขวง)/, '').trim();
  const must = [tb, am].map(x => x.replace(/^เมือง/, '')).filter(x => /^[ก-๙]{2,}/.test(x));
  const qs = [...(Array.isArray(j.queries) ? j.queries : []).map(String), [j.place, am, prov].filter(Boolean).join(' '), [j.road, am, prov].filter(Boolean).join(' '), tb && `${tb} ${am} ${prov}`, am && `${am} ${prov}`]
    .map(x => String(x || '').trim()).filter((x, i, a) => x.length > 3 && a.indexOf(x) === i).slice(0, 5);
  // AI เดาภูมิศาสตร์ผิดได้: ยอมรับเฉพาะผลที่ชื่อสถานที่ (ตามโครงพยัญชนะ ทนคำสะกดผิด) ปรากฏในที่อยู่เดิม
  const sk = x => String(x || '').replace(/[ะ-ฺเ-๎\s.\-,()/]/g, '');
  const addrSk = sk(c.address), GEN = /^(คลอง|หมู่|บ้าน|ซอย|ถนน|มัสยิด|วัด|ตลาด|โรงเรียน|ชุมชน|จังหวัด|อำเภอ|ตำบล|แขวง|เขต|สถานี|ประเทศไทย|เมือง|บึง|หนอง|ทุ่ง|นา)/,
    inAddr = label => String(label).split(/[·,\s]+/).map(w => w.replace(GEN, '')).filter(w => !/\d/.test(w)).map(sk).some(t => t.length >= 4 && addrSk.includes(t)); // ต้องตรงชื่อเฉพาะ ไม่ใช่คำทั่วไป
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
  // เคสที่วิธีปกติหาไม่เจอ: ให้ AI ช่วยอ่าน — ปิดไว้ (AI_GEO=false): ทดสอบแล้ว AI เดาภูมิศาสตร์ไทยผิดบ่อย หมุดผิดอันตรายกว่าไม่มีหมุด
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
/* Hermes บนคลาวด์ (Cloudflare Workers AI) สำหรับเครื่องที่ไม่มี Local AI เช่น มือถือ · ใช้ได้เฉพาะผู้มีรหัสอาสา/ลิงก์ War Room */
const HERMES_MODELS = ['@cf/aisingapore/gemma-sea-lion-v4-27b-it', '@cf/meta/llama-3.3-70b-instruct-fp8-fast']; // ภาษาไทยดี · สำรอง (Hermes ถูกถอดจาก Workers AI แล้ว)
async function aiChat(db, b) {
  if (!ENV || !ENV.AI) return { ok: false, error: 'ai_unavailable' };
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-16).map(m => ({ role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user', content: String(m.content || '').slice(0, 16000) }));
  if (!msgs.length) return { ok: false, error: 'empty' };
  let total = msgs.reduce((a, m) => a + m.content.length, 0);
  while (total > 20000 && msgs.length > 2) { const i = msgs.findIndex((m, k) => k > 0 && m.role !== 'system'); if (i < 0) break; total -= msgs[i].content.length; msgs.splice(i, 1); }
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
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-16).map(m => ({ role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user', content: String(m.content || '').slice(0, 16000) }));
  let total = msgs.reduce((a, m) => a + m.content.length, 0);
  while (total > 20000 && msgs.length > 2) { const i = msgs.findIndex((m, k) => k > 0 && m.role !== 'system'); if (i < 0) break; total -= msgs[i].content.length; msgs.splice(i, 1); }
  return msgs;
}
async function aiStream(b) {
  if (!ENV || !ENV.AI) return null;
  const msgs = aiMsgs(b);
  if (!msgs.length) return null;
  for (const model of HERMES_MODELS) {
    try {
      const st = await ENV.AI.run(model, { messages: msgs, stream: true, max_tokens: Math.min(Number(b.max_tokens) || 700, 1500), temperature: Math.min(Math.max(Number(b.temperature) || 0.3, 0), 1) });
      return new Response(st, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', 'x-ai-model': model } });
    } catch (e) {}
  }
  return null;
}
/* ---------- Discord: AI HELP ส่งแจ้งเตือนเข้าห้อง (Webhook · ทางเดียว) ----------
   ตั้งค่าที่หน้า ตั้งค่า (CENTRAL เท่านั้น) · cron ทุกนาที (hm_sync) เรียก discordTick
   ส่ง: เคสด่วนมากใหม่ · SOS จากทีม · เคสด่วนมากรอเกิน 30 นาทีไม่มีทีม · สรุปสถานการณ์ทุก N ชม. (AI เขียน)
   ไม่ส่งชื่อ/เบอร์ผู้แจ้ง · มีลิงก์เข้า CENTRAL (ต้องใช้รหัส) */
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
  if (embeds.length && posted) await setMeta(db, 'dc_sent', JSON.stringify(sent.slice(-800))); // ส่งไม่ผ่าน = ลองใหม่รอบหน้า
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
/* ข้อเสนอแนะ/แจ้งปัญหาจากทีมงาน (ปุ่มในทุกหน้า) · CENTRAL ดูและปิดได้ที่แดชบอร์ด */
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
  const meta = !!(b.bagsOnly || b.metaOnly) && r.status === b.status;
  const sets = [], vals = [];
  let bags = null;
  if (b.bags !== undefined && b.bags !== null) { bags = b.bags === '' ? null : clampInt(b.bags, 0, 9999, 0); sets.push('bags=?'); vals.push(bags); }
  if (b.cctv !== undefined && ['flood', 'clear', ''].includes(String(b.cctv))) {
    const t = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    sets.push('cctv=?'); vals.push(b.cctv ? b.cctv + '|' + t : '');
  }
  // รวมเคสซ้ำ: ชี้ไปเคสหลัก (ไม่นับเป็นเคสที่ช่วยแล้ว) · ส่ง '' เพื่อยกเลิก
  if (b.dupOf !== undefined) { sets.push('dupOf=?'); vals.push(clean(b.dupOf, 40)); }
  if (!meta) {
    sets.push('status=?', 'updatedAt=?', 'localAt=?'); vals.push(b.status, Date.now(), Date.now()); // localAt: ศูนย์แก้เอง (ใช้ตัดสินกับข้อมูลที่ซิงก์จาก Help Me)
    // เวลามีทีมรับ / ช่วยเสร็จ (ใช้วัดตัวชี้วัด) · บันทึกครั้งแรกที่เปลี่ยนสถานะ
    if (b.status === 'going' && r.status !== 'going' && !r.pickedAt) { sets.push('pickedAt=?'); vals.push(Date.now()); }
    if (b.status === 'done' && r.status !== 'done') { sets.push('doneAt=?'); vals.push(Date.now()); if (!r.pickedAt) { sets.push('pickedAt=?'); vals.push(Date.now()); } }
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
/* ---------- ติดตามตำแหน่งทีมแม้ไม่ได้เปิดหน้าเว็บ: แอปติดตามฟรีที่ทำงานเบื้องหลัง ----------
   Traccar Client (iOS/Android): Server URL = https://<โดเมน>/api/track · Device identifier = รหัสลิงก์ทีม (?id=… ในลิงก์ทีม)
   รองรับทั้งแบบเก่า (OsmAnd: ?id=&lat=&lon=&timestamp=&speed=นอต&batt=) และแบบใหม่ (JSON {device_id, location:{coords,battery,timestamp}})
   OwnTracks (โหมด HTTP): URL = https://<โดเมน>/api/track/<รหัสลิงก์ทีม> · JSON {_type:'location',lat,lon,acc,vel(กม./ชม.),batt,tst}
   จุดที่แอปเก็บไว้ตอนไม่มีเน็ตแล้วส่งย้อนหลัง: เก็บเข้าเส้นทางตามเวลาจริง และอัปเดตตำแหน่งล่าสุดเฉพาะจุดที่ใหม่กว่า */
/* ---------- รับตำแหน่งทีมทาง SMS (ไม่ต้องใช้เน็ตฝั่งทีม) ----------
   ทีมกดส่ง SMS ถึงเบอร์ศูนย์ ในข้อความมีรหัส  #HM:<รหัสลิงก์ทีม>:<lat>,<lng>[:<เวลา unix>][:SOS]
   มือถือ Android เบอร์ศูนย์ติดแอปส่งต่อ SMS → POST/GET /api/sms-in?k=<รหัสลับ> พร้อมข้อความ (รองรับหลายชื่อฟิลด์)
   ตำแหน่งขึ้นแผนที่ทันที (teams_live + เส้นทาง) · แจ้งในแชทของทีม · มี SOS = ตั้ง SOS */
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
      batt: lv >= 0 && lv <= 1 ? Math.round(lv * 100) : null, t: Date.parse(loc.timestamp) };
  } else if (body._type === 'location') {
    p = { lat: body.lat, lng: body.lon, acc: body.acc, speed: body.vel, heading: body.cog, batt: body.batt, t: Number(body.tst) * 1000 };
  } else if (body._type) {
    return json([]); // OwnTracks ข้อความอื่น (waypoint, transition ฯลฯ) ไม่ใช้
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
    db.prepare('UPDATE teams_live SET appAt=? WHERE team=?').bind(now, row.name), // แอปเบื้องหลัง (OwnTracks/Traccar) ส่งมาล่าสุดเมื่อไร
  ]);
  if (Math.random() < 0.01) await db.prepare('DELETE FROM team_track WHERE at<?').bind(now - 7 * 864e5).run();
  return body._type ? json([]) : out({ ok: true });
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
  return { ok: true, id };
}
async function listRoster(db) {
  const { results } = await db.prepare('SELECT id,name,leader,phone,members,vehicle,zone,status,note,updatedAt,token,sosAt,sosAck,warroom,gmaps FROM roster WHERE active=1 ORDER BY name').all();
  // ทีมที่ยังไม่มีลิงก์เฉพาะทีม: สร้างให้
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
  const live = await db.prepare('SELECT lat,lng,accuracy,updatedAt,appAt FROM teams_live WHERE team=?').bind(t.name).first();
  const { results: stock } = await db.prepare('SELECT name FROM stock ORDER BY category, name').all();
  return { ok: true, team: { id: r.id || '', name: t.name, leader: r.leader || '', phone: r.phone || '', members: r.members ?? '', vehicle: r.vehicle || '', zone: r.zone || '',
      status: r.status || '', sosAt: r.sosAt || null, sosAck: r.sosAck || null, gmaps: r.gmaps || '', view: r.token ? await viewId(r.token) : '', inRoster: !!r.id },
    hqPhone: await getMeta(db, 'hq_phone'), cases: results.map(c => outCase(c, true)), live: live || null, supplies: stock.map(s => s.name), now };
}
async function callStart(db, team, from, b) {
  if (!team) return { ok: false, error: 'missing_team' };
  const mode = b.mode === 'video' ? 'video' : 'voice';
  const link = await callCreate(db, { team, from, mode, name: b.name });
  await chatSend(db, { team, from, name: b.name, text: mode === 'voice' ? 'โทรด้วยเสียง' : 'วิดีโอคอล', kind: 'call', link, caseId: b.caseId });
  return { ok: true, link, mode };
}
/* ---------- โทรในระบบ (WebRTC ตรงระหว่างเครื่อง) ----------
   ห้องสาย = id + รหัสลับในลิงก์ (/call/#id.secret) · ใครมีลิงก์เข้าได้ (แบบเดียวกับลิงก์ห้องประชุม) · สายละ 2 คน
   Worker ทำหน้าที่ส่งต่อข้อความนัดเชื่อมต่อ (offer/answer/ice) ผ่าน D1 · เสียง/ภาพวิ่งตรงระหว่างเครื่อง
   ต่อผ่านเครือข่ายที่ปิดกั้น (4G บางเครือข่าย) ต้องมี TURN: ตั้ง TURN_KEY_ID + TURN_KEY_API_TOKEN (Cloudflare Realtime TURN) */
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
  // เข้าห้อง/ดึงข้อความใหม่: ส่ง since=0 ครั้งแรกจะได้ข้อมูลห้อง + ICE servers
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
  team_gmaps: (db, t, b) => setTeamGmaps(db, t.name, b.gmaps),
  env_check: (db, t, b) => envCheck(ENV, b),   // หน้าทีมใช้ข้อมูลฝน/ดาวเทียมคำนวณระดับเคสแบบเดียวกับ CENTRAL
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
/* ---------- ตรวจความวิกฤตด้วยข้อมูลภายนอก (เทียบกับที่ผู้แจ้งบอก) ----------
   ต่อจุดเคส: ฝน (Open-Meteo: ฝนสะสม 3/24 ชม. ที่ผ่านมา + คาด 3 ชม.ข้างหน้า) · น้ำท่วมจากดาวเทียม (GISTDA 7 วัน: จุดอยู่ในพื้นที่น้ำท่วม/ระยะ/วันที่ภาพ)
   GISTDA แบ่งค้นเป็นช่อง 0.04° (~4 กม.) แคช 30 นาที · ทีละไม่เกิน 10 ช่องต่อคำขอ (จุดที่เหลือเบราว์เซอร์จะถามรอบถัดไป) */
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
  // ฝน: Open-Meteo รวมจุดใกล้กันเป็นช่อง 0.02° แล้วถามทีละ 100 ช่อง
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
  // ดาวเทียม GISTDA
  if (env.GISTDA_KEY) {
    const S = 0.04, gc = new Map(); pts.forEach(p => { const c = Math.floor(p.lng / S) + ',' + Math.floor(p.lat / S); if (!gc.has(c)) gc.set(c, []); gc.get(c).push(p); });
    let n = 0;
    for (const [c, list] of gc) {
      if (n++ >= 10) break;
      const [cx, cy] = c.split(',').map(Number);
      try {
        const feats = await gistdaCell(env, cx, cy);
        list.forEach(p => { let inside = null, best = Infinity, near = 0, date = '';
          for (const f of feats) { if (f.d > date) date = f.d; if (!inside && inGeom(p.lat, p.lng, f.g)) inside = f;
            const d = inside === f ? 0 : geomDist(p.lat, p.lng, f.g); if (d < best) best = d; if (d <= 500) near++; }
          out[p.k].sat = { inside: !!inside, dM: isFinite(best) ? Math.round(best) : null, near, area: inside ? inside.a : 0, date: inside ? inside.d : date, period: '7days', n: feats.length }; });
      } catch (e) { list.forEach(p => { out[p.k].sat = { error: true }; }); }
    }
  }
  return { ok: true, time: Date.now(), gistda: !!env.GISTDA_KEY, points: out };
}

/* ---------- ภัยพิบัติหลายชนิด (แสดงเป็นชั้นบนแผนที่) ----------
   แผ่นดินไหว + สึนามิ: USGS (ไทยและประเทศรอบ ๆ, 7 วัน, ≥2.5) + กรมอุตุฯ · ไฟป่า: จุดความร้อน VIIRS จาก GISTDA (24 ชม.)
   พายุ/น้ำท่วม/ภูเขาไฟ/ไฟป่าใหญ่: GDACS · ฝนตกรุนแรง/ลูกเห็บ/พายุฝนฟ้าคะนอง/ลมกระโชก: Open-Meteo ที่ตัวเมืองทุกจังหวัด (24 ชม.ที่ผ่านมา + 6 ชม.ข้างหน้า)
   ดินโคลนถล่ม/น้ำป่าไหลหลาก: ประเมินความเสี่ยงจากฝนในจังหวัดที่มีภูเขา (ไม่ใช่การตรวจพบจริง) · หลุมยุบ ฯลฯ: ศูนย์ปักหมุดรายงานเอง + ข่าว
   แคช 10 นาที (ข้อมูลสาธารณะ) */
const PROV_LL = {'กรุงเทพมหานคร':[13.756,100.502],'กระบี่':[8.086,98.906],'กาญจนบุรี':[14.023,99.533],'กาฬสินธุ์':[16.432,103.506],'กำแพงเพชร':[16.483,99.522],'ขอนแก่น':[16.441,102.836],'จันทบุรี':[12.611,102.104],'ฉะเชิงเทรา':[13.69,101.077],'ชลบุรี':[13.361,100.985],'ชัยนาท':[15.186,100.125],'ชัยภูมิ':[15.807,102.032],'ชุมพร':[10.493,99.18],'เชียงราย':[19.91,99.841],'เชียงใหม่':[18.788,98.985],'ตรัง':[7.558,99.611],'ตราด':[12.243,102.515],'ตาก':[16.884,99.126],'นครนายก':[14.206,101.213],'นครปฐม':[13.82,100.062],'นครพนม':[17.392,104.769],'นครราชสีมา':[14.979,102.098],'นครศรีธรรมราช':[8.432,99.963],'นครสวรรค์':[15.704,100.137],'นนทบุรี':[13.862,100.514],'นราธิวาส':[6.426,101.823],'น่าน':[18.783,100.779],'บึงกาฬ':[18.36,103.646],'บุรีรัมย์':[14.993,103.103],'ปทุมธานี':[14.02,100.525],'ประจวบคีรีขันธ์':[11.812,99.797],'ปราจีนบุรี':[14.05,101.372],'ปัตตานี':[6.869,101.25],'พระนครศรีอยุธยา':[14.353,100.568],'พะเยา':[19.166,99.902],'พังงา':[8.451,98.525],'พัทลุง':[7.617,100.078],'พิจิตร':[16.442,100.349],'พิษณุโลก':[16.821,100.265],'เพชรบุรี':[13.112,99.94],'เพชรบูรณ์':[16.419,101.16],'แพร่':[18.145,100.141],'ภูเก็ต':[7.89,98.398],'มหาสารคาม':[16.184,103.301],'มุกดาหาร':[16.545,104.723],'แม่ฮ่องสอน':[19.301,97.969],'ยโสธร':[15.794,104.145],'ยะลา':[6.541,101.281],'ร้อยเอ็ด':[16.053,103.652],'ระนอง':[9.966,98.635],'ระยอง':[12.682,101.278],'ราชบุรี':[13.536,99.817],'ลพบุรี':[14.8,100.653],'ลำปาง':[18.289,99.49],'ลำพูน':[18.574,99.008],'เลย':[17.486,101.722],'ศรีสะเกษ':[15.118,104.322],'สกลนคร':[17.155,104.148],'สงขลา':[7.189,100.595],'สตูล':[6.623,100.067],'สมุทรปราการ':[13.599,100.597],'สมุทรสงคราม':[13.409,100.002],'สมุทรสาคร':[13.547,100.274],'สระแก้ว':[13.824,102.065],'สระบุรี':[14.529,100.911],'สิงห์บุรี':[14.888,100.401],'สุโขทัย':[17.007,99.823],'สุพรรณบุรี':[14.474,100.117],'สุราษฎร์ธานี':[9.14,99.333],'สุรินทร์':[14.882,103.493],'หนองคาย':[17.878,102.742],'หนองบัวลำภู':[17.204,102.44],'อ่างทอง':[14.589,100.455],'อำนาจเจริญ':[15.866,104.626],'อุดรธานี':[17.415,102.787],'อุตรดิตถ์':[17.62,100.099],'อุทัยธานี':[15.383,100.025],'อุบลราชธานี':[15.244,104.847]};
// จังหวัดที่มีพื้นที่ภูเขา/ลาดชัน (เสี่ยงดินโคลนถล่ม น้ำป่าไหลหลาก เมื่อฝนหนัก)
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
      w.slide = hill && wet >= 150 ? 'high' : hill && wet >= 90 ? 'mid' : '';   // ดินโคลนถล่ม / น้ำป่าไหลหลาก (ประเมินจากฝน)
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

/* ---------- ประกาศแจ้งเตือนรายพื้นที่ ----------
   scope: all (ทุกพื้นที่) · province (จังหวัด) · district (เขต/อำเภอ) · circle (รัศมีจากจุด)
   level: info ข่าวสาร · warn เฝ้าระวัง · danger อันตราย/อพยพ · อ่านได้ทุกคน (ข้อมูลสาธารณะ) เขียนได้เฉพาะ CENTRAL */
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
/* ลิงก์ติดตามตำแหน่งสดของทีม (สร้างอัตโนมัติ · ดูอย่างเดียว ไม่ต้องเข้าระบบ) : /live/?v=<รหัสดู>
   รหัสดู = SHA-256(รหัสลิงก์ทีม + ':view') 16 ตัวแรก → ส่งต่อได้โดยไม่เปิดเผยรหัสลิงก์ทีม (ซึ่งใช้ส่งข้อมูลแทนทีมได้) · สร้างลิงก์ทีมใหม่ = ลิงก์ติดตามเดิมใช้ไม่ได้ด้วย */
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
/* ลิงก์แชร์ตำแหน่งสดจาก Google Maps (ทำงานต่อแม้ล็อกจอ ไม่ต้องลงแอปเพิ่ม) · ว่าง = ลบ */
const GMAPS_RE = /^https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.(?:com|co\.th)\/maps|maps\.google\.(?:com|co\.th))\/[^\s<>"']{0,300}$/i;
async function setTeamGmaps(db, team, link) {
  const m = String(link || '').match(/https:\/\/[^\s<>"']+/), url = m ? m[0] : '';
  if (url && !GMAPS_RE.test(url)) return { ok: false, error: 'not_gmaps' };
  const r = await db.prepare('UPDATE roster SET gmaps=?, updatedAt=? WHERE name=? AND active=1').bind(url, Date.now(), team).run();
  if (url) await chatSend(db, { team, from: 'team', text: 'แชร์ตำแหน่งสดผ่าน Google Maps: ' + url });
  return r.meta.changes ? { ok: true, gmaps: url } : { ok: false, error: 'not_in_roster' };
}

/* ---------- War Room ย่อย ---------- */
const WR_ROLES = ['lead', 'ops', 'dispatch', 'stock', 'comms', 'medic', 'staff'];
async function listWarrooms(db) {
  const { results: rooms } = await db.prepare('SELECT * FROM warrooms WHERE active=1 ORDER BY createdAt').all();
  // ทุกห้องมีลิงก์เข้าระบบเสมอ (ห้องเก่าที่ยังไม่มี → สร้างให้)
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
/* ---------- ลิงก์ประจำ War Room: ทีมของห้องเข้าระบบได้โดยไม่ต้องใช้รหัสกลาง ----------
   ลิงก์ = /central/warroom/?wr=<id>&k=<token> · หน้าเว็บส่งรหัสเป็น key="wr_<token>" · ใช้ API ได้แบบอาสา แต่ห้ามงานระดับศูนย์กลาง
   (สร้าง/แก้ War Room อื่น · ดูลิงก์ · สำรองข้อมูล · ตั้งเบอร์ศูนย์ · นำเข้าเคส · ตั้งค่าเคสจากโซเชียล) · สร้างลิงก์ใหม่ = ลิงก์เดิมใช้ไม่ได้ทันที */
/* สิทธิ์ War Room ของ "คำขอนี้" (ห้อง/บทบาท) เก็บแยกต่อคำขอด้วย AsyncLocalStorage
   ห้ามใช้ตัวแปรร่วม: Worker รันหลายคำขอพร้อมกันในเครื่องเดียว ค่าจะปนกันหลัง await (ช่องโหว่ยกระดับสิทธิ์) */
const RQ = new AsyncLocalStorage();
Object.defineProperty(globalThis, 'WRC', { configurable: true, get() { const s = RQ.getStore(); return s ? s.wrc : null; }, set(v) { const s = RQ.getStore(); if (s) s.wrc = v; } });
Object.defineProperty(globalThis, 'CTX', { configurable: true, get() { const s = RQ.getStore(); return s ? s.ctx : null; }, set(v) { const s = RQ.getStore(); if (s) s.ctx = v; } });
/* ---------- ขอบเขตข้อมูลของ War Room (ตรวจที่เซิร์ฟเวอร์) ----------
   ลิงก์ห้อง/บัญชีห้องเรียกได้เฉพาะคำสั่งในรายการอนุญาต · อ่านได้เฉพาะเคส/ทีม/แชท/คลังในพื้นที่ของห้อง (ตรรกะเดียวกับหน้า War Room)
   ศูนย์จังหวัดเห็นทั้งจังหวัด + ใกล้เคียง 20 กม. · ห้องที่ตั้งเขต '*' เห็นเคสทุกพื้นที่ (แต่ทีมยังเป็นของห้องเอง) */
const WR_GET_OK = new Set(['rev', 'chat_rev', 'chat_threads', 'helpme_cases', 'list', 'news', 'roster', 'stock', 'teams', 'warrooms', 'wr_users', 'apps_list', 'chat', 'team_track',
  'warroom_public', 'warrooms_public', 'cctv', 'water', 'gistda_status', 'outreach', 'sheet_places', 'covered', 'broadcasts', 'places', 'hazards', 'env_check']);
const WR_POST_OK = new Set(['update', 'chat_send', 'chat_read', 'sos_ack', 'hq_call', 'roster_save', 'team_link', 'team_warroom', 'warroom_save', 'warroom_staff', 'stock_item', 'stock_move',
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
/* GET ของ War Room: กรองผลให้เหลือเฉพาะพื้นที่/ทีมของห้อง · คืน null = ใช้ตัวจัดการปกติ */
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
      if (r.alerts) r.alerts = { sos: (r.alerts.sos || []).filter(x => sc.teams.has(x.name)), calls: (r.alerts.calls || []).filter(x => sc.teams.has(x.team)) }; return r; }
    case 'stock': { const r = await listStock(db); r.items = r.items.filter(i => !i.warroom || sc.zones.has(i.warroom)); const ids = new Set(r.items.map(i => i.id)); r.log = (r.log || []).filter(l => ids.has(l.itemId)); return r; }
  }
  return null;
}
/* POST ของ War Room: ตรวจว่าเคส/ทีม/คลัง/ทีมงาน อยู่ในห้องนี้ก่อนแก้ */
async function wrPostCheck(db, b) {
  const sc = await wrScope(db); if (sc.none) return 'no_room';
  const teamOk = async name => sc.teams.has(clean(name, MAX.volunteer));
  switch (b.action) {
    case 'update': { const c = await db.prepare('SELECT * FROM cases WHERE id=?').bind(String(b.id)).first(); return c && inScope(c, sc) ? '' : 'not_in_room'; }
    case 'chat_send': case 'chat_read': case 'hq_call': return await teamOk(b.team) ? '' : 'not_in_room';
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
async function wrAuth(db, key) {
  const k = String(key || '');
  if (/^wr_[a-z0-9]{16,40}$/.test(k)) { const r = await db.prepare('SELECT id,name FROM warrooms WHERE active=1 AND token=?').bind(k.slice(3)).first(); return r ? { ...r, role: 'lead', via: 'link' } : null; }
  // บัญชีผู้ใช้ของ War Room ย่อย (ชื่อผู้ใช้ + รหัสผ่าน) → session
  if (/^wru_[a-f0-9]{48}$/.test(k)) {
    const s = await db.prepare('SELECT s.userId,s.warroom,s.expires,u.username,u.name AS uname,u.role,u.active,w.name FROM wr_sessions s JOIN wr_users u ON u.id=s.userId JOIN warrooms w ON w.id=s.warroom WHERE s.token=? AND w.active=1').bind(k.slice(4)).first();
    if (!s || !s.active || s.expires < Date.now()) return null;
    return { id: s.warroom, name: s.name, role: s.role || 'staff', via: 'user', user: { id: s.userId, username: s.username, name: s.uname || '' } };
  }
  return null;
}
/* ---------- สมัครเป็น War Room / จิตอาสา (หน้า /join) ----------
   สมัคร = เก็บคำตอบแบบสอบถามความสามารถ + ชื่อผู้ใช้/รหัสผ่าน (สถานะ pending)
   War Room: CENTRAL อนุมัติ → สร้างห้อง (warrooms) + บัญชีหัวหน้า (wr_users ด้วยรหัสผ่านเดิม) → เข้าระบบที่ /join ได้เลย
   จิตอาสา: CENTRAL หรือหัวหน้า War Room ที่ผู้สมัครเลือก อนุมัติ → สร้างทีม (roster) สังกัดห้อง → เข้าระบบแล้วไปหน้าทีม */
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
/* เข้าระบบที่หน้า /join: War Room ที่อนุมัติแล้ว → ใช้บัญชีห้อง (wr_login) · จิตอาสา → สถานะ + ลิงก์หน้าทีม */
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
/* ---------- บัญชีผู้ใช้ War Room ย่อย ----------
   หัวหน้าห้อง (ผู้ถือลิงก์ห้อง หรือบัญชี role=lead) สร้างบัญชีให้ตัวเองและทีมงานได้ · เข้าระบบด้วยชื่อผู้ใช้ + รหัสผ่าน (เฉพาะห้องนั้น)
   รหัสผ่านเก็บแบบ PBKDF2-SHA256 + salt · ผิด 5 ครั้งล็อก 10 นาที · session 30 วัน · บัญชี War Room เข้าหน้า CENTRAL ไม่ได้ */
async function pwHash(pw, salt) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, k, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const WR_USER = u => String(u || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 32);
// ตอนสร้างบัญชี: ชื่อผู้ใช้ต้องถูกรูปแบบตั้งแต่แรก (ไม่ตัด/แก้ให้เอง จะได้ไม่สับสนกับชื่อจริง)
const UN_OK = u => /^[a-z0-9._-]{3,32}$/.test(String(u || '').trim().toLowerCase());
/* จำกัดการลองเข้าระบบต่อ IP: 30 ครั้ง / 10 นาที (กันเดารหัสหลายบัญชี) */
async function ipLimit(db, ip, kind, max = 30, win = 600e3) {
  if (!ip) return true; const k = 'rl:' + kind + ':' + ip, now = Date.now(); let o = {}; try { o = JSON.parse(await getMeta(db, k) || '{}'); } catch (e) {}
  if (!o.t || now - o.t > win) o = { t: now, n: 0 }; o.n++; await setMeta(db, k, JSON.stringify(o)); return o.n <= max;
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
    if (pw || b.active === false) await db.prepare('DELETE FROM wr_sessions WHERE userId=?').bind(u.id).run(); // เปลี่ยนรหัส/ปิดบัญชี = ออกจากระบบทุกเครื่อง
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
    if (b.renew) await db.prepare('DELETE FROM wr_sessions WHERE warroom=?').bind(id).run(); } // สร้างลิงก์ใหม่ = ทุกคนในห้องต้องเข้าระบบใหม่
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
  // ไม่ส่ง kit มา (เช่นแก้ชื่อ/หน่วยจากฟอร์มทั่วไป) = คงรายการในถุงเดิมไว้
  const kit = t.kit === undefined ? ((await db.prepare('SELECT kit FROM stock WHERE id=?').bind(id).first()) || {}).kit || '[]' : JSON.stringify(parseKit(t.kit).filter(x => x.id !== id));
  // warroom: คลังของ War Room ไหน ('' = คลังกลาง) · ไม่ส่งมา = คงค่าเดิม
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

/* ---------- ข่าว & เตือนภัย: ประกาศกรมอุตุฯ + แผ่นดินไหวใกล้ไทย (TMD Data API) + หัวข้อข่าว (RSS สำนักข่าว) ----------
   เก็บแค่หัวข้อ แหล่งข่าว เวลา และลิงก์ไปต้นทาง (ไม่คัดลอกเนื้อข่าว) · แคช 10 นาที */
const TMD_KEY = 'uid=api&ukey=api12345'; // คีย์สาธารณะที่ TMD เปิดให้ทดลองใช้
const xmlDec = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
const xmlAll = (s, tag) => [...String(s).matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]);
const xmlOne = (s, tag) => xmlDec(xmlAll(s, tag)[0] || '');
const tmdTime = t => { const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/.exec(t || ''); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], m[4] - 7, +m[5]) : null; }; // เวลาไทย → ms
// ฟีดของสำนักข่าวโดยตรง (Google News ตอบ 503 กับ Worker) แล้วคัดเฉพาะข่าวที่เกี่ยวกับภัยธรรมชาติ/เตือนภัย
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
    })).filter(x => x.time && Date.now() - x.time < 3 * 864e5 && x.lat > -2 && x.lat < 28 && x.lng > 88 && x.lng < 112 /* ไทยและประเทศรอบ ๆ */)
      .sort((a, b) => b.time - a.time).slice(0, 20);
    else out.errors.push('tmd_quake: ' + String(q.reason && q.reason.message || q.reason).slice(0, 120));
    const seen = new Set(), names = NEWS_FEEDS.map(f => f[0]);
    n.forEach((r, i) => {
      if (r.status !== 'fulfilled') { out.errors.push(names[i] + ': ' + String(r.reason && r.reason.message || r.reason).slice(0, 80)); return; }
      xmlAll(r.value, 'item').forEach(it => {
        const source = names[i];
        let title = xmlOne(it, 'title').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
        const tags = NEWS_TAGS.filter(([, re]) => re.test(title)).map(([k]) => k);
        if (!title || !(tags.some(t => t !== 'alert') || /ภัยพิบัติ|ปภ\.|บรรเทาสาธารณภัย|เตือนภัย/.test(title))) return; // ฟีดสำนักข่าวมีทุกหมวด: เก็บเฉพาะข่าวภัยธรรมชาติ/เตือนภัย
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
      district: dm ? dm[1] : '', addrDistrict: bkkDistrictOf(address), lat: num(v(r, 'ละติจูด'), -90, 90), lng: num(v(r, 'ลองจิจูด'), -180, 180), level: v(r, 'ระดับน้ำ'),
      needs: v(r, 'ต้องการ').split(/\s*,\s*/).filter(Boolean), volunteer: v(r, 'ทีมอาสา'), org: v(r, 'หน่วยงาน'), pinSrc: v(r, 'ที่มาของหมุด'),
      pickedAt: sheetTime(v(r, 'เวลารับเคส')), doneAt: sheetTime(v(r, 'เวลาช่วยเสร็จ')),
      // รูปจากผู้แจ้ง: ลิงก์ Google Drive (คั่นบรรทัด) → เก็บแค่รหัสไฟล์ แบบเดียวกับแอป Help Me
      photos: v(r, 'รูปภาพ').match(/[-\w]{25,}/g) || [] };
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
/* ---------- ตรวจกล้อง CCTV อัตโนมัติด้วย Workers AI (โมเดลดูภาพ) ----------
   เลือกกล้องที่มีภาพนิ่งล่าสุด (ไม่เกิน 3 ชม.) ใกล้จุดเคสไม่เกิน 2 กม. สูงสุด 2 ตัว แล้วให้โมเดลดูว่ามีน้ำท่วมบนถนนไหม
   ผลจำไว้ต่อ "ภาพ" (กล้อง + เวลาภาพ) 30 นาที เคสใกล้กันใช้ผลร่วมกัน ไม่เรียกโมเดลซ้ำ
   กล้องถนนเห็นแค่ถนน: "ไม่เห็นน้ำ" ไม่ได้แปลว่าบ้านในซอยไม่ท่วม หน้าเว็บจึงใช้ผลนี้เป็นหลักฐานเฉพาะตอน "เห็นน้ำ" */
const CCTV_AI_MODEL = '@cf/mistralai/mistral-small-3.1-24b-instruct';
// เลือกกล้องที่มีภาพนิ่ง: POPNIX (มีเวลาภาพ ใช้เฉพาะภาพไม่เกิน 3 ชม.) และ iTIC (ภาพสด ไม่มีเวลาภาพ)
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
  // กล้องภาพสด (iTIC) ไม่มีเวลาภาพ → จำผลเป็นช่วงละ 10 นาที
  const stamp = cam.at || 'live' + Math.floor(Date.now() / 600000);
  return cached('cctv-ai-v4:' + cam.id + ':' + stamp, cam.at ? 1800 : 600, async () => {
    const r = await fetch(cam.img, { headers: UA, cf: { cacheTtl: 60 } });
    if (!r.ok) return { flood: 'unclear', note: 'โหลดภาพไม่ได้' };
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 2000 || buf.byteLength > 2_500_000) return { flood: 'unclear', note: 'ภาพใช้ไม่ได้' };
    const out = await env.AI.run(CCTV_AI_MODEL, {
      messages: [{ role: 'user', content: [{ type: 'text', text: CCTV_AI_PROMPT }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64(buf) } }] }],
      max_tokens: 120, temperature: 0 });
    // Workers AI ส่ง response เป็น object ที่แปลง JSON ให้แล้ว หรือเป็นข้อความ (ขึ้นกับรุ่น) → รองรับทั้งสองแบบ
    const raw = out && (out.response ?? (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content));
    let j = raw && typeof raw === 'object' ? raw : {};
    if (typeof raw === 'string') { const m = raw.match(/\{[\s\S]*\}/); try { j = m ? JSON.parse(m[0]) : {}; } catch (e) {} }
    let flood = ['yes', 'no', 'unclear'].includes(j.flood) ? j.flood : 'unclear';
    const depth = Number(j.depth_cm);
    // กันผลบวกลวง: "เห็นน้ำ" แต่ประเมินลึกไม่ถึง 10 ซม. (มักเป็นถนนเปียก/แสงสะท้อน) → ไม่ชัด
    if (flood === 'yes' && isFinite(depth) && depth > 0 && depth < 10) flood = 'unclear';
    return { flood, depth: flood === 'yes' && isFinite(depth) && depth > 0 ? Math.min(300, Math.round(depth)) : null, note: clean(j.note, 80) };
  });
}
async function cctvAiCheck(env, p) {
  if (!env.AI) return { ok: false, error: 'ai_not_bound' };
  const lat = num(p.lat, -90, 90), lng = num(p.lng, -180, 180);
  if (lat == null || lng == null) return { ok: false, error: 'missing' };
  const now = Date.now() / 1000, all = (await allCams()).cams;
  const near = all.filter(c => c.img && (c.hls || (c.at > 0 && now - c.at < 3 * 3600))) // ภาพสด iTIC หรือภาพนิ่งที่รู้เวลาและไม่เกิน 3 ชม.
    .map(c => ({ ...c, d: Math.round(camDistM(lat, lng, c.lat, c.lng)) })).filter(c => c.d <= 2000)
    .sort((a, b) => a.d - b.d).slice(0, 2);
  const checks = await Promise.all(near.map(async c => {
    try { return { id: c.id, title: c.title, d: c.d, at: c.at, img: c.img, ...(await cctvAiOne(env, c)) }; }
    catch (e) { return { id: c.id, title: c.title, d: c.d, at: c.at, img: c.img, flood: 'unclear', note: 'ตรวจไม่สำเร็จ' }; }
  }));
  // สรุป: เห็นน้ำจากกล้องไหนก็ได้ = flood · มีกล้องที่เห็นชัดว่าไม่มีน้ำ (และไม่มีตัวไหนเห็นน้ำ) = clear · อื่น ๆ = unclear · ไม่มีกล้อง = none
  const verdict = !checks.length ? 'none' : checks.some(c => c.flood === 'yes') ? 'flood' : checks.some(c => c.flood === 'no') ? 'clear' : 'unclear';
  return { ok: true, time: Date.now(), model: CCTV_AI_MODEL, verdict, checks };
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
/* ตรวจหมุดเทียบที่อยู่ (เคส Help Me ในกรุงเทพฯ ที่ที่อยู่ระบุเขต):
   หมุดตกคนละเขตกับที่อยู่ → ค้นที่อยู่ด้วย Photon ในกรุงเทพฯ แล้วใช้ผลที่ตกในเขตเดียวกับที่อยู่เท่านั้น
   เจอ → ใช้หมุดใหม่ (เก็บหมุดเดิมไว้ใน pinCheck) · ไม่เจอ → คงหมุดเดิม แต่ติดป้ายว่าหมุดอาจผิด
   ผลค้นทั้งสองทางจำไว้ใน meta (หมุด→เขต: hmd:, ที่อยู่→พิกัด: hmg:) จึงเรียก Photon เฉพาะครั้งแรก */
const normD = d => String(d || '').replace(/^เขต\s*/, '').replace(/\s+/g, '').trim();
// เขตที่ "เขียนชัด" ในที่อยู่ (ต้องมีคำว่า เขต) · รับชื่อที่ติดคำต่อท้าย เช่น "เขตบางกะปิกรุงเทพ" · ชื่อถนนอย่าง "ลาดพร้าว 130" ไม่นับ
function bkkDistrictOf(address) {
  for (const m of String(address || '').matchAll(/เขต\s*([ก-๙]+)/g)) {
    const d = [...BKK_DISTRICTS].sort((a, b) => b.length - a.length).find(x => m[1].startsWith(x));
    if (d) return d;
  }
  return '';
}
// หมุดอยู่ที่ไหน (จาก Photon reverse): เขตใน กทม. → ชื่อเขต · จังหวัดอื่น → "จังหวัด…" (ผิดแน่) · ไม่รู้เขต (มีแค่ "กรุงเทพมหานคร") → '-' ไม่ตัดสิน
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
  // ค้นด้วยพิกัดจริง (ทศนิยม 5 ≈ 1 ม.) แยก cache จาก fillDistricts ที่ปัดพิกัดและใช้ชื่อเมืองแทนได้
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
  // ค้นจากละเอียดไปหยาบ: ที่อยู่เต็ม → ส่วนถนน/ซอย → ซอยหลัก (ตัด /2, แยก) → แขวง → เขต · รับเฉพาะผลที่อยู่ในเขตตามที่อยู่
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
    else c.pinCheck = { status: 'pending', from, addrDistrict: c.addrDistrict }; // ยังค้นไม่ถึงในรอบนี้
  }
}
/* เคสในระบบของเราเอง: ตรวจหมุดเทียบที่อยู่แบบเดียวกับเคส Help Me แต่ "บันทึก" หมุดที่ถูกลงฐานข้อมูลเลย (ทำครั้งเดียวต่อเคส)
   หมุดเดิมจดไว้ในบันทึกของเคส เพื่อย้อนดูได้ · เคสที่ปรับแล้วหมุดตรงเขตแล้ว รอบถัดไปจึงไม่ทำซ้ำ */
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
    const notes = clean([note, o.row.notes || ''].filter(Boolean).join('\n'), MAX.notes); // ไว้หน้าสุด ไม่ให้ถูกตัดเมื่อบันทึกยาว
    await db.prepare('UPDATE cases SET lat=?, lng=?, notes=?, updatedAt=? WHERE id=?').bind(o.lat, o.lng, notes, now, o.row.id).run();
    Object.assign(o.row, { lat: o.lat, lng: o.lng, notes, updatedAt: now }); changed++;
  }
  if (changed) await bumpRev(db);
}
const HM_TEST = /\btest|ทดสอบ|เทส(?!โก้)/i; // เคสทดสอบในชีต ไม่นับในสถิติ
/* เคส Help Me รายเคสสำหรับการ์ดตัวเลขของแดชบอร์ด (เฉพาะรหัสทีม) · ไม่ส่งชื่อ/เบอร์ */
// ระดับน้ำในชีต Help Me → รหัสของ Helpme+ (ช่วงใช้ค่าบน) ให้ผลตรวจพื้นที่คิดคะแนนได้ · "แห้ง" ไม่มีรหัส
const HM_LEVEL_CODE = { 'ข้อเท้า': 'ankle', 'ข้อเท้า–เข่า': 'knee', 'เข่า': 'knee', 'เข่า–เอว': 'waist', 'เอว': 'waist', 'เอว–อก': 'chest', 'อก': 'chest', 'อกขึ้นไป': 'chest', 'มิดหัว': 'roof' };
// ป้ายระดับน้ำในชีตเปลี่ยนรูปแบบได้ (เช่น "มิดหัว / ท่วมหลังคา (> 180 ซม.)", ขีดสั้น/ยาว, เว้นวรรค)
// ตรงตัวไม่เจอ → เทียบคำสำคัญ ไล่จากระดับรุนแรงสุดก่อน เพื่อไม่ให้เคสหนักสุดหลุดเป็น "ไม่ระบุ"
const HM_LEVEL_KEYWORDS = [[/มิดหัว|หลังคา/, 'roof'], [/อกขึ้นไป|เอว.อก|^อก/, 'chest'], [/เข่า.เอว|^เอว/, 'waist'], [/ข้อเท้า.เข่า|^เข่า/, 'knee'], [/^ข้อเท้า/, 'ankle']];
function hmLevelCode(text) {
  const t = String(text || '').split('(')[0].replace(/\s+/g, ' ').trim();
  if (HM_LEVEL_CODE[t]) return HM_LEVEL_CODE[t];
  const n = t.replace(/[-‐-―−]/g, '–').replace(/\s/g, '');
  if (HM_LEVEL_CODE[n]) return HM_LEVEL_CODE[n];
  for (const [re, code] of HM_LEVEL_KEYWORDS) if (re.test(n)) return code;
  return ''; // รวม "แห้ง / ต่ำกว่าข้อเท้า"
}
/* จังหวัดของเคส (ใช้แบ่งงานตามโครงสร้าง CENTRAL → จังหวัด → War Room โซน → ทีม)
   ที่อยู่ระบุ "จ./จังหวัด" → ชื่อนั้น · ระบุกรุงเทพ/เขตใน กทม. → กรุงเทพมหานคร · ไม่งั้นถามจากหมุด (Photon) แล้วจำไว้ใน meta (hmv:) */
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
/* ---------- ซิงก์เคส Help Me (Google Sheet) → ฐานข้อมูลของเรา (ตาราง cases, src='helpme') ----------
   ทุก 1 นาที (cron ของตัวกลางโดเมนเรียก hm_sync) + ทุกครั้งที่ CENTRAL ขอเคส Help Me (ถ้าซิงก์ล่าสุดเกิน 45 วินาที)
   เขียนเฉพาะแถวที่ข้อมูลเปลี่ยน (เทียบ hmHash) · สถานะ/ทีม: ฝั่งที่แก้ทีหลังชนะ
   (Help Me เปลี่ยนสถานะ/ทีมหลังจากที่ศูนย์แก้ → ใช้ของ Help Me · ศูนย์แก้หลังจากนั้น → คงของศูนย์ · ไม่ส่งกลับไปที่ชีต Help Me) */
const fnv = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
let hmSyncP = null;
async function syncHelpme(env, db, force) {
  if (hmSyncP) return hmSyncP;
  const last = Number(await getMeta(db, 'hm_sync_at')) || 0;
  if (!force && Date.now() - last < 45e3) return { ok: true, skipped: true, at: last };
  hmSyncP = (async () => {
    await setMeta(db, 'hm_sync_at', String(Date.now()));
    const cases = (await sheetCases(env)).filter(c => !HM_TEST.test([c.name, c.notes, c.address, (c.needs || []).join(' '), c.volunteer].join(' ')));
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
        // Help Me เปลี่ยนสถานะ/ทีมเอง และเปลี่ยนหลังจากที่ศูนย์แก้ล่าสุด → ใช้ค่าของ Help Me
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
/* ---------- AI ดูรูปที่ผู้แจ้งส่งมา (Workers AI vision) → น้ำท่วมจริงไหม ลึกเท่าไร มีคนเสี่ยงอันตรายไหม ----------
   ทำตอนซิงก์จาก cron (ไม่ทำระหว่างที่คนเปิดหน้า) ทีละ 4 เคสต่อรอบ เคสที่ยังไม่เสร็จก่อน · เก็บผลใน cases.photoAi (ตรวจใหม่เมื่อรูปเปลี่ยน) */
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
  // ตอบจากฐานข้อมูลของเราทันที (ซิงก์ใช้เวลา ~20 วินาที จึงไม่ให้คนรอ) · cron ซิงก์ทุก 1 นาทีอยู่แล้ว
  // ยังไม่เคยซิงก์ → ซิงก์ก่อนตอบ · ซิงก์ล่าสุดเกิน 3 นาที (cron มีปัญหา) → ซิงก์เบื้องหลังแล้วตอบเลย
  let { results } = await db.prepare("SELECT * FROM cases WHERE src='helpme' ORDER BY createdAt").all();
  const last = Number(await getMeta(db, 'hm_sync_at')) || 0;
  if (!results.length) { try { await syncHelpme(env, db, true); } catch (e) {} ({ results } = await db.prepare("SELECT * FROM cases WHERE src='helpme' ORDER BY createdAt").all()); }
  else if (Date.now() - last > 180e3 && CTX && CTX.waitUntil) CTX.waitUntil(syncHelpme(env, db).catch(() => {}));
  const J = (v, d) => { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  return { ok: true, time: Date.now(), source: 'db', syncedAt: Number(await getMeta(db, 'hm_sync_at')) || null, cases: results.map(c => ({ id: c.id, createdAt: c.createdAt, updatedAt: c.updatedAt, doneAt: c.doneAt, status: c.status, urgency: c.urgency,
    people: c.people, lat: noPin(c) && c.glat != null ? c.glat : c.lat, lng: noPin(c) && c.glat != null ? c.glng : c.lng, needs: c.needs ? String(c.needs).split(/\s*,\s*/).filter(Boolean) : [], address: c.address || '', district: c.district || '', province: c.province || '', volunteer: c.volunteer || '',
    // หน้าจัดการเคสใช้เคส Help Me เป็นข้อมูลหลัก จึงต้องมีชื่อ เบอร์ รายละเอียด (endpoint นี้ให้เฉพาะอาสาที่ล็อกอินแล้ว)
    name: c.name || '', phone: c.phone || '', notes: c.notes || '', org: c.org || '', pickedAt: c.pickedAt || null, dupOf: c.dupOf || '', photos: J(c.photos, []), pinCheck: noPin(c) && c.glat != null ? { status: 'geocoded', label: c.glabel || '' } : J(c.pinCheck, null), photoAi: J(c.photoAi, null),
    level: c.level || '', levelText: c.levelText || '', bags: c.bags == null ? '' : c.bags, households: c.households == null ? '' : c.households, cctv: c.cctv || '', vulnerable: c.vulnerable ? String(c.vulnerable).split(/\s*,\s*/).filter(Boolean) : [] })) };
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
  const kind = ['call', 'sos'].includes(b.kind) ? b.kind : '', link = kind === 'call' && (String(b.link || '').startsWith(MEET) || /^\/call\/#[0-9a-f]{12}\.[0-9a-f]{24}$/.test(String(b.link || ''))) ? String(b.link).slice(0, 300) : '';
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

let ENV = {};
async function api(request, env) {
  ENV = env;
  const db = env.DB;
  const gm = new URL(request.url).pathname.match(/^\/api\/gistda\/(1day|3days|7days|30days|freq)\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})(?:\.png)?$/);
  if (gm && request.method === 'GET') return gistdaTile(env, gm[1], gm[2], gm[3], gm[4]);
  // ข่าว/เตือนภัยเป็นข้อมูลสาธารณะ ไม่ต้องใช้ฐานข้อมูล
  if (request.method === 'GET' && new URL(request.url).searchParams.get('action') === 'news') { try { return json(await newsData()); } catch (e) { return json({ ok: false, error: 'news_unavailable' }); } }
  const trk = new URL(request.url).pathname.match(/^\/api\/track(?:\/([A-Za-z0-9]{10,40}))?\/?$/);
  if (!db) return json({ ok: false, error: 'no_database', hint: 'ผูก D1 ชื่อ DB กับโปรเจกต์ Pages ก่อน' }, 500);
  await init(db);
  const url = new URL(request.url);
  if (trk && ['GET', 'POST'].includes(request.method)) return trackApp(db, request, url, trk[1]);
  if (url.pathname.replace(/\/$/, '') === '/api/sms-in' && ['GET', 'POST'].includes(request.method)) return smsIn(db, request, url);
  if (request.method === 'GET') {
    const p = Object.fromEntries(url.searchParams);
    WRC = await wrAuth(db, p.key); if (WRC) p.key = env.VOLUNTEER_KEY;   // ลิงก์ประจำ War Room
    if (WRC) { if (!WR_GET_OK.has(p.action)) return json({ ok: false, error: 'central_only' }); const fr = await wrGet(env, db, p); if (fr) return json(fr); }
    const vol = isVol(env, p.key);
    switch (p.action) {
      case 'list': {
        const since = Number(p.since) || 0;
        const { results } = await db.prepare("SELECT * FROM cases WHERE updatedAt>? AND COALESCE(src,'')<>'helpme' ORDER BY createdAt").bind(since).all(); // เคส Help Me ส่งผ่าน helpme_cases
        if (vol) { try { await fixOwnPins(db, results); } catch (e) {} }
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
      case 'cctv_ai': if (!vol) return json({ ok: false, error: 'not_volunteer' }); try { return json(await cctvAiCheck(env, p)); } catch (e) { return json({ ok: false, error: 'cctv_ai_unavailable' }); }
      case 'hm_sync': if (!vol && Date.now() - (Number(await getMeta(db, 'hm_tick_at')) || 0) < 45e3) return json({ ok: true, skipped: true }); // จำกัดความถี่ (คนนอกเรียกถี่ ๆ ไม่ได้)
        await setMeta(db, 'hm_tick_at', String(Date.now()));
        try { const r = await syncHelpme(env, db, false); let ai = 0, dc = null; try { ai = await photoAiPass(env, db, 4); } catch (e) {} try { dc = await discordTick(env, db); } catch (e) {} let geo = null; try { geo = await geocodePass(env, db, 4); } catch (e) {} return json({ ...r, photoAi: ai, discord: dc && dc.ok ? dc.alerts : undefined, geo }); } catch (e) { return json({ ok: false, error: 'sync_failed', detail: String(e.message || e).slice(0, 120) }); }
      case 'helpme_cases': if (!vol) return json({ ok: false, error: 'not_volunteer' }); try { return json(await helpmeCases(env, db)); } catch (e) { return json({ ok: false, error: 'helpme_unavailable' }); }
      case 'helpme_stats': if (!vol) return json({ ok: false, error: 'not_volunteer' }); try { return json(await helpmeStats(env, db)); } catch (e) { return json({ ok: false, error: 'helpme_unavailable' }); }
      case 'gistda_status': return json({ ok: true, enabled: !!env.GISTDA_KEY, layers: Object.keys(GISTDA_LAYERS) });
      case 'cctv': try { return json(await allCams()); } catch (e) { return json({ ok: false, error: 'cctv_unavailable' }); }
      case 'zones': return json(vol ? await listZones(db) : { ok: false, error: 'not_volunteer' });
      case 'warrooms': return json(vol ? await listWarrooms(db) : { ok: false, error: 'not_volunteer' });
      // ประกาศที่ยังมีผล: สาธารณะ (หน้าบ้าน Help Me / หน้าทีม) · ทั้งหมด 30 วัน: เฉพาะ CENTRAL
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
    if (b.action === 'app_apply') return json(await appApply(db, b, request.headers.get('cf-connecting-ip') || ''));
    if ((b.action === 'app_login' || b.action === 'wr_login') && !await ipLimit(db, request.headers.get('cf-connecting-ip') || '', 'login')) return json({ ok: false, error: 'too_many' });
    if (b.action === 'app_login') return json(await appLogin(db, b));
    if (b.action === 'wr_login') return json(await wrLogin(db, b));
    if (b.action === 'wr_logout') return json(await wrLogout(db, b));
    WRC = await wrAuth(db, b.key);
    if (WRC) {
      if (WR_DENY.includes(b.action) || !WR_POST_OK.has(b.action) || (b.action === 'warroom_save' && clean((b.warroom || {}).id, 20) !== WRC.id)) return json({ ok: false, error: 'central_only' });
      const why = await wrPostCheck(db, b); if (why) return json({ ok: false, error: why });
      b.key = env.VOLUNTEER_KEY;
    }
    if (b.action === 'ai_chat' && b.stream) {   // ตอบแบบทยอยส่งทีละคำ (SSE) ให้ผู้ใช้เห็นคำตอบทันที
      if (!isVol(env, b.key)) return json({ ok: false, error: 'not_volunteer' });
      const r = await aiStream(b);
      return r || json({ ok: false, error: 'ai_failed' });
    }
    if (b.action === 'create') return json(await createCase(db, b, request.headers.get('cf-connecting-ip') || ''));
    if (b.action === 'track') return json(await trackCase(db, b));
    if (CALL_POST[b.action]) { const c = await callAuth(db, b); return json(c ? await CALL_POST[b.action](db, c, b, env) : { ok: false, error: 'bad_call' }); }
    const needKey = { update: updateCase, ping: pingTeam, place: savePlace, roster_save: saveRoster, stock_item: saveStockItem, stock_move: moveStock, covered_add: addCovered, import_cases: importCases, zone_save: saveZone, bag_pack: packBags,
      lead_add: addLeads, chat_send: (db, b) => chatSend(db, { ...b, kind: '', link: '' }), chat_read: chatRead, lead_decide: decideLead, lead_settings: saveLeadSettings,
      team_link: renewTeamLink, warroom_save: saveWarroom, warroom_link: warroomLink, broadcast_save: saveBroadcast, ai_chat: aiChat, sms_cfg: smsCfg, wr_user_save: wrUserSave, app_decide: appDecide, discord_save: discordSave, discord_test: discordTest, feedback_save: saveFeedback, feedback_done: doneFeedback, hazard_save: saveHazard, hazard_close: closeHazard, env_check: (db, b) => envCheck(ENV, b), broadcast_cancel: cancelBroadcast, team_gmaps: (db, b) => setTeamGmaps(db, clean(b.team, MAX.volunteer), b.gmaps), warroom_staff: saveWarroomStaff, team_warroom: setTeamWarroom, hq_phone: setHqPhone, sos_ack: ackSos, hq_call: (db, b) => callStart(db, clean(b.team, MAX.volunteer), 'hq', b) };
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

async function handle(request, env, ctx) {
  {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      // อนุญาตเว็บสำรองบน GitHub Pages เรียก API นี้ได้ (ใช้ฐานข้อมูลเดียวกัน)
      const origin = request.headers.get('origin') || '';
      const cors = /^https:\/\/(been6505\.github\.io|[a-z0-9-]+\.ummatee-help\.pages\.dev|admin-um-help\.pages\.dev|admin-helpme\.pages\.dev|admin\.um\.help|(www\.|admin\.|center\.|central\.)?helpme4u\.com)$/.test(origin) ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' } : {};
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      let res;
      try { res = await api(request, env); }
      catch (e) { res = json({ ok: false, error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500); }
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    }
    // ลิงก์ประจำ War Room ย่อย: /wr/<id>?k=<รหัส> → หน้า War Room ของห้องนั้น (เว็บย่อยของ CENTRAL)
    const wr = url.pathname.match(/^\/wr\/([A-Za-z0-9]{3,20})\/?$/);
    if (wr) { const to = new URL('/central/warroom/', url); to.searchParams.set('wr', wr[1]); const k = url.searchParams.get('k'); if (k) to.searchParams.set('k', k); return Response.redirect(to.toString(), 302); }
    // ลิงก์เก่า (/admin… และ /center…) → ชื่อใหม่ /central
    const old = url.pathname.match(/^\/(?:admin|center)(\.html|\/.*)?$/);
    if (old) { url.pathname = old[1] && old[1] !== '.html' ? '/central' + old[1] : '/central'; return Response.redirect(url.toString(), 301); }
    return env.ASSETS.fetch(request);
  }
}
export default {
  fetch(request, env, ctx) { return RQ.run({ wrc: null, ctx }, () => handle(request, env, ctx)); },
  // cron (ตั้งใน wrangler config): ส่งแถวที่เปลี่ยนไป Google Sheet ส่งต่อจนคิวหมด สูงสุด 5 รอบต่อครั้ง
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      for (let i = 0; i < 5; i++) { const r = await backupToSheet(env); if (!r.ok || !r.more) break; }
    })());
  }
};
