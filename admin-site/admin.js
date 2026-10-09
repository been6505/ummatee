/* หลังบ้าน UM+: ดู/ค้นหา/เปลี่ยนสถานะเคส ใช้รหัสทีมอาสา (ไม่เก็บข้อมูลเคสไว้ในเครื่อง) */
const API_URL='/api';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ST={open:'รอความช่วยเหลือ',going:'ทีมกำลังไป',done:'ช่วยเหลือแล้ว'};
const URG={3:'วิกฤต',2:'เร่งด่วน',1:'ทั่วไป'};
const VUL={elderly:'ผู้สูงอายุ',child:'เด็กเล็ก',infant:'ทารก',pregnant:'หญิงตั้งครรภ์',disabled:'ผู้พิการ',bedridden:'ผู้ป่วยติดเตียง',oxygen:'ใช้ออกซิเจน / เครื่องช่วยหายใจ',dialysis:'ผู้ป่วยฟอกไต',chronic:'ผู้ป่วยโรคเรื้อรัง'};
const LEVEL={ankle:'ข้อเท้า',knee:'เข่า',waist:'เอว',chest:'อก',roof:'มิดหัว / หลังคา'};
const store={get(k){try{return localStorage.getItem(k)||sessionStorage.getItem(k)||''}catch(e){return ''}},
  set(k,v,remember){try{if(!v){localStorage.removeItem(k);sessionStorage.removeItem(k);return}(remember?localStorage:sessionStorage).setItem(k,v)}catch(e){}}};
const A={key:store.get('uh_vol_key'),cases:[],loaded:0,loading:false,mode:['both','list','map'].includes(store.get('uh_view'))?store.get('uh_view'):'both',map:null,layer:null,openId:null,rev:null};

const sev=c=>typeof VERIFY!=='undefined'&&VERIFY.level?VERIFY.level(c):Math.min(3,Math.max(1,Number(c.urgency)||1)); // ระดับที่ระบบตัดสิน (ผู้แจ้ง + ข้อมูลระบบ)
const bagsOf=c=>c.bags===''||c.bags==null?null:Number(c.bags);
const bagSuggest=c=>hh(c)||1; // แนะนำ: ครัวเรือนละ 1 ถุง
const hh=c=>{const n=Number(c.households);if(n>0)return n;const m=String(c.notes||'').match(/\[ครัวเรือน (\d+)\]/);return m?+m[1]:0};
const vul=c=>(Array.isArray(c.vulnerable)?c.vulnerable:String(c.vulnerable||'').split(/\s*,\s*/)).filter(Boolean).map(v=>VUL[v]||v);
const notesOf=c=>String(c.notes||'').replace(/^\[ครัวเรือน \d+\]\s*/,'');
const tel=c=>String(c.phone||'').replace(/^'/,'').replace(/[^\d+]/g,'');
const hasPin=c=>c.lat!==''&&c.lat!=null&&c.lng!==''&&c.lng!=null&&!isNaN(+c.lat)&&!isNaN(+c.lng);
const addr=c=>[c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ');
function ago(t){t=Number(t);if(!t)return '';const m=Math.round((Date.now()-t)/60000);if(m<1)return 'เมื่อสักครู่';if(m<60)return m+' นาทีที่แล้ว';const h=Math.round(m/60);if(h<24)return h+' ชม.ที่แล้ว';return new Date(t).toLocaleDateString('th-TH',{day:'numeric',month:'short'})+' '+new Date(t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}
function fullTime(t){t=Number(t);return t?new Date(t).toLocaleString('th-TH',{day:'numeric',month:'short',year:'2-digit',hour:'2-digit',minute:'2-digit'}):''}
function toast(msg,ok){const t=document.createElement('div');t.className='toast'+(ok?' ok':'');t.textContent=msg;$('#toasts').append(t);setTimeout(()=>t.remove(),4000)}

/* ---------- API ---------- */
async function api(params){const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),20000);
  try{const r=await fetch(API_URL+'?'+new URLSearchParams({...params,t:Date.now()}),{signal:ctl.signal,cache:'no-store'});return await r.json()}finally{clearTimeout(tm)}}
async function post(body){const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});return r.json()}

/* ---------- เข้าสู่ระบบ ---------- */
function showLogin(msg){$('#app').hidden=true;$('#login').hidden=false;$('#login-err').textContent=msg||'';setTimeout(()=>$('#login-key').focus(),50)}
function showApp(){$('#login').hidden=true;$('#app').hidden=false}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const k=$('#login-key').value.trim();if(!k)return;
  $('#login-go').disabled=true;$('#login-err').textContent='กำลังตรวจรหัส…';
  try{const r=await api({action:'list',key:k});
    if(r&&r.ok&&r.volunteer){A.key=k;store.set('uh_vol_key',k,$('#login-remember').checked);store.set('uh_vol_ok','1',$('#login-remember').checked);$('#login-key').value='';setCases(r);showApp();render();loadHM();startPolling();loadFlood();if(typeof MX!=='undefined')MX.loadZones()}
    else $('#login-err').textContent='รหัสไม่ถูกต้อง';
  }catch(err){$('#login-err').textContent='เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'}
  finally{$('#login-go').disabled=false}});
$('#logout').addEventListener('click',()=>{store.set('uh_vol_key','');store.set('uh_vol_ok','');A.key='';A.cases=[];closeDrawer();$('#list').replaceChildren();showLogin('ออกจากระบบแล้ว')});

/* ---------- โหลดข้อมูล ---------- */
function setCases(r){A.own=(r.cases||[]).map(c=>({...c,needs:Array.isArray(c.needs)?c.needs:String(c.needs||'').split(/\s*,\s*/).filter(Boolean)}));A.loaded=Date.now();mergeCases()}
/* ---------- เคสจาก Help Me (Google Sheet) = ข้อมูลหลัก · ชุดเดียวกับหน้าแดชบอร์ด ----------
   เคส Help Me แก้สถานะที่นี่ไม่ได้ (ต้นทางอยู่ที่ชีตของ Help Me) → แสดงแบบอ่านอย่างเดียว + ปุ่มเปิดใน Help Me
   เคสขององค์กรที่รับมาจาก Help Me (ในบันทึกมีลิงก์ ?case=) ไม่แสดงซ้ำ ใช้ข้อมูลจาก Help Me แทน */
const HM_URL=id=>'https://helpme-th.pages.dev/?case='+encodeURIComponent(id);
const HM_LINK=/helpme-th\.pages\.dev\/\?case=([\w-]+)/;
const isHM=id=>String(id).startsWith('hm-');
const apiId=id=>isHM(id)?String(id).slice(3):id; // เคส Help Me อยู่ในฐานข้อมูลเราด้วยรหัสเดิม (ซิงก์ทุก 1 นาที) จึงแก้สถานะ/ทีม/ถุงได้
async function loadHM(){if(!A.key)return;
  try{const r=await api({action:'helpme_cases',key:A.key});
    if(r&&r.ok&&Array.isArray(r.cases)){A.hm=r.cases.map(c=>({...c,hm:true,hmId:c.id,id:'hm-'+c.id,needs:Array.isArray(c.needs)?c.needs:String(c.needs||'').split(/\s*,\s*/).filter(Boolean)}));A.hmAt=Date.now();mergeCases();render()}
  }catch(e){}}
