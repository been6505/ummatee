/* UMMATEE ช่วยเหลือฉุกเฉิน — แอปหลัก */
const API_URL='https://script.google.com/macros/s/AKfycbyWeVDhToFJntjTGHprDEByEfRFdSbOidlR7QhJ6xG1bz7co2gCRkTGIoKDI9tJqGkWTw/exec';
const REFRESH_MS=30000,QUEUE_MS=20000;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},set(k,v){try{v==null||v===''?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}},
  json(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},put(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LEVEL_TH={ankle:'ข้อเท้า',knee:'เข่า',waist:'เอว',chest:'อก',roof:'มิดหัว'};
const STATUS_TH={open:'รอช่วย',going:'กำลังไป',done:'ช่วยแล้ว'};
function iconify(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{if(el.dataset.iconDone)return;el.insertAdjacentHTML('afterbegin',ic(el.dataset.icon));el.dataset.iconDone='1'})}
function toast(msg,opt={}){const t=document.createElement('div');t.className='toast'+(opt.ok?' ok':'');t.setAttribute('role','status');
  t.innerHTML=ic(opt.icon||(opt.ok?'check':'info'))+'<span></span>';t.querySelector('span').textContent=msg;
  if(opt.action){const b=document.createElement('button');b.type='button';b.textContent=opt.action;b.onclick=()=>{opt.onAction&&opt.onAction();t.remove()};t.append(b)}
  $('#toasts').append(t);setTimeout(()=>t.remove(),opt.ms||5000)}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function ago(ts){const t=Number(ts)||Date.parse(ts);if(!t)return '';const m=Math.round((Date.now()-t)/60000);if(m<1)return 'เมื่อสักครู่';if(m<60)return m+' นาทีที่แล้ว';const h=Math.round(m/60);if(h<24)return h+' ชั่วโมงที่แล้ว';return new Date(t).toLocaleDateString('th-TH',{day:'numeric',month:'short'})+' '+new Date(t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})}
const hasPin=c=>c&&c.lat!==''&&c.lat!=null&&c.lng!==''&&c.lng!=null&&!isNaN(+c.lat)&&!isNaN(+c.lng);
const isDanger=c=>Number(c.urgency)===3&&c.status!=='done';
const pinKind=c=>c.status==='done'?'done':c.status==='going'?'going':isDanger(c)?'danger':'open';
const sevOf=c=>Math.min(3,Math.max(1,Number(c.urgency)||1));
/* ความเร่งด่วน 3 ระดับ: ทั่วไป · ปานกลาง · ด่วน (ค่าที่ส่งเข้าชีตยังเป็นข้อความเดิม เพื่อให้ Code.gs ใช้ได้เหมือนเดิม) */
const URG_TH={1:'ทั่วไป',2:'ปานกลาง',3:'ด่วน'};
const URG_BY_LABEL={'รอได้':1,'ด่วน ต้องการเร็ว':2,'อันตรายถึงชีวิต ด่วนมาก':3};
function urgChip(c){const v=sevOf(c);return `<span class="urg urg-${v}"><i></i>${URG_TH[v]}</span>`}
function statusChip(c){const k=pinKind(c);const txt=STATUS_TH[c.status]||'รอช่วย';return `<span class="st st-${k}">${esc(txt)}</span>`}

/* ---------- API (POST แบบ text/plain JSON) ---------- */
async function apiPost(body,timeout=20000){const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),timeout);
  try{const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),signal:ctl.signal});return await r.json()}finally{clearTimeout(tm)}}
async function apiGet(params,timeout=20000){const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),timeout);
  try{const r=await fetch(API_URL+'?'+new URLSearchParams(params),{signal:ctl.signal});return await r.json()}finally{clearTimeout(tm)}}

/* ---------- สถานะแอป ---------- */
const S={cases:[],loaded:0,loading:false,volunteer:false,view:null,maps:{},flood:null,teams:[],me:null};
const volKey=()=>store.get('uh_vol_key','');
S.volunteer=!!(volKey()&&store.get('uh_vol_ok',''));

async function loadCases(){
  if(S.loading)return;S.loading=true;$('#sync-status').textContent='กำลังอัปเดต…';
  try{
    const p={action:'list',t:Math.floor(Date.now()/15000)};if(volKey())p.key=volKey();
    const r=await apiGet(p);if(!r||!r.ok)throw new Error(r&&r.error||'list');
    const prev=new Set(S.cases.map(c=>String(c.id)));const first=!S.loaded;
    S.cases=(r.cases||[]).map(c=>({...c,needs:Array.isArray(c.needs)?c.needs:String(c.needs||'').split(/\s*,\s*/).filter(Boolean)}));
    S.loaded=Date.now();
    if(volKey()){const was=S.volunteer;S.volunteer=!!r.volunteer;store.set('uh_vol_ok',r.volunteer?'1':'');if(!r.volunteer&&was){store.set('uh_vol_key','');toast('รหัสอาสาไม่ถูกต้อง')}}
    if(!S.volunteer)store.put('uh_cases_cache',{at:S.loaded,cases:S.cases});
    if(S.volunteer&&!first){const fresh=S.cases.filter(c=>!prev.has(String(c.id))&&c.status==='open');
      fresh.slice(0,3).forEach(c=>toast('เคสใหม่: '+(c.needs||[]).join(', ')+' · '+(c.people||1)+' คน',{icon:'alert',action:'ดูเคส',onAction:()=>openCase(c.id),ms:9000}))}
    $('#sync-status').textContent='อัปเดต '+new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  }catch(e){
    if(!S.cases.length){const c=store.json('uh_cases_cache',null);if(c&&c.cases){S.cases=c.cases;}}
    $('#sync-status').textContent=navigator.onLine?'เชื่อมต่อไม่ได้ · ลองใหม่อัตโนมัติ':'ไม่มีสัญญาณ';
  }finally{S.loading=false;renderAll()}
}
function renderAll(){
  $('#live-badge').hidden=!(S.loaded&&Date.now()-S.loaded<REFRESH_MS*3);
  drawPins('home');drawPins('map');renderList();$('#all-count').textContent=S.loaded?S.cases.length+' เคส':'';renderMyReq();renderVol();
  if(S.view==='detail'&&S.detailId)renderDetail(false);
  if(typeof tripRefresh==='function')tripRefresh();
}

/* ---------- เปลี่ยนหน้า ---------- */
function go(view,push=true){
  if(view===S.view&&view!=='detail'){return}
  $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
  S.view=view;document.body.classList.toggle('in-form',view==='form');
  $$('.tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.go===(view==='detail'?'map':view==='sent'||view==='form'?'home':view)));
  $('#layer-menu').hidden=true;
  if(push&&location.hash!=='#'+view)history.pushState({view},'', '#'+view);
  if(view==='home')ensureMap('home');
  if(view==='map')ensureMap('map');
  if(view==='form')ensureFormMap();
  if(view!=='detail'&&S.detailMap){S.detailMap.remove();S.detailMap=null}
  window.scrollTo(0,0);
  setTimeout(()=>Object.values(S.maps).forEach(m=>m&&m.invalidateSize()),60);
}
addEventListener('popstate',()=>{const v=(location.hash||'#home').slice(1);go(['home','map','emergency','form','detail','sent'].includes(v)?v:'home',false)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b){e.preventDefault();go(b.dataset.go)}});

