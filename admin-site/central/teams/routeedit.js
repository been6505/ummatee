/* ศูนย์ช่วยกำหนดเส้นทางให้ทีม (หน้าจัดทีม) · แตะเส้นทาง/ธงปลายทางของทีมบนแผนที่ติดตามทีม
   - คำนวณหลายทาง: เลี่ยงน้ำท่วม (ถนนน้ำท่วม/รายงาน/เซ็นเซอร์น้ำสูง จากข้อมูลตรวจพื้นที่) · ทางเร็วสุด · ทางเลือกอื่น (OSRM)
   - ศูนย์ปรับเองได้: + จุดผ่าน (บังคับผ่าน) · + จุดอุปสรรค (ห้ามผ่าน เช่น ถนนขาด ต้นไม้ล้ม) แตะบนแผนที่ · ลากหมุดย้ายได้ · แตะหมุดเพื่อลบ
   - แต่ละทางบอก ระยะ · เวลา · จำนวนจุดน้ำท่วมที่ผ่าน → เลือกทาง + หมายเหตุ → ส่งให้ทีม (ทีมเห็นในการ์ดเคส + นำทาง Google Maps ตามจุดผ่าน)
   ใช้: ROUTE.nav (Valhalla/OSRM/จุดอันตราย) · TRACK.map() · VERIFY (ข้อมูลน้ำท่วม) */
