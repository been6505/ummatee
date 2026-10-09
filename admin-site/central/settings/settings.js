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
/* ---------- รับตำแหน่งทาง SMS (CENTRAL เท่านั้น) ---------- */
async function smsLoad(renew){const r=await apiPost({action:'sms_cfg',renew:!!renew}).catch(()=>null);if(!r||!r.ok)return;$('#sms-card').hidden=false;
  $('#sms-url').value=location.origin+'/api/sms-in?k='+r.secret;if(renew)$('#sms-msg').textContent='สร้างลิงก์ใหม่แล้ว · ลิงก์เก่าใช้ไม่ได้ · อัปเดตในแอปส่งต่อ SMS ด้วย'}
$('#sms-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#sms-url').value);$('#sms-msg').textContent='คัดลอกแล้ว'}catch(e){$('#sms-url').select()}};
$('#sms-renew').onclick=()=>{if(confirm('สร้างลิงก์ใหม่? ลิงก์เดิมในมือถือเบอร์ศูนย์จะใช้ไม่ได้'))smsLoad(true)};
/* ---------- ประวัติการเปลี่ยนแปลง (audit log) · CENTRAL เท่านั้น · รายการใหม่ขึ้นเองทุก 20 วิ ---------- */
const LG={items:[],cat:'',role:'',q:'',more:false,busy:false,open:new Set()};
const LG_ROLE={central:['CENTRAL','c'],warroom:['War Room','w'],team:['ทีม','t'],public:['ทั่วไป','p']};
const LG_KEY={id:'รหัส',status:'สถานะ',volunteer:'ทีม',hqNote:'หมายเหตุ',bags:'ถุงยังชีพ',note:'หมายเหตุ',team:'ทีม',name:'ชื่อ',by:'โดย',text:'ข้อความ',qty:'จำนวน',type:'ประเภท',step:'ขั้นตอน',approve:'อนุมัติ',username:'ชื่อผู้ใช้',warroom:'War Room',item:'รายการ',user:'ผู้ใช้',staff:'ทีมงาน',cctv:'CCTV',dupOf:'ซ้ำกับ',lat:'ละติจูด',lng:'ลองจิจูด'};
const lgEsc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function lgVal(v){if(v==null||v==='')return '–';if(typeof v==='boolean')return v?'ใช่':'ไม่';if(typeof v==='object')return Object.entries(v).filter(([,x])=>x!==''&&x!=null).map(([k,x])=>`${LG_KEY[k]||k}: ${typeof x==='object'?JSON.stringify(x):x}`).join(' · ');return String(v)}
function lgDay(t){const d=new Date(t),n=new Date();const y=new Date(n);y.setDate(n.getDate()-1);return d.toDateString()===n.toDateString()?'วันนี้':d.toDateString()===y.toDateString()?'เมื่อวาน':d.toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short',year:'2-digit'})}
function lgDraw(){const el=$('#lg-list');if(!LG.items.length){el.innerHTML=`<p class="lg-empty">${LG.busy?'กำลังโหลด…':'ยังไม่มีประวัติในเงื่อนไขนี้'}</p>`;$('#lg-more').hidden=true;return}
  let day='',h='';LG.items.forEach(x=>{const d=lgDay(x.at);if(d!==day){day=d;h+=`<p class="lg-day">${lgEsc(d)}</p>`}
    const [rl,rk]=LG_ROLE[x.role]||['?','p'],op=LG.open.has(x.id);let data={};try{data=JSON.parse(x.data||'{}')}catch(e){}
    h+=`<button type="button" class="lg-it" data-lg="${x.id}" aria-expanded="${op}"><span class="lg-t">${new Date(x.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}</span><span class="lg-r lg-${rk}">${lgEsc(rl)}</span><span class="lg-m"><b>${lgEsc(x.summary)}</b><small>${lgEsc(x.actor)}</small></span></button>`
      +(op?`<dl class="lg-d">${Object.entries(data).filter(([k,v])=>v!==''&&v!=null&&v!=='•••'&&k!=='key'&&k!=='tk').map(([k,v])=>`<dt>${lgEsc(LG_KEY[k]||k)}</dt><dd>${lgEsc(lgVal(v))}</dd>`).join('')||'<dd>ไม่มีรายละเอียดเพิ่ม</dd>'}<dt>เวลา</dt><dd>${lgEsc(new Date(x.at).toLocaleString('th-TH'))}</dd><dt>คำสั่ง</dt><dd><code>${lgEsc(x.action)}</code></dd></dl>`:'')});
  el.innerHTML=h;$('#lg-more').hidden=!LG.more}
async function lgLoad(more){if(LG.busy)return;LG.busy=true;if(!more&&!LG.items.length)lgDraw();
  const p={action:'audit_list',limit:50};if(LG.cat)p.cat=LG.cat;if(LG.role)p.role=LG.role;if(LG.q)p.q=LG.q;if(more&&LG.items.length)p.before=LG.items[LG.items.length-1].id;
  try{const r=await apiGet(p);if(!r||!r.ok)return;$('#log-card').hidden=false;
    if(more)LG.items=LG.items.concat(r.items);else{LG.items=r.items;}LG.more=r.more}catch(e){}finally{LG.busy=false;lgDraw()}}
async function lgPoll(){if(document.hidden||$('#log-card').hidden||!LG.items.length)return;const p={action:'audit_list',limit:50};if(LG.cat)p.cat=LG.cat;if(LG.role)p.role=LG.role;if(LG.q)p.q=LG.q;
  try{const r=await apiGet(p);if(!r||!r.ok)return;const top=LG.items[0].id,nu=r.items.filter(x=>x.id>top);if(nu.length){LG.items=nu.concat(LG.items);lgDraw()}}catch(e){}}
$('#lg-cat').onclick=e=>{const b=e.target.closest('[data-cat]');if(!b)return;LG.cat=b.dataset.cat;$$('#lg-cat [data-cat]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));LG.items=[];lgLoad()};
$('#lg-role').onchange=e=>{LG.role=e.target.value;LG.items=[];lgLoad()};
{let t;$('#lg-q').oninput=e=>{clearTimeout(t);t=setTimeout(()=>{LG.q=e.target.value.trim();LG.items=[];lgLoad()},350)}}
$('#lg-more').onclick=()=>lgLoad(true);
$('#lg-list').onclick=e=>{const b=e.target.closest('[data-lg]');if(!b)return;const id=+b.dataset.lg;LG.open.has(id)?LG.open.delete(id):LG.open.add(id);lgDraw()};
setInterval(lgPoll,20000);
adminBoot({action:'chat_rev'},'rev',()=>{dcLoad();smsLoad();lgLoad()});
