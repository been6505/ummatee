/* ตั้งค่า: ผู้ใช้งาน (ชื่อ · ธีม) + Local AI (Hermes Agent) · ทุกค่าเก็บในเบราว์เซอร์เครื่องนี้ */
const root=document.documentElement;
/* ---------- ผู้ใช้งาน ---------- */
$('#st-name').value=store.get('uh_staff')||'';
$('#st-name').addEventListener('change',e=>{try{localStorage.setItem('uh_staff',e.target.value.trim())}catch(err){}toast('บันทึกชื่อแล้ว',true)});
const markTheme=()=>$$('#st-theme [data-th]').forEach(b=>b.setAttribute('aria-pressed',String((root.dataset.theme==='dark'?'dark':'light')===b.dataset.th)));
$('#st-theme').addEventListener('click',e=>{const b=e.target.closest('[data-th]');if(!b)return;const t=b.dataset.th;
  if(t==='dark')root.dataset.theme='dark';else delete root.dataset.theme;try{localStorage.setItem('uh_theme',t)}catch(err){}markTheme()});
markTheme();
/* ---------- Local AI ---------- */
const P=LOCALAI.PRESETS;let cur=LOCALAI.cfg();
$('#ai-preset').innerHTML=Object.entries(P).map(([k,v])=>`<button type="button" data-p="${k}">${esc(v.label)}</button>`).join('');
const cloudRows=on=>['ai-url','ai-key'].forEach(id=>{const r=$('#'+id).closest('.st-row');if(r)r.hidden=on});$('#ai-list').hidden=false;
function fill(c){cloudRows(c.preset==='cloud');$('#ai-on').checked=!!c.enabled;$('#ai-url').value=c.url||'';$('#ai-model').value=c.model||'';$('#ai-key').value=c.key||'';$('#ai-sys').value=c.system||'';
  $$('#ai-preset [data-p]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.p===(c.preset||'custom'))))}
const form=()=>({enabled:$('#ai-on').checked,preset:($('#ai-preset [aria-pressed=true]')||{dataset:{p:'custom'}}).dataset.p,url:$('#ai-url').value.trim(),model:$('#ai-model').value.trim(),key:$('#ai-key').value.trim(),system:$('#ai-sys').value.trim()});
const msg=(t,ok)=>{const m=$('#ai-msg');m.textContent=t;m.className='st-msg'+(ok===true?' ok':ok===false?' bad':'')};
const dot=s=>{$('#ai-dot').className='st-dot '+(s||'')};
fill(cur);
$('#ai-preset').addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(!b)return;const p=P[b.dataset.p];
  $$('#ai-preset [data-p]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));cloudRows(b.dataset.p==='cloud');if(p.url){$('#ai-url').value=p.url;$('#ai-model').value=p.model}});
['ai-url','ai-model'].forEach(id=>$('#'+id).addEventListener('input',()=>$$('#ai-preset [data-p]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.p==='custom')))));
$('#ai-save').onclick=()=>{LOCALAI.save(form());cur=LOCALAI.cfg();msg('บันทึกแล้ว',true)};
$('#ai-on').addEventListener('change',()=>{LOCALAI.save({enabled:$('#ai-on').checked});msg($('#ai-on').checked?'เปิดใช้แล้ว':'ปิดแล้ว',true)});
$('#ai-list').onclick=async()=>{msg('กำลังดึงรายชื่อโมเดล…');try{const ms=await LOCALAI.models(form());$('#ai-models').innerHTML=ms.map(m=>`<option value="${esc(m)}">`).join('');
  msg(ms.length?`พบ ${ms.length} โมเดล · เลือกในช่องโมเดล`:'ไม่พบโมเดล',!!ms.length);if(ms.length&&!$('#ai-model').value)$('#ai-model').value=ms[0];dot(ms.length?'on':'')}
  catch(e){msg('เชื่อมต่อไม่ได้: '+(e.message||'ดู "เชื่อมต่อไม่ได้?" ด้านล่าง'),false);dot('off')}};
$('#ai-test').onclick=async()=>{const b=$('#ai-test');b.disabled=true;msg('กำลังทดสอบ…');const t0=performance.now();
  try{const a=await LOCALAI.ask('ตอบคำเดียวว่า พร้อม',{cfg:form(),timeout:60000});msg(`เชื่อมต่อได้ · ${Math.round(performance.now()-t0)} ms · "${a.trim().slice(0,40)}"`,true);dot('on')}
  catch(e){msg('เชื่อมต่อไม่ได้: '+(e.name==='AbortError'?'หมดเวลา':e.message||'ตรวจที่อยู่และ CORS'),false);dot('off')}finally{b.disabled=false}};
$('#ai-ask').onclick=async()=>{const q=$('#ai-q').value.trim();if(!q){$('#ai-q').focus();return}const b=$('#ai-ask'),box=$('#ai-ans');b.disabled=true;box.hidden=false;box.textContent='AI HELP กำลังคิด…';
  try{box.textContent=(await LOCALAI.ask(q,{cfg:form()})).trim()||'(ไม่มีคำตอบ)';dot('on')}catch(e){box.textContent='เชื่อมต่อไม่ได้: '+(e.message||'');dot('off')}finally{b.disabled=false}};
/* ---------- Discord (CENTRAL เท่านั้น) ---------- */
const DC=['newCrit','sos','critWait'];
function dcShow(r){$('#dc-card').hidden=false;$('#dc-tag').textContent=r.connected?'เชื่อมแล้ว '+r.hook:'ยังไม่เชื่อม';$('#dc-dot').className='st-dot '+(r.connected?'on':'');
  DC.forEach(k=>$('#dc-'+k).checked=!!r[k]);$('#dc-sum').value=String(r.summaryH??3);$('#dc-url').value='';$('#dc-url').placeholder=r.connected?'เชื่อมแล้ว · วาง URL ใหม่เพื่อเปลี่ยน':'https://discord.com/api/webhooks/…'}
const dmsg=(t,ok)=>{const m=$('#dc-msg');m.textContent=t;m.className='st-msg'+(ok===true?' ok':ok===false?' bad':'')};
async function dcLoad(){const r=await apiGet({action:'discord_cfg'}).catch(()=>null);if(r&&r.ok)dcShow(r)}
$('#dc-save').onclick=async()=>{const d={summaryH:+$('#dc-sum').value};DC.forEach(k=>d[k]=$('#dc-'+k).checked);const u=$('#dc-url').value.trim();if(u)d.url=u;
  dmsg('กำลังบันทึก…');const r=await apiPost({action:'discord_save',discord:d}).catch(()=>null);
  if(r&&r.ok){dcShow(r);dmsg(u?'เชื่อมแล้ว · กด "ส่งข้อความทดสอบ" เพื่อลอง':'บันทึกแล้ว',true)}else dmsg(r&&r.error==='bad_webhook'?'URL ไม่ใช่ Webhook ของ Discord':'บันทึกไม่สำเร็จ',false)};
$('#dc-test').onclick=async()=>{dmsg('กำลังส่ง…');const r=await apiPost({action:'discord_test'}).catch(()=>null);dmsg(r&&r.ok?'ส่งแล้ว · ดูในห้อง Discord':r&&r.error==='not_connected'?'ยังไม่ได้ใส่ Webhook URL':'ส่งไม่สำเร็จ · ตรวจ URL',!!(r&&r.ok))};
$('#dc-now').onclick=async()=>{dmsg('AI HELP กำลังเขียนสรุป…');const r=await apiPost({action:'discord_test',kind:'summary'}).catch(()=>null);dmsg(r&&r.ok?'ส่งสรุปแล้ว':'ส่งไม่สำเร็จ',!!(r&&r.ok))};
adminBoot({action:'chat_rev'},'rev',()=>{dcLoad()});
