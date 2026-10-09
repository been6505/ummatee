(()=>{
/* ข่าวและเตือนภัย: ประกาศกรมอุตุฯ + แผ่นดินไหวใกล้ไทย + หัวข้อข่าวล่าสุด (API action=news ดึงและแคชที่ Worker) */
const N={data:null,tag:'',q:'',timer:null};
const TAGS=[['','ทั้งหมด'],['flood','น้ำท่วม'],['storm','พายุ / ฝน'],['alert','ประกาศ / เตือนภัย'],['quake','แผ่นดินไหว']];
const fmtD=t=>t?new Date(t).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
const live=w=>{const n=Date.now();return(!w.start||w.start<=n)&&(!w.end||w.end>=n)};

function render(){
  const d=N.data;if(!d)return;
  $('#warn').innerHTML=d.warnings.length?d.warnings.map((w,i)=>`<article class="nw-warn${live(w)?' live':''}">
      <div class="nw-wt">${live(w)?'<span class="nw-badge">มีผลตอนนี้</span>':''}<b>${esc(w.title)}</b></div>
      <p class="muted small">ประกาศ ${esc(fmtD(w.announced))}${w.start||w.end?` · มีผล ${esc(fmtD(w.start))} – ${esc(fmtD(w.end))}`:''}</p>
      <details${i===0?' open':''}><summary>อ่านประกาศ</summary><p class="nw-txt">${esc(w.text)}</p></details>
      <p class="small">${w.url&&/^https:\/\//.test(w.url)?`<a href="${esc(w.url)}" target="_blank" rel="noopener">ฉบับเต็ม (PDF) ↗</a> · `:''}${esc(w.contact)}</p>
    </article>`).join(''):'<p class="muted">ตอนนี้ไม่มีประกาศเตือนภัยที่ยังมีผล</p>';
  $('#quake').innerHTML=d.quakes.length?`<ul class="nw-quakes">${d.quakes.map(q=>`<li><b class="mag${q.mag>=5?' hi':''}">${esc(q.mag.toFixed(1))}</b><span>${esc(q.place)}<small class="muted">${esc(fmtD(q.time))} · ลึก ${esc(q.depth)} กม.</small></span></li>`).join('')}</ul>`:'<p class="muted">ไม่มีรายงานแผ่นดินไหวในภูมิภาค</p>';
  const cnt=k=>k?d.news.filter(n=>n.tags.includes(k)).length:d.news.length;
  $('#tags').innerHTML=TAGS.map(([k,l])=>`<button data-t="${k}" aria-selected="${k===N.tag}">${l} <small>${cnt(k)}</small></button>`).join('');
  const q=N.q.trim().toLowerCase(),list=d.news.filter(n=>(!N.tag||n.tags.includes(N.tag))&&(!q||(n.title+' '+n.source).toLowerCase().includes(q)));
  $('#news').innerHTML=list.length?list.map(n=>`<li><a href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a><small class="muted">${esc(n.source)}${n.time?' · '+esc(ago(n.time)):''}</small></li>`).join(''):'<li class="muted">ไม่พบข่าวที่ตรงกับตัวกรอง</li>';
  const err=d.errors&&d.errors.length?' · บางแหล่งโหลดไม่ได้ ลองใหม่ภายหลัง':'';
  $('#nw-status').textContent=`อัปเดต ${ago(d.time)} · ประกาศ ${d.warnings.length} ฉบับ · ข่าว ${d.news.length} ข่าว${err}`;
}

async function load(){
  
  try{const r=await apiGet({action:'news'});if(!r||!r.ok)throw new Error(r&&r.error);N.data=r;render()}
  catch(e){$('#nw-status').textContent='โหลดข่าวไม่สำเร็จ ลองกด "โหลดใหม่" อีกครั้ง'}
  finally{}
}

$('#tags').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;N.tag=b.dataset.t;render()});
$('#nw-q').addEventListener('input',e=>{N.q=e.target.value;render()});
$('#refresh').addEventListener('click',()=>{if(N.started)load()});
/* อยู่ในหน้าประกาศ (แท็บ "ข่าวและเตือนภัย"): เริ่มโหลดเมื่อเปิดแท็บครั้งแรก */
window.NEWS_START=()=>{if(N.started)return;N.started=true;load();clearInterval(N.timer);N.timer=setInterval(()=>{if(!document.hidden)load()},10*60000);hzInit()};

