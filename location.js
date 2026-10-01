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
const ADDR_ABBR=[[/(^|\s)ถ\.\s*/g,'$1ถนน'],[/(^|\s)ซ\.\s*/g,'$1ซอย'],[/(^|\s)ต\.\s*/g,'$1ตำบล'],[/(^|\s)อ\.\s*/g,'$1อำเภอ'],[/(^|\s)จ\.\s*/g,'$1จังหวัด'],[/กทม\.?/g,'กรุงเทพมหานคร'],[/(\d)\s*\/\s*(\d)/g,'$1 แยก $2']];
const ADDR_STOP=new Set(['ถนน','ซอย','แยก','แขวง','เขต','ตำบล','อำเภอ','จังหวัด','กรุงเทพมหานคร','กรุงเทพ','หมู่','หมู่ที่','ม','เลขที่','บ้านเลขที่','ใกล้','ตรงข้าม','หน้า','หลัง']);
function addrNorm(q){let s=' '+q.trim().replace(/(บ้านเลขที่|เลขที่)\s*\d+(\s*\/\s*\d+)?/g,' ').replace(/^\s*\d+\s*\/\s*\d+\s+/,' ').replace(/(^|\s)\d+\s*\/\s*\d+(?=\s+(ถ\.|ถนน|ซ\.|ซอย|หมู่|ม\.))/g,' ').replace(/(หมู่ที่|หมู่|ม\.)\s*\d+/g,' ').replace(/\b\d{5}\b/g,' ');ADDR_ABBR.forEach(([r,t])=>s=s.replace(r,t));return s.replace(/(ถนน|ซอย|แยก|แขวง|เขต)(?=\S)/g,'$1 ').replace(/\s+/g,' ').trim()}
const addrSquash=t=>String(t||'').toLowerCase().replace(/^(ถนน|ซอย|ถ\.|ซ\.)/,'').replace(/[\s.\-,()]/g,'');
/* แยกคำค้นเป็น ชื่อถนน/ซอย, เลข (ซอย, แยก), และชื่อย่าน/เขต */
function addrParse(q){const n=addrNorm(q),toks=n.split(' ');const words=[],nums=[];let area=[];
  toks.forEach((t,i)=>{if(/^\d+$/.test(t)){nums.push(t);return}if(ADDR_STOP.has(t)){if((t==='แขวง'||t==='เขต')&&toks[i+1])area.push(toks[i+1]);return}if(t.length>=2&&!area.includes(t))words.push(t)});
  const main=words[0]||'';area=[...new Set([...area,...words.slice(1)])];return {n,main,nums,area,soiExplicit:/ซอย/.test(n),roadExplicit:/ถนน/.test(n)}}
function addrVariants(q){const P=addrParse(q),{main,nums,area}=P,v=[];const A=area.length?' '+area.join(' '):'';
  if(!main)return [{q:P.n,w:0}];
  if(nums.length){
    v.push({q:`ซอย${main} ${nums[0]}${nums[1]?' แยก '+nums[1]:''}`,w:0});
    v.push({q:`${main} ${nums.join(' แยก ')}`,w:0});
    if(nums[1])v.push({q:`ซอย${main} ${nums[0]}`,w:-3});
    v.push({q:`${main} ซอย ${nums[0]}${A}`,w:-3});
  }
  v.push({q:P.n,w:-1});
  v.push({q:`ถนน${main}${A}`,w:-6});v.push({q:main+A,w:-7});
  const seen=new Set();return v.filter(x=>x.q.length>=3&&!seen.has(x.q)&&seen.add(x.q))}
async function addrNominatim(q){const u='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=th&accept-language=th&addressdetails=0&viewbox=100.3,14.2,100.95,13.45&q='+encodeURIComponent(q);
  const r=await fetch(u,{headers:{'Accept':'application/json'}});if(!r.ok)throw new Error(r.status);return (await r.json()).map(x=>({lat:+x.lat,lng:+x.lon,name:x.display_name,title:x.name||String(x.display_name).split(',')[0]}))}
async function addrPhoton(q){const r=await fetch('https://photon.komoot.io/api/?limit=10&lat=13.75&lon=100.55&location_bias_scale=0.3&bbox=97.3,5.6,105.7,20.5&q='+encodeURIComponent(q));if(!r.ok)throw new Error(r.status);
  return ((await r.json()).features||[]).map(f=>{const p=f.properties||{};const title=p.name||p.street||'';return {lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],title,name:[title,p.district||p.locality,p.city||p.county,p.state].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join(', ')}})}
/* ให้คะแนนผลค้นหา: ต้องมีชื่อถนน/ซอยที่พิมพ์ + เลขซอย/แยกตรงกัน + อยู่ในย่านที่ระบุ */
function addrScore(r,P,w){const title=addrSquash(r.title),all=addrSquash(r.name);let s=w;
  if(P.main){const m=addrSquash(P.main);if(title.includes(m))s+=20;else if(all.includes(m))s+=8;else return -99}
  const tn=(String(r.title).match(/\d+/g)||[]);
  if(P.nums.length){if(tn[0]===P.nums[0])s+=12;else if(tn.includes(P.nums[0]))s+=4;else if(tn.length)s-=8;
    if(P.nums[1]){if(tn[1]===P.nums[1])s+=8;else if(tn.length>1)s-=4}
    else if(tn.length>1)s-=2}
  else if(tn.length)s-=3;
  if(P.soiExplicit||P.nums.length){if(/ซอย/.test(r.title))s+=2}else if(P.roadExplicit&&/^ถนน/.test(r.title))s+=2;
  P.area.forEach(a=>{if(all.includes(addrSquash(a)))s+=6});
  if(/กรุงเทพ/.test(r.name))s+=1;
  return s}
