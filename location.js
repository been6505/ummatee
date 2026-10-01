let requestMap=null, requestMarker=null, mapLoading=null, locationRevision=0;
const locationElement=id=>document.getElementById(id);
function showMapError(message){const el=locationElement('map-error');el.textContent=message;el.hidden=!message;}
function loadLeaflet(){
  if(window.L)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';script.crossOrigin='';
    const timer=setTimeout(()=>{script.remove();reject(new Error('timeout'))},15000);
    script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('load'))};
    document.head.append(script);
  });
}
function drawRequestMarker(){
  if(!requestMap||!geo)return;
  const position=[geo.lat,geo.lng];
  if(requestMarker){requestMarker.setLatLng(position);return}
  const icon=L.divIcon({className:'request-pin',html:'<span aria-hidden="true"></span>',iconSize:[36,46],iconAnchor:[18,44]});
  requestMarker=L.marker(position,{draggable:true,icon,title:'ลากเพื่อย้ายจุดขอความช่วยเหลือ',alt:'จุดขอความช่วยเหลือที่เลือก'}).addTo(requestMap);
  requestMarker.on('dragend',()=>{const p=requestMarker.getLatLng();setRequestLocation(p.lat,p.lng,false)});
}
function setRequestLocation(lat,lng,pan=true){
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180)return false;
  locationRevision++;geo={lat,lng};
  locationElement('selected-lat').value=lat.toFixed(6);locationElement('selected-lng').value=lng.toFixed(6);
  locationElement('pin-coordinate').textContent='✓ ปักหมุดแล้ว';
  locationElement('clear-pin').hidden=false;
  locationElement('location-status').textContent='ลากหมุดเพื่อปรับได้';
  drawRequestMarker();
  if(pan&&requestMap)requestMap.setView([lat,lng],Math.max(requestMap.getZoom(),16));
  return true;
}
function ensureRequestMap(){
  if(requestMap){requestAnimationFrame(()=>requestMap.invalidateSize());return Promise.resolve(requestMap)}
  if(mapLoading)return mapLoading;
  mapLoading=loadLeaflet().then(()=>{
    locationElement('request-map').replaceChildren();
    requestMap=L.map('request-map',{scrollWheelZoom:false}).setView(geo?[geo.lat,geo.lng]:[13.7563,100.5018],geo?16:12);
    let failed=0,loaded=0;
    const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(requestMap);
    tiles.on('tileerror',()=>{failed++;if(!loaded&&failed>=3)showMapError('โหลดพื้นหลังแผนที่ไม่ได้ กรุณาตรวจอินเทอร์เน็ต หรือค้นหาจากที่อยู่ด้านล่าง')});
    tiles.on('tileload',()=>{loaded++;showMapError('')});
    requestMap.on('click',e=>setRequestLocation(e.latlng.lat,e.latlng.lng,false));
    locationElement('pin-center').disabled=false;
    drawRequestMarker();requestAnimationFrame(()=>requestMap.invalidateSize());return requestMap;
  }).catch(()=>{mapLoading=null;locationElement('request-map').textContent='แผนที่โหลดไม่สำเร็จ';showMapError('ใช้ตำแหน่งปัจจุบัน หรือค้นหาจากที่อยู่ด้านล่างได้');return null});
  return mapLoading;
}
function clearRequestLocation(){
  locationRevision++;geo=null;if(requestMarker){requestMarker.remove();requestMarker=null}
  ['selected-lat','selected-lng'].forEach(id=>locationElement(id).value='');
  locationElement('pin-coordinate').textContent='';locationElement('clear-pin').hidden=true;
  locationElement('location-status').textContent='แตะบนแผนที่เพื่อเลือกตำแหน่ง';
}
locationElement('pin-center').addEventListener('click',()=>{if(requestMap){const p=requestMap.getCenter();setRequestLocation(p.lat,p.lng,false)}});
locationElement('clear-pin').addEventListener('click',clearRequestLocation);
/* ค้นหาตำแหน่งจากที่อยู่ (OpenStreetMap Nominatim, สำรองด้วย Photon) แล้วปักหมุดอัตโนมัติ */
const ADDR_ABBR=[[/(^|\s)ถ\.\s*/g,'$1ถนน'],[/(^|\s)ซ\.\s*/g,'$1ซอย'],[/(^|\s)ต\.\s*/g,'$1ตำบล'],[/(^|\s)อ\.\s*/g,'$1อำเภอ'],[/(^|\s)จ\.\s*/g,'$1จังหวัด'],[/(^|\s)แขวง\s*/g,'$1'],[/(^|\s)เขต\s*/g,'$1'],[/กทม\.?/g,'กรุงเทพมหานคร']];
function addrNorm(q){let s=' '+q.trim();ADDR_ABBR.forEach(([r,t])=>s=s.replace(r,t));return s.replace(/\s+/g,' ').trim()}
function addrVariants(q){const n=addrNorm(q),parts=n.split(/\s+/),out=[n];
  const noSoi=n.replace(/ซอย\s*\S+(\s*แยก\s*\S+)?/g,'').replace(/\s+/g,' ').trim();if(noSoi&&noSoi!==n)out.push(noSoi);
  for(let i=1;i<parts.length&&out.length<5;i++)out.push(parts.slice(i).join(' '));return [...new Set(out)].filter(x=>x.length>=3)}
