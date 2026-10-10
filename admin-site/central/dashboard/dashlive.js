const DLIVE=(()=>{
  const MK=new Map(),RT=new Map();let roster=[],plans={},g=null,rg=null,started=false,metaAt=0;
  const tn=TK.tn,e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const VN={boat:'เรือ',truck:'รถบรรทุก',pickup:'รถกระบะ',car:'รถยนต์',motorbike:'มอเตอร์ไซค์',foot:'เดินเท้า'};
  const fresh=t=>{const m=(Date.now()-Number(t.updatedAt))/60000;return m<5?'on':m<30?'idle':'old'};
  const myCase=k=>(D.cases||[]).concat(D.hmc||[]).filter(c=>c.status==='going'&&!c.teamDoneAt&&!c.dupOf&&tn(c.volunteer)===k&&TK.hasPin(c));
  async function loadMeta(){if(!D.key)return;metaAt=Date.now();try{const[r,p]=await Promise.all([api({action:'roster',key:D.key}),api({action:'route_list',key:D.key})]);if(r&&r.ok)roster=r.roster||[];if(p&&p.ok){plans={};p.routes.forEach(x=>plans[x.team]=x)}}catch(x){}}
  function info(t){const k=tn(t.team),r=roster.find(x=>tn(x.name)===k)||{},age=Date.now()-Number(t.updatedAt),sp=t.speed!=null?Math.round(+t.speed):null,cs=myCase(k)[0],rt=RT.get(k);
    const sig=t.sig!=null&&age<15*60e3?['ไม่มี','อ่อนมาก','อ่อน','ดี','ดีมาก'][Math.max(0,Math.min(4,+t.sig))]:age<5*60e3?'ดี (ประมาณ)':'อ่อน (ประมาณ)';
    const row=(i,l,v)=>v==null||v===''?'':`<tr><td><i data-ic="${i}"></i>${l}</td><td><b>${v}</b></td></tr>`;
    return `<div class="dl-pop"><b class="dl-h">${e(k)}</b><small>${e(VN[r.vehicle]||'')}${r.members?' · '+e(r.members)+' คน':''} · ส่งตำแหน่ง ${e(ago(t.updatedAt))}</small>
      <table>${row('wifi','สัญญาณ',e(sig)+(t.net?' · '+e(TK.NET[t.net]||t.net):'')+(t.carrier?' · '+e(t.carrier):''))}${row('box','แบตเตอรี่',t.battery!=null?e(t.battery)+'%'+(t.charging?' · กำลังชาร์จ':''):'')}
      ${row('nav','ความเร็ว',sp!=null?sp+' กม./ชม.'+(sp>=3&&t.heading!=null?' · มุ่ง'+TK.dir(t.heading):' · จอดอยู่'):'')}${row('mountain','ความสูง',t.alt!=null?Math.round(+t.alt)+' ม.':'')}${row('locate','ความแม่นยำ GPS',t.accuracy?'±'+Math.round(+t.accuracy)+' ม.':'')}
      ${row('sun','อุณหภูมิ',t.temp!=null?(+t.temp).toFixed(1)+'°C':'')}${row('drop','ความชื้น',t.hum!=null?Math.round(+t.hum)+'%':'')}${(()=>{const d=TK.hq&&TK.hq.to(k,t.lat,t.lng);return d?row('home','ห่างศูนย์',TK.hq.label(d)):''})()}${row('phone','เบอร์',r.phone?`<a href="tel:${e(String(r.phone).replace(/[^\d+]/g,''))}">${e(r.phone)}</a>`:'')}</table>
      ${cs?`<div class="dl-case"><i data-ic="flag"></i> ไปเคส #${e(cs.id)} · ${e((cs.needs||[]).slice(0,2).join(', ')||'เคส')}${rt&&rt.km!=null?`<br><b>${TK.eta(rt.km,rt.min)}</b>${rt.plan?' · เส้นทางที่ศูนย์กำหนด':''}`:''}</div>`:'<div class="dl-case idle">ยังไม่ได้ถือเคส</div>'}</div>`}
  function drop(k){const r=RT.get(k);if(r){rg.removeLayer(r.g);RT.delete(k)}}
  function route(t){const k=tn(t.team),cs=myCase(k);if(!cs.length){drop(k);return}
    const me=L.latLng(+t.lat,+t.lng),c=TK.nearest(me,cs),pl=plans[k]&&String(plans[k].caseId)===String(c.id)?plans[k]:null;
    let r=RT.get(k);if(!r){r={g:L.layerGroup().addTo(rg)};RT.set(k,r)}
    const draw=(x,plan)=>{r.g.clearLayers();const co=x?x.coords:[[me.lat,me.lng],[+c.lat,+c.lng]];r.km=x?x.km:me.distanceTo([+c.lat,+c.lng])/1000;r.min=x?x.min:null;r.plan=!!plan;
      L.polyline(co,{color:'#fff',weight:8,opacity:.9}).addTo(r.g);L.polyline(co,{color:plan?'#1F7A43':'#E5383B',weight:5,dashArray:x?null:'8 8'}).bindTooltip(`${e(k)} → เคส #${e(c.id)} · ${TK.eta(r.km,r.min)}`,{sticky:true}).addTo(r.g);
      L.marker([+c.lat,+c.lng],{icon:L.divIcon({className:'',html:`<div class="rt-goal${plan?' plan':''}"><i data-ic="flag"></i><span>${TK.eta(r.km,r.min)}</span></div>`,iconSize:null,iconAnchor:[14,28]}),zIndexOffset:900}).addTo(r.g);
      const m=MK.get(k);if(m&&m.isPopupOpen())m.setPopupContent(info(m._t))};
    if(pl){if(r.planAt!==pl.at){r.planAt=pl.at;r.cid=String(c.id);draw({coords:pl.coords,km:pl.km,min:pl.min},true)}return}
    if(r.planAt){r.planAt=null;r.at=0}
    const need=!r.at||r.cid!==String(c.id)||r.from.distanceTo(me)>150||Date.now()-r.at>180e3;
    if(need&&!r.busy){r.busy=true;r.at=Date.now();r.cid=String(c.id);r.from=me;const cid=r.cid,ok=()=>!r.planAt&&r.cid===cid&&RT.get(k)===r;
      TK.osrm({lat:me.lat,lng:me.lng},{lat:+c.lat,lng:+c.lng}).then(x=>{if(ok())draw(x,false)}).catch(()=>{if(ok())draw(null,false)}).finally(()=>{r.busy=false})}}
  function clear(){for(const m of MK.values())m.remove();MK.clear();for(const k of [...RT.keys()])drop(k);roster=[];plans={}}
  function upd(list){if(!M.map||!D.key)return;if(!g){g=L.layerGroup();rg=L.layerGroup()}const on=$('#mt-live')?$('#mt-live').checked:true;
    if(on){g.addTo(M.map);rg.addTo(M.map)}else{g.remove();rg.remove()}const seen=new Set();
    (list||[]).forEach(t=>{const k=tn(t.team),r=roster.find(x=>tn(x.name)===k)||{};seen.add(k);const mv=t.speed!=null&&t.speed>=3;
      const html=`<span class="trk-pin ${fresh(t)}${mv?' mv':''}"><i>${typeof headArrow==='function'?headArrow(t,r.vehicle):''}</i><b class="nm">${e(k)}${t.battery!=null&&t.battery<=20&&!t.charging?`<small>แบต ${e(t.battery)}%</small>`:''}</b></span>`;
      let m=MK.get(k);if(!m){m=L.marker([+t.lat,+t.lng],{icon:L.divIcon({className:'',html,iconSize:null,iconAnchor:[17,0]}),zIndexOffset:1500,keyboard:false}).addTo(g);m._h=html;m._team=true;m.bindPopup(()=>info(m._t),{maxWidth:300});MK.set(k,m)}
      else{glideTo(m,[+t.lat,+t.lng],900,t);if(m._h!==html){m._h=html;m.setIcon(L.divIcon({className:'',html,iconSize:null,iconAnchor:[17,0]}))}}
      m._t=t;if(m.isPopupOpen())m.setPopupContent(info(t));if(on)route(t)});
    for(const [k,m] of MK)if(!seen.has(k)){m.remove();MK.delete(k);drop(k)}}
  let HQM=null;function hq(){if(!M.map)return;const p=TK.hq&&TK.hq.on&&TK.hq.pos;if(!p){if(HQM){HQM.remove();HQM=null}return}
    if(!HQM)HQM=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<div class="hq-pin">ศูนย์</div>',iconSize:null,iconAnchor:[24,14]}),zIndexOffset:1600}).bindTooltip('ตำแหน่งเครื่องศูนย์').addTo(M.map);else HQM.setLatLng([p.lat,p.lng])}
  addEventListener('hm-hq',()=>{hq();for(const m of MK.values())if(m.isPopupOpen())m.setPopupContent(info(m._t))});setInterval(hq,5000);
  async function start(){started=true;const leg=v=>{const l=document.getElementById('dleg');if(l)l.style.visibility=v};
    if(!M._dlEv){M._dlEv=1;M.map.on('popupopen',ev=>{if(ev.popup._source&&ev.popup._source._team)leg('hidden')});M.map.on('popupclose',()=>leg(''));
      if(typeof LIVE!=='undefined')LIVE.start(rows=>{if(!D.key)return;D.live=mergeLive(D.live,rows);upd(D.live)});
      addEventListener('hm-rev',ev=>{if(D.key&&ev.detail.what.includes('rev'))loadMeta().then(()=>upd(D.live))})}
    await loadMeta();upd(D.live)}
  setInterval(()=>{if(!D.key){if(started){started=false;clear()}return}if(!started){if(M.map)start();return}if(!document.hidden&&Date.now()-metaAt>300000)loadMeta().then(()=>upd(D.live))},2000);
  return {upd}})();
