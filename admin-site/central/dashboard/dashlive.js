const DLIVE=(()=>{
  const MK=new Map(),RT=new Map();let roster=[],plans={},g=null,rg=null;
  const tn=s=>String(s||'').replace(/^'/,'').trim();
  const NET={WIFI:'Wi-Fi',wifi:'Wi-Fi',cellular:'มือถือ','4g':'4G','3g':'3G','2g':'2G','slow-2g':'2G',OFFLINE:'ไม่มีเน็ต'};
  const DIR=h=>['เหนือ','ตะวันออกเฉียงเหนือ','ตะวันออก','ตะวันออกเฉียงใต้','ใต้','ตะวันตกเฉียงใต้','ตะวันตก','ตะวันตกเฉียงเหนือ'][Math.round(((+h%360)+360)%360/45)%8];
  const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fresh=t=>{const m=(Date.now()-Number(t.updatedAt))/60000;return m<5?'on':m<30?'idle':'old'};
  const myCase=k=>(D.cases||[]).filter(c=>c.status==='going'&&!c.teamDoneAt&&tn(c.volunteer)===k&&c.lat!==''&&c.lat!=null&&isFinite(+c.lat));
  async function loadMeta(){try{const[r,p]=await Promise.all([api({action:'roster',key:D.key}),api({action:'route_list',key:D.key})]);if(r&&r.ok)roster=r.roster||[];if(p&&p.ok){plans={};p.routes.forEach(x=>plans[x.team]=x)}}catch(x){}}
  function info(t){const k=tn(t.team),r=roster.find(x=>tn(x.name)===k)||{},age=Date.now()-Number(t.updatedAt),sp=t.speed!=null?Math.round(+t.speed):null,cs=myCase(k)[0],rt=RT.get(k);
    const sig=t.sig!=null&&age<15*60e3?['ไม่มี','อ่อนมาก','อ่อน','ดี','ดีมาก'][Math.max(0,Math.min(4,+t.sig))]:age<5*60e3?'ดี (ประมาณ)':'อ่อน (ประมาณ)';
    const row=(i,l,v)=>v==null||v===''?'':`<tr><td><i data-ic="${i}"></i>${l}</td><td><b>${v}</b></td></tr>`;
    return `<div class="dl-pop"><b class="dl-h">${e(k)}</b><small>${e(r.vehicle&&typeof VEH_IMG!=='undefined'?({boat:'เรือ',truck:'รถบรรทุก',pickup:'รถกระบะ',car:'รถยนต์',motorbike:'มอเตอร์ไซค์',foot:'เดินเท้า'}[r.vehicle]||''):'')}${r.members?' · '+e(r.members)+' คน':''} · ส่งตำแหน่ง ${e(ago(t.updatedAt))}</small>
      <table>${row('wifi','สัญญาณ',e(sig)+(t.net?' · '+e(NET[t.net]||t.net):'')+(t.carrier?' · '+e(t.carrier):''))}${row('box','แบตเตอรี่',t.battery!=null?e(t.battery)+'%'+(t.charging?' · กำลังชาร์จ':''):'')}
      ${row('nav','ความเร็ว',sp!=null?sp+' กม./ชม.'+(sp>=3&&t.heading!=null?' · มุ่ง'+DIR(t.heading):' · จอดอยู่'):'')}${row('mountain','ความสูง',t.alt!=null?Math.round(+t.alt)+' ม.':'')}${row('locate','ความแม่นยำ GPS',t.accuracy?'±'+Math.round(+t.accuracy)+' ม.':'')}
      ${row('sun','อุณหภูมิ',t.temp!=null?(+t.temp).toFixed(1)+'°C':'')}${row('drop','ความชื้น',t.hum!=null?Math.round(+t.hum)+'%':'')}${row('phone','เบอร์',r.phone?`<a href="tel:${e(String(r.phone).replace(/[^\d+]/g,''))}">${e(r.phone)}</a>`:'')}</table>
      ${cs?`<div class="dl-case"><i data-ic="flag"></i> ไปเคส #${e(cs.id)} · ${e((cs.needs||[]).slice(0,2).join(', ')||'เคส')}${rt&&rt.km!=null?`<br><b>${rt.km.toFixed(1)} กม.${rt.min!=null?' · ~'+Math.max(1,Math.round(rt.min))+' นาที':''}</b>${rt.plan?' · เส้นทางที่ศูนย์กำหนด':''}`:''}</div>`:'<div class="dl-case idle">ยังไม่ได้ถือเคส</div>'}</div>`}
  async function osrm(a,b){const u=`https://router.project-osrm.org/route/v1/driving/${a.lng.toFixed(6)},${a.lat.toFixed(6)};${b.lng.toFixed(6)},${b.lat.toFixed(6)}?overview=full&geometries=geojson`;
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),12000);try{const j=await fetch(u,{signal:ctl.signal}).then(r=>r.json());if(j.code!=='Ok')throw 0;const r=j.routes[0];return {coords:r.geometry.coordinates.map(c=>[c[1],c[0]]),km:r.distance/1000,min:r.duration/60}}finally{clearTimeout(tm)}}
  function route(t){const k=tn(t.team),cs=myCase(k);let r=RT.get(k);if(!cs.length){if(r){rg.removeLayer(r.g);RT.delete(k)}return}
    const me=L.latLng(+t.lat,+t.lng),c=cs.map(c=>({c,d:me.distanceTo([+c.lat,+c.lng])})).sort((a,b)=>a.d-b.d)[0].c,pl=plans[k]&&String(plans[k].caseId)===String(c.id)?plans[k]:null;
    if(!r){r={g:L.layerGroup().addTo(rg)};RT.set(k,r)}
    const draw=x=>{r.g.clearLayers();const co=x?x.coords:[[me.lat,me.lng],[+c.lat,+c.lng]];r.km=x?x.km:me.distanceTo([+c.lat,+c.lng])/1000;r.min=x?x.min:null;r.plan=!!pl;
      L.polyline(co,{color:'#fff',weight:8,opacity:.9}).addTo(r.g);L.polyline(co,{color:pl?'#1F7A43':'#E5383B',weight:5,dashArray:x?null:'8 8'}).bindTooltip(`${e(k)} → เคส #${e(c.id)} · ${r.km.toFixed(1)} กม.${r.min!=null?' · ~'+Math.max(1,Math.round(r.min))+' นาที':''}`,{sticky:true}).addTo(r.g);
      L.marker([+c.lat,+c.lng],{icon:L.divIcon({className:'',html:`<div class="rt-goal${pl?' plan':''}"><i data-ic="flag"></i><span>${r.km.toFixed(1)} กม.${r.min!=null?' · ~'+Math.max(1,Math.round(r.min))+' น.':''}</span></div>`,iconSize:null,iconAnchor:[14,28]}),zIndexOffset:900}).addTo(r.g);
      const m=MK.get(k);if(m&&m.isPopupOpen())m.setPopupContent(info(t))};
    if(pl){if(r.planAt!==pl.at){r.planAt=pl.at;r.cid=String(c.id);draw({coords:pl.coords,km:pl.km,min:pl.min})}return}
    const need=!r.at||r.cid!==String(c.id)||r.from.distanceTo(me)>150||Date.now()-r.at>180e3;
    if(need&&!r.busy){r.busy=true;r.at=Date.now();r.cid=String(c.id);r.from=me;r.planAt=null;osrm({lat:me.lat,lng:me.lng},{lat:+c.lat,lng:+c.lng}).then(draw).catch(()=>draw(null)).finally(()=>{r.busy=false})}}
  function upd(list){if(!M.map)return;if(!g){g=L.layerGroup();rg=L.layerGroup()}const on=$('#mt-live')?$('#mt-live').checked:true;
    if(on){g.addTo(M.map);rg.addTo(M.map)}else{g.remove();rg.remove()}const seen=new Set();
    (list||[]).forEach(t=>{const k=tn(t.team),r=roster.find(x=>tn(x.name)===k)||{};seen.add(k);const mv=t.speed!=null&&t.speed>=3;
      const html=`<span class="trk-pin ${fresh(t)}${mv?' mv':''}"><i>${typeof headArrow==='function'?headArrow(t,r.vehicle):''}</i><b class="nm">${e(k)}${t.battery!=null&&t.battery<=20&&!t.charging?`<small>แบต ${e(t.battery)}%</small>`:''}</b></span>`;
      let m=MK.get(k);if(!m){m=L.marker([+t.lat,+t.lng],{icon:L.divIcon({className:'',html,iconSize:null,iconAnchor:[17,0]}),zIndexOffset:1500,keyboard:false}).addTo(g);m._h=html;m.bindPopup(()=>info(m._t),{maxWidth:300});MK.set(k,m)}
      else{if(typeof glideTo==='function')glideTo(m,[+t.lat,+t.lng],900,t);else m.setLatLng([+t.lat,+t.lng]);if(m._h!==html){m._h=html;m.setIcon(L.divIcon({className:'',html,iconSize:null,iconAnchor:[17,0]}))}}
      m._t=t;if(m.isPopupOpen())m.setPopupContent(info(t));if(on)route(t)});
    for(const [k,m] of MK)if(!seen.has(k)){m.remove();MK.delete(k);const r=RT.get(k);if(r){rg.removeLayer(r.g);RT.delete(k)}}}
  let list=[];async function start(){M.map.on('popupopen',()=>{const l=document.getElementById('dleg');if(l)l.style.visibility='hidden'});M.map.on('popupclose',()=>{const l=document.getElementById('dleg');if(l)l.style.visibility=''});await loadMeta();upd(D.live);if(typeof LIVE!=='undefined')LIVE.start(rows=>{list=mergeLive(D.live||list,rows);D.live=list;upd(list)});
    setInterval(()=>{if(!document.hidden){loadMeta();upd(D.live)}},30000)}
  const boot=setInterval(()=>{if(M.map&&D.key){clearInterval(boot);start()}},1000);
  return {start,upd}})();
