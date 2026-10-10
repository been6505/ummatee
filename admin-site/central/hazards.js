const HZ=(()=>{
  const T={
    quake:{t:'แผ่นดินไหว',i:'🌐',c:'#b45309'},tsunami:{t:'สึนามิ',i:'🌊',c:'#0e7490'},fire:{t:'ไฟป่า / จุดความร้อน',i:'🔥',c:'#dc2626'},
    storm:{t:'พายุ / ฝนฟ้าคะนอง',i:'⛈️',c:'#4338ca'},hail:{t:'ลูกเห็บ',i:'🧊',c:'#0369a1'},heavyrain:{t:'ฝนตกรุนแรง',i:'🌧️',c:'#1d4ed8'},
    slide:{t:'เสี่ยงดินโคลนถล่ม / น้ำป่า',i:'⛰️',c:'#92400e'},flood:{t:'น้ำท่วม (GDACS)',i:'🌊',c:'#2563eb'},cyclone:{t:'พายุหมุนเขตร้อน',i:'🌀',c:'#7c3aed'},
    report:{t:'รายงานจากศูนย์',i:'📍',c:'#be123c'}};
  const RT={sinkhole:['หลุมยุบ / ถนนทรุด','🕳️'],landslide:['ดินโคลนถล่ม','⛰️'],flashflood:['น้ำป่าไหลหลาก','🌊'],quake:['แผ่นดินไหว','🌐'],tsunami:['สึนามิ','🌊'],fire:['ไฟป่า / ไฟไหม้','🔥'],
    storm:['พายุ','⛈️'],hail:['ลูกเห็บ','🧊'],heavyrain:['ฝนตกรุนแรง','🌧️'],flood:['น้ำท่วม','🌊'],other:['ภัยอื่น ๆ','⚠️']};
  const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
  const on=store.get('uh_hz_on',{quake:1,tsunami:1,fire:1,storm:1,hail:1,heavyrain:1,slide:1,flood:1,cyclone:1,report:1});
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const when=t=>t?new Date(t).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
  const S={data:null,maps:[],subs:[],timer:null,loading:null};
  const api=()=>(typeof API_URL!=='undefined'?API_URL:'/api');
  async function load(){if(S.loading)return S.loading;S.loading=fetch(api()+'?action=hazards&t='+Math.floor(Date.now()/60000)).then(r=>r.json()).then(d=>{if(d&&d.ok){S.data=d;S.maps.forEach(draw);S.subs.forEach(f=>{try{f(d)}catch(e){}})}}).catch(()=>{}).finally(()=>{S.loading=null});return S.loading}
  function items(d){if(!d)return [];const out=[];
    (d.quakes||[]).forEach(q=>{out.push({k:'quake',lat:q.lat,lng:q.lng,r:Math.max(6,(q.mag||3)*3.2),html:`<b>🌐 แผ่นดินไหว ขนาด ${E(q.mag)}</b><br>${E(q.place)}<br>${E(when(q.time))} · ลึก ${E(q.depth)} กม. · ${E(q.src)}${/^https:\/\//.test(q.url||'')?` · <a href="${E(q.url)}" target="_blank" rel="noopener">USGS ↗</a>`:''}`,lv:q.mag>=6?3:q.mag>=5?2:1});
      if(q.tsunami)out.push({k:'tsunami',lat:q.lat,lng:q.lng,html:`<b>🌊 เฝ้าระวังสึนามิ</b><br>จากแผ่นดินไหวขนาด ${E(q.mag)} ${E(q.place)}<br>${E(when(q.time))}`,lv:3})});
    (d.fires||[]).forEach(f=>out.push({k:'fire',lat:f.lat,lng:f.lng,dot:1,html:`<b>🔥 จุดความร้อน (ดาวเทียม VIIRS)</b><br>${E([f.amphoe?'อ.'+f.amphoe:'',f.province?'จ.'+f.province:''].filter(Boolean).join(' '))}${f.lu?'<br>'+E(f.lu):''}<br>${E(when(f.time))} · ความมั่นใจ ${E(f.conf)}`}));
    (d.gdacs||[]).forEach(g=>{const k=g.type==='TC'?'cyclone':g.type==='FL'?'flood':g.type==='EQ'?'quake':g.type==='WF'?'fire':'storm';if(g.type==='EQ')return;
      out.push({k,lat:g.lat,lng:g.lng,html:`<b>${T[k].i} ${E(g.name)}</b><br>ระดับ GDACS: ${E(g.level)}<br>${E((g.from||'').slice(0,10))} – ${E((g.to||'').slice(0,10))}${/^https:\/\//.test(g.url||'')?` · <a href="${E(g.url)}" target="_blank" rel="noopener">รายงาน ↗</a>`:''}`,lv:g.level==='Red'?3:g.level==='Orange'?2:1})});
    (d.weather||[]).forEach(w=>{const tx=`ฝน 24 ชม. ${w.rain24} มม. · 6 ชม.ข้างหน้า ${w.next6} มม.${w.gust?` · ลมกระโชก ${w.gust} กม./ชม.`:''}`;
      if(w.hail)out.push({k:'hail',lat:w.lat,lng:w.lng,html:`<b>🧊 อาจมีลูกเห็บ · จ.${E(w.province)}</b><br>พายุฝนฟ้าคะนองรุนแรงใน 6 ชม.<br>${E(tx)}`,lv:2,off:[10,-10]});
      if(w.storm)out.push({k:'storm',lat:w.lat,lng:w.lng,html:`<b>⛈️ ${w.thunder?'พายุฝนฟ้าคะนอง':'ลมกระโชกแรง'} · จ.${E(w.province)}</b><br>${E(tx)}`,lv:w.gust>=80?3:2,off:[-10,-10]});
      if(w.heavy)out.push({k:'heavyrain',lat:w.lat,lng:w.lng,html:`<b>🌧️ ฝนตกรุนแรง · จ.${E(w.province)}</b><br>${E(tx)}<br>ฝนสูงสุด ${E(w.maxHour)} มม./ชม.`,lv:w.rain24>=150?3:2,off:[10,10]});
      if(w.slide)out.push({k:'slide',lat:w.lat,lng:w.lng,html:`<b>⛰️ เสี่ยงดินโคลนถล่ม / น้ำป่าไหลหลาก · จ.${E(w.province)}</b><br>${w.slide==='high'?'ความเสี่ยงสูง':'ความเสี่ยงปานกลาง'} (ประเมินจากฝนในจังหวัดที่มีภูเขา ไม่ใช่การตรวจพบจริง)<br>${E(tx)}`,lv:w.slide==='high'?3:2,off:[-10,10]})});
    (d.reports||[]).forEach(r=>{const [t,i]=RT[r.type]||RT.other;out.push({k:'report',lat:r.lat,lng:r.lng,icon:i,rad:r.radiusM,html:`<b>${i} ${E(t)}</b> <small>(รายงานจากศูนย์)</small>${r.note?'<br>'+E(r.note):''}<br>${E(when(r.createdAt))} · ถึง ${E(when(r.expiresAt))}`,lv:r.level==='danger'?3:2})});
    return out}
  function counts(d){const c={};items(d).forEach(x=>c[x.k]=(c[x.k]||0)+1);return c}
  function draw(m){if(!window.L||!m.map)return;m.g.clearLayers();const its=items(S.data);
    its.forEach(x=>{if(!on[x.k])return;const t=T[x.k];
      if(x.dot){L.circleMarker([x.lat,x.lng],{radius:4,color:'#fff',weight:1,fillColor:t.c,fillOpacity:.9}).bindPopup(x.html).addTo(m.g);return}
      if(x.rad)L.circle([x.lat,x.lng],{radius:x.rad,color:t.c,weight:2,fillOpacity:.08,dashArray:'5 5',interactive:false}).addTo(m.g);
      if(x.k==='quake')L.circle([x.lat,x.lng],{radius:x.r*1500,color:t.c,weight:1.5,fillColor:t.c,fillOpacity:.12,interactive:false}).addTo(m.g);
      L.marker([x.lat,x.lng],{icon:L.divIcon({className:'hz-ic lv'+(x.lv||1),html:`<span style="--c:${t.c}">${x.icon||t.i}</span>`,iconSize:[30,30],iconAnchor:[15+(x.off?x.off[0]:0),15+(x.off?x.off[1]:0)]}),zIndexOffset:900+(x.lv||1)*100,keyboard:false}).bindPopup(x.html).addTo(m.g)});
    const c=counts(S.data),n=Object.entries(c).filter(([k])=>on[k]).reduce((a,[,v])=>a+v,0);
    if(m.btn)m.btn.innerHTML=`⚠️ ภัยพิบัติ${n?` <b>${n}</b>`:''}`;
    if(m.panel)m.panel.innerHTML=`<b class="hz-h">ชั้นภัยพิบัติ</b>${Object.entries(T).map(([k,t])=>`<label><input type="checkbox" data-hz="${k}"${on[k]?' checked':''}> <span>${t.i} ${t.t}</span><em>${c[k]||0}</em></label>`).join('')}
      <small class="hz-src">แผ่นดินไหว: USGS · กรมอุตุฯ · ไฟป่า: GISTDA (VIIRS 24 ชม.) · พายุ/น้ำท่วม: GDACS · ฝน/ลูกเห็บ/ลม: Open-Meteo (รายจังหวัด) · ดินถล่ม/น้ำป่า: ประเมินจากฝน${S.data?' · อัปเดต '+new Date(S.data.time).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):''}</small>`}
  function attach(map,opt={}){if(!window.L||!map||S.maps.some(m=>m.map===map))return;
    const m={map,g:L.layerGroup().addTo(map)};
    const Ctl=L.Control.extend({onAdd(){const d=L.DomUtil.create('div','hz-ctl leaflet-bar');d.innerHTML='<button type="button" class="hz-btn" aria-expanded="false">⚠️ ภัยพิบัติ</button><div class="hz-panel" hidden></div>';
      L.DomEvent.disableClickPropagation(d);L.DomEvent.disableScrollPropagation(d);m.btn=d.querySelector('.hz-btn');m.panel=d.querySelector('.hz-panel');
      m.btn.onclick=()=>{const o=m.panel.hidden;m.panel.hidden=!o;m.btn.setAttribute('aria-expanded',String(o))};
      m.panel.addEventListener('change',e=>{const k=e.target.dataset.hz;if(!k)return;on[k]=e.target.checked?1:0;store.set('uh_hz_on',on);S.maps.forEach(draw)});return d}});
    new Ctl({position:opt.position||'topright'}).addTo(map);S.maps.push(m);
    if(S.data)draw(m);else load();
    if(!S.timer)S.timer=setInterval(()=>{if(!document.hidden)load()},10*60000)}
  const st=document.createElement('style');st.textContent=`.hz-ic{background:none!important;border:0!important}.hz-ic span{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#fff;box-shadow:0 0 0 2.5px var(--c),0 3px 8px rgba(0,0,0,.3);font-size:16px;line-height:1}
.hz-ic.lv3 span{animation:hzp 1.4s ease-in-out infinite}@keyframes hzp{50%{box-shadow:0 0 0 2.5px var(--c),0 0 0 9px rgba(220,38,38,.18)}}@media(prefers-reduced-motion:reduce){.hz-ic.lv3 span{animation:none}}
.hz-ctl{background:#fff;border-radius:12px!important;overflow:hidden;font:13px/1.4 "IBM Plex Sans Thai",system-ui,sans-serif;color:#1b1f3b;max-width:280px}
.hz-btn{border:0;background:#fff;padding:7px 12px;font:inherit;font-weight:700;cursor:pointer;white-space:nowrap;color:#1b1f3b}.hz-btn b{background:#dc2626;color:#fff;border-radius:999px;padding:0 7px;margin-left:4px;font-size:12px}
.hz-panel{padding:8px 12px 10px;display:grid;gap:4px;border-top:1px solid #e5e7eb;max-height:60vh;overflow:auto}.hz-panel .hz-h{font-size:13px}
.hz-panel label{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;cursor:pointer}.hz-panel em{font-style:normal;color:#64748b;font-variant-numeric:tabular-nums}
.hz-src{color:#64748b;font-size:11px;line-height:1.4;margin-top:4px}`;document.head.append(st);
  return {attach,load,items,counts,T,RT,get data(){return S.data},onData(f){S.subs.push(f);if(S.data)f(S.data)}};
})();
