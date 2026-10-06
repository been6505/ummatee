/* แดชบอร์ด Helpme+: ภาพรวมเคสและสต็อกจากฐานข้อมูล D1 (ใช้รหัสทีมเดียวกับหน้าจัดการเคส · ไม่เก็บข้อมูลเคสไว้ในเครื่อง) */
const API_URL='/api';
const $=s=>document.querySelector(s);
const ST={open:'รอความช่วยเหลือ',going:'ทีมกำลังไป',done:'ช่วยเหลือแล้ว'};
const URG={3:'วิกฤต',2:'เร่งด่วน',1:'ทั่วไป'};
const URG_COL={3:'var(--crit)',2:'var(--serious)',1:'var(--warn)'};
const ST_COL={open:'var(--crit)',going:'var(--going)',done:'var(--good)'};
const LEVEL=[['ankle','ข้อเท้า'],['knee','เข่า'],['waist','เอว'],['chest','อก'],['roof','มิดหัว / หลังคา']];
const VUL={elderly:'ผู้สูงอายุ',child:'เด็กเล็ก',infant:'ทารก',pregnant:'หญิงตั้งครรภ์',disabled:'ผู้พิการ',bedridden:'ผู้ป่วยติดเตียง',oxygen:'ใช้ออกซิเจน / เครื่องช่วยหายใจ',dialysis:'ผู้ป่วยฟอกไต',chronic:'ผู้ป่วยโรคเรื้อรัง'};
const store={get(k){try{return localStorage.getItem(k)||sessionStorage.getItem(k)||''}catch(e){return ''}},
  set(k,v,rem){try{if(!v){localStorage.removeItem(k);sessionStorage.removeItem(k);return}(rem?localStorage:sessionStorage).setItem(k,v)}catch(e){}}};
const D={key:store.get('uh_vol_key'),cases:[],loaded:0,range:'all',loading:false,rev:null};
const nf=n=>Number(n||0).toLocaleString('th-TH');
const sev=c=>Math.min(3,Math.max(1,Number(c.urgency)||1));
const hh=c=>{const n=Number(c.households);if(n>0)return n;const m=String(c.notes||'').match(/\[ครัวเรือน (\d+)\]/);return m?+m[1]:0};
const vul=c=>(Array.isArray(c.vulnerable)?c.vulnerable:String(c.vulnerable||'').split(/\s*,\s*/)).filter(Boolean);
const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e};
const svgEl=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const k in attrs)e.setAttribute(k,attrs[k]);return e};

async function api(params){const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),45000);
  try{const r=await fetch(API_URL+'?'+new URLSearchParams({...params,t:Date.now()}),{signal:ctl.signal,cache:'no-store'});return await r.json()}finally{clearTimeout(tm)}}

/* ---------- login ---------- */
function showLogin(msg){$('#app').hidden=true;$('#login').hidden=false;$('#login-err').textContent=msg||'';setTimeout(()=>$('#login-key').focus(),50)}
function showApp(){$('#login').hidden=true;$('#app').hidden=false}
$('#login-form').addEventListener('submit',async e=>{e.preventDefault();const k=$('#login-key').value.trim();if(!k)return;$('#login-go').disabled=true;$('#login-err').textContent='กำลังตรวจรหัส…';
  try{const r=await api({action:'list',key:k});if(r&&r.ok&&r.volunteer){D.key=k;const rem=$('#login-remember').checked;store.set('uh_vol_key',k,rem);store.set('uh_vol_ok','1',rem);$('#login-key').value='';setCases(r);showApp();load();poll();VERIFY.load().then(render,render);if(typeof COVERED!=='undefined')COVERED.load(API_URL,D.key).then(render,render)}else $('#login-err').textContent='รหัสไม่ถูกต้อง'}
  catch(err){$('#login-err').textContent='เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'}finally{$('#login-go').disabled=false}});
$('#logout').addEventListener('click',()=>{store.set('uh_vol_key','');store.set('uh_vol_ok','');D.key='';D.cases=[];showLogin('ออกจากระบบแล้ว')});

/* ---------- data ---------- */
function setCases(r){D.cases=(r.cases||[]).map(c=>({...c,needs:Array.isArray(c.needs)?c.needs:String(c.needs||'').split(/\s*,\s*/).filter(Boolean),createdAt:Number(c.createdAt)||0,updatedAt:Number(c.updatedAt)||0}));D.loaded=Date.now()}
function status(msg,retry){const el=$('#status');el.hidden=!msg;el.textContent=msg||'';if(retry){const b=document.createElement('button');b.className='linkish';b.textContent=' ลองใหม่';b.onclick=load;el.append(b)}}
async function load(){if(D.loading||!D.key)return;D.loading=true;$('#main').classList.add('loading');$('#sync').textContent='กำลังโหลด…';if(!D.loaded)status('กำลังโหลดข้อมูลเคส… (อาจใช้เวลาสักครู่)');
  try{const [r,sk,ld,tl]=await Promise.all([api({action:'list',key:D.key}),api({action:'stock',key:D.key}).catch(()=>null),api({action:'leads',key:D.key,days:30}).catch(()=>null),api({action:'teams',key:D.key}).catch(()=>null)]);if(!r||!r.ok)throw 0;
    D.stock=sk&&sk.ok?sk:null;D.leads=ld&&ld.ok?ld.leads:null;D.live=tl&&tl.ok?tl.teams||[]:[];
    if(!r.volunteer){store.set('uh_vol_key','');store.set('uh_vol_ok','');D.key='';showLogin('รหัสหมดอายุหรือถูกเปลี่ยน กรุณาเข้าสู่ระบบใหม่');return}
    setCases(r);status('');render()}catch(e){$('#sync').textContent='โหลดไม่สำเร็จ';status('โหลดข้อมูลไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต',true)}finally{D.loading=false;$('#main').classList.remove('loading')}}
