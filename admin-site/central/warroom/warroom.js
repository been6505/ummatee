/* War Room: โครงสร้าง HELP ME CENTRAL → ศูนย์ประสานงานจังหวัด → War Room โซน → ทีม
   - CENTRAL: ภาพรวมทั้งหมด (Common Operating Picture) + แท็บโครงสร้าง
   - ศูนย์ประสานงานจังหวัด (kind=province): เห็นเคส/ทีม/โซนทั้งจังหวัด
   - War Room โซน (kind=zone): ขอบเขตในจังหวัด = รายชื่อเขต/อำเภอ และ/หรือ วงกลม · ทีมสังกัดโซน
   - War Room ย่อย: ขอบเขต = รายชื่อเขต และ/หรือ วงกลม (จุดกลาง + รัศมี) · มีทีมประจำ (roster.warroom) · คลังของเอง (stock.warroom) · ทีมงานประจำห้อง
   - แท็บในห้อง: ภาพรวม · เคส (มอบทีม/เปลี่ยนสถานะเคสในระบบ · เคส Help Me เปิดที่ Help Me) · ทีม · สต็อก · โปรไฟล์
   ข้อมูล: เคส Help Me (หลัก) + เคสในระบบ · ทีม/ตำแหน่งสด (roster) · SOS/สายเข้า/แชท (chat_threads) · ประกาศกรมอุตุฯ (news)
   อัปเดตเอง: เคส 30 วิ · ทีม/แจ้งเตือน 15 วิ · ประกาศ 10 นาที */
const W={cases:[],roster:[],live:[],threads:[],alerts:{sos:[],calls:[]},warn:[],rooms:[],staff:[],items:[],log:[],
  room:'',tab:new URLSearchParams(location.search).get('tab')==='board'?'board':new URLSearchParams(location.search).get('wr')?'over':'struct',cst:'open',cq:'',map:null,lc:null,lt:null,lr:null,fitted:'',at:0};
/* ลิงก์ประจำ War Room (?wr=<id>&k=<token>): เข้าระบบด้วยรหัสของห้อง แล้วล็อกหน้าไว้ที่ห้องนั้น */
(()=>{const q=new URLSearchParams(location.search),k=(q.get('k')||'').replace(/[^a-z0-9]/g,''),wr=q.get('wr')||'';
  // คนที่เข้า CENTRAL ด้วยรหัสหลักอยู่แล้ว: เปิดห้องนั้นแบบปกติ ไม่ทับรหัส CENTRAL และไม่ล็อกหน้า
  // CENTRAL กดเปิดเว็บย่อยของห้อง: ดูแบบที่ทีม War Room เห็น เฉพาะแท็บนี้ (ไม่ทับรหัส CENTRAL)
  const cur=store.get('uh_vol_key');if(k&&wr&&cur&&!/^wru?_/.test(cur)){try{sessionStorage.setItem('uh_wr_preview',wr);history.replaceState(null,'','?wr='+encodeURIComponent(wr))}catch(e){}return}
  if(k&&wr){store.set('uh_vol_key','wr_'+k,true);store.set('uh_vol_ok','1',true);store.set('uh_wr_lock',wr,true);ADM.key='wr_'+k;
    try{history.replaceState(null,'','?wr='+encodeURIComponent(wr))}catch(e){}}})();
/* เข้าเว็บย่อยของห้องด้วยบัญชี (ชื่อผู้ใช้ + รหัสผ่าน): แสดงฟอร์มนี้แทนรหัส CENTRAL เมื่อเปิดจากลิงก์ห้อง (?wr=…) */
(()=>{const wr=new URLSearchParams(location.search).get('wr')||store.get('uh_wr_lock');if(!wr||ADM.key)return;
  const f=$('#wrl-form'),c=$('#login-form');f.hidden=false;c.hidden=true;
  fetch('/api?action=warroom_public&id='+encodeURIComponent(wr)).then(r=>r.json()).then(r=>{if(r&&r.ok)$('#wrl-title').textContent=r.name}).catch(()=>{});
  $('#wrl-central').onclick=()=>{f.hidden=true;c.hidden=false};
  f.onsubmit=async e=>{e.preventDefault();$('#wrl-go').disabled=true;$('#wrl-err').textContent='กำลังตรวจ…';
    try{const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'wr_login',warroom:wr,username:$('#wrl-user').value,password:$('#wrl-pass').value})}).then(x=>x.json());
      if(r.ok){store.set('uh_vol_key',r.key,true);store.set('uh_vol_ok','1',true);store.set('uh_wr_lock',r.warroom.id,true);location.replace('?wr='+encodeURIComponent(r.warroom.id));return}
      $('#wrl-err').textContent=r.error==='locked'?'ใส่รหัสผิดหลายครั้ง · ลองใหม่ใน 10 นาที':'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'}
    catch(err){$('#wrl-err').textContent='เชื่อมต่อไม่ได้ ลองใหม่'}finally{$('#wrl-go').disabled=false}}})();
const PREVIEW=()=>{try{return /^wru?_/.test(String(ADM.key||''))?'':sessionStorage.getItem('uh_wr_preview')||''}catch(e){return ''}};
const LOCK=()=>/^wru?_/.test(String(ADM.key||''))?store.get('uh_wr_lock'):PREVIEW();
const sev=c=>typeof VERIFY!=='undefined'&&VERIFY.level?VERIFY.level(c):Math.min(3,Math.max(1,Number(c.urgency)||1)); // ระดับที่ระบบตัดสิน (ผู้แจ้ง + ข้อมูลระบบ)
const URG={3:'วิกฤต',2:'เร่งด่วน',1:'ปกติ'};
const ST={ready:'พร้อม',out:'ออกเคส',rest:'พัก'};
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
/* "ใกล้เคียง" ของศูนย์จังหวัด = เคสนอกจังหวัดที่อยู่ห่างจุดกลางจังหวัดไม่เกิน 20 กม. */
const NEAR_KM=20,PROV_LL={'กรุงเทพมหานคร':[13.756,100.502],'กระบี่':[8.086,98.906],'กาญจนบุรี':[14.023,99.533],'กาฬสินธุ์':[16.432,103.506],'กำแพงเพชร':[16.483,99.522],'ขอนแก่น':[16.441,102.836],'จันทบุรี':[12.611,102.104],'ฉะเชิงเทรา':[13.69,101.077],'ชลบุรี':[13.361,100.985],'ชัยนาท':[15.186,100.125],'ชัยภูมิ':[15.807,102.032],'ชุมพร':[10.493,99.18],'เชียงราย':[19.91,99.841],'เชียงใหม่':[18.788,98.985],'ตรัง':[7.558,99.611],'ตราด':[12.243,102.515],'ตาก':[16.884,99.126],'นครนายก':[14.206,101.213],'นครปฐม':[13.82,100.062],'นครพนม':[17.392,104.769],'นครราชสีมา':[14.979,102.098],'นครศรีธรรมราช':[8.432,99.963],'นครสวรรค์':[15.704,100.137],'นนทบุรี':[13.862,100.514],'นราธิวาส':[6.426,101.823],'น่าน':[18.783,100.779],'บึงกาฬ':[18.36,103.646],'บุรีรัมย์':[14.993,103.103],'ปทุมธานี':[14.02,100.525],'ประจวบคีรีขันธ์':[11.812,99.797],'ปราจีนบุรี':[14.05,101.372],'ปัตตานี':[6.869,101.25],'พระนครศรีอยุธยา':[14.353,100.568],'พะเยา':[19.166,99.902],'พังงา':[8.451,98.525],'พัทลุง':[7.617,100.078],'พิจิตร':[16.442,100.349],'พิษณุโลก':[16.821,100.265],'เพชรบุรี':[13.112,99.94],'เพชรบูรณ์':[16.419,101.16],'แพร่':[18.145,100.141],'ภูเก็ต':[7.89,98.398],'มหาสารคาม':[16.184,103.301],'มุกดาหาร':[16.545,104.723],'แม่ฮ่องสอน':[19.301,97.969],'ยโสธร':[15.794,104.145],'ยะลา':[6.541,101.281],'ร้อยเอ็ด':[16.053,103.652],'ระนอง':[9.966,98.635],'ระยอง':[12.682,101.278],'ราชบุรี':[13.536,99.817],'ลพบุรี':[14.8,100.653],'ลำปาง':[18.289,99.49],'ลำพูน':[18.574,99.008],'เลย':[17.486,101.722],'ศรีสะเกษ':[15.118,104.322],'สกลนคร':[17.155,104.148],'สงขลา':[7.189,100.595],'สตูล':[6.623,100.067],'สมุทรปราการ':[13.599,100.597],'สมุทรสงคราม':[13.409,100.002],'สมุทรสาคร':[13.547,100.274],'สระแก้ว':[13.824,102.065],'สระบุรี':[14.529,100.911],'สิงห์บุรี':[14.888,100.401],'สุโขทัย':[17.007,99.823],'สุพรรณบุรี':[14.474,100.117],'สุราษฎร์ธานี':[9.14,99.333],'สุรินทร์':[14.882,103.493],'หนองคาย':[17.878,102.742],'หนองบัวลำภู':[17.204,102.44],'อ่างทอง':[14.589,100.455],'อำนาจเจริญ':[15.866,104.626],'อุดรธานี':[17.415,102.787],'อุตรดิตถ์':[17.62,100.099],'อุทัยธานี':[15.383,100.025],'อุบลราชธานี':[15.244,104.847]};
// จุดกลาง = ที่ตั้งศูนย์จังหวัด (ถ้าตั้งไว้) หรือตัวเมืองของจังหวัด
function provCenter(r){return r.lat!=null&&r.lng!=null?[r.lat,r.lng]:PROV_LL[r.province]||null}
const zonesOf=prov=>W.rooms.filter(r=>r.kind!=='province'&&r.province===prov);
document.addEventListener('error',e=>{const i=e.target;if(i.tagName==='IMG'&&i.dataset.alt&&i.src!==i.dataset.alt){i.src=i.dataset.alt;delete i.dataset.alt}},true);

