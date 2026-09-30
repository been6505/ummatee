/* ============================================================
   UM+ จุดบริการบนแผนที่: ทีมกู้ภัยอาสา / โรงครัวฮาลาล / โรงครัวทั่วไป
   ข้อมูลอยู่แท็บ Places ใน Google Sheet (ทีมพิมพ์ใน Sheet เอง หรือเพิ่มจากแผนที่ในโหมดอาสา)
   ============================================================ */
const PLACE_TYPE={
  rescue:{label:'ทีมกู้ภัยอาสา',short:'ทีมกู้ภัย',icon:'🚑',color:'#1f5fbf'}
};
const PL={places:[],layer:null,loaded:0,show:null,picking:false,draft:null,tmp:null};

/* ---------- ตัวกรองบนแผนที่ ---------- */
function layerPrefs(){
  if(PL.show)return PL.show;
  let o={cases:true,rescue:false,halal:false,kitchen:false}; // จุดบริการ: กดชิปก่อนถึงจะแสดง
  try{Object.assign(o,JSON.parse(store.get('uh_layers2','{}')))}catch(e){}
  return PL.show=o;
}
function renderLayerChips(){
  const box=document.getElementById('layer-chips');if(!box)return;
  const s=layerPrefs(),count=t=>PL.places.filter(p=>p.type===t).length;
  const items=[['cases','📍','ขอความช่วยเหลือ',filteredCases().filter(hasPin).length],...Object.entries(PLACE_TYPE).map(([k,v])=>[k,v.icon,v.short,count(k)])];
  box.replaceChildren(...items.map(([k,ic,lb,n])=>{
    const b=document.createElement('button');b.type='button';b.className='layer-chip lc-'+k;b.setAttribute('aria-pressed',String(!!s[k]));
    b.innerHTML=`<span aria-hidden="true">${ic}</span>${escH(lb)}${n?` <b>${n}</b>`:''}`;
    b.onclick=()=>{s[k]=!s[k];store.set('uh_layers2',JSON.stringify(s));renderLayerChips();applyLayerVisibility()};
    return b;
  }));
}
function applyLayerVisibility(){
  if(typeof fmap==='undefined'||!fmap)return;
  const s=layerPrefs();
  if(pinLayer){if(s.cases&&!fmap.hasLayer(pinLayer))pinLayer.addTo(fmap);if(!s.cases&&fmap.hasLayer(pinLayer))fmap.removeLayer(pinLayer)}
  drawPlaces();
}

/* ---------- โหลด + วาดจุด ---------- */
async function loadPlaces(){
  try{
    const r=await fetch(API_URL+'?action=places&t='+Date.now()).then(x=>x.json());
    if(r&&r.ok){PL.places=r.places||[];PL.loaded=Date.now();drawPlaces();renderLayerChips()}
  }catch(e){}
}
function placePopup(p){
  const t=PLACE_TYPE[p.type]||{};
  const tel=String(p.phone||'').split(/[,\s]+/).map(x=>x.replace(/[^\d+]/g,'')).filter(x=>x.length>=3);
  let h=`<div class="place-pop"><span class="pp-type" style="color:${t.color}">${t.icon} ${escH(t.label)}</span><b>${escH(p.name)}</b>`;
  if(p.note)h+=`<p>${escH(p.note)}</p>`;
  h+='<div class="pp-actions">';
  tel.slice(0,2).forEach(n=>{h+=`<a href="tel:${escH(n)}">☎ ${escH(n)}</a>`});
  h+=`<a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener">นำทาง ↗</a>`;
  if(isVolunteer)h+=`<button type="button" data-edit-place="${escH(p.id)}">แก้ไข</button>`;
  h+='</div>';
  if(p.updatedAt)h+=`<small>อัปเดต ${escH(ago(p.updatedAt))}</small>`;
  return h+'</div>';
}
function drawPlaces(){
  if(typeof fmap==='undefined'||!fmap||!window.L)return;
  if(!PL.layer)PL.layer=L.layerGroup().addTo(fmap);
  PL.layer.clearLayers();
  const s=layerPrefs();
  PL.places.filter(p=>s[p.type]).forEach(p=>{
    const t=PLACE_TYPE[p.type];
    const icon=L.divIcon({className:'place-pin pp-'+p.type,html:`<span style="background:${t.color}">${t.icon}</span>`,iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-16]});
    L.marker([p.lat,p.lng],{icon,zIndexOffset:500,title:t.label+': '+p.name}).bindPopup(placePopup(p)).addTo(PL.layer);
  });
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-edit-place]');if(b){e.preventDefault();const p=PL.places.find(x=>x.id===b.getAttribute('data-edit-place'));if(p){fmap&&fmap.closePopup();openPlaceForm(p)}}});