async function addrNominatim(q){const u='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=th&accept-language=th&viewbox=100.3,14.2,100.95,13.45&q='+encodeURIComponent(q);
  const r=await fetch(u,{headers:{'Accept':'application/json'}});if(!r.ok)throw new Error(r.status);return (await r.json()).map(x=>({lat:+x.lat,lng:+x.lon,name:x.display_name}))}
async function addrPhoton(q){const r=await fetch('https://photon.komoot.io/api/?limit=5&lat=13.75&lon=100.55&bbox=97.3,5.6,105.7,20.5&q='+encodeURIComponent(q));if(!r.ok)throw new Error(r.status);
  return ((await r.json()).features||[]).map(f=>{const p=f.properties||{};return {lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],name:[p.name,p.street,p.district||p.locality,p.city,p.state].filter(Boolean).join(', ')}})}
let addrSeq=0,addrTimer=null,addrLastQ='';
function addrRender(list,chosen){const ul=locationElement('addr-results');ul.replaceChildren();ul.hidden=list.length<2;
  list.forEach((r,i)=>{const li=document.createElement('li');const b=document.createElement('button');b.type='button';b.className='addr-item'+(i===chosen?' on':'');b.textContent=r.name;
    b.addEventListener('click',()=>{setRequestLocation(r.lat,r.lng);ensureRequestMap().then(m=>m&&m.setView([r.lat,r.lng],17));addrRender(list,i);locationElement('addr-status').textContent='✓ ปักหมุดที่: '+r.name.split(',').slice(0,3).join(',')+' · ลากหมุดปรับให้ตรงได้'});li.append(b);ul.append(li)})}
async function addrSearch(force){
  const input=locationElement('addr-q'),st=locationElement('addr-status'),q=input.value.trim();
  if(q.length<4){if(force)st.textContent='พิมพ์ที่อยู่อย่างน้อย 4 ตัวอักษร';return}
  if(!force&&q===addrLastQ)return;addrLastQ=q;
  const m=q.match(/^\s*(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{2,3}\.\d+)\s*$/);
  if(m){if(setRequestLocation(+m[1],+m[2])){ensureRequestMap();st.textContent='✓ ปักหมุดจากพิกัดแล้ว';locationElement('addr-results').hidden=true}return}
  const seq=++addrSeq;st.textContent='กำลังค้นหาตำแหน่ง…';
  let found=[],err=false;
  for(const v of addrVariants(q)){
    try{found=await addrNominatim(v)}catch(e){err=true}
    if(seq!==addrSeq)return;if(found.length)break;
    try{found=await addrPhoton(v)}catch(e){err=true}
    if(seq!==addrSeq)return;if(found.length)break;
    await new Promise(r=>setTimeout(r,1100));if(seq!==addrSeq)return;
  }
  if(!found.length){st.textContent=err?'ค้นหาไม่สำเร็จ (อินเทอร์เน็ต?) แตะแผนที่เพื่อปักหมุดแทนได้':'ไม่พบที่อยู่นี้ ลองพิมพ์ชื่อถนน เขต หรือสถานที่ใกล้เคียง หรือแตะแผนที่เพื่อปักหมุด';locationElement('addr-results').hidden=true;return}
  const r=found[0];setRequestLocation(r.lat,r.lng);ensureRequestMap().then(mp=>mp&&mp.setView([r.lat,r.lng],17));
  st.textContent='✓ ปักหมุดที่: '+r.name.split(',').slice(0,3).join(',')+(found.length>1?' · ไม่ใช่? เลือกจากรายการด้านล่าง':'')+' · ลากหมุดปรับให้ตรงได้';
  addrRender(found,0);
  const landmark=document.querySelector('input[name="address"]');if(landmark&&!landmark.value.trim())landmark.value=q;
}
locationElement('addr-q').addEventListener('input',()=>{clearTimeout(addrTimer);addrTimer=setTimeout(()=>addrSearch(false),1200)});
locationElement('addr-q').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(addrTimer);addrSearch(true)}});
locationElement('addr-go').addEventListener('click',()=>{clearTimeout(addrTimer);addrSearch(true)});
locationElement('addr-q').addEventListener('change',()=>{clearTimeout(addrTimer);addrSearch(false)});
locationElement('locate').addEventListener('click',()=>{
  const button=locationElement('locate'),status=locationElement('location-status');
  if(!navigator.geolocation){status.textContent='อุปกรณ์นี้ไม่รองรับตำแหน่ง ให้แตะแผนที่เพื่อปักหมุด';return}
  const requestedAt=locationRevision;button.disabled=true;status.textContent='กำลังค้นหาตำแหน่ง…';
  navigator.geolocation.getCurrentPosition(pos=>{
    button.disabled=false;if(requestedAt!==locationRevision)return;
    setRequestLocation(pos.coords.latitude,pos.coords.longitude);
    status.textContent='พบตำแหน่งแล้ว · ลากหมุดปรับได้';
    ensureRequestMap();
  },err=>{
    button.disabled=false;if(requestedAt!==locationRevision)return;
    status.textContent=err.code===1?'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง แตะแผนที่เพื่อปักหมุดแทนได้':'ค้นหาตำแหน่งไม่สำเร็จ แตะแผนที่เพื่อปักหมุดแทนได้';
  },{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
});
