/* CENTRAL: เขียน/ยกเลิกประกาศแจ้งเตือนรายพื้นที่ (API: broadcasts_all · broadcast_save · broadcast_cancel)
   ประกาศขึ้นที่หน้าบ้าน helpme4u.com, หน้าทีม และทุกหน้า CENTRAL ผ่าน /bc.js */
const B={list:[],scope:'all',flt:'live',map:null,mk:null,circ:null};
const LVT={info:'ℹ️ ข่าวสาร',warn:'⚠️ เฝ้าระวัง',danger:'🚨 อันตราย · อพยพ'};
const PROVS='กรุงเทพมหานคร กระบี่ กาญจนบุรี กาฬสินธุ์ กำแพงเพชร ขอนแก่น จันทบุรี ฉะเชิงเทรา ชลบุรี ชัยนาท ชัยภูมิ ชุมพร เชียงราย เชียงใหม่ ตรัง ตราด ตาก นครนายก นครปฐม นครพนม นครราชสีมา นครศรีธรรมราช นครสวรรค์ นนทบุรี นราธิวาส น่าน บึงกาฬ บุรีรัมย์ ปทุมธานี ประจวบคีรีขันธ์ ปราจีนบุรี ปัตตานี พระนครศรีอยุธยา พะเยา พังงา พัทลุง พิจิตร พิษณุโลก เพชรบุรี เพชรบูรณ์ แพร่ ภูเก็ต มหาสารคาม มุกดาหาร แม่ฮ่องสอน ยโสธร ยะลา ร้อยเอ็ด ระนอง ระยอง ราชบุรี ลพบุรี ลำปาง ลำพูน เลย ศรีสะเกษ สกลนคร สงขลา สตูล สมุทรปราการ สมุทรสงคราม สมุทรสาคร สระแก้ว สระบุรี สิงห์บุรี สุโขทัย สุพรรณบุรี สุราษฎร์ธานี สุรินทร์ หนองคาย หนองบัวลำภู อ่างทอง อำนาจเจริญ อุดรธานี อุตรดิตถ์ อุทัยธานี อุบลราชธานี'.split(' ');
$('#provs').innerHTML=PROVS.map(p=>`<option value="${p}">`).join('');
const f=$('#bf');
const areaTxt=b=>b.scope==='all'?'ทุกพื้นที่':b.scope==='province'?'จังหวัด'+b.provinces.join(', '):b.scope==='district'?b.districts.join(', '):`รัศมี ${b.radiusKm} กม.`;
const live=b=>!b.cancelledAt&&b.expiresAt>Date.now();
const fmt=t=>new Date(t).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

/* ---------- ฟอร์ม ---------- */
$('#scope').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(!b)return;B.scope=b.dataset.s;
  $$('#scope [data-s]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$$('#sc [data-for]').forEach(d=>d.hidden=d.dataset.for!==B.scope);
  if(B.scope==='circle')initMap();preview()});
f.addEventListener('input',preview);f.addEventListener('change',preview);
function ll(){const m=String(f.ll.value).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);return m?{lat:+m[1],lng:+m[2]}:null}
function data(){const lv=(f.querySelector('[name=level]:checked')||{}).value||'info',p=ll();
  return {level:lv,title:f.title.value.trim(),body:f.body.value.trim(),link:f.link.value.trim(),scope:B.scope,provinces:f.provinces.value,districts:f.districts.value,
    lat:p?p.lat:'',lng:p?p.lng:'',radiusKm:f.radiusKm.value,hours:f.hours.value}}
function preview(){const d=data();
  const area=d.scope==='all'?'ทุกพื้นที่':d.scope==='province'?(d.provinces||'— ใส่จังหวัด —'):d.scope==='district'?(d.districts||'— ใส่เขต/อำเภอ —'):(ll()?`รัศมี ${d.radiusKm} กม.`:'— เลือกจุดบนแผนที่ —');
  $('#pv').innerHTML=d.title?`<div class="pc ${esc(d.level)}"><b>${esc(LVT[d.level])}</b><strong>${esc(d.title)}</strong>${d.body?`<p>${esc(d.body)}</p>`:''}<small>📍 ${esc(area)} · มีผล ${esc(f.hours.selectedOptions[0].textContent)}</small></div>`:'<p class="muted small">ตัวอย่างประกาศจะแสดงที่นี่</p>';
  if(B.circ){const p=ll();if(p){B.circ.setLatLng([p.lat,p.lng]).setRadius((+d.radiusKm||1)*1000);B.mk.setLatLng([p.lat,p.lng])}}}