/* ---------- แผนที่หลัก ---------- */
const PIN_LAYER={};
async function ensureMap(which){
  if(S.maps[which]){S.maps[which].invalidateSize();return S.maps[which]}
  const el=$(which==='home'?'#home-map':'#cases-map');
  try{await loadLeaflet()}catch(e){el.innerHTML='<p class="empty">โหลดแผนที่ไม่สำเร็จ · ตรวจอินเทอร์เน็ต</p>';return null}
  if(S.maps[which])return S.maps[which];
  const m=makeMap(el,{zoom:11});S.maps[which]=m;PIN_LAYER[which]=L.layerGroup().addTo(m);
  m.on('baselayerchange',()=>{});
  drawPins(which);if(store.get('uh_lay_flood',''))toggleFlood(true);if(store.get('uh_lay_teams',''))toggleTeams(true);
  if(which==='map'&&typeof drawTrip==='function')drawTrip();
  return m;
}
let fitted={};
function drawPins(which){
  const m=S.maps[which],lg=PIN_LAYER[which];if(!m||!lg)return;lg.clearLayers();
  const list=which==='home'?S.cases.filter(c=>c.status!=='done'):filteredCases();
  const pts=[];
  list.filter(hasPin).forEach(c=>{const k=pinKind(c);pts.push([+c.lat,+c.lng]);
    L.marker([+c.lat,+c.lng],{icon:pinIcon(k),zIndexOffset:k==='danger'?1000:k==='open'?500:0,title:(c.needs||[]).join(', ')}).bindPopup(()=>popupHtml(c)).addTo(lg)});
  if(!fitted[which]&&pts.length){m.fitBounds(pts,{padding:[60,60],maxZoom:14});fitted[which]=true}
}
function popupHtml(c){
  const addr=[c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ');
  const tel=String(c.phone||'').replace(/[^\d+]/g,'');
  return `<div class="pop">${c.status!=='done'?urgChip(c)+' ':''}${statusChip(c)}<br><b>${esc((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')}</b> · ${esc(c.people||1)} คน`+
    (c.level?`<br>ระดับน้ำ: ${esc(LEVEL_TH[c.level]||c.level)}`:'')+(addr?`<br>${esc(addr)}`:'')+
    ((c.name||c.phone)?`<br>${c.name?esc(c.name)+' ':''}${c.phone?(S.volunteer&&tel.length>=9?`<a href="tel:${esc(tel)}">${esc(c.phone)}</a>`:esc(c.phone)):''}`:'')+
    `<div class="pop-act"><a href="#" data-open="${esc(c.id)}">ดูรายละเอียด</a>`+
    (S.volunteer&&c.status!=='done'&&hasPin(c)?` · <a href="#" data-trip="${esc(c.id)}">${typeof tripIndex==='function'&&tripIndex(c.id)>=0?'อยู่ในแผนแล้ว':'+ แผนเดินทาง'}</a>`:'')+`</div></div>`;
}
document.addEventListener('click',e=>{const a=e.target.closest('[data-open]');if(a){e.preventDefault();openCase(a.dataset.open)}
  const t=e.target.closest('[data-trip]');if(t){e.preventDefault();tripToggle(t.dataset.trip);t.textContent=tripIndex(t.dataset.trip)>=0?'อยู่ในแผนแล้ว':'+ แผนเดินทาง'}});

/* เลเยอร์ / ตำแหน่งของฉัน */
let layerFor=null;
document.addEventListener('click',e=>{
  const f=e.target.closest('.fab[data-act]');
  if(f){const which=S.view==='map'?'map':'home';
    if(f.dataset.act==='layers'){const menu=$('#layer-menu');if(!menu.hidden&&layerFor===which){menu.hidden=true;return}layerFor=which;const r=f.getBoundingClientRect();
      menu.style.top=Math.min(r.bottom+8,innerHeight-260)+'px';menu.style.right=(innerWidth-r.right)+'px';menu.hidden=false;
      const cur=(S.maps[which]&&S.maps[which].currentBase)||'road';$$('#layer-menu [data-base]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.base===cur)));}
    else locateMe(which,f);return}
  const bb=e.target.closest('#layer-menu [data-base]');
  if(bb){Object.values(S.maps).forEach(m=>m&&m.setBase(bb.dataset.base));if(S.formMap)S.formMap.setBase(bb.dataset.base);$('#layer-menu').hidden=true;return}
  if(!e.target.closest('#layer-menu'))$('#layer-menu').hidden=true;
});
async function locateMe(which,btn){
  const m=await ensureMap(which);if(!m)return;btn&&btn.classList.add('on');
  try{const p=await getGPS();S.me=p;
    Object.entries(S.maps).forEach(([k,mm])=>{if(!mm)return;if(mm._me)mm._me.setLatLng([p.lat,p.lng]);else mm._me=L.marker([p.lat,p.lng],{icon:meIcon(),interactive:false,zIndexOffset:3000}).addTo(mm)});
    m.setView([p.lat,p.lng],Math.max(m.getZoom(),15));
  }catch(e){toast(e.code===1?'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง':'หาตำแหน่งไม่สำเร็จ');btn&&btn.classList.remove('on')}
}
/* ชั้นน้ำท่วมถนนจาก Floodboard */
const FLOOD_COL={blocked:'#D32F2F',risky:'#0F2188',caution:'#6F7AB8',ok:'#9FA6CF'};
async function toggleFlood(on){store.set('uh_lay_flood',on?'1':'');$('#lay-flood').checked=on;
  Object.values(S.maps).forEach(m=>{if(m&&m._flood){m._flood.remove();m._flood=null}});if(!on)return;
  try{if(!S.flood){const r=await fetch('https://www.floodboard.org/api/export/roads.geojson');S.flood=await r.json()}
    Object.values(S.maps).forEach(m=>{if(!m)return;m._flood=L.geoJSON(S.flood,{interactive:false,style:f=>{const v=(f.properties||{}).verdict||(f.properties||{}).status;return {color:FLOOD_COL[v]||'#6F7AB8',weight:4,opacity:.75}},pointToLayer:(f,ll)=>L.circleMarker(ll,{radius:4,color:FLOOD_COL[(f.properties||{}).verdict]||'#6F7AB8',weight:2})}).addTo(m)});
  }catch(e){toast('โหลดข้อมูลน้ำท่วมไม่สำเร็จ')}}
$('#lay-flood').addEventListener('change',e=>toggleFlood(e.target.checked));
/* ชั้นทีมกู้ภัย (ตำแหน่งปัดเศษสำหรับคนทั่วไป) */
async function toggleTeams(on){store.set('uh_lay_teams',on?'1':'');$('#lay-teams').checked=on;
  Object.values(S.maps).forEach(m=>{if(m&&m._teams){m._teams.remove();m._teams=null}});if(!on)return;
  try{const p={action:'teams'};if(S.volunteer)p.key=volKey();const r=await apiGet(p);S.teams=(r&&r.teams)||[];
    Object.values(S.maps).forEach(m=>{if(!m)return;m._teams=L.layerGroup(S.teams.filter(t=>t.lat&&t.lng).map(t=>L.marker([+t.lat,+t.lng],{icon:L.divIcon({className:'team-pin',html:'<span>'+ic('shield')+'</span>'+(t.team?'<em>'+esc(t.team)+'</em>':''),iconSize:[30,30],iconAnchor:[15,15]})}))).addTo(m)});
    if(!S.teams.length)toast('ยังไม่มีทีมที่แชร์ตำแหน่ง');
  }catch(e){toast('โหลดตำแหน่งทีมไม่สำเร็จ')}}
$('#lay-teams').addEventListener('change',e=>toggleTeams(e.target.checked));

/* ---------- หน้าแรก ---------- */
$('#type-grid').innerHTML=NEED_TYPES.map(t=>`<button type="button" class="type-btn" data-type="${t.key}">${ic(t.icon)}<span>${t.label}</span></button>`).join('');
$('#type-grid').addEventListener('click',e=>{const b=e.target.closest('[data-type]');if(b)startForm({type:b.dataset.type,gps:true})});
$('#btn-use-gps').addEventListener('click',()=>startForm({gps:true}));
$('#btn-all-cases').addEventListener('click',()=>{FL.status='all';FL.types=[];FL.people=[];FL.level=[];FL.q='';$('#case-search').value='';saveFL();renderFilters();go('map');setSheet(true);applyFilters()});
$('#btn-help').addEventListener('click',()=>{go('map');setSheet(true);if(!S.volunteer){$('#vol-panel').hidden=false;renderVol(true)}});
const openSearch=()=>{$('#search-overlay').hidden=false;$('#search-input').value='';$('#search-list').hidden=true;$('#search-status').textContent='';setTimeout(()=>$('#search-input').focus(),50)};
$('#search-card').addEventListener('click',openSearch);$('#home-search-btn').addEventListener('click',openSearch);
$('#search-cancel').addEventListener('click',()=>{$('#search-overlay').hidden=true});
$('#search-gps').addEventListener('click',()=>{$('#search-overlay').hidden=true;startForm({gps:true})});
geoAttach($('#search-input'),$('#search-list'),it=>{$('#search-overlay').hidden=true;startForm({loc:it})},{status:$('#search-status')});
addEventListener('keydown',e=>{if(e.key==='Escape'){$('#search-overlay').hidden=true;$('#layer-menu').hidden=true}});

/* ---------- คำขอของฉัน + คิวส่งตอนไม่มีสัญญาณ ---------- */
const myReqs=()=>store.json('uh_my_cases',[]);const saveMy=a=>store.put('uh_my_cases',a.slice(-8));
const queue=()=>store.json('uh_queue',[]);const saveQueue=a=>store.put('uh_queue',a);
const TRACK={};
function renderMyReq(){
  const q=queue(),mine=myReqs();const box=$('#my-req'),list=$('#my-req-list');box.hidden=!q.length&&!mine.length;if(box.hidden)return;
  list.replaceChildren();
  q.forEach(x=>list.append(reqRow(x.data,'<span class="st st-queue">รอส่ง · ไม่มีสัญญาณ</span>',null)));
  mine.slice().reverse().forEach(m=>{const c=S.cases.find(c=>String(c.id)===String(m.id))||TRACK[m.id]||{};
    const st=c.status?statusChip({...c,urgency:c.urgency||m.urgency}):'<span class="st st-open">ส่งแล้ว</span>';
    const extra=c.status==='going'&&(c.volunteer||c.team)?'ทีม '+(c.volunteer||'')+' กำลังไป':'';
    list.append(reqRow(m,st,m.id,extra))});
}
function reqRow(d,stHtml,id,extra){const row=document.createElement('div');row.className='req-item';
  row.innerHTML=ic(needIcon((d.needs||[])[0]||''))+'<span><b></b><small></small></span>'+stHtml;
  row.querySelector('b').textContent=(d.needs||[]).join(', ')||'ขอความช่วยเหลือ';
  row.querySelector('small').textContent=[id?'#'+id:'',extra||'',d.address||''].filter(Boolean).join(' · ');
  if(id){const x=document.createElement('button');x.type='button';x.className='x';x.setAttribute('aria-label','ซ่อนคำขอนี้');x.innerHTML=ic('close');x.onclick=()=>{saveMy(myReqs().filter(m=>m.id!==id));renderMyReq()};row.append(x)}
  return row}
async function trackMine(){for(const m of myReqs()){if(!m.token)continue;try{const r=await apiPost({action:'track',id:m.id,clientId:m.clientId||'',token:m.token},12000);if(r&&r.ok&&r.status)TRACK[m.id]={status:r.status,volunteer:r.volunteer,urgency:m.urgency}}catch(e){}}renderMyReq()}
let flushing=false;
async function flushQueue(){
  const q=queue();if(!q.length||flushing||!navigator.onLine)return;flushing=true;
  try{for(const item of q){
      try{const r=await apiPost({action:'create',clientId:item.clientId,...item.data},20000);
        if(r&&r.ok){saveQueue(queue().filter(x=>x.clientId!==item.clientId));saveMy([...myReqs(),{id:r.id,token:r.token,clientId:item.clientId,urgency:r.urgency,needs:item.data.needs,address:item.data.address,at:Date.now()}]);toast('ส่งคำขอที่ค้างไว้แล้ว #'+r.id,{ok:true})}
        else if(r&&r.error==='missing'){saveQueue(queue().filter(x=>x.clientId!==item.clientId))}
      }catch(e){break}}
  }finally{flushing=false;renderMyReq();loadCases()}
}
addEventListener('online',()=>{netbar();flushQueue();loadCases()});addEventListener('offline',netbar);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){flushQueue();loadCases()}});
setInterval(flushQueue,QUEUE_MS);
function netbar(){const n=$('#netbar');if(navigator.onLine){n.hidden=true}else{n.hidden=false;n.innerHTML=ic('wifi')+'ไม่มีสัญญาณ · คำขอจะถูกส่งเองเมื่อออนไลน์'}}

