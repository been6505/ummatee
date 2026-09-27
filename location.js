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
  locationElement('manual-lat').value=lat.toFixed(6);locationElement('manual-lng').value=lng.toFixed(6);
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
    tiles.on('tileerror',()=>{failed++;if(!loaded&&failed>=3)showMapError('โหลดพื้นหลังแผนที่ไม่ได้ กรุณาตรวจอินเทอร์เน็ต หรือกรอกพิกัดเองด้านล่าง')});
    tiles.on('tileload',()=>{loaded++;showMapError('')});
    requestMap.on('click',e=>setRequestLocation(e.latlng.lat,e.latlng.lng,false));
    locationElement('pin-center').disabled=false;
    drawRequestMarker();requestAnimationFrame(()=>requestMap.invalidateSize());return requestMap;
  }).catch(()=>{mapLoading=null;locationElement('request-map').textContent='แผนที่โหลดไม่สำเร็จ';showMapError('ใช้ตำแหน่งปัจจุบัน หรือกรอกพิกัดเองด้านล่างได้');return null});
  return mapLoading;
}
function clearRequestLocation(){
  locationRevision++;geo=null;if(requestMarker){requestMarker.remove();requestMarker=null}
  ['selected-lat','selected-lng','manual-lat','manual-lng'].forEach(id=>locationElement(id).value='');
  locationElement('pin-coordinate').textContent='';locationElement('clear-pin').hidden=true;
  locationElement('location-status').textContent='แตะบนแผนที่เพื่อเลือกตำแหน่ง';
}
locationElement('pin-center').addEventListener('click',()=>{if(requestMap){const p=requestMap.getCenter();setRequestLocation(p.lat,p.lng,false)}});
locationElement('clear-pin').addEventListener('click',clearRequestLocation);
locationElement('apply-coordinate').addEventListener('click',()=>{
  const lat=locationElement('manual-lat'),lng=locationElement('manual-lng');
  if(!lat.value||!lng.value||!lat.checkValidity()||!lng.checkValidity()){showMapError('กรอกละติจูดระหว่าง −90 ถึง 90 และลองจิจูดระหว่าง −180 ถึง 180');return}
  setRequestLocation(Number(lat.value),Number(lng.value));showMapError('');
});
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
