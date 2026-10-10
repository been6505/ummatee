/* ติดตามทีม: แผนที่ตำแหน่งสดของทุกทีม + เส้นทางย้อนหลังของทีมที่เลือก
   สีหมุด: เขียว = ส่งตำแหน่งภายใน 5 นาที · ส้ม = 5–30 นาที · เทา = นานกว่านั้น · แดงกะพริบ = SOS
   ใช้: TRACK.init(el) · TRACK.update(live, roster) · TRACK.focus(teamName) */
const TRACK=(()=>{
  let map=null,pins=null,trail=null,sel=null,fitted=false,leafletP=null,live=null;
  const mk=new Map();
  const tn=s=>String(s||'').replace(/^'/,'').trim();
  function loadLeaflet(){if(window.L)return Promise.resolve();if(leafletP)return leafletP;leafletP=new Promise((res,rej)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='';document.head.append(css);
    const sc=document.createElement('script');sc.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';sc.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';sc.crossOrigin='';sc.onload=res;sc.onerror=()=>{leafletP=null;rej()};document.head.append(sc)});return leafletP}
  const fresh=t=>{const m=(Date.now()-Number(t.updatedAt))/60000;return m<5?'on':m<30?'idle':'old'};
  const isSos=r=>r&&r.sosAt&&(!r.sosAck||r.sosAck<r.sosAt);
  function info(t,r){return [`<b>${esc(t.team)}</b>`,`ส่งตำแหน่ง ${esc(ago(t.updatedAt))}`,
    [t.battery!=null?`แบต ${t.battery}%`:'',t.speed!=null&&t.speed>=1?`${Math.round(t.speed)} กม./ชม.`:'',t.accuracy?`±${t.accuracy} ม.`:''].filter(Boolean).join(' · '),
    t.caseId?`ถือเคส #${esc(t.caseId)}`:'',isSos(r)?'<b style="color:#E5383B">SOS</b>':'',
    `<a href="https://www.google.com/maps/dir/?api=1&destination=${+t.lat},${+t.lng}" target="_blank" rel="noopener">นำทางไปหาทีม ↗</a>`].filter(Boolean).join('<br>')}
  async function init(el){if(map)return true;try{await loadLeaflet()}catch(e){el.innerHTML='<p class="empty">โหลดแผนที่ไม่ได้</p>';return false}
    map=L.map(el,{scrollWheelZoom:false,zoomControl:false}).setView([13.76,100.65],11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
    if(typeof MAPFS!=='undefined')MAPFS.add(map);L.control.zoom({position:'topright'}).addTo(map);trail=L.layerGroup().addTo(map);pins=L.layerGroup().addTo(map);return true}
  function update(live,roster){if(!map)return;const byName=new Map((roster||[]).map(r=>[tn(r.name),r])),seen=new Set();
    (live||[]).forEach(t=>{const r=byName.get(tn(t.team)),k=tn(t.team);seen.add(k);
      const mv=t.speed!=null&&t.speed>=3,cls=`trk-pin ${isSos(r)?'sos':fresh(t)}${sel===k?' sel':''}${mv?' mv':''}`,
        html=`<span class="${cls}"><i>${headArrow(t,r&&r.vehicle)}</i><b class="nm">${esc(k)}${t.battery!=null&&t.battery<=20?`<small>แบต ${t.battery}%</small>`:''}</b></span>`;
      let m=mk.get(k);
      if(!m){m=L.marker([+t.lat,+t.lng],{icon:L.divIcon({className:'',html,iconSize:null,iconAnchor:[17,0]}),keyboard:false}).addTo(pins);m._html=html;m.on('click',()=>focus(k));mk.set(k,m)}
      else{glideTo(m,[+t.lat,+t.lng],900,t);if(m._html!==html){m._html=html;m.setIcon(L.divIcon({className:'',html,iconSize:null,iconAnchor:[17,0]}))}}
      // ทีมที่เลือกอยู่: ต่อเส้นทางสดตามตำแหน่งใหม่
      if(sel===k&&live){const p=live.getLatLngs(),last=p[p.length-1];if(!last||L.latLng(last).distanceTo([+t.lat,+t.lng])>3)live.addLatLng([+t.lat,+t.lng])}
      m.setZIndexOffset(isSos(r)?3000:sel===k?2000:0);m.bindPopup(info(t,r))});
    for(const [k,m] of mk)if(!seen.has(k)){m.remove();mk.delete(k)}
    if(!fitted&&mk.size){fitted=true;const b=L.latLngBounds([...mk.values()].map(m=>m.getLatLng()));map.fitBounds(b.pad(.25),{maxZoom:14})}}
  /* เส้นทาง 6 ชม. ล่าสุดของทีม */
  async function focus(name,hours=6){if(!map)return;sel=tn(name);live=null;trail.clearLayers();
    const m=mk.get(sel);if(m){map.setView(m.getLatLng(),Math.max(map.getZoom(),14));m.openPopup()}
    document.getElementById('trk-sel').textContent=`${sel} · กำลังโหลดเส้นทาง…`;
    try{const r=await apiGet({action:'team_track',team:sel,hours});const pts=(r.points||[]).map(p=>[p.lat,p.lng]);
      live=L.polyline(pts,{color:'#2D45C8',weight:4,opacity:.75}).addTo(trail);
      if(pts.length>1){L.circleMarker(pts[0],{radius:6,color:'#fff',weight:2,fillColor:'#5B6386',fillOpacity:1}).bindTooltip('จุดเริ่ม '+new Date(r.points[0].at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})).addTo(trail);
        if(!m)map.fitBounds(L.latLngBounds(pts).pad(.2))}
      const km=pts.reduce((s,p,i)=>i?s+L.latLng(pts[i-1]).distanceTo(p)/1000:0,0);
      document.getElementById('trk-sel').innerHTML=`<b>${esc(sel)}</b> · เส้นทาง ${hours} ชม. ${pts.length>1?`${km.toFixed(1)} กม. (${pts.length} จุด)`:'ยังไม่มีข้อมูล'} <button class="linkish" id="trk-clear">ล้าง</button>`;
      document.getElementById('trk-clear').onclick=()=>{sel=null;live=null;trail.clearLayers();document.getElementById('trk-sel').textContent='กดหมุดหรือ "ติดตาม" บนการ์ดทีมเพื่อดูเส้นทาง';map.closePopup()}}
    catch(e){document.getElementById('trk-sel').textContent='โหลดเส้นทางไม่ได้'}}
  /* ทีมที่รับเคสแล้ว (ทีมกำลังไป): เส้นทางถนนจากตำแหน่งสดของทีมไปเคสที่ใกล้สุด + ระยะ/เวลาโดยประมาณ
     คำนวณใหม่เมื่อทีมขยับเกิน 150 ม. · เปลี่ยนเคส · หรือทุก 3 นาที (เส้นทางจาก OSRM · ไม่ได้ = เส้นตรงประ) */
  let rt=null,PL={};const RT=new Map();
  async function osrm(a,b){const u=`https://router.project-osrm.org/route/v1/driving/${a.lng.toFixed(6)},${a.lat.toFixed(6)};${b.lng.toFixed(6)},${b.lat.toFixed(6)}?overview=full&geometries=geojson`;
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),12000);try{const j=await fetch(u,{signal:ctl.signal}).then(r=>r.json());if(j.code!=='Ok')throw 0;const r=j.routes[0];return {coords:r.geometry.coordinates.map(c=>[c[1],c[0]]),km:r.distance/1000,min:r.duration/60}}finally{clearTimeout(tm)}}
  const hasPin=c=>c&&c.lat!==''&&c.lat!=null&&isFinite(+c.lat)&&isFinite(+c.lng);
  /* เคสที่มอบให้ทีมแล้ว (ทีมกำลังไป / ช่วยแล้วรอปิด): หมุดบนแผนที่ + ป้ายชื่อทีมที่รับ */
  let cp=null,cpKey='';function assigned(cases){if(!map)return;if(!cp)cp=L.layerGroup().addTo(map);
    const xs=(cases||[]).filter(c=>c.status==='going'&&hasPin(c)),key=xs.map(c=>c.id+':'+c.volunteer+':'+(c.teamDoneAt?1:0)).join('|');if(key===cpKey)return;cpKey=key;cp.clearLayers();
    xs.forEach(c=>{const team=tn(c.volunteer),done=!!c.teamDoneAt,lab=`#${esc(c.id)} · ${(c.needs||[]).slice(0,2).map(esc).join(', ')||'เคส'} · ${esc(c.people||1)} คน<br>ทีม: <b>${esc(team)}</b>${done?' · ช่วยแล้ว รอปิดเคส':''}`;
      const ic=typeof umPin==='function'?umPin(done?'done':'going',{extra:`<span class="cp-tag">${esc(team)}</span>`}):L.divIcon({className:'',html:'<div class="cp-dot"></div>',iconSize:[14,14]});
      L.marker([+c.lat,+c.lng],{icon:ic,zIndexOffset:500}).bindTooltip(lab).on('click',()=>focus(team)).addTo(cp)})}
  function routes(live,cases){if(!map)return;if(!rt)rt=L.layerGroup().addTo(map);const seen=new Set();assigned(cases);
    (live||[]).forEach(t=>{const k=tn(t.team),mine=(cases||[]).filter(c=>c.status==='going'&&!c.teamDoneAt&&tn(c.volunteer)===k&&hasPin(c));if(!mine.length)return;
      const me=L.latLng(+t.lat,+t.lng),tgt=mine.map(c=>({c,d:me.distanceTo([+c.lat,+c.lng])})).sort((a,b)=>a.d-b.d)[0].c;seen.add(k);
      let r=RT.get(k);if(!r){r={g:L.layerGroup().addTo(rt)};RT.set(k,r)}
      const pl=PL[k]&&String(PL[k].caseId)===String(tgt.id)?PL[k]:null;
      if(pl){if(r.plan!==pl.at){r.plan=pl.at;r.cid=String(tgt.id);r.at=Date.now();r.from=me;draw(k,r,tgt,me,{coords:pl.coords,km:pl.km,min:pl.min},pl)}return}
      if(r.plan){r.plan=null;r.at=0}
      const need=!r.at||r.cid!==String(tgt.id)||r.from.distanceTo(me)>150||Date.now()-r.at>180e3;
      if(need&&!r.busy){r.busy=true;r.cid=String(tgt.id);r.from=me;r.at=Date.now();const b={lat:+tgt.lat,lng:+tgt.lng};
        osrm({lat:me.lat,lng:me.lng},b).then(x=>draw(k,r,tgt,me,x)).catch(()=>draw(k,r,tgt,me,null)).finally(()=>{r.busy=false})}
      else if(r.line&&r.straight)r.line.setLatLngs([me,[+tgt.lat,+tgt.lng]])});
    for(const [k,r] of RT)if(!seen.has(k)){rt.removeLayer(r.g);RT.delete(k)}}
  function draw(k,r,c,me,x,pl){r.g.clearLayers();r.info={caseId:c.id,km:x?x.km:me.distanceTo([+c.lat,+c.lng])/1000,min:x?x.min:null,plan:!!pl,c};const end=[+c.lat,+c.lng],more=(x&&x.coords)||[[me.lat,me.lng],end];r.straight=!x;
    const lab=`${esc(k)} → เคส #${esc(c.id)} · ${(c.needs||[]).slice(0,2).map(esc).join(', ')||'เคส'}${x?` · ${x.km.toFixed(1)} กม. · ~${Math.max(1,Math.round(x.min))} นาที`:` · ระยะตรง ${(me.distanceTo(end)/1000).toFixed(1)} กม.`}`;
    L.polyline(more,{color:'#fff',weight:8,opacity:.9}).addTo(r.g);
    r.line=L.polyline(more,{color:pl?'#1F7A43':'#E5383B',weight:5,opacity:.9,dashArray:x?null:'8 8'}).bindTooltip((pl?'เส้นทางที่ศูนย์ส่งให้ · ':'')+lab+' · แตะเพื่อปรับเส้นทาง',{sticky:true}).addTo(r.g);
    const ed=()=>{if(typeof RTE!=='undefined')RTE.open(k,c,{lat:me.lat,lng:me.lng})};r.line.on('click',ed);
    L.marker(end,{icon:L.divIcon({className:'',html:`<div class="rt-goal${pl?' plan':''}"><i data-ic="flag"></i><span>${x?`${x.km.toFixed(1)} กม. · ~${Math.max(1,Math.round(x.min))} น.`:'เคส'}</span><b>${pl?'ศูนย์กำหนด':'ปรับ'}</b></div>`,iconSize:null,iconAnchor:[14,28]}),zIndexOffset:800}).bindTooltip(lab+' · แตะเพื่อปรับเส้นทาง').on('click',ed).addTo(r.g)}
  /* จุดรวมพลบนแผนที่ติดตามทีม */
  let rl=null;function rallies(list){if(!map)return;if(!rl)rl=L.layerGroup().addTo(map);rl.clearLayers();
    (list||[]).forEach(r=>L.marker([r.lat,r.lng],{icon:L.divIcon({className:'',html:'<div class="rl-pin">📣</div>',iconSize:[36,36],iconAnchor:[18,18]}),zIndexOffset:900}).bindTooltip('รวมพล · '+esc(r.label)).addTo(rl))}
  return {init,update,focus,fresh,isSos,rallies,routes,map:()=>map,setPlans:p=>{PL=p||{}},refreshRoute:k=>{const r=RT.get(k);if(r)r.at=0},eta:k=>{const r=RT.get(k);return r&&r.info||null},edit:k=>{const r=RT.get(k);if(r&&r.info&&r.from&&typeof RTE!=='undefined')RTE.open(k,r.info.c,{lat:r.from.lat,lng:r.from.lng})},resize:()=>{if(map)map.invalidateSize()}}
})();