/* ---------- ฟอร์ม ---------- */
const F={needs:new Set(),lat:null,lng:null,addrDirty:false,people:1,step:1,marker:null};
$('#need-grid').innerHTML=NEED_TYPES.map(t=>`<button type="button" class="need-btn" data-need="${t.key}" aria-pressed="false">${ic(t.icon)}<span>${t.label}</span></button>`).join('');
$('#need-grid').addEventListener('click',e=>{const b=e.target.closest('[data-need]');if(!b)return;const k=b.dataset.need;F.needs.has(k)?F.needs.delete(k):F.needs.add(k);b.setAttribute('aria-pressed',String(F.needs.has(k)));markOk('needs')});
function startForm(opt={}){
  resetForm();if(opt.type){F.needs.add(opt.type);$(`[data-need="${opt.type}"]`).setAttribute('aria-pressed','true')}
  go('form');
  if(opt.loc){$('#addr-input').value=opt.loc.label||opt.loc.title;F.addrDirty=true;setPin(opt.loc.lat,opt.loc.lng,true,false)}
  if(opt.gps)useGPS();
}
function resetForm(){
  F.needs.clear();F.lat=F.lng=null;F.addrDirty=false;F.people=1;F.step=1;
  $$('#need-grid [data-need]').forEach(b=>b.setAttribute('aria-pressed','false'));
  ['#addr-input','#phone-in','#name-in','#details-in','#lat-in','#lng-in'].forEach(s=>$(s).value='');
  $('#ppl-out').textContent='1';$$('input[name=level]').forEach(i=>i.checked=false);$('input[name=urg][value="รอได้"]').checked=true;
  $('#addr-status').textContent='';$('#pin-status').textContent='แตะแผนที่เพื่อปักหมุด หรือลากหมุดให้ตรง';
  if(F.marker){F.marker.remove();F.marker=null}
  ['needs','loc','phone'].forEach(markOk);showStep(1);
  const last=store.get('uh_phone','');if(last)$('#phone-in').value=last;
}
async function ensureFormMap(){
  if(S.formMap){setTimeout(()=>S.formMap.invalidateSize(),60);return S.formMap}
  try{await loadLeaflet()}catch(e){$('#form-map').innerHTML='<p class="empty">โหลดแผนที่ไม่ได้ · ใช้ช่องค้นหาที่อยู่หรือกรอกพิกัดเองได้</p>';return null}
  if(S.formMap)return S.formMap;
  S.formMap=makeMap($('#form-map'),{zoom:12});
  S.formMap.on('click',e=>setPin(e.latlng.lat,e.latlng.lng,false,true));
  if(F.lat!=null)setPin(F.lat,F.lng,true,false);
  return S.formMap;
}
async function setPin(lat,lng,pan=true,reverse=true){
  F.lat=+lat;F.lng=+lng;$('#lat-in').value=F.lat.toFixed(6);$('#lng-in').value=F.lng.toFixed(6);markOk('loc');
  $('#pin-status').textContent='ปักหมุดแล้ว · ลากหมุดเพื่อปรับให้ตรง';
  const m=await ensureFormMap();
  if(m){if(F.marker)F.marker.setLatLng([F.lat,F.lng]);else{F.marker=L.marker([F.lat,F.lng],{draggable:true,icon:L.divIcon({className:'form-pin',html:'<span></span>',iconSize:[34,40],iconAnchor:[17,40]})}).addTo(m);
      F.marker.on('dragend',()=>{const p=F.marker.getLatLng();setPin(p.lat,p.lng,false,true)})}
    if(pan)m.setView([F.lat,F.lng],Math.max(m.getZoom(),16))}
  if(reverse&&!F.addrDirty){const t=await geoReverse(F.lat,F.lng);if(t&&!F.addrDirty){$('#addr-input').value=t;$('#addr-status').textContent='เติมที่อยู่จากหมุดให้แล้ว · แก้ได้'}}
}
async function useGPS(){
  const st=$('#addr-status');st.textContent='กำลังหาตำแหน่ง…';
  try{const p=await getGPS();await setPin(p.lat,p.lng,true,true);st.textContent=F.addrDirty?'พบตำแหน่งแล้ว':st.textContent||'พบตำแหน่งแล้ว'}
  catch(e){st.textContent=e.code===1?'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง · ค้นหาที่อยู่หรือแตะแผนที่แทน':'หาตำแหน่งไม่สำเร็จ · ค้นหาที่อยู่หรือแตะแผนที่แทน'}
}
$('#form-gps').addEventListener('click',useGPS);
$('#addr-input').addEventListener('input',()=>{F.addrDirty=!!$('#addr-input').value.trim();if(F.addrDirty)markOk('loc')});
geoAttach($('#addr-input'),$('#addr-list'),it=>{$('#addr-input').value=it.label||it.title;F.addrDirty=true;setPin(it.lat,it.lng,true,false);$('#addr-status').textContent='ปักหมุดตามที่อยู่แล้ว · ลากหมุดปรับได้'},{status:$('#addr-status')});
$('#coord-apply').addEventListener('click',()=>{const a=parseFloat($('#lat-in').value),b=parseFloat($('#lng-in').value);if(isNaN(a)||isNaN(b)||Math.abs(a)>90||Math.abs(b)>180){$('#pin-status').textContent='พิกัดไม่ถูกต้อง';return}setPin(a,b,true,true)});
$('#ppl-minus').addEventListener('click',()=>{F.people=Math.max(1,F.people-1);$('#ppl-out').textContent=F.people});
$('#ppl-plus').addEventListener('click',()=>{F.people=Math.min(999,F.people+1);$('#ppl-out').textContent=F.people});
$('#phone-in').addEventListener('input',()=>markOk('phone'));
function markOk(k){const sec={needs:'#sec-needs',loc:'#sec-loc',phone:'#sec-phone'}[k];$(sec).classList.remove('invalid');$('#err-'+k).hidden=true}
function markBad(k){const sec={needs:'#sec-needs',loc:'#sec-loc',phone:'#sec-phone'}[k];$(sec).classList.add('invalid');$('#err-'+k).hidden=false}
function validate(){const bad=[];
  if(!F.needs.size)bad.push('needs');
  if(!$('#addr-input').value.trim()&&F.lat==null)bad.push('loc');
  const d=$('#phone-in').value.replace(/\D/g,'');if(d.length<9||d.length>12)bad.push('phone');
  bad.forEach(markBad);
  if(bad.length){const sec={needs:'#sec-needs',loc:'#sec-loc',phone:'#sec-phone'}[bad[0]];$(sec).scrollIntoView({behavior:'smooth',block:'center'});const inp=$(sec).querySelector('input');if(inp&&bad[0]!=='needs')setTimeout(()=>inp.focus({preventScroll:true}),400)}
  return !bad.length}
