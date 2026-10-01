/* UM+ แผนการเดินทาง: ปักหมุดหลายเคสเป็นจุดแวะตามลำดับ → เส้นทางบนแผนที่ + นำทาง Google Maps
   เก็บเฉพาะเลขเคสไว้ในเครื่อง (uh_trip) ไม่ส่งไปที่ใด */
const TRIP={ids:[],layer:null};
try{TRIP.ids=JSON.parse(localStorage.getItem('uh_trip')||'[]').filter(x=>typeof x==='string').slice(0,25)}catch(e){TRIP.ids=[]}
function tripSave(){try{TRIP.ids.length?localStorage.setItem('uh_trip',JSON.stringify(TRIP.ids)):localStorage.removeItem('uh_trip')}catch(e){}}
function tripIndex(id){return TRIP.ids.indexOf(String(id))}
function tripCases(){return TRIP.ids.map(id=>cases.find(c=>String(c.id)===id)||{id,missing:true})}
function tripToggle(id){id=String(id);const i=tripIndex(id);if(i>=0)TRIP.ids.splice(i,1);else{if(TRIP.ids.length>=25)return;TRIP.ids.push(id)}tripSave();tripRefresh()}
function tripMove(i,d){const j=i+d;if(j<0||j>=TRIP.ids.length)return;[TRIP.ids[i],TRIP.ids[j]]=[TRIP.ids[j],TRIP.ids[i]];tripSave();tripRefresh()}
function tripClear(){TRIP.ids=[];tripSave();tripRefresh()}
const tripDist=(a,b)=>{const R=6371,t=Math.PI/180,dl=(b.lat-a.lat)*t,dn=(b.lng-a.lng)*t,x=Math.sin(dl/2)**2+Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x))};
/* เรียงใกล้สุดก่อน: เริ่มจากตำแหน่งเรา (ถ้ามี) ไม่งั้นเริ่มจากจุดแรก; เคสวิกฤตยังคงลำดับตามระยะ */
/* หาตำแหน่งเรา (ใช้ของที่มีอยู่ก่อน) แล้วเรียก cb(pos|null) */
function tripWithOrigin(cb){
  /* ทำทันที: ใช้ตำแหน่งที่รู้อยู่แล้ว (ไม่รอ GPS) แล้วขอ GPS เบื้องหลังเก็บไว้ใช้ครั้งต่อไป */
  const me=typeof ME!=='undefined'&&ME.pos?{lat:ME.pos.lat,lng:ME.pos.lng}:TRIP.lastPos||null;
  cb(me);
  if(navigator.geolocation&&!(typeof ME!=='undefined'&&ME.pos))navigator.geolocation.getCurrentPosition(p=>{TRIP.lastPos={lat:p.coords.latitude,lng:p.coords.longitude}},()=>{},{enableHighAccuracy:false,timeout:10000,maximumAge:120000});
}
/* ความหนักของเคส: แดง 3 / ส้ม 2 / เหลือง 1 */
function tripSev(c){return critLevel(c)==='red'?3:critLevel(c)==='orange'?2:1}
/* เรียงใกล้สุดถัดไปเรื่อย ๆ (nearest neighbour) */
function tripNN(pts,start){const left=pts.slice(),out=[];let cur=start;if(!cur&&left.length){cur=left.shift();out.push(cur)}
  while(left.length){let bi=0,bd=Infinity;left.forEach((p,i)=>{const d=tripDist(cur,p);if(d<bd){bd=d;bi=i}});cur=left.splice(bi,1)[0];out.push(cur)}return out}
/* เคสหนักก่อน: ไปเคสแดงทั้งหมดก่อน (เรียงตามระยะ) แล้วส้ม แล้วเหลือง */
function tripPriorityOrder(pts,start){let cur=start,out=[];[3,2,1].forEach(sv=>{const tier=pts.filter(p=>p.sev===sv);if(!tier.length)return;const o=tripNN(tier,cur);out=out.concat(o);cur=o[o.length-1]});return out}
function tripPts(list){return list.filter(c=>!c.missing&&hasPin(c)).map(c=>({id:String(c.id),lat:+c.lat,lng:+c.lng,sev:tripSev(c),people:Number(c.people)||1}))}
function tripApply(order,rest,msg){TRIP.ids=[...order.map(p=>p.id),...rest];tripSave();tripRefresh();const st=document.getElementById('trip-note');if(st&&msg){st.textContent='✓ '+msg;st.classList.add('flash')}}
function tripSort(){const list=tripCases(),pts=tripPts(list),rest=list.filter(c=>c.missing||!hasPin(c)).map(c=>String(c.id));if(pts.length<2)return;
  tripWithOrigin(me=>tripApply(tripNN(pts,me),rest,'เรียงใกล้สุดก่อนแล้ว'))}
