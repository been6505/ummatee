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
const sev=c=>typeof VERIFY!=='undefined'&&VERIFY.level?VERIFY.level(c):Math.min(3,Math.max(1,Number(c.urgency)||1)); // ระดับที่ระบบตัดสิน (ผู้แจ้ง + ข้อมูลระบบ)
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
    api({action:'helpme_stats',key:D.key}).then(h=>{D.hm=h&&h.ok?h:null;render()}).catch(()=>{});
    api({action:'helpme_cases',key:D.key}).then(h=>{D.hmc=h&&h.ok?h.cases.map(c=>({...c,needs:c.needs||[]})):null}).catch(()=>{}).finally(()=>{D.hmcDone=true;render()});
    if(!D.rosterN)api({action:'roster',key:D.key}).then(r=>{if(r&&r.ok){D.rosterN=(r.roster||[]).length;summary()}}).catch(()=>{});
    D.stock=sk&&sk.ok?sk:null;D.leads=ld&&ld.ok?ld.leads:null;D.live=tl&&tl.ok?tl.teams||[]:[];
    if(!r.volunteer){store.set('uh_vol_key','');store.set('uh_vol_ok','');D.key='';showLogin('รหัสหมดอายุหรือถูกเปลี่ยน กรุณาเข้าสู่ระบบใหม่');return}
    setCases(r);status('');render()}catch(e){$('#sync').textContent='โหลดไม่สำเร็จ';status('โหลดข้อมูลไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต',true)}finally{D.loading=false;$('#main').classList.remove('loading')}}