/* ---------- ภัยพิบัติตอนนี้ + รายงานภัยจากศูนย์ ---------- */
let hzMap=null,hzPick=null;
function hzLoadLeaflet(){if(window.L)return Promise.resolve();return new Promise((res,rej)=>{const c=document.createElement('link');c.rel='stylesheet';c.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';c.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';c.crossOrigin='';document.head.append(c);
  const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';s.crossOrigin='';s.onload=res;s.onerror=rej;document.head.append(s)})}
async function hzInit(){try{await hzLoadLeaflet()}catch(e){$('#hz-map').textContent='โหลดแผนที่ไม่ได้';return}
  hzMap=L.map('hz-map',{scrollWheelZoom:false}).setView([13.2,101],5);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(hzMap);
  HZ.attach(hzMap);hzMap.on('click',e=>{const f=$('#hz-form');f.hidden=false;f.ll.value=e.latlng.lat.toFixed(5)+', '+e.latlng.lng.toFixed(5);
    if(hzPick)hzPick.setLatLng(e.latlng);else hzPick=L.marker(e.latlng).addTo(hzMap)});
  HZ.onData(hzRender)}
function hzRender(d){const c=HZ.counts(d),hot=['quake','tsunami','hail','slide','cyclone','report'];
  $('#hz-sum').innerHTML=Object.entries(HZ.T).filter(([k])=>c[k]).map(([k,t])=>`<span class="${hot.includes(k)?'hot':''}">${t.i} ${t.t} ${c[k]}</span>`).join('')||'<span>ไม่พบภัยที่ต้องเฝ้าระวังตอนนี้</span>';
  const its=HZ.items(d).filter(x=>x.k!=='fire').sort((a,b)=>(b.lv||1)-(a.lv||1)).slice(0,30);
  $('#hz-list').innerHTML=its.map(x=>{const tmp=document.createElement('div');tmp.innerHTML=x.html;const t=tmp.textContent;
    return `<li><span>${x.icon||HZ.T[x.k].i}</span><div>${esc(t.slice(0,160))}</div>${x.k==='report'?'':''}<button type="button" class="linkish" data-hzgo="${+x.lat},${+x.lng}">แผนที่</button></li>`}).join('')+
    ((d.reports||[]).length?`<li><span>📍</span><div><b>รายงานจากศูนย์ที่ยังมีผล</b>${d.reports.map(r=>`<small>${esc((HZ.RT[r.type]||HZ.RT.other)[0])}${r.note?' · '+esc(r.note):''} <button type="button" class="linkish" data-hzclose="${esc(r.id)}">ปิดรายงาน</button></small>`).join('')}</div></li>`:'')}
document.addEventListener('click',async e=>{const g=e.target.closest('[data-hzgo]');if(g&&hzMap){const [a,o]=g.dataset.hzgo.split(',').map(Number);hzMap.setView([a,o],9);$('#hz-map').scrollIntoView({block:'nearest',behavior:'smooth'});return}
  const cl=e.target.closest('[data-hzclose]');if(cl&&confirm('ปิดรายงานภัยนี้?')){const r=await apiPost({action:'hazard_close',id:cl.dataset.hzclose}).catch(()=>({}));if(r.ok){toast('ปิดรายงานแล้ว',true);HZ.load()}else toast('ปิดไม่สำเร็จ')}});
$('#hz-add').onclick=()=>{$('#hz-form').hidden=false;$('#hz-form').ll.focus();toast('คลิกบนแผนที่เพื่อเลือกจุด',true)};
$('#hz-cancel').onclick=()=>{$('#hz-form').hidden=true;if(hzPick){hzPick.remove();hzPick=null}};
$('#hz-form').onsubmit=async e=>{e.preventDefault();const f=e.target,m=String(f.ll.value).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);if(!m){toast('ใส่พิกัดหรือคลิกแผนที่');return}
  const by=staffName();if(!by)return;
  const r=await apiPost({action:'hazard_save',by,hazard:{type:f.type.value,level:f.level.value,lat:+m[1],lng:+m[2],radiusM:f.radiusM.value,hours:f.hours.value,note:f.note.value}}).catch(()=>({}));
  if(r.ok){toast('บันทึกรายงานภัยแล้ว',true);f.reset();f.hidden=true;if(hzPick){hzPick.remove();hzPick=null}HZ.load()}else toast('บันทึกไม่สำเร็จ: '+(r.error||''))};


})();