function tripHeavyFirst(){const list=tripCases(),pts=tripPts(list),rest=list.filter(c=>c.missing||!hasPin(c)).map(c=>String(c.id));if(pts.length<2)return;
  tripWithOrigin(me=>tripApply(tripPriorityOrder(pts,me),rest,'จัดเคสหนักก่อนแล้ว · แดง → ส้ม → เหลือง'))}
/* จัดเส้นทางอัตโนมัติ: เลือกเคสที่ยังรอความช่วยเหลือ เน้นเคสหนักและคนเยอะ ใกล้ตำแหน่งเรา แล้วเรียงเคสหนักก่อน */
const TRIP_AUTO_MAX=8,TRIP_AUTO_KM=15;
function tripAuto(){
  tripWithOrigin(me=>{
    let pool=cases.filter(c=>c.status==='open'&&hasPin(c)).map(c=>({id:String(c.id),lat:+c.lat,lng:+c.lng,sev:tripSev(c),people:Number(c.people)||1}));
    if(!pool.length){const st=document.getElementById('trip-note');if(st)st.textContent='ไม่มีเคสที่รอความช่วยเหลือและมีพิกัด';return}
    if(me){pool.forEach(p=>p.km=tripDist(me,p));const near=pool.filter(p=>p.km<=TRIP_AUTO_KM);if(near.length>=3)pool=near}
    pool.sort((a,b)=>(b.sev-a.sev)||(b.people-a.people)||((a.km||0)-(b.km||0)));
    const pick=pool.slice(0,TRIP_AUTO_MAX);
    tripApply(tripPriorityOrder(pick,me),[],'จัดอัตโนมัติ '+pick.length+' จุด · เคสหนักก่อน'+(me?' · ใกล้คุณ':''));
  });
}
function tripMapsUrl(){
  const pts=tripCases().filter(c=>!c.missing&&hasPin(c)&&c.status!=='done').map(c=>(+c.lat).toFixed(6)+','+(+c.lng).toFixed(6));
  if(!pts.length)return '';
  const use=pts.slice(0,10),dest=use.pop();
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination='+encodeURIComponent(dest)+(use.length?'&waypoints='+encodeURIComponent(use.join('|')):'');
}
function tripShort(c){if(c.missing)return 'เคส #'+c.id+' (ไม่พบในรายการ)';
  return [(c.needs||[]).join(' · ')||'ขอความช่วยเหลือ',(Number(c.people)||1)+' คน'].join(' · ')}
