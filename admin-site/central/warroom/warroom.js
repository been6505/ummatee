/* War Room: โครงสร้าง HELP ME CENTRAL → ศูนย์ประสานงานจังหวัด → War Room โซน → ทีม
   - CENTRAL: ภาพรวมทั้งหมด (Common Operating Picture) + แท็บโครงสร้าง
   - ศูนย์ประสานงานจังหวัด (kind=province): เห็นเคส/ทีม/โซนทั้งจังหวัด
   - War Room โซน (kind=zone): ขอบเขตในจังหวัด = รายชื่อเขต/อำเภอ และ/หรือ วงกลม · ทีมสังกัดโซน
   - War Room ย่อย: ขอบเขต = รายชื่อเขต และ/หรือ วงกลม (จุดกลาง + รัศมี) · มีทีมประจำ (roster.warroom) · คลังของเอง (stock.warroom) · ทีมงานประจำห้อง
   - แท็บในห้อง: ภาพรวม · เคส (มอบทีม/เปลี่ยนสถานะเคสในระบบ · เคส Help Me เปิดที่ Help Me) · ทีม · สต็อก · โปรไฟล์
   ข้อมูล: เคส Help Me (หลัก) + เคสในระบบ · ทีม/ตำแหน่งสด (roster) · SOS/สายเข้า/แชท (chat_threads) · ประกาศกรมอุตุฯ (news)
   อัปเดตเอง: เคส 30 วิ · ทีม/แจ้งเตือน 15 วิ · ประกาศ 10 นาที */
const W={cases:[],roster:[],live:[],threads:[],alerts:{sos:[],calls:[]},warn:[],rooms:[],staff:[],items:[],log:[],
  room:'',tab:'over',cst:'open',cq:'',map:null,lc:null,lt:null,lr:null,fitted:'',at:0};