let pollT;function poll(){clearInterval(pollT);pollT=setInterval(async()=>{if(document.hidden||!D.key)return;try{const r=await api({action:'rev'});if(r&&r.ok&&r.rev!=null){if(D.rev!==null&&r.rev!==D.rev){D.rev=r.rev;load()}else D.rev=r.rev}}catch(e){}if(Date.now()-D.loaded>120000)load()},20000)}
$('#refresh').addEventListener('click',load);
// อัปเดตเอง: เช็กการเปลี่ยนแปลงถี่ ๆ (poll) + โหลดใหม่ทั้งหมดทุก 60 วิ (รวมเคส Help Me) และเมื่อกลับมาที่แท็บ
setInterval(()=>{if(D.key&&!document.hidden)load()},60000);document.addEventListener('visibilitychange',()=>{if(D.key&&!document.hidden)load()});

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
function columns(id,buckets){const box=$(id);const W=Math.max(320,box.clientWidth||600),H=230,pl=34,pr=8,pt=26,pb=26;
  const dual=buckets.some(b=>b.k!=null),max=Math.max(...buckets.map(b=>Math.max(b.v,b.k||0)),0);if(!max){box.replaceChildren(el('p','empty','ยังไม่มีเคสในช่วงนี้'));return}
  const step=max<=5?1:max<=10?2:Math.ceil(max/4/5)*5,top=Math.ceil(max/step)*step;
  const s=svgEl('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'กราฟเคสใหม่'}),iw=W-pl-pr,ih=H-pt-pb,y=v=>pt+ih-(v/top)*ih;
  for(let v=0;v<=top;v+=step){s.append(svgEl('line',{x1:pl,x2:W-pr,y1:y(v),y2:y(v),stroke:v?'var(--grid)':'var(--axis)','stroke-width':1}));const t=svgEl('text',{x:pl-6,y:y(v)+4,'text-anchor':'end','font-size':11,fill:'var(--muted)'});t.textContent=nf(v);s.append(t)}
  const n=buckets.length,band=iw/n,bw=Math.min(dual?16:24,Math.max(dual?2:3,(band-2)/(dual?2.2:1)));
  const every=n<=8?1:Math.ceil(n/(W<500?6:12));let peak=buckets.reduce((a,b)=>b.v>a.v?b:a,buckets[0]);
  const bar=(x,v,fill)=>{const h=(v/top)*ih;if(!v)return;const r=Math.min(4,bw/2,h),y0=pt+ih;s.append(svgEl('path',{d:`M${x},${y0}V${y0-h+r}Q${x},${y0-h} ${x+r},${y0-h}H${x+bw-r}Q${x+bw},${y0-h} ${x+bw},${y0-h+r}V${y0}Z`,fill}))};
  buckets.forEach((b,i)=>{const x=pl+band*i+(band-bw*(dual?2:1)-(dual?2:0))/2;
    bar(x,b.v,dual?'#2D45C8':'var(--s1)');if(dual)bar(x+bw+2,b.k,'#2E9E57');
    const hit=svgEl('rect',{x:pl+band*i,y:pt,width:band,height:ih,fill:'transparent'});hover(hit,dual?`ใหม่ ${nf(b.v)} · ช่วยเสร็จ ${nf(b.k)}`:nf(b.v)+' เคส',b.full);s.append(hit);
    if(i%every===0||i===n-1){const t=svgEl('text',{x:pl+band*i+band/2,y:H-8,'text-anchor':'middle','font-size':11,fill:'var(--muted)'});t.textContent=b.lab;s.append(t)}
    // ตัวเลขบนยอดทุกแท่ง (ถ้าแท่งไม่แคบเกินไป · แคบมากแสดงเฉพาะแท่งสูงสุด)
    const lbl=(cx,v,fill)=>{if(!v)return;const t=svgEl('text',{x:cx,y:y(v)-5,'text-anchor':'middle','font-size':band<26?10:11.5,'font-weight':700,fill});t.textContent=nf(v);s.append(t)};
    if(band>=18||b===peak){lbl(dual?x+bw/2:pl+band*i+band/2,b.v,dual?'#2D45C8':'var(--ink-2)');if(dual&&band>=18)lbl(x+bw+2+bw/2,b.k,'#2E9E57')}});
  if(!dual){box.replaceChildren(s);return}
  const lg=el('div','hm-legend sm');lg.innerHTML='<span><i class="b-new"></i>เคสใหม่</span><span><i class="b-done"></i>ช่วยเสร็จ</span>';box.replaceChildren(s,lg)}

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
    if('ResizeObserver' in window)new ResizeObserver(()=>M.map&&M.map.invalidateSize()).observe($('#dmap'));
    M.map.zoomControl.setPosition('bottomright');M.map.attributionControl.setPrefix(false);M.map.attributionControl.addAttribution('น้ำท่วม: Floodboard.org');
    L.control.scale({metric:true,imperial:false,position:'bottomleft'}).addTo(M.map);let b='road';try{b=localStorage.getItem('uh_base')||'road'}catch(e){}setBase(DBASES[b]?b:'road');
    M.flood=L.layerGroup().addTo(M.map);M.cases=L.layerGroup().addTo(M.map);M.map.on('focus',()=>M.map.scrollWheelZoom.enable());if(typeof MAPL!=='undefined')MAPL.attach(M.map)}
  const showDone=$('#mt-done').checked,list=L0.filter(c=>(showDone||c.status!=='done'));
  M.cases.clearLayers();const pts=[];let nopin=0;
  list.slice().sort((a,b)=>sev(a)-sev(b)).forEach(c=>{if(c.lat===''||c.lat==null||c.lng===''||isNaN(+c.lat)){nopin++;return}const ll=[+c.lat,+c.lng];pts.push(ll);
    const k=c.status==='done'?'done':c.status==='going'?'going':sev(c)===3?'danger':sev(c)===2?'urgent':'open';
    L.marker(ll,{icon:umPin(k),zIndexOffset:{danger:1000,urgent:700,open:400,going:200,done:0}[k],keyboard:false})
      .bindPopup(`<b>${escT(URG[sev(c)])} · ${escT(ST[c.status]||'')}</b><br>${escT(c.needs.join(', ')||'ขอความช่วยเหลือ')} · ${escT(c.people||1)} คน${hh(c)?' · '+hh(c)+' ครัวเรือน':''}<br>${escT([c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · '))}${c.volunteer?'<br>ทีม: '+escT(c.volunteer):''}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${ll[0]},${ll[1]}&travelmode=driving" target="_blank" rel="noopener">นำทาง (Google Maps) ↗</a> · <a href="../../central.html">เปิดหน้าจัดการเคส →</a>`).addTo(M.cases)});
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
      .bindPopup(`<b><i data-ic="megaphone"></i> ${escT(URG[u])} · รอคัด</b><br>${escT(l.title||'')}<br>${escT([l.address,l.district?'เขต'+l.district:''].filter(Boolean).join(' · '))}${(l.flags||[]).some(f=>/^(asks_money|account_reused|past_year_text)/.test(f))?'<br><i data-ic="alert"></i> ติดธง ตรวจก่อนรับ':''}${(l.flags||[]).includes('approx_location')?'<br><i data-ic="pin"></i> ตำแหน่งโดยประมาณ':''}<br><a href="../../central.html#leads">คัดเคสนี้ที่หน้าเคสจากโซเชียล →</a>`).addTo(M.leads)});
  (D.live||[]).forEach(t=>L.marker([+t.lat,+t.lng],{icon:L.divIcon({className:'live-tm',html:`<span><i data-ic="live"></i> ${escT(t.team)}</span>`,iconSize:null}),zIndexOffset:1500,keyboard:false})
    .bindPopup(`<b><i data-ic="live"></i> ${escT(t.team)}</b><br>แชร์ตำแหน่ง ${escT(ago(t.updatedAt))}${t.caseId?'<br>ถือเคส #'+escT(t.caseId):''}`).addTo(M.live));
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
/* การ์ดสรุปแบบหน้า "สรุป" ของ helpme4u.com: ทุกเคส (Help Me + ในระบบ) ไม่ขึ้นกับช่วงเวลา */
function summary(){if(typeof hmSummary!=='function')return;const all=(D.hmc||[]).concat(D.cases);if(!all.length&&!D.hmcDone)return;
  const online=new Set((D.live||[]).filter(t=>Date.now()-t.updatedAt<10*60e3).map(t=>t.team)).size;
  hmSummary($('#sumbox'),{cases:all,title:'ภาพรวมทั้งหมด',online,teams:D.rosterN||(D.live||[]).length,sev})}