function mergeCases(){const own=A.own||[];if(!A.hm){A.cases=own;return}
  // เคสของเราที่เป็นสำเนาเคส Help Me: รหัสเดียวกัน (ยกมาตรง ๆ) หรือบันทึกมีลิงก์ ?case= (รับมาจากคิวโซเชียล)
  const hmIds=new Set(A.hm.map(h=>h.hmId)),hmOf=c=>hmIds.has(String(c.id))?String(c.id):((String(c.notes||'').match(HM_LINK)||[])[1]||'');
  const link=new Map();own.forEach(c=>{const h=hmOf(c);if(h&&hmIds.has(h))link.set(h,c)});
  // แสดงเคส Help Me ใบเดียว แต่ยังใช้ข้อมูลที่ทีมเราบันทึกในสำเนา (จำนวนถุงยังชีพ ผลดูกล้อง ครัวเรือน)
  A.cases=[...A.hm.map(c=>{const o=link.get(c.hmId);return o?{...c,local:o.id,bags:o.bags,cctv:o.cctv||c.cctv,households:o.households}:c}),...own.filter(c=>!hmIds.has(hmOf(c)))]}
async function load(){if(A.loading||!A.key)return;A.loading=true;$('#sync').textContent='กำลังโหลด…';
  try{const r=await api({action:'list',key:A.key});
    if(!r||!r.ok)throw new Error(r&&r.error||'error');
    if(!r.volunteer){store.set('uh_vol_key','');store.set('uh_vol_ok','');A.key='';showLogin('รหัสหมดอายุหรือถูกเปลี่ยน กรุณาเข้าสู่ระบบใหม่');return}
    setCases(r);render();loadHM();
    // ลิงก์ admin.html#<รหัสเคส> (เช่นจากหน้าเคสจากโซเชียล) เปิดเคสนั้นทันที ครั้งเดียว
    const h=decodeURIComponent(location.hash.slice(1));if(h&&findCase(h)){history.replaceState(null,'',location.pathname);openDrawer(h)}
  }catch(e){$('#sync').textContent='โหลดไม่สำเร็จ · ลองใหม่'}
  finally{A.loading=false}}
let pollT=null;
function startPolling(){clearInterval(pollT);pollT=setInterval(async()=>{if(document.hidden||!A.key)return;
  try{const r=await api({action:'rev'});if(r&&r.ok&&r.rev!=null){if(A.rev!==null&&r.rev!==A.rev){A.rev=r.rev;load()}else A.rev=r.rev}}catch(e){}
  if(Date.now()-A.loaded>120000)load()},15000)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&A.key&&Date.now()-A.loaded>30000)load()});
$('#refresh').addEventListener('click',load);

/* ---------- กรอง / เรียง ---------- */
const norm=s=>{s=String(s==null?'':s);try{s=s.normalize('NFC')}catch(e){}return s.replace(/[​-‍﻿]/g,'').replace(/ํ([่-๋]?)า/g,'$1ำ').toLowerCase()};
const digits=x=>{let d=String(x||'').replace(/\D/g,'');if(d.startsWith('66')&&d.length>=11)d=d.slice(2);return d.replace(/^0+/,'')};
function hay(c){return norm([c.id,(c.needs||[]).join(' '),c.district,c.district?'เขต'+c.district:'',c.address,c.name,c.phone,c.notes,c.volunteer,ST[c.status],URG[sev(c)],LEVEL[c.level]||'',(c.people||1)+' คน',hh(c)?hh(c)+' ครัวเรือน':'',vul(c).join(' ')].join(' '))}
// ผลตรวจพื้นที่ที่ถือว่า "ลำบาก + ยืนยันแล้ว"
const VR_OK=new Set(['confirmed','likely']);
// ใช้ VR_ORDER เดิม (มาก = วิกฤต/ยืนยันได้มากกว่า) → กลับด้านเพื่อให้เรียงขึ้นก่อน
const vrRank=c=>-(VR_ORDER[vr(c).result.k]??2);
function filtered(){
  const q=norm($('#q').value.trim()),st=$('#f-status').value,u=$('#f-urg').value,nd=$('#f-need').value,so=$('#f-sort').value;
  return A.cases.filter(c=>{
    if(q){const h=hay(c);const ok=q.split(/\s+/).every(t=>{if(h.includes(t))return true;const d=digits(t);return /^[\d+\-\s]+$/.test(t)&&d.length>=3&&digits(c.phone).includes(d)});if(!ok)return false}
    if(st==='active'&&c.status==='done')return false;
    if(['open','going','done'].includes(st)&&c.status!==st)return false;
    if(u&&String(sev(c))!==u)return false;
    if(nd&&!(c.needs||[]).join(' ').includes(nd))return false;
    const fv=$('#f-vr').value;if(fv==='verified'){if(!VR_OK.has(vr(c).result.k))return false}else if(fv==='covered'){if(!cov(c))return false}else if(fv==='notcovered'){if(cov(c))return false}else if(fv&&vr(c).result.k!==fv)return false;
    const fz=$('#f-zone').value;if(fz&&typeof MX!=='undefined'&&!MX.inZone(c,fz))return false;
    return true}).sort((a,b)=>{const ca=Number(a.createdAt)||0,cb=Number(b.createdAt)||0;
      if(so==='new')return cb-ca;if(so==='old')return ca-cb;if(so==='ppl')return (Number(b.people)||1)-(Number(a.people)||1);
      if(so==='score')return ((a.status==='done')-(b.status==='done'))||(vr(b).score-vr(a).score)||(ca-cb);
      // วิกฤตก่อน: ในระดับความรุนแรงเดียวกัน เคสที่ตรวจพื้นที่แล้วยืนยันได้ขึ้นก่อน เคสที่ยืนยันไม่ได้ลงท้าย
      return ((a.status==='done')-(b.status==='done'))||(sev(b)-sev(a))||(vrRank(a)-vrRank(b))||({open:0,going:1,done:2}[a.status]-{open:0,going:1,done:2}[b.status])||(vr(b).score-vr(a).score)||(ca-cb)});
}
['#q','#f-status','#f-urg','#f-need','#f-sort','#f-vr','#f-zone'].forEach(s=>$(s).addEventListener(s==='#q'?'input':'change',()=>{fCount();render()}));
function fCount(){const n=($('#f-status').value!=='active')+!!$('#f-urg').value+!!$('#f-need').value+!!$('#f-vr').value+!!$('#f-zone').value+($('#f-sort').value!=='urg');$('#f-n').textContent=n;$('#f-n').hidden=!n}
$('#f-toggle').addEventListener('click',()=>{const o=!$('#filters-box').classList.contains('open');$('#filters-box').classList.toggle('open',o);$('#f-toggle').setAttribute('aria-expanded',String(o))});

/* ---------- ตรวจสอบพื้นที่ (Floodboard + CCTV) ---------- */
const VR_ORDER={confirmed:5,likely:4,conflict:3,unverified:2,notcrit:1,nopin:0};
let vrCache=new Map();
function vr(c){const ai=aiCctvOf(c),k=c.id+'|'+VERIFY.F.loaded+'|'+c.cctv+'|'+ai+'|'+c.urgency+'|'+c.level+'|'+c.lat;const h=vrCache.get(c.id);if(h&&h.k===k)return h.v;const v=VERIFY.assess(c.cctv||!ai?c:{...c,cctv:ai});vrCache.set(c.id,{k,v});return v}
/* ---------- ตรวจกล้อง CCTV อัตโนมัติ (Workers AI ดูภาพกล้องใกล้จุด ≤ 2 กม.) ----------
   เรียกเมื่อเปิดดูเคส · จำผลต่อเคส 10 นาที · ใช้เป็นหลักฐานเฉพาะตอน "เห็นน้ำ" จากกล้องไม่เกิน 1 กม.
   (กล้องถนน "ไม่เห็นน้ำ" ไม่ได้แปลว่าบ้านในซอยไม่ท่วม จึงไม่หักคะแนน) */
const AI=new Map();
const camDist=d=>d<1000?Math.round(d)+' ม.':(d/1000).toFixed(1)+' กม.';
function aiCctvOf(c){const a=AI.get(String(c.id));if(!a||!a.data||a.data.verdict!=='flood')return '';
  const hit=a.data.checks.find(x=>x.flood==='yes'&&x.d<=1000);return hit?'flood|ตรวจอัตโนมัติ '+new Date(a.data.time).toTimeString().slice(0,5):''}