let leafP=null;
function loadLeaflet(){if(window.L)return Promise.resolve();return leafP||(leafP=new Promise((res,rej)=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='';document.head.append(css);
  const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';s.crossOrigin='';s.onload=res;s.onerror=()=>{leafP=null;rej()};document.head.append(s)}))}
async function initMap(){if(B.map){setTimeout(()=>B.map.invalidateSize(),50);return}try{await loadLeaflet()}catch(e){$('#bmap').textContent='โหลดแผนที่ไม่ได้ · ใส่พิกัดเองได้';return}
  B.map=L.map('bmap').setView([13.75,100.6],10);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(B.map);
  B.mk=L.marker([13.75,100.6],{draggable:true});B.circ=L.circle([13.75,100.6],{radius:3000,color:'#c62828',weight:2,fillOpacity:.1});
  const put=(a,o)=>{f.ll.value=a.toFixed(5)+', '+o.toFixed(5);if(!B.map.hasLayer(B.mk)){B.mk.addTo(B.map);B.circ.addTo(B.map)}preview()};
  B.map.on('click',e=>put(e.latlng.lat,e.latlng.lng));B.mk.on('drag',e=>{const p=e.target.getLatLng();put(p.lat,p.lng)})}
f.onsubmit=async e=>{e.preventDefault();const d=data();if(!d.title){f.title.focus();return}
  if(d.scope==='circle'&&!ll()){toast('เลือกจุดบนแผนที่ก่อน');return}
  const area=d.scope==='all'?'ทุกพื้นที่ (ทุกคนที่เปิดหน้า Help Me)':areaTxt({...d,provinces:String(d.provinces).split(','),districts:[d.districts]});
  if(!confirm(`ส่งประกาศ "${d.title}"\nระดับ: ${LVT[d.level]}\nพื้นที่: ${area}\n\nคนในพื้นที่จะเห็นทันทีและได้เสียงเตือน`))return;
  const by=staffName();if(!by)return;$('#send').disabled=true;
  try{const r=await apiPost({action:'broadcast_save',by,broadcast:d});
    if(r.ok){toast('ส่งประกาศแล้ว',true);f.title.value='';f.body.value='';f.link.value='';preview();await load();if(window.HMBC)HMBC.reload()}
    else toast(r.error==='missing_area'?'ระบุพื้นที่ให้ครบ':'ส่งไม่สำเร็จ: '+(r.error||''))}
  catch(err){toast('ส่งไม่สำเร็จ')}finally{$('#send').disabled=false}};

/* ---------- รายการ ---------- */
$('#flt').addEventListener('click',e=>{const b=e.target.closest('[data-f]');if(!b)return;B.flt=b.dataset.f;$$('#flt [data-f]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render()});
function render(){const list=B.list.filter(b=>B.flt==='all'||live(b));
  $('#list').innerHTML=list.length?list.map(b=>{const st=b.cancelledAt?'ยกเลิกแล้ว':live(b)?'มีผลอยู่':'หมดเวลาแล้ว';
    return `<li class="${esc(b.level)}${live(b)?'':' off'}"><div class="t"><b>${esc(LVT[b.level]||b.level)}</b><span class="st">${st}</span></div><strong>${esc(b.title)}</strong>${b.body?`<p>${esc(b.body)}</p>`:''}
      <small>📍 ${esc(areaTxt(b))} · ส่ง ${esc(fmt(b.createdAt))}${b.by?' โดย '+esc(b.by):''} · ${b.cancelledAt?'ยกเลิก '+esc(fmt(b.cancelledAt)):'ถึง '+esc(fmt(b.expiresAt))}</small>
      ${live(b)?`<button type="button" class="btn ghost sm" data-cancel="${esc(b.id)}">ยกเลิกประกาศ</button>`:''}</li>`}).join(''):`<li class="muted">${B.flt==='live'?'ไม่มีประกาศที่มีผลอยู่':'ยังไม่มีประกาศ'}</li>`;
  $('#status').textContent=`มีผลอยู่ ${B.list.filter(live).length} ประกาศ`}
$('#list').addEventListener('click',async e=>{const b=e.target.closest('[data-cancel]');if(!b||!confirm('ยกเลิกประกาศนี้? จะหายจากหน้าจอทุกคนภายใน 1 นาที'))return;b.disabled=true;
  try{const r=await apiPost({action:'broadcast_cancel',id:b.dataset.cancel});if(r.ok){toast('ยกเลิกแล้ว',true);await load();if(window.HMBC)HMBC.reload()}else toast('ยกเลิกไม่สำเร็จ')}catch(err){toast('ยกเลิกไม่สำเร็จ')}});
async function load(){const r=await apiGet({action:'broadcasts_all'}).catch(()=>null);if(r&&r.ok){B.list=r.broadcasts||[];render()}}
$('#refresh').onclick=load;
adminBoot({action:'broadcasts_all'},'broadcasts',r=>{B.list=r.broadcasts||[];render();preview();setInterval(()=>{if(!document.hidden)load()},30000)});