let pollT;function poll(){clearInterval(pollT);pollT=setInterval(async()=>{if(document.hidden||!D.key)return;try{const r=await api({action:'rev'});if(r&&r.ok&&r.rev!=null){if(D.rev!==null&&r.rev!==D.rev){D.rev=r.rev;load()}else D.rev=r.rev}}catch(e){}if(Date.now()-D.loaded>120000)load()},20000)}
$('#refresh').addEventListener('click',load);

/* ---------- range ---------- */
function startOfDay(t){const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()}
function rangeStart(){const now=Date.now();if(D.range==='today')return startOfDay(now);if(D.range==='7')return startOfDay(now-6*864e5);if(D.range==='30')return startOfDay(now-29*864e5);return 0}
document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{D.range=b.dataset.range;document.querySelectorAll('[data-range]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render()}));

/* ---------- tooltip ---------- */
const tip=$('#tip');
function showTip(e,val,lab){tip.replaceChildren(el('b',null,val),el('span',null,lab));tip.hidden=false;const r=(e.currentTarget||e.target).getBoundingClientRect(),x=e.clientX||r.left+r.width/2,y=e.clientY||r.top;
  const w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.min(innerWidth-w-8,Math.max(8,x-w/2))+'px';tip.style.top=Math.max(8,y-h-12)+'px'}
function hideTip(){tip.hidden=true}
function hover(node,val,lab){node.tabIndex=0;node.addEventListener('pointermove',e=>showTip(e,val,lab));node.addEventListener('pointerleave',hideTip);node.addEventListener('focus',e=>showTip(e,val,lab));node.addEventListener('blur',hideTip)}

/* ---------- table view ---------- */
function table(id,head,rows){const t=el('table','dt'),tr=el('tr');head.forEach((h,i)=>{const th=el('th',i?'n':'',h);tr.append(th)});const th=el('thead');th.append(tr);const tb=el('tbody');
  rows.forEach(r=>{const x=el('tr');r.forEach((v,i)=>x.append(el('td',i?'n':'',typeof v==='number'?nf(v):v)));tb.append(x)});t.append(th,tb);$(id).replaceChildren(t)}

/* ---------- horizontal bars (HTML, one hue; label carries identity) ---------- */
function hbars(id,rows,opt={}){const box=$(id);if(!rows.length||!rows.some(r=>r[1])){box.replaceChildren(el('p','empty','ยังไม่มีข้อมูลในช่วงนี้'));return}
  const max=opt.max||Math.max(...rows.map(r=>r[1]),1),total=opt.total||0,wrap=el('div','hb');
  rows.forEach(([lab,v,col,txt])=>{const row=el('div','hb-row'),l=el('div','hb-lab');if(col){const i=el('i');i.style.background=col;l.append(i)}l.append(el('span',null,lab));
    const tr=el('div','hb-track'),bar=el('div','hb-bar');bar.style.width=`calc((100% - ${v?(opt.reserve||48):0}px) * ${(v/max).toFixed(4)})`;if(col)bar.style.background=col;
    const pct=total?` · ${Math.round(v/total*100)}%`:'',shown=txt||nf(v)+pct;tr.append(bar,el('span','hb-val',shown));row.append(l,tr);hover(row,txt||nf(v)+' '+(opt.unit||'เคส')+pct,lab);wrap.append(row)});
  box.replaceChildren(wrap)}

/* ---------- column chart (SVG) ---------- */
function columns(id,buckets){const box=$(id);const W=Math.max(320,box.clientWidth||600),H=220,pl=34,pr=8,pt=18,pb=26;
  const max=Math.max(...buckets.map(b=>b.v),0);if(!max){box.replaceChildren(el('p','empty','ยังไม่มีเคสในช่วงนี้'));return}
  const step=max<=5?1:max<=10?2:Math.ceil(max/4/5)*5,top=Math.ceil(max/step)*step;
  const s=svgEl('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'กราฟเคสใหม่'}),iw=W-pl-pr,ih=H-pt-pb,y=v=>pt+ih-(v/top)*ih;
  for(let v=0;v<=top;v+=step){s.append(svgEl('line',{x1:pl,x2:W-pr,y1:y(v),y2:y(v),stroke:v?'var(--grid)':'var(--axis)','stroke-width':1}));const t=svgEl('text',{x:pl-6,y:y(v)+4,'text-anchor':'end','font-size':11,fill:'var(--muted)'});t.textContent=nf(v);s.append(t)}
  const n=buckets.length,band=iw/n,bw=Math.min(24,Math.max(3,band-2));
  const every=Math.ceil(n/(W<500?6:12));let peak=buckets.reduce((a,b)=>b.v>a.v?b:a,buckets[0]);
  buckets.forEach((b,i)=>{const x=pl+band*i+(band-bw)/2,h=(b.v/top)*ih;
    if(b.v){const r=Math.min(4,bw/2,h),y0=pt+ih,p=`M${x},${y0}V${y0-h+r}Q${x},${y0-h} ${x+r},${y0-h}H${x+bw-r}Q${x+bw},${y0-h} ${x+bw},${y0-h+r}V${y0}Z`;s.append(svgEl('path',{d:p,fill:'var(--s1)'}))}
    const hit=svgEl('rect',{x:pl+band*i,y:pt,width:band,height:ih,fill:'transparent'});hover(hit,nf(b.v)+' เคส',b.full);s.append(hit);
    if(i%every===0||i===n-1){const t=svgEl('text',{x:pl+band*i+band/2,y:H-8,'text-anchor':'middle','font-size':11,fill:'var(--muted)'});t.textContent=b.lab;s.append(t)}
    if(b===peak&&b.v){const t=svgEl('text',{x:pl+band*i+band/2,y:y(b.v)-5,'text-anchor':'middle','font-size':11.5,'font-weight':600,fill:'var(--ink-2)'});t.textContent=nf(b.v);s.append(t)}});
  box.replaceChildren(s)}

/* ---------- แผนที่ ---------- */
let leafletP=null;const M={map:null,cases:null,flood:null,fitted:false,floodAt:-1};
function loadLeaflet(){if(window.L)return Promise.resolve();if(leafletP)return leafletP;leafletP=new Promise((res,rej)=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='';document.head.append(css);
  const sc=document.createElement('script');sc.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';sc.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';sc.crossOrigin='';sc.onload=res;sc.onerror=()=>{leafletP=null;rej()};document.head.append(sc)});return leafletP}
const caseColor=c=>c.status==='done'?'#0ca30c':c.status==='going'?'#2a78d6':sev(c)===3?'#d03b3b':sev(c)===2?'#ec835a':'#fab219';
const escT=s=>String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
async function drawMap(L0){
  try{await loadLeaflet()}catch(e){$('#dmap').textContent='โหลดแผนที่ไม่สำเร็จ';return}
  if(!M.map){M.map=L.map($('#dmap'),{preferCanvas:true,scrollWheelZoom:false}).setView([13.7563,100.5018],11);
    M.map.zoomControl.setPosition('bottomright');M.map.attributionControl.setPrefix(false);M.map.attributionControl.addAttribution('น้ำท่วม: Floodboard.org');
    L.control.scale({metric:true,imperial:false,position:'bottomleft'}).addTo(M.map);let b='road';try{b=localStorage.getItem('uh_base')||'road'}catch(e){}setBase(DBASES[b]?b:'road');
    M.flood=L.layerGroup().addTo(M.map);M.cases=L.layerGroup().addTo(M.map);M.map.on('focus',()=>M.map.scrollWheelZoom.enable());if(typeof MAPL!=='undefined')MAPL.attach(M.map)}
  const showDone=$('#mt-done').checked,list=L0.filter(c=>(showDone||c.status!=='done'));
  M.cases.clearLayers();const pts=[];let nopin=0;
  list.slice().sort((a,b)=>sev(a)-sev(b)).forEach(c=>{if(c.lat===''||c.lat==null||c.lng===''||isNaN(+c.lat)){nopin++;return}const ll=[+c.lat,+c.lng];pts.push(ll);
    const k=c.status==='done'?'done':c.status==='going'?'going':sev(c)===3?'danger':sev(c)===2?'urgent':'open';
    L.marker(ll,{icon:L.divIcon({className:'um-pin '+k,html:'<span></span>',iconSize:[32,34],iconAnchor:[16,33],popupAnchor:[0,-30]}),zIndexOffset:{danger:1000,urgent:700,open:400,going:200,done:0}[k],keyboard:false})
      .bindPopup(`<b>${escT(URG[sev(c)])} · ${escT(ST[c.status]||'')}</b><br>${escT(c.needs.join(', ')||'ขอความช่วยเหลือ')} · ${escT(c.people||1)} คน${hh(c)?' · '+hh(c)+' ครัวเรือน':''}<br>${escT([c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · '))}${c.volunteer?'<br>ทีม: '+escT(c.volunteer):''}<br><a href="../../admin.html">เปิดหน้าจัดการเคส →</a>`).addTo(M.cases)});
  $('#map-nopin').textContent=nopin?`· ${nopin} เคสไม่มีหมุด (ไม่แสดงบนแผนที่)`:'';
  if(pts.length&&!M.fitted){M.map.fitBounds(pts,{padding:[30,30],maxZoom:14});M.fitted=true}
  const F=typeof VERIFY!=='undefined'?VERIFY.F:null;
  if(F&&M.floodAt!==F.loaded){M.floodAt=F.loaded;M.flood.clearLayers();F.roads.forEach(r=>{const d=r.depth||0,v=r.verdict,col=v==='blocked'||r.closed||d>=50?'#d32f2f':v==='risky'||d>=30?'#f57c00':v==='caution'||d>=10?'#fbc02d':'';if(!col)return; // แบบ Floodboard: เฉพาะถนนที่มีน้ำ
    r.lines.forEach(l=>L.polyline(l.map(p=>[p[1],p[0]]),{color:col,weight:5,opacity:.85,lineCap:'round'}).bindTooltip(`${escT(r.name)}${r.depth!=null?' · ~'+r.depth+' ซม.':''}`).addTo(M.flood))})}
  if($('#mt-flood').checked)M.flood.addTo(M.map);else M.flood.remove();
  // พื้นที่ที่องค์กรอื่นรับแล้ว + จุดลงพื้นที่ของเครือข่าย (Help Me) วาดใน maplayers.js เป็นป้ายสีตามองค์กร
  if(typeof COVERED!=='undefined'&&typeof MAPL!=='undefined'&&M.covAt!==COVERED.C.loaded){M.covAt=COVERED.C.loaded;MAPL.refreshNet()}
  /* เคสจากโซเชียลที่รอคัด (หน้า เคสจากโซเชียล) + ทีมที่แชร์ตำแหน่งอยู่ */
  if(!M.leads){M.leads=L.layerGroup();M.live=L.layerGroup()}
  M.leads.clearLayers();M.live.clearLayers();
  (D.leads||[]).filter(l=>l.status==='new'&&l.lat!=null&&l.lng!=null).forEach(l=>{const u=Math.min(3,Math.max(1,+l.urgency||1));
    L.marker([+l.lat,+l.lng],{icon:L.divIcon({className:'lead-pin u'+u,html:'<span></span>',iconSize:[20,20],iconAnchor:[10,10],popupAnchor:[0,-12]}),zIndexOffset:300+u*100,keyboard:false})
      .bindPopup(`<b>📣 ${escT(URG[u])} · รอคัด</b><br>${escT(l.title||'')}<br>${escT([l.address,l.district?'เขต'+l.district:''].filter(Boolean).join(' · '))}${(l.flags||[]).some(f=>/^(asks_money|account_reused|past_year_text)/.test(f))?'<br>⚠️ ติดธง ตรวจก่อนรับ':''}${(l.flags||[]).includes('approx_location')?'<br>📍 ตำแหน่งโดยประมาณ':''}<br><a href="../../admin.html#leads">คัดเคสนี้ที่หน้าเคสจากโซเชียล →</a>`).addTo(M.leads)});
  (D.live||[]).forEach(t=>L.marker([+t.lat,+t.lng],{icon:L.divIcon({className:'live-tm',html:`<span>🟢 ${escT(t.team)}</span>`,iconSize:null}),zIndexOffset:1500,keyboard:false})
    .bindPopup(`<b>🟢 ${escT(t.team)}</b><br>แชร์ตำแหน่ง ${escT(ago(t.updatedAt))}${t.caseId?'<br>ถือเคส #'+escT(t.caseId):''}`).addTo(M.live));
  if($('#mt-leads').checked)M.leads.addTo(M.map);else M.leads.remove();
  if($('#mt-live').checked)M.live.addTo(M.map);else M.live.remove();
  const dl=$('#dleg');if(dl){dl.querySelector('.lg-leads').hidden=!$('#mt-leads').checked||!D.leads;dl.querySelector('.lg-live').hidden=!$('#mt-live').checked;dl.querySelector('.lg-done').hidden=!showDone;dl.querySelector('.lg-flood').hidden=!$('#mt-flood').checked;dl.querySelector('.lg-cov').hidden=typeof COVERED==='undefined'||!$('#mt-cov').checked}
  setTimeout(()=>M.map.invalidateSize(),60);
}
/* แบบแผนที่ (เหมือนหน้าเว็บหลักและหน้าจัดการเคส): ถนน / ดาวเทียม / มืด */
const DESRI='https://server.arcgisonline.com/ArcGIS/rest/services/',DBASES={road:1,sat:1,dark:1};
function setBase(name){const m=M.map,t=(u,a,o={})=>L.tileLayer(u,{maxZoom:19,attribution:a,crossOrigin:true,...o});if(M.base)m.removeLayer(M.base);
  if(name==='sat')M.base=L.layerGroup([t(DESRI+'World_Imagery/MapServer/tile/{z}/{y}/{x}','แผนที่ © Esri'),t(DESRI+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',''),t(DESRI+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}','')]);
  else if(name==='dark')M.base=L.layerGroup([t(DESRI+'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}','แผนที่ © Esri',{maxZoom:16,maxNativeZoom:16}),t(DESRI+'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}','',{maxZoom:16,maxNativeZoom:16})]);
  else M.base=t('https://tile.openstreetmap.org/{z}/{x}/{y}.png','© OpenStreetMap');
  M.base.addTo(m);{const tok=M.baseTok=(M.baseTok||0)+1;if((name==='road'||name==='dark')&&typeof OFM!=='undefined')OFM.layer(name).then(l=>{if(!l||tok!==M.baseTok)return;m.removeLayer(M.base);M.base=l;l.addTo(m)})} /* OpenFreeMap (เวกเตอร์ ป้ายไทย) ทับเมื่อโหลดเสร็จ */try{localStorage.setItem('uh_base',name)}catch(e){}document.querySelectorAll('[data-dbase]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dbase===name)))}
document.addEventListener('click',e=>{const b=e.target.closest('[data-dbase]');if(b&&M.map){setBase(b.dataset.dbase);return}
  const menu=$('#dlayer');if(menu&&!menu.hidden&&!e.target.closest('#dlayer')&&!e.target.closest('#fs-lay')){menu.hidden=true;$('#fs-lay').setAttribute('aria-expanded','false');$('#fs-lay').classList.remove('on')}});
$('#fs-loc').addEventListener('click',e=>{const btn=e.currentTarget;if(!navigator.geolocation||!M.map){if(typeof toast==='function')toast('อุปกรณ์นี้หาตำแหน่งไม่ได้');return}btn.classList.add('busy');
  navigator.geolocation.getCurrentPosition(p=>{btn.classList.remove('busy');const ll=[p.coords.latitude,p.coords.longitude];if(!M.me)M.me=L.marker(ll,{icon:L.divIcon({className:'me-dot',html:'<span></span>',iconSize:[22,22]}),interactive:false,zIndexOffset:2000}).addTo(M.map);M.me.setLatLng(ll);M.map.flyTo(ll,Math.max(M.map.getZoom(),15),{duration:.6})},
    ()=>{btn.classList.remove('busy')},{enableHighAccuracy:true,timeout:15000})});
['#mt-done','#mt-flood','#mt-cov','#mt-leads','#mt-live'].forEach(s=>document.addEventListener('change',e=>{if(e.target.matches(s))render()}));

/* ---------- render ---------- */
function render(){
  const from=rangeStart(),L=D.cases.filter(c=>!from||c.createdAt>=from),act=L.filter(c=>c.status!=='done');
  drawMap(L);
  $('#sync').textContent=D.loaded?'อัปเดต '+new Date(D.loaded).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'';
  $('#range-note').textContent=from?`ตั้งแต่ ${new Date(from).toLocaleDateString('th-TH',{day:'numeric',month:'short'})} · ${nf(L.length)} เคส`:`${nf(L.length)} เคสทั้งหมด`;
  const n=s=>L.filter(c=>c.status===s).length,done=L.filter(c=>c.status==='done'&&c.updatedAt>c.createdAt);
  const avgH=done.length?done.reduce((s,c)=>s+(c.updatedAt-c.createdAt),0)/done.length/36e5:null;
  const crit=act.filter(c=>sev(c)===3).length,ppl=act.reduce((s,c)=>s+(Number(c.people)||1),0),hhs=act.reduce((s,c)=>s+hh(c),0),vc=act.filter(c=>vul(c).length).length;
const bagsOf=c=>c.bags===''||c.bags==null?null:Number(c.bags);const bagSet=L.reduce((s,c)=>s+(bagsOf(c)||0),0),bagNeed=act.filter(c=>bagsOf(c)==null).reduce((s,c)=>s+(hh(c)||1),0);
    const k=[[nf(L.length),'เคสทั้งหมด',`ช่วยแล้ว ${L.length?Math.round(n('done')/L.length*100):0}%`],[nf(n('open')),'รอความช่วยเหลือ',`วิกฤต ${nf(crit)} เคส`,'var(--crit)'],[nf(n('going')),'ทีมกำลังไป','','var(--going)'],[nf(n('done')),'ช่วยเหลือแล้ว',avgH==null?'':`ปิดเคสเฉลี่ย ${avgH<1?Math.round(avgH*60)+' นาที':avgH.toFixed(1)+' ชม.'} (ประมาณ)`,'var(--good)'],
    [nf(ppl),'คนที่ยังรอ','จากเคสที่ยังไม่เสร็จ'],[hhs?nf(hhs):'–','ครัวเรือนที่ยังรอ','ถ้าผู้แจ้งระบุ'],[nf(vc),'เคสที่มีคนต้องดูแลพิเศษ','ยังไม่เสร็จ'],[nf(L.filter(c=>!(c.lat!==''&&c.lat!=null)).length),'เคสที่ไม่มีหมุด','ต้องโทรถามตำแหน่ง'],[nf(bagSet),'ถุงยังชีพ (ที่ระบุแล้ว)','รวมทุกเคสในช่วงนี้'],[nf(bagNeed),'ถุงที่ควรเตรียมเพิ่ม','เคสยังไม่เสร็จที่ยังไม่ระบุ · ครัวเรือนละ 1']];
  // พื้นที่ที่องค์กรอื่นช่วยแล้ว (จากชีต) + เคสที่ยังไม่เสร็จซึ่งอยู่ในพื้นที่นั้น (อาจซ้ำ)
  if(typeof COVERED!=='undefined'){const cr=COVERED.C.rows,orgs=new Set(cr.map(r=>r.org).filter(Boolean));
    const sets=cr.reduce((a,r)=>a+(/^[\d,]+(\s*ชุด)?$/.test(String(r.sets).trim())?parseInt(String(r.sets).replace(/,/g,''))||0:0),0);
    const dup=cr.length?act.filter(c=>COVERED.match(c)).length:0;
    k.push([cr.length?nf(cr.length):(COVERED.C.loading||!COVERED.C.loaded?'…':'0'),'พื้นที่ที่องค์กรอื่นช่วยแล้ว',cr.length?`${nf(orgs.size)} องค์กร${sets?' · '+nf(sets)+' ชุด':''}`:(COVERED.C.error||'กำลังโหลดจากชีต'),'#7b3fc4','../covered/'],
      [cr.length?nf(dup):'…','เคสรอช่วยในพื้นที่ที่มีคนช่วยแล้ว','ตรวจก่อนส่งทีม (อาจซ้ำ)','#7b3fc4','../covered/']);}
  if(D.leads){const nw=D.leads.filter(l=>l.status==='new');
    k.splice(1,0,[nf(nw.length),'เคสจากโซเชียลรอคัด',`วิกฤต ${nf(nw.filter(l=>+l.urgency===3).length)} · ติดธง ${nf(nw.filter(l=>(l.flags||[]).some(f=>/^(asks_money|account_reused|past_year_text)/.test(f))).length)}`,'var(--crit)','../../admin.html#leads'])}
  $('#kpis').replaceChildren(...k.map(([v,t,s,col,href])=>{const d=el(href?'a':'div','kpi'+(href?' kpi-cov':''));if(href)d.href=href;d.append(el('b',null,v),el('span',null,t));if(s){const sm=el('small');if(col){const i=el('i');i.style.background=col;sm.append(i)}sm.append(s);d.append(sm)}return d}));

  /* trend */
  let buckets=[];
  if(D.range==='today'){const s0=startOfDay(Date.now()),h=new Date().getHours();for(let i=0;i<=h;i++)buckets.push({t:s0+i*36e5,v:0,lab:i+':00',full:`${i}:00–${i}:59 น.`});L.forEach(c=>{const i=Math.floor((c.createdAt-s0)/36e5);if(buckets[i])buckets[i].v++});$('#t-trend').textContent='เคสใหม่รายชั่วโมง (วันนี้)'}
  else{const first=from||startOfDay(Math.min(...L.map(c=>c.createdAt).filter(Boolean),Date.now())),days=Math.max(1,Math.round((startOfDay(Date.now())-first)/864e5)+1);
    for(let i=0;i<days;i++){const t=startOfDay(first+i*864e5+36e5);const d=new Date(t);buckets.push({t,v:0,lab:d.toLocaleDateString('th-TH',{day:'numeric',month:'short'}),full:d.toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short'})})}
    L.forEach(c=>{const i=buckets.findIndex(b=>b.t===startOfDay(c.createdAt));if(i>=0)buckets[i].v++});$('#t-trend').textContent='เคสใหม่ต่อวัน'}
  const peak=buckets.reduce((a,b)=>b.v>a.v?b:a,{v:0});$('#s-trend').textContent=peak.v?`มากที่สุด ${nf(peak.v)} เคส · ${peak.full}`:'';
  columns('#c-trend',buckets);table('#tb-trend',['ช่วงเวลา','เคสใหม่'],buckets.map(b=>[b.full,b.v]));

  const st=['open','going','done'].map(s=>[ST[s],n(s),ST_COL[s]]);hbars('#c-status',st,{total:L.length});table('#tb-status',['สถานะ','เคส'],st.map(r=>[r[0],r[1]]));
  const ur=[3,2,1].map(u=>[URG[u],act.filter(c=>sev(c)===u).length,URG_COL[u]]);hbars('#c-urg',ur,{total:act.length});table('#tb-urg',['ระดับ','เคส'],ur.map(r=>[r[0],r[1]]));
  const count=(arr)=>{const m=new Map();arr.forEach(x=>m.set(x,(m.get(x)||0)+1));return [...m.entries()].sort((a,b)=>b[1]-a[1])};
  if(typeof VERIFY!=='undefined'){const R=VERIFY.RESULT,cols={confirmed:'var(--crit)',likely:'var(--serious)',conflict:'var(--warn)',unverified:'#9aa5aa',notcrit:'var(--good)',nopin:'#c9cfd1'};
    const vv=['confirmed','likely','conflict','unverified','notcrit','nopin'].map(k=>[R[k].t,act.filter(c=>VERIFY.assess(c).result.k===k).length,cols[k]]);
    hbars('#c-vr',vv,{total:act.length});table('#tb-vr',['ผลตรวจ','เคส'],vv.map(r=>[r[0],r[1]]));}
  const nd=count(L.flatMap(c=>[...new Set(c.needs)]));hbars('#c-needs',nd);table('#tb-needs',['ความต้องการ','เคส'],nd);
  const vl=count(L.flatMap(c=>vul(c).map(v=>VUL[v]||v)));hbars('#c-vul',vl);table('#tb-vul',['กลุ่ม','เคส'],vl);
  const lv=[...LEVEL.map(([k,t])=>[t,L.filter(c=>c.level===k).length]),['ไม่ระบุ',L.filter(c=>!c.level).length]];hbars('#c-level',lv);table('#tb-level',['ระดับน้ำ','เคส'],lv);
  const ds=count(L.map(c=>c.district).filter(Boolean)).slice(0,10).map(([d,v])=>['เขต'+d,v]);hbars('#c-district',ds);table('#tb-district',['เขต','เคส'],ds);

  /* teams */
  const tm=new Map();L.filter(c=>c.volunteer&&c.status!=='open').forEach(c=>{const t=String(c.volunteer).replace(/^'/,'');const o=tm.get(t)||{g:0,d:0,p:0};c.status==='going'?o.g++:o.d++;o.p+=Number(c.people)||1;tm.set(t,o)});
  const trs=[...tm.entries()].sort((a,b)=>(b[1].g+b[1].d)-(a[1].g+a[1].d));
  if(!trs.length)$('#teams').replaceChildren(el('p','empty','ยังไม่มีทีมรับเคสในช่วงนี้'));
  else{const t=el('table','tlist');t.innerHTML='<thead><tr><th>ทีม</th><th class="n">กำลังไป</th><th class="n">ช่วยแล้ว</th><th class="n hide-s">คนที่ช่วย / กำลังช่วย</th></tr></thead>';const tb=el('tbody');
    trs.forEach(([name,o])=>{const r=el('tr');r.append(el('td',null,name),el('td','n',nf(o.g)),el('td','n',nf(o.d)),el('td','n hide-s',nf(o.p)));tb.append(r)});t.append(tb);$('#teams').replaceChildren(t)}

  /* waiting critical */
  const w=L.filter(c=>c.status==='open'&&sev(c)===3).sort((a,b)=>a.createdAt-b.createdAt).slice(0,8);
  if(!w.length)$('#waiting').replaceChildren(el('p','empty','ไม่มีเคสวิกฤตที่รอทีมอยู่ 👍'));
  else{const t=el('table','tlist');t.innerHTML='<thead><tr><th>รอมาแล้ว</th><th>ความต้องการ</th><th class="hide-s">ที่อยู่</th><th class="n">คน</th></tr></thead>';const tb=el('tbody');
    w.forEach(c=>{const r=el('tr'),m=Math.round((Date.now()-c.createdAt)/60000);r.append(el('td',null,m<60?m+' นาที':m<1440?Math.floor(m/60)+' ชม. '+(m%60)+' นาที':Math.floor(m/1440)+' วัน'),el('td',null,[...new Set(c.needs)].join(', ')||'-'),el('td','hide-s',[c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ')||'-'),el('td','n',nf(c.people||1)));tb.append(r)});
    t.append(tb);const a=el('a',null,'ไปที่หน้าจัดการเคส →');a.href='../../admin.html';const p=el('p');p.style.margin='10px 0 0';p.append(a);$('#waiting').replaceChildren(t,p)}
  renderLeads();
  renderStock();
}

/* ---------- เคสจากโซเชียลรอคัด (เรียงวิกฤตก่อน) + ทีมแชร์ตำแหน่งที่ใกล้ที่สุด ---------- */
function ago(t){const m=Math.round((Date.now()-Number(t))/60000);return m<1?'เมื่อสักครู่':m<60?m+' นาทีที่แล้ว':m<1440?Math.round(m/60)+' ชม.ที่แล้ว':Math.round(m/1440)+' วันที่แล้ว'}
const kmD=(a,b,c,d)=>{const R=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,h=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
function renderLeads(){
  const box=$('#leads-card');if(!D.leads){box.hidden=true;return}box.hidden=false;
  const nw=D.leads.filter(l=>l.status==='new').sort((a,b)=>(b.urgency-a.urgency)||(b.postedAt-a.postedAt)),acc=D.leads.filter(l=>l.status==='accepted').length,rej=D.leads.filter(l=>l.status==='rejected').length;
  $('#leads-sub').textContent=`รอคัด ${nf(nw.length)} · รับเป็นเคสแล้ว ${nf(acc)} · ตัดทิ้ง ${nf(rej)} (30 วันล่าสุด)`;
  if(!nw.length){$('#leads').replaceChildren(el('p','empty','ไม่มีเคสรอคัด 👍 กด "ดึงเคสใหม่" ที่หน้าเคสจากโซเชียลเพื่อหาเพิ่ม'));return}
  const t=el('table','tlist');t.innerHTML='<thead><tr><th>ระดับ</th><th>เคส</th><th class="hide-s">พื้นที่</th><th>ทีมใกล้สุด</th><th class="n hide-s">โพสต์</th></tr></thead>';const tb=el('tbody');
  nw.slice(0,8).forEach(l=>{const tr=el('tr'),u=Math.min(3,Math.max(1,+l.urgency||1));
    const near=l.lat!=null?(D.live||[]).map(x=>({x,d:kmD(+l.lat,+l.lng,+x.lat,+x.lng)})).sort((a,b)=>a.d-b.d)[0]:null;
    const lv=el('td');const i=el('i','dot');i.style.background=URG_COL[u];lv.append(i,URG[u]+((l.flags||[]).some(f=>/^(asks_money|account_reused|past_year_text)/.test(f))?' ⚠️':''));
    tr.append(lv,el('td',null,l.title||'-'),el('td','hide-s',[l.address,l.district?'เขต'+l.district:''].filter(Boolean).join(' · ')||'-'),
      el('td',null,near?`${near.x.team} · ${near.d.toFixed(1)} กม.`:'ยังไม่มีทีมแชร์ตำแหน่ง'),el('td','n hide-s',ago(l.postedAt)));tb.append(tr)});
  t.append(tb);const a=el('a',null,'คัดเคสที่หน้าเคสจากโซเชียล →');a.href='../../admin.html#leads';const p=el('p');p.style.margin='10px 0 0';p.append(a);$('#leads').replaceChildren(t,p)}

/* ---------- สต็อก (ยอดปัจจุบัน ไม่ขึ้นกับช่วงเวลา) ---------- */
// หน่วยของแต่ละรายการไม่เหมือนกัน (ห่อ แผง ขวด) จึงเทียบกันด้วย % ของที่เคยรับเข้า ไม่ใช่จำนวนดิบ
const SK={out:['หมด','var(--crit)'],low:['ใกล้หมด','var(--serious)'],ok:['พอใช้','var(--s1)'],none:['ยังไม่มีของ','#9aa5aa']};
function stockRows(){const items=(D.stock&&D.stock.items)||[],log=(D.stock&&D.stock.log)||[];
  return items.map(i=>{const L=log.filter(x=>x.itemId===i.id),got=L.reduce((s,x)=>s+Math.max(0,Number(x.delta)||0),0),used=L.filter(x=>x.type==='out').reduce((s,x)=>s-(Number(x.delta)||0),0);
    const qty=Number(i.qty)||0,base=Math.max(got,qty),min=i.min===''||i.min==null?null:Number(i.min),left=base?qty/base:0;
    const st=!base?'none':qty<=0?'out':(min!=null?qty<=min:left<=.2)?'low':'ok';
    return {...i,qty,base,used,left,st}})}
function renderStock(){
  const sec=$('#stock-sec');if(!D.stock){sec.hidden=true;return}sec.hidden=false;
  const R=stockRows(),n=k=>R.filter(r=>r.st===k).length,need=R.filter(r=>r.needed),moves=(D.stock.log||[]).length;
  $('#stock-kpis').replaceChildren(...[[nf(R.length),'รายการในสต็อก',`บันทึกรับ/จ่าย ${nf(moves)} ครั้ง`],[nf(n('out')),'หมดแล้ว','ต้องเติมด่วน',SK.out[1]],[nf(n('low')),'ใกล้หมด','เหลือไม่ถึง 20% หรือต่ำกว่าขั้นต่ำ',SK.low[1]],[nf(need.length),'ติ๊กว่าต้องการ','ของที่ขอรับบริจาค']]
    .map(([v,t,s,col])=>{const d=el('div','kpi');d.append(el('b',null,v),el('span',null,t));const sm=el('small');if(col){const i=el('i');i.style.background=col;sm.append(i)}sm.append(s);d.append(sm);return d}));
  const has=R.filter(r=>r.base).sort((a,b)=>a.left-b.left),narrow=($('#c-left').clientWidth||800)<560;
  hbars('#c-left',has.map(r=>[r.name,Math.round(r.left*100),r.st==='ok'?null:SK[r.st][1],narrow?`${nf(r.qty)} · ${Math.round(r.left*100)}%`:`${nf(r.qty)} ${r.unit} · เหลือ ${Math.round(r.left*100)}%${r.st==='ok'?'':' · '+SK[r.st][0]}`]),{max:100,reserve:narrow?90:170});
  table('#tb-left',['รายการ','คงเหลือ','รับเข้ารวม','เหลือ (%)','สถานะ'],has.map(r=>[r.name,`${nf(r.qty)} ${r.unit}`,`${nf(r.base)} ${r.unit}`,Math.round(r.left*100)+'%',SK[r.st][0]]));
  const sts=['out','low','ok','none'].map(k=>[SK[k][0],n(k),SK[k][1]]);hbars('#c-skst',sts,{total:R.length,unit:'รายการ'});table('#tb-skst',['สถานะ','รายการ'],sts.map(r=>[r[0],r[1]]));
  const us=R.filter(r=>r.used>0&&r.base).sort((a,b)=>b.used/b.base-a.used/a.base).slice(0,10);
  hbars('#c-used',us.map(r=>[r.name,Math.round(r.used/r.base*100),null,narrow?Math.round(r.used/r.base*100)+'%':`จ่ายไป ${nf(r.used)} ${r.unit} · ${Math.round(r.used/r.base*100)}%`]),{max:100,reserve:narrow?48:150});
  table('#tb-used',['รายการ','จ่ายออก','รับเข้ารวม','จ่ายไป (%)'],us.map(r=>[r.name,`${nf(r.used)} ${r.unit}`,`${nf(r.base)} ${r.unit}`,Math.round(r.used/r.base*100)+'%']));
  const todo=R.filter(r=>r.st==='out'||r.st==='low'||r.needed).sort((a,b)=>({out:0,low:1}[a.st]??2)-({out:0,low:1}[b.st]??2));
  if(!todo.length)$('#restock').replaceChildren(el('p','empty','ยังไม่มีของที่ต้องเติม 👍'));
  else{const t=el('table','tlist');t.innerHTML='<thead><tr><th>รายการ</th><th class="n">คงเหลือ</th><th>สถานะ</th><th class="hide-s">หมวด</th></tr></thead>';const tb=el('tbody');
    todo.forEach(r=>{const tr=el('tr'),s=el('td'),i=el('i','dot');const k=r.st==='out'||r.st==='low'?r.st:'none';i.style.background=SK[k][1];s.append(i,(r.st==='out'||r.st==='low'?SK[r.st][0]:'')+(r.needed?(r.st==='out'||r.st==='low'?' · ':'')+'ต้องการ':''));
      tr.append(el('td',null,r.name),el('td','n',`${nf(r.qty)} ${r.unit}`),s,el('td','hide-s',r.category||'-'));tb.append(tr)});
    const a=el('a',null,'ไปที่หน้าสต็อก →');a.href='../stock/';const p=el('p');p.style.margin='10px 0 0';p.append(a);t.append(tb);$('#restock').replaceChildren(t,p)}
}
let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(D.loaded)render()},200)});
if(D.key){showApp();load().then(()=>{if(D.key){poll();VERIFY.load().then(render,render);if(typeof COVERED!=='undefined')COVERED.load(API_URL,D.key).then(render,render)}})}else showLogin();

const ICON_FULL='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',ICON_CLOSE='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
/* แผนที่เต็มจอ: ซ่อนส่วนอื่นทั้งหมด เหลือปุ่ม ☰ (ชั้นข้อมูล) กับ ✕ · ปุ่มย้อนกลับของมือถือ/Esc = ออก */
(()=>{const card=document.querySelector('.mapcard'),btn=$('#fs-btn'),lay=$('#fs-lay');if(!card||!btn)return;
  const fix=()=>setTimeout(()=>{if(!M.map)return;M.map.invalidateSize();const w=M.map.scrollWheelZoom;if(w)w[card.classList.contains('fs')?'enable':'disable']()},80);
  function set(on,fromPop){if(on===card.classList.contains('fs'))return;
    card.classList.toggle('fs',on);document.body.classList.toggle('map-fs',on);
    btn.innerHTML=on?ICON_CLOSE:ICON_FULL;btn.setAttribute('aria-label',on?'ออกจากเต็มจอ':'ขยายแผนที่เต็มจอ');btn.title=btn.getAttribute('aria-label');
    if(on){try{history.pushState({mapfs:1},'')}catch(e){}try{const r=card.requestFullscreen&&card.requestFullscreen({navigationUI:'hide'});if(r&&r.catch)r.catch(()=>{})}catch(e){}}
    else{if(document.fullscreenElement)try{document.exitFullscreen().catch(()=>{})}catch(e){}if(!fromPop&&history.state&&history.state.mapfs)try{history.back()}catch(e){}}
    fix()}
  btn.addEventListener('click',()=>set(!card.classList.contains('fs')));
  btn.innerHTML=ICON_FULL;
  lay.addEventListener('click',()=>{const m=$('#dlayer'),o=m.hidden;m.hidden=!o;lay.setAttribute('aria-expanded',String(o));lay.classList.toggle('on',o)});
  window.addEventListener('popstate',()=>set(false,true));
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&card.classList.contains('fs'))set(false)});
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const m=$('#dlayer');if(m&&!m.hidden){m.hidden=true;lay.setAttribute('aria-expanded','false');lay.classList.remove('on');return}if(card.classList.contains('fs'))set(false)});
  window.addEventListener('resize',()=>{if(card.classList.contains('fs'))fix()});
})();

/* ปุ่มธีมมุมขวาบน: สว่าง (ค่าเริ่มต้น) ↔ มืด · แผนที่ฐานเปลี่ยนตามถ้ายังเป็นแบบถนน/มืด */
(()=>{const b=$('#theme-btn');if(!b)return;const root=document.documentElement;
  const sync=()=>{const dark=root.dataset.theme==='dark';b.textContent=dark?'☀️':'🌙';b.setAttribute('aria-pressed',String(dark));
    const t=dark?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด';b.setAttribute('aria-label',t);b.title=t;
    const mc=document.querySelector('meta[name=theme-color]');if(mc)mc.content=dark?'#0F1222':'#F2F3F7'};
  b.addEventListener('click',()=>{const dark=root.dataset.theme!=='dark';if(dark)root.dataset.theme='dark';else delete root.dataset.theme;
    try{localStorage.setItem('uh_theme',dark?'dark':'light')}catch(e){}sync();
    let base='road';try{base=localStorage.getItem('uh_base')||'road'}catch(e){}
    if(M.map&&base!=='sat')setBase(dark?'dark':'road');
    if(D.loaded)render()});
  sync()})();