function aiCheck(c){if(!hasPin(c)||c.status==='done')return;const id=String(c.id),a=AI.get(id);
  if(a&&(a.loading||Date.now()-a.at<10*60e3))return;
  AI.set(id,{loading:true,at:Date.now()});
  api({action:'cctv_ai',key:A.key,lat:c.lat,lng:c.lng}).then(r=>{AI.set(id,{at:Date.now(),data:r&&r.ok?r:null,err:!(r&&r.ok)})})
    .catch(()=>AI.set(id,{at:Date.now(),err:true})).finally(()=>{if(A.openId===id)renderDrawer();render()})}
function aiBlock(c){if(!hasPin(c)||c.status==='done')return '';const a=AI.get(String(c.id));
  const RES={yes:['เห็นน้ำ','bad'],no:['ไม่เห็นน้ำ','ok'],unclear:['ภาพไม่ชัด','na']};
  let line;
  if(!a||a.loading)line='<span class="vr-ai-wait">กำลังตรวจกล้องใกล้จุด…</span>';
  else if(a.err)line='ตรวจกล้องไม่สำเร็จ';
  else if(a.data.verdict==='none')line='ไม่มีกล้องที่มีภาพในรัศมี 2 กม.';
  else{const near=a.data.checks[0];line=a.data.verdict==='flood'?'<b class="t-bad">เห็นน้ำท่วม</b>':a.data.verdict==='clear'?'<b class="t-ok">ไม่เห็นน้ำบนถนน</b> · ในซอยอาจยังท่วม':'<b>ภาพไม่ชัด</b> ตัดสินไม่ได้';
    line+=` · ใกล้สุด ${camDist(near.d)}`}
  const shots=a&&a.data&&a.data.checks.length?`<div class="vr-ai-shots">${a.data.checks.map(x=>{const [t,k]=RES[x.flood]||RES.unclear;
    return `<a href="${esc(x.img)}" target="_blank" rel="noopener"><img src="${esc(x.img)}" alt="${esc(x.title)}" loading="lazy"><span class="vr-chip k-${k}">${t}</span><small>${camDist(x.d)} · ${esc(x.title)}${x.note?'<br>'+esc(x.note):''}</small></a>`}).join('')}</div>`:'';
  return `<div class="vr-ai"><div class="vr-ai-h"><i data-ic="cam"></i> กล้อง CCTV (ตรวจอัตโนมัติ): ${line}</div>${shots}</div>`}
async function loadFlood(force){try{await VERIFY.load(force)}catch(e){}render();if(typeof COVERED!=='undefined')COVERED.load(API_URL,A.key).then(render,render)}
const cov=c=>typeof COVERED!=='undefined'?COVERED.match(c):null;
function covBadge(c){const m=cov(c);if(!m)return '';const r=m.best.r;return `<span class="cov" title="${esc(r.org+' · '+r.area+' · '+r.date+' · '+m.best.how)}"><i data-ic="hand"></i> ${esc(r.org)} เคยมอบใกล้เคียง</span>`}
function covSection(c){const m=cov(c);if(!m)return '';return `<section class="cov-box"><b><i data-ic="hand"></i> มีองค์กรอื่นเคยมอบใกล้เคียง</b><p class="small">ตรวจสอบก่อนส่งทีม เพื่อไม่ให้ซ้ำซ้อน · ข้อมูลจาก<a href="${COVERED.SHEET_URL}" target="_blank" rel="noopener"> ชีตพื้นที่ที่มอบแล้ว ↗</a></p><ul>${m.all.slice(0,4).map(h=>`<li><b>${esc(h.r.org)}</b> · ${esc(h.r.area)} · ${esc(h.r.date)}<small>${esc(h.how)}${h.d!=null?' · ห่าง '+Math.round(h.d)+' ม.':''}${h.r.link?` · <a href="${esc(h.r.link)}" target="_blank" rel="noopener">แผนที่ ↗</a>`:''}</small></li>`).join('')}</ul></section>`}
setInterval(()=>{if(A.key&&!document.hidden)loadFlood()},10*60e3);
VERIFY.onUpdate=()=>render(); // ฝน/ดาวเทียมรายจุดมาถึงทีหลัง → วาดผลตรวจใหม่
function vrBadge(c){const v=vr(c),ext=v.chips.filter(x=>/^(ดาวเทียม|ฝน)/.test(x.t)&&x.k!=='na').slice(0,2);
  return covBadge(c)+`<span class="vr vr-${v.result.k}" title="${esc(v.result.d)}">${esc(v.result.t)}</span><small class="vr-score">คะแนน ${v.score}/100</small>${ext.map(x=>`<span class="vr-chip k-${x.k} sm">${esc(x.t)}</span>`).join('')}`}

/* ---------- แสดงผล ---------- */
const SF={all:{st:'all',u:''},crit:{st:'active',u:'3'},open:{st:'open',u:''},going:{st:'going',u:''},done:{st:'done',u:''},active:{st:'active',u:''}};
function statKey(){const st=$('#f-status').value,u=$('#f-urg').value;if($('#f-need').value||$('#f-vr').value)return '';return Object.keys(SF).find(k=>SF[k].st===st&&SF[k].u===u)||''}
$('#stats').addEventListener('click',e=>{const b=e.target.closest('[data-sf]');if(!b)return;const k=b.getAttribute('aria-pressed')==='true'&&b.dataset.sf!=='active'?'active':b.dataset.sf,f=SF[k];
  $('#f-status').value=f.st;$('#f-urg').value=f.u;$('#f-need').value='';$('#f-vr').value='';
  const sw=document.querySelector('.view-sw [data-view="cases"]');if(sw&&sw.getAttribute('aria-selected')!=='true')sw.click();
  fCount();render();const t=$('#map-wrap:not([hidden])')||$('#list');if(t&&window.innerWidth<1024)t.scrollIntoView({behavior:'smooth',block:'start'})});