const RTE=(()=>{
  const E={on:false,team:'',c:null,from:null,via:[],avoid:[],auto:true,mode:'',opts:[],sel:0,note:'',busy:false,g:null,plans:{}};
  const box=document.createElement('aside');box.className='rte';box.hidden=true;document.body.append(box);
  const fmt=x=>`${x.km.toFixed(1)} กม. · ~${Math.max(1,Math.round(x.min))} นาที`;
  const nav=()=>typeof ROUTE!=='undefined'&&ROUTE.nav;
  async function loadPlans(){try{const r=await apiGet({action:'route_list'});if(r&&r.ok){E.plans={};r.routes.forEach(x=>{E.plans[x.team]=x});if(typeof TRACK!=='undefined'&&TRACK.setPlans)TRACK.setPlans(E.plans)}}catch(e){}}
  function open(team,c,from){const m=TRACK.map();if(!m)return;Object.assign(E,{on:true,team,c,from,mode:'',opts:[],sel:0,busy:false});
    const pl=E.plans[team];if(pl&&String(pl.caseId)===String(c.id)){E.via=(pl.via||[]).map(p=>({lat:p[0],lng:p[1]}));E.avoid=(pl.avoid||[]).map(p=>({lat:p[0],lng:p[1]}));E.note=pl.note||''}else{E.via=[];E.avoid=[];E.note=''}
    if(!E.g)E.g=L.layerGroup().addTo(m);m.on('click',onMap);box.hidden=false;document.body.classList.add('rte-on');draw();compute()}
  function close(){E.on=false;box.hidden=true;document.body.classList.remove('rte-on');if(E.g)E.g.clearLayers();const m=TRACK.map();if(m)m.off('click',onMap)}
  function onMap(e){if(!E.on||!E.mode)return;(E.mode==='via'?E.via:E.avoid).push({lat:e.latlng.lat,lng:e.latlng.lng});E.mode='';compute()}
  async function osrmAlt(locs){const u='https://router.project-osrm.org/route/v1/driving/'+locs.map(p=>p.lng.toFixed(6)+','+p.lat.toFixed(6)).join(';')+'?overview=full&geometries=geojson&alternatives=3';
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),15000);try{const j=await fetch(u,{signal:ctl.signal}).then(r=>r.json());if(j.code!=='Ok')throw 0;
      return j.routes.map(r=>({engine:'OSRM',coords:r.geometry.coordinates.map(c=>[c[1],c[0]]),km:r.distance/1000,min:r.duration/60}))}finally{clearTimeout(tm)}}
  async function compute(){if(!nav()){E.err='ยังโหลดตัวคำนวณเส้นทางไม่เสร็จ';draw();return}E.busy=true;E.err='';draw();
    try{if(typeof VERIFY!=='undefined'&&!VERIFY.F.loaded)await VERIFY.load().catch(()=>{})}catch(e){}
    const N=nav(),allHz=N.hazards(),to={lat:+E.c.lat,lng:+E.c.lng},locs=[E.from,...E.via,to],keep=locs.map(p=>({lat:p.lat,lng:p.lng})),near=h=>keep.some(k=>VERIFY.dist(h.lat,h.lng,k.lat,k.lng)<=150);
    const hitsOf=co=>N.hitsOn(co,allHz).filter(h=>!near(h)),opts=[];
    // 1) เลี่ยงน้ำท่วม: เส้นทาง → ตัดจุดน้ำท่วมที่ทับเส้น → คำนวณใหม่ (สูงสุด 3 รอบ)
    if(E.auto){try{let excl=[...E.avoid],r=await N.valhalla(locs,excl);for(let i=0;i<3;i++){const h=hitsOf(r.coords);if(!h.length)break;excl=[...excl,...h].slice(0,60);try{r=await N.valhalla(locs,excl)}catch(e){break}}opts.push({...r,tag:'เลี่ยงน้ำท่วม'})}catch(e){}}
    try{opts.push({...(await N.valhalla(locs,E.avoid)),tag:'ทางเร็ว'})}catch(e){}
    if(!E.avoid.length)try{(await osrmAlt(locs)).forEach((r,i)=>opts.push({...r,tag:i?'ทางเลือก '+i:'ทางหลัก (OSRM)'}))}catch(e){}
    const uniq=[];opts.forEach(o=>{o.hits=hitsOf(o.coords).length;if(!uniq.some(u=>Math.abs(u.km-o.km)<.15&&u.hits===o.hits))uniq.push(o)});
    uniq.sort((a,b)=>a.hits-b.hits||a.min-b.min);E.opts=uniq;E.sel=0;E.hz=allHz;E.busy=false;if(!uniq.length)E.err='คำนวณเส้นทางไม่ได้ (บริการแผนที่ไม่ตอบ) · ลองใหม่';draw()}
  function drawMap(){const m=TRACK.map();if(!m||!E.g)return;E.g.clearLayers();
    E.opts.forEach((o,i)=>{if(i!==E.sel)L.polyline(o.coords,{color:'#5B6386',weight:4,opacity:.45,dashArray:'6 6'}).on('click',()=>{E.sel=i;draw()}).bindTooltip(`${o.tag} · ${fmt(o)}`,{sticky:true}).addTo(E.g)});
    const o=E.opts[E.sel];if(o){L.polyline(o.coords,{color:'#fff',weight:10,opacity:.95}).addTo(E.g);L.polyline(o.coords,{color:'#1F7A43',weight:6}).addTo(E.g)}
    (E.hz||[]).forEach(h=>{if(o&&!nav().hitsOn(o.coords,[h]).length&&!E.opts.some(x=>nav().hitsOn(x.coords,[h]).length))return;L.circleMarker([h.lat,h.lng],{radius:6,color:'#fff',weight:2,fillColor:'#2563EB',fillOpacity:.9}).bindTooltip(`น้ำท่วม · ${esc(h.name||'')}${h.depth?` · ${Math.round(h.depth)} ซม.`:''}`).addTo(E.g)});
    const pin=(p,i,kind)=>{const mk=L.marker([p.lat,p.lng],{draggable:true,icon:L.divIcon({className:'',html:`<div class="rte-pt ${kind}">${kind==='via'?i+1:'✕'}</div>`,iconSize:[26,26],iconAnchor:[13,13]})}).addTo(E.g);
      mk.bindTooltip(kind==='via'?`จุดผ่าน ${i+1} · ลากเพื่อย้าย · แตะเพื่อลบ`:'จุดอุปสรรค (ห้ามผ่าน) · ลากเพื่อย้าย · แตะเพื่อลบ');
      mk.on('dragend',()=>{const ll=mk.getLatLng();p.lat=ll.lat;p.lng=ll.lng;compute()});mk.on('click',()=>{(kind==='via'?E.via:E.avoid).splice(i,1);compute()})};
    E.via.forEach((p,i)=>pin(p,i,'via'));E.avoid.forEach((p,i)=>pin(p,i,'avoid'))}
  function draw(){if(!E.on)return;const pl=E.plans[E.team],sent=pl&&String(pl.caseId)===String(E.c.id);
    box.innerHTML=`<div class="rte-h"><div><b>ปรับเส้นทาง · ${esc(E.team)}</b><small>ไปเคส #${esc(E.c.id)} · ${esc((E.c.needs||[]).slice(0,2).join(', ')||'เคส')}${E.c.district?' · '+esc(E.c.district):''}</small></div><button type="button" class="rte-x" data-rx aria-label="ปิด">✕</button></div>
      ${sent?`<p class="rte-sent">ส่งให้ทีมแล้ว ${esc(ago(pl.at))}${pl.by?' · '+esc(pl.by):''} · ${pl.km} กม.</p>`:''}
      <label class="rte-chk"><input type="checkbox" data-rauto ${E.auto?'checked':''}> เลี่ยงถนนน้ำท่วม / จุดรายงานน้ำท่วม / เซ็นเซอร์น้ำสูง</label>
      <div class="rte-tools"><button type="button" class="${E.mode==='via'?'on':''}" data-rmode="via">+ จุดผ่าน</button><button type="button" class="${E.mode==='avoid'?'on':''}" data-rmode="avoid">+ จุดอุปสรรค</button>${E.via.length||E.avoid.length?'<button type="button" data-rreset>ล้างจุด</button>':''}</div>
      ${E.mode?`<p class="rte-hint">แตะบนแผนที่เพื่อวาง${E.mode==='via'?'จุดที่ต้องผ่าน':'จุดอุปสรรค (ห้ามผ่าน)'}</p>`:''}
      <div class="rte-opts">${E.busy?'<p class="rte-hint">กำลังคำนวณเส้นทาง…</p>':E.err?`<p class="rte-err">${esc(E.err)}</p>`:E.opts.map((o,i)=>`<button type="button" class="rte-o${i===E.sel?' on':''}" data-ropt="${i}"><b>${i===0?'แนะนำ · ':''}${esc(o.tag)}</b><span>${fmt(o)}</span><em class="${o.hits?'bad':'ok'}">${o.hits?`ผ่านจุดน้ำท่วม ${o.hits} จุด`:'ไม่ผ่านจุดน้ำท่วม'}</em></button>`).join('')}</div>
      <label class="rte-note">หมายเหตุถึงทีม<textarea data-rnote rows="2" maxlength="300" placeholder="เช่น ถนนสุวินทวงศ์ช่วง กม.5 น้ำลึก ให้เข้าทางซอย 12 แทน">${esc(E.note)}</textarea></label>
      <div class="rte-act"><button type="button" class="btn primary" data-rsend ${E.opts.length&&!E.busy?'':'disabled'}>ส่งเส้นทางให้ทีม</button>${sent?'<button type="button" class="btn ghost" data-rclear>ยกเลิกเส้นทางที่ส่ง</button>':''}</div>`;
    drawMap()}
  box.addEventListener('click',async e=>{const t=e.target;
    if(t.closest('[data-rx]')){close();return}
    const md=t.closest('[data-rmode]');if(md){E.mode=E.mode===md.dataset.rmode?'':md.dataset.rmode;draw();return}
    if(t.closest('[data-rreset]')){E.via=[];E.avoid=[];compute();return}
    const op=t.closest('[data-ropt]');if(op){E.sel=+op.dataset.ropt;draw();return}
    if(t.closest('[data-rsend]')){const o=E.opts[E.sel];if(!o)return;const b=t.closest('[data-rsend]');b.disabled=true;b.textContent='กำลังส่ง…';
      const step=Math.max(1,Math.ceil(o.coords.length/900)),coords=o.coords.filter((p,i)=>i%step===0||i===o.coords.length-1);
      try{const r=await apiPost({action:'route_set',team:E.team,caseId:E.c.id,coords,via:E.via,avoid:E.avoid,km:o.km,min:o.min,hits:o.hits,note:E.note.trim(),engine:o.engine||'',by:store.get('uh_staff')||''});if(!r||!r.ok)throw 0;
        toast(`ส่งเส้นทางให้ ${E.team} แล้ว`,true);await loadPlans();if(TRACK.refreshRoute)TRACK.refreshRoute(E.team);draw()}catch(err){toast('ส่งเส้นทางไม่สำเร็จ');b.disabled=false;b.textContent='ส่งเส้นทางให้ทีม'}return}
    if(t.closest('[data-rclear]')){if(!confirm('ยกเลิกเส้นทางที่ส่งให้ทีมนี้?'))return;await apiPost({action:'route_clear',team:E.team}).catch(()=>{});await loadPlans();draw()}});
  box.addEventListener('change',e=>{if(e.target.matches('[data-rauto]')){E.auto=e.target.checked;compute()}});
  box.addEventListener('input',e=>{if(e.target.matches('[data-rnote]'))E.note=e.target.value});
  setInterval(()=>{if(!document.hidden&&ADM.key)loadPlans()},20000);setTimeout(loadPlans,1500);
  return {open,close,loadPlans}})();
