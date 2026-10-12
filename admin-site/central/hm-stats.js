/* สำเนาจาก https://helpme4u.com/stats.js (v=185) · ใช้คำนวณตัวเลขสรุปให้ตรงกับหน้า #stats ของ helpme4u.com · ถ้าเว็บเปลี่ยนสูตร ให้คัดลอกไฟล์นี้ใหม่ */
/* คำนวณตัวเลขหน้าสรุป (ไม่ยุ่งกับหน้าจอ · ทดสอบแยกได้)
 * นิยามหลัก
 *  - "วันนี้" = ตั้งแต่ 00:00 น. เวลาประเทศไทย (ไม่ขึ้นกับเขตเวลาของเครื่อง)
 *  - เคสทดสอบ (มีคำว่า test / ทดสอบ / เทส ในช่องใดก็ได้) ไม่นับในตัวเลขใด ๆ · หลังบ้านไม่ส่งให้คนทั่วไปเลย
 *  - เคสที่น่าจะซ้ำ = เบอร์เดียวกัน + แจ้งห่างกันไม่เกิน 48 ชม. + (หมุดห่างกันไม่เกิน 150 ม. / ไม่มีหมุดแต่ต้องการของเหมือนกัน / มีหมุดฝั่งเดียวแต่ของและจำนวนคนตรงกัน)
 *    ยังนับเป็นเคส (ไม่ลบทิ้ง) แต่ตอนรวม "จำนวนคน" จะนับกลุ่มซ้ำครั้งเดียว (ใช้จำนวนคนสูงสุดในกลุ่ม)
 *  - เวลารับเคส / ช่วยเสร็จ ใช้คอลัมน์ที่บันทึกตอนเปลี่ยนสถานะ ถ้าเคสเก่าไม่มี ใช้ "อัปเดตล่าสุด" แทน (นับว่าเป็นค่าประมาณ)
 */
const ST_DAY = 86400000, ST_BKK = 7 * 3600000;
const bkkDayStart = t => Math.floor((t + ST_BKK) / ST_DAY) * ST_DAY - ST_BKK;
function stMedian(a) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
function stPct(a, p) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p / 100 * s.length) - 1))] }
const ST_TEST_RE = /\btest|ทดสอบ|เทส(?!โก้)/i;   // "เทสโก้" (Tesco) ไม่นับ
const stPhone = c => String(c.phone || '').replace(/\D/g, '');
function isTestCase(c) { return c.test === true || ST_TEST_RE.test([c.name, c.notes, c.address, (c.needs || []).join(' '), c.volunteer].join(' ')) }
const stHasPin = c => c && c.lat !== '' && c.lat != null && c.lng !== '' && c.lng != null && !isNaN(+c.lat) && !isNaN(+c.lng) && +c.lat !== 0;
function stDist(a, b) { const k = 111320, cx = Math.cos(+a.lat * Math.PI / 180); return Math.hypot((+a.lat - +b.lat) * k, (+a.lng - +b.lng) * k * cx) }
const stNeedsKey = c => (c.needs || []).map(x => String(x).replace(/:.*$/, '').trim()).sort().join('|');
const stTeamKey = s => String(s || '').toLowerCase().replace(/[\s.\-_+]/g, '');

/* เคสที่น่าจะซ้ำ → Map(id ของเคสซ้ำ → id ของเคสแรก) */
function findDuplicates(list) {
  const dup = new Map(), by = {};
  list.forEach(c => { const p = stPhone(c); if (p.length >= 9) (by[p] = by[p] || []).push(c) });
  Object.values(by).forEach(g => {
    if (g.length < 2) return;
    g.sort((a, b) => (+a.createdAt || 0) - (+b.createdAt || 0));
    g.forEach((c, i) => {
      for (let j = 0; j < i; j++) {
        const o = g[j]; if (dup.has(o.id)) continue;
        if (Math.abs((+c.createdAt || 0) - (+o.createdAt || 0)) > 2 * ST_DAY) continue;
        const pc = stHasPin(c), po = stHasPin(o);
        /* มีหมุดทั้งคู่: ห่างไม่เกิน 150 ม. · ไม่มีหมุดทั้งคู่: ขอของเหมือนกัน · มีหมุดฝั่งเดียว: ขอของเหมือนกัน และจำนวนคนเท่ากัน */
        const same = (pc && po) ? stDist(c, o) <= 150 : (!pc && !po) ? stNeedsKey(c) === stNeedsKey(o) : (stNeedsKey(c) === stNeedsKey(o) && Number(c.people) === Number(o.people));
        if (same) { dup.set(c.id, o.id); break }
      }
    })
  });
  return dup
}