function render(){
  // การ์ดสรุปนับจากเคส Help Me (ชุดเดียวกับแดชบอร์ด) ถ้ายังโหลดไม่ได้ใช้เคสในระบบไปก่อน
  const all=A.cases,base=A.hm||all,n=s=>base.filter(c=>c.status===s).length,act=base.filter(c=>c.status!=='done');
  const ppl=act.reduce((s,c)=>s+(Number(c.people)||1),0),hhs=act.reduce((s,c)=>s+hh(c),0),crit=act.filter(c=>sev(c)===3).length,confirmed=act.filter(c=>vr(c).result.k==='confirmed').length,conflict=act.filter(c=>vr(c).result.k==='conflict').length;
  // การ์ดตัวเลขกดได้: ตั้งตัวกรองรายการเคสตามการ์ดนั้น (กดซ้ำ = กลับเป็นค่าเริ่มต้น)
  const cur=statKey();
  $('#stats').innerHTML=[[A.hm?'ทั้งหมด <small class="hm-tag">Help Me</small>':'ทั้งหมด',base.length,'','all'],['วิกฤต · ยืนยันแล้ว '+confirmed+(conflict?' · ขัดแย้ง '+conflict:''),crit,'red','crit'],['รอความช่วยเหลือ',n('open'),'wait','open'],['ทีมกำลังไป',n('going'),'go','going'],['ช่วยเหลือแล้ว',n('done'),'done','done'],['คนที่ยังรอ',ppl,'','active'],['ครัวเรือนที่ยังรอ',hhs||'–','','active'],['ถุงยังชีพที่ระบุแล้ว',all.reduce((s,c)=>s+(bagsOf(c)||0),0),'','active']]
    .map(([t,v,k,f])=>`<button type="button" class="stat ${k}" data-sf="${f}" aria-pressed="${cur===f}" title="กดเพื่อแสดงเคสกลุ่มนี้"><b>${esc(v)}</b><span>${t}</span></button>`).join('');
  const list=filtered();
  const ownOnly=all.length-(A.hm?A.hm.length:0);
  $('#count').textContent=`แสดง ${list.length} จาก ${all.length} เคส`+(A.hm?` · Help Me ${A.hm.length}${ownOnly?` + ขององค์กร ${ownOnly}`:''}`:' · กำลังโหลดเคส Help Me…');
  $('#sync').textContent=(A.loaded?'อัปเดต '+new Date(A.loaded).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'')+(VERIFY.F.error?' · '+VERIFY.F.error:VERIFY.F.loaded?' · น้ำท่วม '+new Date(VERIFY.F.loaded).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'');
  if(A.mode!=='map'){if(document.activeElement&&document.activeElement.matches('.bag-in')){A.pendingList=true}else renderList(list)}
  if(A.mode!=='list')drawMap(list);
  if(A.openId)renderDrawer();
}
function renderList(list){
  const el=$('#list');
  if(!list.length){el.innerHTML='<p class="empty">ไม่มีเคสที่ตรงกับตัวกรอง</p>';return}
  el.innerHTML=`<table class="tbl"><thead><tr><th>ระดับ</th><th>ตรวจพื้นที่</th><th>สถานะ</th><th>ความต้องการ</th><th>คน / ครัวเรือน</th><th>ถุงยังชีพ</th><th>ที่อยู่</th><th>ผู้ติดต่อ</th><th>ทีม</th><th>แจ้งเมื่อ</th><th></th></tr></thead><tbody>`+
    list.map(c=>{const t=tel(c);return `<tr class="u${sev(c)} s-${esc(c.status)}" data-id="${esc(c.id)}">
      <td data-l="ระดับ"><span class="urg urg-${sev(c)}" title="ระดับที่ระบบตัดสินจากข้อมูลผู้แจ้ง + ข้อมูลระบบ">${URG[sev(c)]}</span></td>
      <td data-l="ตรวจพื้นที่" class="vr-cell">${c.status==='done'?'<small>—</small>':vrBadge(c)}</td>
      <td data-l="สถานะ">${c.hm?'<small class="hm-tag">Help Me</small>':''}${`<select class="st-sel st-${esc(c.status)}" data-st="${esc(c.id)}" aria-label="สถานะเคส ${esc(c.id)}">${Object.entries(ST).map(([k,v])=>`<option value="${k}" ${c.status===k?'selected':''}>${v}</option>`).join('')}</select>`}${c.status==='going'&&c.teamDoneAt?'<small class="td-tag">ทีมแจ้งช่วยแล้ว · รอปิดเคส</small>':''}</td>
      <td data-l="ความต้องการ" class="needs"><b>${esc((c.needs||[]).join(' · ')||'ขอความช่วยเหลือ')}</b>${c.level?`<small>น้ำ${esc(LEVEL[c.level]||c.level)}</small>`:''}${vul(c).length?`<small class="vul">ดูแลพิเศษ: ${esc(vul(c).join(', '))}</small>`:''}${photosOf(c).length?`<span class="row-photos" data-open="${esc(String(c.id))}" title="ดูรูปจากผู้แจ้ง">${photosOf(c).slice(0,4).map((id,i)=>`<img src="https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w160" data-alt-src="https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w160" alt="รูปที่ ${i+1} จากผู้แจ้ง" loading="lazy" referrerpolicy="no-referrer">`).join('')}${photosOf(c).length>4?`<em>+${photosOf(c).length-4}</em>`:''}</span>`:''}</td>
      <td data-l="คน / ครัวเรือน" class="num">${esc(c.people||1)} คน${hh(c)?`<small>${hh(c)} ครัวเรือน</small>`:''}</td>
      <td data-l="ถุงยังชีพ" class="bag">${`<input class="bag-in" type="number" min="0" max="9999" inputmode="numeric" data-bag="${esc(c.id)}" value="${bagsOf(c)==null?'':bagsOf(c)}" placeholder="${bagSuggest(c)}" aria-label="จำนวนถุงยังชีพ เคส ${esc(c.id)}" title="ว่างไว้ = ยังไม่ระบุ (แนะนำ ${bagSuggest(c)} ถุง)"><small>ถุง</small>`}</td>
      <td data-l="ที่อยู่" class="addr">${esc(addr(c)||'—')}${hasPin(c)?(pinWarn(c)?'<small class="warn">หมุดอาจผิด</small>':c.pinCheck&&c.pinCheck.status==='geocoded'?`<small class="muted" title="${esc(c.pinCheck.label||'')}">📍 หมุดจากที่อยู่ (${esc((String(c.pinCheck.label||'').match(/^ระดับ(\S+)/)||[])[1]||'ประมาณ')})</small>`:c.pinCheck?'<small class="muted">หมุดปรับจากที่อยู่</small>':''):'<small class="warn">ไม่มีหมุด</small>'}</td>
      <td data-l="ผู้ติดต่อ">${esc(c.name||'')}${t.length>=9?`<a class="tel" href="tel:${esc(t)}">${esc(String(c.phone).replace(/^'/,''))}</a>`:esc(c.phone||'')}</td>
      <td data-l="ทีม">${esc(c.volunteer||'—')}</td>
      <td data-l="แจ้งเมื่อ" class="time" title="${esc(fullTime(c.createdAt))}">${esc(ago(c.createdAt))}<small>#${esc(c.hmId||c.id)}</small></td>
      <td class="act"><button class="btn ghost sm" data-open="${esc(c.id)}">ดู</button></td></tr>`}).join('')+'</tbody></table>';
}
$('#list').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b){openDrawer(b.dataset.open);return}
  if(e.target.closest('a,select,button'))return;const tr=e.target.closest('tr[data-id]');if(tr)openDrawer(tr.dataset.id)});
$('#list').addEventListener('change',e=>{const b=e.target.closest('[data-bag]');if(b){saveBags(b.dataset.bag,b.value,b);return}const s=e.target.closest('[data-st]');if(s)changeStatus(s.dataset.st,s.value,s)});
$('#list').addEventListener('focusout',e=>{if(e.target.matches('.bag-in')&&A.pendingList){A.pendingList=false;setTimeout(()=>{if(!document.activeElement||!document.activeElement.matches('.bag-in'))render()},0)}});
$('#list').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('.bag-in'))e.target.blur()});
/* ---------- ถุงยังชีพ ---------- */
async function saveBags(id,val,inp){
  const c=A.cases.find(x=>String(x.id)===String(id));if(!c)return;
  const v=String(val).trim()===''?'':Math.max(0,Math.min(9999,Math.round(Number(val)||0)));
  if(String(v)===String(c.bags==null?'':c.bags))return;
  const prev=c.bags;c.bags=v;if(inp)inp.disabled=true;
  try{const r=await post({action:'update',key:A.key,id:apiId(id),status:c.status,volunteer:c.volunteer||'',bags:v,bagsOnly:true});
    if(!r||!r.ok){if(r&&r.error==='not_volunteer'){showLogin('รหัสหมดอายุ กรุณาเข้าสู่ระบบใหม่');return}throw new Error(r&&r.error)}
    if(!r.bagsSupported){c.bags=prev;toast('ยังบันทึกถุงยังชีพไม่ได้ ต้องอัปเดต Code.gs ก่อน');render();return}
    toast(v===''?`เคส #${id} · ล้างจำนวนถุงแล้ว`:`เคส #${id} · ถุงยังชีพ ${v} ถุง`,true);render()}
  catch(e){c.bags=prev;render();toast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')}
  finally{if(inp)inp.disabled=false}}

/* ---------- เปลี่ยนสถานะ ---------- */
async function changeStatus(id,status,sel,team){
  const c=A.cases.find(x=>String(x.id)===String(id));if(!c)return;
  if(status===c.status&&!team)return;
  if(status==='going'&&!team){team=prompt('ชื่อทีมที่รับเคสนี้',c.volunteer||store.get('uh_team'));if(team===null){if(sel)sel.value=c.status;return}team=team.trim();if(!team){toast('ต้องใส่ชื่อทีมก่อนรับเคส');if(sel)sel.value=c.status;return}}
  if(team)store.set('uh_team',team,true);
  const prev={status:c.status,volunteer:c.volunteer};c.status=status;if(status==='open')c.volunteer='';else if(team)c.volunteer=team;render();
  try{const r=await post({action:'update',key:A.key,id:apiId(id),status,volunteer:team||c.volunteer||''});
    if(!r||!r.ok){if(r&&r.error==='not_volunteer'){showLogin('รหัสหมดอายุ กรุณาเข้าสู่ระบบใหม่');return}throw new Error(r&&r.error)}
    toast(`เคส #${id} → ${ST[status]}`,true)}
  catch(e){Object.assign(c,prev);render();toast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')}
}

/* ---------- ส่วนตรวจสอบพื้นที่ในรายละเอียดเคส ---------- */
function agoT(t){return t?ago(t):''}
function vrSection(c){
  const v=vr(c),cc=v.cctv,ll=hasPin(c)?`${(+c.lat).toFixed(5)},${(+c.lng).toFixed(5)}`:'';
  const rd=v.road,reps=v.reports.slice(0,3);
  return `<section class="vr-box vr-b-${v.result.k}">
    <div class="vr-top"><div><small>ผลตรวจพื้นที่ (ช่วยตัดสินใจ)</small><b>${esc(v.result.t)}</b><p>${esc(v.result.d)}</p></div><div class="vr-num"><b>${v.score}</b><small>/100</small></div></div>
    <p class="vr-why vr-lv lv${v.level}"><b>ระบบกำหนดระดับ: ${esc(URG[v.level]||'')}</b> — ${esc(v.levelWhy||'')}</p>
    <p class="vr-why"><b>ข้อมูลจากผู้แจ้ง:</b> ${esc((v.why||[]).join(' · '))}</p>
    <p class="vr-why"><b>ตรวจซ้ำด้วย:</b> ฝน (รายจุด + สถานีวัดฝน) · ดาวเทียม GISTDA · ถนนน้ำท่วม/รายงาน Floodboard · เซ็นเซอร์น้ำ กทม. · กล้อง CCTV</p>
    <div class="vr-chips">${v.chips.map(x=>`<span class="vr-chip k-${x.k}">${esc(x.t)}</span>`).join('')}</div>
    ${aiBlock(c)}
    <details class="vr-more"><summary>รายละเอียด / ตรวจเอง</summary>
    <div class="vr-bars"><div><span>ข้อมูลที่ผู้แจ้งกรอก</span><i style="width:${v.R*2.5}%"></i><em>${v.R}/40</em></div><div><span>ข้อมูลภายนอก (ฝน ดาวเทียม น้ำท่วม กล้อง)</span><i class="${v.E<0?'neg':''}" style="width:${Math.abs(v.E)*100/60}%"></i><em>${v.E>0?'+':''}${Math.round(v.E)}/60</em></div></div>
    <ul class="vr-ev">${v.ev.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
    ${rd?`<p class="vr-src">ถนนใกล้สุด: <b>${esc(rd.name)}</b> · อัปเดต ${esc(agoT(rd.updated))}${rd.sources&&rd.sources.length?' · แหล่ง: '+esc(rd.sources.join(', ')):''}</p>`:''}
    ${reps.length?`<ul class="vr-reps">${reps.map(r=>`<li><b>${Math.round(r.d)} ม.</b> · ${esc(agoT(r.t))}${r.depth!=null?` · ลึก ${r.depth} ซม.`:''} · ${esc(r.source)}${r.text?` — ${esc(r.text.slice(0,90))}${r.text.length>90?'…':''}`:''}${/^https?:\/\//.test(r.url)?` <a href="${esc(r.url)}" target="_blank" rel="noopener">ที่มา</a>`:''}</li>`).join('')}</ul>`:''}
    ${hasPin(c)&&VERIFY.F.cams.length?(()=>{ /* ตรวจจากกล้องได้เลยในหน้านี้: กล้องภาพสดใกล้สุด (8 กม.) + กล้องที่ยังส่งภาพอยู่ 2 ตัวใกล้สุด (ข้ามกล้องที่ไม่อัปเดตเกิน 3 ชม.) */
      const fresh=k=>k.hls||!k.at||Date.now()/1000-k.at<3*3600,near=VERIFY.nearCams(+c.lat,+c.lng,40,8000).filter(fresh);
      const live=near.find(k=>k.hls),still=near.filter(k=>!k.hls).slice(0,live?2:3),cams=[...(live?[live]:[]),...still].sort((a,b)=>a.d-b.d);
      const dist=k=>k.d<1000?Math.round(k.d)+' ม.':(k.d/1000).toFixed(1)+' กม.';
      return cams.length?`<div class="vr-cams"><span>ดูกล้องใกล้จุดได้เลย · ${cams.length} ตัว</span><div class="vr-cam-grid live">${cams.map(k=>`<figure>${typeof CAMLIVE!=='undefined'?CAMLIVE.html(k):''}<figcaption>ห่าง ${dist(k)}</figcaption></figure>`).join('')}</div></div>`:`<p class="vr-src">ไม่มีกล้องที่ยังส่งภาพในรัศมี 8 กม.</p>`})():''}
    <div class="vr-cctv"><span>ตรวจจากกล้อง CCTV:</span> <b>${cc?(cc.s==='flood'?'เห็นน้ำท่วม':'ไม่เห็นน้ำท่วม')+(cc.t?' · '+esc(cc.t):''):'ยังไม่ได้ตรวจ'}</b>
      <div class="vr-cctv-btns"><button class="btn ${cc&&cc.s==='flood'?'primary':'ghost'} sm" data-cctv="flood">กล้องเห็นน้ำท่วม</button><button class="btn ${cc&&cc.s==='clear'?'primary':'ghost'} sm" data-cctv="clear">กล้องไม่เห็นน้ำ</button>${cc?'<button class="btn ghost sm" data-cctv="">ล้างผล</button>':''}</div>
      <div class="vr-links"><a href="https://world.tehx.dyndns.info/flood#tab=roads" target="_blank" rel="noopener">เปิดกล้อง CCTV ถนน (JK World) ↗</a><a href="https://world.tehx.dyndns.info/flood#tab=area" target="_blank" rel="noopener">แถวนี้ท่วมมั้ย ↗</a><a href="https://www.floodboard.org/#map" target="_blank" rel="noopener">แผนที่น้ำท่วม Floodboard ↗</a>${ll?`<button type="button" class="linkish" data-copyll="${ll}">คัดลอกพิกัด ${ll}</button>`:''}</div>
    </div>
    <p class="vr-note">คำนวณจากข้อมูลผู้แจ้ง + Floodboard (1 กม. · 3 วัน) + เซ็นเซอร์น้ำ กทม. (1 กม.) + กล้อง CCTV (ตรวจอัตโนมัติด้วย AI หรือแอดมินบันทึก) · ไม่มีข้อมูลใกล้จุด ≠ ไม่ท่วม</p>
    </details>
  </section>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-copyll]');if(!b)return;(navigator.clipboard?navigator.clipboard.writeText(b.dataset.copyll):Promise.reject()).then(()=>toast('คัดลอกพิกัดแล้ว ใช้ค้นหากล้องใกล้จุดได้',true)).catch(()=>toast('คัดลอกไม่สำเร็จ'))});
async function saveCctv(id,val){
  const c=A.cases.find(x=>String(x.id)===String(id));if(!c)return;
  const prev=c.cctv,now=new Date();c.cctv=val?val+'|'+now.toLocaleDateString('sv-SE')+' '+now.toTimeString().slice(0,5):'';render();
  try{const r=await post({action:'update',key:A.key,id:apiId(id),status:c.status,volunteer:c.volunteer||'',cctv:val,metaOnly:true});
    if(!r||!r.ok){if(r&&r.error==='not_volunteer'){showLogin('รหัสหมดอายุ กรุณาเข้าสู่ระบบใหม่');return}throw new Error(r&&r.error)}
    if(!r.bagsSupported){c.cctv=prev;render();toast('ยังบันทึกผลกล้องไม่ได้ ต้องอัปเดต Code.gs ก่อน');return}
    toast(val?`บันทึกผลกล้องแล้ว · ${vr(c).result.t}`:'ล้างผลกล้องแล้ว',true)}
  catch(e){c.cctv=prev;render();toast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')}}

/* ---------- รายละเอียด ---------- */
// รหัสเคสในระบบที่ถูกรวมเข้ากับเคส Help Me → เปิดเคส Help Me ที่ตรงกันแทน
const findCase=id=>{id=String(id);return A.cases.find(c=>String(c.id)===id||c.local===id||c.hmId===id)};
function openDrawer(id){const m=findCase(id);A.openId=m?String(m.id):String(id);if(m)aiCheck(m);renderDrawer();$('#drawer').hidden=false;$('#drawer-bg').hidden=false;document.body.classList.add('noscroll')}
function closeDrawer(){if(typeof CAMLIVE!=='undefined')CAMLIVE.stop($('#drawer'));A.openId=null;$('#drawer').dataset.case='';$('#drawer').hidden=true;$('#drawer-bg').hidden=true;document.body.classList.remove('noscroll')}
$('#drawer-bg').addEventListener('click',closeDrawer);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&A.openId)closeDrawer()});
/* เล่นภาพสด/รีเฟรชภาพนิ่งของกล้องในลิ้นชักเคส · ปิดลิ้นชักแล้วหยุด */
function camsStart(){if(typeof CAMLIVE==='undefined')return;const d=$('#drawer');if(d)d.querySelectorAll('.cam-pop').forEach(n=>CAMLIVE.start(n))}
// ผลตรวจหมุดเทียบที่อยู่ (หลังบ้านตรวจให้ เฉพาะเคส Help Me ในกรุงเทพฯ ที่ที่อยู่ระบุเขต)
function pinNote(c){const p=c.pinCheck;if(!p)return '';if(p.status==='geocoded')return `<br><small class="muted">📍 หมุดหาจากที่อยู่อัตโนมัติ (${esc(p.label||'ประมาณ')}) · ตรวจตำแหน่งก่อนส่งทีม</small>`;const km=p.from?(VERIFY.dist(+c.lat,+c.lng,p.from.lat,p.from.lng)/1000).toFixed(1):'';
  if(p.status==='fixed')return ` · หมุดปรับจากที่อยู่${p.level?' (ระดับ'+p.level+')':''} · หมุดเดิมใน Help Me อยู่${/^(จังหวัด|อำเภอ|ตำบล|บ้าน)/.test(p.from.district)?'':'เขต'}${p.from.district} ห่าง ${km} กม.`;
  return ` · ⚠️ หมุดอยู่${/^(จังหวัด|อำเภอ|ตำบล|บ้าน)/.test(p.from.district)?'':'เขต'}${p.from.district} แต่ที่อยู่ระบุเขต${p.addrDistrict} · โทรยืนยันตำแหน่ง`}
const pinWarn=c=>c.pinCheck&&c.pinCheck.status!=='fixed'&&c.pinCheck.status!=='geocoded';
// รูปจากผู้แจ้ง (เคส Help Me): รหัสไฟล์ Google Drive ที่ Help Me แชร์แบบ "ทุกคนที่มีลิงก์ดูได้"
// โหลดรูปจาก lh3 ตรง ๆ (ไม่ต้องผ่าน redirect ของ drive.google.com) ถ้าไม่ขึ้นค่อยลองลิงก์ thumbnail ของ Drive
document.addEventListener('error',e=>{const i=e.target;if(i.tagName==='IMG'&&i.dataset.altSrc&&i.src!==i.dataset.altSrc){i.src=i.dataset.altSrc;delete i.dataset.altSrc}},true);
const photosOf=c=>Array.isArray(c.photos)?c.photos.filter(id=>/^[-\w]{25,}$/.test(id)):[];
function renderDrawer(){
  const c=A.cases.find(x=>String(x.id)===A.openId),d=$('#drawer');if(!c){closeDrawer();return}
  // วาดใหม่โดยไม่ทิ้งสิ่งที่ผู้ใช้กำลังทำ: ชื่อทีมที่พิมพ์ค้าง ส่วนที่กางไว้ ตำแหน่งเลื่อน และช่องที่โฟกัสอยู่
  const same=d.dataset.case===String(c.id),keep=same?{team:(d.querySelector('#d-team')||{}).value,note:(d.querySelector('#d-note')||{}).value,open:[...d.querySelectorAll('details')].map(x=>x.open),top:d.scrollTop,cols:[...d.querySelectorAll('.d-col')].map(x=>x.scrollTop),focus:document.activeElement&&d.contains(document.activeElement)?document.activeElement.id:''}:null;
  d.dataset.case=String(c.id);
  const t=tel(c),rows=[['ระดับ (ระบบกำหนด)',URG[sev(c)]],['สถานะ',ST[c.status]||c.status],['ความต้องการ',(c.needs||[]).join(', ')||'-'],['จำนวนคน',(c.people||1)+' คน'],['ถุงยังชีพ',bagsOf(c)==null?`ยังไม่ระบุ (แนะนำ ${bagSuggest(c)} ถุง)`:bagsOf(c)+' ถุง'],['ครัวเรือน / ครอบครัว',hh(c)?hh(c)+' ครัวเรือน':'ไม่ระบุ'],['ระดับน้ำ',LEVEL[c.level]||'ไม่ระบุ'],
    ['ที่อยู่ / จุดสังเกต',addr(c)||'-'],['พิกัด',hasPin(c)?`${(+c.lat).toFixed(6)}, ${(+c.lng).toFixed(6)}`+pinNote(c):'ไม่ได้ปักหมุด'],['ผู้ติดต่อ',c.name||'-'],['เบอร์โทร',String(c.phone||'-').replace(/^'/,'')],
    ['ต้องดูแลเป็นพิเศษ',vul(c).join(', ')||'-'],['ทีมที่รับเคส',c.volunteer||'-'],['แจ้งเมื่อ',fullTime(c.createdAt)],['อัปเดตล่าสุด',fullTime(c.updatedAt)]];
  d.innerHTML=`<div class="d-head"><div><span class="urg urg-${sev(c)}">${URG[sev(c)]}</span> <span class="st st-${esc(c.status)}">${esc(ST[c.status]||'')}</span><h2>${esc((c.needs||[]).join(' · ')||'ขอความช่วยเหลือ')}</h2><small>#${esc(c.hmId||c.id)}${c.hm?' · <span class="hm-tag">Help Me</span>':''}</small></div><button class="x" id="d-close" aria-label="ปิด"><i data-ic="close"></i></button></div>
    <div class="d-grid"><div class="d-col d-col-a">
    ${notesOf(c)?`<div class="d-notes"><b>สถานการณ์</b><p>${esc(notesOf(c))}</p></div>`:''}
    ${photosOf(c).length?`<div class="d-photos"><b>รูปจากผู้แจ้ง · ${photosOf(c).length} รูป</b><div>${photosOf(c).map((id,i)=>`<a href="https://drive.google.com/file/d/${encodeURIComponent(id)}/view" target="_blank" rel="noopener"><img src="https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w600" data-alt-src="https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w600" alt="รูปที่ ${i+1} จากผู้แจ้ง" loading="lazy" referrerpolicy="no-referrer"></a>`).join('')}</div></div>`:''}
    ${covSection(c)}${vrSection(c)}
    </div><div class="d-col d-col-b">
    <dl class="d-rows">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <div class="d-act">
      ${t.length>=9?`<a class="btn primary" href="tel:${esc(t)}">โทรหาผู้แจ้ง</a>`:''}
      ${hasPin(c)?`<a class="btn ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}">นำทาง Google Maps</a>`:''}
      <button class="btn ghost" id="d-copy">คัดลอกข้อมูลเคส</button>
    </div>
    ${c.hm?`<p class="small muted hm-sync">เคสจาก Help Me · ซิงก์เข้าฐานข้อมูลเราทุก 1 นาที${c.org?' · หน่วยงานที่รับ: '+esc(c.org):''} · สถานะ/ทีมที่แก้ที่นี่บันทึกในระบบเรา (ถ้า Help Me เปลี่ยนทีหลัง จะใช้ของ Help Me) · <a target="_blank" rel="noopener" href="${HM_URL(c.hmId)}">เปิดใน Help Me ↗</a></p>`:''}${`${assignBox(c)}`}
    </div></div>`;
  $('#d-close').onclick=closeDrawer;
  d.querySelectorAll('[data-cctv]').forEach(b=>{b.onclick=()=>saveCctv(c.id,b.dataset.cctv)});
  $('#d-copy').onclick=()=>{const txt=[`เคส #${c.hmId||c.id} · ${URG[sev(c)]} · ${ST[c.status]}`,`ต้องการ: ${(c.needs||[]).join(', ')}`,`${c.people||1} คน${hh(c)?' · '+hh(c)+' ครัวเรือน':''}${c.level?' · น้ำ'+(LEVEL[c.level]||''):''}`,`ที่อยู่: ${addr(c)||'-'}`,hasPin(c)?`แผนที่: https://maps.google.com/?q=${c.lat},${c.lng}`:'',vul(c).length?`ดูแลพิเศษ: ${vul(c).join(', ')}`:'',`ติดต่อ: ${[c.name,String(c.phone||'').replace(/^'/,'')].filter(Boolean).join(' ')}`,notesOf(c)?`สถานการณ์: ${notesOf(c)}`:''].filter(Boolean).join('\n');
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('คัดลอกแล้ว',true)).catch(()=>toast('คัดลอกไม่สำเร็จ'))};
  if(keep){const t=d.querySelector('#d-team');if(t&&keep.team&&[...t.options].some(o=>o.value===keep.team))t.value=keep.team;const nt=d.querySelector('#d-note');if(nt&&keep.note!=null)nt.value=keep.note;d.querySelectorAll('details').forEach((x,i)=>{if(keep.open[i])x.open=true});d.scrollTop=keep.top;d.querySelectorAll('.d-col').forEach((x,i)=>{x.scrollTop=keep.cols[i]||0});if(keep.focus){const f=document.getElementById(keep.focus);if(f)f.focus({preventScroll:true})}}
  d.querySelectorAll('[data-dact]').forEach(b=>b.onclick=()=>assignAct(c,b.dataset.dact,b));
  if(!A.roster)loadRoster();
}
/* ---------- มอบหมายทีม · ปิดเคส · หมายเหตุ ----------
   ศูนย์เลือกทีม → มอบหมาย (เคสขึ้นที่หน้าทีมทันที) → ทีมกด "ช่วยเหลือแล้ว" → ศูนย์กด "ปิดเคส" */
const RST={ready:'ว่าง',out:'ออกปฏิบัติ',rest:'พัก'};
async function loadRoster(){if(A.rosterLoading)return;A.rosterLoading=true;
  try{const r=await api({action:'roster',key:A.key});if(r&&r.ok){A.roster=(r.roster||[]).filter(t=>t.active!==0);if(!$('#drawer').hidden)renderDrawer()}}catch(e){}finally{A.rosterLoading=false}}
function teamOpts(c){const cur=String(c.volunteer||'').replace(/^'/,'').trim(),load={};A.cases.forEach(x=>{if(x.status==='going'&&x.volunteer){const v=String(x.volunteer).replace(/^'/,'').trim();load[v]=(load[v]||0)+1}});
  const names=(A.roster||[]).map(t=>({n:t.name,st:t.status}));if(cur&&!names.some(t=>t.n===cur))names.unshift({n:cur,st:''});
  return `<option value="">${A.roster?'— เลือกทีม —':'กำลังโหลดรายชื่อทีม…'}</option>`+names.map(t=>`<option value="${esc(t.n)}" ${t.n===cur?'selected':''}>${esc(t.n)}${t.st?' · '+(RST[t.st]||t.st):''}${load[t.n]?' · มีงาน '+load[t.n]+' เคส':''}</option>`).join('')}
function assignBox(c){const going=c.status==='going',done=c.status==='done',rep=going&&c.teamDoneAt;
  return `<fieldset class="d-status"><legend>มอบหมายทีม</legend>
    <p class="d-now">สถานะ: <b class="st-txt st-${esc(c.status)}">${esc(ST[c.status]||c.status)}</b>${c.volunteer&&!(c.status==='open')?' · '+esc(String(c.volunteer).replace(/^'/,'')):''}</p>
    ${rep?`<div class="d-teamdone"><b>ทีมแจ้งว่าช่วยเหลือแล้ว · ${esc(ago(c.teamDoneAt))}</b>${c.teamNote?`<span>${esc(c.teamNote)}</span>`:''}</div>`:''}
    <label class="d-lbl">ทีม<select id="d-team" ${done?'disabled':''}>${teamOpts(c)}</select></label>
    <label class="d-lbl">หมายเหตุ<textarea id="d-note" rows="2" maxlength="500" placeholder="เช่น นำเรือไปด้วย · ผู้ป่วยติดเตียง 1 คน (ทีมเห็นข้อความนี้)">${esc(c.hqNote||'')}</textarea></label>
    <div class="d-st-btns">
      ${done?`<button class="btn ghost" data-dact="note">บันทึกหมายเหตุ</button><button class="btn ghost" data-dact="open">เปิดเคสใหม่</button>`
      :`<button class="btn ${going?'ghost':'primary'}" data-dact="assign">${going?'เปลี่ยนทีม':'มอบหมาย'}</button>
        <button class="btn ${rep?'primary':'ghost'} d-close" data-dact="close" ${going?'':'disabled title="มอบหมายทีมก่อน"'}>ปิดเคส</button>
        ${going?'<button class="btn ghost" data-dact="open">คืนเป็นรอ</button>':'<button class="btn ghost" data-dact="note">บันทึกหมายเหตุ</button>'}`}
    </div></fieldset>`}
async function assignAct(c,act,btn){
  const team=($('#d-team')||{}).value||'',note=(($('#d-note')||{}).value||'').trim(),cur=String(c.volunteer||'').replace(/^'/,'').trim();
  let status=c.status,vol=cur,msg='';
  if(act==='assign'){if(!team){toast('เลือกทีมก่อน');$('#d-team').focus();return}if(c.status==='going'&&team===cur&&note===(c.hqNote||'')){toast('ทีมนี้รับเคสอยู่แล้ว');return}status='going';vol=team;msg=`มอบเคส #${c.hmId||c.id} ให้ ${team} แล้ว · ขึ้นที่หน้าทีมแล้ว`}
  else if(act==='close'){if(!c.teamDoneAt&&!confirm(`ทีมยังไม่ได้แจ้งว่าช่วยเหลือแล้ว\nปิดเคส #${c.hmId||c.id} เลยหรือไม่?`))return;status='done';msg=`ปิดเคส #${c.hmId||c.id} แล้ว`}
  else if(act==='open'){if(!confirm('คืนเคสเป็น "รอความช่วยเหลือ" และเอาออกจากทีม?'))return;status='open';vol='';msg='คืนเป็นรอความช่วยเหลือแล้ว'}
  else msg='บันทึกหมายเหตุแล้ว';
  const prev={status:c.status,volunteer:c.volunteer,hqNote:c.hqNote,teamDoneAt:c.teamDoneAt,teamNote:c.teamNote};
  btn.disabled=true;
  try{const body={action:'update',key:A.key,id:apiId(c.id),status,volunteer:vol,hqNote:note};if(act==='note')body.metaOnly=true;
    const r=await post(body);
    if(!r||!r.ok){if(r&&r.error==='not_volunteer'){showLogin('รหัสหมดอายุ กรุณาเข้าสู่ระบบใหม่');return}throw new Error(r&&r.error)}
    if(status==='open'||(status==='going'&&vol!==cur)){c.teamDoneAt=null;c.teamNote=''}
    Object.assign(c,{status,volunteer:vol,hqNote:note});if(status==='going'&&vol)store.set('uh_team',vol,true);
    toast(msg,true);render();renderDrawer()}
  catch(e){Object.assign(c,prev);toast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')}
  finally{btn.disabled=false}}

/* ---------- มุมมอง รายการ / แผนที่ ---------- */
function applyMode(){document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.mode===A.mode)));
  $('#list').hidden=A.mode==='map';$('#map-wrap').hidden=A.mode==='list';$('#map-wrap').classList.toggle('compact',A.mode==='both');if(A.map)setTimeout(()=>A.map.invalidateSize(),60)}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{A.mode=b.dataset.mode;store.set('uh_view',A.mode,true);applyMode();render()}));