const sev=c=>typeof VERIFY!=='undefined'&&VERIFY.level?VERIFY.level(c):Math.min(3,Math.max(1,Number(c.urgency)||1)); // ระดับที่ระบบตัดสิน (ผู้แจ้ง + ข้อมูลระบบ)
const URG={3:'วิกฤต',2:'เร่งด่วน',1:'ปกติ'};
const ST={ready:'พร้อม',out:'ออกงาน',rest:'พัก'};
const CST={open:'รอช่วย',going:'กำลังไป',done:'ช่วยแล้ว'};
const ROLES={lead:'หัวหน้า War Room',ops:'ปฏิบัติการ',dispatch:'สั่งการ / จ่ายงาน',stock:'คลัง / โลจิสติกส์',comms:'สื่อสาร / ประสานงาน',medic:'การแพทย์',staff:'ทีมงาน'};
const COLORS=['#2D45C8','#E5383B','#F57C00','#2E9E57','#7B3FC4','#0E7490','#B45309','#DB2777'];
const hasPin=c=>c.lat!==''&&c.lat!=null&&isFinite(+c.lat)&&isFinite(+c.lng)&&+c.lat!==0;
const today0=()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime()};
const mins=t=>t?Math.max(0,Math.round((Date.now()-t)/60000)):null;
const waitTxt=t=>{const m=mins(t);if(m==null)return '';if(m<60)return m+' นาที';const h=Math.floor(m/60);return h<24?h+' ชม. '+(m%60)+' นาที':Math.floor(h/24)+' วัน'};
const vol=c=>String(c.volunteer||'').replace(/^'/,'').trim();
const photos=c=>Array.isArray(c.photos)?c.photos.filter(id=>/^[-\w]{25,}$/.test(id)):[];
const thumb=(id,w=96)=>`https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w${w}`;
const navLink=(lat,lng)=>`https://www.google.com/maps/dir/?api=1&destination=${+lat},${+lng}&travelmode=driving`;
const caseLink=c=>'../../central.html#'+encodeURIComponent(c.src==='hm'?'hm-'+c.id:c.id);
const km=(a,b,c,d)=>{const R=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,s=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(s))};
const normD=d=>String(d||'').replace(/^เขต\s*/,'').replace(/\s+/g,'');
const telOf=p=>String(p||'').replace(/^'/,'').replace(/[^\d+]/g,'');
const room=()=>W.rooms.find(r=>r.id===W.room)||null;
const PROVINCES='กรุงเทพมหานคร กระบี่ กาญจนบุรี กาฬสินธุ์ กำแพงเพชร ขอนแก่น จันทบุรี ฉะเชิงเทรา ชลบุรี ชัยนาท ชัยภูมิ ชุมพร เชียงราย เชียงใหม่ ตรัง ตราด ตาก นครนายก นครปฐม นครพนม นครราชสีมา นครศรีธรรมราช นครสวรรค์ นนทบุรี นราธิวาส น่าน บึงกาฬ บุรีรัมย์ ปทุมธานี ประจวบคีรีขันธ์ ปราจีนบุรี ปัตตานี พระนครศรีอยุธยา พะเยา พังงา พัทลุง พิจิตร พิษณุโลก เพชรบุรี เพชรบูรณ์ แพร่ ภูเก็ต มหาสารคาม มุกดาหาร แม่ฮ่องสอน ยโสธร ยะลา ร้อยเอ็ด ระนอง ระยอง ราชบุรี ลพบุรี ลำปาง ลำพูน เลย ศรีสะเกษ สกลนคร สงขลา สตูล สมุทรปราการ สมุทรสงคราม สมุทรสาคร สระแก้ว สระบุรี สิงห์บุรี สุโขทัย สุพรรณบุรี สุราษฎร์ธานี สุรินทร์ หนองคาย หนองบัวลำภู อ่างทอง อำนาจเจริญ อุดรธานี อุตรดิตถ์ อุทัยธานี อุบลราชธานี'.split(' ');
const BKK='พระนคร ดุสิต หนองจอก บางรัก บางเขน บางกะปิ ปทุมวัน ป้อมปราบศัตรูพ่าย พระโขนง มีนบุรี ลาดกระบัง ยานนาวา สัมพันธวงศ์ พญาไท ธนบุรี บางกอกใหญ่ ห้วยขวาง คลองสาน ตลิ่งชัน บางกอกน้อย บางขุนเทียน ภาษีเจริญ หนองแขม ราษฎร์บูรณะ บางพลัด ดินแดง บึงกุ่ม สาทร บางซื่อ จตุจักร บางคอแหลม ประเวศ คลองเตย สวนหลวง จอมทอง ดอนเมือง ราชเทวี ลาดพร้าว วัฒนา บางแค หลักสี่ สายไหม คันนายาว สะพานสูง วังทองหลาง คลองสามวา บางนา ทวีวัฒนา ทุ่งครุ บางบอน'.split(' ');
// จังหวัดของเคส: จากระบบ (Help Me) หรือเดาจากที่อยู่/เขต
const provOf=c=>{if(c.province)return c.province;const a=String(c.address||''),m=a.match(/(?:จ\.|จังหวัด)\s*([ก-๙]{3,})/);
  if(m){const n=m[1];return /^(กรุงเทพ|กทม)/.test(n)?'กรุงเทพมหานคร':(PROVINCES.find(p=>n.startsWith(p))||n)}
  if(/กรุงเทพ|กทม/.test(a)||BKK.includes(normD(c.district)))return 'กรุงเทพมหานคร';
  const am=String(c.district||'').match(/^อำเภอเมือง\s*([ก-๙]+)/);return am?(PROVINCES.find(p=>am[1].startsWith(p))||''):''};
const isProv=r=>r&&r.kind==='province';
const zonesOf=prov=>W.rooms.filter(r=>r.kind!=='province'&&r.province===prov);
document.addEventListener('error',e=>{const i=e.target;if(i.tagName==='IMG'&&i.dataset.alt&&i.src!==i.dataset.alt){i.src=i.dataset.alt;delete i.dataset.alt}},true);

/* ---------- ขอบเขตของ War Room ---------- */
const allCases=r=>r&&r.districts.includes('*');   // War Room ที่ดูแลทุกเคสในระบบ (ไม่จำกัดพื้นที่)
function inRoom(c,r){if(!r||allCases(r))return true;
  const pv=provOf(c);
  if(isProv(r))return pv===r.province;
  if(r.province&&pv&&pv!==r.province)return false;
  if(r.districts.length&&c.district&&r.districts.some(d=>normD(d).replace(/^อำเภอ/,'')===normD(c.district).replace(/^อำเภอ/,'')))return true;
  if(r.radius&&r.lat!=null&&hasPin(c))return km(r.lat,r.lng,+c.lat,+c.lng)*1000<=r.radius;
  return false}
function view(){const r=room();
  const cases=W.cases.filter(c=>inRoom(c,r));
  const zids=isProv(r)?new Set(zonesOf(r.province).map(z=>z.id)):null;
  const roster=!r?W.roster:isProv(r)?W.roster.filter(t=>zids.has(t.warroom)):W.roster.filter(t=>t.warroom===r.id),names=new Set(roster.map(t=>t.name));
  const live=W.live.filter(l=>names.has(l.team));
  const alerts={sos:(W.alerts.sos||[]).filter(s=>names.has(s.name)),calls:(W.alerts.calls||[]).filter(c=>names.has(c.team))};
  const threads=W.threads.filter(t=>names.has(t.team));
  return {r,cases,roster,names,live,alerts,threads}}

/* ---------- ข้อมูล ---------- */
async function loadCases(){
  const [h,o]=await Promise.all([apiGet({action:'helpme_cases'}).catch(()=>null),apiGet({action:'list'}).catch(()=>null)]);
  const hm=h&&h.ok?h.cases:[],own=o&&o.cases?o.cases:[],ids=new Set(hm.map(c=>String(c.id)));
  // เคสในระบบที่ไม่ใช่สำเนาของเคส Help Me (สำเนามีรหัสเดียวกัน)
  W.cases=hm.map(c=>({...c,needs:c.needs||[],src:'hm'})).concat(own.filter(c=>!ids.has(String(c.id))).map(c=>({...c,needs:c.needs||[],src:'own'})));
  W.at=Date.now();
}
async function loadTeams(){
  const [r,t]=await Promise.all([apiGet({action:'roster'}).catch(()=>null),apiGet({action:'chat_threads'}).catch(()=>null)]);
  if(r&&r.ok){W.roster=r.roster||[];W.live=r.live||[]}
  if(t&&t.ok){W.threads=t.threads||[];W.alerts=t.alerts||{sos:[],calls:[]}}
}
async function loadRooms(){const r=await apiGet({action:'warrooms'}).catch(()=>null);if(r&&r.ok){W.rooms=r.warrooms||[];W.staff=r.staff||[]}
  if(W.room&&!room())W.room=''}
async function loadStock(){const r=await apiGet({action:'stock'}).catch(()=>null);if(r&&r.ok){W.items=r.items||[];W.log=r.log||[]}}
async function loadWarn(){try{const n=await apiGet({action:'news'});if(n&&n.ok)W.warn=n.warnings||[]}catch(e){}}

/* ---------- เลือกห้อง / แท็บ ---------- */
function roomsBar(){const all=W.cases.filter(c=>c.status!=='done');
  const chip=(r,label)=>{const act=r?all.filter(c=>inRoom(c,r)):all,crit=act.filter(c=>sev(c)===3&&c.status!=='going').length,id=r?r.id:'';
    return `<button type="button" role="tab" data-room="${esc(id)}" aria-selected="${id===W.room}" class="${!r?'central':isProv(r)?'prov':'zone'}">${r?`<i class="rdot" style="background:${esc(r.color)}"></i>`:'<i data-ic="board"></i><span class="lbl-long">HELP ME CENTRAL · </span>'}${esc(label||(isProv(r)&&/^ศูนย์ประสานงานจังหวัด/.test(r.name)?'ศูนย์ประสานงาน':r.name)||'(ไม่มีชื่อ)')} <small>${act.length}${crit?` · <b class="cr">${crit} วิกฤต</b>`:''}</small></button>`};
  // จัดกลุ่มตามจังหวัด: ศูนย์ประสานงานจังหวัด แล้วตามด้วย War Room โซนในจังหวัดนั้น
  const provs=[...new Set(W.rooms.map(r=>r.province||''))].sort((a,b)=>!a-!b||(a==='กรุงเทพมหานคร'?-1:b==='กรุงเทพมหานคร'?1:a.localeCompare(b,'th')));
  $('#rooms').innerHTML=chip(null,'ทั้งหมด')+provs.map(pv=>{const pr=W.rooms.find(r=>isProv(r)&&r.province===pv),zs=W.rooms.filter(r=>!isProv(r)&&(r.province||'')===pv);
    return `<span class="wr-grp"><span class="gl">${pv?'จ.'+esc(pv.replace('กรุงเทพมหานคร','กรุงเทพฯ')):'ไม่ระบุจังหวัด'}</span>${pr?chip(pr):''}${zs.map(z=>chip(z)).join('')}</span>`}).join('');
  const r=room();$('#subtabs').hidden=false;
  const tabs=!r?['over','struct']:['over','cases','teams','stock','prof'];if(!tabs.includes(W.tab))W.tab='over';
  $$('#subtabs [data-tab]').forEach(b=>{b.hidden=!tabs.includes(b.dataset.tab);b.setAttribute('aria-selected',String(b.dataset.tab===W.tab))});
  ['over','struct','cases','teams','stock','prof'].forEach(k=>$('#p-'+k).hidden=k!==W.tab);
  document.body.classList.toggle('wr-overview',W.tab==='over')}
$('#rooms').addEventListener('click',e=>{const b=e.target.closest('[data-room]');if(!b)return;W.room=b.dataset.room;W.fitted='';
  try{history.replaceState(null,'',W.room?'?wr='+encodeURIComponent(W.room):location.pathname)}catch(err){}render()});
$('#subtabs').addEventListener('click',async e=>{const b=e.target.closest('[data-tab]');if(!b)return;W.tab=b.dataset.tab;if(W.tab==='stock'||W.tab==='struct')await loadStock();render()});

/* ---------- ภาพรวม ---------- */
function kpis(V){
  const act=V.cases.filter(c=>c.status!=='done'),open=act.filter(c=>c.status!=='going'),crit=open.filter(c=>sev(c)===3),going=act.filter(c=>c.status==='going');
  const t0=today0(),doneToday=V.cases.filter(c=>c.status==='done'&&(c.doneAt||c.updatedAt)>=t0);
  const fresh=new Set(V.live.filter(l=>Date.now()-l.updatedAt<10*60e3).map(l=>l.team));
  const ppl=crit.reduce((a,c)=>a+Math.max(1,Number(c.people)||1),0);
  const oldest=open.reduce((m,c)=>Math.min(m,c.createdAt||Infinity),Infinity);
  const k=[[crit.length,'วิกฤต รอช่วย',crit.length?'crit':''],[open.length,'รอช่วยทั้งหมด',open.length>20?'warn':''],[going.length,'กำลังไป / หน้างาน',''],
    [`${fresh.size}<small>/${V.roster.length}</small>`,'ทีมออนไลน์',''],[doneToday.length,'ช่วยแล้ววันนี้','ok'],[ppl,'คนในเคสวิกฤต',ppl?'crit':''],
    [isFinite(oldest)?waitTxt(oldest):'–','เคสรอนานสุด','']];
  $('#kpis').innerHTML=k.map(([v,l,c])=>`<div class="wr-kpi ${c}"><b>${v}</b><span>${l}</span></div>`).join('');
}
function alerts(V){
  const sos=V.alerts.sos,calls=V.alerts.calls,live=W.warn.filter(w=>(!w.start||w.start<=Date.now())&&(!w.end||w.end>=Date.now()));
  const rows=[...sos.map(s=>`<div class="wr-al sos"><b><i data-ic="alert"></i> SOS · ${esc(s.name)}</b><small>${esc(ago(s.sosAt))}${s.phone?` · <a href="tel:${esc(telOf(s.phone))}">${esc(s.phone)}</a>`:''}${s.lat!=null?` · <button type="button" class="lnk" data-fly="${+s.lat},${+s.lng}">ดูบนแผนที่</button>`:''}</small></div>`),
    ...calls.map(c=>`<div class="wr-al call"><b><i data-ic="phone"></i> ${esc(c.team)} โทรมา</b><small>${esc(c.text)} · ${esc(ago(c.at))}${c.link?` · <a href="${esc(c.link)}" target="_blank" rel="noopener">รับสาย</a>`:''}</small></div>`),
    ...live.map(w=>`<div class="wr-al warn"><b><i data-ic="rain"></i> ${esc(w.title)}</b><small>กรมอุตุฯ · มีผลถึง ${esc(w.end?new Date(w.end).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'-')} · <a href="../news/">อ่าน</a></small></div>`)];
  $('#alerts').innerHTML=rows.length?rows.join(''):'<p class="muted small">ไม่มี SOS / สายเข้า / ประกาศเตือนภัยที่มีผลตอนนี้</p>';
  $('#alerts-card').classList.toggle('hot',!!(sos.length||calls.length));
}
function queue(V){
  const q=V.cases.filter(c=>c.status==='open'&&!vol(c)).sort((a,b)=>sev(b)-sev(a)||(a.createdAt||0)-(b.createdAt||0)).slice(0,12);
  $('#queue').innerHTML=q.length?q.map(c=>{const ph=photos(c);return `<li class="u${sev(c)}">${ph.length?`<a class="qimg" href="${caseLink(c)}" aria-label="ดูเคส"><img src="${thumb(ph[0],120)}" data-alt="https://drive.google.com/thumbnail?id=${encodeURIComponent(ph[0])}&sz=w120" alt="รูปจากผู้แจ้ง" loading="lazy" referrerpolicy="no-referrer">${ph.length>1?`<b>${ph.length}</b>`:''}</a>`:'<span class="qimg none"><i data-ic="image"></i></span>'}
    <a class="qtx" href="${caseLink(c)}"><span class="tag">${URG[sev(c)]}</span><b>${esc((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')}</b>
      <small>${esc([c.district?'เขต'+c.district:'',(c.people||1)+' คน'].filter(Boolean).join(' · '))} · รอ ${esc(waitTxt(c.createdAt))}${hasPin(c)?'':' · ไม่มีหมุด'}</small></a>
    ${hasPin(c)?`<span class="qact"><button type="button" class="lnk" data-fly="${+c.lat},${+c.lng}" aria-label="ดูบนแผนที่" title="ดูบนแผนที่"><i data-ic="pin"></i></button><a class="lnk" href="${navLink(c.lat,c.lng)}" target="_blank" rel="noopener" aria-label="นำทางด้วย Google Maps" title="นำทาง (Google Maps)"><i data-ic="nav"></i></a></span>`:''}</li>`}).join(''):'<li class="muted">ไม่มีเคสค้างที่ยังไม่มีทีมรับ</li>';
}
function teamRows(V){const live=new Map(W.live.map(l=>[l.team,l])),sos=new Set((W.alerts.sos||[]).map(s=>s.name));
  const load=new Map();W.cases.filter(c=>c.status==='going').forEach(c=>{const v=vol(c);if(v)load.set(v,(load.get(v)||0)+1)});
  return V.roster.map(t=>{const l=live.get(t.name),m=l?mins(l.updatedAt):null,on=m!=null&&m<10;return {t,l,m,on,n:load.get(t.name)||0,sos:sos.has(t.name)}})
    .sort((a,b)=>b.sos-a.sos||b.on-a.on||b.n-a.n||a.t.name.localeCompare(b.t.name,'th'))}
function teams(V){const rows=teamRows(V);
  $('#teams').innerHTML=rows.length?rows.map(({t,l,on,n,sos})=>`<li class="${sos?'sos':on?'on':'off'}"><i class="dot"></i><b>${esc(t.name)}</b>
      <span class="st">${esc(ST[t.status]||t.status||'')}</span>${n?`<span class="busy">${n} เคส</span>`:''}
      <small>${l?(on?'ออนไลน์':'ตำแหน่งเมื่อ '+esc(ago(l.updatedAt))):'ไม่แชร์ตำแหน่ง'}${l&&l.battery!=null?' · แบต '+l.battery+'%':''}</small>
      <span class="qact">${l?`<button type="button" class="lnk" data-fly="${+l.lat},${+l.lng}" aria-label="ดูทีมบนแผนที่"><i data-ic="pin"></i></button>`:''}${/^https:\/\//.test(t.gmaps||'')?`<a class="lnk" href="${esc(t.gmaps)}" target="_blank" rel="noopener" title="ตำแหน่งสด Google Maps" aria-label="ตำแหน่งสด Google Maps ของ ${esc(t.name)}"><i data-ic="live"></i></a>`:''}</span></li>`).join('')
    :`<li class="muted">${V.r?'ยังไม่มีทีมใน War Room นี้ · เพิ่มได้ที่แท็บ "ทีม"':'ยังไม่มีทีมในระบบ'}</li>`;
}
function feed(V){
  const it=[];
  V.threads.slice(0,12).forEach(t=>{const m=t.last;if(!m)return;it.push({at:m.at,cls:m.kind==='sos'?'sos':m.sender==='team'?'team':'hq',
    html:`<b>${m.sender==='team'?esc(t.team):'ศูนย์ → '+esc(t.team)}</b> ${esc(m.text||(m.lat!=null?'ส่งตำแหน่ง':''))}`})});
  V.cases.filter(c=>Date.now()-(c.createdAt||0)<6*3600e3).forEach(c=>it.push({at:c.createdAt,cls:'new u'+sev(c),html:`<b>เคสใหม่</b> ${esc(URG[sev(c)])} · ${esc((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')}${c.district?' · เขต'+esc(c.district):''}`}));
  V.cases.filter(c=>c.status==='done'&&Date.now()-(c.doneAt||c.updatedAt||0)<6*3600e3).forEach(c=>it.push({at:c.doneAt||c.updatedAt,cls:'done',html:`<b>ช่วยแล้ว</b> ${esc((c.needs||[]).join(', ')||'เคส')}${vol(c)?' · '+esc(vol(c)):''}`}));
  it.sort((a,b)=>(b.at||0)-(a.at||0));
  $('#feed').innerHTML=it.length?it.slice(0,25).map(x=>`<li class="${x.cls}"><time>${esc(new Date(x.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}))}</time><span>${x.html}</span></li>`).join(''):'<li class="muted">ยังไม่มีความเคลื่อนไหวใน 6 ชม.</li>';
}

/* ---------- แผนที่ ---------- */
let leafP=null;
function loadLeaflet(){if(window.L)return Promise.resolve();return leafP||(leafP=new Promise((res,rej)=>{
  const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';css.crossOrigin='';document.head.append(css);
  const s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';s.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';s.crossOrigin='';s.onload=res;s.onerror=()=>{leafP=null;rej()};document.head.append(s)}))}
async function drawMap(V){
  try{await loadLeaflet()}catch(e){$('#map-note').textContent='โหลดแผนที่ไม่ได้';return}
  if(!W.map){W.map=L.map('wmap',{zoomControl:true}).setView([13.75,100.6],11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(W.map);
    W.map.attributionControl.setPrefix(false);W.lr=L.layerGroup().addTo(W.map);W.lc=L.layerGroup().addTo(W.map);W.lt=L.layerGroup().addTo(W.map)}
  W.lc.clearLayers();W.lr.clearLayers();const pts=[],t0=today0(),showDone=$('#mt-done').checked;let nopin=0;
  // ขอบเขต War Room: ห้องที่เลือก หรือทุกห้อง (ภาพรวม)
  (V.r?[V.r]:W.rooms).forEach(r=>{if(r.lat==null||!r.radius)return;
    L.circle([r.lat,r.lng],{radius:r.radius,color:r.color,weight:2,fillColor:r.color,fillOpacity:V.r?.04:.07,dashArray:'6 6',interactive:!V.r}).bindTooltip(esc(r.name),{sticky:true}).on('click',()=>{if(!V.r){W.room=r.id;W.fitted='';render()}}).addTo(W.lr);
    if(V.r)pts.push([r.lat,r.lng])});
  V.cases.filter(c=>c.status!=='done'||(showDone&&(c.doneAt||c.updatedAt)>=t0)).sort((a,b)=>sev(a)-sev(b)).forEach(c=>{if(!hasPin(c)){if(c.status!=='done')nopin++;return}
    const k=c.status==='done'?'done':c.status==='going'?'going':sev(c)===3?'danger':sev(c)===2?'urgent':'open',ph=photos(c);pts.push([+c.lat,+c.lng]);
    L.marker([+c.lat,+c.lng],{icon:umPin(k,{extra:ph.length?`<span class="pin-thumb"><img src="${thumb(ph[0],200)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`:''}),zIndexOffset:{danger:1000,urgent:700,open:400,going:200,done:0}[k],keyboard:false})
      .bindTooltip(esc(`${URG[sev(c)]} · ${(c.needs||[]).join(', ')||'ขอความช่วยเหลือ'} · ${c.people||1} คน${vol(c)?' · ทีม '+vol(c):''} · รอ ${waitTxt(c.createdAt)}`),{direction:'top',offset:[0,-4]})
      .on('click',()=>{location.href=caseLink(c)}).addTo(W.lc)});
  moveTeams(V).forEach(p=>pts.push(p));
  let note=nopin?`ไม่มีหมุด ${nopin} เคส`:'';
  // ซูมไปพื้นที่ที่มีเคสหนาแน่น (ไม่ให้หมุดไกล ๆ ไม่กี่จุดทำให้แผนที่ซูมออกทั้งประเทศ)
  if(W.fitted!==(W.room||'*')&&pts.length){const med=a=>a.slice().sort((x,y)=>x-y)[a.length>>1],mla=med(pts.map(p=>p[0])),mlo=med(pts.map(p=>p[1]));
    const near=V.r?pts:pts.filter(p=>Math.abs(p[0]-mla)<0.7&&Math.abs(p[1]-mlo)<0.7),far=pts.length-near.length;
    W.map.fitBounds(near.length?near:pts,{padding:[30,30],maxZoom:14});W.fitted=W.room||'*';if(far)note+=(note?' · ':'')+`นอกพื้นที่หลัก ${far} จุด (ซูมออกเพื่อดู)`}
  $('#map-note').textContent=note;
  setTimeout(()=>W.map.invalidateSize(),60);
}

/* ---------- CENTRAL: โครงสร้างการสั่งการ ---------- */
function stats(cs,names){const act=cs.filter(c=>c.status!=='done');const live=new Set(W.live.filter(l=>Date.now()-l.updatedAt<10*60e3).map(l=>l.team));
  return {act:act.length,crit:act.filter(c=>sev(c)===3&&c.status!=='going').length,going:act.filter(c=>c.status==='going').length,teams:names.length,on:names.filter(n=>live.has(n)).length,
    low:W.items.filter(i=>i.warroom&&i.min!==''&&Number(i.qty)<=Number(i.min)).length}}
function chipsOf(st){return `<span class="k">${st.act} เคสค้าง</span>${st.crit?`<span class="k cr">${st.crit} วิกฤต</span>`:''}<span class="k">${st.going} กำลังไป</span><span class="k">ทีม ${st.on}/${st.teams} ออนไลน์</span>`}
function structTab(){const open=W.cases.filter(c=>c.status!=='done'),zones=W.rooms.filter(r=>!isProv(r));
  const covered=c=>W.rooms.some(r=>inRoom(c,r)),orphan=open.filter(c=>!covered(c)),freeTeams=W.roster.filter(t=>!t.warroom||!zones.some(z=>z.id===t.warroom));
  const provs=[...new Set(W.rooms.map(r=>r.province||'').concat(open.map(provOf).filter(Boolean)))].sort((a,b)=>(a==='กรุงเทพมหานคร'?-1:b==='กรุงเทพมหานคร'?1:0)||a.localeCompare(b,'th'));
  $('#st-sum').innerHTML=[[W.rooms.filter(isProv).length,'ศูนย์ประสานงานจังหวัด'],[zones.length,'War Room โซน'],[W.roster.length,'ทีมทั้งหมด'],[orphan.length,'เคสค้างที่ยังไม่มี War Room ดูแล',orphan.length?'crit':''],[freeTeams.length,'ทีมยังไม่สังกัดโซน',freeTeams.length?'warn':'']]
    .map(([v,l,c])=>`<div class="wr-kpi ${c||''}"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#st-tree').innerHTML=`<div class="node central"><b>HELP ME CENTRAL</b><span class="muted small">Common Operating Picture · ข้อมูล / มาตรฐาน / สนับสนุน</span><div class="kk">${chipsOf(stats(W.cases,W.roster.map(t=>t.name)))}</div></div>
    <div class="lvl">${provs.map(pv=>{const pr=W.rooms.find(r=>isProv(r)&&r.province===pv),zs=W.rooms.filter(r=>!isProv(r)&&(r.province||'')===pv),pc=W.cases.filter(c=>pv?provOf(c)===pv:!provOf(c));
      const pnames=W.roster.filter(t=>zs.some(z=>z.id===t.warroom)).map(t=>t.name),po=pc.filter(c=>c.status!=='done'&&!zs.some(z=>inRoom(c,z))).length;
      return `<div class="branch"><div class="node prov${pr?'':' missing'}">${pr?`<button type="button" class="lnk ttl" data-go="${esc(pr.id)}"><i class="rdot" style="background:${esc(pr.color)}"></i> ${esc(pr.name)}</button>`:`<b>${pv?'จังหวัด'+esc(pv):'ไม่ระบุจังหวัด'}</b>`}
          <span class="muted small">${pv?'Provincial Coordination':'เคส/โซนที่ยังไม่ระบุจังหวัด'}${pr&&pr.lead?' · '+esc(pr.lead):''}${pr&&pr.phone?` · <a href="tel:${esc(telOf(pr.phone))}">${esc(pr.phone)}</a>`:''}</span>
          <div class="kk">${chipsOf(stats(pc,pnames))}${po?`<span class="k warn">${po} เคสนอกโซน</span>`:''}</div>
          ${!pr&&pv?`<button type="button" class="btn ghost sm" data-newprov="${esc(pv)}">+ ตั้งศูนย์ประสานงานจังหวัด</button>`:''}</div>
        <div class="lvl">${zs.map(z=>{const tn=W.roster.filter(t=>t.warroom===z.id);return `<div class="branch"><div class="node zone"><button type="button" class="lnk ttl" data-go="${esc(z.id)}"><i class="rdot" style="background:${esc(z.color)}"></i> ${esc(z.name)}</button>
            <span class="muted small">War Room โซน${z.lead?' · '+esc(z.lead):''}${z.districts.length?' · '+esc(z.districts.slice(0,4).join(', '))+(z.districts.length>4?'…':''):''}</span>
            <div class="kk">${chipsOf(stats(W.cases.filter(c=>inRoom(c,z)),tn.map(t=>t.name)))}</div>
            <div class="tms">${tn.map(t=>`<span class="tm">${esc(t.name)}</span>`).join('')||'<span class="muted small">ยังไม่มีทีม</span>'}</div></div></div>`}).join('')}
          ${pv?`<button type="button" class="btn ghost sm addz" data-newzone="${esc(pv)}">+ เพิ่ม War Room โซนใน${esc(pv==='กรุงเทพมหานคร'?'กรุงเทพฯ':'จ.'+pv)}</button>`:''}</div></div>`}).join('')}</div>
    ${freeTeams.length?`<div class="node free"><b>ทีมยังไม่สังกัด War Room โซน</b><div class="tms">${freeTeams.map(t=>`<span class="tm">${esc(t.name)}</span>`).join('')}</div><span class="muted small">เลือก War Room โซน → แท็บ "ทีม" เพื่อเพิ่มทีมเข้าโซน</span></div>`:''}`;
}
$('#p-struct').addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g){W.room=g.dataset.go;W.tab='over';W.fitted='';try{history.replaceState(null,'','?wr='+encodeURIComponent(W.room))}catch(err){}render();return}
  const np=e.target.closest('[data-newprov]');if(np){roomForm({kind:'province',province:np.dataset.newprov,districts:[]});return}
  const nz=e.target.closest('[data-newzone]');if(nz)roomForm({kind:'zone',province:nz.dataset.newzone,districts:[]})});

/* หมุดทีมแบบคงอยู่: ตำแหน่งใหม่ทุก 3 วินาที เลื่อนลื่น (glideTo) แทนการลบแล้ววาดใหม่ */
W.tm=new Map();
function moveTeams(V){if(!W.map||!W.lt)return [];const sos=new Set((W.alerts.sos||[]).map(s=>s.name)),seen=new Set(),pts=[];
  V.live.forEach(l=>{const m=mins(l.updatedAt),stale=m>10,s=sos.has(l.team),mv=l.speed!=null&&l.speed>=3;seen.add(l.team);pts.push([l.lat,l.lng]);
    const html=`<i>${headArrow(l)}</i><span>${esc(l.team)}${mv?` · ${Math.round(l.speed)} กม./ชม.`:''}</span>`,cls='wr-team'+(s?' sos':stale?' stale':'')+(mv?' mv':'');
    const tip=esc(`${l.team} · ${stale?'ตำแหน่งเมื่อ '+ago(l.updatedAt):'ออนไลน์'}${l.battery!=null?' · แบต '+l.battery+'%':''}${l.speed?' · '+Math.round(l.speed)+' กม./ชม.':''}`);
    let mk=W.tm.get(l.team);
    if(!mk){mk=L.marker([l.lat,l.lng],{icon:L.divIcon({className:cls,html,iconSize:[16,16],iconAnchor:[8,8]}),keyboard:false}).bindTooltip(tip,{direction:'top',offset:[0,-8]}).addTo(W.lt);mk._k=cls+html;W.tm.set(l.team,mk)}
    else{glideTo(mk,[l.lat,l.lng]);if(mk._k!==cls+html){mk._k=cls+html;mk.setIcon(L.divIcon({className:cls,html,iconSize:[16,16],iconAnchor:[8,8]}))}mk.setTooltipContent(tip)}
    mk.setZIndexOffset(s?3000:2000)});
  for(const [k,mk] of W.tm)if(!seen.has(k)){mk.remove();W.tm.delete(k)}
  return pts}
async function pollLive(){if(document.hidden||W.tab!=='over'||W.liveBusy)return;W.liveBusy=true;
  try{const r=await apiGet({action:'teams'});if(r&&r.ok){W.live=r.teams||[];moveTeams(view())}}catch(e){}finally{W.liveBusy=false}}

/* ---------- แท็บ เคส ---------- */
function casesTab(V){
  const cnt=k=>V.cases.filter(c=>k==='all'||c.status===k).length;
  $('#c-st').innerHTML=[['open','รอช่วย'],['going','กำลังไป'],['done','ช่วยแล้ว'],['all','ทั้งหมด']].map(([k,l])=>`<button type="button" data-st="${k}" aria-selected="${k===W.cst}">${l} <small>${cnt(k)}</small></button>`).join('');
  const q=W.cq.trim().toLowerCase();
  const list=V.cases.filter(c=>(W.cst==='all'||c.status===W.cst)&&(!q||[(c.needs||[]).join(' '),c.district,c.address,vol(c)].join(' ').toLowerCase().includes(q)))
    .sort((a,b)=>(a.status==='done')-(b.status==='done')||sev(b)-sev(a)||(a.createdAt||0)-(b.createdAt||0)).slice(0,300);
  const teamOpts=sel=>`<option value="">— เลือกทีม —</option>`+V.roster.map(t=>`<option${t.name===sel?' selected':''}>${esc(t.name)}</option>`).join('');
  $('#c-body').innerHTML=list.length?list.map(c=>{const ph=photos(c),v=vol(c);
    return `<tr class="u${sev(c)}"><td class="ph">${ph.length?`<a href="${caseLink(c)}"><img src="${thumb(ph[0],120)}" data-alt="https://drive.google.com/thumbnail?id=${encodeURIComponent(ph[0])}&sz=w120" alt="รูปจากผู้แจ้ง" loading="lazy" referrerpolicy="no-referrer">${ph.length>1?`<b>${ph.length}</b>`:''}</a>`:'<span class="none">–</span>'}</td>
      <td><span class="tag">${URG[sev(c)]}</span></td>
      <td><b>${esc((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')}</b><small>${esc(c.people||1)} คน${c.src==='hm'?' · Help Me':''}</small></td>
      <td>${esc(c.district?'เขต'+c.district:'')}<small>${esc(String(c.address||'').slice(0,80))}</small></td>
      <td class="nw">${c.status==='done'?'—':esc(waitTxt(c.createdAt))}</td>
      <td>${c.status!=='done'?`<select data-assign="${esc(c.id)}" aria-label="มอบทีม">${teamOpts(v)}</select>`:esc(v||'—')}<small>${esc(CST[c.status]||c.status)}</small></td>
      <td class="act">${c.status!=='done'?`<button type="button" class="btn ghost sm" data-done="${esc(c.id)}">เสร็จ</button>`:''}${hasPin(c)?`<a class="btn ghost sm" href="${navLink(c.lat,c.lng)}" target="_blank" rel="noopener" title="นำทางด้วย Google Maps"><i data-ic="nav"></i> นำทาง</a>`:''}<a class="btn ghost sm" href="${caseLink(c)}">เปิด</a></td></tr>`}).join('')
    :`<tr><td colspan="7" class="muted">ไม่มีเคส${V.r?' ในพื้นที่ของ War Room นี้ (ตั้งเขต/รัศมีได้ที่แท็บโปรไฟล์)':''}</td></tr>`;
}
$('#c-st').addEventListener('click',e=>{const b=e.target.closest('[data-st]');if(!b)return;W.cst=b.dataset.st;casesTab(view())});
$('#c-q').addEventListener('input',e=>{W.cq=e.target.value;casesTab(view())});
$('#c-body').addEventListener('change',async e=>{const s=e.target.closest('[data-assign]');if(!s)return;const c=W.cases.find(x=>String(x.id)===s.dataset.assign);if(!c)return;
  const team=s.value;s.disabled=true;
  try{const r=await apiPost({action:'update',id:c.id,status:team?'going':'open',volunteer:team});if(r.ok){c.volunteer=team;c.status=team?'going':'open';toast(team?`มอบเคสให้ ${team} แล้ว`:'ยกเลิกการมอบทีมแล้ว',true)}else toast('บันทึกไม่สำเร็จ: '+(r.error||''))}
  catch(err){toast('บันทึกไม่สำเร็จ')}finally{s.disabled=false;render()}});
$('#c-body').addEventListener('click',async e=>{const b=e.target.closest('[data-done]');if(!b)return;const c=W.cases.find(x=>String(x.id)===b.dataset.done);if(!c||!confirm('ปิดเคสนี้ว่าช่วยเสร็จแล้ว?'))return;
  b.disabled=true;try{const r=await apiPost({action:'update',id:c.id,status:'done',volunteer:vol(c)});if(r.ok){c.status='done';toast('ปิดเคสแล้ว',true)}else toast('บันทึกไม่สำเร็จ: '+(r.error||''))}catch(err){toast('บันทึกไม่สำเร็จ')}render()});

/* ---------- แท็บ ทีม ---------- */
function teamsTab(V){const r=V.r,live=new Map(W.live.map(l=>[l.team,l])),rn=new Map(W.rooms.map(x=>[x.id,x]));
  if(isProv(r)){const zs=zonesOf(r.province);
    $('#t-hint').textContent=`ทีมในจังหวัด${r.province}: ${V.roster.length} ทีม ใน ${zs.length} War Room โซน · จัดทีมเข้าโซนได้ที่ War Room โซนนั้น`;
    $('#t-list').innerHTML=zs.length?zs.map(z=>{const tn=W.roster.filter(t=>t.warroom===z.id);return `<div class="wr-tcard"><div class="h"><i class="rdot" style="background:${esc(z.color)}"></i><b>${esc(z.name)}</b><span class="st">${tn.length} ทีม</span></div>
      ${tn.map(t=>{const l=live.get(t.name),on=l&&mins(l.updatedAt)<10;return `<small><i class="dot ${on?'on':''}" style="display:inline-block;margin-right:6px"></i>${esc(t.name)} · ${esc(ST[t.status]||'')}${l?'':' · ไม่แชร์ตำแหน่ง'}</small>`}).join('')||'<small>ยังไม่มีทีม</small>'}
      <div class="a"><button type="button" class="btn ghost sm" data-gozone="${esc(z.id)}">ไปที่ War Room โซน</button></div></div>`}).join(''):'<p class="muted">ยังไม่มี War Room โซนในจังหวัดนี้ · สร้างได้ที่ปุ่ม "+ สร้างศูนย์จังหวัด / War Room"</p>';
    return}
  $('#t-hint').textContent=`ทีมใน ${r.name}: ${V.roster.length} ทีม · กด "เพิ่มเข้า War Room นี้" เพื่อย้ายทีมมาประจำห้องนี้ (ทีมอยู่ได้ทีละ 1 ห้อง) · แก้รายละเอียดทีมที่หน้า "จัดทีม"`;
  const all=W.roster.slice().sort((a,b)=>(b.warroom===r.id)-(a.warroom===r.id)||a.name.localeCompare(b.name,'th'));
  $('#t-list').innerHTML=all.map(t=>{const mine=t.warroom===r.id,other=!mine&&t.warroom&&rn.get(t.warroom),l=live.get(t.name),on=l&&mins(l.updatedAt)<10;
    return `<div class="wr-tcard${mine?' mine':''}"><div class="h"><i class="dot ${on?'on':''}"></i><b>${esc(t.name)}</b><span class="st">${esc(ST[t.status]||'')}</span></div>
      <small>${esc([t.leader?'หัวหน้า '+t.leader:'',t.members?t.members+' คน':'',t.vehicle||''].filter(Boolean).join(' · ')||'—')}</small>
      <small>${l?(on?'ออนไลน์':'ตำแหน่งเมื่อ '+esc(ago(l.updatedAt))):'ไม่แชร์ตำแหน่ง'}${other?` · อยู่ใน <b>${esc(other.name)}</b>`:''}</small>
      <div class="a">${/^https:\/\//.test(t.gmaps||'')?`<a class="btn ghost sm" href="${esc(t.gmaps)}" target="_blank" rel="noopener"><i data-ic="live"></i> ตำแหน่งสด</a>`:''}${t.phone?`<a class="btn ghost sm" href="tel:${esc(telOf(t.phone))}"><i data-ic="phone"></i> โทร</a>`:''}${mine?`<button type="button" class="btn ghost sm" data-tw="${esc(t.name)}" data-to="">นำออก</button>`:`<button type="button" class="btn primary sm" data-tw="${esc(t.name)}" data-to="${esc(r.id)}">เพิ่มเข้า War Room นี้</button>`}</div></div>`}).join('')||'<p class="muted">ยังไม่มีทีมในระบบ · เพิ่มทีมที่หน้า "จัดทีม"</p>';
}
$('#t-list').addEventListener('click',async e=>{const gz=e.target.closest('[data-gozone]');if(gz){W.room=gz.dataset.gozone;W.tab='teams';try{history.replaceState(null,'','?wr='+encodeURIComponent(W.room))}catch(err){}render();return}
  const b=e.target.closest('[data-tw]');if(!b)return;b.disabled=true;
  try{const r=await apiPost({action:'team_warroom',team:b.dataset.tw,warroom:b.dataset.to});if(r.ok){const t=W.roster.find(x=>x.name===b.dataset.tw);if(t)t.warroom=b.dataset.to;toast(b.dataset.to?'เพิ่มทีมเข้า War Room แล้ว':'นำทีมออกแล้ว',true)}else toast('บันทึกไม่สำเร็จ: '+(r.error||''))}
  catch(err){toast('บันทึกไม่สำเร็จ')}render()});

/* ---------- แท็บ สต็อก ---------- */
function stockTab(V){const r=V.r,items=W.items.filter(i=>i.warroom===r.id),ids=new Set(items.map(i=>i.id));
  $('#s-title').textContent=`คลังของ ${r.name} · ${items.length} รายการ`;
  $('#s-body').innerHTML=items.length?items.map(i=>{const low=i.min!==''&&Number(i.qty)<=Number(i.min);
    return `<tr${low?' class="low"':''}><td><b>${esc(i.name)}</b>${i.note?`<small>${esc(i.note)}</small>`:''}</td><td>${esc(i.category||'')}</td>
      <td class="n"><b>${esc(Number(i.qty||0).toLocaleString('th-TH'))}</b> ${esc(i.unit||'')}${low?'<small class="lowt">ใกล้หมด</small>':''}</td><td>${esc(i.min===''?'–':i.min)}</td>
      <td><span class="mv"><input type="number" min="1" inputmode="numeric" placeholder="จำนวน" aria-label="จำนวน ${esc(i.name)}" data-amt="${esc(i.id)}"><button type="button" class="btn ghost sm" data-mv="in" data-id="${esc(i.id)}">+ รับเข้า</button><button type="button" class="btn ghost sm" data-mv="out" data-id="${esc(i.id)}">− จ่ายออก</button></span></td>
      <td><button type="button" class="btn ghost sm" data-sedit="${esc(i.id)}">แก้ไข</button></td></tr>`}).join('')
    :'<tr><td colspan="6" class="muted">ยังไม่มีของในคลังนี้ · กด "+ เพิ่มของในคลังนี้"</td></tr>';
  const log=W.log.filter(l=>ids.has(l.itemId)).slice(0,30);
  $('#s-log').innerHTML=log.length?log.map(l=>`<li class="${l.delta<0?'':'done'}"><time>${esc(new Date(l.time).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}</time><span><b>${esc(l.item)}</b> ${l.delta>0?'+':''}${esc(l.delta)} → ${esc(l.after)}${l.team?' · '+esc(l.team):''}${l.by?' · '+esc(l.by):''}${l.note?' · '+esc(l.note):''}</span></li>`).join(''):'<li class="muted">ยังไม่มีความเคลื่อนไหว</li>';
}
$('#s-body').addEventListener('click',async e=>{const b=e.target.closest('[data-mv]');if(b){const id=b.dataset.id,inp=$(`[data-amt="${CSS.escape(id)}"]`),n=Math.round(Number(inp.value));
    if(!(n>0)){inp.focus();toast('ใส่จำนวนก่อน');return}const by=staffName();if(!by)return;b.disabled=true;
    try{const r=await apiPost({action:'stock_move',itemId:id,type:b.dataset.mv,amount:n,by,note:'War Room: '+(room()||{}).name});
      if(r.ok){toast(b.dataset.mv==='in'?`รับเข้า ${n}`:`จ่ายออก ${n}`,true);await loadStock()}else toast(r.error==='not_enough'?`ของไม่พอ (เหลือ ${r.qty})`:'บันทึกไม่สำเร็จ: '+(r.error||''))}
    catch(err){toast('บันทึกไม่สำเร็จ')}render();return}
  const ed=e.target.closest('[data-sedit]');if(ed)itemForm(W.items.find(i=>i.id===ed.dataset.sedit))});
$('#s-add').onclick=()=>itemForm(null);
function itemForm(it){const r=room();if(!r)return;it=it||{};
  dlg(`<h2>${it.id?'แก้ไขของในคลัง':'เพิ่มของในคลัง '+esc(r.name)}</h2>
    <label>ชื่อของ<input name="name" required maxlength="80" value="${esc(it.name||'')}" placeholder="เช่น ถุงยังชีพ น้ำดื่ม"></label>
    <div class="row"><label>หน่วย<input name="unit" maxlength="20" value="${esc(it.unit||'')}" placeholder="ถุง / แพ็ก / ขวด"></label><label>หมวด<input name="category" maxlength="30" value="${esc(it.category||'')}" placeholder="อาหาร / ยา / อุปกรณ์"></label></div>
    <div class="row">${it.id?'':'<label>จำนวนตั้งต้น<input name="qty" type="number" min="0" inputmode="numeric" value="0"></label>'}<label>ขั้นต่ำ (เตือนใกล้หมด)<input name="min" type="number" min="0" inputmode="numeric" value="${esc(it.min??'')}"></label></div>
    <label>หมายเหตุ<input name="note" maxlength="200" value="${esc(it.note||'')}"></label>`,async f=>{
    const body={action:'stock_item',item:{id:it.id||'',name:f.name.value,unit:f.unit.value,category:f.category.value,min:f.min.value,note:f.note.value,location:it.location||r.name,warroom:r.id,needed:!!it.needed}};
    const res=await apiPost(body);if(!res.ok){toast('บันทึกไม่สำเร็จ: '+(res.error||''));return false}
    const q=f.qty&&Math.round(Number(f.qty.value));if(!it.id&&q>0)await apiPost({action:'stock_move',itemId:res.id,type:'set',amount:q,by:staffName()||'War Room',note:'ยอดตั้งต้น War Room: '+r.name});
    toast('บันทึกแล้ว',true);await loadStock();render()})}

/* ---------- แท็บ โปรไฟล์ ---------- */
function profTab(V){const r=V.r,staff=W.staff.filter(s=>s.wr===r.id);
  const crit=V.cases.filter(c=>c.status!=='done'&&sev(c)===3).length,act=V.cases.filter(c=>c.status!=='done').length;
  $('#pf-info').innerHTML=`<div class="wr-tools"><h2 style="margin:0"><i class="rdot" style="background:${esc(r.color)}"></i> ${esc(r.name)}</h2><button type="button" class="btn ghost sm" id="pf-edit">แก้ไขข้อมูล War Room</button></div>
    <dl class="wr-dl"><dt>ประเภท</dt><dd>${isProv(r)?'ศูนย์ประสานงานจังหวัด (Provincial Coordination)':'War Room โซน'}${r.province?' · จังหวัด'+esc(r.province):''}</dd>${isProv(r)?`<dt>War Room โซน</dt><dd>${zonesOf(r.province).map(z=>`<button type="button" class="lnk" data-gozone2="${esc(z.id)}">${esc(z.name)}</button>`).join(' · ')||'ยังไม่มี'}</dd>`:''}<dt>หัวหน้า</dt><dd>${esc(r.lead||'—')}</dd><dt>เบอร์ติดต่อ</dt><dd>${r.phone?`<a href="tel:${esc(telOf(r.phone))}">${esc(r.phone)}</a>`:'—'}</dd>
      <dt>ที่ตั้ง</dt><dd>${esc(r.address||'—')}${r.lat!=null?` · <button type="button" class="lnk" data-fly2="${+r.lat},${+r.lng}">ดูบนแผนที่</button>`:''}</dd>
      <dt>พื้นที่รับผิดชอบ</dt><dd>${allCases(r)?'<b>ทุกเคสในระบบ</b> (ไม่จำกัดพื้นที่)':''}${!allCases(r)&&isProv(r)?'ทั้งจังหวัด'+esc(r.province):''}${!isProv(r)&&!allCases(r)&&r.districts.length?'เขต '+esc(r.districts.join(', ')):''}${r.districts.length&&r.radius?' และ ':''}${r.radius?`รัศมี ${esc((r.radius/1000).toLocaleString('th-TH',{maximumFractionDigits:1}))} กม. จากจุดที่ตั้ง`:''}${!isProv(r)&&!allCases(r)&&!r.districts.length&&!r.radius?'<span class="lowt">ยังไม่ได้กำหนด · เคสจะไม่ขึ้นในห้องนี้</span>':''}</dd>
      <dt>สถานการณ์</dt><dd>เคสค้าง ${act} · วิกฤต ${crit} · ทีม ${V.roster.length} · ทีมงานประจำ ${staff.length} คน</dd>${r.note?`<dt>หมายเหตุ</dt><dd>${esc(r.note)}</dd>`:''}</dl>`;
  $('#pf-staff').innerHTML=staff.length?`<table class="wr-tbl"><thead><tr><th>ชื่อ</th><th>หน้าที่</th><th>เบอร์</th><th>เวร / กะ</th><th></th></tr></thead><tbody>${staff.map(s=>`<tr><td><b>${esc(s.name)}</b>${s.note?`<small>${esc(s.note)}</small>`:''}</td><td>${esc(ROLES[s.role]||s.role)}</td><td>${s.phone?`<a href="tel:${esc(telOf(s.phone))}">${esc(s.phone)}</a>`:'—'}</td><td>${esc(s.shift||'—')}</td><td class="act"><button type="button" class="btn ghost sm" data-pedit="${esc(s.id)}">แก้ไข</button><button type="button" class="btn ghost sm" data-pdel="${esc(s.id)}">ลบ</button></td></tr>`).join('')}</tbody></table>`
    :'<p class="muted">ยังไม่มีรายชื่อทีมงาน · กด "+ เพิ่มคน" เพื่อใส่หัวหน้า ผู้สั่งการ ผู้ดูแลคลัง ฯลฯ</p>';
  $('#pf-edit').onclick=()=>roomForm(r);
}
$('#p-prof').addEventListener('click',async e=>{const gz=e.target.closest('[data-gozone2]');if(gz){W.room=gz.dataset.gozone2;W.tab='over';W.fitted='';try{history.replaceState(null,'','?wr='+encodeURIComponent(W.room))}catch(err){}render();return}
  const ed=e.target.closest('[data-pedit]');if(ed){staffForm(W.staff.find(s=>s.id===ed.dataset.pedit));return}
  const del=e.target.closest('[data-pdel]');if(del&&confirm('ลบรายชื่อนี้?')){const r=await apiPost({action:'warroom_staff',staff:{id:del.dataset.pdel,active:false}}).catch(()=>({}));if(r.ok){await loadRooms();render()}else toast('ลบไม่สำเร็จ')}
  const f=e.target.closest('[data-fly2]');if(f){W.tab='over';render();const [a,o]=f.dataset.fly2.split(',').map(Number);setTimeout(()=>W.map&&W.map.flyTo([a,o],14),300)}});
$('#pf-add').onclick=()=>staffForm(null);
function staffForm(s){const r=room();if(!r)return;s=s||{};
  dlg(`<h2>${s.id?'แก้ไขรายชื่อ':'เพิ่มทีมงาน '+esc(r.name)}</h2><label>ชื่อ<input name="name" required maxlength="60" value="${esc(s.name||'')}"></label>
    <div class="row"><label>หน้าที่<select name="role">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}"${k===(s.role||'staff')?' selected':''}>${v}</option>`).join('')}</select></label><label>เบอร์โทร<input name="phone" inputmode="tel" maxlength="20" value="${esc(s.phone||'')}"></label></div>
    <div class="row"><label>เวร / กะ<input name="shift" maxlength="40" value="${esc(s.shift||'')}" placeholder="เช่น 08:00–20:00"></label><label>หมายเหตุ<input name="note" maxlength="200" value="${esc(s.note||'')}"></label></div>`,async f=>{
    const res=await apiPost({action:'warroom_staff',staff:{id:s.id||'',wr:r.id,name:f.name.value,role:f.role.value,phone:f.phone.value,shift:f.shift.value,note:f.note.value}});
    if(!res.ok){toast('บันทึกไม่สำเร็จ: '+(res.error||''));return false}toast('บันทึกแล้ว',true);await loadRooms();render()})}
function roomForm(r){const cur=room();r=r||{kind:'zone',province:cur?cur.province:'',districts:[]};const c=W.map?W.map.getCenter():null;
  dlg(`<h2>${r.id?'แก้ไขข้อมูล':'สร้างศูนย์ประสานงานจังหวัด / War Room โซน'}</h2>
    <div class="row"><label>ประเภท<select name="kind"><option value="zone"${r.kind!=='province'?' selected':''}>War Room โซน</option><option value="province"${r.kind==='province'?' selected':''}>ศูนย์ประสานงานจังหวัด</option></select></label>
      <label>จังหวัด<input name="province" list="provs" maxlength="40" value="${esc(r.province||'')}" placeholder="เช่น กรุงเทพมหานคร"><datalist id="provs">${PROVINCES.map(p=>`<option value="${p}">`).join('')}</datalist></label></div>
    <label>ชื่อ<input name="name" maxlength="60" value="${esc(r.name||'')}" placeholder="เช่น War Room โซนตะวันออก (ศูนย์จังหวัดเว้นว่างได้)"></label>
    <div class="row"><label>หัวหน้า War Room<input name="lead" maxlength="60" value="${esc(r.lead||'')}"></label><label>เบอร์ติดต่อ<input name="phone" inputmode="tel" maxlength="20" value="${esc(r.phone||'')}"></label></div>
    <label class="addr-wrap">ที่ตั้ง (พิมพ์ชื่อสถานที่/ที่อยู่ แล้วเลือกจากรายการ)<input name="address" maxlength="200" value="${esc(r.address||'')}" placeholder="เช่น โรงเรียนรีเจ้นท์ ลาดกระบัง"></label>
    <fieldset><legend>พื้นที่รับผิดชอบ (ใส่อย่างใดอย่างหนึ่งหรือทั้งสอง)</legend>
      <label class="chk-row"><input type="checkbox" name="allcases"${(r.districts||[]).includes('*')?' checked':''}> ดูแลทุกเคสในระบบ (ไม่จำกัดพื้นที่)</label>
      <label>เขต / อำเภอ (คั่นด้วยจุลภาค · ศูนย์จังหวัดไม่ต้องใส่ ดูแลทั้งจังหวัด)<input name="districts" maxlength="600" value="${esc((r.districts||[]).filter(d=>d!=='*').join(', '))}" placeholder="เช่น ลาดกระบัง, ประเวศ, มีนบุรี"></label>
      <div class="row"><label>จุดที่ตั้ง (ละติจูด, ลองจิจูด)<input name="ll" maxlength="40" value="${r.lat!=null?esc(r.lat+', '+r.lng):''}" placeholder="13.7563, 100.5018"></label><label>รัศมี (กม.)<input name="radius" type="number" min="0" step="0.5" inputmode="decimal" value="${r.radius?esc(r.radius/1000):''}"></label></div>
      <div class="acts"><button type="button" class="btn ghost sm" id="ll-map">ใช้จุดกลางแผนที่ตอนนี้</button><button type="button" class="btn ghost sm" id="ll-me">ใช้ตำแหน่งของฉัน</button></div></fieldset>
    <label>สี<span class="colors">${COLORS.map(x=>`<label class="sw"><input type="radio" name="color" value="${x}"${x===(r.color||COLORS[W.rooms.length%COLORS.length])?' checked':''}><i style="background:${x}"></i></label>`).join('')}</span></label>
    <label>หมายเหตุ<input name="note" maxlength="500" value="${esc(r.note||'')}"></label>
    ${r.id?'<button type="button" class="btn ghost sm danger" id="wr-del">ปิดศูนย์ / War Room นี้</button>':''}`,async f=>{
    const m=String(f.ll.value).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/),rad=Math.round(Number(f.radius.value||0)*1000);
    if(rad&&!m){toast('ใส่จุดที่ตั้งก่อนกำหนดรัศมี');return false}
    const kind=f.kind.value,pv=f.province.value.trim();if(kind==='province'&&!pv){toast('ศูนย์ประสานงานจังหวัดต้องระบุจังหวัด');return false}
    if(kind==='zone'&&!f.name.value.trim()){toast('ใส่ชื่อ War Room โซน');return false}
    const res=await apiPost({action:'warroom_save',by:staffName()||'',warroom:{id:r.id||'',kind,province:pv,name:f.name.value,lead:f.lead.value,phone:f.phone.value,address:f.address.value,lat:m?+m[1]:'',lng:m?+m[2]:'',radius:rad,districts:(f.allcases.checked?'*, ':'')+f.districts.value,color:(f.querySelector('[name=color]:checked')||{}).value,note:f.note.value}});
    if(!res.ok){toast(res.error==='province_exists'?'จังหวัดนี้มีศูนย์ประสานงานแล้ว':'บันทึกไม่สำเร็จ: '+(res.error||''));return false}
    toast('บันทึกแล้ว',true);await loadRooms();W.room=res.id;W.fitted='';if(!r.id)W.tab='prof';try{history.replaceState(null,'','?wr='+encodeURIComponent(res.id))}catch(e){}render()});
  const f=$('#dlg-f');
  addrAuto(f.address,p=>{f.ll.value=p.lat.toFixed(5)+', '+p.lng.toFixed(5);
    if(p.province&&!f.province.value.trim())f.province.value=p.province;
    if(f.kind.value==='zone'&&p.district&&!f.districts.value.trim())f.districts.value=p.district;
    if(f.kind.value==='zone'&&!f.radius.value)f.radius.value=3;
    toast('ใส่ที่ตั้ง พิกัด'+(p.province?' จังหวัด':'')+(p.district&&f.kind.value==='zone'?' และเขต/อำเภอ':'')+'ให้แล้ว',true)});
  $('#ll-map').onclick=()=>{if(c)f.ll.value=c.lat.toFixed(5)+', '+c.lng.toFixed(5);else toast('เปิดแท็บภาพรวมเพื่อโหลดแผนที่ก่อน')};
  $('#ll-me').onclick=()=>navigator.geolocation&&navigator.geolocation.getCurrentPosition(p=>{f.ll.value=p.coords.latitude.toFixed(5)+', '+p.coords.longitude.toFixed(5)},()=>toast('หาตำแหน่งไม่ได้'),{enableHighAccuracy:true,timeout:10000});
  const del=$('#wr-del');if(del)del.onclick=async()=>{if(!confirm(`ปิด ${r.name}? ${isProv(r)?'War Room โซนในจังหวัดยังอยู่':'ทีมในห้องนี้จะกลับไปไม่สังกัดห้องใด'} (ข้อมูลเคสไม่หาย)`))return;
    const res=await apiPost({action:'warroom_save',warroom:{id:r.id,active:false}}).catch(()=>({}));if(res.ok){$('#dlg').close();W.room='';W.tab='over';try{history.replaceState(null,'',location.pathname)}catch(e){}await Promise.all([loadRooms(),loadTeams()]);render()}else toast('ปิดไม่สำเร็จ')};
}
$('#wr-new').onclick=()=>roomForm(null);

/* ---------- ค้นหาที่อยู่ขณะพิมพ์ → แตะเลือกแล้วกรอกให้อัตโนมัติ ----------
   ค้นพร้อมกัน 2 แหล่งของ OpenStreetMap (Photon + Nominatim) แล้วรวมผล · ไม่เจอ → ลองตัดคำนำหน้า (โรงเรียน/ร.ร./รร) แล้วค้นใหม่ */
async function geoSearch(q,c){
  const ph=fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=default&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}&bbox=97.3,5.6,105.7,20.5`).then(x=>x.json()).then(r=>(r.features||[]).filter(f=>!f.properties.countrycode||f.properties.countrycode==='TH').map(f=>{const p=f.properties||{};
      return {name:p.name||[p.housenumber,p.street].filter(Boolean).join(' ')||p.district||'',sub:[p.street&&p.name?p.street:'',p.district,p.city||p.county,p.state].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', '),lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],province:p.state||'',district:p.district||p.county||''}})).catch(()=>[]);
  const no=fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&countrycodes=th&limit=6&accept-language=th&addressdetails=1`).then(x=>x.json()).then(r=>(r||[]).map(x=>{const a=x.address||{};
      return {name:x.name||String(x.display_name||'').split(',')[0],sub:String(x.display_name||'').split(',').slice(1,5).join(',').trim(),lat:+x.lat,lng:+x.lon,province:a.state||a.province||(/กรุงเทพ/.test(a.city||'')?'กรุงเทพมหานคร':''),district:a.city_district||a.district||a.county||a.suburb||''}})).catch(()=>[]);
  const all=[...await ph,...await no],seen=new Set();
  return all.filter(x=>{const k=x.lat.toFixed(3)+','+x.lng.toFixed(3)+x.name;if(!x.name||seen.has(k))return false;seen.add(k);return true}).slice(0,8)}
function addrAuto(input,onPick){
  const box=document.createElement('ul');box.className='addr-sug';box.hidden=true;box.setAttribute('role','listbox');input.after(box);input.setAttribute('autocomplete','off');input.setAttribute('aria-autocomplete','list');
  let t=null,seq=0,items=[];
  input.addEventListener('input',()=>{clearTimeout(t);const q=input.value.trim();if(q.length<2){box.hidden=true;return}
    box.hidden=false;box.innerHTML='<li class="none">กำลังค้นหา…</li>';
    t=setTimeout(async()=>{const my=++seq,c=W.map?W.map.getCenter():{lat:13.75,lng:100.6};
      let r=await geoSearch(q,c);const short=q.replace(/^(โรงเรียน|ร\.?\s?ร\.?|รร\.?)\s*/,'').trim();
      if(!r.length&&short&&short!==q)r=await geoSearch(short,c);
      if(my!==seq)return;items=r;
      box.innerHTML=items.length?items.map((x,i)=>`<li role="option" data-i="${i}"><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></li>`).join(''):'<li class="none">ไม่พบในแผนที่ · ลองพิมพ์ชื่อถนน/ซอย/แขวง หรือใช้ปุ่มเลือกจุดด้านล่าง</li>'},500)});
  box.addEventListener('mousedown',e=>e.preventDefault());
  box.addEventListener('click',e=>{const li=e.target.closest('[data-i]');if(!li)return;const x=items[+li.dataset.i];
    input.value=[x.name,x.sub].filter(Boolean).join(', ');box.hidden=true;
    onPick({lat:x.lat,lng:x.lng,province:String(x.province||'').replace(/^จังหวัด\s*/,'').replace(/^กรุงเทพ.*/,'กรุงเทพมหานคร'),district:String(x.district||'').replace(/^เขต\s*/,'').trim()})});
  input.addEventListener('blur',()=>setTimeout(()=>{box.hidden=true},200));
  input.addEventListener('keydown',e=>{if(e.key==='Escape')box.hidden=true});
}

/* ---------- กล่องฟอร์ม ---------- */
function dlg(html,onSave){const d=$('#dlg'),f=$('#dlg-f');
  f.innerHTML=html+`<div class="acts end"><button type="button" class="btn ghost" value="cancel" id="dlg-x">ยกเลิก</button><button type="submit" class="btn primary" id="dlg-ok">บันทึก</button></div>`;
  $('#dlg-x').onclick=()=>d.close();
  f.onsubmit=async e=>{e.preventDefault();if(!f.reportValidity())return;$('#dlg-ok').disabled=true;let keep=false;try{keep=(await onSave(f))===false}catch(err){toast('บันทึกไม่สำเร็จ');keep=true}$('#dlg-ok').disabled=false;if(!keep)d.close()};
  d.showModal();setTimeout(()=>{const i=f.querySelector('input');if(i)i.focus()},30)}

/* ---------- วาดทั้งหมด ---------- */
function render(){roomsBar();const V=view();
  if(W.tab==='over'){kpis(V);alerts(V);queue(V);teams(V);feed(V);drawMap(V)}
  else if(!V.r&&W.tab==='struct')structTab();
  else if(V.r&&W.tab==='cases')casesTab(V);else if(V.r&&W.tab==='teams')teamsTab(V);else if(V.r&&W.tab==='stock')stockTab(V);else if(V.r&&W.tab==='prof')profTab(V);
  $("#status").textContent=`${V.r?V.r.name+' · ':''}อัปเดต ${new Date(W.at||Date.now()).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · เคส ${V.cases.length} · อัปเดตเองทุก 30 วินาที`;}

/* ---------- เวลา / เต็มจอ / รีเฟรช ---------- */
function clock(){$('#clock').textContent=new Date().toLocaleString('th-TH',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
$('#fs').onclick=()=>{const d=document.documentElement;if(document.fullscreenElement)document.exitFullscreen();else(d.requestFullscreen||d.webkitRequestFullscreen||(()=>{})).call(d)};
document.addEventListener('fullscreenchange',()=>{document.body.classList.toggle('wr-fs',!!document.fullscreenElement);setTimeout(()=>W.map&&W.map.invalidateSize(),200)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-fly]');if(!b||!W.map)return;const [a,o]=b.dataset.fly.split(',').map(Number);W.map.flyTo([a,o],16);$('#wmap').scrollIntoView({block:'nearest',behavior:'smooth'})});
$('#mt-done').onchange=()=>drawMap(view());
async function full(){$('#refresh').disabled=true;try{await Promise.all([loadCases(),loadTeams(),loadRooms(),W.tab==='stock'?loadStock():null]);render()}finally{$('#refresh').disabled=false}}
$('#refresh').onclick=full;
adminBoot({action:'chat_rev'},'rev',async()=>{document.body.classList.add('warroom');if(typeof VERIFY!=='undefined'){VERIFY.onUpdate=()=>render();VERIFY.load().then(render,render)}clock();setInterval(clock,1000);
  W.room=new URLSearchParams(location.search).get('wr')||'';
  await Promise.all([loadCases(),loadTeams(),loadRooms(),loadWarn()]);render();
  const busy=()=>document.hidden||$('#dlg').open||(document.activeElement&&document.activeElement.matches('input,select,textarea'));
  setInterval(async()=>{if(busy())return;await loadTeams();if(W.tab==='over'||W.tab==='teams')render()},15000);
  setInterval(pollLive,3000); // ตำแหน่งทีมแบบเรียลไทม์
  setInterval(async()=>{if(busy())return;await Promise.all([loadCases(),loadRooms()]);render()},30000);
  setInterval(()=>{if(!document.hidden)loadWarn().then(()=>{if(W.tab==='over')alerts(view())})},10*60000)});