/* ของที่ขอในช่อง "อื่น ๆ" แยกเป็นรายการ (ทรายแมว, ถุงยังชีพ, ไฟฉาย …) */
function otherNeedItems(list) {
  const m = {};
  list.forEach(c => (c.needs || []).forEach(n => {
    const t = String(n).match(/^อื่น\s*ๆ\s*:\s*(.+)$/); if (!t) return;
    const seen = new Set();
    t[1].split(/[\/,+]|\s+และ\s+|\s{2,}/).map(x => x.replace(/^(ต้องการ|ขาด|ต้อง)\s*/, '').replace(/(ค่ะ|คะ|ครับ|คับ)$/, '').trim()).filter(x => x.length >= 2 && x.length <= 30)
      .forEach(x => { const k = x.toLowerCase().replace(/\s+/g, ''); if (seen.has(k)) return; seen.add(k); (m[k] = m[k] || { label: x, n: 0 }).n++ })
  }));
  return Object.values(m).sort((a, b) => b.n - a.n)
}

function computeStats(all, opt = {}) {
  const now = opt.now || Date.now(), areaOf = opt.areaOf || (c => c.district || ''), sev = opt.sev || (c => Math.min(4, Math.max(1, Number(c.urgency) || 1)));
  const needKey = opt.needKey || (x => x), P = c => Math.max(1, Number(c.people) || 1), sumP = l => l.reduce((a, c) => a + P(c), 0);
  /* เคส "ไม่เข้าเกณฑ์" (skip) ปิดโดยไม่ไปช่วย → แยกนับต่างหาก ไม่รวมในตัวเลขช่วยเหลือ */
  const tests = all.filter(isTestCase), real = all.filter(c => !isTestCase(c)), skipped = real.filter(c => c.status === 'skip'), base = real.filter(c => c.status !== 'skip');
  const open = base.filter(c => c.status === 'open'), going = base.filter(c => c.status === 'going'), done = base.filter(c => c.status === 'done');
  const act = open.concat(going), urgent = act.filter(c => sev(c) >= 3);
  const dup = findDuplicates(base), root = c => { let id = c.id, k = 0; while (dup.has(id) && k++ < 20) id = dup.get(id); return id };
  /* จำนวนคนแบบไม่นับซ้ำ: กลุ่มซ้ำนับครั้งเดียว (ใช้จำนวนคนสูงสุดในกลุ่ม) */
  const uniqP = l => { const g = {}; l.forEach(c => { const r = root(c); g[r] = Math.max(g[r] || 0, P(c)) }); return Object.values(g).reduce((a, b) => a + b, 0) };
  const goingAt = c => Number(c.goingAt) || 0;
  const doneAt = c => Number(c.doneAt) || (c.status === 'done' ? Number(c.updatedAt) || 0 : 0);
  const t0 = bkkDayStart(now);
  /* เวลา */
  const pick = base.filter(c => goingAt(c) > (+c.createdAt || 0)).map(c => goingAt(c) - (+c.createdAt));
  const fin = done.filter(c => doneAt(c) > (+c.createdAt || 0)).map(c => doneAt(c) - (+c.createdAt));
  const waitOf = c => Math.max(0, now - (+c.createdAt || now));
  const estDone = done.filter(c => !Number(c.doneAt)).length;
  /* วันนี้ / 7 วัน */
  const takenAt = c => goingAt(c) || (c.status === 'going' ? Number(c.updatedAt) || 0 : 0) || (c.status === 'done' && !goingAt(c) ? doneAt(c) : 0);
  const inDay = (t, s) => t >= s && t < s + ST_DAY;
  const doneTodayL = done.filter(c => inDay(doneAt(c), t0));
  const days = [...Array(7)].map((_, i) => { const s = t0 - (6 - i) * ST_DAY; return { start: s, n: base.filter(c => inDay(+c.createdAt, s)).length, k: done.filter(c => inDay(doneAt(c), s)).length } });
  /* ความเร่งด่วน */
  const urg = [4, 3, 2, 1].map(v => { const l = act.filter(c => sev(c) === v); return { v, n: l.length, ppl: uniqP(l) } });
  /* ต้องการอะไร (เคสค้าง) */
  const needs = {}; act.forEach(c => [...new Set((c.needs || []).map(needKey))].forEach(k => { if (!k) return; const r = needs[k] || (needs[k] = { n: 0, ppl: 0 }); r.n++; r.ppl += P(c) }));
  /* ระดับน้ำ (เคสค้าง) */
  const levels = {}; act.forEach(c => { const k = c.level || 'none'; const r = levels[k] || (levels[k] = { n: 0, ppl: 0 }); r.n++; r.ppl += P(c) });
  /* รายเขต (ทุกเขต) */
  const D = {}; base.forEach(c => {
    const k = areaOf(c) || ''; const d = D[k] || (D[k] = { key: k, open: 0, going: 0, done: 0, urg: 0, ppl: 0, oldest: 0, total: 0 });
    d.total++; d[c.status === 'going' ? 'going' : c.status === 'done' ? 'done' : 'open']++;
    if (c.status !== 'done') { d.ppl += P(c); if (sev(c) >= 3) d.urg++ }
    if (c.status === 'open') d.oldest = Math.max(d.oldest, waitOf(c))
  });
  const districts = Object.values(D).sort((a, b) => (!a.key) - (!b.key) || b.urg - a.urg || (b.open + b.going) - (a.open + a.going) || b.done - a.done);
  /* ทีมอาสา (รวมชื่อที่พิมพ์ต่างกันเล็กน้อย เช่น "Umm" / "umm ") */
  const T = {}; base.forEach(c => {
    if (c.status === 'open' || !String(c.volunteer || '').trim()) return; const raw = String(c.volunteer).replace(/\s+/g, ' ').trim(), k = stTeamKey(raw);
    const t = T[k] || (T[k] = { names: {}, going: 0, done: 0, ppl: 0 }); t.names[raw] = (t.names[raw] || 0) + 1; t[c.status]++; if (c.status === 'done') t.ppl += P(c)
  });
  const teams = Object.values(T).map(t => ({ name: Object.entries(t.names).sort((a, b) => b[1] - a[1])[0][0], variants: Object.keys(t.names).length, going: t.going, done: t.done, ppl: t.ppl })).sort((a, b) => (b.done + b.going) - (a.done + a.going));
  /* หน่วยงาน */
  const O = {}; base.forEach(c => { if (c.status === 'open' || !c.org) return; const r = O[c.org] || (O[c.org] = { going: 0, done: 0, ppl: 0 }); r[c.status]++; if (c.status === 'done') r.ppl += P(c) });
  /* คุณภาพข้อมูล (เคสค้าง) */
  const src = s => /^GPS/.test(s) ? 'gps' : /ปักเอง/.test(s) ? 'manual' : /ลิงก์/.test(s) ? 'link' : /ที่อยู่/.test(s) ? 'addr' : '';
  const pinSrc = { gps: 0, manual: 0, link: 0, addr: 0, old: 0, none: 0 };
  act.forEach(c => { if (!stHasPin(c)) pinSrc.none++; else pinSrc[src(c.pinsrc || '') || 'old']++ });
  const dupList = base.filter(c => dup.has(c.id)).map(c => ({ id: c.id, of: dup.get(c.id), status: c.status }));
  return {
    now, t0, total: base.length, tests, skipped, open, going, done, act, urgent, dupList,
    rate: base.length ? done.length / base.length : 0,
    people: { allRaw: sumP(base), act: sumP(act), actUnique: uniqP(act), urgent: uniqP(urgent), done: sumP(done), doneUnique: uniqP(done), all: uniqP(base) },
    times: { pickupMed: stMedian(pick), pickupN: pick.length, doneMed: stMedian(fin), doneP90: stPct(fin, 90), doneN: fin.length, doneEstimated: estDone },
    waits: { over6: open.filter(c => waitOf(c) > 6 * 3600000).length, over24: open.filter(c => waitOf(c) > ST_DAY).length, over72: open.filter(c => waitOf(c) > 3 * ST_DAY).length,
      oldestList: open.slice().sort((a, b) => (+a.createdAt || 0) - (+b.createdAt || 0)).slice(0, 5).map(c => ({ c, wait: waitOf(c) })) },
    today: { newN: base.filter(c => +c.createdAt >= t0).length, taken: base.filter(c => takenAt(c) >= t0).length, done: doneTodayL.length, helped: uniqP(doneTodayL) },
    days, urg, needs, otherNeeds: otherNeedItems(act), levels, districts, teams, orgs: O,
    quality: { noPin: act.filter(c => !stHasPin(c)).length, noLevel: act.filter(c => !c.level).length, noArea: act.filter(c => !areaOf(c)).length,
      noPhone: act.filter(c => stPhone(c).length < 9).length, photos: act.filter(c => c.photos && c.photos.length).length, pinSrc }
  }
}
if (typeof module !== 'undefined') module.exports = { computeStats, findDuplicates, isTestCase, bkkDayStart, stMedian, stPct, otherNeedItems };
