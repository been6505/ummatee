const TRACK=(()=>{
  let map=null,pins=null,trail=null,sel=null,fitted=false,leafletP=null,live=null;
  const mk=new Map();
  const tn=TK.tn;
  function loadLeaflet(){if(window.L)return Promise.resolve();if(leafletP)return leafletP;leafletP=new Promise((res,rej)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='';document.head.append(css);
    const sc=document.createElement('script');sc.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';sc.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';sc.crossOrigin='';sc.onload=res;sc.onerror=()=>{leafletP=null;rej()};document.head.append(sc)});return leafletP}
  const fresh=t=>{const m=(Date.now()-Number(t.updatedAt))/60000;return m<5?'on':m<30?'idle':'old'};
  const isSos=r=>r&&r.sosAt&&(!r.sosAck||r.sosAck<r.sosAt);
  function info(t,r){return [`<b>${esc(t.team)}</b>`,`ส่งตำแหน่ง ${esc(ago(t.updatedAt))}`,
    [t.battery!=null?`แบต ${t.battery}%`:'',t.speed!=null&&t.speed>=1?`${Math.round(t.speed)} กม./ชม.`:'',t.accuracy?`±${t.accuracy} ม.`:''].filter(Boolean).join(' · '),
    t.caseId?`ถือเคส #${esc(t.caseId)}`:'',isSos(r)?'<b style="color:#E5383B">SOS</b>':'',
    `<a href="https://www.google.com/maps/dir/?api=1&destination=${+t.lat},${+t.lng}" target="_blank" rel="noopener">นำทางไปหาทีม ↗</a>`].filter(Boolean).join('<br>')}
  const ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/',LY={sat:false,gis:true,cases:false,rally:false,road:false};let rq=null,rqAt=0;
  try{Object.assign(LY,JSON.parse(localStorage.getItem('uh_tlay')||'{}'))}catch(e){}
  let bl=null,btok=0,gl=null,gisOk=null;
  function base(kind){const t=(u,a)=>L.tileLayer(u,{maxZoom:19,attribution:a,crossOrigin:true});if(bl)map.removeLayer(bl);
    bl=kind==='sat'?L.layerGroup([t(ESRI+'World_Imagery/MapServer/tile/{z}/{y}/{x}','แผนที่ © Esri'),t(ESRI+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',''),t(ESRI+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}','')]):t('https://tile.openstreetmap.org/{z}/{x}/{y}.png','© OpenStreetMap');
    bl.addTo(map);const tok=++btok;if(kind==='road'&&typeof OFM!=='undefined')OFM.layer('road').then(l=>{if(!l||tok!==btok)return;map.removeLayer(bl);bl=l;l.addTo(map)})}
  async function gistda(){if(gl){map.removeLayer(gl);gl=null}if(!LY.gis)return;
    if(gisOk==null){try{const r=await fetch('/api?action=gistda_status').then(r=>r.json());gisOk=!!(r&&r.enabled)}catch(e){gisOk=false}}if(!gisOk||!LY.gis)return;
    if(!map.getPane('gistda')){const p=map.createPane('gistda');p.style.zIndex=340;p.style.pointerEvents='none'}
    gl=L.tileLayer('/api/gistda/7days/{z}/{x}/{y}',{pane:'gistda',opacity:.65,maxZoom:20,maxNativeZoom:18,attribution:'น้ำท่วมจากดาวเทียม © GISTDA'}).addTo(map)}
  const RQL=['ถนนเรียบ','ขรุขระเล็กน้อย','ขรุขระ','แย่มาก / หลุมบ่อ'],RQC=['#22A06B','#E5B800','#F97316','#D92D20'];
  async function road(force){if(!LY.road){if(rq){rq.remove();rq=null}return}if(!force&&Date.now()-rqAt<120000)return;rqAt=Date.now();
    let r;try{r=await apiGet({action:'road_q',hours:72})}catch(e){return}if(!r||!r.ok||!LY.road)return;
    if(!map.getPane('roadq')){const p=map.createPane('roadq');p.style.zIndex=420}
    if(rq)rq.clearLayers();else rq=L.layerGroup().addTo(map);const rd=L.canvas({pane:'roadq'});
    r.cells.forEach(([la,ln,rms,pk,bu,n,tm,at,sp])=>{const lv=rms>=2.5||pk>=12?3:rms>=1.4||bu>=2||pk>=8?2:rms>=.8?1:0;
      L.circleMarker([la,ln],{renderer:rd,pane:'roadq',radius:lv>=2?6:4,weight:1,color:'#fff',fillColor:RQC[lv],fillOpacity:.9}).bindTooltip(`<b>${RQL[lv]}</b><br>สั่น ${rms} m/s² · สูงสุด ${pk}${bu?` · กระแทก ${bu} ครั้ง`:''}<br>${n} ช่วง · ${tm} ทีม · ~${sp} กม./ชม. · ${ago(at)}`).addTo(rq)})}
  setInterval(()=>{if(LY.road&&!document.hidden)road()},30000);
  function lyrCtl(){const C=L.Control.extend({options:{position:'topleft'},onAdd(){const d=L.DomUtil.create('div','trk-lyr');L.DomEvent.disableClickPropagation(d);
      const draw=()=>{d.innerHTML=[['sat','ภาพดาวเทียม'],['gis','น้ำท่วม GISTDA'],['cases','เคสที่มอบแล้ว'],['rally','จุดรวมพล'],['road','สภาพถนน']].map(([k,l])=>`<button type="button" data-tl="${k}" aria-pressed="${!!LY[k]}">${l}</button>`).join('')};
      d.onclick=e=>{const b=e.target.closest('[data-tl]');if(!b)return;const k=b.dataset.tl;LY[k]=!LY[k];try{localStorage.setItem('uh_tlay',JSON.stringify(LY))}catch(x){}
        if(k==='sat')base(LY.sat?'sat':'road');else if(k==='gis')gistda();else if(k==='road')road(true);else if(k==='rally'){if(rl)LY.rally?rl.addTo(map):rl.remove()}else if(cp){LY.cases?cp.addTo(map):cp.remove()}draw()};draw();return d}});new C().addTo(map);if(LY.sat)base('sat')}
  async function init(el){if(map)return true;try{await loadLeaflet()}catch(e){el.innerHTML='<p class="empty">โหลดแผนที่ไม่ได้</p>';return false}
    map=L.map(el,{scrollWheelZoom:false,zoomControl:false}).setView([13.76,100.65],11);
    map.attributionControl.setPrefix(false);base('road');gistda();lyrCtl();
    if(typeof MAPFS!=='undefined')MAPFS.add(map);L.control.zoom({position:'topright'}).addTo(map);trail=L.layerGroup().addTo(map);pins=L.layerGroup().addTo(map);return true}
  function update(rows,roster){if(!map)return;const byName=new Map((roster||[]).map(r=>[tn(r.name),r])),seen=new Set();
    (rows||[]).forEach(t=>{const r=byName.get(tn(t.team)),k=tn(t.team);seen.add(k);
      const mv=t.speed!=null&&t.speed>=3,cls=`trk-pin ${isSos(r)?'sos':fresh(t)}${sel===k?' sel':''}${mv?' mv':''}`,
        html=`<span class="${cls}"><i>${headArrow(t,r&&r.vehicle)}</i><b class="nm">${esc(k)}${t.battery!=null&&t.battery<=20?`<small>แบต ${t.battery}%</small>`:''}</b></span>`;
      let m=mk.get(k);
      if(!m){m=L.marker([+t.lat,+t.lng],{icon:L.divIcon({className:'',html,iconSize:null,iconAnchor:[17,0]}),keyboard:false}).addTo(pins);m._html=html;m.on('click',()=>focus(k));mk.set(k,m)}
      else{glideTo(m,[+t.lat,+t.lng],900,t);if(m._html!==html){m._html=html;m.setIcon(L.divIcon({className:'',html,iconSize:null,iconAnchor:[17,0]}))}}
      if(sel===k&&live){const p=live.getLatLngs(),last=p[p.length-1];if(!last||L.latLng(last).distanceTo([+t.lat,+t.lng])>3)live.addLatLng([+t.lat,+t.lng])}
      m.setZIndexOffset(isSos(r)?3000:sel===k?2000:0);m.bindPopup(info(t,r))});
    for(const [k,m] of mk)if(!seen.has(k)){m.remove();mk.delete(k)}
    if(!fitted&&mk.size){fitted=true;const b=L.latLngBounds([...mk.values()].map(m=>m.getLatLng()));map.fitBounds(b.pad(.25),{maxZoom:14})}}
  async function focus(name,hours=6){if(!map)return;sel=tn(name);live=null;trail.clearLayers();if(sp)sp._fit=null;
    const m=mk.get(sel);if(m){map.setView(m.getLatLng(),Math.max(map.getZoom(),14));m.openPopup()}selPins();
    document.getElementById('trk-sel').textContent=`${sel} · กำลังโหลดเส้นทาง…`;
    try{const r=await apiGet({action:'team_track',team:sel,hours});const pts=(r.points||[]).map(p=>[p.lat,p.lng]);
      live=L.polyline(pts,{color:'#2D45C8',weight:4,opacity:.75}).addTo(trail);
      if(pts.length>1){L.circleMarker(pts[0],{radius:6,color:'#fff',weight:2,fillColor:'#5B6386',fillOpacity:1}).bindTooltip('จุดเริ่ม '+new Date(r.points[0].at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})).addTo(trail);
        if(!m)map.fitBounds(L.latLngBounds(pts).pad(.2))}
      const km=pts.reduce((s,p,i)=>i?s+L.latLng(pts[i-1]).distanceTo(p)/1000:0,0);
      document.getElementById('trk-sel').innerHTML=`<b>${esc(sel)}</b> · เส้นทาง ${hours} ชม. ${pts.length>1?`${km.toFixed(1)} กม. (${pts.length} จุด)`:'ยังไม่มีข้อมูล'} <button class="linkish" id="trk-clear">ล้าง</button>`;
      document.getElementById('trk-clear').onclick=()=>{sel=null;live=null;trail.clearLayers();selPins();document.getElementById('trk-sel').textContent='กดหมุดหรือ "ติดตาม" บนการ์ดทีมเพื่อดูเส้นทาง';map.closePopup()}}
    catch(e){document.getElementById('trk-sel').textContent='โหลดเส้นทางไม่ได้'}}
  let rt=null,PL={};const RT=new Map();
  const hasPin=TK.hasPin;
  let cp=null,cpKey='';function assigned(cases){if(!map)return;if(!cp){cp=L.layerGroup();if(LY.cases)cp.addTo(map)}
    const xs=(cases||[]).filter(c=>c.status==='going'&&hasPin(c)),key=xs.map(c=>c.id+':'+c.volunteer+':'+(c.teamDoneAt?1:0)).join('|');if(key===cpKey)return;cpKey=key;cp.clearLayers();
    xs.forEach(c=>{const team=tn(c.volunteer),done=!!c.teamDoneAt,lab=`#${esc(c.id)} · ${(c.needs||[]).slice(0,2).map(esc).join(', ')||'เคส'} · ${esc(c.people||1)} คน<br>ทีม: <b>${esc(team)}</b>${done?' · ช่วยแล้ว รอปิดเคส':''}`;
      const ic=typeof umPin==='function'?umPin(done?'done':'going',{extra:`<span class="cp-tag">${esc(team)}</span>`}):L.divIcon({className:'',html:'<div class="cp-dot"></div>',iconSize:[14,14]});
      L.marker([+c.lat,+c.lng],{icon:ic,zIndexOffset:500}).bindTooltip(lab).on('click',()=>focus(team)).addTo(cp)})}
  function routes(live,cases){if(!map)return;if(!rt)rt=L.layerGroup().addTo(map);const seen=new Set();lastCases=cases||[];selPins();assigned(cases);
    (live||[]).forEach(t=>{const k=tn(t.team),mine=(cases||[]).filter(c=>c.status==='going'&&!c.teamDoneAt&&tn(c.volunteer)===k&&hasPin(c));if(!mine.length)return;
      const me=L.latLng(+t.lat,+t.lng),tgt=mine.map(c=>({c,d:me.distanceTo([+c.lat,+c.lng])})).sort((a,b)=>a.d-b.d)[0].c;seen.add(k);
      let r=RT.get(k);if(!r){r={g:L.layerGroup().addTo(rt)};RT.set(k,r)}
      const pl=PL[k]&&String(PL[k].caseId)===String(tgt.id)?PL[k]:null;
      if(pl){if(r.plan!==pl.at){r.plan=pl.at;r.cid=String(tgt.id);r.at=Date.now();r.from=me;draw(k,r,tgt,me,{coords:pl.coords,km:pl.km,min:pl.min},pl)}return}
      if(r.plan){r.plan=null;r.at=0}
      const need=!r.at||r.cid!==String(tgt.id)||r.from.distanceTo(me)>150||Date.now()-r.at>180e3;
      if(need&&!r.busy){r.busy=true;r.cid=String(tgt.id);r.from=me;r.at=Date.now();const b={lat:+tgt.lat,lng:+tgt.lng};
        const ok=()=>!r.plan&&r.cid===String(tgt.id);TK.osrm({lat:me.lat,lng:me.lng},b).then(x=>{if(ok())draw(k,r,tgt,me,x)}).catch(()=>{if(ok())draw(k,r,tgt,me,null)}).finally(()=>{r.busy=false})}
      else if(r.line&&r.straight)r.line.setLatLngs([me,[+tgt.lat,+tgt.lng]])});
    for(const [k,r] of RT)if(!seen.has(k)){rt.removeLayer(r.g);RT.delete(k)}}
  function draw(k,r,c,me,x,pl){r.g.clearLayers();r.info={caseId:c.id,km:x?x.km:me.distanceTo([+c.lat,+c.lng])/1000,min:x?x.min:null,plan:!!pl,c};const end=[+c.lat,+c.lng],more=(x&&x.coords)||[[me.lat,me.lng],end];r.straight=!x;
    const lab=`${esc(k)} → เคส #${esc(c.id)} · ${(c.needs||[]).slice(0,2).map(esc).join(', ')||'เคส'}${x?` · ${x.km.toFixed(1)} กม. · ~${Math.max(1,Math.round(x.min))} นาที`:` · ระยะตรง ${(me.distanceTo(end)/1000).toFixed(1)} กม.`}`;
    L.polyline(more,{color:'#fff',weight:8,opacity:.9}).addTo(r.g);
    r.line=L.polyline(more,{color:pl?'#1F7A43':'#E5383B',weight:5,opacity:.9,dashArray:x?null:'8 8'}).bindTooltip((pl?'เส้นทางที่ศูนย์ส่งให้ · ':'')+lab+' · แตะเพื่อปรับเส้นทาง',{sticky:true}).addTo(r.g);
    const ed=()=>{if(typeof RTE!=='undefined')RTE.open(k,c,{lat:me.lat,lng:me.lng})};r.line.on('click',ed);
    L.marker(end,{icon:L.divIcon({className:'',html:`<div class="rt-goal below${pl?' plan':''}"><i data-ic="flag"></i><span>${x?`${x.km.toFixed(1)} กม. · ~${Math.max(1,Math.round(x.min))} น.`:'เคส'}</span><b>${pl?'ศูนย์กำหนด':'ปรับ'}</b></div>`,iconSize:[0,0],iconAnchor:[0,0]}),zIndexOffset:800}).bindTooltip(lab+' · แตะเพื่อปรับเส้นทาง').on('click',ed).addTo(r.g)}
  let sp=null,lastCases=[];function selPins(){if(!map)return;if(!sp)sp=L.layerGroup().addTo(map);sp.clearLayers();if(!sel)return;
    lastCases.filter(c=>c.status==='going'&&tn(c.volunteer)===sel&&hasPin(c)).forEach((c,i)=>{const done=!!c.teamDoneAt,ic=typeof umPin==='function'?umPin(done?'done':'going',{extra:`<span class="cp-tag sel">${i+1}. ${esc((c.needs||[]).slice(0,2).join(', ')||'เคส')}</span>`}):L.divIcon({className:'',html:'<div class="cp-dot"></div>',iconSize:[14,14]});
      L.marker([+c.lat,+c.lng],{icon:ic,zIndexOffset:1200}).bindPopup(`<b>เคส #${esc(c.id)}</b><br>${esc((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')} · ${esc(c.people||1)} คน<br>${esc([c.address,c.district].filter(Boolean).join(' · '))}${done?'<br><b style="color:#1F7A43">ทีมแจ้งช่วยแล้ว · รอปิดเคส</b>':''}`).addTo(sp)});
    const pts=lastCases.filter(c=>c.status==='going'&&tn(c.volunteer)===sel&&hasPin(c)).map(c=>[+c.lat,+c.lng]),m=mk.get(sel);if(pts.length&&m){pts.push(m.getLatLng());if(!sp._fit||sp._fit!==sel){sp._fit=sel;map.fitBounds(L.latLngBounds(pts).pad(.25),{maxZoom:15})}}}
  let rl=null;function rallies(list){if(!map)return;if(!rl){rl=L.layerGroup();if(LY.rally)rl.addTo(map)}rl.clearLayers();
    (list||[]).forEach(r=>L.marker([r.lat,r.lng],{icon:L.divIcon({className:'',html:'<div class="rl-pin">📣</div>',iconSize:[36,36],iconAnchor:[18,18]}),zIndexOffset:900}).bindTooltip('รวมพล · '+esc(r.label)).addTo(rl))}
  return {init,update,focus,fresh,isSos,rallies,routes,map:()=>map,setPlans:p=>{PL=p||{}},refreshRoute:k=>{const r=RT.get(k);if(r)r.at=0},eta:k=>{const r=RT.get(k);return r&&r.info||null},edit:k=>{const r=RT.get(k);if(r&&r.info&&r.from&&typeof RTE!=='undefined')RTE.open(k,r.info.c,{lat:r.from.lat,lng:r.from.lng})},resize:()=>{if(map)map.invalidateSize()}}
})();