function renderTripPanel(){
  const el=document.getElementById('trip-panel');if(!el)return;
  if(!cases.length){el.hidden=true;return}
  const list=tripCases();if(!list.length&&!isVolunteer){el.hidden=true;el.replaceChildren();return}el.hidden=false;el.replaceChildren();el.classList.toggle('empty',!list.length);
  if(!list.length){const b=document.createElement('button');b.type='button';b.className='trip-auto-big';b.innerHTML='🧭 <b>จัดเส้นทางอัตโนมัติ</b><small>เลือกเคสหนักและคนเยอะใกล้คุณ แล้วเรียงให้</small>';b.onclick=tripAuto;
    const n=document.createElement('small');n.id='trip-note';n.className='trip-empty-note';el.append(b,n);return}
  const head=document.createElement('div');head.className='trip-head';
  const h=document.createElement('b');h.textContent='🧭 แผนการเดินทาง · '+list.length+' จุด';
  let km=0,prev=null;list.forEach(c=>{if(!c.missing&&hasPin(c)){const p={lat:+c.lat,lng:+c.lng};if(prev)km+=tripDist(prev,p);prev=p}});
  const s=document.createElement('small');s.id='trip-note';s.textContent=km?'ระยะตรงรวม ~'+km.toFixed(1)+' กม.':'';
  head.append(h,s);el.append(head);
  const ol=document.createElement('ol');ol.className='trip-list';
  list.forEach((c,i)=>{const li=document.createElement('li');li.className='trip-item'+(c.status==='done'?' done':'')+(!c.missing&&!hasPin(c)?' nopin':'');
    const n=document.createElement('span');n.className='trip-no';n.textContent=i+1;if(!c.missing&&c.status!=='done')n.style.background=critLevel(c)==='red'?'#d32f2f':critLevel(c)==='orange'?'#f57c00':'#c99700';
    const t=document.createElement('button');t.type='button';t.className='trip-txt';
    const t1=document.createElement('span');t1.textContent=tripShort(c);
    const t2=document.createElement('small');t2.textContent=c.missing?'':[c.address||(c.district?'เขต'+c.district:''),c.status==='done'?'✓ ช่วยเหลือแล้ว':(!hasPin(c)?'ไม่มีพิกัด':'')].filter(Boolean).join(' · ');
    t.append(t1,t2);if(!c.missing)t.onclick=()=>{if(fmap&&hasPin(c)){fmap.setView([+c.lat,+c.lng],Math.max(fmap.getZoom(),16));document.getElementById('flood-map').scrollIntoView({behavior:'smooth',block:'center'})}else openCase(c.id)};
    const ctl=document.createElement('span');ctl.className='trip-ctl';
    const mk=(txt,lab,fn,dis)=>{const b=document.createElement('button');b.type='button';b.textContent=txt;b.title=lab;b.setAttribute('aria-label',lab);b.disabled=!!dis;b.onclick=fn;return b};
    ctl.append(mk('↑','เลื่อนขึ้น',()=>tripMove(i,-1),i===0),mk('↓','เลื่อนลง',()=>tripMove(i,1),i===list.length-1),mk('✕','เอาออกจากแผน',()=>tripToggle(c.id)));
    li.append(n,t,ctl);ol.append(li)});
  el.append(ol);
  const act=document.createElement('div');act.className='trip-actions';
  const url=tripMapsUrl();
  const go=document.createElement('a');go.className='solid-button trip-go';go.textContent='นำทางทั้งเส้นใน Google Maps ↗';go.target='_blank';go.rel='noopener';
  if(url)go.href=url;else{go.removeAttribute('href');go.classList.add('disabled')}
  const mkb=(t,fn,dis)=>{const b=document.createElement('button');b.type='button';b.className='secondary-button';b.textContent=t;b.onclick=fn;b.disabled=!!dis;return b};
  const few=list.filter(c=>!c.missing&&hasPin(c)).length<2;
  const auto=mkb('🤖 จัดอัตโนมัติ',()=>{if(!auto.dataset.sure&&list.length){auto.dataset.sure='1';auto.textContent='แทนที่แผนเดิม? กดอีกครั้ง';setTimeout(()=>{auto.dataset.sure='';auto.textContent='🤖 จัดอัตโนมัติ'},3000);return}tripAuto()});
  const heavy=mkb('🔴 เคสหนักก่อน',tripHeavyFirst,few);
  const sort=mkb('📍 ใกล้สุดก่อน',tripSort,few);
  const clr=mkb('ล้างแผน',()=>{if(!clr.dataset.sure){clr.dataset.sure='1';clr.textContent='กดอีกครั้งเพื่อล้าง';setTimeout(()=>{clr.dataset.sure='';clr.textContent='ล้างแผน'},3000);return}tripClear()});
  const grid=document.createElement('div');grid.className='trip-btns';grid.append(auto,heavy,sort,clr);
  act.append(go,grid);el.append(act);
  const pinned=list.filter(c=>!c.missing&&hasPin(c)&&c.status!=='done').length;
  if(pinned>10){const w=document.createElement('p');w.className='trip-warn';w.textContent='Google Maps นำทางได้ครั้งละ 10 จุดแรก';el.append(w)}
}
function drawTrip(){
  if(!fmap||typeof L==='undefined')return;
  if(!TRIP.layer)TRIP.layer=L.layerGroup().addTo(fmap);TRIP.layer.clearLayers();
  const pts=[];tripCases().forEach((c,i)=>{if(c.missing||!hasPin(c))return;const p=[+c.lat,+c.lng];pts.push(p);
    L.marker(p,{icon:L.divIcon({className:'trip-pin',html:`<span>${i+1}</span>`,iconSize:[24,24],iconAnchor:[12,46]}),zIndexOffset:2000,interactive:false}).addTo(TRIP.layer)});
  if(pts.length>1)L.polyline(pts,{color:'#126b63',weight:4,opacity:.85,dashArray:'8 8',interactive:false}).addTo(TRIP.layer);
}
function tripRefresh(){renderTripPanel();drawTrip();
  document.querySelectorAll('[data-trip-add]').forEach(b=>{const on=tripIndex(b.getAttribute('data-trip-add'))>=0;b.textContent=on?'✓ อยู่ในแผนเดินทาง (แตะเพื่อเอาออก)':'➕ เพิ่มในแผนเดินทาง';b.classList.toggle('on',on)});
  document.querySelectorAll('.case-card[data-id]').forEach(card=>{const i=tripIndex(card.dataset.id);let b=card.querySelector('.trip-badge');if(i<0){b&&b.remove();return}if(!b){b=document.createElement('span');b.className='trip-badge';card.append(b)}b.textContent='🧭 '+(i+1)});
}
/* ปุ่มในหน้ารายละเอียดเคส */
function tripButton(c){const b=document.createElement('button');b.type='button';b.className='secondary-button trip-add';b.setAttribute('data-trip-add',String(c.id));b.onclick=()=>tripToggle(c.id);
  const on=tripIndex(c.id)>=0;b.textContent=on?'✓ อยู่ในแผนเดินทาง (แตะเพื่อเอาออก)':'➕ เพิ่มในแผนเดินทาง';b.classList.toggle('on',on);return b}
/* ลิงก์ในป๊อปอัปหมุด */
document.addEventListener('click',e=>{const a=e.target.closest('a[data-trip-add]');if(!a)return;e.preventDefault();tripToggle(a.getAttribute('data-trip-add'))});
tripRefresh();
