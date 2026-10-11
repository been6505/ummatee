// โหลดคลังความรู้ (knowledge/*.json) เข้าตาราง knowledge ใน D1 ให้ AI HELP ของ CENTRAL ใช้ตอบ
//   node scripts/load-knowledge.mjs ../knowledge/social_work.json            → เขียน SQL แล้วรันกับ D1 ในเครื่อง (--local)
//   node scripts/load-knowledge.mjs ../knowledge/social_work.json --remote   → รันกับ D1 จริง (ummatee-db)
//   node scripts/load-knowledge.mjs ../knowledge/social_work.json --sql-only → เขียนไฟล์ SQL อย่างเดียว
//   --config=wrangler.localadmin.jsonc → ใช้ D1 ของ config นั้น (เช่น เซิร์ฟเวอร์ทดสอบหลังบ้านในเครื่อง)
// รันซ้ำได้: แทนที่รายการทั้งหมดของ topic นั้นด้วยเนื้อหาในไฟล์ล่าสุด
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--'));
if (!file) { console.error('usage: node scripts/load-knowledge.mjs <file.json> [--remote|--sql-only] [--topic=name]'); process.exit(1); }
const doc = JSON.parse(readFileSync(file, 'utf8'));
const topic = (args.find(a => a.startsWith('--topic=')) || '').slice(8) || doc.topic || basename(file, '.json');
const q = v => v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const now = Date.now(), ids = [];
const rows = (doc.entries || []).map(e => {
  if (!e.id || !e.title || !e.content) throw new Error('entry missing id/title/content: ' + e.id);
  if (!(e.sources || []).length) throw new Error('entry has no source: ' + e.id);
  ids.push(e.id);
  return `INSERT OR REPLACE INTO knowledge (id,topic,category,title,content,keywords,sources,checkedAt,updatedAt) VALUES (${[e.id, topic, e.category, e.title, e.content,
    JSON.stringify(e.keywords || []), JSON.stringify(e.sources), e.checked_at, now].map(q).join(',')});`;
});
const sql = [
  'CREATE TABLE IF NOT EXISTS knowledge (id TEXT PRIMARY KEY, topic TEXT, category TEXT, title TEXT, content TEXT, keywords TEXT, sources TEXT, checkedAt TEXT, updatedAt INTEGER);',
  `DELETE FROM knowledge WHERE topic=${q(topic)} AND id NOT IN (${ids.map(q).join(',') || 'NULL'});`,
  ...rows
].join('\n') + '\n';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, '.wrangler', 'tmp'), { recursive: true });
const out = join(root, '.wrangler', 'tmp', `knowledge-${topic}.sql`);
writeFileSync(out, sql);
console.log(`${rows.length} entries (topic ${topic}) → ${out}`);
if (args.includes('--sql-only')) process.exit(0);
const where = args.includes('--remote') ? '--remote' : '--local', cfg = (args.find(a => a.startsWith('--config=')) || '').slice(9);
execFileSync('npx', ['wrangler', 'd1', 'execute', 'ummatee-db', where, ...(cfg ? ['-c', cfg] : []), '--file', out, '-y'], { cwd: root, stdio: 'inherit' });
console.log(`loaded into D1 ummatee-db (${where.slice(2)}) · AI HELP sees it within 5 minutes (cache kb-all-v1)`);