function formData(){
  return {needs:[...F.needs].map(k=>NEED_TYPES.find(t=>t.key===k).value),urgencyLabel:($('input[name=urg]:checked')||{}).value||'รอได้',
    people:F.people,level:($('input[name=level]:checked')||{}).value||'',address:$('#addr-input').value.trim(),
    lat:F.lat!=null?+F.lat.toFixed(6):'',lng:F.lng!=null?+F.lng.toFixed(6):'',phone:$('#phone-in').value.trim(),name:$('#name-in').value.trim(),
    details:$('#details-in').value.trim(),website:$('.hp').value}}
function showStep(n){F.step=n;$('#step1').hidden=n!==1;$('#step2').hidden=n!==2;$('#form-step').textContent=n+'/2';
  $('#form-title').textContent=n===1?'ขอความช่วยเหลือ':'ตรวจก่อนส่ง';
  const b=$('#form-next');b.className='btn '+(n===1?'btn-blue':'btn-green');b.textContent=n===1?'ถัดไป':'ส่งคำขอ';b.disabled=false;window.scrollTo(0,0)}
function renderReview(d){
  const rows=[['list','ต้องการ',d.needs.join(', ')],['pin','ที่อยู่',[d.address,d.lat!==''?`(${d.lat}, ${d.lng})`:''].filter(Boolean).join(' ')],['phone','เบอร์โทร',d.phone],
    ['alert','ความเร่งด่วน',URG_TH[URG_BY_LABEL[d.urgencyLabel]||1]],['users','จำนวนคน',d.people+' คน'],['wave','ระดับน้ำ',LEVEL_TH[d.level]||'ไม่ระบุ'],['user','ชื่อ',d.name||'-'],['note','รายละเอียด',d.details||'-']];
  $('#review').innerHTML=rows.map(([i,k,v])=>`<div class="rv">${ic(i)}<span><small>${k}</small><b>${esc(v)}</b></span></div>`).join('');
}
$('#req-form').addEventListener('submit',async e=>{
  e.preventDefault();
  if(F.step===1){if(!validate())return;renderReview(formData());showStep(2);return}
  const d=formData(),clientId=uid(),btn=$('#form-next');btn.disabled=true;btn.textContent='กำลังส่ง…';store.set('uh_phone',d.phone);
  const queueIt=()=>{saveQueue([...queue(),{clientId,data:d,at:Date.now()}]);sentScreen(null,true)};
  if(!navigator.onLine){queueIt();return}
  try{const r=await apiPost({action:'create',clientId,...d},20000);
    if(r&&r.ok){saveMy([...myReqs(),{id:r.id,token:r.token,clientId,urgency:r.urgency,needs:d.needs,address:d.address,at:Date.now()}]);sentScreen(r.id,false);loadCases()}
    else if(r&&r.error==='missing'){btn.disabled=false;btn.textContent='ส่งคำขอ';showStep(1);validate()}
    else queueIt();
  }catch(err){queueIt()}
});
function sentScreen(id,queued){
  $('#sent-title').textContent=queued?'บันทึกคำขอไว้แล้ว':'ส่งคำขอแล้ว';
  $('#sent-text').textContent=queued?'ตอนนี้ส่งไม่ได้ (สัญญาณไม่ดี) ระบบจะส่งให้เองเมื่อออนไลน์ ดูสถานะได้ที่หน้าแรก':'ทีมอาสาเห็นคำขอของคุณแล้ว ติดตามสถานะได้ที่หน้าแรก';
  $('#sent-id').textContent=id?'เลขคำขอ #'+id:'';renderMyReq();go('sent');
}
$('#form-back').addEventListener('click',()=>{if(F.step===2)showStep(1);else go('home')});