applyMode();
let leafletP=null;
function loadLeaflet(){if(window.L)return Promise.resolve();if(leafletP)return leafletP;leafletP=new Promise((res,rej)=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='';document.head.append(css);
  const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';s.crossOrigin='';s.onload=res;s.onerror=()=>{leafletP=null;rej()};document.head.append(s)});return leafletP}
async function drawMap(list){
  try{await loadLeaflet()}catch(e){$('#map').innerHTML='<p class="empty">โหลดแผนที่ไม่สำเร็จ</p>';return}
  if(!A.map){A.map=L.map('map',{preferCanvas:true}).setView([13.7563,100.5018],11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap · น้ำท่วม: Floodboard (CC-BY), สำนักการระบายน้ำ กทม., ThaiWater · กล้อง: iTIC'}).addTo(A.map);A.flood=L.layerGroup().addTo(A.map);A.layer=L.layerGroup().addTo(A.map);A.fitted=false;
    if(typeof MX!=='undefined')MX.attach(A.map)}
  if(A.floodDrawn!==VERIFY.F.loaded){A.floodDrawn=VERIFY.F.loaded;A.flood.clearLayers();VERIFY.F.roads.forEach(r=>{const d=r.depth||0,v=r.verdict,col=v==='blocked'||r.closed||d>=50?'#d32f2f':v==='risky'||d>=30?'#f57c00':v==='caution'||d>=10?'#fbc02d':'';if(!col)return; // แบบ Floodboard: แสดงเฉพาะถนนที่มีน้ำขัง/เสี่ยง/ผ่านไม่ได้
      r.lines.forEach(l=>L.polyline(l.map(p=>[p[1],p[0]]),{color:col,weight:5,opacity:.85,lineCap:'round'}).bindTooltip(`${r.name}${r.depth!=null?' · ~'+r.depth+' ซม.':''}`).addTo(A.flood))})}
  setTimeout(()=>A.map.invalidateSize(),50);A.layer.clearLayers();const pts=[];
  // หมุดหยดน้ำแบบหน้าเว็บหลัก: วิกฤต (แดงกะพริบ) · เร่งด่วน (ส้ม) · รอช่วย · กำลังไป · ช่วยแล้ว
  const PZ={danger:1000,urgent:700,open:400,going:200,done:0};
  list.filter(hasPin).forEach(c=>{const k=c.status==='done'?'done':c.status==='going'?'going':sev(c)===3?'danger':sev(c)===2?'urgent':'open';pts.push([+c.lat,+c.lng]);
    const ph=photosOf(c);
    L.marker([+c.lat,+c.lng],{icon:umPin(k,{extra:ph.length?`<span class="pin-thumb"><img src="https://lh3.googleusercontent.com/d/${encodeURIComponent(ph[0])}=w200" data-alt-src="https://drive.google.com/thumbnail?id=${encodeURIComponent(ph[0])}&sz=w200" alt="" loading="lazy" referrerpolicy="no-referrer">${ph.length>1?`<b aria-label="มีรูป ${ph.length} รูป">${ph.length}</b>`:''}</span>`:''}),zIndexOffset:PZ[k]+(ph.length?50:0),keyboard:false}).bindTooltip(esc(`${URG[sev(c)]} · ${vr(c).result.t} · ${(c.needs||[]).join(', ')} · ${c.people||1} คน`)+(ph.length?`<span class="tip-photos">${ph.slice(0,3).map((id,i)=>`<img src="https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w240" data-alt-src="https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w240" alt="รูปที่ ${i+1} จากผู้แจ้ง" referrerpolicy="no-referrer">`).join('')}${ph.length>3?`<em>+${ph.length-3}</em>`:''}</span>`:''),{direction:'top',offset:[0,-4]}).on('click',()=>openDrawer(c.id)).addTo(A.layer)});
  if(pts.length&&!A.fitted){A.map.fitBounds(pts,{padding:[40,40],maxZoom:14});A.fitted=true}
  const miss=list.length-pts.length;$('#count').textContent+=miss?` · ${miss} เคสไม่มีหมุด (ดูในรายการ)`:'';
  if(typeof MX!=='undefined')MX.refresh(list);
}

/* ---------- ส่งออก CSV ---------- */
$('#export').addEventListener('click',()=>{const list=filtered();
  const head=['เลขเคส','แจ้งเมื่อ','ระดับ','สถานะ','ความต้องการ','จำนวนคน','ครัวเรือน','ถุงยังชีพ','ระดับน้ำ','ที่อยู่','เขต','lat','lng','ชื่อ','เบอร์โทร','ทีม','ต้องดูแลเป็นพิเศษ','ผลตรวจพื้นที่','คะแนนวิกฤต','องค์กรอื่นเคยมอบใกล้เคียง','สถานการณ์'];
  const rows=list.map(c=>[c.id,fullTime(c.createdAt),URG[sev(c)],ST[c.status],(c.needs||[]).join(', '),c.people||1,hh(c)||'',bagsOf(c)==null?'':bagsOf(c),LEVEL[c.level]||'',c.address,c.district,c.lat,c.lng,c.name,String(c.phone||'').replace(/^'/,''),c.volunteer,vul(c).join(', '),vr(c).result.t,vr(c).score,(cov(c)?cov(c).best.r.org+' · '+cov(c).best.r.area:''),notesOf(c)]);
  const cell=v=>{let s=String(v==null?'':v);if(/^[=+\-@]/.test(s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
  const csv='﻿'+[head,...rows].map(r=>r.map(cell).join(',')).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=`umplus-cases-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast(`ส่งออก ${list.length} เคสแล้ว · ไฟล์มีข้อมูลส่วนตัว เก็บให้ปลอดภัย`,true)});

/* ---------- เริ่ม ---------- */
if(A.key){showApp();load().then(()=>{if(A.key){startPolling();loadFlood()}})}else showLogin();

/* ลิ้นชักเคสวาดใหม่ทุกครั้งที่ข้อมูลอัปเดต: หยุดสตรีมเดิมแล้วเริ่มกล้องในลิ้นชักใหม่ */
{const _rd=renderDrawer;renderDrawer=function(){if(typeof CAMLIVE!=='undefined')CAMLIVE.stop($('#drawer'));_rd();camsStart()}}

window.addEventListener('hermes:done',()=>{if(typeof load==='function')load()});
