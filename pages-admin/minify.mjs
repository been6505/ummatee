import { transformSync } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const js = (code, module) => transformSync(code, { loader: 'js', minify: true, legalComments: 'none', target: 'es2020', format: module ? 'esm' : undefined, charset: 'utf8' }).code;
const css = code => transformSync(code, { loader: 'css', minify: true, legalComments: 'none', charset: 'utf8' }).code;
let before = 0, after = 0, fail = [];
for (const f of walk(root)) {
  if (!/\.(js|mjs|css|html)$/.test(f) || /\.min\.js$/.test(f)) continue;
  const src = readFileSync(f, 'utf8'); let out = src;
  try {
    if (f.endsWith('_worker.js')) out = transformSync(src, { loader: 'js', minify: true, legalComments: 'none', format: 'esm', target: 'es2022', charset: 'utf8' }).code;
    else if (/\.m?js$/.test(f)) out = js(src, f.endsWith('.mjs'));
    else if (f.endsWith('.css')) out = css(src);
    else out = src.replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
      .replace(/(<script\b(?![^>]*\bsrc=)([^>]*)>)([\s\S]*?)(<\/script>)/gi, (m, open, attrs, body, close) => { if (!body.trim() || /type=["']?(application\/(ld\+)?json|text\/template)/i.test(attrs)) return m; return open + js(body, /type=["']?module/i.test(attrs)).trim() + close; })
      .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, body, close) => open + css(body).trim() + close)
      .replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n');
  } catch (e) { fail.push(f + ': ' + e.message.split('\n')[0]); out = src; }
  before += Buffer.byteLength(src); after += Buffer.byteLength(out); writeFileSync(f, out);
}
console.log(`minify ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB (${Math.round(100 - after / before * 100)}% smaller)`);
if (fail.length) { console.log('skipped:\n' + fail.join('\n')); }
