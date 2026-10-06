/* แผนที่หลังบ้าน (หน้าจัดการเคส): ชั้นข้อมูลระดับน้ำ + กล้อง CCTV + โซน + จัดเส้นทาง
   - ระดับน้ำบนถนน: เซ็นเซอร์สำนักการระบายน้ำ กทม. · ระดับน้ำคลอง: ThaiWater · ถนนน้ำท่วม: Floodboard (โหลดใน verify.js)
   - กล้อง: iTIC Foundation · เส้นทาง: Valhalla (FOSSGIS) เลี่ยงจุดน้ำท่วม, สำรองด้วย OSRM
   ใช้ตัวแปรจาก admin.js: A, api, post, sev, URG, ST, hasPin, esc, toast, render, openDrawer */
const MX=(()=>{
  const S={map:null,zones:[],roster:[],L:{},on:{},side:'zones',zoneId:null,form:null,preview:null,route:null,start:null,picking:false,drawn:{}};
  const LAYERS=[['cases','📍 เคส'],['roads','🛣 ถนนน้ำท่วม'],['sensors','💧 น้ำบนถนน (กทม.)'],['stations','🌊 ระดับน้ำคลอง'],['cams','📷 กล้อง CCTV'],['zones','⭕ โซน']];
  const DEF={cases:1,roads:1,sensors:1,stations:1,cams:0,zones:1};
  const ZCOL=['#2a78d6','#0ca30c','#8e44ad','#e67e22','#16a085','#c0392b','#d81b60','#546e7a'];
  const TW={5:['#e53935','ล้นตลิ่ง'],4:['#1e40ff','น้ำมาก'],3:['#00a651','ปกติ'],2:['#ffb300','น้ำน้อย'],1:['#b5651d','น้อยวิกฤต']};
  const VEH={boat:'เรือ',truck:'รถสูง',pickup:'กระบะ',car:'รถเก๋ง/ตู้',motorbike:'มอเตอร์ไซค์',foot:'เดินเท้า',other:'อื่น ๆ'};
  try{Object.assign(S.on,DEF,JSON.parse(localStorage.getItem('uh_layers')||'{}'))}catch(e){Object.assign(S.on,DEF)}
  const saveOn=()=>{try{localStorage.setItem('uh_layers',JSON.stringify(S.on))}catch(e){}};
  const $=s=>document.querySelector(s),nf=n=>Number(n||0).toLocaleString('th-TH');
  const depthCol=d=>d>=30?'#c62828':d>=15?'#ef6c00':d>=5?'#f9a825':d>0?'#4fc3f7':'#90a4ae';
  const fmtT=t=>t?new Date(t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})+' น.':'';
  const km=(a,b)=>VERIFY.dist(a.lat,a.lng,b.lat,b.lng)/1000;
  const zoneOf=id=>S.zones.find(z=>z.id===id);
  function inZone(c,zid){const z=typeof zid==='object'?zid:zoneOf(zid);if(!z||!hasPin(c))return false;return VERIFY.dist(+c.lat,+c.lng,z.lat,z.lng)<=z.radius}

  /* ---------- โหลดโซน + ทีม ---------- */
  async function loadZones(){try{const [z,r]=await Promise.all([api({action:'zones',key:A.key}),api({action:'roster',key:A.key})]);
      if(z&&z.ok)S.zones=z.zones||[];if(r&&r.ok)S.roster=r.roster||[];fillZoneFilter();drawZones();renderSide()}catch(e){}}
  function fillZoneFilter(){const sel=$('#f-zone');if(!sel)return;const v=sel.value;sel.innerHTML='<option value="">ทุกโซน</option>'+S.zones.map(z=>`<option value="${esc(z.id)}">โซน ${esc(z.name)}</option>`).join('');sel.value=S.zones.some(z=>z.id===v)?v:''}

  /* ---------- ติดตั้งบนแผนที่: หน้าตาแบบหน้าเว็บหลัก (แผนที่เต็มพื้นที่ + ปุ่มลอยขวาบน + เมนูชั้นข้อมูล + คำอธิบายสีมุมซ้ายบน) ---------- */
  const ICON={layers:'<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',locate:'<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
    full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',close:'<path d="M6 6l12 12M18 6 6 18"/>'};
  const svg=k=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
  const ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/',BASES={road:'ถนน',sat:'ดาวเทียม',dark:'มืด'};
  function setBase(name){const m=S.map,t=(u,a,o={})=>L.tileLayer(u,{maxZoom:19,attribution:a,crossOrigin:true,...o});if(S.base)m.removeLayer(S.base);
    if(name==='sat')S.base=L.layerGroup([t(ESRI+'World_Imagery/MapServer/tile/{z}/{y}/{x}','แผนที่ © Esri'),t(ESRI+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',''),t(ESRI+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}','')]);
    else if(name==='dark')S.base=L.layerGroup([t(ESRI+'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}','แผนที่ © Esri',{maxZoom:16,maxNativeZoom:16}),t(ESRI+'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}','',{maxZoom:16,maxNativeZoom:16})]);
    else S.base=t('https://tile.openstreetmap.org/{z}/{x}/{y}.png','© OpenStreetMap');
    S.base.addTo(m);{const tok=S.baseTok=(S.baseTok||0)+1;if((name==='road'||name==='dark')&&typeof OFM!=='undefined')OFM.layer(name).then(l=>{if(!l||tok!==S.baseTok)return;m.removeLayer(S.base);S.base=l;l.addTo(m)})} /* OpenFreeMap (เวกเตอร์ ป้ายไทย) ทับเมื่อโหลดเสร็จ */S.baseName=name;try{localStorage.setItem('uh_base',name)}catch(e){}layerMenu()}
  function attach(map){S.map=map;['sensors','stations','cams','zones','route'].forEach(k=>S.L[k]=L.layerGroup());
    map.eachLayer(l=>{if(l instanceof L.TileLayer)map.removeLayer(l)});
    map.attributionControl.setPrefix(false);map.attributionControl.addAttribution('น้ำท่วม: Floodboard (CC-BY), สำนักการระบายน้ำ กทม., ThaiWater · กล้อง: iTIC');
    if(map.zoomControl)map.zoomControl.setPosition('bottomright');L.control.scale({metric:true,imperial:false,position:'bottomleft'}).addTo(map);
    let saved='road';try{saved=localStorage.getItem('uh_base')||'road'}catch(e){}setBase(BASES[saved]?saved:'road');
    S.L.route.addTo(map);map.on('click',onMapClick);fabs();applyVis();loadZones();renderSide()}
  function fabs(){$('#mx-fabs').innerHTML=`<button type="button" class="fab" data-fab="layers" aria-label="แบบแผนที่และชั้นข้อมูล" title="แบบแผนที่และชั้นข้อมูล" aria-haspopup="dialog" aria-expanded="false" aria-controls="layer-menu">${svg('layers')}</button>`+
    `<button type="button" class="fab" data-fab="locate" aria-label="ตำแหน่งของฉัน" title="ตำแหน่งของฉัน">${svg('locate')}</button>`+
    `<button type="button" class="fab" data-fab="full" aria-label="ขยายแผนที่เต็มจอ" title="ขยายแผนที่เต็มจอ">${svg('full')}</button>`}
  function layerMenu(){const m=$('#layer-menu');if(!m)return;const F=VERIFY.F;
    m.innerHTML=`<div class="lm-bases">${Object.entries(BASES).map(([k,t])=>`<button type="button" data-base="${k}" aria-pressed="${S.baseName===k}">${t}</button>`).join('')}</div><hr>`+
      LAYERS.map(([k,t])=>`<label class="tg"><input type="checkbox" data-lyr="${k}" ${S.on[k]?'checked':''}><span>${t}</span></label>`+
        (k==='roads'?`<div class="flood-key"><span><i style="background:#d32f2f"></i>ผ่านไม่ได้ · ใช้เรือ</span><span><i style="background:#f57c00"></i>เสี่ยง</span><span><i style="background:#fbc02d"></i>น้ำขัง ผ่านได้</span></div>`:'')+
        (k==='sensors'?`<div class="flood-key"><span><i style="background:#c62828"></i>≥30 ซม.</span><span><i style="background:#ef6c00"></i>15–30 ซม.</span><span><i style="background:#f9a825"></i>5–15 ซม.</span><span><i style="background:#4fc3f7"></i>ต่ำกว่า 5 ซม.</span></div>`:'')+
        (k==='stations'?`<div class="flood-key">${[5,4,3,2].map(n=>`<span><i class="sq" style="background:${TW[n][0]}"></i>${TW[n][1]}</span>`).join('')}</div>`:'')).join('')+
      `<p class="lm-src">${F.sensors.length?`เซ็นเซอร์ กทม. มีน้ำ ${nf(F.sensors.filter(x=>x.now>0).length)} จาก ${nf(F.sensors.length)} จุด`:'กำลังโหลดข้อมูลน้ำ…'}${F.loaded?' · อัปเดต '+fmtT(F.loaded):''}</p>`}
  function menuOpen(on){const m=$('#layer-menu'),b=$('[data-fab="layers"]');if(!m)return;on=on===undefined?m.hidden:on;if(on)layerMenu();m.hidden=!on;if(b){b.setAttribute('aria-expanded',String(on));b.classList.toggle('on',on)}}
  function fullscreen(on){const w=$('#map-wrap');on=on===undefined?!w.classList.contains('fs'):on;
    w.classList.toggle('fs',on);document.body.classList.toggle('noscroll',on);
    const b=$('[data-fab="full"]');if(b){b.innerHTML=svg(on?'close':'full');b.title=on?'ออกจากเต็มจอ (Esc)':'ขยายแผนที่เต็มจอ';b.setAttribute('aria-label',b.title)}
    setTimeout(()=>S.map&&S.map.invalidateSize(),80)}
  function locate(btn){if(!navigator.geolocation){toast('อุปกรณ์นี้หาตำแหน่งไม่ได้');return}btn.classList.add('busy');
    navigator.geolocation.getCurrentPosition(p=>{btn.classList.remove('busy');const ll=[p.coords.latitude,p.coords.longitude];
      if(!S.me)S.me=L.marker(ll,{icon:L.divIcon({className:'me-dot',html:'<span></span>',iconSize:[22,22]}),interactive:false,zIndexOffset:2000}).addTo(S.map);
      S.me.setLatLng(ll);S.map.flyTo(ll,Math.max(S.map.getZoom(),15),{duration:.6})},
      ()=>{btn.classList.remove('busy');toast('หาตำแหน่งไม่ได้ ตรวจสอบว่าอนุญาตให้ใช้ตำแหน่งแล้ว')},{enableHighAccuracy:true,timeout:15000})}
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const m=$('#layer-menu');if(m&&!m.hidden){menuOpen(false);return}
    if($('#map-wrap')?.classList.contains('fs')&&!document.querySelector('#drawer:not([hidden])'))fullscreen(false)});
  document.addEventListener('click',e=>{const f=e.target.closest('[data-fab]');
    if(f){const k=f.dataset.fab;if(k==='layers')menuOpen();else if(k==='locate')locate(f);else if(k==='full')fullscreen();return}
    const bs=e.target.closest('[data-base]');if(bs){setBase(bs.dataset.base);return}
    const m=$('#layer-menu');if(m&&!m.hidden&&!e.target.closest('#layer-menu'))menuOpen(false)});
  document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||!t.dataset.lyr||!t.closest('#layer-menu'))return;const k=t.dataset.lyr;S.on[k]=t.checked;saveOn();applyVis();if(S.on[k]||k==='cams')draw()});
  function group(k){return k==='cases'?A.layer:k==='roads'?A.flood:S.L[k]}
  function applyVis(){LAYERS.forEach(([k])=>{const g=group(k);if(!g)return;if(S.on[k]){if(!S.map.hasLayer(g))g.addTo(S.map)}else if(S.map.hasLayer(g))S.map.removeLayer(g)});legend()}

  /* ---------- วาดชั้นข้อมูล ---------- */
  function refresh(list){S.list=list;draw();const a=document.activeElement;if(!S.form&&!(a&&a.closest&&a.closest('#map-side')))renderSide()}
  function draw(){if(!S.map)return;const F=VERIFY.F;
    if(S.on.sensors&&S.drawn.sensors!==F.loaded+':'+F.sensors.length){S.drawn.sensors=F.loaded+':'+F.sensors.length;S.L.sensors.clearLayers();
      F.sensors.filter(x=>x.status!=='malfunction'&&x.now>0).sort((a,b)=>a.now-b.now).forEach(x=>{const d=x.now;
        L.circleMarker([x.lat,x.lng],{radius:d>=30?9:d>=15?8:d>=5?7:3,color:'#fff',weight:d>0?1.5:.5,fillColor:depthCol(d),fillOpacity:d>0?.95:.45})
          .bindTooltip(`💧 <b>${esc(x.name)}</b><br>น้ำบนถนน <b>${d} ซม.</b>${x.max!=null?` · สูงสุดวันนี้ ${x.max} ซม.`:''}<br>${esc(x.district?'เขต'+x.district:'')} · ${fmtT(x.t)}`).addTo(S.L.sensors)})}
    if(S.on.stations&&S.drawn.stations!==F.loaded+':'+F.stations.length){S.drawn.stations=F.loaded+':'+F.stations.length;S.L.stations.clearLayers();
      F.stations.forEach(x=>{const [col,lab]=TW[x.situation]||['#78909c','ไม่ทราบ'];
        L.marker([x.lat,x.lng],{icon:L.divIcon({className:'wl-ic',html:`<i style="background:${col}"></i>`,iconSize:[18,18]})})
          .bindTooltip(`🌊 <b>${esc(x.name)}</b><br>${esc(lab)} · ระดับน้ำ ${x.level!=null?x.level.toFixed(2):'-'} ม.รทก.${x.diff!=null?` · ${x.diff>0?'สูงกว่าตลิ่ง':'ต่ำกว่าตลิ่ง'} ${Math.abs(x.diff).toFixed(2)} ม.`:''}<br>${esc(x.agency)} · ${fmtT(x.t)}`).addTo(S.L.stations)})}
    // กล้อง ~1,400 ตัว (POPNIX + iTIC): วาดบน canvas แสดงเมื่อซูมระดับ 12 ขึ้นไป · ป๊อปอัปเล่นภาพสด/ภาพนิ่งล่าสุด (camlive.js)
    if(S.on.cams&&S.drawn.cams!==F.cams.length){S.drawn.cams=F.cams.length;if(S.camLayer)S.camLayer.remove();S.camLayer=CAMLIVE.layer(S.map,F.cams)}
    if(!S.on.cams&&S.camLayer){S.camLayer.remove();S.camLayer=null;S.drawn.cams=-1}
    drawZones();legend()}
  function drawZones(){if(!S.map)return;S.L.zones.clearLayers();
    // วงโซนไม่รับคลิก (ไม่บังหมุดเคส) ใช้ป้ายชื่อตรงกลางโซนแทน
    S.zones.forEach(z=>{const st=zoneStats(z);L.circle([z.lat,z.lng],{radius:z.radius,color:z.color,weight:2,fillColor:z.color,fillOpacity:S.zoneId===z.id?.16:.06,dashArray:S.zoneId===z.id?null:'6 6',interactive:false}).addTo(S.L.zones);
      L.marker([z.lat,z.lng],{icon:L.divIcon({className:'zlab',html:`<span style="border-color:${esc(z.color)}"><i style="background:${esc(z.color)}"></i>${esc(z.name)}${st.crit?` <b>${st.crit}</b>`:''}</span>`,iconSize:null}),keyboard:false})
        .bindTooltip(`<b>โซน ${esc(z.name)}</b><br>ยังไม่เสร็จ ${st.act} เคส${st.crit?` · วิกฤต ${st.crit}`:''} · ${st.teams.length} ทีม`)
        .on('click',()=>{if(S.form||S.picking)return;S.side='zone';S.zoneId=z.id;drawZones();renderSide()}).addTo(S.L.zones)})}
  function zoneStats(z){const act=A.cases.filter(c=>c.status!=='done'&&inZone(c,z));return {act:act.length,crit:act.filter(c=>sev(c)===3).length,open:act.filter(c=>c.status==='open').length,ppl:act.reduce((s,c)=>s+(Number(c.people)||1),0),teams:S.roster.filter(t=>t.zone===z.name)}}
  function legend(){const el=$('#map-legend');if(!el)return;const p=[];
    if(S.on.cases)p.push(`<span><i class="lp danger"></i>วิกฤต</span><span><i class="lp urgent"></i>เร่งด่วน</span><span><i class="lp open"></i>รอช่วย</span><span><i class="lp going"></i>กำลังไป</span><span><i class="lp done"></i>ช่วยแล้ว</span>`);
    const x=[];if(S.on.roads)x.push('<span><i class="ln" style="background:#f57c00"></i>ถนนน้ำท่วม</span>');if(S.on.sensors)x.push('<span><i style="background:#ef6c00"></i>จุดวัดน้ำ กทม.</span>');
    if(S.on.stations)x.push('<span><i class="sq" style="background:#1e40ff"></i>ระดับน้ำคลอง</span>');if(S.route)x.push('<span><i class="ln" style="background:#0d5f62"></i>เส้นทาง</span>');
    el.innerHTML=p.join('')+(x.length?`<span class="lg-sep"></span>${x.join('')}`:'');el.hidden=!p.length&&!x.length;if(!$('#layer-menu')?.hidden)layerMenu()}

  /* ---------- คลิกแผนที่: วางจุดกลางโซน / เลือกจุดเริ่มเส้นทาง ---------- */
  function onMapClick(e){const ll=e.latlng;if(!ll)return;
    if(S.form){S.form.lat=+ll.lat.toFixed(6);S.form.lng=+ll.lng.toFixed(6);showPreview();renderSide();return}
    if(S.picking){S.start={lat:ll.lat,lng:ll.lng,label:'จุดที่เลือกบนแผนที่'};S.picking=false;S.map.getContainer().classList.remove('picking');renderSide()}}
  function showPreview(){const f=S.form;if(!f||f.lat==null)return clearPreview();if(!S.preview)S.preview=L.circle([f.lat,f.lng],{radius:f.radius,color:f.color,weight:3,fillOpacity:.15,interactive:false}).addTo(S.map);
    S.preview.setLatLng([f.lat,f.lng]);S.preview.setRadius(f.radius);S.preview.setStyle({color:f.color,fillColor:f.color})}
  function clearPreview(){if(S.preview){S.map.removeLayer(S.preview);S.preview=null}}

  /* ---------- แผงด้านข้าง ---------- */
  const side=h=>{const el=$('#map-side');if(el)el.innerHTML=`<button type="button" class="ms-handle" data-sheet aria-expanded="${el.classList.contains('open')}"><i></i><span>${S.route?`เส้นทาง ${S.route.stops.length} จุด`:S.zones.length?`โซน ${S.zones.length} · จัดเส้นทาง`:'โซน · จัดเส้นทาง'}</span></button><div class="ms-tabs"><button data-side="zones" aria-selected="${S.side==='zones'||S.side==='zone'}">⭕ โซน</button><button data-side="route" aria-selected="${S.side==='route'}">🧭 จัดเส้นทาง</button></div>${h}`};
  function renderSide(){if(!$('#map-side'))return;
    if(S.form)return side(zoneForm());
    if(S.side==='zone'&&zoneOf(S.zoneId))return side(zoneDetail(zoneOf(S.zoneId)));
    if(S.side==='route')return side(routePanel());
    side(`<div class="ms-h"><b>โซนทั้งหมด</b><button class="btn primary sm" data-z-add>+ เพิ่มโซน</button></div>`+(S.zones.length?S.zones.map(z=>{const st=zoneStats(z);
      return `<button class="zcard" data-z-open="${esc(z.id)}"><i style="background:${esc(z.color)}"></i><span><b>${esc(z.name)}</b><small>ยังไม่เสร็จ ${st.act} เคส${st.crit?` · <em>วิกฤต ${st.crit}</em>`:''} · ${st.ppl} คน · ${st.teams.length} ทีม · รัศมี ${(z.radius/1000).toFixed(1)} กม.</small></span></button>`}).join('')
      :`<p class="muted small">ยังไม่มีโซน แบ่งพื้นที่เป็นโซนเพื่อจัดทีมรับผิดชอบ และกรองเคสตามโซนได้</p>`))}
  function zoneForm(){const f=S.form;
    return `<div class="ms-h"><b>${f.id?'แก้ไขโซน':'เพิ่มโซนใหม่'}</b></div>
    <p class="ms-tip ${f.lat==null?'wait':''}">${f.lat==null?'👆 แตะบนแผนที่เพื่อวางจุดกลางโซน':'✓ วางจุดกลางแล้ว แตะที่อื่นเพื่อย้าย'}</p>
    <label class="fld"><span>ชื่อโซน</span><input id="zf-name" maxlength="60" value="${esc(f.name)}" placeholder="เช่น บางบัวทอง / A1"></label>
    <label class="fld"><span>รัศมี <b id="zf-rv">${(f.radius/1000).toFixed(1)} กม.</b></span><input id="zf-r" type="range" min="300" max="10000" step="100" value="${f.radius}"></label>
    <div class="fld"><span>สี</span><div class="zsw">${ZCOL.map(c=>`<button type="button" data-zc="${c}" style="background:${c}" aria-label="สี ${c}" aria-pressed="${c===f.color}"></button>`).join('')}</div></div>
    <label class="fld"><span>หมายเหตุ</span><input id="zf-note" maxlength="200" value="${esc(f.note||'')}" placeholder="เช่น จุดรวมพล วัด…"></label>
    <div class="ms-act"><button class="btn primary sm" data-z-save ${f.lat==null?'disabled':''}>บันทึกโซน</button><button class="btn ghost sm" data-z-cancel>ยกเลิก</button>${f.id?'<button class="btn ghost sm danger" data-z-del>ลบโซน</button>':''}</div>`}
  function zoneDetail(z){const st=zoneStats(z),cases=A.cases.filter(c=>c.status!=='done'&&inZone(c,z)).sort((a,b)=>sev(b)-sev(a));
    return `<div class="ms-h"><b><i class="zdot" style="background:${esc(z.color)}"></i>โซน ${esc(z.name)}</b><button class="btn ghost sm" data-side="zones">← ทั้งหมด</button></div>
    <div class="zstat"><span><b>${st.act}</b>ยังไม่เสร็จ</span><span class="r"><b>${st.crit}</b>วิกฤต</span><span><b>${st.open}</b>ยังไม่มีทีม</span><span><b>${nf(st.ppl)}</b>คน</span></div>
    ${z.note?`<p class="small muted">${esc(z.note)}</p>`:''}
    <div class="ms-act"><button class="btn primary sm" data-route-zone="${esc(z.id)}">🧭 จัดเส้นทางโซนนี้</button><button class="btn ghost sm" data-z-filter="${esc(z.id)}">ดูเคสในโซน</button><button class="btn ghost sm" data-z-edit="${esc(z.id)}">✎ แก้ไข</button></div>
    <h4>ทีมรับผิดชอบ</h4>${S.roster.length?`<div class="zteams">${S.roster.map(t=>`<label class="chk"><input type="checkbox" data-z-team="${esc(t.id)}" ${t.zone===z.name?'checked':''}><span>${esc(t.name)}${t.vehicle?` <small>${esc(VEH[t.vehicle]||'')}</small>`:''}${t.zone&&t.zone!==z.name?` <small>(อยู่โซน ${esc(t.zone)})</small>`:''}</span></label>`).join('')}</div>`:'<p class="small muted">ยังไม่มีทีม เพิ่มได้ที่หน้า จัดทีม</p>'}
    <h4>เคสในโซน (${cases.length})</h4><div class="zcases">${cases.slice(0,30).map(c=>`<button data-open-case="${esc(c.id)}"><span class="urg urg-${sev(c)}">${URG[sev(c)]}</span> ${esc((c.needs||[]).slice(0,2).join(', ')||'-')} · ${c.people||1} คน<small>${esc(ST[c.status])}${c.volunteer?' · '+esc(c.volunteer):''}</small></button>`).join('')||'<p class="small muted">ไม่มีเคสที่ยังไม่เสร็จ</p>'}</div>`}

  /* ---------- เส้นทาง ---------- */
  const R={src:'filtered',onlyOpen:true,max:10,avoid:true};
  function routePanel(){const r=S.route;
    const opts=[['filtered','เคสที่แสดงอยู่ตามตัวกรอง'],...S.zones.map(z=>['zone:'+z.id,'โซน '+z.name])];
    return `<div class="ms-h"><b>จัดเส้นทาง</b>${r?'<button class="btn ghost sm" data-r-clear>ล้าง</button>':''}</div>
    <label class="fld"><span>เคสจาก</span><select id="r-src">${opts.map(([v,t])=>`<option value="${esc(v)}" ${R.src===v?'selected':''}>${esc(t)}</option>`).join('')}</select></label>
    <div class="r-row"><label class="fld"><span>จำนวนจุดสูงสุด</span><select id="r-max">${[5,8,10,15].map(n=>`<option ${R.max===n?'selected':''}>${n}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" id="r-open" ${R.onlyOpen?'checked':''}><span>เฉพาะเคสที่ยังไม่มีทีม</span></label></div>
    <div class="fld"><span>จุดเริ่มต้น</span><div class="r-start"><b>${S.start?esc(S.start.label):'ยังไม่ได้เลือก (เริ่มจากเคสแรก)'}</b><div><button type="button" class="btn ghost sm" data-r-gps>📍 ตำแหน่งฉัน</button><button type="button" class="btn ghost sm ${S.picking?'primary':''}" data-r-pick>${S.picking?'แตะแผนที่…':'แตะเลือกบนแผนที่'}</button></div></div></div>
    <label class="chk"><input type="checkbox" id="r-avoid" ${R.avoid?'checked':''}><span>เลี่ยงถนนน้ำท่วม / ถนนปิด (Floodboard + เซ็นเซอร์ กทม.)</span></label>
    <p class="ms-tip">เรียงเคสวิกฤตก่อน แล้วเร่งด่วน แล้วทั่วไป ในแต่ละระดับไปจุดที่ใกล้ที่สุดก่อน</p>
    <button class="btn primary" data-r-go style="width:100%">🧭 คำนวณเส้นทาง</button>
    <div id="r-out">${r?routeResult(r):''}</div>`}
  function candidates(){let cs=R.src.startsWith('zone:')?A.cases.filter(c=>inZone(c,R.src.slice(5))):(S.list||[]);
    cs=cs.filter(c=>hasPin(c)&&c.status!=='done'&&(!R.onlyOpen||c.status==='open'));return cs}
  function order(cs,start){const left=cs.map(c=>({c,lat:+c.lat,lng:+c.lng,sv:sev(c)})),out=[];let cur=start||null;
    [3,2,1].forEach(sv=>{let tier=left.filter(p=>p.sv===sv);while(tier.length){if(!cur){cur=tier.shift();out.push(cur);continue}let bi=0,bd=Infinity;tier.forEach((p,i)=>{const d=km(cur,p);if(d<bd){bd=d;bi=i}});cur=tier.splice(bi,1)[0];out.push(cur)}});return out}
  function decode6(str){let i=0,lat=0,lng=0;const out=[];while(i<str.length){let b,sh=0,r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lat+=r&1?~(r>>1):r>>1;sh=0;r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lng+=r&1?~(r>>1):r>>1;out.push([lat/1e6,lng/1e6])}return out}
  // Valhalla สาธารณะรับได้ครั้งละไม่เกิน 10 จุด: แบ่งเป็นช่วง (จุดท้ายของช่วงก่อน = จุดแรกของช่วงถัดไป) แล้วต่อกัน
  async function valhalla(locs,excl){const parts=[];for(let i=0;i<locs.length-1;i+=9)parts.push(locs.slice(i,i+10));
    const rs=[];for(const p of parts)rs.push(await valhallaOne(p,excl));
    const legs=rs.flatMap(r=>r.legs);return {engine:'Valhalla',legs,coords:legs.flatMap(l=>l.coords),km:rs.reduce((a,r)=>a+r.km,0),min:rs.reduce((a,r)=>a+r.min,0)}}
  async function valhallaOne(locs,excl){const body={locations:locs.map(p=>({lat:p.lat,lon:p.lng,type:'break'})),costing:'auto',units:'kilometers',directions_type:'none'};
    if(excl.length)body.exclude_locations=excl.map(p=>({lat:p.lat,lon:p.lng}));
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),25000);
    try{const j=await fetch('https://valhalla1.openstreetmap.de/route',{method:'POST',headers:{'content-type':'text/plain;charset=UTF-8'},body:JSON.stringify(body),signal:ctl.signal}).then(r=>r.json());
      if(!j.trip)throw new Error(j.error||'no_route');const legs=j.trip.legs.map(l=>({km:l.summary.length,min:l.summary.time/60,coords:decode6(l.shape)}));
      return {engine:'Valhalla',legs,coords:legs.flatMap(l=>l.coords),km:j.trip.summary.length,min:j.trip.summary.time/60}}finally{clearTimeout(tm)}}
  async function osrm(locs){const u='https://router.project-osrm.org/route/v1/driving/'+locs.map(p=>p.lng.toFixed(6)+','+p.lat.toFixed(6)).join(';')+'?overview=full&geometries=geojson';
    const j=await fetch(u).then(r=>r.json());if(j.code!=='Ok')throw new Error('osrm');const r=j.routes[0];
    return {engine:'OSRM',legs:r.legs.map(l=>({km:l.distance/1000,min:l.duration/60})),coords:r.geometry.coordinates.map(c=>[c[1],c[0]]),km:r.distance/1000,min:r.duration/60}}
  // จุดน้ำท่วมที่ควรเลี่ยง: ถนนปิด/ลึก ≥30 ซม. (Floodboard) ทุก ~80 ม. + เซ็นเซอร์ กทม. ≥20 ซม.
  function hazards(){const out=[],F=VERIFY.F;
    F.roads.forEach(r=>{const d=r.depth||0,bad=r.closed||r.verdict==='blocked'||r.verdict==='risky'||d>=30;if(!bad)return;
      r.lines.forEach(line=>{let acc=80;for(let i=0;i<line.length;i++){const p={lat:line[i][1],lng:line[i][0]};if(i){const q={lat:line[i-1][1],lng:line[i-1][0]};acc+=km(p,q)*1000}if(acc>=80){out.push({...p,name:r.name,depth:r.depth,closed:r.closed});acc=0}}})});
    F.sensors.forEach(x=>{if(x.status!=='malfunction'&&x.now>=20)out.push({lat:x.lat,lng:x.lng,name:x.name+' (เซ็นเซอร์)',depth:x.now})});return out}
  function hitsOn(coords,hz,thr=35){if(!hz.length)return [];const cell=.002,grid=new Map();hz.forEach((h,i)=>{const k=Math.floor(h.lat/cell)+':'+Math.floor(h.lng/cell);(grid.get(k)||grid.set(k,[]).get(k)).push(i)});
    const hit=new Set();coords.forEach(([la,ln])=>{const a=Math.floor(la/cell),b=Math.floor(ln/cell);for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++){(grid.get((a+x)+':'+(b+y))||[]).forEach(i=>{if(!hit.has(i)&&VERIFY.dist(la,ln,hz[i].lat,hz[i].lng)<=thr)hit.add(i)})}});
    return [...hit].map(i=>hz[i])}
  async function compute(){const cs=candidates();if(!cs.length){toast('ไม่มีเคสที่มีหมุดให้จัดเส้นทาง ลองเปลี่ยนตัวกรองหรือโซน');return}
    const z=R.src.startsWith('zone:')?zoneOf(R.src.slice(5)):null,start=S.start||null;
    const stops=order(cs,start).slice(0,R.max),locs=[...(start?[start]:[]),...stops];if(locs.length<2){toast('ต้องมีอย่างน้อย 2 จุด (เพิ่มจุดเริ่มต้นหรือเคส)');return}
    const out=$('#r-out');if(out)out.innerHTML='<p class="muted small">กำลังคำนวณเส้นทาง…</p>';
    const hz=R.avoid?hazards():[],keep=locs.map(p=>({lat:p.lat,lng:p.lng}));
    let res=null,excl=[];
    try{res=await valhalla(locs,[]);
      if(R.avoid)for(let it=0;it<2;it++){const hits=hitsOn(res.coords,hz).filter(h=>keep.every(k=>VERIFY.dist(h.lat,h.lng,k.lat,k.lng)>150));if(!hits.length)break;
        excl=[...excl,...hits].slice(0,50);try{const r2=await valhalla(locs,excl);res=r2}catch(e){break}}}
    catch(e){try{res=await osrm(locs)}catch(e2){if(out)out.innerHTML='<p class="warn small">คำนวณเส้นทางไม่สำเร็จ (บริการแผนที่ไม่ตอบ) ลองใหม่อีกครั้ง</p>';return}}
    res.stops=stops;res.start=start;res.zone=z;res.excluded=excl.length;res.hits=hitsOn(res.coords,hz.length?hz:hazards());
    S.route=res;drawRoute();renderSide();legend()}
  function drawRoute(){const g=S.L.route;g.clearLayers();const r=S.route;if(!r)return;
    L.polyline(r.coords,{color:'#fff',weight:9,opacity:.9,interactive:false}).addTo(g);L.polyline(r.coords,{color:'#0d5f62',weight:5,opacity:.95,interactive:false}).addTo(g);
    const seen=new Set();r.hits.forEach(h=>{const k=h.name;if(seen.has(k))return;seen.add(k);L.circleMarker([h.lat,h.lng],{radius:8,color:'#c62828',weight:3,fillColor:'#fff',fillOpacity:1}).bindTooltip(`⚠ ${esc(h.name)}${h.depth!=null?` ~${h.depth} ซม.`:''}`).addTo(g)});
    if(r.start)L.marker([r.start.lat,r.start.lng],{icon:L.divIcon({className:'rt-ic start',html:'▶',iconSize:[26,26]})}).bindTooltip('จุดเริ่มต้น').addTo(g);
    r.stops.forEach((p,i)=>L.marker([p.lat,p.lng],{icon:L.divIcon({className:'rt-ic u'+p.sv,html:String(i+1),iconSize:[26,26]})}).bindTooltip(`${i+1}. ${URG[p.sv]} · ${esc((p.c.needs||[]).join(', '))}`).on('click',()=>openDrawer(p.c.id)).addTo(g));
    S.map.fitBounds(r.coords,{padding:[30,30]})}
  function gmLinks(r){const pts=[...(r.start?[r.start]:[]),...r.stops].map(p=>`${(+p.lat).toFixed(6)},${(+p.lng).toFixed(6)}`),links=[];
    for(let i=0;i<pts.length-1;i+=10){const seg=pts.slice(i,i+11);links.push('https://www.google.com/maps/dir/?api=1&travelmode=driving&origin='+seg[0]+'&destination='+seg[seg.length-1]+(seg.length>2?'&waypoints='+encodeURIComponent(seg.slice(1,-1).join('|')):''))}return links}
  function routeResult(r){const names=[...new Set(r.hits.map(h=>h.name))],off=r.start?1:0,links=gmLinks(r);
    return `<div class="r-sum"><b>${r.stops.length} จุด · ${r.km.toFixed(1)} กม. · ~${Math.round(r.min)} นาที</b><small>${esc(r.engine)}${r.excluded?` · เลี่ยงจุดน้ำท่วม ${r.excluded} จุด`:''}${r.zone?' · โซน '+esc(r.zone.name):''}</small></div>
    ${names.length?`<div class="r-warn">⚠ เส้นทางยังผ่านจุดน้ำท่วม ${names.length} แห่ง: ${names.slice(0,5).map(esc).join(', ')}${names.length>5?'…':''}<br><small>มักเป็นจุดที่ใกล้บ้านผู้แจ้ง เลี่ยงไม่ได้ · ควรใช้รถสูงหรือเรือ</small></div>`:r.coords.length?'<div class="r-ok">✓ ไม่พบถนนน้ำท่วมลึกบนเส้นทาง (ตามข้อมูลที่มี)</div>':''}
    <ol class="r-stops">${r.stops.map((p,i)=>{const c=p.c,lg=(off?r.legs[i]:r.legs[i-1])||null;return `<li><button data-open-case="${esc(c.id)}"><span class="urg urg-${p.sv}">${URG[p.sv]}</span> ${esc((c.needs||[]).slice(0,2).join(', ')||'-')} · ${c.people||1} คน<small>${esc([c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ')||'-')}${lg?` · +${lg.km.toFixed(1)} กม.`:''}</small></button></li>`}).join('')}</ol>
    <div class="ms-act">${links.map((u,i)=>`<a class="btn primary sm" href="${esc(u)}" target="_blank" rel="noopener">นำทาง Google Maps${links.length>1?' ช่วง '+(i+1):''}</a>`).join('')}<button class="btn ghost sm" data-r-copy>คัดลอกส่งไลน์</button></div>
    ${S.roster.length?`<div class="r-assign"><select id="r-team"><option value="">มอบหมายเส้นทางให้ทีม…</option>${S.roster.map(t=>`<option>${esc(t.name)}</option>`).join('')}</select><button class="btn primary sm" data-r-assign>มอบหมาย</button></div>`:''}`}
  async function assign(team){const r=S.route;if(!r||!team)return;const ids=r.stops.filter(p=>p.c.status==='open').map(p=>p.c.id);
    if(!ids.length){toast('ทุกเคสในเส้นทางมีทีมแล้ว');return}if(!confirm(`มอบหมาย ${ids.length} เคสในเส้นทางนี้ให้ "${team}" และเปลี่ยนสถานะเป็นทีมกำลังไป?`))return;
    let ok=0;for(const id of ids){try{const x=await post({action:'update',key:A.key,id,status:'going',volunteer:team});if(x&&x.ok)ok++}catch(e){}}
    toast(`มอบหมายให้ ${team} แล้ว ${ok}/${ids.length} เคส`,ok===ids.length);if(typeof load==='function')load()}
  function copyRoute(){const r=S.route;if(!r)return;const links=gmLinks(r);
    const txt=`🧭 เส้นทาง UM+${r.zone?' โซน '+r.zone.name:''} · ${r.stops.length} จุด · ${r.km.toFixed(1)} กม. · ~${Math.round(r.min)} นาที\n`+r.stops.map((p,i)=>{const c=p.c;return `${i+1}. [${URG[p.sv]}] #${c.id} · ${(c.needs||[]).join(', ')} · ${c.people||1} คน\n   ${[c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ')}${c.name?'\n   ติดต่อ: '+c.name:''}${c.phone?' '+c.phone:''}\n   https://www.google.com/maps?q=${(+c.lat).toFixed(6)},${(+c.lng).toFixed(6)}`}).join('\n')+
      ([...new Set(r.hits.map(h=>h.name))].length?`\n⚠ ระวังน้ำท่วม: ${[...new Set(r.hits.map(h=>h.name))].slice(0,6).join(', ')}`:'')+`\n\nนำทางทั้งเส้น:\n${links.join('\n')}`;
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('คัดลอกแล้ว วางในไลน์ได้เลย (มีเบอร์โทรผู้แจ้ง ส่งเฉพาะกลุ่มทีม)',true)).catch(()=>toast('คัดลอกไม่สำเร็จ'))}

  /* ---------- ปุ่มในแผงด้านข้าง ---------- */
  document.addEventListener('input',e=>{const t=e.target;if(!t.closest||!t.closest('#map-side'))return;
    if(t.id==='zf-r'&&S.form){S.form.radius=+t.value;$('#zf-rv').textContent=(S.form.radius/1000).toFixed(1)+' กม.';showPreview()}
    if(t.id==='zf-name'&&S.form)S.form.name=t.value;if(t.id==='zf-note'&&S.form)S.form.note=t.value});
  document.addEventListener('change',e=>{const t=e.target;if(!t.closest||!t.closest('#map-side'))return;
    if(t.id==='r-src')R.src=t.value;if(t.id==='r-max')R.max=+t.value;if(t.id==='r-open')R.onlyOpen=t.checked;if(t.id==='r-avoid')R.avoid=t.checked;
    if(t.dataset.zTeam){const tm=S.roster.find(x=>x.id===t.dataset.zTeam),z=zoneOf(S.zoneId);if(tm&&z)saveTeamZone(tm,t.checked?z.name:(tm.zone===z.name?'':tm.zone))}});
  async function saveTeamZone(t,zone){try{const r=await post({action:'roster_save',key:A.key,team:{...t,zone},by:'หลังบ้าน'});if(r&&r.ok){t.zone=zone;toast(zone?`${t.name} → โซน ${zone}`:`${t.name} ออกจากโซน`,true);drawZones();renderSide()}else toast('บันทึกไม่สำเร็จ: '+(r&&r.error||''))}catch(e){toast('บันทึกไม่สำเร็จ')}}
  document.addEventListener('click',async e=>{const t=e.target.closest('button,a');if(!t||!t.closest('#map-side'))return;const d=t.dataset;
    if(d.sheet!==undefined){const o=$('#map-side').classList.toggle('open');t.setAttribute('aria-expanded',String(o));return}
    if(d.side!==undefined){S.side=d.side;S.form=null;clearPreview();if(S.side!=='zone')S.zoneId=null;drawZones();renderSide();return}
    if(d.zAdd!==undefined){S.form={name:'',radius:1500,color:ZCOL[S.zones.length%ZCOL.length],lat:null,lng:null,note:''};renderSide();return}
    if(d.zOpen){S.side='zone';S.zoneId=d.zOpen;const z=zoneOf(d.zOpen);if(z)S.map.flyToBounds(L.latLng(z.lat,z.lng).toBounds(z.radius*2.2),{duration:.6});drawZones();renderSide();return}
    if(d.zEdit){const z=zoneOf(d.zEdit);S.form={...z};showPreview();renderSide();return}
    if(d.zc){S.form.color=d.zc;showPreview();renderSide();return}
    if(d.zCancel!==undefined){S.form=null;clearPreview();renderSide();return}
    if(d.zSave!==undefined){const f=S.form;if(!f.name.trim()){toast('ใส่ชื่อโซนก่อน');$('#zf-name').focus();return}t.disabled=true;
      try{const r=await post({action:'zone_save',key:A.key,zone:f,by:'หลังบ้าน'});if(!r||!r.ok){toast('บันทึกไม่สำเร็จ: '+(r&&r.error||''));return}
        const old=f.id&&zoneOf(f.id);if(old&&old.name!==f.name)for(const tm of S.roster.filter(x=>x.zone===old.name))await saveTeamZone(tm,f.name);
        toast('บันทึกโซน '+f.name+' แล้ว',true);S.form=null;clearPreview();S.side='zone';S.zoneId=r.id;await loadZones();render()}finally{t.disabled=false}return}
    if(d.zDel!==undefined){const f=S.form;if(!confirm(`ลบโซน "${f.name}"? (เคสไม่ถูกลบ)`))return;const r=await post({action:'zone_save',key:A.key,zone:{id:f.id,active:false}});
      if(r&&r.ok){toast('ลบโซนแล้ว',true);S.form=null;clearPreview();S.side='zones';S.zoneId=null;if($('#f-zone').value===f.id)$('#f-zone').value='';await loadZones();render()}return}
    if(d.zFilter){$('#f-zone').value=d.zFilter;if(typeof fCount==='function')fCount();render();toast('กรองเฉพาะเคสในโซนนี้',true);return}
    if(d.routeZone){R.src='zone:'+d.routeZone;S.side='route';const z=zoneOf(d.routeZone);if(z&&!S.start)S.start={lat:z.lat,lng:z.lng,label:'จุดกลางโซน '+z.name};renderSide();return}
    if(d.openCase){openDrawer(d.openCase);return}
    if(d.rGps!==undefined){if(!navigator.geolocation){toast('อุปกรณ์นี้หาตำแหน่งไม่ได้');return}t.textContent='กำลังหาตำแหน่ง…';
      navigator.geolocation.getCurrentPosition(p=>{S.start={lat:p.coords.latitude,lng:p.coords.longitude,label:'ตำแหน่งของฉัน'};renderSide()},()=>{toast('หาตำแหน่งไม่ได้ ลองแตะเลือกบนแผนที่');renderSide()},{enableHighAccuracy:true,timeout:15000});return}
    if(d.rPick!==undefined){S.picking=!S.picking;S.map.getContainer().classList.toggle('picking',S.picking);renderSide();return}
    if(d.rGo!==undefined){t.disabled=true;t.textContent='กำลังคำนวณ…';try{await compute()}finally{const b=document.querySelector('[data-r-go]');if(b){b.disabled=false;b.textContent='🧭 คำนวณเส้นทาง'}}return}
    if(d.rClear!==undefined){S.route=null;S.L.route.clearLayers();renderSide();legend();return}
    if(d.rCopy!==undefined){copyRoute();return}
    if(d.rAssign!==undefined){assign($('#r-team').value);return}
  });

  setTimeout(()=>{if(A.key)loadZones()},0);
  return {attach,refresh,inZone,loadZones,get zones(){return S.zones}};
})();
