/* จัดเคสให้ทีม · จัดเส้นทาง (ย้ายมาจากแผงข้างแผนที่ในหน้าจัดการเคส)
   1) เลือกทีม → เริ่มจากตำแหน่งสดของทีม (ถ้าแชร์ใน 30 นาที) หรือตำแหน่งฉัน / แตะแผนที่
   2) เลือกเคส: ทุกเคสที่ยังไม่มีทีม หรือเฉพาะเขต · จำนวนจุดสูงสุด · เลี่ยงถนนน้ำท่วม
   3) คำนวณ: เรียงวิกฤต → เร่งด่วน → ทั่วไป ในแต่ละระดับไปจุดที่ใกล้ที่สุดก่อน (Valhalla · สำรอง OSRM)
   4) มอบหมายทุกเคสในเส้นทางให้ทีม · นำทาง Google Maps · คัดลอกส่งไลน์
   ใช้เคสในระบบ + เคส Help Me (อัปเดตด้วยรหัสเดิมในฐานข้อมูล) */
const ROUTE=(()=>{
  const R={team:'',src:'all',max:10,avoid:true,start:null,picking:false,route:null,map:null,g:null,hm:[],hmAt:0};
  const el=()=>$('#rt-panel');
  const kmP=(a,b)=>km(a.lat,a.lng,b.lat,b.lng);
  const rawId=id=>String(id).replace(/^hm-/,'');
  async function hmCases(){if(Date.now()-R.hmAt<60e3)return R.hm;try{const r=await apiGet({action:'helpme_cases'});if(r&&r.ok){R.hm=(r.cases||[]).map(c=>({...c,_hm:true,needs:Array.isArray(c.needs)?c.needs:String(c.needs||'').split(/\s*,\s*/).filter(Boolean)}));R.hmAt=Date.now()}}catch(e){}return R.hm}
  const all=()=>{const own=new Set(T.cases.map(c=>String(c.id)));return [...T.cases,...R.hm.filter(c=>!own.has(String(c.id)))]};
  const open=()=>all().filter(c=>c.status==='open'&&hasPin(c)&&!c.dupOf);
  const districts=()=>[...new Set(open().map(c=>c.district).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
  function teamStart(name){const l=T.live.find(x=>tname(x.team)===tname(name));return l&&Date.now()-l.updatedAt<30*60e3?{lat:+l.lat,lng:+l.lng,label:`ตำแหน่งสดของ ${name} (${ago(l.updatedAt)})`}:null}
  function view(){const r=R.route,n=open().length;
    return `<div class="rt-steps">
      <div class="rt-step"><span class="rt-n">1</span><label class="rt-f">ทีมที่จะออก<select id="rt-team"><option value="">— เลือกทีม —</option>${T.roster.map(t=>{const l=teamStart(t.name);return `<option value="${esc(t.name)}" ${R.team===t.name?'selected':''}>${esc(t.name)} · ${esc(TST[t.status]||'')}${l?' · แชร์ตำแหน่ง':''}</option>`}).join('')}</select></label></div>
      <div class="rt-step"><span class="rt-n">2</span><div class="rt-f"><span>เคสที่จะจัด</span><div class="rt-row"><select id="rt-src"><option value="all">ทุกเคสที่ยังไม่มีทีม (${n})</option>${districts().map(d=>`<option value="d:${esc(d)}" ${R.src==='d:'+d?'selected':''}>เขต/อำเภอ ${esc(d)} (${open().filter(c=>c.district===d).length})</option>`).join('')}</select><select id="rt-max" aria-label="จำนวนจุดสูงสุด">${[5,8,10,15].map(x=>`<option value="${x}" ${R.max===x?'selected':''}>${x} จุด</option>`).join('')}</select></div>
        <label class="rt-chk"><input type="checkbox" id="rt-avoid" ${R.avoid?'checked':''}> เลี่ยงถนนน้ำท่วม / ถนนปิด</label></div></div>
      <div class="rt-step"><span class="rt-n">3</span><div class="rt-f"><span>จุดเริ่มต้น</span><b class="rt-start">${R.start?esc(R.start.label):'ยังไม่ได้เลือก (เริ่มจากเคสแรก)'}</b>
        <div class="rt-row"><button type="button" class="btn ghost sm" data-rt="gps"><i data-ic="pin"></i> ตำแหน่งฉัน</button><button type="button" class="btn ghost sm ${R.picking?'primary':''}" data-rt="pick">${R.picking?'แตะแผนที่…':'แตะเลือกบนแผนที่'}</button></div></div></div>
      <button type="button" class="btn primary rt-go" data-rt="go"><i data-ic="route"></i> คำนวณเส้นทาง</button>
    </div>
    <div class="rt-map" id="rt-map"></div>
    <div id="rt-out">${r?result(r):'<p class="muted small">เรียงเคสวิกฤตก่อน แล้วเร่งด่วน แล้วทั่วไป ในแต่ละระดับไปจุดที่ใกล้ที่สุดก่อน</p>'}</div>`}
  function render(){const p=el();if(!p)return;const keep=R.map;if(keep){try{keep.remove()}catch(e){}R.map=null}p.innerHTML=view();if(typeof ic==='function')p.querySelectorAll('[data-ic]').forEach(i=>{i.outerHTML=ic(i.dataset.ic)});initMap()}
  async function initMap(){const m=$('#rt-map');if(!m||!window.L)return setTimeout(initMap,300);
    R.map=L.map(m,{scrollWheelZoom:false,zoomAnimation:false,zoomControl:false}).setView([13.76,100.6],10);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(R.map);
    R.g=L.layerGroup().addTo(R.map);R.map.on('click',e=>{if(!R.picking)return;R.start={lat:e.latlng.lat,lng:e.latlng.lng,label:'จุดที่เลือกบนแผนที่'};R.picking=false;render()});
    if(typeof MAPFS!=='undefined')MAPFS.add(R.map);L.control.zoom({position:'topright'}).addTo(R.map);draw()}
  function draw(){if(!R.map||!R.g)return;R.g.clearLayers();const r=R.route;
    if(!r){const cs=cands();cs.forEach(c=>L.circleMarker([+c.lat,+c.lng],{radius:6,color:'#fff',weight:2,fillColor:{3:'#DD2027',2:'#E8890C',1:'#3442C2'}[sev(c)],fillOpacity:1}).addTo(R.g));
      if(R.start)L.marker([R.start.lat,R.start.lng]).addTo(R.g);const pts=[...cs.map(c=>[+c.lat,+c.lng]),...(R.start?[[R.start.lat,R.start.lng]]:[])];if(pts.length)R.map.fitBounds(pts,{padding:[24,24],maxZoom:14,animate:false});return}
    L.polyline(r.coords,{color:'#fff',weight:9,opacity:.9,interactive:false}).addTo(R.g);L.polyline(r.coords,{color:'#0d5f62',weight:5,opacity:.95,interactive:false}).addTo(R.g);
    const seen=new Set();r.hits.forEach(h=>{if(seen.has(h.name))return;seen.add(h.name);L.circleMarker([h.lat,h.lng],{radius:8,color:'#c62828',weight:3,fillColor:'#fff',fillOpacity:1}).bindTooltip(`${esc(h.name)}${h.depth!=null?` ~${h.depth} ซม.`:''}`).addTo(R.g)});
    if(r.start)L.marker([r.start.lat,r.start.lng],{icon:L.divIcon({className:'rt-ic start',html:'▶',iconSize:[26,26]})}).bindTooltip('จุดเริ่มต้น').addTo(R.g);
    r.stops.forEach((p,i)=>L.marker([p.lat,p.lng],{icon:L.divIcon({className:'rt-ic u'+p.sv,html:String(i+1),iconSize:[26,26]})}).bindTooltip(`${i+1}. ${URG[p.sv]} · ${esc((p.c.needs||[]).join(', '))}`).addTo(R.g));
    R.map.fitBounds(r.coords.length?r.coords:r.stops.map(p=>[p.lat,p.lng]),{padding:[30,30],animate:false})}
  function cands(){let cs=open();if(R.src.startsWith('d:'))cs=cs.filter(c=>c.district===R.src.slice(2));return cs}
  function order(cs,start){const left=cs.map(c=>({c,lat:+c.lat,lng:+c.lng,sv:sev(c)})),out=[];let cur=start||null;
    [3,2,1].forEach(sv=>{let tier=left.filter(p=>p.sv===sv);while(tier.length){if(!cur){cur=tier.shift();out.push(cur);continue}let bi=0,bd=Infinity;tier.forEach((p,i)=>{const d=kmP(cur,p);if(d<bd){bd=d;bi=i}});cur=tier.splice(bi,1)[0];out.push(cur)}});return out}
  function decode6(str){let i=0,lat=0,lng=0;const out=[];while(i<str.length){let b,sh=0,r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lat+=r&1?~(r>>1):r>>1;sh=0;r=0;do{b=str.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lng+=r&1?~(r>>1):r>>1;out.push([lat/1e6,lng/1e6])}return out}
  async function valhalla(locs,excl){const parts=[];for(let i=0;i<locs.length-1;i+=9)parts.push(locs.slice(i,i+10));const rs=[];for(const p of parts)rs.push(await valhallaOne(p,excl));
    const legs=rs.flatMap(r=>r.legs);return {engine:'Valhalla',legs,coords:legs.flatMap(l=>l.coords),km:rs.reduce((a,r)=>a+r.km,0),min:rs.reduce((a,r)=>a+r.min,0)}}
  async function valhallaOne(locs,excl){const body={locations:locs.map(p=>({lat:p.lat,lon:p.lng,type:'break'})),costing:'auto',units:'kilometers',directions_type:'none'};if(excl.length)body.exclude_locations=excl.map(p=>({lat:p.lat,lon:p.lng}));
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),25000);
    try{const j=await fetch('https://valhalla1.openstreetmap.de/route',{method:'POST',headers:{'content-type':'text/plain;charset=UTF-8'},body:JSON.stringify(body),signal:ctl.signal}).then(r=>r.json());
      if(!j.trip)throw new Error(j.error||'no_route');const legs=j.trip.legs.map(l=>({km:l.summary.length,min:l.summary.time/60,coords:decode6(l.shape)}));
      return {legs,km:j.trip.summary.length,min:j.trip.summary.time/60}}finally{clearTimeout(tm)}}
  async function osrm(locs){const u='https://router.project-osrm.org/route/v1/driving/'+locs.map(p=>p.lng.toFixed(6)+','+p.lat.toFixed(6)).join(';')+'?overview=full&geometries=geojson';
    const j=await fetch(u).then(r=>r.json());if(j.code!=='Ok')throw new Error('osrm');const r=j.routes[0];
    return {engine:'OSRM',legs:r.legs.map(l=>({km:l.distance/1000,min:l.duration/60})),coords:r.geometry.coordinates.map(c=>[c[1],c[0]]),km:r.distance/1000,min:r.duration/60}}
  function hazards(){const out=[];if(typeof VERIFY==='undefined')return out;const F=VERIFY.F;
    F.roads.forEach(r=>{const d=r.depth||0,bad=r.closed||r.verdict==='blocked'||r.verdict==='risky'||d>=30;if(!bad)return;
      r.lines.forEach(line=>{let acc=80;for(let i=0;i<line.length;i++){const p={lat:line[i][1],lng:line[i][0]};if(i){const q={lat:line[i-1][1],lng:line[i-1][0]};acc+=kmP(p,q)*1000}if(acc>=80){out.push({...p,name:r.name,depth:r.depth});acc=0}}})});
    F.sensors.forEach(x=>{if(x.status!=='malfunction'&&x.now>=20)out.push({lat:x.lat,lng:x.lng,name:x.name+' (เซ็นเซอร์)',depth:x.now})});return out}
  function hitsOn(coords,hz,thr=35){if(!hz.length)return [];const cell=.002,grid=new Map();hz.forEach((h,i)=>{const k=Math.floor(h.lat/cell)+':'+Math.floor(h.lng/cell);(grid.get(k)||grid.set(k,[]).get(k)).push(i)});
    const hit=new Set();coords.forEach(([la,ln])=>{const a=Math.floor(la/cell),b=Math.floor(ln/cell);for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++){(grid.get((a+x)+':'+(b+y))||[]).forEach(i=>{if(!hit.has(i)&&VERIFY.dist(la,ln,hz[i].lat,hz[i].lng)<=thr)hit.add(i)})}});
    return [...hit].map(i=>hz[i])}
  async function compute(){const cs=cands();if(!cs.length){toast('ไม่มีเคสที่ยังไม่มีทีมและมีหมุด');return}
    const start=R.start,stops=order(cs,start).slice(0,R.max),locs=[...(start?[start]:[]),...stops];if(locs.length<2){toast('ต้องมีอย่างน้อย 2 จุด (เลือกจุดเริ่มต้น หรือเพิ่มเคส)');return}
    $('#rt-out').innerHTML='<p class="muted small">กำลังคำนวณเส้นทาง…</p>';
    const hz=R.avoid?hazards():[],keep=locs.map(p=>({lat:p.lat,lng:p.lng}));let res=null,excl=[];
    try{res=await valhalla(locs,[]);
      if(R.avoid)for(let it=0;it<2;it++){const hits=hitsOn(res.coords,hz).filter(h=>keep.every(k=>VERIFY.dist(h.lat,h.lng,k.lat,k.lng)>150));if(!hits.length)break;excl=[...excl,...hits].slice(0,50);try{res=await valhalla(locs,excl)}catch(e){break}}}
    catch(e){try{res=await osrm(locs)}catch(e2){$('#rt-out').innerHTML='<p class="warn small">คำนวณเส้นทางไม่สำเร็จ (บริการแผนที่ไม่ตอบ) ลองใหม่อีกครั้ง</p>';return}}
    res.engine=res.engine||'Valhalla';res.stops=stops;res.start=start;res.excluded=excl.length;res.hits=hitsOn(res.coords,hz.length?hz:hazards());R.route=res;render()}
  function gm(r){const pts=[...(r.start?[r.start]:[]),...r.stops].map(p=>`${(+p.lat).toFixed(6)},${(+p.lng).toFixed(6)}`),links=[];
    for(let i=0;i<pts.length-1;i+=10){const seg=pts.slice(i,i+11);links.push('https://www.google.com/maps/dir/?api=1&travelmode=driving&origin='+seg[0]+'&destination='+seg[seg.length-1]+(seg.length>2?'&waypoints='+encodeURIComponent(seg.slice(1,-1).join('|')):''))}return links}
  function result(r){const names=[...new Set(r.hits.map(h=>h.name))],off=r.start?1:0,links=gm(r);
    return `<div class="r-sum"><b>${r.stops.length} จุด · ${r.km.toFixed(1)} กม. · ~${Math.round(r.min)} นาที</b><small>${esc(r.engine)}${r.excluded?` · เลี่ยงจุดน้ำท่วม ${r.excluded} จุด`:''}</small></div>
    ${names.length?`<div class="r-warn">⚠️ เส้นทางยังผ่านจุดน้ำท่วม ${names.length} แห่ง: ${names.slice(0,5).map(esc).join(', ')}${names.length>5?'…':''} · ควรใช้รถสูงหรือเรือ</div>`:'<div class="r-ok">✓ ไม่พบถนนน้ำท่วมลึกบนเส้นทาง (ตามข้อมูลที่มี)</div>'}
    <ol class="r-stops">${r.stops.map((p,i)=>{const c=p.c,lg=(off?r.legs[i]:r.legs[i-1])||null;return `<li><span class="urg urg-${p.sv}">${URG[p.sv]}</span> ${esc((c.needs||[]).slice(0,2).join(', ')||'-')} · ${c.people||1} คน<small>#${esc(rawId(c.id))} · ${esc([c.address,c.district].filter(Boolean).join(' · ')||'-')}${lg?` · +${lg.km.toFixed(1)} กม.`:''}</small></li>`}).join('')}</ol>
    <div class="rt-act"><button type="button" class="btn primary" data-rt="assign" ${R.team?'':'disabled title="เลือกทีมในขั้นที่ 1 ก่อน"'}>มอบหมาย ${r.stops.length} เคสให้ ${esc(R.team||'ทีม')}</button>
      ${links.map((u,i)=>`<a class="btn ghost sm" href="${esc(u)}" target="_blank" rel="noopener">นำทาง Google Maps${links.length>1?' ช่วง '+(i+1):''}</a>`).join('')}<button type="button" class="btn ghost sm" data-rt="copy">คัดลอกส่งไลน์</button><button type="button" class="btn ghost sm" data-rt="clear">ล้าง</button></div>`}
  async function assign(){const r=R.route,team=R.team;if(!r||!team)return;const cs=r.stops.map(p=>p.c).filter(c=>c.status==='open');
    if(!cs.length){toast('ทุกเคสในเส้นทางมีทีมแล้ว');return}if(!confirm(`มอบหมาย ${cs.length} เคสในเส้นทางนี้ให้ "${team}"?`))return;
    let ok=0,taken=0;for(const c of cs){try{const x=await apiPost({action:'update',id:rawId(c.id),status:'going',volunteer:team,expectStatus:'open'});if(x&&x.ok){ok++;c.status='going';c.volunteer=team}else if(x&&x.error==='status_changed')taken++}catch(e){}}
    toast(`มอบหมายให้ ${team} แล้ว ${ok}/${cs.length} เคส${taken?` · ข้าม ${taken} เคสที่มีคนรับไปก่อนแล้ว`:''} · ขึ้นที่หน้าทีมแล้ว`,ok===cs.length);R.route=null;R.hmAt=0;await hmCases();if(typeof loadAll==='function')loadAll();render()}
  function copy(){const r=R.route;if(!r)return;const links=gm(r);
    const txt=`เส้นทาง Helpme+${R.team?' · '+R.team:''} · ${r.stops.length} จุด · ${r.km.toFixed(1)} กม. · ~${Math.round(r.min)} นาที\n`+r.stops.map((p,i)=>{const c=p.c;return `${i+1}. [${URG[p.sv]}] #${rawId(c.id)} · ${(c.needs||[]).join(', ')} · ${c.people||1} คน\n   ${[c.address,c.district].filter(Boolean).join(' · ')}${c.name?'\n   ติดต่อ: '+c.name:''}${c.phone?' '+String(c.phone).replace(/^'/,''):''}\n   https://www.google.com/maps?q=${(+c.lat).toFixed(6)},${(+c.lng).toFixed(6)}`}).join('\n')+`\n\nนำทางทั้งเส้น:\n${links.join('\n')}`;
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('คัดลอกแล้ว วางในไลน์ได้เลย (มีเบอร์ผู้แจ้ง ส่งเฉพาะกลุ่มทีม)',true)).catch(()=>toast('คัดลอกไม่สำเร็จ'))}
  document.addEventListener('change',e=>{const t=e.target;if(!t.closest||!t.closest('#rt-panel'))return;
    if(t.id==='rt-team'){R.team=t.value;const s=teamStart(t.value);if(s)R.start=s;R.route=null;render()}
    if(t.id==='rt-src'){R.src=t.value;R.route=null;render()}if(t.id==='rt-max'){R.max=+t.value;R.route=null}if(t.id==='rt-avoid')R.avoid=t.checked});
  document.addEventListener('click',async e=>{const b=e.target.closest('[data-rt]');if(!b||!b.closest('#rt-panel'))return;const k=b.dataset.rt;
    if(k==='gps'){if(!navigator.geolocation){toast('อุปกรณ์นี้หาตำแหน่งไม่ได้');return}b.textContent='กำลังหาตำแหน่ง…';navigator.geolocation.getCurrentPosition(p=>{R.start={lat:p.coords.latitude,lng:p.coords.longitude,label:'ตำแหน่งของฉัน'};render()},()=>{toast('หาตำแหน่งไม่ได้ ลองแตะเลือกบนแผนที่');render()},{enableHighAccuracy:true,timeout:10000});return}
    if(k==='pick'){R.picking=!R.picking;render();if(R.picking)toast('แตะบนแผนที่ด้านล่างเพื่อเลือกจุดเริ่มต้น',true);return}
    if(k==='go'){b.disabled=true;b.textContent='กำลังคำนวณ…';try{await compute()}finally{const x=document.querySelector('[data-rt="go"]');if(x){x.disabled=false}}return}
    if(k==='assign'){b.disabled=true;try{await assign()}finally{if(b.isConnected)b.disabled=false}return}
    if(k==='copy'){copy();return}if(k==='clear'){R.route=null;render();return}});
  async function init(){await hmCases();render()}
  return {init,render,refresh:()=>{if(!R.route&&!document.activeElement?.closest?.('#rt-panel'))render()}}})();
