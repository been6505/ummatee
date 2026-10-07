/* HELP ME CENTRAL · แถบประกาศแจ้งเตือนรายพื้นที่ (ใช้ร่วมกัน: หน้าบ้าน helpme4u.com · หน้าทีม · ทุกหน้า CENTRAL)
   <script src="https://central.helpme4u.com/bc.js" data-mode="public|team|staff" defer></script>
   - public/team: แสดงประกาศที่ตรงพื้นที่ผู้ใช้ (GPS ถ้าเคยอนุญาตแล้ว · พื้นที่ที่ผู้ใช้เลือกเอง) · ประกาศอันตรายที่ยังไม่รู้พื้นที่ก็แสดง
   - staff (CENTRAL): แสดงทุกประกาศที่ยังมีผล
   - ประกาศใหม่ที่ตรงพื้นที่: เด้งเตือน + เสียง + สั่น + แจ้งเตือนระบบ (ถ้าเคยอนุญาต) · ดึงใหม่ทุก 1 นาที และตอนกลับมาเปิดหน้า
   ไม่ขอสิทธิ์ตำแหน่งเอง (ไม่รบกวนผู้ใช้) · ตำแหน่งไม่ถูกส่งออกจากเครื่อง ใช้เทียบในเครื่องเท่านั้น */