/* ตัวชี้วัด (Design Thinking: วัดผลทุกการปรับปรุง) · เทียบเป้าหมาย: เขียว = ถึงเป้า · เหลือง = ใกล้ · แดง = ต้องแก้ */
function metrics(){const el=$('#metrics');if(!el)return;const all=(D.hmc||[]).concat(D.cases).filter(c=>!c.dupOf);if(!all.length)return;
  const now=Date.now(),wk=now-7*864e5,M=60e3,med=a=>{if(!a.length)return null;a=a.slice().sort((x,y)=>x-y);const m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2};
  const dur=ms=>ms==null?'–':ms<3600e3?Math.round(ms/M)+' นาที':ms<864e5?(ms/3600e3).toFixed(1).replace(/\.0$/,'')+' ชม.':(ms/864e5).toFixed(1).replace(/\.0$/,'')+' วัน';
  const rec=all.filter(c=>c.createdAt>=wk),open=all.filter(c=>c.status!=='done'&&c.status!=='going');
  const pick=rec.filter(c=>c.pickedAt>c.createdAt).map(c=>c.pickedAt-c.createdAt),fin=rec.filter(c=>c.status==='done'&&(c.doneAt||c.updatedAt)>c.createdAt).map(c=>(c.doneAt||c.updatedAt)-c.createdAt);
  const crit=rec.filter(c=>sev(c)===3),critOk=crit.filter(c=>c.pickedAt&&c.pickedAt-c.createdAt<=30*M).length;
  const critWait=open.filter(c=>sev(c)===3&&now-c.createdAt>30*M).length,longWait=open.filter(c=>now-c.createdAt>864e5).length;
  const mp=med(pick),mf=med(fin),pc=crit.length?Math.round(critOk/crit.length*100):null;
  const lv=(v,good,warn,low)=>v==null?'':low?(v<=good?'ok':v<=warn?'warn':'bad'):(v>=good?'ok':v>=warn?'warn':'bad');
  const T=[[dur(mp),'เวลาจนมีทีมรับ (ค่ากลาง)','เป้า ≤ 30 นาที',lv(mp,30*M,120*M,1)],[dur(mf),'เวลาจนช่วยเสร็จ (ค่ากลาง)','เป้า ≤ 12 ชม.',lv(mf,12*3600e3,24*3600e3,1)],
    [critWait,'วิกฤตรอเกิน 30 นาที','เป้า 0',lv(critWait,0,2,1)],[pc==null?'–':pc+'%','วิกฤตมีทีมรับใน 30 นาที','เป้า ≥ 90%',lv(pc,90,60)],
    [longWait,'เคสรอเกิน 24 ชม.','เป้า 0',lv(longWait,0,5,1)],[rec.length,'เคสใหม่ 7 วัน','',''] ];
  el.innerHTML=T.map(([v,l,g,c])=>`<div class="mt ${c}"><b>${v}</b><span>${l}</span>${g?`<small>${g}</small>`:''}</div>`).join('')}
/* ข้อเสนอแนะจากทีมงาน (ปุ่มในทุกหน้า) · กด "เสร็จ" เมื่อแก้แล้ว */
async function loadFeedback(){const r=await api({action:'feedback_list',key:D.key}).catch(()=>null);const card=$('#fbk-card');if(!card||!r||!r.ok){if(card)card.hidden=true;return}
  const open=r.feedback.filter(f=>!f.done);card.hidden=!r.feedback.length;$('#fbk-n').textContent=open.length||'';
  $('#fbk-list').innerHTML=r.feedback.slice(0,30).map(f=>`<div class="fbk${f.done?' done':''}"><p>${escT(f.text)}</p><small>${escT([f.by||'ไม่ระบุชื่อ',f.room?'War Room '+f.room:'',f.page.split(' · ')[0],new Date(f.at).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})].filter(Boolean).join(' · '))}</small>
    <button type="button" class="linkish" data-fbk="${f.n}" data-done="${f.done?0:1}">${f.done?'เปิดอีกครั้ง':'เสร็จแล้ว'}</button></div>`).join('')}
$('#fbk-list')&&$('#fbk-list').addEventListener('click',async e=>{const b=e.target.closest('[data-fbk]');if(!b)return;b.disabled=true;
  await fetch('/api',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'feedback_done',key:D.key,n:+b.dataset.fbk,done:b.dataset.done==='1'})}).catch(()=>{});loadFeedback()});
