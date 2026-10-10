/* รวมพล: ศูนย์เรียกทีมไปจุดเดียวกัน (ทีมขาดการติดต่อ · ทีมที่หน้างานกำลังไม่พอ)
   เลือกจุด: แตะแผนที่ / ตำแหน่งเคส / ตำแหน่งล่าสุดของทีม → เลือกทีม (ทุกทีมที่พร้อม หรือเลือกเอง เรียงจากใกล้) → เรียก
   ทีมได้แจ้งเตือนในแอป (นำทาง · กำลังไป · ถึงแล้ว · ไม่สะดวก) · ศูนย์เห็นสถานะตอบรับของแต่ละทีมสด */
const RALLY=(()=>{
  const R={list:[],pt:null,map:null,mk:null,open:false,sel:new Set(),all:false};
  const ST={going:['กำลังไป','go'],arrived:['ถึงแล้ว','ok'],declined:['ไม่สะดวก','no'],'':['ยังไม่ตอบ','wait']};
  const dkm=(a,b)=>km(a.lat,a.lng,b.lat,b.lng);
  const live=n=>T.live.find(l=>tname(l.team)===tname(n));
  async function load(){try{const r=await apiGet({action:'rallies'});if(r&&r.ok){R.list=r.rallies||[];if(R.open){const l=document.querySelector('#rl-panel .rl-list');if(l)l.innerHTML=active()}else draw();if(typeof TRACK!=='undefined'&&TRACK.rallies)TRACK.rallies(R.list)}}catch(e){}}
  function form(){const p=R.pt,teams=T.roster.filter(t=>t.status!=='rest').map(t=>{const l=live(t.name);return {t,d:p&&l?dkm(p,{lat:+l.lat,lng:+l.lng}):null}}).sort((a,b)=>(a.d??1e9)-(b.d??1e9));
    const cases=T.cases.filter(c=>c.status!=='done'&&hasPin(c)).slice(0,200);
    return `<div class="rl-form">
      <div class="rl-step"><b>1. จุดรวมพล</b><small>${p?`${esc(p.label)} · ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`:'แตะบนแผนที่ หรือเลือกจากเคส/ทีม'}</small></div>
      <div class="rl-map" id="rl-map"></div>
      <div class="rl-row"><select id="rl-case"><option value="">ใช้ตำแหน่งเคส…</option>${cases.map(c=>`<option value="${esc(c.id)}">#${esc(c.id)} · ${esc((c.needs||[]).slice(0,2).join(', ')||'เคส')} · ${esc(c.district||'')}</option>`).join('')}</select>
        <select id="rl-team"><option value="">ใช้ตำแหน่งล่าสุดของทีม… (เช่น ทีมที่ขาดการติดต่อ)</option>${T.roster.filter(t=>live(t.name)).map(t=>`<option value="${esc(t.name)}">${esc(t.name)} · ${esc(ago(live(t.name).updatedAt))}</option>`).join('')}</select></div>
      <label class="rl-f">ชื่อจุด / เหตุผล<input id="rl-label" maxlength="120" placeholder="เช่น ทีมเรือ 2 ขาดการติดต่อ · เคสต้องการกำลังเสริม" value="${esc(p&&p.why||'')}"></label>
      <label class="rl-f">หมายเหตุถึงทีม<input id="rl-note" maxlength="300" placeholder="เช่น นำเรือ + เชือกช่วยชีวิตไปด้วย"></label>
      <div class="rl-step"><b>2. ทีมที่เรียก</b><label class="rl-all"><input type="checkbox" id="rl-all" ${R.all?'checked':''}> ทุกทีมที่พร้อม/ออกเคส (${teams.length})</label></div>
      <div class="rl-teams" ${R.all?'hidden':''}>${teams.map(({t,d})=>`<label><input type="checkbox" data-rt="${esc(t.name)}" ${R.sel.has(t.name)?'checked':''}><span><b>${esc(t.name)}</b><small>${esc(TST[t.status]||'')}${t.vehicle?' · '+esc(VEH[t.vehicle]||''):''}${d!=null?` · ห่าง ${d<1?Math.round(d*1000)+' ม.':d.toFixed(1)+' กม.'}`:' · ไม่มีตำแหน่ง'}</small></span></label>`).join('')||'<p class="muted small">ยังไม่มีทีม</p>'}</div>
      <div class="rl-act"><button type="button" class="btn primary" id="rl-go" ${p?'':'disabled'}>📣 เรียกรวมพล</button><button type="button" class="btn ghost" id="rl-cancel">ยกเลิก</button></div></div>`}
  function active(){if(!R.list.length)return '<p class="muted small">ยังไม่มีการเรียกรวมพล</p>';
    return R.list.map(r=>{const by=new Map(r.resp.map(x=>[x.team,x])),cnt=k=>r.teams.filter(t=>((by.get(t)||{}).status||'')===k).length;
      return `<article class="rl-card"><div class="rl-h"><b>📣 ${esc(r.label)}</b><small>${esc(ago(r.createdAt))}${r.by?' · '+esc(r.by):''} · ${r.all?'ทุกทีม':r.teams.length+' ทีม'}</small></div>
        ${r.note?`<p class="small">${esc(r.note)}</p>`:''}
        <div class="rl-sum"><span class="ok">ถึงแล้ว ${cnt('arrived')}</span><span class="go">กำลังไป ${cnt('going')}</span><span class="wait">ยังไม่ตอบ ${cnt('')}</span><span class="no">ไม่สะดวก ${cnt('declined')}</span></div>
        <ul class="rl-resp">${r.teams.map(t=>{const x=by.get(t)||{status:''},[l,k]=ST[x.status]||ST[''],lv=live(t),d=lv?dkm(r,{lat:+lv.lat,lng:+lv.lng}):null;return `<li><span class="rl-b ${k}">${l}</span>${esc(t)}<small>${d!=null?(d<1?Math.round(d*1000)+' ม.':d.toFixed(1)+' กม.')+' จากจุด':''}${x.at?' · '+esc(ago(x.at)):''}</small></li>`}).join('')}</ul>
        <div class="rl-act"><a class="btn ghost sm" href="https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}" target="_blank" rel="noopener">นำทาง</a><button type="button" class="btn ghost sm" data-rl-close="${esc(r.id)}">ปิดรวมพล</button></div></article>`}).join('')}
  function draw(){const el=$('#rl-panel');if(!el)return;if(R.map){try{R.map.remove()}catch(e){}R.map=null;R.mk=null}
    el.innerHTML=(R.open?form():`<button type="button" class="btn primary rl-new" id="rl-new">📣 เรียกรวมพล</button>`)+`<div class="rl-list">${active()}</div>`;
    if(R.open)initMap();if(typeof TRACK!=='undefined'&&TRACK.rallies)TRACK.rallies(R.list)}
  function setPt(p){R.pt=p;const lab=$('#rl-label');const keep=lab&&lab.value;draw();if(keep&&$('#rl-label'))$('#rl-label').value=keep}
  function initMap(){const m=$('#rl-map');if(!m||!window.L)return;R.map=L.map(m,{scrollWheelZoom:false,zoomControl:false}).setView(R.pt?[R.pt.lat,R.pt.lng]:[13.76,100.6],R.pt?14:10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(R.map);L.control.zoom({position:'topright'}).addTo(R.map);
    T.live.forEach(l=>L.circleMarker([+l.lat,+l.lng],{radius:6,color:'#fff',weight:2,fillColor:'#2D45C8',fillOpacity:1}).bindTooltip(esc(l.team)).addTo(R.map));
    if(R.pt)R.mk=L.marker([R.pt.lat,R.pt.lng]).addTo(R.map);
    R.map.on('click',e=>setPt({lat:e.latlng.lat,lng:e.latlng.lng,label:'จุดที่เลือกบนแผนที่'}))}
  document.addEventListener('click',async e=>{const t=e.target;if(!t.closest||!t.closest('#rl-panel'))return;
    if(t.closest('#rl-new')){R.open=true;R.pt=null;R.sel=new Set();R.all=false;draw();return}
    if(t.closest('#rl-cancel')){R.open=false;draw();return}
    const c=t.closest('[data-rl-close]');if(c){if(!confirm('ปิดการเรียกรวมพลนี้?'))return;c.disabled=true;await apiPost({action:'rally_close',id:c.dataset.rlClose});load();return}
    if(t.closest('#rl-go')){const b=t.closest('#rl-go'),teams=[...R.sel];if(!R.all&&!teams.length){toast('เลือกทีมก่อน');return}
      b.disabled=true;const r=await apiPost({action:'rally_save',lat:R.pt.lat,lng:R.pt.lng,label:$('#rl-label').value.trim()||R.pt.label,note:$('#rl-note').value.trim(),all:R.all,teams,caseId:R.pt.caseId||''}).catch(()=>null);
      if(r&&r.ok){toast(`เรียกรวมพลแล้ว · แจ้ง ${r.sent} ทีม`,true);R.open=false;load()}else{toast('เรียกไม่สำเร็จ');b.disabled=false}}});
  document.addEventListener('change',e=>{const t=e.target;if(!t.closest||!t.closest('#rl-panel'))return;
    if(t.id==='rl-all'){R.all=t.checked;$('.rl-teams').hidden=R.all;return}
    if(t.dataset.rt){t.checked?R.sel.add(t.dataset.rt):R.sel.delete(t.dataset.rt);return}
    if(t.id==='rl-case'&&t.value){const c=T.cases.find(x=>String(x.id)===t.value);if(c)setPt({lat:+c.lat,lng:+c.lng,label:'เคส #'+c.id,caseId:c.id,why:'เคส #'+c.id+' ต้องการกำลังเสริม'});return}
    if(t.id==='rl-team'&&t.value){const l=live(t.value);if(l){R.sel.delete(t.value);setPt({lat:+l.lat,lng:+l.lng,label:'ตำแหน่งล่าสุดของ '+t.value,why:t.value+' ขาดการติดต่อ · จุดล่าสุด'})}}});
  setInterval(()=>{if(!document.hidden)load()},15000);
  return {load,start(team){R.open=true;R.all=false;R.sel=new Set();const l=team&&live(team);R.pt=l?{lat:+l.lat,lng:+l.lng,label:'ตำแหน่งล่าสุดของ '+team,why:team+' ขาดการติดต่อ · จุดล่าสุด'}:null;draw();const p=$('#rl-panel');if(p)p.scrollIntoView({behavior:'smooth',block:'start'})}};
})();
