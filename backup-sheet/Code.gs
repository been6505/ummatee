/* UM+ สำรองข้อมูลจาก Cloudflare D1 ลง Google Sheet
   ใช้แบบผูกกับชีต: สร้าง Google Sheet ใหม่ → ส่วนขยาย → Apps Script → วางไฟล์นี้
   Worker admin-um-help ส่งแถวที่เพิ่ม/แก้มาทุก 1 นาที ไฟล์นี้อัปเดตแถวเดิมตาม id หรือเพิ่มแถวใหม่ (ไม่ลบข้อมูล)
   รหัสลับอยู่ใน Script properties ชื่อ BACKUP_KEY ต้องตรงกับ Secret SHEET_BACKUP_KEY ของ Worker */

const TABS = {
  cases: ['Cases', 'id'],
  roster: ['Roster', 'id'],
  stock: ['Stock', 'id'],
  places: ['Places', 'id'],
  stock_log: ['StockLog', 'n']
};
const TIME_COLS = ['createdAt', 'updatedAt', 'time'];
const TZ = 'Asia/Bangkok';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const real = PropertiesService.getScriptProperties().getProperty('BACKUP_KEY');
    if (!real || b.key !== real) return out({ ok: false, error: 'forbidden' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const counts = {};
    Object.keys(b.tables || {}).forEach(t => {
      if (TABS[t]) counts[t] = upsert(ss, TABS[t][0], TABS[t][1], b.tables[t] || []);
    });
    status(ss, counts);
    return out({ ok: true, counts: counts });
  } catch (err) {
    return out({ ok: false, error: String(err).slice(0, 200) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return out({ ok: true, service: 'umplus-backup' });
}

function upsert(ss, name, key, rows) {
  if (!rows.length) return 0;
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  let header = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String).filter(Boolean) : [];
  if (!header.length) header = [key];
  rows.forEach(r => Object.keys(r).forEach(k => { if (header.indexOf(k) < 0) header.push(k); }));
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  sh.setFrozenRows(1);

  const last = sh.getLastRow();
  const data = last > 1 ? sh.getRange(2, 1, last - 1, header.length).getValues() : [];
  const idx = {};
  data.forEach((row, i) => { idx[String(row[0])] = i; });
  rows.forEach(r => {
    const vals = header.map(h => cell(h, r[h]));
    const k = String(r[key]);
    if (k in idx) data[idx[k]] = vals;
    else { idx[k] = data.length; data.push(vals); }
  });
  if (data.length) sh.getRange(2, 1, data.length, header.length).setValues(data);
  return rows.length;
}

// เวลาเป็น ms → ข้อความเวลาไทย, ข้อความที่ขึ้นต้นด้วยตัวเลขหรือเครื่องหมายสูตร ใส่ ' นำหน้า (เบอร์โทรไม่หาย 0 และกันสูตรแปลกปลอม)
function cell(h, v) {
  if (v === null || v === undefined) return '';
  if (TIME_COLS.indexOf(h) >= 0 && typeof v === 'number' && v > 0) return Utilities.formatDate(new Date(v), TZ, 'yyyy-MM-dd HH:mm:ss');
  if (typeof v === 'string' && /^[=+\-@\d]/.test(v)) return "'" + v;
  return v;
}

function status(ss, counts) {
  const sh = ss.getSheetByName('_sync') || ss.insertSheet('_sync');
  sh.getRange(1, 1, 2, 2).setValues([
    ['สำรองล่าสุด', Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss')],
    ['รอบล่าสุด', JSON.stringify(counts)]
  ]);
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// รันครั้งแรกครั้งเดียว: ขอสิทธิ์และสร้างแท็บ
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(t => { if (!ss.getSheetByName(TABS[t][0])) ss.insertSheet(TABS[t][0]); });
  const has = !!PropertiesService.getScriptProperties().getProperty('BACKUP_KEY');
  Logger.log(has ? 'BACKUP_KEY ตั้งไว้แล้ว' : 'ยังไม่ได้ตั้ง BACKUP_KEY: ไปที่ การตั้งค่าโครงการ → พร็อพเพอร์ตี้ของสคริปต์');
}