(()=>{
  if(window.HMBC)return;
  const me=document.currentScript,MODE=(me&&me.dataset.mode)||'public',API=new URL('/api',me&&me.src?me.src:location.href).href;
  const LV={info:{t:'ข่าวสาร',i:'ℹ️',c:'#1f5fbf',bg:'#eaf1fd'},warn:{t:'เฝ้าระวัง',i:'⚠️',c:'#b45309',bg:'#fff4e0'},danger:{t:'อันตราย · อพยพ',i:'🚨',c:'#c62828',bg:'#fdeaea'}};
  const RANK={danger:0,warn:1,info:2};
  const BKK='พระนคร ดุสิต หนองจอก บางรัก บางเขน บางกะปิ ปทุมวัน ป้อมปราบศัตรูพ่าย พระโขนง มีนบุรี ลาดกระบัง ยานนาวา สัมพันธวงศ์ พญาไท ธนบุรี บางกอกใหญ่ ห้วยขวาง คลองสาน ตลิ่งชัน บางกอกน้อย บางขุนเทียน ภาษีเจริญ หนองแขม ราษฎร์บูรณะ บางพลัด ดินแดง บึงกุ่ม สาทร บางซื่อ จตุจักร บางคอแหลม ประเวศ คลองเตย สวนหลวง จอมทอง ดอนเมือง ราชเทวี ลาดพร้าว วัฒนา บางแค หลักสี่ สายไหม คันนายาว สะพานสูง วังทองหลาง คลองสามวา บางนา ทวีวัฒนา ทุ่งครุ บางบอน'.split(' ');
  const S={items:[],open:false,loaded:0,pos:null};
  const get=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
  const set=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const km=(a,b)=>{const r=Math.PI/180,x=Math.sin((b.lat-a.lat)*r/2),y=Math.sin((b.lng-a.lng)*r/2);return 12742*Math.asin(Math.sqrt(x*x+Math.cos(a.lat*r)*Math.cos(b.lat*r)*y*y))};
  const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'เมื่อสักครู่':m<60?m+' นาทีที่แล้ว':m<1440?Math.round(m/60)+' ชม.ที่แล้ว':new Date(t).toLocaleDateString('th-TH',{day:'numeric',month:'short'})};
  const until=t=>new Date(t).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const area=b=>b.scope==='all'?'ทุกพื้นที่':b.scope==='province'?'จังหวัด'+b.provinces.join(', '):b.scope==='district'?b.districts.map(d=>/^อำเภอ/.test(d)?d:'เขต'+d).join(', '):`รัศมี ${b.radiusKm} กม. จากจุดที่กำหนด`;
  const myArea=()=>get('hmbc_area','');           // พื้นที่ที่ผู้ใช้เลือกเอง: เขตใน กทม. หรือชื่อจังหวัด
  const myPos=()=>S.pos||(l=>l&&Date.now()-l.t<2*864e5?l:null)(get('hmbc_pos',null));
  const inBkk=p=>p&&p.lat>13.49&&p.lat<13.96&&p.lng>100.32&&p.lng<100.94;
  /* true = ตรงพื้นที่ · false = พื้นที่อื่น · null = ยังไม่รู้ */
  function match(b){if(MODE==='staff'||b.scope==='all')return true;
    const p=myPos(),a=myArea(),aProv=BKK.includes(a)?'กรุงเทพมหานคร':a;
    if(b.scope==='circle')return p?km(p,{lat:+b.lat,lng:+b.lng})<=(+b.radiusKm||0)+0.2:null;
    if(b.scope==='province'){if(aProv)return b.provinces.includes(aProv);if(inBkk(p))return b.provinces.includes('กรุงเทพมหานคร');return null}
    if(b.scope==='district'){if(a&&BKK.includes(a))return b.districts.includes(a);return a?false:null}
    return null}
  /* ---------- หน้าตา ---------- */
  const css=`#hmbc{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 8px);z-index:2147483000;width:min(560px,calc(100vw - 16px));font:14px/1.45 "IBM Plex Sans Thai","Noto Sans Thai",system-ui,sans-serif;color:#1b1f3b;display:grid;gap:6px;pointer-events:none}
#hmbc>*{pointer-events:auto}
#hmbc .c{border-radius:16px;padding:10px 12px 10px 14px;box-shadow:0 10px 30px rgba(15,20,45,.22);border-left:5px solid var(--c);background:var(--bg);display:grid;gap:3px;animation:hmbcIn .25s ease-out}
#hmbc .h{display:flex;gap:8px;align-items:center;font-size:12.5px;color:#475569}#hmbc .h b{color:var(--c);font-weight:700}#hmbc .h .x{margin-left:auto}
#hmbc .h .you{background:var(--c);color:#fff;border-radius:999px;padding:0 8px;font-weight:700}
#hmbc strong{font-size:15.5px;line-height:1.35}#hmbc p{margin:0;white-space:pre-line}
#hmbc .f{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:#475569}#hmbc a{color:var(--c);font-weight:700}
#hmbc button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}
#hmbc .x{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:18px;line-height:1;color:#64748b}
#hmbc .x:hover{background:rgba(0,0,0,.06)}
#hmbc .bar{justify-self:center;display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
#hmbc .pill{background:#1b1f3b;color:#fff;border-radius:999px;padding:6px 12px;font-weight:600;font-size:13px;box-shadow:0 6px 18px rgba(15,20,45,.25)}
#hmbc .pill.danger{background:#c62828;animation:hmbcP 1.4s ease-in-out infinite}
#hmbc select{font:inherit;font-size:13px;border-radius:999px;border:1px solid #cbd5e1;padding:5px 10px;background:#fff;color:#1b1f3b}
#hmbc .c.flash{outline:3px solid var(--c)}
@keyframes hmbcIn{from{transform:translateY(-8px);opacity:0}}@keyframes hmbcP{50%{box-shadow:0 0 0 8px rgba(198,40,40,0)}}
@media(prefers-reduced-motion:reduce){#hmbc .c,#hmbc .pill.danger{animation:none}}
@media(prefers-color-scheme:dark){#hmbc .c{color:#1b1f3b}}
#hmbc.staff{top:auto;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);left:16px;transform:none;width:min(440px,calc(100vw - 96px))}
#hmbc.staff .bar{justify-self:start}
#hmbc.staff .c{padding:8px 10px 8px 12px}#hmbc.staff .c p,#hmbc.staff .c .f{display:none}#hmbc.staff .c.open p,#hmbc.staff .c.open .f{display:flex}#hmbc.staff .c.open p{display:block}#hmbc.staff strong{font-size:14px;cursor:pointer}
@media(min-width:761px){#hmbc.staff{width:min(380px,calc(100vw - 96px))}}
@media(max-width:760px){#hmbc.staff{bottom:calc(env(safe-area-inset-bottom,0px) + 86px)}}`;
  let root=null;
  function mount(){if(root)return root;const st=document.createElement('style');st.textContent=css;document.head.append(st);
    root=document.createElement('div');root.id='hmbc';if(MODE==='staff')root.className='staff';root.setAttribute('role','region');root.setAttribute('aria-label','ประกาศแจ้งเตือนพื้นที่');root.setAttribute('aria-live','polite');document.body.append(root);
    root.addEventListener('click',onClick);root.addEventListener('change',e=>{if(e.target.matches('select[data-area]')){set('hmbc_area',e.target.value);render()}});return root}
  const hidden=()=>get('hmbc_hide',{});
  function card(b,m){const lv=LV[b.level]||LV.info;
    return `<article class="c" id="hmbc-${esc(b.id)}" style="--c:${lv.c};--bg:${lv.bg}"><div class="h"><b>${lv.i} ${lv.t}</b>${m===true&&b.scope!=='all'&&MODE!=='staff'?'<span class="you">ในพื้นที่ของคุณ</span>':m===null?'<span>อาจเกี่ยวกับพื้นที่ของคุณ</span>':''}<span>${esc(ago(b.createdAt))}</span><button class="x" type="button" data-hide="${esc(b.id)}" aria-label="ซ่อนประกาศนี้">×</button></div>
      <strong>${esc(b.title)}</strong>${b.body?`<p>${esc(b.body)}</p>`:''}<div class="f"><span>📍 ${esc(area(b))}</span><span>ถึง ${esc(until(b.expiresAt))}</span>${b.scope==='circle'?`<a href="https://www.google.com/maps/search/?api=1&query=${+b.lat},${+b.lng}" target="_blank" rel="noopener">ดูจุดบนแผนที่ ↗</a>`:''}${/^https:\/\//.test(b.link)?`<a href="${esc(b.link)}" target="_blank" rel="noopener">รายละเอียด ↗</a>`:''}</div></article>`}
  function render(){
    const items=S.items.map(b=>({b,m:match(b)})).filter(x=>x.m!==false&&(x.m===true||x.b.level==='danger'||MODE==='staff')).sort((x,y)=>RANK[x.b.level]-RANK[y.b.level]||y.b.createdAt-x.b.createdAt);
    const hd=hidden(),vis=items.filter(x=>!hd[x.b.id+'@'+x.b.createdAt]);
    if(!S.items.length){if(root)root.innerHTML='';return}
    mount();
    const shown=S.open?items:vis.slice(0,1),rest=items.length-shown.length,anyDanger=items.some(x=>x.b.level==='danger');
    const needArea=MODE!=='staff'&&S.items.some(b=>match(b)===null);
    let bar='';
    if(rest>0||S.open)bar+=`<button class="pill${anyDanger&&!S.open?' danger':''}" type="button" data-toggle>${S.open?'ย่อประกาศ':(shown.length?`ประกาศอีก ${rest} รายการ`:`${anyDanger?'🚨 ':'📢 '}ประกาศ ${items.length} รายการ`)}</button>`;
    if(needArea&&(S.open||shown.length||rest))bar+=`<select data-area aria-label="พื้นที่ของฉัน"><option value="">พื้นที่ของฉัน…</option><optgroup label="เขตในกรุงเทพฯ">${BKK.map(d=>`<option${d===myArea()?' selected':''}>${d}</option>`).join('')}</optgroup>${[...new Set(S.items.flatMap(b=>b.provinces||[]))].filter(p=>p!=='กรุงเทพมหานคร').map(p=>`<option${p===myArea()?' selected':''}>${esc(p)}</option>`).join('')}</select>`;
    root.innerHTML=shown.map(x=>card(x.b,x.m)).join('')+(bar?`<div class="bar">${bar}</div>`:'')}
  function onClick(e){if(MODE==='staff'&&e.target.closest('.c strong')){e.target.closest('.c').classList.toggle('open');return}
    const h=e.target.closest('[data-hide]');if(h){const b=S.items.find(x=>x.id===h.dataset.hide);if(b){const hd=hidden();hd[b.id+'@'+b.createdAt]=Date.now();set('hmbc_hide',hd)}S.open=false;render();return}
    if(e.target.closest('[data-toggle]')){S.open=!S.open;render()}}
  /* ---------- เตือนประกาศใหม่ ---------- */
  function beep(danger){try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const a=new C(),o=a.createOscillator(),g=a.createGain();o.connect(g);g.connect(a.destination);o.type='sine';
    [0,.35,.7].slice(0,danger?3:1).forEach((t,i)=>{o.frequency.setValueAtTime(i%2?660:880,a.currentTime+t)});g.gain.setValueAtTime(.18,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+(danger?1.1:.4));o.start();o.stop(a.currentTime+(danger?1.1:.4))}catch(e){}}
  function announce(){const seen=new Set(get('hmbc_seen',[])),first=!get('hmbc_init',false);let fresh=null;
    S.items.forEach(b=>{const k=b.id+'@'+b.createdAt;if(seen.has(k))return;seen.add(k);if(first&&MODE!=='staff')return;const m=match(b);
      if(m===false||(m===null&&b.level!=='danger'))return;if(!fresh||RANK[b.level]<RANK[fresh.level])fresh=b});
    set('hmbc_seen',[...seen].slice(-300));set('hmbc_init',true);
    if(!fresh||first)return;const lv=LV[fresh.level]||LV.info;
    beep(fresh.level==='danger');try{navigator.vibrate&&navigator.vibrate(fresh.level==='danger'?[400,150,400,150,400]:[200])}catch(e){}
    try{if('Notification' in window&&Notification.permission==='granted'&&document.hidden)new Notification(`${lv.i} ${fresh.title}`,{body:String(fresh.body||area(fresh)).slice(0,180),tag:'hmbc-'+fresh.id})}catch(e){}
    const el=document.getElementById('hmbc-'+fresh.id);if(el){el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),2500)}}
  /* ---------- ตำแหน่ง: ใช้เฉพาะเมื่อเคยอนุญาตแล้ว ---------- */
  async function locate(){try{if(!navigator.geolocation||!navigator.permissions)return;const p=await navigator.permissions.query({name:'geolocation'});if(p.state!=='granted')return;
    navigator.geolocation.getCurrentPosition(q=>{S.pos={lat:q.coords.latitude,lng:q.coords.longitude,t:Date.now()};set('hmbc_pos',{lat:+S.pos.lat.toFixed(3),lng:+S.pos.lng.toFixed(3),t:Date.now()});render()},()=>{},{maximumAge:120000,timeout:15000})}catch(e){}}
  async function load(){try{const r=await fetch(API+'?action=broadcasts&t='+Math.floor(Date.now()/30000),{cache:'no-store',credentials:'omit'}).then(x=>x.json());
      if(!r||!r.ok)return;const now=Date.now();
      S.items=(r.broadcasts||[]).filter(b=>!b.cancelledAt&&b.expiresAt>now).map(b=>({...b,provinces:b.provinces||[],districts:b.districts||[]}));S.loaded=now;
      const hd=hidden();for(const k in hd)if(now-hd[k]>12*3600e3)delete hd[k];set('hmbc_hide',hd);
      render();announce()}catch(e){}}
  window.HMBC={reload:load,setPos:(lat,lng)=>{S.pos={lat:+lat,lng:+lng,t:Date.now()};render()}};
  const start=()=>{locate();load();setInterval(()=>{if(!document.hidden)load()},60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-S.loaded>30000){locate();load()}})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