setInterval(()=>{if(D.key&&!document.hidden)loadFeedback()},60000);
function render(){summary();metrics();if(!D.fbkAt){D.fbkAt=1;loadFeedback()}
  const from=rangeStart(),L=D.cases.filter(c=>!from||c.createdAt>=from),act=L.filter(c=>c.status!=='done');
  drawMap(L);
  $('#sync').textContent=D.loaded?'อัปเดต '+new Date(D.loaded).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'';
  $('#range-note').textContent=from?`ตั้งแต่ ${new Date(from).toLocaleDateString('th-TH',{day:'numeric',month:'short'})} · ${nf(L.length)} เคส`:`${nf(L.length)} เคสทั้งหมด`;
  const n=s=>L.filter(c=>c.status===s).length;
  /* การ์ดตัวเลข: เคสจาก Google Sheet ของ Help Me (ตามช่วงเวลาที่เลือก) ถ้าโหลดได้ ไม่ได้ใช้เคสในระบบ Helpme+ */
  const HMC=!!D.hmc,KL=HMC?D.hmc.filter(c=>!from||c.createdAt>=from):L,ka=KL.filter(c=>c.status!=='done'),kn=s=>KL.filter(c=>c.status===s).length;
  const doneAt=c=>Number(c.doneAt)||c.updatedAt,done=KL.filter(c=>c.status==='done'&&doneAt(c)>c.createdAt);
  const avgH=done.length?done.reduce((s,c)=>s+(doneAt(c)-c.createdAt),0)/done.length/36e5:null;
  const crit=ka.filter(c=>sev(c)===3).length,ppl=ka.reduce((s,c)=>s+(Number(c.people)||1),0),hhs=ka.reduce((s,c)=>s+hh(c),0),vc=ka.filter(c=>vul(c).length||(c.needs||[]).includes('ผู้ป่วย / ผู้สูงอายุ')).length;
const bagsOf=c=>c.bags===''||c.bags==null?null:Number(c.bags);const bagSet=KL.reduce((s,c)=>s+(bagsOf(c)||0),0),bagNeed=ka.filter(c=>bagsOf(c)==null).reduce((s,c)=>s+(hh(c)||1),0);
    // ชุดเดียวกับการ์ด "สถิติ Help Me" (วันนี้ / คนในเคสวิกฤต / คนที่ช่วยแล้ว) รวมไว้ในแถวนี้ ไม่แสดงสองชุด · "วันนี้" นับจาก 00:00 น. เวลาไทย
    const day0=Math.floor((Date.now()+7*36e5)/864e5)*864e5-7*36e5,P=c=>Math.max(1,Number(c.people)||1);
    const newToday=KL.filter(c=>c.createdAt>=day0).length,doneToday=KL.filter(c=>c.status==='done'&&doneAt(c)>=day0).length;
    const pplCrit=ka.filter(c=>sev(c)===3).reduce((s,c)=>s+P(c),0),pplDone=KL.filter(c=>c.status==='done').reduce((s,c)=>s+P(c),0);
    const avgTxt=avgH==null?'':`ปิดเคสเฉลี่ย ${avgH<1?Math.round(avgH*60)+' นาที':avgH.toFixed(1)+' ชม.'}`;
    const k=[[nf(KL.length),'เคสทั้งหมด',`ช่วยแล้ว ${KL.length?Math.round(kn('done')/KL.length*100):0}% · ใหม่วันนี้ ${nf(newToday)}`],[nf(kn('open')),'รอความช่วยเหลือ',`วิกฤต ${nf(crit)} เคส`,'var(--crit)'],[nf(kn('going')),'ทีมกำลังไป','กำลังเดินทาง / อยู่หน้างาน','var(--going)'],[nf(kn('done')),'ช่วยเหลือแล้ว',`วันนี้ ${nf(doneToday)} เคส${avgTxt?' · '+avgTxt:''}`,'var(--good)'],
    [nf(ppl),'คนที่ยังรอ',`ในเคสวิกฤต ${nf(pplCrit)} คน`,'var(--crit)'],[nf(pplDone),'คนที่ช่วยแล้ว','ได้รับความช่วยเหลือ','var(--good)'],[hhs?nf(hhs):'–','ครัวเรือนที่ยังรอ','ถ้าผู้แจ้งระบุ'],[nf(vc),'เคสที่มีคนต้องดูแลพิเศษ','ยังไม่เสร็จ'],[nf(KL.filter(c=>!(c.lat!==''&&c.lat!=null)).length),'เคสที่ไม่มีหมุด','ต้องโทรถามตำแหน่ง'],[nf(bagSet),'ถุงยังชีพ (ที่ระบุแล้ว)','รวมทุกเคสในช่วงนี้'],[nf(bagNeed),'ถุงที่ควรเตรียมเพิ่ม','เคสยังไม่เสร็จที่ยังไม่ระบุ · ครัวเรือนละ 1']];
  const fromHM=new Set(HMC?k:[]); // การ์ดที่คำนวณจากเคส Help Me (ติดป้าย)
  // พื้นที่ที่องค์กรอื่นช่วยแล้ว (จากชีต) + เคสที่ยังไม่เสร็จซึ่งอยู่ในพื้นที่นั้น (อาจซ้ำ)
  if(typeof COVERED!=='undefined'){const cr=COVERED.C.rows,orgs=new Set(cr.map(r=>r.org).filter(Boolean));
    const sets=cr.reduce((a,r)=>a+(/^[\d,]+(\s*ชุด)?$/.test(String(r.sets).trim())?parseInt(String(r.sets).replace(/,/g,''))||0:0),0);
    const dup=cr.length?ka.filter(c=>COVERED.match(c)).length:0;
    k.push([cr.length?nf(cr.length):(COVERED.C.loading||!COVERED.C.loaded?'…':'0'),'พื้นที่ที่องค์กรอื่นช่วยแล้ว',cr.length?`${nf(orgs.size)} องค์กร${sets?' · '+nf(sets)+' ชุด':''}`:(COVERED.C.error||'กำลังโหลดจากชีต'),'#7b3fc4','#covered'],
      [cr.length?nf(dup):'…','เคสรอช่วยในพื้นที่ที่มีคนช่วยแล้ว','ตรวจก่อนส่งทีม (อาจซ้ำ)','#7b3fc4','#covered']);}
  if(D.leads){const nw=D.leads.filter(l=>l.status==='new');
    k.splice(1,0,[nf(nw.length),'เคสจากโซเชียลรอคัด',`วิกฤต ${nf(nw.filter(l=>+l.urgency===3).length)} · ติดธง ${nf(nw.filter(l=>(l.flags||[]).some(f=>/^(asks_money|account_reused|past_year_text)/.test(f))).length)}`,'var(--crit)','../../central.html#leads'])}
  $('#kpis').replaceChildren(...k.map(item=>{const [v,t,s,col,href]=item,d=el(href?'a':'div','kpi'+(href?' kpi-cov':''));if(href)d.href=href;const lab=el('span',null,t);if(fromHM.has(item))lab.append(' ',el('small','hm-tag','Help Me'));d.append(el('b',null,v),lab);if(s){const sm=el('small');if(col){const i=el('i');i.style.background=col;sm.append(i)}sm.append(s);d.append(sm)}return d}));

  /* trend: เคสใหม่ (และช่วยเสร็จ) จาก Google Sheet ของ Help Me ถ้าโหลดได้ ไม่ได้ใช้เคสในระบบ Helpme+ */
  const HM=D.hm&&Array.isArray(D.hm.created)?D.hm:null,inR=t=>t>=from;
  const cr=HM?HM.created.filter(inR):L.map(c=>c.createdAt),fin=HM?(HM.finished||[]).filter(inR):null;
  let buckets=[];
  if(D.range==='today'){const s0=startOfDay(Date.now()),h=new Date().getHours();for(let i=0;i<=h;i++)buckets.push({t:s0+i*36e5,v:0,k:fin?0:null,lab:i+':00',full:`${i}:00–${i}:59 น.`});
    cr.forEach(t=>{const b=buckets[Math.floor((t-s0)/36e5)];if(b)b.v++});(fin||[]).forEach(t=>{const b=buckets[Math.floor((t-s0)/36e5)];if(b)b.k++});$('#t-trend').textContent='เคสใหม่รายชั่วโมง (วันนี้)'}
  else{const first=startOfDay(Date.now()-6*864e5),days=7; // กราฟรายวัน: 7 วันล่าสุดเสมอ (ดูช่วงอื่นได้จากตารางด้านล่าง)
    for(let i=0;i<days;i++){const t=startOfDay(first+i*864e5+36e5);const d=new Date(t);buckets.push({t,v:0,k:fin?0:null,lab:d.toLocaleDateString('th-TH',{day:'numeric',month:'short'}),full:d.toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short'})})}
    const byDay=new Map(buckets.map(b=>[b.t,b]));cr.forEach(t=>{const b=byDay.get(startOfDay(t));if(b)b.v++});(fin||[]).forEach(t=>{const b=byDay.get(startOfDay(t));if(b)b.k++});
    $('#t-trend').textContent=fin?'เคสใหม่ และเคสที่ช่วยเสร็จ · 7 วันล่าสุด':'เคสใหม่ · 7 วันล่าสุด'}
  if(HM){const tg=el('small','hm-tag','Help Me');$('#t-trend').append(' ',tg)}
  const peak=buckets.reduce((a,b)=>b.v>a.v?b:a,{v:0});$('#s-trend').textContent=(peak.v?`มากที่สุด ${nf(peak.v)} เคส · ${peak.full}`:'')+(HM?(peak.v?' · ':'')+'จาก Google Sheet ของ Help Me':'');
  columns('#c-trend',buckets);table('#tb-trend',fin?['ช่วงเวลา','เคสใหม่','ช่วยเสร็จ']:['ช่วงเวลา','เคสใหม่'],buckets.map(b=>fin?[b.full,b.v,b.k]:[b.full,b.v]));

  /* การ์ดที่ใช้เคส Help Me ติดป้าย (ถ้าโหลดไม่ได้ ใช้เคส Helpme+ และเอาป้ายออก) */
  document.querySelectorAll('.hm-auto > h2').forEach(h=>{const t=h.querySelector('.hm-tag.auto');if(HMC&&!t){const s=el('small','hm-tag auto','Help Me');h.append(' ',s)}else if(!HMC&&t)t.remove()});
  const st=['open','going','done'].map(s=>[ST[s],kn(s),ST_COL[s]]);hbars('#c-status',st,{total:KL.length});table('#tb-status',['สถานะ','เคส'],st.map(r=>[r[0],r[1]]));
  const ur=[3,2,1].map(u=>[URG[u],ka.filter(c=>sev(c)===u).length,URG_COL[u]]);hbars('#c-urg',ur,{total:ka.length});table('#tb-urg',['ระดับ','เคส'],ur.map(r=>[r[0],r[1]]));
  const count=(arr)=>{const m=new Map();arr.forEach(x=>m.set(x,(m.get(x)||0)+1));return [...m.entries()].sort((a,b)=>b[1]-a[1])};
  if(typeof VERIFY!=='undefined'){const R=VERIFY.RESULT,cols={confirmed:'var(--crit)',likely:'var(--serious)',conflict:'var(--warn)',unverified:'#9aa5aa',notcrit:'var(--good)',nopin:'#c9cfd1'};
    const vv=['confirmed','likely','conflict','unverified','notcrit','nopin'].map(k=>[R[k].t,ka.filter(c=>VERIFY.assess(c).result.k===k).length,cols[k]]);
    hbars('#c-vr',vv,{total:ka.length});table('#tb-vr',['ผลตรวจ','เคส'],vv.map(r=>[r[0],r[1]]));}
  const nd=count(KL.flatMap(c=>[...new Set(c.needs)]));hbars('#c-needs',nd);table('#tb-needs',['ความต้องการ','เคส'],nd);
  const vl=count(KL.flatMap(c=>vul(c).map(v=>VUL[v]||v)));hbars('#c-vul',vl);table('#tb-vul',['กลุ่ม','เคส'],vl);
  const lv=HMC?count(KL.map(c=>c.levelText||'ไม่ระบุ')):[...LEVEL.map(([k,t])=>[t,KL.filter(c=>c.level===k).length]),['ไม่ระบุ',KL.filter(c=>!c.level).length]];hbars('#c-level',lv);table('#tb-level',['ระดับน้ำ','เคส'],lv);
  const ds=count(KL.map(c=>c.district).filter(Boolean)).slice(0,10).map(([d,v])=>[/^(อำเภอ|อ\.|เขต)/.test(d)?d:'เขต'+d,v]);hbars('#c-district',ds);table('#tb-district',['เขต','เคส'],ds);

  /* teams */
  const tm=new Map(),tn=new Map();KL.filter(c=>c.volunteer&&c.status!=='open').forEach(c=>{const raw=String(c.volunteer).replace(/^'/,'').trim(),k=raw.toLowerCase();if(!tn.has(k))tn.set(k,raw);const t=tn.get(k);const o=tm.get(t)||{g:0,d:0,p:0};c.status==='going'?o.g++:o.d++;o.p+=Number(c.people)||1;tm.set(t,o)});
  const trs=[...tm.entries()].sort((a,b)=>(b[1].g+b[1].d)-(a[1].g+a[1].d));
  if(!trs.length)$('#teams').replaceChildren(el('p','empty','ยังไม่มีทีมรับเคสในช่วงนี้'));
  else{const t=el('table','tlist');t.innerHTML='<thead><tr><th>ทีม</th><th class="n">กำลังไป</th><th class="n">ช่วยแล้ว</th><th class="n hide-s">คนที่ช่วย / กำลังช่วย</th></tr></thead>';const tb=el('tbody');
    trs.forEach(([name,o])=>{const r=el('tr');r.append(el('td',null,name),el('td','n',nf(o.g)),el('td','n',nf(o.d)),el('td','n hide-s',nf(o.p)));tb.append(r)});t.append(tb);$('#teams').replaceChildren(t)}

  /* waiting critical */
  const w=KL.filter(c=>c.status==='open'&&sev(c)===3).sort((a,b)=>a.createdAt-b.createdAt).slice(0,8);
  if(!w.length)$('#waiting').replaceChildren(el('p','empty','ไม่มีเคสวิกฤตที่รอทีมอยู่ <i data-ic="check"></i>'));
  else{const t=el('table','tlist');t.innerHTML='<thead><tr><th>รอมาแล้ว</th><th>ความต้องการ</th><th class="hide-s">ที่อยู่</th><th class="n">คน</th></tr></thead>';const tb=el('tbody');
    w.forEach(c=>{const r=el('tr'),m=Math.round((Date.now()-c.createdAt)/60000);r.append(el('td',null,m<60?m+' นาที':m<1440?Math.floor(m/60)+' ชม. '+(m%60)+' นาที':Math.floor(m/1440)+' วัน'),el('td',null,[...new Set(c.needs)].join(', ')||'-'),el('td','hide-s',[c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ')||'-'),el('td','n',nf(c.people||1)));tb.append(r)});
    t.append(tb);const a=el('a',null,HMC?'เปิด Help Me →':'ไปที่หน้าจัดการเคส →');a.href=HMC?'https://helpme-th.pages.dev/':'../../central.html';if(HMC){a.target='_blank';a.rel='noopener'}const p=el('p');p.style.margin='10px 0 0';p.append(a);$('#waiting').replaceChildren(t,p)}
  renderLeads();
  renderStock();
  renderHelpme();
}

/* ---------- ภาพรวมจาก Help Me (ตัวเลขชุดเดียวกับหน้า #stats ของ helpme-th.pages.dev) · ตัวเลขรวมจากเซิร์ฟเวอร์ ไม่มีข้อมูลส่วนตัว ---------- */
function renderHelpme(){
  let h=D.hm;document.querySelectorAll('.hm-part').forEach(e=>e.hidden=!h);if(!h)return;
  // การ์ดแถวบนรวมตัวเลขชุดนี้แล้ว: แสดงชุดสำรองนี้เฉพาะเมื่อโหลดรายการเคส Help Me ไม่สำเร็จ (ไม่ขึ้นระหว่างรอโหลด)
  $('#hm-kpis').hidden=!!D.hmc||!D.hmcDone;
  document.querySelectorAll('.hm-dup').forEach(e=>e.hidden=!!D.hmc); // สถานะ/ความต้องการ/เขต/ทีม: กราฟหลักใช้เคส Help Me แล้ว
  const dur=ms=>{if(!ms)return '–';const x=ms/36e5;return x<1?Math.max(1,Math.round(ms/6e4))+' นาที':x<48?(Math.round(x*10)/10)+' ชม.':(Math.round(x/24*10)/10)+' วัน'};
  const I=n=>typeof ic==='function'?ic(n):'';
  $('#hm-upd').textContent=`Help Me ช่วยด้วย · ข้อมูล ณ ${new Date(h.time).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} น. · จาก Google Sheet ของ Help Me · อัปเดตทุก 1 นาที${h.source==='sheet'||h.full?'':' · ข้อมูลสาธารณะ'}${h.stale?' · Help Me ตอบช้า แสดงชุดล่าสุดที่ดึงได้':''}`;
  /* สัดส่วนสถานะ */
  const parts=[['open','รอช่วย',h.open],['going','ทีมกำลังไป',h.going],['done','ช่วยแล้ว',h.done]],sum=Math.max(1,h.open+h.going+h.done);
  $('#hm-bar').setAttribute('aria-label',parts.map(p=>p[1]+' '+p[2]).join(' · '));
  $('#hm-bar').innerHTML=`<div class="hm-seg">${parts.filter(p=>p[2]).map(p=>`<span class="s-${p[0]}" style="flex:${p[2]}"></span>`).join('')}</div>
    <div class="hm-legend">${parts.map(p=>`<span><i class="s-${p[0]}"></i>${p[1]} <b>${nf(p[2])}</b> <small>${Math.round(p[2]/sum*100)}%</small></span>`).join('')}</div>`;
  /* การ์ดตัวเลข */
  // จำนวนวิกฤตใช้ระดับที่ระบบคำนวณ (ไม่ใช้ระดับที่ส่งมาจาก Help Me) เมื่อมีรายการเคส Help Me แล้ว
  const hmAct=Array.isArray(D.hmc)?D.hmc.filter(c=>c.status!=='done'):null,hCrit=hmAct?hmAct.filter(c=>sev(c)===3):null;
  if(hCrit){h={...h,urgent:hCrit.length,people:{...h.people,urgent:hCrit.reduce((a,c)=>a+Math.max(1,Number(c.people)||1),0)}}}
  const T=[['alert','red','รอช่วย',h.open,`วิกฤต ${nf(h.urgent)} เคส`],['route','blue','ทีมกำลังไป',h.going,'กำลังเดินทาง / อยู่หน้างาน'],['check','green','ช่วยแล้ว',h.done,`วันนี้ ${nf(h.doneToday)} เคส`],
    ['list','navy','เคสทั้งหมด',h.total,`ใหม่วันนี้ ${nf(h.today)} เคส`],['users','orange','คนที่ยังรอ',h.people.act,`ในเคสวิกฤต ${nf(h.people.urgent)} คน`],['heart','green','คนที่ช่วยแล้ว',h.people.done,'ได้รับความช่วยเหลือ']];
  $('#hm-kpis').innerHTML=T.map(([icn,c,l,v,sub])=>`<div class="kpi hm-k t-${c}"><b>${nf(v)}</b><span>${l} <small class="hm-tag">Help Me</small></span><small><i></i>${esc2(sub)}</small></div>`).join('');
  /* 14 วัน: เคสใหม่ (น้ำเงิน) เทียบช่วยเสร็จ (เขียว) — กราฟหลักใช้ข้อมูลนี้แล้ว ใช้การ์ดนี้เฉพาะเซิร์ฟเวอร์รุ่นเก่าที่ยังไม่ส่ง created */
  if($('#hm-days'))$('#hm-days').closest('article').hidden=Array.isArray(h.created);
  const d=h.days||[],mx=Math.max(1,...d.map(x=>Math.max(x.n,x.k))),W=560,H=150,pb=22,bw=W/Math.max(1,d.length);
  $('#hm-days').innerHTML=d.length?`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="เคสใหม่และเคสที่ช่วยเสร็จ 14 วัน">${d.map((x,i)=>{const x0=i*bw+bw*.18,w=bw*.3,hn=(x.n/mx)*(H-pb-14),hk=(x.k/mx)*(H-pb-14);
      const lab=new Date(x.day).toLocaleDateString('th-TH',{day:'numeric',month:'short'});
      return `<g><title>${lab}: ใหม่ ${x.n} · ช่วยเสร็จ ${x.k}</title><rect x="${x0}" y="${H-pb-hn}" width="${w}" height="${Math.max(hn,x.n?2:0)}" rx="3" class="b-new"/><rect x="${x0+w+2}" y="${H-pb-hk}" width="${w}" height="${Math.max(hk,x.k?2:0)}" rx="3" class="b-done"/>${i%2===d.length%2?'':`<text x="${i*bw+bw/2}" y="${H-6}" text-anchor="middle">${lab}</text>`}</g>`}).join('')}</svg>
    <div class="hm-legend sm"><span><i class="b-new"></i>เคสใหม่</span><span><i class="b-done"></i>ช่วยเสร็จ</span></div>`:'<p class="empty">ยังไม่มีข้อมูล</p>';
  /* ความเร็ว */
  const w=h.waits;
  $('#hm-speed').innerHTML=(h.times.pickupN?`<div class="hm-metric"><span>แจ้ง → ทีมรับเคส (ค่ากลาง)</span><b>${dur(h.times.pickupMed)}</b><small>จาก ${nf(h.times.pickupN)} เคส</small></div>`:'')+`<div class="hm-metric"><span>แจ้ง → ช่วยเสร็จ (ค่ากลาง)</span><b>${dur(h.times.doneMed)}</b><small>จาก ${nf(h.times.doneN)} เคส</small></div>
    <div class="hm-metric"><span>90% ช่วยเสร็จภายใน</span><b>${dur(h.times.doneP90)}</b></div>
    <div class="hm-waits"><span>รอช่วยนานเกิน</span><div><b class="${w.over6?'warn':''}">${nf(w.over6)}</b><small>6 ชม.</small></div><div><b class="${w.over24?'bad':''}">${nf(w.over24)}</b><small>24 ชม.</small></div><div><b class="${w.over72?'bad':''}">${nf(w.over72)}</b><small>3 วัน</small></div></div>`;
  hbars('#c-hm-needs',h.needs.map(n=>[n.key,n.total]));
  const tbl=(rows,cols)=>{if(!rows.length)return el('p','empty','ยังไม่มีข้อมูล');const t=el('table','tlist');t.innerHTML=`<thead><tr>${cols.map((c,i)=>`<th${i?' class="n"':''}>${c[0]}</th>`).join('')}</tr></thead>`;
    const tb=el('tbody');rows.forEach(r=>{const tr=el('tr');cols.forEach((c,i)=>{const v=c[1](r),td=el('td',i?'n':'',typeof v==='number'?(v?nf(v):'–'):v);if(c[2]&&c[2](r))td.classList.add('is-red');tr.append(td)});tb.append(tr)});t.append(tb);return t};
  $('#hm-dist').replaceChildren(tbl(h.districts.slice(0,12),[['เขต',r=>r.key],['รอช่วย',r=>r.open],['วิกฤต',r=>r.urg,r=>r.urg>0],['กำลังไป',r=>r.going],['ช่วยแล้ว',r=>r.done],['คนที่ยังรอ',r=>r.ppl]]));
  $('#hm-orgs').replaceChildren(tbl(h.orgs.slice(0,10),[['องค์กร',r=>r.key],['กำลังไป',r=>r.going],['ช่วยแล้ว',r=>r.done]]));
  $('#hm-teams').replaceChildren(tbl(h.teams.slice(0,10),[['ทีม',r=>r.key],['กำลังไป',r=>r.going],['ช่วยแล้ว',r=>r.done]]));
}
const esc2=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));


/* ---------- เคสจากโซเชียลรอคัด (เรียงวิกฤตก่อน) + ทีมแชร์ตำแหน่งที่ใกล้ที่สุด ---------- */
function ago(t){const m=Math.round((Date.now()-Number(t))/60000);return m<1?'เมื่อสักครู่':m<60?m+' นาทีที่แล้ว':m<1440?Math.round(m/60)+' ชม.ที่แล้ว':Math.round(m/1440)+' วันที่แล้ว'}
const kmD=(a,b,c,d)=>{const R=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,h=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
function renderLeads(){
  const box=$('#leads-card');if(!D.leads){box.hidden=true;return}box.hidden=false;
  const nw=D.leads.filter(l=>l.status==='new').sort((a,b)=>(b.urgency-a.urgency)||(b.postedAt-a.postedAt)),acc=D.leads.filter(l=>l.status==='accepted').length,rej=D.leads.filter(l=>l.status==='rejected').length;
  $('#leads-sub').textContent=`รอคัด ${nf(nw.length)} · รับเป็นเคสแล้ว ${nf(acc)} · ตัดทิ้ง ${nf(rej)} (30 วันล่าสุด)`;
  if(!nw.length){$('#leads').replaceChildren(el('p','empty','ไม่มีเคสรอคัด <i data-ic="check"></i> กด "ดึงเคสใหม่" ที่หน้าเคสจากโซเชียลเพื่อหาเพิ่ม'));return}
  const t=el('table','tlist');t.innerHTML='<thead><tr><th>ระดับ</th><th>เคส</th><th class="hide-s">พื้นที่</th><th>ทีมใกล้สุด</th><th class="n hide-s">โพสต์</th></tr></thead>';const tb=el('tbody');
  nw.slice(0,8).forEach(l=>{const tr=el('tr'),u=Math.min(3,Math.max(1,+l.urgency||1));
    const near=l.lat!=null?(D.live||[]).map(x=>({x,d:kmD(+l.lat,+l.lng,+x.lat,+x.lng)})).sort((a,b)=>a.d-b.d)[0]:null;
    const lv=el('td');const i=el('i','dot');i.style.background=URG_COL[u];lv.append(i,URG[u]+((l.flags||[]).some(f=>/^(asks_money|account_reused|past_year_text)/.test(f))?' <i data-ic="alert"></i>':''));
    tr.append(lv,el('td',null,l.title||'-'),el('td','hide-s',[l.address,l.district?'เขต'+l.district:''].filter(Boolean).join(' · ')||'-'),
      el('td',null,near?`${near.x.team} · ${near.d.toFixed(1)} กม.`:'ยังไม่มีทีมแชร์ตำแหน่ง'),el('td','n hide-s',ago(l.postedAt)));tb.append(tr)});
  t.append(tb);const a=el('a',null,'คัดเคสที่หน้าเคสจากโซเชียล →');a.href='../../central.html#leads';const p=el('p');p.style.margin='10px 0 0';p.append(a);$('#leads').replaceChildren(t,p)}

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
  if(!todo.length)$('#restock').replaceChildren(el('p','empty','ยังไม่มีของที่ต้องเติม <i data-ic="check"></i>'));
  else{const t=el('table','tlist');t.innerHTML='<thead><tr><th>รายการ</th><th class="n">คงเหลือ</th><th>สถานะ</th><th class="hide-s">หมวด</th></tr></thead>';const tb=el('tbody');
    todo.forEach(r=>{const tr=el('tr'),s=el('td'),i=el('i','dot');const k=r.st==='out'||r.st==='low'?r.st:'none';i.style.background=SK[k][1];s.append(i,(r.st==='out'||r.st==='low'?SK[r.st][0]:'')+(r.needed?(r.st==='out'||r.st==='low'?' · ':'')+'ต้องการ':''));
      tr.append(el('td',null,r.name),el('td','n',`${nf(r.qty)} ${r.unit}`),s,el('td','hide-s',r.category||'-'));tb.append(tr)});
    const a=el('a',null,'ไปที่หน้าสต็อก →');a.href='../stock/';const p=el('p');p.style.margin='10px 0 0';p.append(a);t.append(tb);$('#restock').replaceChildren(t,p)}
}
let rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(D.loaded)render()},200)});
if(D.key){showApp();load().then(()=>{if(D.key){poll();VERIFY.load().then(render,render);if(typeof COVERED!=='undefined')COVERED.load(API_URL,D.key).then(render,render)}})}else showLogin();

const ICON_FULL='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',ICON_CLOSE='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
/* แผนที่เต็มจอ: ซ่อนส่วนอื่นทั้งหมด เหลือปุ่ม <i data-ic="layers"></i> (ชั้นข้อมูล) กับ <i data-ic="close"></i> · ปุ่มย้อนกลับของมือถือ/Esc = ออก */
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
  const sync=()=>{const dark=root.dataset.theme==='dark';b.innerHTML=ic(dark?'sun':'moon');b.setAttribute('aria-pressed',String(dark));
    const t=dark?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด';b.setAttribute('aria-label',t);b.title=t;
    const mc=document.querySelector('meta[name=theme-color]');if(mc)mc.content=dark?'#0F1222':'#F2F3F7'};
  b.addEventListener('click',()=>{const dark=root.dataset.theme!=='dark';if(dark)root.dataset.theme='dark';else delete root.dataset.theme;
    try{localStorage.setItem('uh_theme',dark?'dark':'light')}catch(e){}sync();
    let base='road';try{base=localStorage.getItem('uh_base')||'road'}catch(e){}
    if(M.map&&base!=='sat')setBase(dark?'dark':'road');
    if(D.loaded)render()});
  sync()})();
if(typeof VERIFY!=='undefined')VERIFY.onUpdate=()=>render();
$('#sumbox').addEventListener('click',e=>{const b=e.target.closest('[data-cst]');if(b)location.href='../../central.html'});
