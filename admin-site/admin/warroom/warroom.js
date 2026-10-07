/* War Room: จอศูนย์บัญชาการ · ภาพรวมสถานการณ์ในจอเดียว (เหมาะกับจอใหญ่/โปรเจกเตอร์)
   ข้อมูล: เคส Help Me (หลัก) + เคสในระบบ · ทีม/ตำแหน่งสด (roster) · SOS/สายเข้า/แชท (chat_threads) · ประกาศกรมอุตุฯ (news)
   อัปเดตเอง: เคส 30 วิ · ทีม/แจ้งเตือน 15 วิ · ประกาศ 10 นาที */
const W={cases:[],own:[],roster:[],live:[],threads:[],alerts:{sos:[],calls:[]},warn:[],map:null,lc:null,lt:null,fitted:false,at:0};
const sev=c=>Math.min(3,Math.max(1,Number(c.urgency)||1));
const URG={3:'วิกฤต',2:'เร่งด่วน',1:'ปกติ'};
const ST={ready:'พร้อม',out:'ออกงาน',rest:'พัก'};
const hasPin=c=>c.lat!==''&&c.lat!=null&&isFinite(+c.lat)&&isFinite(+c.lng)&&+c.lat!==0;
const today0=()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime()};
const mins=t=>t?Math.max(0,Math.round((Date.now()-t)/60000)):null;
const waitTxt=t=>{const m=mins(t);if(m==null)return '';if(m<60)return m+' นาที';const h=Math.floor(m/60);return h<24?h+' ชม. '+(m%60)+' นาที':Math.floor(h/24)+' วัน'};
const vol=c=>String(c.volunteer||'').replace(/^'/,'').trim();
const photos=c=>Array.isArray(c.photos)?c.photos.filter(id=>/^[-\w]{25,}$/.test(id)):[];

/* ---------- ข้อมูล ---------- */
async function loadCases(){
  const [h,o]=await Promise.all([apiGet({action:'helpme_cases'}).catch(()=>null),apiGet({action:'list'}).catch(()=>null)]);
  const hm=h&&h.ok?h.cases:[],own=o&&o.cases?o.cases:[],ids=new Set(hm.map(c=>String(c.id)));
  // เคสในระบบที่ไม่ใช่สำเนาของเคส Help Me (สำเนามีรหัสเดียวกัน)
  W.cases=hm.map(c=>({...c,needs:c.needs||[],src:'hm'})).concat(own.filter(c=>!ids.has(String(c.id))).map(c=>({...c,needs:c.needs||[],src:'own'})));
  W.at=Date.now();
}
async function loadTeams(){
  const [r,t]=await Promise.all([apiGet({action:'roster'}).catch(()=>null),apiGet({action:'chat_threads'}).catch(()=>null)]);
  if(r&&r.ok){W.roster=r.roster||[];W.live=r.live||[]}
  if(t&&t.ok){W.threads=t.threads||[];W.alerts=t.alerts||{sos:[],calls:[]}}
}
async function loadWarn(){try{const n=await apiGet({action:'news'});if(n&&n.ok)W.warn=n.warnings||[]}catch(e){}}

/* ---------- วาด ---------- */
function kpis(){
  const act=W.cases.filter(c=>c.status!=='done'),open=act.filter(c=>c.status!=='going'),crit=open.filter(c=>sev(c)===3),going=act.filter(c=>c.status==='going');
  const t0=today0(),doneToday=W.cases.filter(c=>c.status==='done'&&(c.doneAt||c.updatedAt)>=t0);
  const fresh=new Set(W.live.filter(l=>Date.now()-l.updatedAt<10*60e3).map(l=>l.team));
  const ppl=crit.reduce((a,c)=>a+Math.max(1,Number(c.people)||1),0);
  const oldest=open.reduce((m,c)=>Math.min(m,c.createdAt||Infinity),Infinity);
  const k=[[crit.length,'วิกฤต รอช่วย',crit.length?'crit':''],[open.length,'รอช่วยทั้งหมด',open.length>20?'warn':''],[going.length,'กำลังไป / หน้างาน',''],
    [`${fresh.size}<small>/${W.roster.length}</small>`,'ทีมออนไลน์',''],[doneToday.length,'ช่วยแล้ววันนี้','ok'],[ppl,'คนในเคสวิกฤต',ppl?'crit':''],
    [isFinite(oldest)?waitTxt(oldest):'–','เคสรอนานสุด','']];
  $('#kpis').innerHTML=k.map(([v,l,c])=>`<div class="wr-kpi ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
}
function alerts(){
  const sos=W.alerts.sos||[],calls=W.alerts.calls||[],live=W.warn.filter(w=>(!w.start||w.start<=Date.now())&&(!w.end||w.end>=Date.now()));
  const rows=[...sos.map(s=>`<div class="wr-al sos"><b><i data-ic="alert"></i> SOS · ${esc(s.name)}</b><small>${esc(ago(s.sosAt))}${s.phone?` · <a href="tel:${esc(String(s.phone).replace(/[^\d+]/g,''))}">${esc(s.phone)}</a>`:''}${s.lat!=null?` · <button type="button" class="lnk" data-fly="${+s.lat},${+s.lng}">ดูบนแผนที่</button>`:''}</small></div>`),
    ...calls.map(c=>`<div class="wr-al call"><b><i data-ic="phone"></i> ${esc(c.team)} โทรมา</b><small>${esc(c.text)} · ${esc(ago(c.at))}${c.link?` · <a href="${esc(c.link)}" target="_blank" rel="noopener">รับสาย</a>`:''}</small></div>`),
    ...live.map(w=>`<div class="wr-al warn"><b><i data-ic="rain"></i> ${esc(w.title)}</b><small>กรมอุตุฯ · มีผลถึง ${esc(w.end?new Date(w.end).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'-')} · <a href="../news/">อ่าน</a></small></div>`)];
  $('#alerts').innerHTML=rows.length?rows.join(''):'<p class="muted small">ไม่มี SOS / สายเข้า / ประกาศเตือนภัยที่มีผลตอนนี้</p>';
  $('#alerts-card').classList.toggle('hot',!!(sos.length||calls.length));
}
function queue(){
  const q=W.cases.filter(c=>c.status==='open'&&!vol(c)).sort((a,b)=>sev(b)-sev(a)||(a.createdAt||0)-(b.createdAt||0)).slice(0,10);
  $('#queue').innerHTML=q.length?q.map(c=>`<li class="u${sev(c)}"><a href="../../admin.html#${encodeURIComponent(c.id)}">
      <span class="tag">${URG[sev(c)]}</span><b>${esc((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')}</b>${photos(c).length?'<i data-ic="image" class="ph"></i>':''}
      <small>${esc([c.district?'เขต'+c.district:'',(c.people||1)+' คน'].filter(Boolean).join(' · '))} · รอ ${esc(waitTxt(c.createdAt))}${hasPin(c)?'':' · ไม่มีหมุด'}</small></a>
      ${hasPin(c)?`<button type="button" class="lnk" data-fly="${+c.lat},${+c.lng}" aria-label="ดูบนแผนที่"><i data-ic="pin"></i></button>`:''}</li>`).join(''):'<li class="muted">ไม่มีเคสค้างที่ยังไม่มีทีมรับ</li>';
}
function teams(){
  const live=new Map(W.live.map(l=>[l.team,l])),sos=new Set((W.alerts.sos||[]).map(s=>s.name));
  const load=new Map();W.cases.filter(c=>c.status==='going').forEach(c=>{const v=vol(c);if(v)load.set(v,(load.get(v)||0)+1)});
  const rows=W.roster.map(t=>{const l=live.get(t.name),m=l?mins(l.updatedAt):null,on=m!=null&&m<10;return {t,l,m,on,n:load.get(t.name)||0,sos:sos.has(t.name)}})
    .sort((a,b)=>b.sos-a.sos||b.on-a.on||b.n-a.n||a.t.name.localeCompare(b.t.name,'th'));
  $('#teams').innerHTML=rows.length?rows.map(({t,l,m,on,n,sos})=>`<li class="${sos?'sos':on?'on':'off'}"><i class="dot"></i><b>${esc(t.name)}</b>
      <span class="st">${esc(ST[t.status]||t.status||'')}</span>${n?`<span class="busy">${n} เคส</span>`:''}
      <small>${l?(on?'ออนไลน์':'ตำแหน่งเมื่อ '+esc(ago(l.updatedAt))):'ไม่แชร์ตำแหน่ง'}${l&&l.battery!=null?' · แบต '+l.battery+'%':''}</small>
      ${l?`<button type="button" class="lnk" data-fly="${+l.lat},${+l.lng}" aria-label="ดูทีมบนแผนที่"><i data-ic="pin"></i></button>`:''}</li>`).join(''):'<li class="muted">ยังไม่มีทีมในระบบ</li>';
}
function feed(){
  const it=[];
  W.threads.slice(0,12).forEach(t=>{const m=t.last;if(!m)return;it.push({at:m.at,cls:m.kind==='sos'?'sos':m.sender==='team'?'team':'hq',
    html:`<b>${m.sender==='team'?esc(t.team):'ศูนย์ → '+esc(t.team)}</b> ${esc(m.text||(m.lat!=null?'ส่งตำแหน่ง':''))}`})});
  W.cases.filter(c=>Date.now()-(c.createdAt||0)<6*3600e3).forEach(c=>it.push({at:c.createdAt,cls:'new u'+sev(c),html:`<b>เคสใหม่</b> ${esc(URG[sev(c)])} · ${esc((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')}${c.district?' · เขต'+esc(c.district):''}`}));
  W.cases.filter(c=>c.status==='done'&&Date.now()-(c.doneAt||c.updatedAt||0)<6*3600e3).forEach(c=>it.push({at:c.doneAt||c.updatedAt,cls:'done',html:`<b>ช่วยแล้ว</b> ${esc((c.needs||[]).join(', ')||'เคส')}${vol(c)?' · '+esc(vol(c)):''}`}));
  it.sort((a,b)=>(b.at||0)-(a.at||0));
  $('#feed').innerHTML=it.length?it.slice(0,25).map(x=>`<li class="${x.cls}"><time>${esc(new Date(x.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}))}</time><span>${x.html}</span></li>`).join(''):'<li class="muted">ยังไม่มีความเคลื่อนไหวใน 6 ชม.</li>';
}

/* ---------- แผนที่ ---------- */
let leafP=null;
function loadLeaflet(){if(window.L)return Promise.resolve();return leafP||(leafP=new Promise((res,rej)=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='';document.head.append(css);
  const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';s.crossOrigin='';s.onload=res;s.onerror=()=>{leafP=null;rej()};document.head.append(s)}))}
async function drawMap(){
  try{await loadLeaflet()}catch(e){$('#map-note').textContent='โหลดแผนที่ไม่ได้';return}
  if(!W.map){W.map=L.map('wmap',{zoomControl:true,attributionControl:true,preferCanvas:false}).setView([13.75,100.6],11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(W.map);
    W.map.attributionControl.setPrefix(false);W.lc=L.layerGroup().addTo(W.map);W.lt=L.layerGroup().addTo(W.map)}
  W.lc.clearLayers();W.lt.clearLayers();const pts=[],t0=today0(),showDone=$('#mt-done').checked;let nopin=0;
  W.cases.filter(c=>c.status!=='done'||(showDone&&(c.doneAt||c.updatedAt)>=t0)).sort((a,b)=>sev(a)-sev(b)).forEach(c=>{if(!hasPin(c)){if(c.status!=='done')nopin++;return}
    const k=c.status==='done'?'done':c.status==='going'?'going':sev(c)===3?'danger':sev(c)===2?'urgent':'open',ph=photos(c);pts.push([+c.lat,+c.lng]);
    L.marker([+c.lat,+c.lng],{icon:umPin(k,{extra:ph.length?`<span class="pin-thumb"><img src="https://lh3.googleusercontent.com/d/${encodeURIComponent(ph[0])}=w96" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`:''}),zIndexOffset:{danger:1000,urgent:700,open:400,going:200,done:0}[k],keyboard:false})
      .bindTooltip(esc(`${URG[sev(c)]} · ${(c.needs||[]).join(', ')||'ขอความช่วยเหลือ'} · ${c.people||1} คน${vol(c)?' · ทีม '+vol(c):''} · รอ ${waitTxt(c.createdAt)}`),{direction:'top',offset:[0,-4]})
      .on('click',()=>{location.href='../../admin.html#'+encodeURIComponent(c.id)}).addTo(W.lc)});
  const sos=new Set((W.alerts.sos||[]).map(s=>s.name));
  W.live.forEach(l=>{const m=mins(l.updatedAt),stale=m>10,s=sos.has(l.team);
    L.marker([l.lat,l.lng],{icon:L.divIcon({className:'wr-team'+(s?' sos':stale?' stale':''),html:`<i></i><span>${esc(l.team)}</span>`,iconSize:[16,16],iconAnchor:[8,8]}),zIndexOffset:s?3000:2000,keyboard:false})
      .bindTooltip(esc(`${l.team} · ${stale?'ตำแหน่งเมื่อ '+ago(l.updatedAt):'ออนไลน์'}${l.battery!=null?' · แบต '+l.battery+'%':''}${l.speed?' · '+Math.round(l.speed)+' กม./ชม.':''}`),{direction:'top',offset:[0,-8]}).addTo(W.lt);pts.push([l.lat,l.lng])});
  $('#map-note').textContent=nopin?`ไม่มีหมุด ${nopin} เคส`:'';
  // ซูมไปพื้นที่ที่มีเคสหนาแน่น (ไม่ให้หมุดไกล ๆ ไม่กี่จุดทำให้แผนที่ซูมออกทั้งประเทศ)
  if(!W.fitted&&pts.length){const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1],mla=med(pts.map(p=>p[0])),mlo=med(pts.map(p=>p[1]));
    const near=pts.filter(p=>Math.abs(p[0]-mla)<0.7&&Math.abs(p[1]-mlo)<0.7),far=pts.length-near.length;
    W.map.fitBounds(near.length?near:pts,{padding:[30,30],maxZoom:13});W.fitted=true;if(far)$('#map-note').textContent+=(($('#map-note').textContent)?' · ':'')+`นอกพื้นที่หลัก ${far} จุด (ซูมออกเพื่อดู)`}
  setTimeout(()=>W.map.invalidateSize(),60);
}
function render(){kpis();alerts();queue();teams();feed();drawMap();
  $('#status').textContent=`อัปเดต ${new Date(W.at||Date.now()).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · เคส ${W.cases.length} · อัปเดตเองทุก 30 วินาที`;}

/* ---------- เวลา / เต็มจอ / รีเฟรช ---------- */
function clock(){$('#clock').textContent=new Date().toLocaleString('th-TH',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
$('#fs').onclick=()=>{const d=document.documentElement;if(document.fullscreenElement)document.exitFullscreen();else(d.requestFullscreen||d.webkitRequestFullscreen||(()=>{})).call(d)};
document.addEventListener('fullscreenchange',()=>{document.body.classList.toggle('wr-fs',!!document.fullscreenElement);setTimeout(()=>W.map&&W.map.invalidateSize(),200)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-fly]');if(!b||!W.map)return;const [a,o]=b.dataset.fly.split(',').map(Number);W.map.flyTo([a,o],16);$('#wmap').scrollIntoView({block:'nearest',behavior:'smooth'})});
$('#mt-done').onchange=drawMap;
async function full(){$('#refresh').disabled=true;try{await Promise.all([loadCases(),loadTeams()]);render()}finally{$('#refresh').disabled=false}}
$('#refresh').onclick=full;
adminBoot({action:'chat_rev'},'rev',async()=>{document.body.classList.add('warroom');clock();setInterval(clock,1000);
  await Promise.all([loadCases(),loadTeams(),loadWarn()]);render();
  setInterval(async()=>{if(document.hidden)return;await loadTeams();kpis();alerts();teams();feed();drawMap()},15000);
  setInterval(async()=>{if(document.hidden)return;await loadCases();render()},30000);
  setInterval(()=>{if(!document.hidden)loadWarn().then(alerts)},10*60000)});
