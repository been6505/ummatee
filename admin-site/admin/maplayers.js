/* ชั้นข้อมูลแผนที่แบบ Help Me ช่วยด้วย (ใช้ในแดชบอร์ด)
   - เรดาร์ฝน: RainViewer ภาพย้อนหลัง 2 ชม. ทุก 10 นาที (ซูมจริงสูงสุด 7) · ปุ่ม ▶ เล่นทิศทางฝน
   - ทีมกู้ภัยและเครือข่าย: จุดที่องค์กรลงพื้นที่ (outreach ของ Help Me + ชีตพื้นที่มอบแล้วของ UM+) เป็นป้ายสีตามองค์กร
   - กล้อง CCTV: /api?action=cctv (iTIC ผ่าน Longdo · เฉพาะกรุงเทพฯ)
   ใช้: MAPL.attach(map) แล้ว MAPL.sync() ทุกครั้งที่สวิตช์ใน #dlayer เปลี่ยน */
const MAPL=(()=>{
  const HELPME_API='https://script.google.com/macros/s/AKfycbyWeVDhToFJntjTGHprDEByEfRFdSbOidlR7QhJ6xG1bz7co2gCRkTGIoKDI9tJqGkWTw/exec';
  /* สีองค์กรชุดเดียวกับ Help Me */
  const ORGS=[{name:'สภาเครือข่ายฯ สำนักจุฬาราชมนตรี',short:'สภาฯ',color:'#7C3AED'},{name:'มูลนิธิป่อเต็กตึ๊ง',short:'ป่อเต็กตึ๊ง',color:'#C2410C'},
    {name:'มูลนิธิร่วมกตัญญู',short:'ร่วมกตัญญู',color:'#B45309'},{name:'มุสลิมสงเคราะห์ผู้ประสบภัย',short:'มุสลิมสงเคราะห์',color:'#0E7490'},
    {name:'ทีมกู้ภัย',short:'กู้ภัย',color:'#E8590C'},{name:'มูลนิธิอุมมะตี',short:'อุมมะตี',color:'#2E9E57'}];
  const orgOf=n=>{n=String(n||'').trim();return ORGS.find(o=>o.name===n)||ORGS.find(o=>n&&(n.includes(o.short)||o.name.includes(n)))||{name:n||'ทีมอาสา',short:n?(n.length>12?n.slice(0,11)+'…':n):'ทีม',color:'#5B6386'}};
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S={map:null,rain:null,rainAt:0,rainL:null,rainI:0,anim:null,ctl:null,net:null,netRows:null,cams:null,camL:null};
  const on=id=>{const e=document.getElementById(id);return !!(e&&e.checked)};
  const save=()=>{try{localStorage.setItem('uh_dlay',JSON.stringify(['mt-rain','mt-cov','mt-cctv','mt-gistda','mt-flood','mt-done','mt-leads','mt-live'].reduce((o,k)=>{const e=document.getElementById(k);if(e)o[k]=e.checked;return o},{})))}catch(e){}};
  function restore(){try{const o=JSON.parse(localStorage.getItem('uh_dlay')||'{}');for(const k in o){const e=document.getElementById(k);if(e)e.checked=!!o[k]}}catch(e){}}

  /* ---------- เรดาร์ฝน ---------- */
  const RAIN_OP=.62,RAIN_ATTR='Weather data by <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>';
  const frames=()=>(S.rain&&S.rain.radar&&S.rain.radar.past)||[];
  const tm=f=>new Date(f.time*1000).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  async function rainMeta(){if(S.rain&&Date.now()-S.rainAt<5*60e3)return;const r=await fetch('https://api.rainviewer.com/public/weather-maps.json',{cache:'no-store'}).then(r=>r.json());
    if(!r||!r.host||!r.radar||!(r.radar.past||[]).length)throw new Error('rain');S.rain=r;S.rainAt=Date.now()}
  function rainShow(i){if(!S.rainL)return;S.rainL.forEach((l,j)=>{if(j===i&&!S.map.hasLayer(l))l.addTo(S.map);if(S.map.hasLayer(l))l.setOpacity(j===i?RAIN_OP:0)});S.rainI=i;ctlSync()}
  function ctlSync(){if(!S.ctl)return;const fr=frames(),f=fr[S.rainI];if(!f)return;const el=S.ctl.getContainer();
    el.querySelector('button').textContent=S.anim?'❚❚':'▶';el.querySelector('button').setAttribute('aria-label',S.anim?'หยุดเล่นภาพเรดาร์':'เล่นภาพเรดาร์ย้อนหลัง 2 ชั่วโมง');
    el.querySelector('b').textContent=tm(f);el.querySelector('small').textContent=S.rainI===fr.length-1?'ล่าสุด':'ย้อนหลัง';el.classList.toggle('past',S.rainI!==fr.length-1)}
  function stop(){if(S.anim){clearInterval(S.anim);S.anim=null}rainShow(frames().length-1)}
  function play(){if(S.anim){stop();return}const fr=frames();if(fr.length<2)return;let i=0;S.rainL.forEach(l=>{if(!S.map.hasLayer(l))l.setOpacity(0).addTo(S.map)});
    const step=()=>{rainShow(i);i++;if(i>=fr.length){clearInterval(S.anim);S.anim=null;setTimeout(()=>{if(!S.anim)stop()},1200)}};step();S.anim=setInterval(step,700);ctlSync()}
  function rainClear(){if(S.anim){clearInterval(S.anim);S.anim=null}if(S.rainL){S.rainL.forEach(l=>S.map.removeLayer(l));S.rainL=null}if(S.ctl){S.ctl.remove();S.ctl=null}S.map.attributionControl.removeAttribution(RAIN_ATTR)}
  async function drawRain(){rainClear();if(!on('mt-rain'))return;try{await rainMeta()}catch(e){setSub('mt-rain','โหลดเรดาร์ไม่สำเร็จ ลองใหม่ภายหลัง');return}
    if(!on('mt-rain'))return;const fr=frames();
    if(!S.map.getPane('rain')){const p=S.map.createPane('rain');p.style.zIndex=350;p.style.pointerEvents='none'}
    S.rainL=fr.map(f=>L.tileLayer(S.rain.host+f.path+'/256/{z}/{x}/{y}/2/1_0.png',{pane:'rain',opacity:0,maxNativeZoom:7,maxZoom:20,tileSize:256}));
    S.map.attributionControl.addAttribution(RAIN_ATTR);
    const C=L.Control.extend({onAdd(){const d=L.DomUtil.create('div','rain-ctl');d.innerHTML='<button type="button">▶</button><span><small>ล่าสุด</small><b></b></span>';
      L.DomEvent.disableClickPropagation(d);d.querySelector('button').addEventListener('click',play);return d}});
    S.ctl=new C({position:'bottomleft'}).addTo(S.map);rainShow(fr.length-1);
    setSub('mt-rain',`ภาพล่าสุด ${tm(fr[fr.length-1])} น. · อัปเดตทุก 10 นาที`)}

  /* ---------- ทีมกู้ภัยและเครือข่ายช่วยเหลือ ---------- */
  /* outreach ของ Help Me ผ่าน /api (แคชที่ edge) · โหลดช้า/พังก็ยังวาดจุดจากชีต UM+ ไปก่อน แล้วเติมทีหลัง */
  async function outreach(){if(S.outreach&&Date.now()-S.outAt<5*60e3)return S.outreach;
    try{const r=await fetch('/api?action=outreach',{cache:'no-store'}).then(r=>r.json());if(r&&Array.isArray(r.points)&&r.points.length){S.outreach=r.points;S.outAt=Date.now()}}catch(e){}
    // เซิร์ฟเวอร์ดึงจาก Help Me ไม่ได้ (Apps Script ตอบ Cloudflare ช้า): ดึงตรงจากเบราว์เซอร์
    if(!S.outreach){try{const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),40000);
      const r=await fetch(HELPME_API+'?action=outreach&t='+Math.floor(Date.now()/300000),{signal:ctl.signal}).then(r=>r.json());clearTimeout(tm);
      if(r&&Array.isArray(r.points)){S.outreach=r.points.filter(p=>p.lat&&p.lng);S.outAt=Date.now()}}catch(e){}}
    return S.outreach||[]}
  async function loadNet(){if(S.netRows&&Date.now()-S.netAt<5*60e3)return S.netRows;
    const pts=S.outreach||[];if(!S.outreach&&!S.outLoading){S.outLoading=outreach().then(()=>{S.outLoading=null;S.netRows=null;drawNet()})}
    const rows=pts.filter(p=>p.lat&&p.lng).map(p=>({org:p.org,date:p.date||'',lat:+p.lat,lng:+p.lng,detail:p.detail||'',link:p.link||'',src:'Help Me'}));
    if(typeof COVERED!=='undefined')COVERED.C.rows.filter(r=>r.lat!=null).forEach(r=>{
      if(!rows.some(x=>x.org===r.org&&Math.abs(x.lat-r.lat)<.002&&Math.abs(x.lng-r.lng)<.002))
        rows.push({org:r.org,date:r.date||'',lat:+r.lat,lng:+r.lng,detail:[r.area,r.items,r.sets?r.sets+' ชุด':''].filter(Boolean).join(' · '),link:r.link||'',src:'พื้นที่มอบแล้ว',approx:r.approx})});
    S.netRows=rows;S.netAt=Date.now();return rows}
  let netGen=0;
  async function drawNet(){const g=++netGen;if(S.net){S.net.remove();S.net=null}if(!on('mt-cov'))return;const rows=await loadNet();if(g!==netGen||!on('mt-cov'))return;if(S.net){S.net.remove();S.net=null}
    S.net=L.layerGroup(rows.flatMap(h=>{const o=orgOf(h.org);
      return [L.circle([h.lat,h.lng],{radius:350,color:o.color,weight:1,opacity:.35,fillColor:o.color,fillOpacity:.13,interactive:false}),
        L.marker([h.lat,h.lng],{icon:L.divIcon({className:'org-pin',html:`<span style="background:${o.color}">${esc(o.short)}</span>`,iconSize:null}),opacity:.92,zIndexOffset:-200,keyboard:false})
          .bindPopup(`<b style="color:${o.color}">${esc(o.name)}</b>${h.date?'<br>วันที่ '+esc(h.date):''}${h.detail?'<br>'+esc(h.detail):''}${h.approx?'<br><small>ตำแหน่งโดยประมาณ</small>':''}${h.link?`<br><a href="${esc(h.link)}" target="_blank" rel="noopener">ที่มา ↗</a>`:''}<br><small>ข้อมูลจาก ${esc(h.src)}</small>`)]})).addTo(S.map);
    const used=new Map();rows.forEach(r=>{const o=orgOf(r.org);used.set(o.short,(used.get(o.short)||{o,n:0}));used.get(o.short).n++});
    const chips=[...used.values()].sort((a,b)=>b.n-a.n).slice(0,7).map(({o,n})=>`<span class="lchip"><i style="background:${o.color}"></i>${esc(o.short)} ${n}</span>`).join('');
    const box=document.getElementById('net-chips');if(box)box.innerHTML=chips||'<span class="lchip">ยังไม่มีจุด</span>'}

  /* ---------- กล้อง CCTV ---------- */
  async function drawCams(){if(S.camL){S.camL.remove();S.camL=null}if(!on('mt-cctv')){S.map.attributionControl.removeAttribution(CAM_ATTR);return}
    if(!S.cams){try{const r=await fetch('/api?action=cctv').then(r=>r.json());S.cams=r&&r.ok?r.cams:[]}catch(e){S.cams=[]}}
    if(!on('mt-cctv'))return;
    S.map.attributionControl.addAttribution(CAM_ATTR);
    const n=S.cams.length.toLocaleString('th-TH'),live=S.cams.filter(c=>c.hls).length;
    S.camL=CAMLIVE.layer(S.map,S.cams,show=>setSub('mt-cctv',show?`${n} ตัว · กล้องสีแดง = ภาพสด (${live}) · ที่เหลือภาพนิ่งล่าสุด`:`${n} ตัว · ซูมเข้าถึงจะแสดงกล้อง`))}
  const CAM_ATTR='กล้อง CCTV © <a href="https://flood.pop.in.th/" target="_blank" rel="noopener">POPNIX Flood</a> · iTIC';

  /* ---------- พื้นที่น้ำท่วมจากดาวเทียม (GISTDA) ---------- */
  const GIS_ATTR='น้ำท่วมจากดาวเทียม © <a href="https://disaster.gistda.or.th/" target="_blank" rel="noopener">GISTDA</a>';
  const GIS_TXT={'1day':'ย้อนหลัง 1 วัน','3days':'3 วันล่าสุด','7days':'7 วันล่าสุด','30days':'30 วันล่าสุด',freq:'พื้นที่น้ำท่วมซ้ำซาก'};
  let gisRange='7days';try{gisRange=localStorage.getItem('uh_gistda')||'7days'}catch(e){}
  async function drawGistda(){if(S.gis){S.map.removeLayer(S.gis);S.gis=null}S.map.attributionControl.removeAttribution(GIS_ATTR);
    document.querySelectorAll('[data-gr]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gr===gisRange)));
    if(!on('mt-gistda'))return;
    if(S.gisOn==null){try{const r=await fetch('/api?action=gistda_status').then(r=>r.json());S.gisOn=!!(r&&r.enabled)}catch(e){S.gisOn=false}}
    if(!S.gisOn){setSub('mt-gistda','ยังใช้ไม่ได้: ผู้ดูแลต้องตั้ง GISTDA_KEY (สมัครฟรีที่ api-gateway.gistda.or.th)');return}
    if(!S.map.getPane('gistda')){const p=S.map.createPane('gistda');p.style.zIndex=340;p.style.pointerEvents='none'}
    S.gis=L.tileLayer('/api/gistda/'+gisRange+'/{z}/{x}/{y}',{pane:'gistda',opacity:.65,maxZoom:20,maxNativeZoom:18}).addTo(S.map);
    S.map.attributionControl.addAttribution(GIS_ATTR);setSub('mt-gistda','GISTDA · '+GIS_TXT[gisRange]+' (สีฟ้า = น้ำท่วม)')}
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-gr]');if(!b)return;e.preventDefault();gisRange=b.dataset.gr;try{localStorage.setItem('uh_gistda',gisRange)}catch(err){}
    const sw=document.getElementById('mt-gistda');if(sw&&!sw.checked){sw.checked=true;save()}drawGistda()});
  function setSub(id,t){const e=document.querySelector(`[data-sub="${id}"]`);if(e)e.textContent=t}
  function sync(){save();drawRain();drawNet();drawCams();drawGistda()}
  function attach(map){if(S.map)return;S.map=map;restore();
    ['mt-rain','mt-cov','mt-cctv','mt-gistda'].forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener('change',()=>{save();({'mt-rain':drawRain,'mt-cov':drawNet,'mt-cctv':drawCams,'mt-gistda':drawGistda})[id]()})});
    ['mt-flood','mt-done','mt-leads','mt-live'].forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener('change',save)});
    sync();setInterval(()=>{if(!document.hidden&&on('mt-rain')&&!S.anim){S.rainAt=0;drawRain()}},10*60e3)}
  /* ข้อมูลพื้นที่มอบแล้วโหลดเสร็จทีหลัง: วาดชั้นเครือข่ายใหม่ */
  function refreshNet(){S.netRows=null;if(S.map)drawNet()}
  return {attach,sync,refreshNet,orgOf,ORGS}
})();
