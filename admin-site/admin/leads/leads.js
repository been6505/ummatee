/* เคสจากโซเชียล: คัดเคสที่เจอจาก Traffy / โซเชียล (Hermes agent) ก่อนรับเป็นเคสจริง
   - ตัวกรองโพสต์เก่า + มิจฉาชีพ ทำที่ API แล้ว หน้านี้แสดงผลและให้แอดมินตัดสินใจ
   - ทีมใกล้เคส: ทีมที่แชร์ตำแหน่ง (teams_live) · จุดกู้ภัย (places) · องค์กรอื่นที่รับพื้นที่แล้ว (covered) */
const LD={leads:[],live:[],places:[],covered:[],settings:null,pulledAt:null,filter:'new',q:'',sel:null,open:new Set(),loaded:0,map:null,layer:null,marks:{}};
const URG={3:'วิกฤต',2:'เร่งด่วน',1:'ทั่วไป'};
const SRC={traffy:'Traffy Fondue',helpme:'Help Me',facebook:'Facebook',x:'X',tiktok:'TikTok',news:'ข่าว',social:'โซเชียล',hermes:'Hermes'};
const REASON={old_post_before_event:'โพสต์ก่อนเกิดเหตุ',old_post_too_old:'โพสต์เก่าเกินกำหนด',old_post_previous_year:'โพสต์ปีก่อน',money_no_place:'ขอเงินแต่ไม่บอกสถานที่',
  rejected_by_staff:'แอดมินตัดทิ้ง',resolved_at_source:'ปิดเคสแล้วที่ Help Me',duplicate:'ซ้ำกับเคสอื่น',not_people:'ไม่ใช่คนเดือดร้อน',suspicious:'น่าสงสัย',resolved:'ได้รับความช่วยเหลือแล้ว'};