/* ---------- ขอบเขตของ War Room ---------- */
const allCases=r=>r&&r.districts.includes('*');   // War Room ที่ดูแลทุกเคสในระบบ (ไม่จำกัดพื้นที่)
function inRoom(c,r){if(!r||allCases(r))return true;
  const pv=provOf(c);
  if(isProv(r))return pv===r.province||(hasPin(c)&&(()=>{const ctr=provCenter(r);return ctr&&km(ctr[0],ctr[1],+c.lat,+c.lng)<=NEAR_KM})()); // ในจังหวัด + ใกล้เคียง
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
  W.cases=hm.map(c=>({...c,needs:c.needs||[],src:'hm'})).concat(own.filter(c=>!ids.has(String(c.id))).map(c=>({...c,needs:c.needs||[],src:'own'}))).filter(c=>!c.dupOf); // เคสที่รวมเป็นเคสซ้ำแล้วไม่แสดง
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
/* เว็บย่อยของ War Room (เปิดจากลิงก์ /wr/<id>): หัวเว็บเป็นชื่อห้อง · ใช้เมนูของห้อง · ไม่มีเมนู CENTRAL */
function siteBrand(r){document.body.classList.add('wr-site');if(!r)return;const b=document.querySelector('.top .brand');
  if(b){b.href='?wr='+encodeURIComponent(r.id);const sp=b.querySelector('span');if(sp)sp.innerHTML=`<i class="rdot" style="background:${esc(r.color)}"></i> <b>${esc(r.name)}</b>`}
  document.title=r.name+' · Helpme+ War Room';
  const pv=$('#wr-preview');if(pv){pv.hidden=!PREVIEW();}}
/* CENTRAL: ปุ่มเปิดเว็บย่อยของห้องที่เลือก + คัดลอก/แชร์ลิงก์ให้ทีม War Room */
/* บัญชีผู้ใช้ของ War Room ย่อย (แท็บโปรไฟล์ · เฉพาะคนที่เข้าจากลิงก์ห้อง/บัญชีห้อง) */
const UR={lead:'หัวหน้า War Room · สร้าง/จัดการบัญชีได้',staff:'ทีมงาน'};
async function usersCard(){const el=$('#pf-users');if(!el)return;if(!/^wru?_/.test(String(ADM.key||''))){el.hidden=true;return}
  const r=await apiGet({action:'wr_users'}).catch(()=>null);if(!r||!r.ok){el.hidden=true;return}el.hidden=false;const lead=r.me.role==='lead',me=r.me.user;
  const when=t=>t?new Date(t).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'ยังไม่เคยเข้า';
  el.innerHTML=`<div class="wr-tools"><h2 style="margin:0">บัญชีผู้ใช้ War Room</h2></div>
    <p class="muted small">${me?`เข้าระบบเป็น <b>${esc(me.name||me.username)}</b> (${esc(me.username)})`:'เข้าจากลิงก์ห้อง (สิทธิ์หัวหน้า)'} · บัญชีใช้ได้เฉพาะ ${esc(r.warroom.name)} ไม่สามารถเข้าหน้า CENTRAL</p>
    ${r.users.length?`<ul class="wu-list">${r.users.map(u=>`<li class="${u.active?'':'off'}"><div><b>${esc(u.name||u.username)}</b> <small>@${esc(u.username)} · ${esc(UR[u.role]||u.role)}${u.active?'':' · ปิดแล้ว'}</small><small>เข้าล่าสุด ${esc(when(u.lastLogin))}</small></div>
      <span>${lead&&(!me||me.id!==u.id)?`<button type="button" class="btn ghost sm" data-wu-off="${esc(u.id)}" data-v="${u.active?0:1}">${u.active?'ปิดบัญชี':'เปิดบัญชี'}</button>`:''}<button type="button" class="btn ghost sm" data-wu-pw="${esc(u.id)}">ตั้งรหัสใหม่</button></span></li>`).join('')}</ul>`:'<p class="muted small">ยังไม่มีบัญชี · สร้างบัญชีของคุณเองก่อน แล้วสร้างให้ทีมงาน</p>'}
    ${lead?`<form class="wu-form" id="wu-form"><b>${r.users.length?'สร้างบัญชีให้ทีมงาน':'สร้างบัญชีของฉัน'}</b>
      <label>ชื่อจริง / ชื่อที่แสดง<input name="n" maxlength="60" placeholder="เช่น สมชาย ใจดี (ฝ่ายสต็อก)"></label>
      <label>ชื่อผู้ใช้ สำหรับเข้าระบบ<small class="muted"> ภาษาอังกฤษ/ตัวเลข ไม่เว้นวรรค · ไม่ใช่ชื่อจริง</small><input name="u" required pattern="[a-zA-Z0-9._\\-]{3,32}" maxlength="32" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="เช่น somchai01" title="ภาษาอังกฤษ/ตัวเลข 3–32 ตัว ไม่เว้นวรรค"></label>
      <label>รหัสผ่าน (อย่างน้อย 6 ตัว)<input name="p" type="text" required minlength="6" autocomplete="new-password"></label>
      <label>สิทธิ์<select name="r"><option value="${r.users.length?'staff':'lead'}">${r.users.length?'ทีมงาน':'หัวหน้า War Room'}</option><option value="${r.users.length?'lead':'staff'}">${r.users.length?'หัวหน้า War Room':'ทีมงาน'}</option></select></label>
      <button class="btn primary" type="submit">สร้างบัญชี</button><p class="muted small">ส่งชื่อผู้ใช้ + รหัสผ่าน + ลิงก์เข้าระบบให้ทีมงาน: <code>${esc(location.origin+'/wr/'+r.warroom.id)}</code></p></form>`:''}`;
  const f=$('#wu-form');if(f)f.onsubmit=async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));const x=await apiPost({action:'wr_user_save',username:d.u,name:d.n,password:d.p,role:d.r}).catch(()=>null);
    if(x&&x.ok){toast(`สร้างบัญชี @${x.username} แล้ว`,true);usersCard()}else toast({username_taken:'ชื่อผู้ใช้นี้มีแล้ว',short_password:'รหัสผ่านสั้นเกินไป',bad_username:'ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ/ตัวเลข ไม่เว้นวรรค (ไม่ใช่ชื่อจริง)',lead_only:'เฉพาะหัวหน้า War Room'}[x&&x.error]||'สร้างไม่สำเร็จ')}}
$('#p-prof').addEventListener('click',async e=>{const o=e.target.closest('[data-wu-off]');if(o){const r=await apiPost({action:'wr_user_save',id:o.dataset.wuOff,active:o.dataset.v==='1'}).catch(()=>null);toast(r&&r.ok?'บันทึกแล้ว':'ทำไม่สำเร็จ',!!(r&&r.ok));usersCard();return}
  const p=e.target.closest('[data-wu-pw]');if(p){const pw=prompt('รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)');if(!pw)return;const r=await apiPost({action:'wr_user_save',id:p.dataset.wuPw,password:pw}).catch(()=>null);
    toast(r&&r.ok?'ตั้งรหัสใหม่แล้ว · บัญชีนี้ต้องเข้าระบบใหม่':r&&r.error==='short_password'?'รหัสผ่านสั้นเกินไป':'ทำไม่สำเร็จ',!!(r&&r.ok));usersCard()}});
function linkBar(r){const el=$('#wr-linkbar');if(!el)return;if(!r||!r.linkKey){el.hidden=true;return}el.hidden=false;const url=wrUrl(r);
  el.innerHTML=`<a class="btn primary sm" href="${esc(url)}" target="_blank" rel="noopener">${ic('ext')} เปิดเว็บ ${esc(r.name)}</a>
    <button type="button" class="btn ghost sm" data-wlcopy="${esc(url)}">${ic('copy')} คัดลอกลิงก์ทีม</button>
    ${navigator.share?`<button type="button" class="btn ghost sm" id="wr-share">${ic('share')} แชร์</button>`:''}<span class="wl-url">${esc(url.replace(/\?k=.*/,'?k=…'))}</span>`;
  const sh=$('#wr-share');if(sh)sh.onclick=()=>navigator.share({title:'War Room '+r.name,text:`HELP ME CENTRAL · ${r.name}\nลิงก์เข้าระบบ War Room (ส่งเฉพาะทีมงาน)`,url}).catch(()=>{})}