let addrSeq=0,addrTimer=null,addrLastQ='';
function addrShort(r){return String(r.name).split(',').slice(0,3).join(',')}
function addrRender(list,chosen){const ul=locationElement('addr-results');ul.replaceChildren();ul.hidden=list.length<2;
  list.forEach((r,i)=>{const li=document.createElement('li');const b=document.createElement('button');b.type='button';b.className='addr-item'+(i===chosen?' on':'')+(r.exact?' exact':'');b.textContent=addrShort(r);
    b.addEventListener('click',()=>{setRequestLocation(r.lat,r.lng);ensureRequestMap().then(m=>m&&m.setView([r.lat,r.lng],17));addrRender(list,i);locationElement('addr-status').textContent='✓ ปักหมุดที่: '+addrShort(r)+' · ลากหมุดปรับให้ตรงได้'});li.append(b);ul.append(li)})}
async function addrSearch(force){
  const input=locationElement('addr-q'),st=locationElement('addr-status'),q=input.value.trim();
  if(q.length<4){if(force)st.textContent='พิมพ์ที่อยู่อย่างน้อย 4 ตัวอักษร';return}
  if(!force&&q===addrLastQ)return;addrLastQ=q;
  const m=q.match(/^\s*(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{2,3}\.\d+)\s*$/);
  if(m){if(setRequestLocation(+m[1],+m[2])){ensureRequestMap();st.textContent='✓ ปักหมุดจากพิกัดแล้ว';locationElement('addr-results').hidden=true}return}
  const seq=++addrSeq,P=addrParse(q),vars=addrVariants(q);st.textContent='กำลังค้นหาตำแหน่ง…';
  const pool=[];let err=false;
  const add=(list,w)=>list.forEach(r=>{if(!Number.isFinite(r.lat))return;const sc=addrScore(r,P,w);if(sc<=-50)return;
    const dup=pool.find(x=>Math.abs(x.lat-r.lat)<.0015&&Math.abs(x.lng-r.lng)<.0015&&addrSquash(x.title)===addrSquash(r.title));
    if(dup){dup.score=Math.max(dup.score,sc);return}pool.push(Object.assign({},r,{score:sc}))});
  const best=()=>pool.reduce((m,x)=>Math.max(m,x.score),-99);
  const good=()=>best()>=20+(P.nums.length?12:0);
  let shown=null,myRev=-1;
  const show=final=>{
  pool.sort((x,y)=>y.score-x.score);
  const top=pool.slice(0,5);const exactNeed=20+(P.nums.length?12:0);top.forEach(r=>r.exact=r.score>=exactNeed);
  if(!top.length){if(!final)return;st.textContent=err?'ค้นหาไม่สำเร็จ (อินเทอร์เน็ต?) แตะแผนที่เพื่อปักหมุดแทนได้':'ไม่พบที่อยู่นี้ ลองพิมพ์ชื่อถนน/ซอย และเขต เช่น "ซอยกรุงเทพกรีฑา 8 สะพานสูง" หรือแตะแผนที่เพื่อปักหมุด';locationElement('addr-results').hidden=true;return}
  const r=top[0],key=r.lat+','+r.lng;if(!final&&shown===key)return;const userMoved=shown&&locationRevision!==myRev;
  if(!userMoved&&shown!==key){setRequestLocation(r.lat,r.lng);myRev=locationRevision;ensureRequestMap().then(mp=>mp&&mp.setView([r.lat,r.lng],r.exact?17:15))}shown=key;if(userMoved){addrRender(top,-1);st.textContent='เลือกจากรายการได้ หรือใช้หมุดที่ปรับไว้';return}
  st.textContent=(r.exact?'✓ ปักหมุดที่: ':'≈ ใกล้เคียงที่สุด: ')+addrShort(r)+(r.exact?'':' (ไม่พบเลขซอย/แยกตรงกัน)')+(top.length>1?' · เลือกจากรายการได้':'')+(final?' · ลากหมุดปรับให้ตรงได้':' · กำลังหาให้ตรงขึ้น…');
  addrRender(top,0);
  };
  /* รอบแรก: Photon ทุกแบบพร้อมกัน + Nominatim แบบแรก */
  await Promise.all([...vars.map(v=>addrPhoton(v.q).then(l=>add(l,v.w)).catch(()=>{err=true})),addrNominatim(vars[0].q).then(l=>add(l,vars[0].w)).catch(()=>{err=true})]);
  if(seq!==addrSeq)return;
  if(!good())show(false);
  /* ถ้ายังไม่ตรงพอ: ถาม Nominatim แบบอื่นต่อ (เว้น 1 วินาทีตามกติกาการใช้งาน) */
  for(const v of vars.slice(1)){if(good())break;await new Promise(r=>setTimeout(r,1100));if(seq!==addrSeq)return;
    try{add(await addrNominatim(v.q),v.w)}catch(e){err=true}if(seq!==addrSeq)return;if(!good())show(false)}
  show(true);
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