const FLAG={approx_location:'ตำแหน่งโดยประมาณ',asks_money:'ขอเงิน',account_reused:'เลขบัญชีซ้ำเคสอื่น',past_year_text:'อ้างถึงปีเก่า'};
const NEAR_KM=15;
const RISK=f=>/^(asks_money|account_reused|past_year_text)/.test(f); // ธงที่ต้องระวัง (ตำแหน่งโดยประมาณไม่ใช่ความเสี่ยง)
const km=(a,b,c,d)=>{const R=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,h=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const pin=l=>l&&l.lat!=null&&l.lng!=null&&isFinite(+l.lat)&&isFinite(+l.lng);
const sev=l=>Math.min(3,Math.max(1,Number(l.urgency)||1));
/* วันที่ในชีตพื้นที่มอบแล้วมีหลายรูปแบบ: 2026-10-03 · 3/10/2569 · 3/10/69 (พ.ศ. 2 หลัก) · 3/10/26 (ค.ศ. 2 หลัก) */
function covDate(s){s=String(s||'').trim();if(!s)return null;let t=Date.parse(s);if(isFinite(t)&&/^\d{4}-/.test(s))return t;
  const m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(!m)return null;let y=+m[3];if(y<100)y+=y>=50?2500:2000;if(y>2400)y-=543;return Date.UTC(y,+m[2]-1,+m[1])-7*3600e3}

async function loadAll(){
  $('#sync').textContent='กำลังโหลด…';
  try{const [l,t,p,c]=await Promise.all([apiGet({action:'leads'}),apiGet({action:'teams'}).catch(()=>null),apiGet({action:'places'}).catch(()=>null),apiGet({action:'covered'}).catch(()=>null)]);
    if(l&&l.ok){LD.leads=l.leads||[];LD.settings=l.settings;LD.pulledAt=l.pulledAt}
    if(t&&t.ok)LD.live=t.teams||[];
    if(p&&p.ok)LD.places=(p.places||[]).filter(x=>x.type==='rescue');
    if(c&&c.ok)LD.covered=(c.items||[]).filter(pin);
    LD.loaded=Date.now();render()}
  catch(e){$('#sync').textContent='โหลดไม่สำเร็จ'}}
$('#refresh').addEventListener('click',loadAll);
setInterval(()=>{if(ADM.key&&!document.hidden)loadAll()},90000);

function nearby(l){
  if(!pin(l))return null;
  const d=x=>km(+l.lat,+l.lng,+x.lat,+x.lng);
  const live=LD.live.map(t=>({t,km:d(t)})).filter(x=>x.km<=NEAR_KM).sort((a,b)=>a.km-b.km).slice(0,3);
  const places=LD.places.map(p=>({p,km:d(p)})).filter(x=>x.km<=NEAR_KM).sort((a,b)=>a.km-b.km).slice(0,3);
  const cov=LD.covered.map(c=>({c,km:d(c),t:covDate(c.date)})).filter(x=>x.km<=3).sort((a,b)=>a.km-b.km).slice(0,3);
  return {live,places,cov}}

function card(l){
  const n=nearby(l),flags=(l.flags||[]).map(f=>f.split(':')[0]),st=l.status;
  const head=[`<span class="urg urg-${sev(l)}">${URG[sev(l)]}</span>`,`<span class="src">${esc(SRC[l.source]||l.source)}</span>`,
    ...flags.map(f=>RISK(f)?`<span class="flag">⚠️ ${esc(FLAG[f]||f)}</span>`:`<span class="src">📍 ${esc(FLAG[f]||f)}</span>`),
    st==='rejected'?`<span class="rej">ตัดทิ้ง · ${esc(REASON[l.reason]||l.reason||'')}</span>`:'',
    st==='accepted'?`<span class="acc">✓ เป็นเคส #${esc(l.caseId)}</span>`:'',
    `<small>โพสต์ ${esc(ago(l.postedAt))}</small>`].join('');
  const where=[l.address,l.district?'เขต'+l.district:''].filter(Boolean).join(' · ');
  const near=n?[
    n.live.length?`<div><b>ทีมที่แชร์ตำแหน่ง</b>${n.live.map(x=>`<div class="row">🟢 ${esc(x.t.team)} <span class="km">${x.km.toFixed(1)} กม. · ${esc(ago(x.t.updatedAt))}</span>${x.t.caseId?' <span class="km">(ถือเคสอยู่)</span>':''}</div>`).join('')}</div>`:'',
    n.places.length?`<div><b>จุดกู้ภัยใกล้สุด</b>${n.places.map(x=>`<div class="row">🚑 ${esc(x.p.name)} <span class="km">${x.km.toFixed(1)} กม.</span>${x.p.phone?` <a href="tel:${esc(String(x.p.phone).replace(/[^\d+]/g,''))}" onclick="event.stopPropagation()">${esc(x.p.phone)}</a>`:''}</div>`).join('')}</div>`:'',
    n.cov.length?`<div><b>องค์กรอื่นที่ลงพื้นที่ใกล้ ๆ</b>${n.cov.map(x=>`<div class="row">🤝 ${esc(x.c.org)} <span class="km">${x.km.toFixed(1)} กม. · ${esc(x.c.date||'')}</span>${x.t&&l.postedAt&&x.t<l.postedAt-12*3600e3?' <span class="before">ไปก่อนโพสต์นี้ — ยังไม่นับว่าช่วยแล้ว</span>':''}</div>`).join('')}</div>`:'',
  ].filter(Boolean).join('')||'<span class="muted">ไม่พบทีมหรือจุดกู้ภัยในระยะ '+NEAR_KM+' กม.</span>':'<span class="muted">ไม่มีพิกัด — เปิดโพสต์ต้นทางเพื่อหาที่อยู่</span>';
  const act=st==='new'?`<select data-urg="${esc(l.id)}" aria-label="ระดับความเร่งด่วน">${[3,2,1].map(u=>`<option value="${u}" ${u===sev(l)?'selected':''}>${URG[u]}</option>`).join('')}</select>
      <button class="btn primary sm" data-accept="${esc(l.id)}">✓ รับเป็นเคส</button>
      <select data-rej="${esc(l.id)}" aria-label="ตัดทิ้งเพราะ"><option value="">✕ ตัดทิ้งเพราะ…</option><option value="duplicate">ซ้ำกับเคสอื่น</option><option value="not_people">ไม่ใช่คนเดือดร้อน</option><option value="resolved">ได้รับความช่วยเหลือแล้ว</option><option value="suspicious">น่าสงสัย / มิจฉาชีพ</option><option value="rejected_by_staff">อื่น ๆ</option></select>`
    :st==='rejected'?`<button class="btn ghost sm" data-reopen="${esc(l.id)}">↩ คืนเข้าคิว</button>`
    :`<a href="../../admin.html#${esc(l.caseId)}">เปิดเคส #${esc(l.caseId)} →</a>`;
  return `<article class="lead u${sev(l)} st-${esc(st)}${LD.sel===l.id?' sel':''}${LD.open.has(l.id)?' open':''}" data-id="${esc(l.id)}">
    <div class="l-h">${head}</div>
    <h3>${esc(l.title||'(ไม่มีหัวข้อ)')}</h3>
    <div class="l-m">${where?`<span>📍 ${esc(where)}</span>`:''}${l.people?`<span>👥 ${esc(l.people)}</span>`:''}${l.names&&l.names.length?`<span>🙍 ${esc(l.names.join(', '))}</span>`:''}${l.phone?`<span>☎ ${String(l.phone).split(/\s*,\s*/).map(p=>`<a href="tel:${esc(p.replace(/[^\d+]/g,''))}" onclick="event.stopPropagation()">${esc(p)}</a>`).join(', ')}</span>`:''}</div>
    ${l.needs&&l.needs.length?`<div class="l-needs">${l.needs.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
    ${l.text&&l.text!==l.title?`<div class="l-text">${esc(l.text)}</div>`:''}
    <div class="near">${near}</div>
    <div class="l-act">${act}<span class="ld-sp"></span><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">โพสต์ต้นทาง ↗</a>${pin(l)?`<a href="https://www.google.com/maps?q=${+l.lat},${+l.lng}" target="_blank" rel="noopener" onclick="event.stopPropagation()">นำทาง ↗</a>`:''}</div>
  </article>`}

function visible(){const q=LD.q;return LD.leads.filter(l=>(LD.filter==='all'||l.status===LD.filter)&&(!q||[l.title,l.text,l.address,l.district,(l.needs||[]).join(' '),(l.names||[]).join(' '),l.id].join(' ').toLowerCase().includes(q)))
  .sort((a,b)=>LD.filter==='new'?(sev(b)-sev(a))||(b.postedAt-a.postedAt):(b.updatedAt-a.updatedAt))}

function render(){
  $('#sync').textContent=LD.loaded?'อัปเดต '+new Date(LD.loaded).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'';
  const c=s=>LD.leads.filter(l=>l.status===s).length,nw=LD.leads.filter(l=>l.status==='new');
  $('#stats').innerHTML=[['รอคัด',nw.length,''],['วิกฤตรอคัด',nw.filter(l=>sev(l)===3).length,'red'],['ติดธง ⚠️',nw.filter(l=>(l.flags||[]).some(RISK)).length,''],['รับเป็นเคสแล้ว',c('accepted'),'done'],['ตัดทิ้ง',c('rejected'),'']]
    .map(([t,v,k])=>`<div class="stat ${k}"><b>${esc(v)}</b><span>${t}</span></div>`).join('');
  $('#pulled').textContent=LD.pulledAt?'ดึงล่าสุด '+ago(LD.pulledAt):'';
  if(LD.settings){$('#set-start').value=LD.settings.eventStart;$('#set-age').value=LD.settings.maxAgeDays}
  $$('#ld-filter button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.f===LD.filter)));
  const v=visible();
  $('#list').innerHTML=v.length?v.slice(0,200).map(card).join(''):`<p class="empty">${LD.filter==='new'?'ไม่มีเคสรอคัด<br><small>กด "ดึงเคสใหม่" หรือรอ Hermes ส่งเคสเข้ามา</small>':'ไม่มีรายการ'}</p>`;
  drawMap(v)}

function drawMap(v){
  if(!window.L)return;
  if(!LD.map){LD.map=L.map('lmap').setView([13.79,100.68],11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(LD.map);LD.layer=L.layerGroup().addTo(LD.map)}
  LD.layer.clearLayers();LD.marks={};const pts=[];
  LD.covered.forEach(c=>L.circleMarker([+c.lat,+c.lng],{radius:6,color:'#7b3fc4',weight:2,fillOpacity:.35}).bindTooltip(esc(c.org+' · '+(c.area||'')+' · '+(c.date||''))).addTo(LD.layer));
  LD.places.forEach(p=>L.circleMarker([+p.lat,+p.lng],{radius:6,color:'#1F2A5E',weight:2,fillColor:'#1F2A5E',fillOpacity:.8}).bindTooltip(esc(p.name)).addTo(LD.layer));
  LD.live.forEach(t=>L.marker([+t.lat,+t.lng],{icon:L.divIcon({className:'',iconSize:null,html:`<span class="ltm" style="--c:#2E9E57">🟢 ${esc(t.team)}</span>`}),zIndexOffset:500}).bindTooltip(esc(t.team+' · '+ago(t.updatedAt))).addTo(LD.layer));
  v.filter(pin).forEach(l=>{const m=L.marker([+l.lat,+l.lng],{icon:L.divIcon({className:'',iconSize:[22,22],iconAnchor:[11,11],html:`<div class="lpin u${sev(l)}${LD.sel===l.id?' sel':''}"></div>`}),zIndexOffset:sev(l)*100})
    .bindTooltip(esc(URG[sev(l)]+' · '+(l.title||'')).slice(0,120)).on('click',()=>select(l.id,false)).addTo(LD.layer);LD.marks[l.id]=m;pts.push([+l.lat,+l.lng])});
  if(pts.length&&!LD.fitted){LD.map.fitBounds(pts,{padding:[30,30],maxZoom:14});LD.fitted=true}}

function select(id,fly){LD.sel=id;render();const m=LD.marks[id];if(m&&fly)LD.map.flyTo(m.getLatLng(),Math.max(LD.map.getZoom(),14),{duration:.5});
  if(!fly)document.querySelector(`.lead[data-id="${id}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'})}

$('#list').addEventListener('click',async e=>{
  const b=e.target.closest('button');const art=e.target.closest('.lead');
  if(b&&b.dataset.accept){const id=b.dataset.accept,u=$(`select[data-urg="${id}"]`)?.value;b.disabled=true;
    try{let r=await apiPost({action:'lead_decide',id,decision:'accept',urgency:u,by:staffName()});
      if(r&&r.error==='flagged'){if(!confirm('เคสนี้ติดธง: '+r.flags.map(f=>FLAG[f.split(':')[0]]||f).join(', ')+'\nตรวจกับแหล่งที่สองแล้ว และยืนยันจะรับเป็นเคส?')){b.disabled=false;return}
        r=await apiPost({action:'lead_decide',id,decision:'accept',urgency:u,by:staffName(),confirmRisk:true})}
      if(r&&r.ok){toast('รับเป็นเคส #'+r.caseId+' แล้ว',true);loadAll()}else{toast('ไม่สำเร็จ: '+(r&&r.error||''));b.disabled=false}}catch(err){b.disabled=false}return}
  if(b&&b.dataset.reopen){const r=await apiPost({action:'lead_decide',id:b.dataset.reopen,decision:'reopen',by:staffName()});if(r&&r.ok){toast('คืนเข้าคิวแล้ว',true);loadAll()}return}
  if(e.target.closest('select,a'))return;
  if(art){const id=art.dataset.id;LD.open.has(id)?LD.open.delete(id):LD.open.add(id);select(id,true)}});
$('#list').addEventListener('change',async e=>{const s=e.target.closest('select[data-rej]');if(!s||!s.value)return;
  const r=await apiPost({action:'lead_decide',id:s.dataset.rej,decision:'reject',reason:s.value,by:staffName()});
  if(r&&r.ok){toast('ตัดทิ้งแล้ว',true);loadAll()}else toast('ไม่สำเร็จ: '+(r&&r.error||''))});
$('#ld-filter').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;LD.filter=b.dataset.f;LD.fitted=false;render()});
$('#ld-q').addEventListener('input',e=>{LD.q=e.target.value.trim().toLowerCase();render()});
$('#pull').addEventListener('click',async()=>{const b=$('#pull');b.disabled=true;b.textContent='กำลังดึง…';
  try{const r=await apiPost({action:'lead_pull'});
    if(r&&r.ok){toast(`ดึงแล้ว: ใหม่ ${r.added} · ตัดทิ้ง ${r.rejected} · มีอยู่แล้ว ${r.duplicate}${r.closed?` · Help Me ปิดแล้ว ${r.closed}`:''}`,true);[['Traffy',r.traffy],['Help Me',r.helpme]].forEach(([n,x])=>{if(x&&!x.ok)toast(n+' ดึงไม่สำเร็จ: '+(x.error||''))})}else toast('ดึงไม่สำเร็จ: '+(r&&r.error||''));
    await loadAll()}finally{b.disabled=false;b.textContent='⤓ ดึงเคสใหม่ (Traffy + Help Me)'}});
$('#set-btn').addEventListener('click',()=>{const f=$('#settings');f.hidden=!f.hidden;$('#set-btn').setAttribute('aria-expanded',String(!f.hidden))});
$('#settings').addEventListener('submit',async e=>{e.preventDefault();
  const r=await apiPost({action:'lead_settings',eventStart:$('#set-start').value,maxAgeDays:$('#set-age').value});
  if(r&&r.ok){LD.settings=r.settings;toast('บันทึกตัวกรองแล้ว (ใช้กับเคสที่ดึงต่อจากนี้)',true)}else toast('บันทึกไม่สำเร็จ')});

adminBoot({action:'leads'},'leads',r=>{LD.leads=r.leads||[];LD.settings=r.settings;LD.pulledAt=r.pulledAt;render();loadAll()});