function roomsBar(){const all=W.cases.filter(c=>c.status!=='done');
  const chip=(r,label)=>{const act=r?all.filter(c=>inRoom(c,r)):all,crit=act.filter(c=>sev(c)===3&&c.status!=='going').length,id=r?r.id:'';
    return `<button type="button" role="tab" data-room="${esc(id)}" aria-selected="${id===W.room}" class="${!r?'central':isProv(r)?'prov':'zone'}">${r?`<i class="rdot" style="background:${esc(r.color)}"></i>`:'<i data-ic="board"></i><span class="lbl-long">HELP ME CENTRAL · </span>'}${esc(label||(isProv(r)&&/^ศูนย์ประสานงานจังหวัด/.test(r.name)?'ศูนย์ประสานงาน':r.name)||'(ไม่มีชื่อ)')} <small>${act.length}${crit?` · <b class="cr">${crit} วิกฤต</b>`:''}</small></button>`};
  // จัดกลุ่มตามจังหวัด: ศูนย์ประสานงานจังหวัด แล้วตามด้วย War Room โซนในจังหวัดนั้น
  const provs=[...new Set(W.rooms.map(r=>r.province||''))].sort((a,b)=>!a-!b||(a==='กรุงเทพมหานคร'?-1:b==='กรุงเทพมหานคร'?1:a.localeCompare(b,'th')));
  const lk=LOCK();document.body.classList.toggle('wr-locked',!!lk);$('#wr-new').hidden=!!lk;
  if(lk){if(W.room!==lk)W.room=lk;const r0=W.rooms.find(r=>r.id===lk);siteBrand(r0);$('#rooms').innerHTML=r0?chip(r0):'<span class="muted">ไม่พบ War Room ของลิงก์นี้ (อาจถูกปิดหรือสร้างลิงก์ใหม่แล้ว)</span>'}
  else $('#rooms').innerHTML=chip(null,'ทั้งหมด')+provs.map(pv=>{const pr=W.rooms.find(r=>isProv(r)&&r.province===pv),zs=W.rooms.filter(r=>!isProv(r)&&(r.province||'')===pv);
    return `<span class="wr-grp"><span class="gl">${pv?'จ.'+esc(pv.replace('กรุงเทพมหานคร','กรุงเทพฯ')):'ไม่ระบุจังหวัด'}</span>${pr?chip(pr):''}${zs.map(z=>chip(z)).join('')}</span>`}).join('');
  linkBar(lk?null:room());
  const r=room();$('#subtabs').hidden=false;
  const tabs=!r?['struct','board']:['over','cases','teams','board','stock','prof']; // ภาพรวมทั้งหมดย้ายไปอยู่แดชบอร์ดแล้ว
  if(!tabs.includes(W.tab))W.tab=tabs[0];
  $$('#subtabs [data-tab]').forEach(b=>{b.hidden=!tabs.includes(b.dataset.tab);b.setAttribute('aria-selected',String(b.dataset.tab===W.tab))});
  ['over','struct','cases','teams','board','stock','prof'].forEach(k=>$('#p-'+k).hidden=k!==W.tab);
  document.body.classList.toggle('wr-overview',W.tab==='over')}
$('#rooms').addEventListener('click',async e=>{const b=e.target.closest('[data-room]');if(!b)return;W.room=b.dataset.room;W.fitted='';W.tab=W.room?'over':'struct';if(!W.room)await loadStock();
  try{history.replaceState(null,'',W.room?'?wr='+encodeURIComponent(W.room):location.pathname)}catch(err){}render()});
$('#subtabs').addEventListener('click',async e=>{const b=e.target.closest('[data-tab]');if(!b)return;W.tab=b.dataset.tab;if(!W.room){try{history.replaceState(null,'',location.pathname+(W.tab==='board'?'?tab=board':''))}catch(err){}}if(W.tab==='prof')W.uAt='';if(W.tab==='stock'||W.tab==='struct')await loadStock();render()});