/* ---------- ฟอร์มเพิ่ม/แก้ไขจุด (เฉพาะอาสา) ---------- */
function placeControls(){
  const box=document.createElement('div');box.className='live-box place-box';box.id='place-box';
  fillPlaceBox(box);return box;
}
function fillPlaceBox(box){
  box=box||document.getElementById('place-box');if(!box)return;box.replaceChildren();
  const h=document.createElement('strong');h.textContent='จุดทีมกู้ภัยบนแผนที่';
  const p=document.createElement('p');p.className='vol-note';p.textContent='จุดตั้งทีมกู้ภัยอาสา ทุกคนเห็นบนแผนที่ (แก้ใน Sheet แท็บ Places ได้ด้วย)';
  box.append(h,p);
  if(!PL.draft){const b=document.createElement('button');b.type='button';b.className='secondary-button';b.textContent='＋ เพิ่มจุดทีมกู้ภัย';b.onclick=()=>openPlaceForm(null);box.append(b);return}
  const d=PL.draft;
  const type=document.createElement('div');type.className='place-types';
  Object.entries(PLACE_TYPE).forEach(([k,v])=>{const b=document.createElement('button');b.type='button';b.className='layer-chip';b.setAttribute('aria-pressed',String(d.type===k));b.innerHTML=`<span aria-hidden="true">${v.icon}</span>${v.label}`;b.onclick=()=>{d.type=k;fillPlaceBox()};type.append(b)});
  const mk=(ph,key,max,mode)=>{const i=document.createElement('input');i.className='team-input';i.placeholder=ph;i.value=d[key]||'';i.maxLength=max;if(mode)i.inputMode=mode;i.oninput=()=>{d[key]=i.value};return i};
  const name=mk('ชื่อทีม เช่น กู้ภัยอาสา…',  'name',80),phone=mk('เบอร์ติดต่อ (ถ้ามี)','phone',30,'tel'),note=mk('รายละเอียด เช่น เวลาแจก จำนวนชุด ประเภทเรือ','note',300);
  const loc=document.createElement('div');loc.className='place-loc';
  const st=document.createElement('span');st.textContent=d.lat?`✓ ปักหมุดแล้ว (${(+d.lat).toFixed(4)}, ${(+d.lng).toFixed(4)})`:'ยังไม่ได้ปักหมุด';
  const pick=document.createElement('button');pick.type='button';pick.className='secondary-button';pick.textContent=PL.picking?'แตะบนแผนที่…':'📍 แตะเลือกบนแผนที่';pick.onclick=startPick;
  const me=document.createElement('button');me.type='button';me.className='secondary-button';me.textContent='ตำแหน่งฉัน';
  me.onclick=()=>{if(!navigator.geolocation)return;me.disabled=true;navigator.geolocation.getCurrentPosition(pos=>{setDraftLoc(pos.coords.latitude,pos.coords.longitude,true)},()=>{me.disabled=false;toast({title:'หาตำแหน่งไม่ได้',tone:'warn'})},{enableHighAccuracy:true,timeout:12000})};
  loc.append(st,pick,me);
  const err=document.createElement('p');err.className='field-error';err.hidden=true;
  const row=document.createElement('div');row.className='place-save';
  const save=document.createElement('button');save.type='button';save.className='solid-button';save.textContent=d.id?'บันทึกการแก้ไข':'บันทึกจุด';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='text-button';cancel.textContent='ยกเลิก';cancel.onclick=closePlaceForm;
  save.onclick=async()=>{
    if(!d.type||!String(d.name||'').trim()||!d.lat){err.textContent=!d.type?'เลือกประเภทก่อน':!String(d.name||'').trim()?'ใส่ชื่อจุด':'ปักหมุดตำแหน่งก่อน';err.hidden=false;return}
    save.disabled=true;save.textContent='กำลังบันทึก…';
    try{const r=await apiPost({action:'place',key:store.get('uh_vol_key',''),by:store.get('uh_team',''),...d,name:d.name.trim()});
      if(!r.ok)throw new Error(r.error);closePlaceForm();toast({title:'บันทึกจุดแล้ว',body:PLACE_TYPE[d.type].label+' · '+d.name,tone:'ok',timeout:5000});loadPlaces();
    }catch(e){save.disabled=false;save.textContent='ลองบันทึกอีกครั้ง';err.textContent='บันทึกไม่สำเร็จ ตรวจอินเทอร์เน็ต หรือระบบหลังบ้านยังไม่อัปเดต';err.hidden=false}
  };
  row.append(save,cancel);
  if(Object.keys(PLACE_TYPE).length>1)box.append(type);
  box.append(name,phone,note,loc,err,row);
  if(d.id){const hide=document.createElement('button');hide.type='button';hide.className='text-button danger-text';hide.textContent='ซ่อนจุดนี้จากแผนที่';
    hide.onclick=async()=>{if(!hide.dataset.sure){hide.dataset.sure='1';hide.textContent='กดอีกครั้งเพื่อยืนยันการซ่อน';return}
      hide.disabled=true;try{const r=await apiPost({action:'place',key:store.get('uh_vol_key',''),id:d.id,active:false});if(!r.ok)throw 0;closePlaceForm();loadPlaces()}catch(e){hide.disabled=false;hide.textContent='ซ่อนไม่สำเร็จ ลองอีกครั้ง'}};
    box.append(hide)}
}
function openPlaceForm(p){
  PL.draft=p?{id:p.id,type:'rescue',name:p.name,phone:p.phone,note:p.note,lat:p.lat,lng:p.lng}:{type:'rescue',name:'',phone:'',note:'',lat:'',lng:''};
  if(p)showTmp(p.lat,p.lng);
  if(!isVolunteer)return;
  volPanelOpen=true;renderVolunteerBar();fillPlaceBox();
  const box=document.getElementById('place-box');box&&box.scrollIntoView({behavior:'smooth',block:'start'});
}
function closePlaceForm(){PL.draft=null;PL.picking=false;if(PL.tmp){PL.tmp.remove();PL.tmp=null}fillPlaceBox()}
function showTmp(lat,lng){
  if(typeof fmap==='undefined'||!fmap)return;
  if(PL.tmp)PL.tmp.setLatLng([lat,lng]);
  else PL.tmp=L.marker([lat,lng],{icon:L.divIcon({className:'place-pin pp-new',html:'<span>＋</span>',iconSize:[34,34],iconAnchor:[17,17]}),zIndexOffset:3000}).addTo(fmap);
}
function setDraftLoc(lat,lng,pan){
  if(!PL.draft)return;PL.draft.lat=+lat.toFixed(6);PL.draft.lng=+lng.toFixed(6);PL.picking=false;
  showTmp(lat,lng);if(pan&&fmap)fmap.setView([lat,lng],Math.max(fmap.getZoom(),15));
  fillPlaceBox();
}
function startPick(){
  if(typeof fmap==='undefined'||!fmap){toast({title:'แผนที่ยังโหลดไม่เสร็จ',tone:'warn'});return}
  PL.picking=true;fillPlaceBox();
  document.querySelector('.flood-map-box').scrollIntoView({behavior:'smooth',block:'center'});
  toast({title:'แตะบนแผนที่เพื่อปักจุด',body:'ซูมเข้าให้ใกล้ก่อนจะแม่นขึ้น',key:'pick',timeout:8000});
  fmap.once('click',e=>{if(!PL.picking)return;setDraftLoc(e.latlng.lat,e.latlng.lng,false);
    const box=document.getElementById('place-box');box&&box.scrollIntoView({behavior:'smooth',block:'center'});
    const t=document.querySelector('[data-key="pick"]');t&&t.remove()});
}

/* ---------- hooks ---------- */
function onFloodMapReady(){applyLayerVisibility();if(!PL.loaded)loadPlaces();else drawPlaces()}
setInterval(()=>{if(currentView==='map'&&!document.hidden)loadPlaces()},3*60*1000);
if(typeof fmap!=='undefined'&&fmap)onFloodMapReady();