/* ---------- แผนที่/รายการ ---------- */
const FL=Object.assign({status:'active',types:[],people:[],level:[],q:''},store.json('uh_filters2',{}),{q:''});
const saveFL=()=>store.put('uh_filters2',{status:FL.status,types:FL.types,people:FL.people,level:FL.level});
const STATUS_TABS=[['active','ยังไม่เสร็จ'],['danger','ด่วน'],['open','รอช่วย'],['going','กำลังไป'],['done','ช่วยแล้ว'],['all','ทั้งหมด']];
const PEOPLE_R=[['1-5','1–5 คน'],['6-20','6–20 คน'],['21-99999','มากกว่า 20 คน']];
function renderFilters(){
  $('#status-tabs').innerHTML=STATUS_TABS.map(([k,t])=>`<button type="button" role="tab" data-st="${k}" aria-selected="${FL.status===k}">${t}</button>`).join('');
  $('#type-chips').innerHTML=NEED_TYPES.map(t=>`<button type="button" data-ty="${t.key}" aria-pressed="${FL.types.includes(t.key)}">${ic(t.icon)}${t.label}</button>`).join('');
  $('#more-filter-panel').innerHTML='<h4>จำนวนคน</h4><div class="chips">'+PEOPLE_R.map(([k,t])=>`<label><input type="checkbox" data-pp="${k}" ${FL.people.includes(k)?'checked':''}><span>${t}</span></label>`).join('')+'</div>'+
    '<h4>ระดับน้ำ</h4><div class="chips">'+Object.entries({...LEVEL_TH,none:'ไม่ระบุ'}).map(([k,t])=>`<label><input type="checkbox" data-lv="${k}" ${FL.level.includes(k)?'checked':''}><span>${t}</span></label>`).join('')+'</div>'+
    '<button type="button" class="pill pill-ghost small" id="clear-filter">ล้างตัวกรอง</button>';
  const n=FL.types.length+FL.people.length+FL.level.length;$('#more-filter').lastChild.textContent=n?`ตัวกรองเพิ่ม (${n})`:'ตัวกรองเพิ่ม';
}
$('#status-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-st]');if(!b)return;FL.status=b.dataset.st;saveFL();renderFilters();applyFilters()});
$('#type-chips').addEventListener('click',e=>{const b=e.target.closest('[data-ty]');if(!b)return;const k=b.dataset.ty;FL.types=FL.types.includes(k)?FL.types.filter(x=>x!==k):[...FL.types,k];saveFL();renderFilters();applyFilters()});
$('#more-filter').addEventListener('click',()=>{const p=$('#more-filter-panel');p.hidden=!p.hidden;$('#more-filter').setAttribute('aria-expanded',String(!p.hidden))});
$('#more-filter-panel').addEventListener('change',e=>{const i=e.target;if(i.dataset.pp){FL.people=i.checked?[...FL.people,i.dataset.pp]:FL.people.filter(x=>x!==i.dataset.pp)}if(i.dataset.lv){FL.level=i.checked?[...FL.level,i.dataset.lv]:FL.level.filter(x=>x!==i.dataset.lv)}saveFL();renderFilters();applyFilters()});
$('#more-filter-panel').addEventListener('click',e=>{if(e.target.id==='clear-filter'){FL.types=[];FL.people=[];FL.level=[];FL.status='active';saveFL();renderFilters();applyFilters()}});
let qTimer;$('#case-search').addEventListener('input',()=>{clearTimeout(qTimer);qTimer=setTimeout(()=>{FL.q=srchNorm($('#case-search').value.trim());applyFilters(true)},200)});
function applyFilters(fit){renderList();drawPins('map');if(fit&&FL.q&&S.maps.map){const pts=filteredCases().filter(hasPin).map(c=>[+c.lat,+c.lng]);if(pts.length)S.maps.map.fitBounds(pts,{padding:[60,60],maxZoom:15})}}
/* ค้นหาได้ทุกอย่าง (ชื่อ เบอร์ ที่อยู่ ความต้องการ ฯลฯ) */
function srchNorm(s){s=String(s==null?'':s);try{s=s.normalize('NFC')}catch(e){}return s.replace(/[​-‍﻿]/g,'').replace(/ํ([่-๋]?)า/g,'$1ำ').replace(/^'+/,'').toLowerCase()}
const normDigits=x=>{let d=String(x||'').replace(/\D/g,'');if(d.startsWith('66')&&d.length>=11)d=d.slice(2);return d.replace(/^0+/,'')};
function caseHay(c){const d=Number(c.createdAt)?new Date(Number(c.createdAt)):null;
  return srchNorm([c.id,'#'+c.id,(c.needs||[]).join(' '),c.district,c.district?'เขต'+c.district:'',c.address,c.name,c.phone,c.notes,c.volunteer,STATUS_TH[c.status],c.status!=='done'?URG_TH[sevOf(c)]:'',LEVEL_TH[c.level]||'',c.people?c.people+' คน':'',d?d.toLocaleDateString('th-TH',{day:'numeric',month:'short'}):''].filter(Boolean).join(' '))}
function caseMatches(c,q){const hay=caseHay(c);if(q.length>=3&&hay.replace(/\s+/g,'').includes(q.replace(/\s+/g,'')))return true;const digits=normDigits(c.phone);
  return q.split(/\s+/).every(t=>{if(hay.includes(t))return true;if(!/^\+?[\d-]+$/.test(t))return false;const raw=t.replace(/\D/g,''),d=normDigits(t);if(raw.length<3||!d)return false;return /^(0|\+?66)/.test(t)?digits.startsWith(d):digits.includes(d)})}
function filteredCases(){
  const rank={open:0,going:1,done:2};
  return S.cases.filter(c=>{
    if(FL.q)return caseMatches(c,FL.q);
    if(FL.status==='active'&&c.status==='done')return false;
    if(FL.status==='danger'&&!isDanger(c))return false;
    if(['open','going','done'].includes(FL.status)&&c.status!==FL.status)return false;
    if(FL.types.length){const n=(c.needs||[]).join(' ');if(!FL.types.some(k=>{const t=NEED_TYPES.find(x=>x.key===k);return n.includes(t.value)||n.includes(t.label)}))return false}
    if(FL.people.length){const p=Number(c.people)||1;if(!FL.people.some(r=>{const [a,b]=r.split('-').map(Number);return p>=a&&p<=b}))return false}
    if(FL.level.length&&!FL.level.includes(c.level||'none'))return false;
    return true}).sort((a,b)=>((a.status==='done')-(b.status==='done'))||(sevOf(b)-sevOf(a))||(rank[a.status]-rank[b.status])||((Number(b.createdAt)||0)-(Number(a.createdAt)||0)));
}
function caseCard(c){
  const b=document.createElement('button');b.type='button';b.className='case'+(c.status!=='done'?' u'+sevOf(c):' is-done')+(isDanger(c)?' danger':'');b.dataset.id=c.id;
  const addr=[c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ');
  const needs=c.needs&&c.needs.length?c.needs:['ขอความช่วยเหลือ'];
  const facts=[[ 'users',(c.people||1)+' คน'],c.level&&LEVEL_TH[c.level]?['wave','น้ำ'+LEVEL_TH[c.level]]:null].filter(Boolean);
  b.innerHTML=`<div class="case-top"><span class="case-chips">${c.status!=='done'?urgChip(c):''}${statusChip(c)}</span><span class="case-time">${esc(ago(c.createdAt))}</span></div>
    <div class="case-title"><span class="case-ics">${needs.slice(0,3).map(n=>ic(needIcon(n))).join('')}</span><b>${esc(needs.join(' · '))}</b></div>
    <div class="case-facts">${facts.map(([i,t])=>`<span>${ic(i)}${esc(t)}</span>`).join('')}</div>
    <div class="case-foot"><div class="case-line">${ic('pin')}<span>${esc(addr||'ไม่ระบุที่อยู่')}</span></div>`+
    ((c.name||c.phone)?`<div class="case-line contact">${ic('phone')}<span>${esc([c.name,c.phone].filter(Boolean).join(' · '))}</span></div>`:'')+
    `</div><span class="case-go" aria-hidden="true">${ic('next')}</span>`;
  b.addEventListener('click',()=>openCase(c.id));return b;
}
function renderList(){
  const list=filteredCases(),el=$('#case-list');el.replaceChildren(...list.map(caseCard));
  if(!list.length)el.innerHTML=`<p class="empty">${S.loaded?(FL.q?'ไม่พบเคสที่ค้นหา':'ไม่มีเคสในตัวกรองนี้'):'กำลังโหลด…'}</p>`;
  const txt=FL.q?`พบ ${list.length} เคส (ค้นจากทุกเคส)`:`${list.length} เคส`;$('#case-count').textContent=txt;$('#sheet-count').textContent=txt;
  if(typeof tripBadges==='function')tripBadges();
}
function renderLegend(){$('#legend').innerHTML=`<span><i style="background:var(--red)"></i>ด่วน</span><span><i style="background:var(--blue)"></i>รอช่วย</span><span><i style="background:var(--b-60)"></i>กำลังไป</span><span><i style="background:var(--ok)"></i>ช่วยแล้ว</span>`}
function setSheet(open){const s=$('#list-sheet');s.classList.toggle('open',open);$('#sheet-handle').setAttribute('aria-expanded',String(open))}
$('#sheet-handle').addEventListener('click',()=>setSheet(!$('#list-sheet').classList.contains('open')));
(function(){let y0=null;const h=$('#sheet-handle');h.addEventListener('touchstart',e=>{y0=e.touches[0].clientY},{passive:true});h.addEventListener('touchend',e=>{if(y0==null)return;const dy=e.changedTouches[0].clientY-y0;if(dy<-30)setSheet(true);else if(dy>30)setSheet(false);y0=null},{passive:true})})();

/* ---------- ทีมอาสา ---------- */
function renderVol(forceOpen){
  const sw=$('#vol-switch');sw.classList.toggle('on',S.volunteer);sw.classList.toggle('active',S.volunteer);sw.setAttribute('aria-checked',String(S.volunteer));
  sw.classList.toggle('sharing',!!SHARE.watch);
  $('#vol-label').textContent=S.volunteer?(store.get('uh_team','')||'ทีมอาสา'):'ทีมอาสา';
  const p=$('#vol-panel');if(forceOpen)p.hidden=false;if(p.hidden)return;
  if(p.dataset.mode===(S.volunteer?'v':'p')&&p.children.length)return;p.dataset.mode=S.volunteer?'v':'p';
  if(!S.volunteer){p.innerHTML='<h3>ใส่รหัสทีมอาสา</h3><p class="hint">เพื่อดูเบอร์โทร รับเคส ปิดเคส หรือคืนเคส</p><div class="row"><input id="vol-key" type="password" autocomplete="off" placeholder="รหัสอาสา" aria-label="รหัสอาสา"><button type="button" class="pill pill-blue" id="vol-go">เข้า</button></div>';
    const go2=async()=>{const k=$('#vol-key').value.trim();if(!k)return $('#vol-key').focus();store.set('uh_vol_key',k);store.set('uh_vol_ok','');$('#vol-go').disabled=true;S.loaded=S.loaded;await loadCases();$('#vol-go')&&($('#vol-go').disabled=false);
      if(S.volunteer){toast('เข้าโหมดทีมอาสาแล้ว',{ok:true});p.hidden=true;renderVol()}else if(navigator.onLine)toast('รหัสไม่ถูกต้อง หรือเชื่อมต่อไม่ได้')};
    $('#vol-go').onclick=go2;$('#vol-key').onkeydown=e=>{if(e.key==='Enter')go2()};return}
  p.innerHTML=`<h3>ชื่อทีม</h3><div class="row"><input id="team-in" placeholder="ชื่อทีม / อาสา" value="${esc(store.get('uh_team',''))}" maxlength="40"></div>
    <div class="sep"></div><h3>แชร์ตำแหน่งทีม</h3><p class="hint">ให้ผู้แจ้งเห็นว่าทีมอยู่พื้นที่ไหน (ปัดเศษประมาณ 100 ม.)</p>
    <button type="button" class="pill ${SHARE.watch?'pill-ghost':'pill-green'} full" id="share-btn">${SHARE.watch?'หยุดแชร์ตำแหน่ง':'เริ่มแชร์ตำแหน่ง'}</button>
    <div class="sep"></div><button type="button" class="pill pill-line full" id="vol-out">ออกจากโหมดอาสา</button>`;
  iconify(p);
  $('#team-in').onchange=e=>{store.set('uh_team',e.target.value.trim());renderVol()};
  $('#share-btn').onclick=()=>{SHARE.watch?stopShare():startShare();p.dataset.mode='';renderVol()};
  $('#vol-out').onclick=()=>{stopShare();store.set('uh_vol_key','');store.set('uh_vol_ok','');S.volunteer=false;p.hidden=true;p.dataset.mode='';loadCases()};
}
$('#vol-switch').addEventListener('click',()=>{const p=$('#vol-panel');p.hidden=!p.hidden;p.dataset.mode='';renderVol()});
const SHARE={watch:null,last:0,pos:null};
function startShare(){
  if(!store.get('uh_team','')){toast('ใส่ชื่อทีมก่อนแชร์');$('#team-in')&&$('#team-in').focus();return}
  if(!navigator.geolocation)return toast('อุปกรณ์นี้ไม่รองรับตำแหน่ง');
  SHARE.watch=navigator.geolocation.watchPosition(p=>{SHARE.pos=p.coords;if(Date.now()-SHARE.last>60000)sendPing()},e=>{toast('แชร์ตำแหน่งไม่ได้: '+(e.code===1?'ไม่ได้รับอนุญาต':'หาตำแหน่งไม่ได้'));stopShare()},{enableHighAccuracy:true,maximumAge:20000});
  toast('เริ่มแชร์ตำแหน่งทีมแล้ว',{ok:true});renderVol();
}
async function sendPing(stop){if(!SHARE.pos&&!stop)return;SHARE.last=Date.now();
  try{await apiPost({action:'ping',key:volKey(),team:store.get('uh_team',''),caseId:'',...(stop?{stop:true}:{lat:SHARE.pos.latitude,lng:SHARE.pos.longitude,accuracy:Math.round(SHARE.pos.accuracy||0)})},12000)}catch(e){}}
function stopShare(){if(SHARE.watch!=null){navigator.geolocation.clearWatch(SHARE.watch);SHARE.watch=null;sendPing(true)}renderVol()}
setInterval(()=>{if(SHARE.watch&&SHARE.pos&&Date.now()-SHARE.last>=120000)sendPing()},30000);

/* ---------- รายละเอียดเคส ---------- */
function openCase(id){S.detailId=String(id);renderDetail(true);go('detail')}
$('#detail-back').addEventListener('click',()=>{history.length>1?history.back():go('map')});
function renderDetail(full){
  const c=S.cases.find(x=>String(x.id)===S.detailId);const el=$('#detail');
  if(!c){el.innerHTML='<p class="empty">ไม่พบเคสนี้</p>';return}
  if(!full&&el.dataset.id===S.detailId&&el.dataset.sig===JSON.stringify([c.status,c.volunteer]))return;
  el.dataset.id=S.detailId;el.dataset.sig=JSON.stringify([c.status,c.volunteer]);
  const addr=[c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ');
  const tel=String(c.phone||'').replace(/[^\d+]/g,'');
  const facts=[['ความเร่งด่วน',URG_TH[sevOf(c)]],['จำนวนคน',(c.people||1)+' คน'],['ระดับน้ำ',LEVEL_TH[c.level]||'ไม่ระบุ'],['ความต้องการ',(c.needs||[]).join(', ')||'-'],['แจ้งเมื่อ',ago(c.createdAt)]];
  if(c.name)facts.push(['ผู้ติดต่อ',c.name]);if(c.phone)facts.push(['เบอร์โทร',c.phone]);if(c.volunteer&&c.status!=='open')facts.push(['ทีมที่รับเคส',c.volunteer]);
  el.innerHTML=`<div class="d-map-col">${hasPin(c)?`<div id="detail-map" class="detail-map"></div><div class="coord-row"><span>${ic('pin')} ${(+c.lat).toFixed(6)}, ${(+c.lng).toFixed(6)}</span><button type="button" class="pill pill-ghost small" id="copy-coord" data-icon="copy">คัดลอก</button></div>`:'<p class="hint">ผู้แจ้งไม่ได้ปักหมุด</p>'}</div>
    <div><div class="detail-head">${statusChip(c)}<h2>${esc((c.needs||[]).join(' · ')||'ขอความช่วยเหลือ')}</h2><span class="case-time">#${esc(c.id)}</span></div>
    <section class="card"><h2>ที่อยู่</h2><p>${esc(addr||'ไม่ระบุ')}</p>${S.volunteer&&c.notes?`<h2 class="mt">รายละเอียด</h2><p>${esc(c.notes)}</p>`:''}
    <div class="facts">${facts.map(([k,v])=>`<div class="fact"><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="actions" id="d-actions"></div></section></div>`;
  iconify(el);
  const act=$('#d-actions');
  if(hasPin(c))act.insertAdjacentHTML('beforeend',`<a class="pill pill-blue full" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}">${ic('nav')}นำทางด้วย Google Maps</a>`);
  if(S.volunteer&&tel.length>=9)act.insertAdjacentHTML('beforeend',`<a class="pill pill-green full" href="tel:${esc(tel)}">${ic('phone')}โทรหาผู้แจ้ง</a>`);
  if(S.volunteer&&hasPin(c)&&c.status!=='done'){const tb=document.createElement('button');tb.type='button';tb.className='pill pill-ghost full';const upd=()=>{tb.innerHTML=ic('route')+(tripIndex(c.id)>=0?'อยู่ในแผนเดินทาง (แตะเพื่อเอาออก)':'เพิ่มในแผนเดินทาง')};upd();tb.onclick=()=>{tripToggle(c.id);upd()};act.append(tb)}
  if(S.volunteer){
    const fs=document.createElement('fieldset');fs.className='status-pick';
    fs.innerHTML=`<legend>สถานะเคส (ติ๊กเพื่อเปลี่ยน)</legend><div class="status-opts">${[['open','รอช่วย'],['going','กำลังไป · รับเคส'],['done','ช่วยแล้ว · ปิดเคส']].map(([v,t])=>`<label><input type="radio" name="cst" value="${v}" ${c.status===v?'checked':''}><span>${t}</span></label>`).join('')}</div>
      <input id="d-team" placeholder="ชื่อทีม / อาสา" value="${esc(c.volunteer||store.get('uh_team',''))}" maxlength="40" aria-label="ชื่อทีม">`;
    fs.addEventListener('change',async e=>{if(e.target.name!=='cst')return;const v=e.target.value;if(!v||v===c.status)return;const team=$('#d-team').value.trim();
      if(v==='going'&&!team){toast('ใส่ชื่อทีมก่อนรับเคส');e.target.checked=false;fs.querySelector(`input[value="${c.status}"]`).checked=true;$('#d-team').focus();return}
      if(team)store.set('uh_team',team);fs.disabled=true;
      try{const r=await apiPost({action:'update',key:volKey(),id:c.id,status:v,volunteer:v==='open'?'':team});if(!r||!r.ok)throw new Error(r&&r.error);
        c.status=v;c.volunteer=v==='open'?'':team||c.volunteer;toast(v==='going'?'รับเคสแล้ว':v==='done'?'ปิดเคสแล้ว':'คืนเคสแล้ว',{ok:true});renderDetail(true);loadCases()}
      catch(err){toast('อัปเดตไม่สำเร็จ ลองอีกครั้ง');fs.disabled=false;fs.querySelector(`input[value="${c.status}"]`).checked=true}});
    act.after(fs);
  }else act.insertAdjacentHTML('afterend','<p class="hint">ทีมอาสาที่มีรหัสจะเห็นเบอร์โทรและรับเคสได้ในหน้าแผนที่</p>');
  const cp=$('#copy-coord');if(cp)cp.onclick=()=>{const t=(+c.lat).toFixed(6)+','+(+c.lng).toFixed(6);(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('คัดลอกพิกัดแล้ว',{ok:true})).catch(()=>prompt('คัดลอกพิกัด',t))};
  if(hasPin(c))loadLeaflet().then(()=>{const mel=$('#detail-map');if(!mel)return;if(S.detailMap){S.detailMap.remove()}
    S.detailMap=makeMap(mel,{center:[+c.lat,+c.lng],zoom:16});L.marker([+c.lat,+c.lng],{icon:pinIcon(pinKind(c))}).addTo(S.detailMap);setTimeout(()=>S.detailMap&&S.detailMap.invalidateSize(),250)}).catch(()=>{});
}

/* ---------- แผนการเดินทาง (ทีมอาสา): เคสหนักก่อน · ใกล้สุดก่อน · จัดอัตโนมัติ · นำทาง Google Maps ---------- */
const TRIP={ids:store.json('uh_trip',[]).filter(x=>typeof x==='string').slice(0,25),layer:null,lastPos:null};
const tripSave=()=>TRIP.ids.length?store.put('uh_trip',TRIP.ids):store.set('uh_trip','');
const tripIndex=id=>TRIP.ids.indexOf(String(id));
const tripCases=()=>TRIP.ids.map(id=>S.cases.find(c=>String(c.id)===id)||{id,missing:true});
const tripDist=(a,b)=>{const R=6371,t=Math.PI/180,dl=(b.lat-a.lat)*t,dn=(b.lng-a.lng)*t,x=Math.sin(dl/2)**2+Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x))};
function tripToggle(id){id=String(id);const i=tripIndex(id);if(i>=0)TRIP.ids.splice(i,1);else if(TRIP.ids.length<25)TRIP.ids.push(id);tripSave();tripRefresh()}
function tripMove(i,d){const j=i+d;if(j<0||j>=TRIP.ids.length)return;[TRIP.ids[i],TRIP.ids[j]]=[TRIP.ids[j],TRIP.ids[i]];tripSave();tripRefresh()}
function tripOrigin(){const me=S.me||TRIP.lastPos;if(!S.me&&navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>{TRIP.lastPos={lat:p.coords.latitude,lng:p.coords.longitude}},()=>{},{timeout:10000,maximumAge:120000});return me}
function tripNN(pts,start){const left=pts.slice(),out=[];let cur=start;if(!cur&&left.length){cur=left.shift();out.push(cur)}while(left.length){let bi=0,bd=Infinity;left.forEach((p,i)=>{const d=tripDist(cur,p);if(d<bd){bd=d;bi=i}});cur=left.splice(bi,1)[0];out.push(cur)}return out}
function tripPriority(pts,start){let cur=start,out=[];[3,2,1].forEach(s=>{const tier=pts.filter(p=>p.sev===s);if(!tier.length)return;const o=tripNN(tier,cur);out=out.concat(o);cur=o[o.length-1]});return out}
const tripPts=list=>list.filter(c=>!c.missing&&hasPin(c)).map(c=>({id:String(c.id),lat:+c.lat,lng:+c.lng,sev:sevOf(c),people:Number(c.people)||1}));
function tripApply(order,rest,msg){TRIP.ids=[...order.map(p=>p.id),...rest];tripSave();tripRefresh();const n=$('#trip-note');if(n&&msg){n.textContent='✓ '+msg;n.classList.add('flash')}}
function tripSort(heavy){const list=tripCases(),pts=tripPts(list),rest=list.filter(c=>c.missing||!hasPin(c)).map(c=>String(c.id));if(pts.length<2)return;const me=tripOrigin();
  tripApply(heavy?tripPriority(pts,me):tripNN(pts,me),rest,heavy?'จัดเคสหนักก่อนแล้ว · ด่วน → ปานกลาง → ทั่วไป':'เรียงใกล้สุดก่อนแล้ว')}
function tripAuto(){const me=tripOrigin();let pool=S.cases.filter(c=>c.status==='open'&&hasPin(c)).map(c=>({id:String(c.id),lat:+c.lat,lng:+c.lng,sev:sevOf(c),people:Number(c.people)||1}));
  if(!pool.length)return toast('ไม่มีเคสที่รอช่วยและมีพิกัด');
  if(me){pool.forEach(p=>p.km=tripDist(me,p));const near=pool.filter(p=>p.km<=15);if(near.length>=3)pool=near}
  pool.sort((a,b)=>(b.sev-a.sev)||(b.people-a.people)||((a.km||0)-(b.km||0)));const pick=pool.slice(0,8);
  tripApply(tripPriority(pick,me),[],'จัดอัตโนมัติ '+pick.length+' จุด · เคสหนักก่อน')}
function tripUrl(){const pts=tripCases().filter(c=>!c.missing&&hasPin(c)&&c.status!=='done').map(c=>(+c.lat).toFixed(6)+','+(+c.lng).toFixed(6));if(!pts.length)return '';const use=pts.slice(0,10),dest=use.pop();
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+encodeURIComponent(dest)+(use.length?'&waypoints='+encodeURIComponent(use.join('|')):'')}
function renderTrip(){
  const el=$('#trip-panel');const list=tripCases();
  if(!S.volunteer||!S.cases.length){el.hidden=true;return}
  el.hidden=false;el.classList.toggle('empty',!list.length);
  if(!list.length){el.innerHTML=`<button type="button" class="trip-auto" id="trip-auto">${ic('route')}<span><b>จัดเส้นทางอัตโนมัติ</b><small>เลือกเคสหนักและคนเยอะใกล้คุณ แล้วเรียงให้</small></span></button>`;$('#trip-auto').onclick=tripAuto;return}
  let km=0,prev=null;list.forEach(c=>{if(!c.missing&&hasPin(c)){const p={lat:+c.lat,lng:+c.lng};if(prev)km+=tripDist(prev,p);prev=p}});
  el.innerHTML=`<div class="trip-head"><b>${ic('route')} แผนเดินทาง · ${list.length} จุด</b><span class="trip-note" id="trip-note">${km?'ระยะตรงรวม ~'+km.toFixed(1)+' กม.':''}</span></div><ol class="trip-list"></ol>`;
  const ol=el.querySelector('ol');
  list.forEach((c,i)=>{const li=document.createElement('li');li.className='trip-item';
    li.innerHTML=`<span class="trip-no${!c.missing&&isDanger(c)?' danger':''}">${i+1}</span><button type="button" class="trip-txt"><b>${esc(c.missing?'เคส #'+c.id:(c.needs||[]).join(' · ')+' · '+(c.people||1)+' คน')}</b><small>${esc(c.missing?'ไม่พบในรายการ':[c.address||(c.district?'เขต'+c.district:''),c.status==='done'?'ช่วยแล้ว':''].filter(Boolean).join(' · '))}</small></button>
      <span class="trip-ctl"><button type="button" aria-label="เลื่อนขึ้น" ${i===0?'disabled':''}>${ic('up')}</button><button type="button" aria-label="เลื่อนลง" ${i===list.length-1?'disabled':''}>${ic('down')}</button><button type="button" aria-label="เอาออก">${ic('close')}</button></span>`;
    const [u,d,x]=li.querySelectorAll('.trip-ctl button');u.onclick=()=>tripMove(i,-1);d.onclick=()=>tripMove(i,1);x.onclick=()=>tripToggle(c.id);
    li.querySelector('.trip-txt').onclick=()=>{if(!c.missing&&hasPin(c)&&S.maps.map){S.maps.map.setView([+c.lat,+c.lng],16);setSheet(false)}};ol.append(li)});
  const url=tripUrl(),few=tripPts(list).length<2;
  el.insertAdjacentHTML('beforeend',`<a class="pill pill-blue full" style="margin-top:10px" ${url?`href="${url}" target="_blank" rel="noopener"`:'aria-disabled="true"'}>${ic('nav')}นำทางทั้งเส้นใน Google Maps</a>
    <div class="trip-btns"><button type="button" class="pill pill-green small" data-t="heavy" ${few?'disabled':''}>${ic('alert')}เคสหนักก่อน</button><button type="button" class="pill pill-ghost small" data-t="near" ${few?'disabled':''}>${ic('pin')}ใกล้สุดก่อน</button>
    <button type="button" class="pill pill-ghost small" data-t="auto">${ic('route')}จัดอัตโนมัติ</button><button type="button" class="pill pill-line small" data-t="clear">ล้างแผน</button></div>`);
  el.querySelector('[data-t=heavy]').onclick=()=>tripSort(true);el.querySelector('[data-t=near]').onclick=()=>tripSort(false);
  const au=el.querySelector('[data-t=auto]');au.onclick=()=>{if(!au.dataset.sure){au.dataset.sure='1';au.lastChild.textContent='แทนที่แผนเดิม?';return}tripAuto()};
  const cl=el.querySelector('[data-t=clear]');cl.onclick=()=>{if(!cl.dataset.sure){cl.dataset.sure='1';cl.textContent='กดอีกครั้งเพื่อล้าง';return}TRIP.ids=[];tripSave();tripRefresh()};
}
function drawTrip(){const m=S.maps.map;if(!m||!window.L)return;if(!TRIP.layer)TRIP.layer=L.layerGroup().addTo(m);TRIP.layer.clearLayers();if(!S.volunteer)return;
  const pts=[];tripCases().forEach((c,i)=>{if(c.missing||!hasPin(c))return;const p=[+c.lat,+c.lng];pts.push(p);
    L.marker(p,{icon:L.divIcon({className:'trip-pin',html:`<span>${i+1}</span>`,iconSize:[24,24],iconAnchor:[12,48]}),interactive:false,zIndexOffset:2500}).addTo(TRIP.layer)});
  if(pts.length>1)L.polyline(pts,{color:'#0F2188',weight:4,opacity:.8,dashArray:'8 8',interactive:false}).addTo(TRIP.layer)}
function tripBadges(){$$('#case-list .case').forEach(b=>{const i=tripIndex(b.dataset.id);let t=b.querySelector('.trip-badge');if(i<0||!S.volunteer){t&&t.remove();return}if(!t){t=document.createElement('span');t.className='trip-badge';b.append(t)}t.textContent='จุดที่ '+(i+1)})}
function tripRefresh(){renderTrip();drawTrip();tripBadges()}

/* ---------- เริ่มต้น ---------- */
iconify();renderFilters();renderLegend();netbar();
{const c=store.json('uh_cases_cache',null);if(c&&c.cases&&!S.volunteer)S.cases=c.cases}
const startView=(location.hash||'#home').slice(1);
go(['home','map','emergency'].includes(startView)?startView:'home',false);
history.replaceState({view:S.view},'','#'+S.view);
renderAll();loadCases();flushQueue();trackMine();
setInterval(()=>{if(!document.hidden)loadCases()},REFRESH_MS);
setInterval(()=>{if(!document.hidden)trackMine()},REFRESH_MS*4);