/* ---------- ภาพรวม ---------- */
function kpis(V){const rm=room(),fresh=new Set(V.live.filter(l=>Date.now()-l.updatedAt<10*60e3).map(l=>l.team));
  hmSummary($('#kpis'),{cases:V.cases,title:rm?rm.name:'ภาพรวมทั้งหมด',online:fresh.size,teams:V.roster.length,sev})
}
$('#kpis').addEventListener('click',e=>{const b=e.target.closest('[data-cst]');if(!b||!room())return;const f=b.dataset.cst;W.cst=f==='crit'?'open':f;W.tab='cases';render()});
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
  if(!W.map){W.map=L.map('wmap',{zoomControl:true,scrollWheelZoom:true}).setView([13.75,100.6],11);
    // ชุดเดียวกับแดชบอร์ด: แบบแผนที่ ถนน/ดาวเทียม/มืด · ชั้นข้อมูล (เรดาร์ฝน ดาวเทียม เครือข่าย ศูนย์พักพิง กล้อง) · ปุ่มลอย · เต็มจอ
    W.map.zoomControl.setPosition('bottomright');W.map.attributionControl.setPrefix(false);W.map.attributionControl.addAttribution('น้ำท่วม: Floodboard.org');
    L.control.scale({metric:true,imperial:false,position:'bottomleft'}).addTo(W.map);let bs='road';try{bs=localStorage.getItem('uh_base')||'road'}catch(e){}setBase(['road','sat','dark'].includes(bs)?bs:'road');
    W.lf=L.layerGroup();W.lr=L.layerGroup().addTo(W.map);W.lc=L.layerGroup().addTo(W.map);W.lt=L.layerGroup().addTo(W.map);if(typeof MAPL!=='undefined')MAPL.attach(W.map)}
  // ถนนน้ำท่วม (Floodboard ผ่าน verify.js) · ทีม · ช่วยแล้ว ตามสวิตช์ในเมนูชั้นข้อมูล
  const on=id=>{const e=document.getElementById(id);return !!(e&&e.checked)},F=typeof VERIFY!=='undefined'?VERIFY.F:null;
  if(F&&W.floodAt!==F.loaded){W.floodAt=F.loaded;W.lf.clearLayers();F.roads.forEach(r=>{const d=r.depth||0,v=r.verdict,col=v==='blocked'||r.closed||d>=50?'#d32f2f':v==='risky'||d>=30?'#f57c00':'#fbc02d';
    r.lines.forEach(l=>L.polyline(l.map(p=>[p[1],p[0]]),{color:col,weight:5,opacity:.85,lineCap:'round'}).bindTooltip(`${esc(r.name)}${r.depth!=null?' · ~'+r.depth+' ซม.':''}`).addTo(W.lf))})}
  if(on('mt-flood'))W.lf.addTo(W.map);else W.lf.remove();
  if(on('mt-live'))W.lt.addTo(W.map);else W.lt.remove();
  const dl=$('#dleg');if(dl){dl.querySelector('.lg-done').hidden=!on('mt-done');dl.querySelector('.lg-flood').hidden=!on('mt-flood');dl.querySelector('.lg-live').hidden=!on('mt-live')}
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
/* แผนผัง: เคสค้างใต้แต่ละ War Room (วิกฤตก่อน · รอนานก่อน) */
function treeCases(list,label){const open=list.filter(c=>c.status!=='done').sort((a,b)=>sev(b)-sev(a)||(a.createdAt||0)-(b.createdAt||0));if(!open.length)return '';
  const row=c=>{const ph=photos(c);return `<a class="tc u${sev(c)}" href="${caseLink(c)}"><span class="tph">${ph.length?`<img src="${thumb(ph[0],96)}" data-alt="https://drive.google.com/thumbnail?id=${encodeURIComponent(ph[0])}&sz=w96" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}</span>
    <span class="tt"><b>${esc((c.needs||[]).slice(0,2).join(', ')||'ขอความช่วยเหลือ')}</b><small>${esc(c.people||1)} คน · ${esc(c.district||provOf(c)||'')} · ${c.status==='going'?'กำลังไป':'รอ '+esc(waitTxt(c.createdAt))}</small></span><span class="tl">${URG[sev(c)]}</span></a>`};
  return `<details class="tcs"${open.length<=4?' open':''}><summary>${esc(label)} <b>${open.length}</b>${open.some(c=>sev(c)===3)?` <span class="k cr">วิกฤต ${open.filter(c=>sev(c)===3).length}</span>`:''}</summary><div class="tcl">${open.slice(0,12).map(row).join('')}${open.length>12?`<span class="muted small">และอีก ${open.length-12} เคส · เปิด War Room เพื่อดูทั้งหมด</span>`:''}</div></details>`}
/* ---------- ใบสมัครจากหน้า /join ----------
   CENTRAL (แท็บจัดการ War Room): ทั้ง War Room และจิตอาสา · หัวหน้า War Room (แท็บทีม): จิตอาสาที่เลือกห้องนี้/ไม่ระบุห้อง */
const APPK={warroom:'หน่วยงาน',volunteer:'จิตอาสา'},APPS={pending:'รอพิจารณา',approved:'อนุมัติแล้ว',rejected:'ไม่อนุมัติ'};
const APPF={orgType:'ประเภท',orgName:'หน่วยงาน',roomName:'ชื่อที่แสดง',page:'เพจ/เว็บ',contact:'ผู้ประสานงาน',lineId:'LINE',districts:'เขตที่ดูแล',address:'ที่ตั้ง',services:'บริการ',staffCount:'เจ้าหน้าที่',volunteers:'จิตอาสาในเครือข่าย',teams:'ทีมพร้อมกัน',boats:'เรือ',highTrucks:'รถสูง',pickups:'รถกระบะ',mealsPerDay:'อาหาร/วัน',bagsPerDay:'ถุงยังชีพ/วัน',shelterCap:'รับผู้อพยพ',medical:'การแพทย์',warehouse:'คลัง',comms:'สื่อสาร/พลังงาน',hours:'เวลาทำการ',duration:'ระยะเวลา',needs:'ต้องการให้ช่วย',
  fullName:'ชื่อ',nickname:'ชื่อเล่น',age:'อายุ',area:'พื้นที่สะดวก',groupName:'กลุ่ม',groupSize:'จำนวนคน',skills:'ทักษะ',equipment:'อุปกรณ์',availability:'เวลาว่าง',fitness:'ลุยน้ำได้',health:'สุขภาพ',emergencyName:'ผู้ติดต่อฉุกเฉิน',emergencyPhone:'เบอร์ฉุกเฉิน'};
async function appsCard(el,mode){if(!el)return;const r=await apiGet({action:'apps_list'}).catch(()=>null);if(!r||!r.ok){el.hidden=true;return}
  const list=mode==='room'?r.apps.filter(a=>a.kind==='volunteer'):r.apps,pend=list.filter(a=>a.status==='pending');el.hidden=!list.length;if(!list.length)return;
  const rooms=W.rooms.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('');
  const row=a=>{const d=a.data||{},f=Object.entries(APPF).filter(([k])=>d[k]!==undefined&&d[k]!==''&&!(Array.isArray(d[k])&&!d[k].length)&&!['orgName','fullName'].includes(k)).map(([k,l])=>`<span><b>${esc(l)}</b> ${esc(Array.isArray(d[k])?d[k].join(', '):d[k])}</span>`).join('');
    const pref=a.wrPref&&W.rooms.find(w=>w.id===a.wrPref);
    return `<details class="app ${esc(a.status)}"${a.status==='pending'&&pend.length<=3?' open':''}><summary><span class="ak ${esc(a.kind)}">${APPK[a.kind]}</span><b>${esc(a.name)}</b><small>${esc(a.province||'')}${pref?' · อยากสังกัด '+esc(pref.name):''} · ${esc(APPS[a.status])}</small></summary>
      <div class="ab"><div class="af"><span><b>โทร</b> <a href="tel:${esc(telOf(a.phone))}">${esc(a.phone)}</a></span><span><b>ชื่อผู้ใช้</b> @${esc(a.username)}</span>${f}</div>
      ${a.status==='pending'?`<div class="aa">${a.kind==='volunteer'&&mode!=='room'?`<label>สังกัด<select data-app-wr="${esc(a.id)}"><option value="">ไม่สังกัดห้อง</option>${rooms}</select></label>`:''}
        <input data-app-note="${esc(a.id)}" maxlength="300" placeholder="หมายเหตุถึงผู้สมัคร (ไม่บังคับ)">
        <button type="button" class="btn primary sm" data-app-ok="${esc(a.id)}">${a.kind==='warroom'?'อนุมัติ · สร้างหน่วยงาน (War Room)':'อนุมัติ · สร้างทีม'}</button><button type="button" class="btn ghost sm" data-app-no="${esc(a.id)}">ไม่อนุมัติ</button></div>`
        :`<small class="muted">${esc(APPS[a.status])} โดย ${esc(a.decidedBy||'-')}${a.note?' · '+esc(a.note):''}</small>`}</div></details>`};
  el.innerHTML=`<div class="wr-tools"><h2 style="margin:0;font-size:17px">ใบสมัคร${mode==='room'?'จิตอาสา':'หน่วยงาน / จิตอาสา'} ${pend.length?`<span class="badge">${pend.length} รอพิจารณา</span>`:''}</h2><a class="btn ghost sm" href="/join/" target="_blank" rel="noopener">หน้าสมัคร ↗</a></div>${list.slice(0,40).map(row).join('')}`;
  el.querySelectorAll('[data-app-wr]').forEach(s=>{const a=list.find(x=>x.id===s.dataset.appWr);if(a&&a.wrPref)s.value=a.wrPref})}
document.addEventListener('click',async e=>{const ok=e.target.closest('[data-app-ok]'),no=e.target.closest('[data-app-no]');if(!ok&&!no)return;const id=(ok||no).dataset[ok?'appOk':'appNo'];
  if(no&&!confirm('ไม่อนุมัติใบสมัครนี้?'))return;const wr=document.querySelector(`[data-app-wr="${id}"]`),note=document.querySelector(`[data-app-note="${id}"]`);(ok||no).disabled=true;
  const r=await apiPost({action:'app_decide',id,approve:!!ok,warroom:wr?wr.value:'',note:note?note.value:'',by:store.get('uh_staff')||''}).catch(()=>null);
  toast(r&&r.ok?(ok?'อนุมัติแล้ว · ผู้สมัครเข้าสู่ระบบที่หน้า /join ได้เลย':'บันทึกแล้ว'):'ทำไม่สำเร็จ'+(r&&r.error?' ('+r.error+')':''),!!(r&&r.ok));
  if(r&&r.ok){await Promise.all([loadRooms(),loadTeams()]);W.appsAt='';render()}});
function structTab(){if(W.appsAt!=='s'){W.appsAt='s';appsCard($('#st-apps'),'central')}const open=W.cases.filter(c=>c.status!=='done'),zones=W.rooms.filter(r=>!isProv(r));
  const covered=c=>W.rooms.some(r=>inRoom(c,r)),orphan=open.filter(c=>!covered(c)),freeTeams=W.roster.filter(t=>!t.warroom||!zones.some(z=>z.id===t.warroom));
  const provs=[...new Set(W.rooms.map(r=>r.province||'').concat(open.map(provOf).filter(Boolean)))].sort((a,b)=>(a==='กรุงเทพมหานคร'?-1:b==='กรุงเทพมหานคร'?1:0)||a.localeCompare(b,'th'));
  $('#st-sum').innerHTML=[[W.rooms.length,'War Room ทั้งหมดทั่วประเทศ'],[new Set(W.rooms.map(r=>r.province).filter(Boolean)).size,'จังหวัดที่มี War Room'],[W.rooms.filter(isProv).length,'ศูนย์ประสานงานจังหวัด'],[zones.length,'War Room โซน'],[W.roster.length,'ทีมทั้งหมด'],[orphan.length,'เคสค้างที่ยังไม่มี War Room ดูแล',orphan.length?'crit':''],[freeTeams.length,'ทีมยังไม่สังกัดโซน',freeTeams.length?'warn':'']]
    .map(([v,l,c])=>`<div class="wr-kpi ${c||''}"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#st-tree').innerHTML=`<div class="node central"><b>HELP ME CENTRAL</b><span class="muted small">Common Operating Picture · ข้อมูล / มาตรฐาน / สนับสนุน</span><div class="kk">${chipsOf(stats(W.cases,W.roster.map(t=>t.name)))}</div></div>
    <div class="lvl">${provs.map(pv=>{const pr=W.rooms.find(r=>isProv(r)&&r.province===pv),zs=W.rooms.filter(r=>!isProv(r)&&(r.province||'')===pv),pc=W.cases.filter(c=>pv?provOf(c)===pv:!provOf(c));
      const pnames=W.roster.filter(t=>zs.some(z=>z.id===t.warroom)).map(t=>t.name),po=pc.filter(c=>c.status!=='done'&&!zs.some(z=>inRoom(c,z))).length;
      return `<div class="branch"><div class="node prov${pr?'':' missing'}">${pr?`<button type="button" class="lnk ttl" data-go="${esc(pr.id)}"><i class="rdot" style="background:${esc(pr.color)}"></i> ${esc(pr.name)}</button>${pr.linkKey?`<button type="button" class="btn ghost sm" data-wlcopy="${esc(wrUrl(pr))}"><i data-ic="link"></i> คัดลอกลิงก์ทีม</button>`:''}`:`<b>${pv?'จังหวัด'+esc(pv):'ไม่ระบุจังหวัด'}</b>`}
          <span class="muted small">${pv?'Provincial Coordination':'เคส/โซนที่ยังไม่ระบุจังหวัด'}${pr&&pr.lead?' · '+esc(pr.lead):''}${pr&&pr.phone?` · <a href="tel:${esc(telOf(pr.phone))}">${esc(pr.phone)}</a>`:''}</span>
          <div class="kk">${chipsOf(stats(pc,pnames))}${po?`<span class="k warn">${po} เคสนอกโซน</span>`:''}</div>
          ${treeCases(pc.filter(c=>!zs.some(z=>inRoom(c,z))),zs.length?'เคสในจังหวัด/ใกล้เคียง ที่ยังไม่มีโซนดูแล':'เคสในจังหวัด/ใกล้เคียง')}
          ${!pr&&pv?`<button type="button" class="btn ghost sm" data-newprov=""${esc(pv)}">+ ตั้งศูนย์ประสานงานจังหวัด</button>`:''}</div>
        <div class="lvl">${zs.map(z=>{const tn=W.roster.filter(t=>t.warroom===z.id);return `<div class="branch"><div class="node zone"><button type="button" class="lnk ttl" data-go="${esc(z.id)}"><i class="rdot" style="background:${esc(z.color)}"></i> ${esc(z.name)}</button>${z.linkKey?`<button type="button" class="btn ghost sm" data-wlcopy="${esc(wrUrl(z))}"><i data-ic="link"></i> คัดลอกลิงก์ทีม</button>`:''}
            <span class="muted small">War Room โซน${z.lead?' · '+esc(z.lead):''}${z.districts.length?' · '+esc(z.districts.slice(0,4).join(', '))+(z.districts.length>4?'…':''):''}</span>
            <div class="kk">${chipsOf(stats(W.cases.filter(c=>inRoom(c,z)),tn.map(t=>t.name)))}</div>
            <div class="tms">${tn.map(t=>`<span class="tm">${esc(t.name)}</span>`).join('')||'<span class="muted small">ยังไม่มีทีม</span>'}</div>
            ${treeCases(W.cases.filter(c=>inRoom(c,z)),'เคสในพื้นที่โซน')}</div></div>`}).join('')}
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
    const rv=(W.roster||[]).find(x=>x.name===l.team),html=`<i>${headArrow(l,rv&&rv.vehicle)}</i><span>${esc(l.team)}${mv?` · ${Math.round(l.speed)} กม./ชม.`:''}</span>`,cls='wr-team'+(s?' sos':stale?' stale':'')+(mv?' mv':'');
    const tip=esc(`${l.team} · ${stale?'ตำแหน่งเมื่อ '+ago(l.updatedAt):'ออนไลน์'}${l.battery!=null?' · แบต '+l.battery+'%':''}${l.speed?' · '+Math.round(l.speed)+' กม./ชม.':''}`);
    let mk=W.tm.get(l.team);
    if(!mk){mk=L.marker([l.lat,l.lng],{icon:L.divIcon({className:cls,html,iconSize:[42,36],iconAnchor:[21,18]}),keyboard:false}).bindTooltip(tip,{direction:'top',offset:[0,-8]}).addTo(W.lt);mk._k=cls+html;W.tm.set(l.team,mk)}
    else{glideTo(mk,[l.lat,l.lng]);if(mk._k!==cls+html){mk._k=cls+html;mk.setIcon(L.divIcon({className:cls,html,iconSize:[42,36],iconAnchor:[21,18]}))}mk.setTooltipContent(tip)}
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
  // รายการแบบ helpme4u.com: แถวสั้น (รูป · ระดับ · ไอคอนความต้องการ · จำนวนคน · พื้นที่ · รอ) กดแล้วขยายรายละเอียด + ปุ่มจัดการ
  const NI=[[/อาหาร/,'food'],[/น้ำดื่ม|น้ำ/,'water'],[/ยา|การแพทย์|แพทย์/,'pill'],[/อพยพ|เรือ/,'boat'],[/ผู้ป่วย|ผู้สูงอายุ|ติดเตียง|พิการ/,'patient']];
  const nIc=c=>{const seen=[];(c.needs||[]).forEach(n=>{const m=NI.find(([re])=>re.test(n));const k=m?m[1]:'more';if(!seen.includes(k))seen.push(k)});return seen};
  const UC={3:'u3',2:'u2',1:'u1'},row=(l,v)=>v?`<dt>${l}</dt><dd>${v}</dd>`:'';
  $('#c-body').innerHTML=list.length?list.map(c=>{const ph=photos(c),v=vol(c),ics=nIc(c),u=sev(c),id=String(c.id),open=W.copen===id,tel=String(c.phone||'').replace(/[^\d+]/g,'');
    return `<article class="wr-ci ${UC[u]} cs-${esc(c.status)}${open?' is-open':''}" data-cid="${esc(id)}">
      <button type="button" class="wr-ci-h" aria-expanded="${open}" data-ctog="${esc(id)}">
        <span class="ph">${ph.length?`<img src="${thumb(ph[0],160)}" data-alt="https://drive.google.com/thumbnail?id=${encodeURIComponent(ph[0])}&sz=w160" alt="" loading="lazy" referrerpolicy="no-referrer">${ph.length>1?`<b>${ph.length}</b>`:''}`:ic('image')}</span>
        <span class="lv"><i></i>${c.status==='done'?'ช่วยแล้ว':c.status==='going'?'กำลังไป':URG[u]}</span>
        <span class="nd" title="${esc((c.needs||[]).join(', '))}">${ics.slice(0,2).map(k=>ic(k)).join('')}${ics.length>2?`<small>+${ics.length-2}</small>`:''}</span>
        <span class="pp"><b>${esc(c.people||1)}</b> <span>${esc(c.district||c.province||'–')}</span></span>
        <span class="wt">${c.status==='done'?'—':esc(waitTxt(c.createdAt))}</span><svg class="cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      ${open?`<div class="wr-ci-b"><dl>${row('ต้องการ',esc((c.needs||[]).join(' · ')||'ขอความช่วยเหลือ'))}${row('สถานะ',esc(CST[c.status]||c.status)+(v?' · '+esc(v):''))}${row('จำนวนคน',esc(c.people||1)+' คน')}
          ${row('ระดับน้ำ',esc(c.levelText||''))}${row('ที่อยู่',esc(c.address||''))}${row('ผู้แจ้ง',esc([c.name,c.phone].filter(Boolean).join(' · ')))}${row('หมายเหตุ',esc(c.notes||''))}
          ${row('แจ้งเมื่อ',c.createdAt?esc(waitTxt(c.createdAt))+'ที่แล้ว'+(c.src==='hm'?' · Help Me':''):'')}</dl>
        ${ph.length?`<div class="wr-ci-ph">${ph.slice(0,6).map(x=>`<a href="https://drive.google.com/file/d/${encodeURIComponent(x)}/view" target="_blank" rel="noopener"><img src="${thumb(x,320)}" data-alt="https://drive.google.com/thumbnail?id=${encodeURIComponent(x)}&sz=w320" alt="รูปจากผู้แจ้ง" loading="lazy" referrerpolicy="no-referrer"></a>`).join('')}</div>`:''}
        ${c.status!=='done'?`<label class="wr-ci-as">มอบทีม<select data-assign="${esc(id)}" aria-label="มอบทีม">${teamOpts(v)}</select></label>`:''}
        <div class="wr-ci-a">${tel?`<a class="btn call" href="tel:${esc(tel)}">${ic('phone')} โทร</a>`:''}${hasPin(c)?`<a class="btn ghost" href="${navLink(c.lat,c.lng)}" target="_blank" rel="noopener">${ic('nav')} นำทาง</a>`:''}
          ${c.status!=='done'?`<button type="button" class="btn ghost" data-done="${esc(id)}">${ic('check')} เสร็จ</button>`:''}<a class="btn ghost" href="${caseLink(c)}">${ic('next')} เปิดเคส</a></div></div>`:''}</article>`}).join('')
    :`<p class="muted wr-empty">ไม่มีเคส${V.r?' ในพื้นที่ของ War Room นี้ (ตั้งเขต/รัศมีได้ที่แท็บโปรไฟล์)':''}</p>`;
  $('#c-count').textContent=`${list.length} เคส`
}
$('#c-st').addEventListener('click',e=>{const b=e.target.closest('[data-st]');if(!b)return;W.cst=b.dataset.st;casesTab(view())});
$('#c-q').addEventListener('input',e=>{W.cq=e.target.value;casesTab(view())});
$('#c-body').addEventListener('change',async e=>{const s=e.target.closest('[data-assign]');if(!s)return;const c=W.cases.find(x=>String(x.id)===s.dataset.assign);if(!c)return;
  const team=s.value;s.disabled=true;
  try{const r=await apiPost({action:'update',id:c.id,status:team?'going':'open',volunteer:team});if(r.ok){c.volunteer=team;c.status=team?'going':'open';toast(team?`มอบเคสให้ ${team} แล้ว`:'ยกเลิกการมอบทีมแล้ว',true)}else toast('บันทึกไม่สำเร็จ: '+(r.error||''))}
  catch(err){toast('บันทึกไม่สำเร็จ')}finally{s.disabled=false;render()}});
$('#c-body').addEventListener('click',e=>{const t=e.target.closest('[data-ctog]');if(!t)return;W.copen=W.copen===t.dataset.ctog?'':t.dataset.ctog;casesTab(view())});
$('#c-body').addEventListener('click',async e=>{const b=e.target.closest('[data-done]');if(!b)return;const c=W.cases.find(x=>String(x.id)===b.dataset.done);if(!c||!confirm('ปิดเคสนี้ว่าช่วยเสร็จแล้ว?'))return;
  b.disabled=true;try{const r=await apiPost({action:'update',id:c.id,status:'done',volunteer:vol(c)});if(r.ok){c.status='done';toast('ปิดเคสแล้ว',true)}else toast('บันทึกไม่สำเร็จ: '+(r.error||''))}catch(err){toast('บันทึกไม่สำเร็จ')}render()});

/* ---------- แท็บ ทีม ---------- */
function teamsTab(V){if(W.appsAt!=='t'+V.r.id&&/^wru?_/.test(String(ADM.key||''))){W.appsAt='t'+V.r.id;appsCard($('#t-apps'),'room')}const r=V.r,live=new Map(W.live.map(l=>[l.team,l])),rn=new Map(W.rooms.map(x=>[x.id,x]));
  if(isProv(r)){dispatchQ(V);const zs=zonesOf(r.province);
    $('#t-hint').textContent=`ทีมในจังหวัด${r.province}: ${V.roster.length} ทีม ใน ${zs.length} War Room โซน · จัดทีมเข้าโซนได้ที่ War Room โซนนั้น`;
    $('#t-list').innerHTML=zs.length?zs.map(z=>{const tn=W.roster.filter(t=>t.warroom===z.id);return `<div class="wr-tcard"><div class="h"><i class="rdot" style="background:${esc(z.color)}"></i><b>${esc(z.name)}</b><span class="st">${tn.length} ทีม</span></div>
      ${tn.map(t=>{const l=live.get(t.name),on=l&&mins(l.updatedAt)<10;return `<small><i class="dot ${on?'on':''}" style="display:inline-block;margin-right:6px"></i>${esc(t.name)} · ${esc(ST[t.status]||'')}${l?'':' · ไม่แชร์ตำแหน่ง'}</small>`}).join('')||'<small>ยังไม่มีทีม</small>'}
      <div class="a"><button type="button" class="btn ghost sm" data-gozone="${esc(z.id)}">ไปที่ War Room โซน</button></div></div>`}).join(''):'<p class="muted">ยังไม่มี War Room โซนในจังหวัดนี้ · สร้างได้ที่ปุ่ม "+ สร้างศูนย์จังหวัด / War Room"</p>';
    return}
  $('#t-hint').textContent=`ทีมใน ${r.name}: ${V.roster.length} ทีม · กด "เพิ่มเข้า War Room นี้" เพื่อย้ายทีมมาประจำห้องนี้ (ทีมอยู่ได้ทีละ 1 ห้อง) · แก้รายละเอียดทีมที่หน้า "จัดทีม"`;
  const all=W.roster.slice().sort((a,b)=>(b.warroom===r.id)-(a.warroom===r.id)||a.name.localeCompare(b.name,'th'));
  dispatchQ(V);
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

/* ---------- จัดทีมใน War Room: คิวเคสที่ยังไม่มีทีม + ทีมที่แนะนำ (ใกล้สุด/ว่าง) → กดมอบหมาย ---------- */
const VEH={boat:'เรือ',truck:'รถสูง / รถบรรทุก',pickup:'รถกระบะ',car:'รถเก๋ง / รถตู้',motorbike:'มอเตอร์ไซค์',foot:'เดินเท้า',other:'อื่น ๆ'};
function suggestTeams(c,teams){const live=new Map(W.live.map(l=>[l.team,l])),busy=new Map();W.cases.forEach(x=>{if(x.status==='going'){const v=vol(x);if(v)busy.set(v,(busy.get(v)||0)+1)}});
  const needBoat=/เรือ/.test((c.needs||[]).join(' '))||['chest','roof'].includes(c.level);
  return teams.map(t=>{const l=live.get(t.name),d=l&&hasPin(c)?km(l.lat,l.lng,+c.lat,+c.lng):null,b=busy.get(t.name)||0;
    const score=(t.status==='ready'?0:t.status==='out'?20:60)+(d==null?15:Math.min(30,d*2))+b*8+(needBoat&&t.vehicle!=='boat'&&t.vehicle!=='truck'?25:0);
    return {t,d,b,score}}).sort((a,b)=>a.score-b.score)}
function dispatchQ(V){const box=$('#t-queue');if(!box)return;
  const teams=V.roster.length?V.roster:W.roster,q=V.cases.filter(c=>c.status==='open'&&!vol(c)).sort((a,b)=>sev(b)-sev(a)||(a.createdAt||0)-(b.createdAt||0)).slice(0,40);
  box.innerHTML=`<div class="wr-tools"><h2 style="margin:0;font-size:17px">คิวจัดทีม · ${q.length} เคสยังไม่มีทีม</h2>${V.r&&!isProv(V.r)?'<button type="button" class="btn primary sm" id="t-add">+ เพิ่มทีมใหม่ในห้องนี้</button>':''}</div>
    ${!teams.length?'<p class="muted">ยังไม่มีทีม · กด "+ เพิ่มทีมใหม่ในห้องนี้"</p>':''}
    <div class="wr-dq">${q.map(c=>{const sg=suggestTeams(c,teams),best=sg[0],ph=photos(c);
      return `<div class="wr-dqi u${sev(c)}">${ph.length?`<img src="${thumb(ph[0],120)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<span class="noimg"></span>'}
        <div class="tx"><span class="tag">${URG[sev(c)]}</span><b>${esc((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')}</b><small>${esc([c.district?'เขต'+c.district:'',(c.people||1)+' คน','รอ '+waitTxt(c.createdAt)].filter(Boolean).join(' · '))}</small></div>
        <div class="act"><select data-dq="${esc(c.id)}" aria-label="เลือกทีม">${sg.map((x,i)=>`<option value="${esc(x.t.name)}"${i===0?' selected':''}>${i===0?'แนะนำ: ':''}${esc(x.t.name)} · ${esc(ST[x.t.status]||'')}${x.d!=null?' · '+x.d.toFixed(1)+' กม.':''}${x.b?' · ถือ '+x.b:''}</option>`).join('')}</select>
          <button type="button" class="btn primary sm" data-dqgo="${esc(c.id)}"${best?'':' disabled'}>มอบหมาย</button>${hasPin(c)?`<a class="btn ghost sm" href="${navLink(c.lat,c.lng)}" target="_blank" rel="noopener" title="นำทาง"><i data-ic="nav"></i></a>`:''}</div></div>`}).join('')||'<p class="muted">ไม่มีเคสค้างที่ยังไม่มีทีม 🎉</p>'}</div>`;
  const add=$('#t-add');if(add)add.onclick=()=>teamForm()}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-dqgo]');if(!b)return;const id=b.dataset.dqgo,sel=$(`[data-dq="${CSS.escape(id)}"]`),team=sel&&sel.value,c=W.cases.find(x=>String(x.id)===id);if(!c||!team)return;
  b.disabled=true;try{const r=await apiPost({action:'update',id:c.id,status:'going',volunteer:team});
    if(r.ok){c.status='going';c.volunteer=team;toast(`มอบเคสให้ ${team} แล้ว`,true);render()}else{toast('มอบหมายไม่สำเร็จ: '+(r.error||''));b.disabled=false}}catch(err){toast('มอบหมายไม่สำเร็จ');b.disabled=false}});
function teamForm(){const r=room();if(!r)return;
  dlg(`<h2>เพิ่มทีมใหม่ใน ${esc(r.name)}</h2><label>ชื่อทีม<input name="name" required maxlength="60" placeholder="เช่น ทีมเรือ 4"></label>
    <div class="row"><label>หัวหน้าทีม<input name="leader" maxlength="60"></label><label>เบอร์โทร<input name="phone" inputmode="tel" maxlength="20"></label></div>
    <div class="row"><label>พาหนะ<select name="vehicle"><option value="">—</option>${Object.entries(VEH).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>จำนวนคน<input name="members" type="number" min="1" max="999" inputmode="numeric"></label></div>`,async f=>{
    const name=f.name.value.trim();const res=await apiPost({action:'roster_save',by:staffName()||'',team:{name,leader:f.leader.value,phone:f.phone.value,vehicle:f.vehicle.value,members:f.members.value,status:'ready'}});
    if(!res.ok){toast(res.error==='duplicate_name'?'มีทีมชื่อนี้แล้ว':'บันทึกไม่สำเร็จ: '+(res.error||''));return false}
    await apiPost({action:'team_warroom',team:name,warroom:r.id});toast('เพิ่มทีมแล้ว · ส่ง "ลิงก์ทีม" ให้ทีมได้ที่หน้าจัดทีม',true);await loadTeams();render()})}

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
function profTab(V){const r=V.r,staff=W.staff.filter(s=>s.wr===r.id);if(W.uAt!==r.id){W.uAt=r.id;usersCard()}
  const crit=V.cases.filter(c=>c.status!=='done'&&sev(c)===3).length,act=V.cases.filter(c=>c.status!=='done').length;
  $('#pf-info').innerHTML=`<div class="wr-tools"><h2 style="margin:0"><i class="rdot" style="background:${esc(r.color)}"></i> ${esc(r.name)}</h2><button type="button" class="btn ghost sm" id="pf-edit">แก้ไขข้อมูล War Room</button></div>
    <dl class="wr-dl"><dt>ประเภท</dt><dd>${isProv(r)?'ศูนย์ประสานงานจังหวัด (Provincial Coordination)':'War Room โซน'}${r.province?' · จังหวัด'+esc(r.province):''}</dd>${isProv(r)?`<dt>War Room โซน</dt><dd>${zonesOf(r.province).map(z=>`<button type="button" class="lnk" data-gozone2="${esc(z.id)}">${esc(z.name)}</button>`).join(' · ')||'ยังไม่มี'}</dd>`:''}<dt>หัวหน้า</dt><dd>${esc(r.lead||'—')}</dd><dt>เบอร์ติดต่อ</dt><dd>${r.phone?`<a href="tel:${esc(telOf(r.phone))}">${esc(r.phone)}</a>`:'—'}</dd>
      <dt>ที่ตั้ง</dt><dd>${esc(r.address||'—')}${r.lat!=null?` · <button type="button" class="lnk" data-fly2="${+r.lat},${+r.lng}">ดูบนแผนที่</button>`:''}</dd>
      <dt>พื้นที่รับผิดชอบ</dt><dd>${allCases(r)?'<b>ทุกเคสในระบบ</b> (ไม่จำกัดพื้นที่)':''}${!allCases(r)&&isProv(r)?'ทั้งจังหวัด'+esc(r.province):''}${!isProv(r)&&!allCases(r)&&r.districts.length?'เขต '+esc(r.districts.join(', ')):''}${r.districts.length&&r.radius?' และ ':''}${r.radius?`รัศมี ${esc((r.radius/1000).toLocaleString('th-TH',{maximumFractionDigits:1}))} กม. จากจุดที่ตั้ง`:''}${!isProv(r)&&!allCases(r)&&!r.districts.length&&!r.radius?'<span class="lowt">ยังไม่ได้กำหนด · เคสจะไม่ขึ้นในห้องนี้</span>':''}</dd>
      <dt>สถานการณ์</dt><dd>เคสค้าง ${act} · วิกฤต ${crit} · ทีม ${V.roster.length} · ทีมงานประจำ ${staff.length} คน</dd>${r.note?`<dt>หมายเหตุ</dt><dd>${esc(r.note)}</dd>`:''}</dl>`;
  $('#pf-staff').innerHTML=staff.length?`<table class="wr-tbl wr-stf"><thead><tr><th>ชื่อ</th><th>หน้าที่</th><th>เบอร์</th><th>เวร / กะ</th><th></th></tr></thead><tbody>${staff.map(s=>`<tr><td><b>${esc(s.name)}</b>${s.note?`<small>${esc(s.note)}</small>`:''}</td><td>${esc(ROLES[s.role]||s.role)}</td><td>${s.phone?`<a href="tel:${esc(telOf(s.phone))}">${esc(s.phone)}</a>`:'—'}</td><td>${esc(s.shift||'—')}</td><td class="act"><button type="button" class="btn ghost sm" data-pedit="${esc(s.id)}">แก้ไข</button><button type="button" class="btn ghost sm" data-pdel="${esc(s.id)}">ลบ</button></td></tr>`).join('')}</tbody></table>`
    :'<p class="muted">ยังไม่มีรายชื่อทีมงาน · กด "+ เพิ่มคน" เพื่อใส่หัวหน้า ผู้สั่งการ ผู้ดูแลคลัง ฯลฯ</p>';
  $('#pf-edit').onclick=()=>roomForm(r);
  // ลิงก์ประจำห้อง (สร้างอัตโนมัติ · เห็นเฉพาะศูนย์กลาง)
  if(!LOCK()&&r.linkKey){const url=wrUrl(r),msg=`HELP ME CENTRAL · ${r.name}\nลิงก์เข้าระบบ War Room (ส่งเฉพาะทีมงาน): ${url}`;
    $('#pf-info').insertAdjacentHTML('beforeend',`<div class="wr-link"><b><i data-ic="link"></i> ลิงก์สำหรับทีม War Room นี้</b>
    <p class="muted small">ส่งให้ทีมงานของห้องนี้ เปิดแล้วเข้าระบบได้เลย (ไม่ต้องใช้รหัสกลาง) · จัดการเคส จัดทีม สต็อก และโปรไฟล์ของห้องนี้ได้ · ส่งต่อเฉพาะคนในทีม</p>
    <div class="wr-link-row"><input readonly value="${esc(url)}" onclick="this.select()" aria-label="ลิงก์ War Room"><button type="button" class="btn primary sm" data-wlcopy="${esc(url)}">คัดลอก</button><a class="btn ghost sm" href="https://line.me/R/share?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">ส่ง LINE</a><button type="button" class="btn ghost sm" id="wl-renew">สร้างลิงก์ใหม่</button></div></div>`);
    $('#wl-renew').onclick=()=>wrLink(r,true)}}
const wrUrl=r=>location.origin+'/wr/'+encodeURIComponent(r.id)+'?k='+r.linkKey; // ลิงก์สั้นของ War Room ย่อย (เซิร์ฟเวอร์พาไปหน้าห้อง)
document.addEventListener('click',async e=>{const b=e.target.closest('[data-wlcopy]');if(!b)return;try{await navigator.clipboard.writeText(b.dataset.wlcopy);toast('คัดลอกลิงก์ War Room แล้ว',true)}catch(err){}});
async function wrLink(r,renew){if(!confirm('สร้างลิงก์ใหม่? ลิงก์เดิมจะใช้ไม่ได้ทันที (คนที่เข้าด้วยลิงก์เดิมจะถูกออกจากระบบ)'))return;
  const res=await apiPost({action:'warroom_link',id:r.id,renew:true}).catch(()=>({}));if(!res.ok){toast('สร้างลิงก์ไม่สำเร็จ');return}r.linkKey=res.token;toast('สร้างลิงก์ใหม่แล้ว · ส่งลิงก์ใหม่ให้ทีม',true);render()}
$('#p-prof').addEventListener('click',async e=>{const gz=e.target.closest('[data-gozone2]');if(gz){W.room=gz.dataset.gozone2;W.tab='over';W.fitted='';try{history.replaceState(null,'','?wr='+encodeURIComponent(W.room))}catch(err){}render();return}
  const ed=e.target.closest('[data-pedit]');if(ed){staffForm(W.staff.find(s=>s.id===ed.dataset.pedit));return}
  const del=e.target.closest('[data-pdel]');if(del&&confirm('ลบรายชื่อนี้?')){const r=await apiPost({action:'warroom_staff',staff:{id:del.dataset.pdel,active:false}}).catch(()=>({}));if(r.ok){await loadRooms();render()}else toast('ลบไม่สำเร็จ')}
  const f=e.target.closest('[data-fly2]');if(f){W.tab='over';render();const [a,o]=f.dataset.fly2.split(',').map(Number);setTimeout(()=>W.map&&W.map.flyTo([a,o],14),300)}});
$('#pf-add').onclick=()=>staffForm(null);
$('#logout').addEventListener('click',()=>{const k=String(ADM.key||'');if(k.startsWith('wru_'))fetch('/api',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'wr_logout',key:k})}).catch(()=>{});store.set('uh_wr_lock','');try{sessionStorage.removeItem('uh_wr_preview')}catch(e){}});
$('#wr-preview-exit')&&($('#wr-preview-exit').onclick=()=>{try{sessionStorage.removeItem('uh_wr_preview')}catch(e){}location.href='?wr='+encodeURIComponent(W.room)});
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
  const P=qq=>fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(qq)}&limit=8&lang=default&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}&bbox=97.3,5.6,105.7,20.5`).then(x=>x.json()).then(r=>(r.features||[]).filter(f=>!f.properties.countrycode||f.properties.countrycode==='TH').map(f=>{const p=f.properties||{};
      return {name:p.name||[p.housenumber,p.street].filter(Boolean).join(' ')||p.district||'',sub:[p.street&&p.name?p.street:'',p.district,p.city||p.county,p.state].filter((v,i,a)=>v&&a.indexOf(v)===i).join(', '),lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],province:p.state||(/กรุงเทพ/.test(p.city||p.county||'')?'กรุงเทพมหานคร':''),district:p.district||p.county||''}})).catch(()=>[]);
  const N=qq=>fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(qq)}&format=jsonv2&countrycodes=th&limit=8&accept-language=th&addressdetails=1`).then(x=>x.json()).then(r=>(r||[]).map(x=>{const a=x.address||{};
      return {name:x.name||String(x.display_name||'').split(',')[0],sub:String(x.display_name||'').split(',').slice(1,5).join(',').trim(),lat:+x.lat,lng:+x.lon,province:a.state||a.province||(/กรุงเทพ/.test(a.city||'')?'กรุงเทพมหานคร':''),district:a.city_district||a.district||a.county||a.suburb||''}})).catch(()=>[]);
  // ใช้ข้อความทั้งหมด: ค้นทั้งแบบที่พิมพ์ และแบบเติม "ซอย" (เช่น "รามคำแหง 22" → "ซอยรามคำแหง 22")
  const vs=[q];if(!/^(ซอย|ซ\.|ถนน|ถ\.)/.test(q)&&/\d/.test(q))vs.push('ซอย'+q.replace(/\s+(?=\d)/,' '));
  const all=(await Promise.all([N(q),...vs.map(P)])).flat();
  const norm=t=>String(t||'').toLowerCase().replace(/[\s.,()\-]/g,'').replace(/^ซ(?=\d)/,'ซอย');
  const toks=q.split(/\s+/).map(norm).filter(Boolean),seen=new Set();
  const scored=all.map(x=>{const t=norm(x.name+' '+x.sub),n=toks.filter(k=>t.includes(k)).length,exact=norm(x.name).includes(norm(q));return {...x,s:n*10+(exact?15:0)+(toks.length&&n===toks.length?20:0)}})
    .filter(x=>{const k=x.lat.toFixed(4)+','+x.lng.toFixed(4)+x.name;if(!x.name||seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>b.s-a.s);
  // มีผลที่ตรงครบทุกคำ → แสดงเฉพาะชุดนั้น · ไม่มี → แสดงที่ใกล้เคียงที่สุด
  const full=scored.filter(x=>toks.length&&toks.every(k=>norm(x.name+' '+x.sub).includes(k)));
  return (full.length?full:scored).slice(0,8)}
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
function render(){roomsBar();const V=view();chatScope(V);
  if(W.tab==='over'){kpis(V);alerts(V);queue(V);teams(V);feed(V);drawMap(V)}
  else if(!V.r&&W.tab==='struct')structTab();
  else if(W.tab==='board'){if(typeof BOARD!=='undefined')BOARD.show()}
  else if(V.r&&W.tab==='cases')casesTab(V);else if(V.r&&W.tab==='teams')teamsTab(V);else if(V.r&&W.tab==='stock')stockTab(V);else if(V.r&&W.tab==='prof')profTab(V);
  $("#status").textContent=`${V.r?V.r.name+' · ':''}อัปเดต ${new Date(W.at||Date.now()).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'})} · เคส ${V.cases.length} · อัปเดตเองทุก 30 วินาที`;}

/* แชทใน War Room = แชทกับทีมที่ลงพื้นที่ของห้องนี้ (ทีมที่ออกเคส/มีเคสที่รับอยู่ขึ้นก่อน) */
function chatScope(V){if(typeof CHAT==='undefined'||!CHAT.setScope)return;const r=V.r;
  const info=name=>{const t=W.roster.find(x=>x.name===name),cs=V.cases.filter(c=>c.status==='going'&&vol(c)===name),l=W.live.find(x=>x.team===name),on=l&&mins(l.updatedAt)<10;
    if(!t&&!cs.length)return null;const field=cs.length>0||(t&&t.status==='out');
    return {field,tag:field?'ลงพื้นที่':(t&&ST[t.status])||'ทีม',text:[field?`ลงพื้นที่${cs.length?' · '+cs.length+' เคส':''}`:(t&&ST[t.status])||'',cs[0]?(cs[0].needs||[]).slice(0,2).join(', ')+(cs[0].district?' · '+cs[0].district:''):'',on?'ออนไลน์':''].filter(Boolean).join(' · ')}};
  if(typeof HERMES!=='undefined')HERMES.setScope(r?{title:r.name,roomId:r.id,cases:V.cases,roster:V.roster,live:V.live}:null);
  CHAT.setScope({title:r?'แชททีมลงพื้นที่ · '+r.name:'แชททีมลงพื้นที่',teams:r?V.roster.map(t=>t.name):null,info,
    note:r?`ทีมของ ${r.name} · ${V.roster.filter(t=>(info(t.name)||{}).field).length} ทีมกำลังลงพื้นที่`:'ทุกทีม · ทีมที่กำลังลงพื้นที่ขึ้นก่อน'})}

/* ---------- เวลา / เต็มจอ / รีเฟรช ---------- */
function clock(){$('#clock').textContent=new Date().toLocaleString('th-TH',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
$('#fs').onclick=()=>{const d=document.documentElement;if(document.fullscreenElement)document.exitFullscreen();else(d.requestFullscreen||d.webkitRequestFullscreen||(()=>{})).call(d)};
document.addEventListener('fullscreenchange',()=>{document.body.classList.toggle('wr-fs',!!document.fullscreenElement);setTimeout(()=>W.map&&W.map.invalidateSize(),200)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-fly]');if(!b||!W.map)return;const [a,o]=b.dataset.fly.split(',').map(Number);W.map.flyTo([a,o],16);$('#wmap').scrollIntoView({block:'nearest',behavior:'smooth'})});
['mt-done','mt-flood','mt-live'].forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener('change',()=>drawMap(view()))});
/* แบบแผนที่ (เหมือนแดชบอร์ด): ถนน / ดาวเทียม / มืด · OpenFreeMap ป้ายไทยเมื่อโหลดได้ */
const DESRI='https://server.arcgisonline.com/ArcGIS/rest/services/';
function setBase(name){const m=W.map,t=(u,a,o={})=>L.tileLayer(u,{maxZoom:19,attribution:a,crossOrigin:true,...o});if(W.base)m.removeLayer(W.base);
  if(name==='sat')W.base=L.layerGroup([t(DESRI+'World_Imagery/MapServer/tile/{z}/{y}/{x}','แผนที่ © Esri'),t(DESRI+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',''),t(DESRI+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}','')]);
  else if(name==='dark')W.base=L.layerGroup([t(DESRI+'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}','แผนที่ © Esri',{maxZoom:16,maxNativeZoom:16}),t(DESRI+'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}','',{maxZoom:16,maxNativeZoom:16})]);
  else W.base=t('https://tile.openstreetmap.org/{z}/{x}/{y}.png','© OpenStreetMap');
  W.base.addTo(m);const tok=W.baseTok=(W.baseTok||0)+1;if((name==='road'||name==='dark')&&typeof OFM!=='undefined')OFM.layer(name).then(l=>{if(!l||tok!==W.baseTok)return;m.removeLayer(W.base);W.base=l;l.addTo(m)});
  try{localStorage.setItem('uh_base',name)}catch(e){}document.querySelectorAll('[data-dbase]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.dbase===name)))}
document.addEventListener('click',e=>{const b=e.target.closest('[data-dbase]');if(b&&W.map){setBase(b.dataset.dbase);return}
  const menu=$('#dlayer');if(menu&&!menu.hidden&&!e.target.closest('#dlayer')&&!e.target.closest('#fs-lay')){menu.hidden=true;$('#fs-lay').setAttribute('aria-expanded','false');$('#fs-lay').classList.remove('on')}});
$('#fs-loc').addEventListener('click',e=>{const btn=e.currentTarget;if(!navigator.geolocation||!W.map){toast('อุปกรณ์นี้หาตำแหน่งไม่ได้');return}btn.classList.add('busy');
  navigator.geolocation.getCurrentPosition(p=>{btn.classList.remove('busy');const ll=[p.coords.latitude,p.coords.longitude];if(!W.me)W.me=L.marker(ll,{icon:L.divIcon({className:'me-dot',html:'<span></span>',iconSize:[22,22]}),interactive:false,zIndexOffset:2000}).addTo(W.map);W.me.setLatLng(ll);W.map.setView(ll,Math.max(W.map.getZoom(),14))},
    ()=>{btn.classList.remove('busy');toast('หาตำแหน่งไม่ได้')},{enableHighAccuracy:true,timeout:15000})});
(()=>{const ICON_FULL='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    ICON_CLOSE='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const card=document.querySelector('.wr-mapcard'),btn=$('#fs-btn'),lay=$('#fs-lay');if(!card||!btn)return;
  const fix=()=>setTimeout(()=>{if(W.map)W.map.invalidateSize()},80);
  function set(on,fromPop){if(on===card.classList.contains('fs'))return;card.classList.toggle('fs',on);document.body.classList.toggle('map-fs',on);
    btn.innerHTML=on?ICON_CLOSE:ICON_FULL;btn.setAttribute('aria-label',on?'ออกจากเต็มจอ':'ขยายแผนที่เต็มจอ');btn.title=btn.getAttribute('aria-label');
    if(on){try{history.pushState({mapfs:1},'')}catch(e){}}else if(!fromPop&&history.state&&history.state.mapfs)try{history.back()}catch(e){}fix()}
  btn.addEventListener('click',()=>set(!card.classList.contains('fs')));btn.innerHTML=ICON_FULL;
  lay.addEventListener('click',()=>{const m=$('#dlayer'),o=m.hidden;m.hidden=!o;lay.setAttribute('aria-expanded',String(o));lay.classList.toggle('on',o)});
  window.addEventListener('popstate',()=>set(false,true));
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const m=$('#dlayer');if(m&&!m.hidden){m.hidden=true;lay.setAttribute('aria-expanded','false');lay.classList.remove('on');return}if(card.classList.contains('fs'))set(false)})})();
async function full(){$('#refresh').disabled=true;try{await Promise.all([loadCases(),loadTeams(),loadRooms(),W.tab==='stock'?loadStock():null]);render()}finally{$('#refresh').disabled=false}}
$('#refresh').onclick=full;
adminBoot({action:'chat_rev'},'rev',async()=>{document.body.classList.add('warroom');if(typeof VERIFY!=='undefined'){VERIFY.onUpdate=()=>render();VERIFY.load().then(render,render)}clock();setInterval(clock,1000);
  W.room=new URLSearchParams(location.search).get('wr')||'';
  await Promise.all([loadCases(),loadTeams(),loadRooms(),loadWarn()]);render();
  const busy=()=>document.hidden||$('#dlg').open||(document.activeElement&&document.activeElement.matches('input,select,textarea'));
  setInterval(async()=>{if(busy())return;await loadTeams();if(W.tab==='over'||W.tab==='teams')render()},15000);
  setInterval(pollLive,3000); // ตำแหน่งทีมแบบเรียลไทม์
  setInterval(async()=>{if(busy())return;await Promise.all([loadCases(),loadRooms()]);render()},15000);
  document.addEventListener('visibilitychange',async()=>{if(document.hidden||busy())return;await Promise.all([loadCases(),loadTeams(),loadRooms()]);render()});
  setInterval(()=>{if(!document.hidden)loadWarn().then(()=>{if(W.tab==='over')alerts(view())})},10*60000)});

$('#doc-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText('0989406537');toast('คัดลอกเบอร์แล้ว',true)}catch(e){toast('คัดลอกไม่ได้ · 098-940-6537')}});
$('#st-new').onclick=()=>roomForm(null);

/* ถาม Hermes (Local AI) · หลังยืนยันการกระทำ โหลดข้อมูลใหม่ */
$('#wr-ai').onclick=()=>{if(typeof HERMES!=='undefined')HERMES.open()};
window.addEventListener('hermes:done',async()=>{await Promise.all([loadCases(),loadTeams()]);render()});
