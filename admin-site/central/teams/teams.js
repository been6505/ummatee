/* จัดทีม: รายชื่อทีม สถานะ พาหนะ เคสที่ถือ + มอบหมายเคสที่รออยู่ให้ทีม */
const T={roster:[],live:[],cases:[],filter:'all',loaded:0,hqPhone:''};
const TST={ready:'พร้อม',out:'ออกงาน',rest:'พัก'};
const VEH={boat:'เรือ',truck:'รถสูง / รถบรรทุก',pickup:'รถกระบะ',car:'รถเก๋ง / รถตู้',motorbike:'มอเตอร์ไซค์',foot:'เดินเท้า',other:'อื่น ๆ'};
const URG={3:'วิกฤต',2:'เร่งด่วน',1:'ทั่วไป'};
const LEVEL={ankle:'ข้อเท้า',knee:'เข่า',waist:'เอว',chest:'อก',roof:'มิดหัว'};
const sev=c=>typeof VERIFY!=='undefined'&&VERIFY.level?VERIFY.level(c):Math.min(3,Math.max(1,Number(c.urgency)||1)); // ระดับที่ระบบตัดสิน (ผู้แจ้ง + ข้อมูลระบบ)
const hasPin=c=>c&&c.lat!==''&&c.lat!=null&&c.lng!==''&&c.lng!=null&&isFinite(+c.lat)&&isFinite(+c.lng);
const km=(a,b,c,d)=>{const R=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,h=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const tname=s=>String(s||'').replace(/^'/,'').trim();
const tel=p=>String(p||'').replace(/^'/,'').replace(/[^\d+]/g,'');

async function loadAll(){
  $('#sync').textContent='กำลังโหลด…';
  try{const [r,c]=await Promise.all([apiGet({action:'roster'}),apiGet({action:'list'})]);
    if(r&&r.ok){T.roster=r.roster||[];T.live=r.live||[];T.hqPhone=r.hqPhone||''}
    if(c&&c.ok)T.cases=(c.cases||[]).map(x=>({...x,needs:Array.isArray(x.needs)?x.needs:String(x.needs||'').split(/\s*,\s*/).filter(Boolean)}));
    T.loaded=Date.now();render()}
  catch(e){$('#sync').textContent='โหลดไม่สำเร็จ'}}
$('#refresh').addEventListener('click',loadAll);
setInterval(()=>{if(ADM.key&&!document.hidden)loadAll()},15000);document.addEventListener('visibilitychange',()=>{if(ADM.key&&!document.hidden)loadAll()});
/* ตำแหน่งสดทุก 15 วิ: อัปเดตแผนที่ + ป้ายสถานะบนการ์ด (ไม่วาดหน้าใหม่ทั้งหมด) */
// ตำแหน่งสดทุก 3 วินาที (หมุดเลื่อนลื่นระหว่างรอบด้วย glideTo)
let liveBusy=false;setInterval(async()=>{if(!ADM.key||document.hidden||!T.loaded||liveBusy)return;liveBusy=true;try{const r=await apiGet({action:'teams'});if(r&&r.ok){T.live=r.teams||[];liveUI()}}catch(e){}finally{liveBusy=false}},3000);
function liveUI(){if(typeof TRACK!=='undefined')TRACK.update(T.live,T.roster);
  $$('[data-live-of]').forEach(el=>{const t=T.roster.find(x=>String(x.id)===el.dataset.liveOf);if(t)el.outerHTML=liveTag(t)})}
/* ป้ายตำแหน่งของทีม: สด / เงียบ / ขาดการติดต่อ (ทีมออกงานแต่ไม่ส่งตำแหน่งเกิน 10 นาที) */
function liveTag(t){const lv=liveOf(t.name),id=esc(t.id);
  if(!lv)return `<span class="lv lv-none" data-live-of="${id}">${t.status==='out'?'<i data-ic="alert"></i> ไม่แชร์ตำแหน่ง':'ไม่แชร์ตำแหน่ง'}</span>`;
  const m=(Date.now()-lv.updatedAt)/60000,k=m<5?'on':m<30?'idle':'old',lost=t.status==='out'&&m>=10;
  return `<span class="lv lv-${lost?'lost':k}" data-live-of="${id}">● ${lost?'ขาดการติดต่อ ':''}${esc(ago(lv.updatedAt))}${lv.battery!=null?` · แบต ${lv.battery}%`:''}${lv.speed!=null&&lv.speed>=1?` · ${Math.round(lv.speed)} กม./ชม.`:''}</span>`}
const sosOn=t=>t&&t.sosAt&&(!t.sosAck||t.sosAck<t.sosAt);

function teamCases(name){const n=tname(name);return T.cases.filter(c=>tname(c.volunteer)===n)}
function liveOf(name){return T.live.find(l=>tname(l.team)===tname(name))}
function needsVehicle(c){const n=(c.needs||[]).join(' ');return /เรือ|รถสูง/.test(n)||c.level==='chest'||c.level==='roof'?'boat':''}
function suggest(c){
  const ready=T.roster.filter(t=>t.status!=='rest');if(!ready.length)return [];
  const want=needsVehicle(c);
  return ready.map(t=>{const lv=liveOf(t.name),d=lv&&hasPin(c)?km(+c.lat,+c.lng,lv.lat,lv.lng):null,busy=teamCases(t.name).filter(x=>x.status==='going').length;
    let s=0;if(t.status==='ready')s+=30;if(want==='boat'&&(t.vehicle==='boat'||t.vehicle==='truck'))s+=30;if(want==='boat'&&t.vehicle&&!['boat','truck'].includes(t.vehicle))s-=20;
    if(d!=null)s+=Math.max(0,25-d*2.5);s-=busy*8;
    const why=[TST[t.status]||'',t.vehicle?VEH[t.vehicle]:'',d!=null?`ห่าง ${d.toFixed(1)} กม.`:'',busy?`ถืออยู่ ${busy} เคส`:'ว่าง'].filter(Boolean).join(' · ');
    return {t,s,why}}).sort((a,b)=>b.s-a.s)}

function render(){
  $('#sync').textContent=T.loaded?'อัปเดต '+new Date(T.loaded).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'';
  const R=T.roster,cnt=s=>R.filter(t=>t.status===s).length,people=R.reduce((s,t)=>s+(Number(t.members)||0),0);
  const queue=T.cases.filter(c=>c.status==='open');
  const going=T.cases.filter(c=>c.status==='going').length;
  const sharing=R.filter(t=>{const l=liveOf(t.name);return l&&Date.now()-l.updatedAt<30*60e3}).length,sos=R.filter(sosOn);
  $('#stats').innerHTML=[['ทีมทั้งหมด',R.length,'','all'],['พร้อมออกงาน',cnt('ready'),'done','ready'],['กำลังออกงาน',cnt('out'),'go','out'],['แชร์ตำแหน่ง',sharing,'go','live'],['อาสาทั้งหมด',people||'–','','people'],['เคสรอจัดทีม',queue.length,'red','queue'],['SOS',sos.length,sos.length?'red':'','sos']]
    .map(([t,v,k,f])=>`<button type="button" class="stat ${k}" data-sf="${f}" aria-pressed="${T.sf===f}"><b>${esc(v)}</b><span>${t}</span></button>`).join('');
  $('#sos-list').innerHTML=sos.map(t=>{const lv=liveOf(t.name),p=tel(t.phone);return `<div class="sos-card" role="alert"><b><i data-ic="alert"></i> SOS · ${esc(t.name)}</b><span>${esc(ago(t.sosAt))}${lv?' · ตำแหน่ง '+esc(ago(lv.updatedAt)):''}</span>
    <span class="sos-acts">${lv?`<button class="btn sm" data-track="${esc(t.name)}"><i data-ic="pin"></i> ดูตำแหน่ง</button>`:''}${p.length>=9?`<a class="btn sm" href="tel:${esc(p)}"><i data-ic="phone"></i> โทร</a>`:''}<button class="btn sm" data-tchat="${esc(t.name)}"><i data-ic="chat"></i> แชท</button><button class="btn sm primary" data-sosack="${esc(t.id)}">รับทราบ</button></span></div>`}).join('');
  if(document.activeElement!==$('#hq-phone'))$('#hq-phone').value=tname(T.hqPhone);
  liveUI();
  /* teams */
  const list=R.filter(t=>T.filter==='all'||(T.filter==='live'?(()=>{const l=liveOf(t.name);return l&&Date.now()-l.updatedAt<30*60e3})():T.filter==='sos'?sosOn(t):t.status===T.filter)).sort((a,b)=>({ready:0,out:1,rest:2}[a.status]??3)-({ready:0,out:1,rest:2}[b.status]??3)||String(a.name).localeCompare(String(b.name),'th'));
  const el=$('#team-list');
  if(!R.length)el.innerHTML='<p class="empty">ยังไม่มีทีม กด "+ เพิ่มทีม" เพื่อเริ่ม<br><small>ทีมที่เคยรับเคสจะขึ้นด้านล่างให้เพิ่มได้ในคลิกเดียว</small></p>';
  else el.innerHTML=list.map(t=>{const cs=teamCases(t.name),g=cs.filter(c=>c.status==='going'),d=cs.filter(c=>c.status==='done'),lv=liveOf(t.name),p=tel(t.phone);
    return `<article class="team st-${esc(t.status)}${sosOn(t)?' sos':''}" data-team-id="${esc(t.id)}"><div class="team-h"><div><b>${esc(t.name)}</b><small>${[t.vehicle?VEH[t.vehicle]:'',t.members?t.members+' คน':'',t.zone?'พื้นที่ '+t.zone:''].filter(Boolean).map(esc).join(' · ')||'ยังไม่ระบุรายละเอียด'}</small></div>
      <select class="tst tst-${esc(t.status)}" data-tst="${esc(t.id)}" aria-label="สถานะทีม ${esc(t.name)}">${Object.entries(TST).map(([k,v])=>`<option value="${k}" ${t.status===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="team-m">${t.leader?`หัวหน้าทีม ${esc(t.leader)} `:''}${p.length>=9?`<a href="tel:${esc(p)}">${esc(tname(t.phone))}</a>`:''}${liveTag(t)}${lv?`<button class="linkish" data-track="${esc(t.name)}"><i data-ic="pin"></i> ติดตาม</button>`:''}${t.view?`<a class="linkish" href="${esc('/live/?v='+t.view)}" target="_blank" rel="noopener" title="ลิงก์ติดตามตำแหน่งสด (ส่งต่อได้)"><i data-ic="live"></i> ลิงก์ติดตาม ↗</a>`:''}${/^https:\/\//.test(t.gmaps||'')?`<a class="linkish gm" href="${esc(t.gmaps)}" target="_blank" rel="noopener" title="ตำแหน่งสดที่ทีมแชร์จาก Google Maps (ส่งต่อแม้ล็อกจอ)"><i data-ic="live"></i> ตำแหน่งสด Google Maps ↗</a>`:''}</div>
      ${typeof TEAMCALL!=='undefined'?TEAMCALL.buttons(t,{caseText:g[0]?TEAMCALL.caseText(g[0]):''}):''}
      ${g.length?`<ul class="tcases">${g.map(c=>`<li><span class="urg urg-${sev(c)}">${URG[sev(c)]}</span> ${esc((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')} · ${esc(c.people||1)} คน <small>${esc([c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · '))}</small> <button class="linkish" data-done="${esc(c.id)}"><i data-ic="check"></i> ช่วยแล้ว</button></li>`).join('')}</ul>`:'<p class="muted small">ไม่มีเคสที่กำลังไป</p>'}
      <div class="team-f"><span class="muted small">ช่วยแล้ว ${d.length} เคส${t.note?' · '+esc(t.note):''}</span><span><button class="btn ghost sm" data-tlink="${esc(t.id)}"><i data-ic="link"></i> ลิงก์ทีม</button> <button class="btn ghost sm" data-edit="${esc(t.id)}">แก้ไข</button></span></div></article>`}).join('')||'<p class="empty">ไม่มีทีมในสถานะนี้</p>';
  /* teams seen in cases but not in roster */
  const known=new Set(R.map(t=>tname(t.name))),seen=[...new Set(T.cases.map(c=>tname(c.volunteer)).filter(Boolean))].filter(n=>!known.has(n));
  if(seen.length)el.insertAdjacentHTML('beforeend',`<div class="seen"><small class="muted">ทีมที่เคยรับเคสแต่ยังไม่อยู่ในรายชื่อ:</small> ${seen.map(n=>`<button class="chip" data-quick="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>`);
  /* queue */
  const order=c=>{const v=typeof VERIFY!=='undefined'?VERIFY.assess(c).score:0;return sev(c)*100+v};
  const q=queue.slice().sort((a,b)=>order(b)-order(a)||(Number(a.createdAt)-Number(b.createdAt)));
  $('#q-count').textContent=q.length?q.length+' เคส':'';
  $('#queue').innerHTML=q.length?q.slice(0,60).map(c=>{const sg=suggest(c),best=sg[0],vr=typeof VERIFY!=='undefined'?VERIFY.assess(c):null;
    return `<article class="qcase u${sev(c)}"><div class="q-h"><span class="urg urg-${sev(c)}">${URG[sev(c)]}</span>${vr&&vr.result.k!=='nopin'?`<span class="vr vr-${vr.result.k}">${esc(vr.result.t)}</span>`:''}${(()=>{const m=typeof COVERED!=='undefined'?COVERED.match(c):null;return m?`<span class="cov" title="${esc(m.best.r.area+' · '+m.best.how)}"><i data-ic="hand"></i> ${esc(m.best.r.org)} เคยมอบใกล้เคียง</span>`:''})()}<small class="muted">${esc(ago(c.createdAt))} · #${esc(c.id)}</small></div>
      <b>${esc((c.needs||[]).join(' · ')||'ขอความช่วยเหลือ')}</b><div class="small">${esc(c.people||1)} คน${c.level?' · น้ำ'+esc(LEVEL[c.level]||''):''} · ${esc([c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ')||'ไม่ระบุที่อยู่')}</div>
      ${R.length?`<div class="assign"><select data-pick="${esc(c.id)}" aria-label="เลือกทีมสำหรับเคส ${esc(c.id)}">${sg.map((x,i)=>`<option value="${esc(x.t.name)}">${i===0?'แนะนำ: ':''}${esc(x.t.name)} (${esc(x.why)})</option>`).join('')}</select><button class="btn primary sm" data-assign="${esc(c.id)}">มอบหมาย</button><button class="btn ghost sm" data-callpick="${esc(c.id)}" title="โทร / SMS / วิดีโอคอล ทีมที่เลือก"><i data-ic="phone"></i> ติดต่อทีม</button></div>`:'<p class="muted small">เพิ่มทีมก่อนจึงจะมอบหมายได้</p>'}
    </article>`}).join(''):'<p class="empty">ไม่มีเคสรอจัดทีม <i data-ic="check"></i></p>';
}

/* ---------- actions ---------- */
async function saveTeam(t,msg){try{const r=await apiPost({action:'roster_save',team:t,by:staffName()});
  if(!r.ok){toast(r.error==='duplicate_name'?'มีทีมชื่อนี้อยู่แล้ว':'บันทึกไม่สำเร็จ: '+(r.error||''));return false}toast(msg||'บันทึกทีมแล้ว',true);await loadAll();return true}catch(e){if(e.message!=='auth')toast('บันทึกไม่สำเร็จ ลองใหม่');return false}}
async function updateCase(c,status,team){const prev={status:c.status,volunteer:c.volunteer};c.status=status;if(team)c.volunteer=team;render();
  try{const r=await apiPost({action:'update',id:c.id,status,volunteer:team||c.volunteer||''});if(!r.ok)throw 0;toast(status==='going'?`มอบหมายเคส #${c.id} ให้ ${team} แล้ว`:`ปิดเคส #${c.id} แล้ว`,true)}
  catch(e){Object.assign(c,prev);render();if(e&&e.message==='auth')return;toast('บันทึกไม่สำเร็จ ลองใหม่')}}
document.addEventListener('change',e=>{const s=e.target.closest('[data-tst]');if(!s)return;const t=T.roster.find(x=>String(x.id)===s.dataset.tst);if(t)saveTeam({...t,status:s.value},`${t.name} → ${TST[s.value]}`)});
document.addEventListener('click',e=>{
  /* การ์ดสรุปด้านบน: กดแล้วกรอง/เลื่อนไปส่วนที่เกี่ยวข้อง · กดซ้ำ = ยกเลิก */
  const sc=e.target.closest('#stats [data-sf]');if(sc){let k=sc.dataset.sf;if(T.sf===k&&k!=='all')k='all';T.sf=k==='all'?'':k;
    const tf=k==='people'?'all':k==='queue'?T.filter:k;
    if(k!=='queue'){T.filter=tf;$$('#team-filter [data-f]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.f===tf)))}
    render();const to=k==='queue'?$('#queue').closest('.panel'):$('#team-list').closest('.panel');
    if(to)to.scrollIntoView({behavior:'smooth',block:'start'});
    if(k==='sos'&&!$$('#team-list .team').length)toast('ไม่มีทีมที่ส่ง SOS');if(k==='live'&&!$$('#team-list .team').length)toast('ยังไม่มีทีมที่แชร์ตำแหน่ง');return}
  const f=e.target.closest('#team-filter [data-f]');if(f)T.sf='';if(f){T.filter=f.dataset.f;$$('#team-filter [data-f]').forEach(b=>b.setAttribute('aria-selected',String(b===f)));render();return}
  const a=e.target.closest('[data-assign]');if(a){const c=T.cases.find(x=>String(x.id)===a.dataset.assign),sel=document.querySelector(`[data-pick="${CSS.escape(a.dataset.assign)}"]`);if(c&&sel&&sel.value){updateCase(c,'going',sel.value);const t=T.roster.find(x=>x.name===sel.value);if(t&&t.status==='ready')saveTeam({...t,status:'out'},`${t.name} → ออกงาน`)}return}
  const cp=e.target.closest('[data-callpick]');if(cp&&typeof TEAMCALL!=='undefined'){const c=T.cases.find(x=>String(x.id)===cp.dataset.callpick),sel=document.querySelector(`[data-pick="${CSS.escape(cp.dataset.callpick)}"]`),t=sel&&T.roster.find(x=>x.name===sel.value);
    if(t)callSheet(t,c);return}
  const d=e.target.closest('[data-done]');if(d){const c=T.cases.find(x=>String(x.id)===d.dataset.done);if(c)updateCase(c,'done');return}
  const tr=e.target.closest('[data-track]');if(tr&&typeof TRACK!=='undefined'){TRACK.focus(tr.dataset.track);$('#trk-map').scrollIntoView({behavior:'smooth',block:'center'});return}
  const lk=e.target.closest('[data-tlink]');if(lk){linkSheet(T.roster.find(x=>String(x.id)===lk.dataset.tlink));return}
  const ack=e.target.closest('[data-sosack]');if(ack){const t=T.roster.find(x=>String(x.id)===ack.dataset.sosack);if(t){ack.disabled=true;apiPost({action:'sos_ack',id:t.id,team:t.name,by:staffName()}).then(r=>{toast(r.ok?`รับทราบ SOS ของ ${t.name} แล้ว`:'บันทึกไม่สำเร็จ',r.ok);loadAll()}).catch(()=>{})}return}
  const ed=e.target.closest('[data-edit]');if(ed){openForm(T.roster.find(x=>String(x.id)===ed.dataset.edit));return}
  const q=e.target.closest('[data-quick]');if(q){saveTeam({name:q.dataset.quick,status:'ready'},`เพิ่มทีม ${q.dataset.quick} แล้ว`);return}
});
$('#add-team').addEventListener('click',()=>openForm(null));
$('#hqp').addEventListener('submit',async e=>{e.preventDefault();try{const r=await apiPost({action:'hq_phone',phone:$('#hq-phone').value});if(r.ok){T.hqPhone=r.hqPhone;toast('บันทึกเบอร์ศูนย์แล้ว',true)}}catch(err){}});

/* ลิงก์เฉพาะทีม: ทีมเปิดบนมือถือได้ทันที ไม่ต้องใช้รหัสกลาง · เปลี่ยนลิงก์ได้ถ้าหลุด */
const QR_SRI='sha384-3zSEDfvllQohrq0PHL1fOXJuC/jSOO34H46t6UQfobFOmxE5BpjjaIJY5F2/bMnU';
const teamUrl=t=>location.origin+'/team/?id='+encodeURIComponent(t.token||'');
let qrP=null;
function loadQR(){if(window.QRCode)return Promise.resolve();return qrP||(qrP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';s.integrity=QR_SRI;s.crossOrigin='anonymous';s.onload=res;s.onerror=()=>{qrP=null;rej()};document.head.append(s)}))}
function linkSheet(t){if(!t)return;const url=teamUrl(t),p=tel(t.phone),msg=`Helpme+ หน้าทีม ${t.name}: ${url}\nเปิดแล้วกด "เปิดตำแหน่ง" · เปิดหน้านี้ค้างไว้ระหว่างออกงาน`;
  const sms=`sms:${p}${/iPhone|iPad|Mac/.test(navigator.userAgent)?'&':'?'}body=${encodeURIComponent(msg)}`;
  const d=$('#drawer');d.innerHTML=`<div class="d-head"><div><h2><i data-ic="link"></i> ลิงก์ทีม ${esc(t.name)}</h2><p class="muted small">ลิงก์นี้ใช้แทนรหัส · ส่งให้ทีมนี้เท่านั้น</p></div><button class="x" id="d-close" aria-label="ปิด"><i data-ic="close"></i></button></div>
    <div class="link-sheet"><div class="qr" id="qr" aria-label="QR โค้ดลิงก์ทีม"></div>
      <input class="tc-link" readonly value="${esc(url)}" aria-label="ลิงก์ทีม" onclick="this.select()">
      <div class="tc-acts"><button class="btn primary" type="button" id="l-copy"><i data-ic="copy"></i> คัดลอก</button>${p.length>=9?`<a class="btn ghost" href="${esc(sms)}"><i data-ic="chat"></i> ส่ง SMS</a>`:''}<a class="btn ghost" href="https://line.me/R/share?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">ส่ง LINE</a><a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">เปิดดู ↗</a></div>
      <p class="muted small">ติดตามได้แม้ทีมปิดหน้าเว็บ: ให้ทีมเปิดลิงก์นี้ → ตั้งค่า → "ให้ศูนย์ติดตามได้แม้ปิดหน้านี้" แล้วติดตั้งแอปฟรี Traccar Client ตามขั้นตอน</p>
      <p class="muted small">ลิงก์หลุดหรือคนออกจากทีม: สร้างลิงก์ใหม่ ลิงก์เดิมจะใช้ไม่ได้ทันที (แอปติดตามต้องใส่รหัสใหม่ด้วย)</p>
      <button class="btn ghost" type="button" id="l-new"><i data-ic="refresh"></i> สร้างลิงก์ใหม่</button></div>`;
  d.hidden=false;$('#drawer-bg').hidden=false;$('#d-close').onclick=closeForm;$('#drawer-bg').onclick=closeForm;
  loadQR().then(()=>{const q=$('#qr');if(q){q.innerHTML='';new QRCode(q,{text:url,width:220,height:220,correctLevel:QRCode.CorrectLevel.M})}}).catch(()=>{const q=$('#qr');if(q)q.hidden=true});
  $('#l-copy').onclick=async e=>{try{await navigator.clipboard.writeText(url);toast('คัดลอกลิงก์แล้ว',true)}catch(err){d.querySelector('.tc-link').select()}};
  $('#l-new').onclick=async()=>{if(!confirm(`สร้างลิงก์ใหม่ให้ ${t.name}? ลิงก์เดิมจะใช้ไม่ได้`))return;try{const r=await apiPost({action:'team_link',id:t.id});if(r.ok){t.token=r.token;toast('สร้างลิงก์ใหม่แล้ว · ส่งให้ทีมอีกครั้ง',true);linkSheet(t)}else toast('สร้างไม่สำเร็จ')}catch(err){}}}

/* แผ่นติดต่อทีมจากคิวเคส: โทร / SMS พร้อมรายละเอียดเคส / วิดีโอคอล */
function callSheet(t,c){const txt=TEAMCALL.caseText(c),p=tel(t.phone);
  const d=$('#drawer');d.innerHTML=`<div class="d-head"><div><h2><i data-ic="phone"></i> ติดต่อ ${esc(t.name)}</h2><p class="muted small">${[t.leader?'หัวหน้าทีม '+t.leader:'',p.length>=9?p:'ยังไม่มีเบอร์ (แก้ไขทีมเพื่อใส่เบอร์)',t.vehicle?VEH[t.vehicle]:''].filter(Boolean).map(esc).join(' · ')}</p></div><button class="x" id="d-close" aria-label="ปิด"><i data-ic="close"></i></button></div>
    <div class="call-sheet"><p class="muted small">ข้อความที่จะส่ง</p><div class="call-msg">${esc(txt)}</div>${TEAMCALL.buttons(t,{caseText:txt})}</div>`;
  d.hidden=false;$('#drawer-bg').hidden=false;$('#d-close').onclick=closeForm;$('#drawer-bg').onclick=closeForm}

/* ---------- ฟอร์มเพิ่ม/แก้ไขทีม ---------- */
function openForm(t){t=t||{status:'ready'};const d=$('#drawer');
  d.innerHTML=`<div class="d-head"><div><h2>${t.id?'แก้ไขทีม':'เพิ่มทีมใหม่'}</h2></div><button class="x" id="d-close" aria-label="ปิด"><i data-ic="close"></i></button></div>
  <form id="tform" class="form-grid">
    <label class="fld"><span>ชื่อทีม *</span><input name="name" required maxlength="60" value="${esc(t.name)}"></label>
    <label class="fld"><span>หัวหน้าทีม</span><input name="leader" maxlength="60" value="${esc(t.leader)}"></label>
    <label class="fld"><span>เบอร์โทรหัวหน้าทีม</span><input name="phone" type="tel" inputmode="tel" maxlength="20" value="${esc(tname(t.phone))}"></label>
    <label class="fld"><span>จำนวนคนในทีม</span><input name="members" type="number" min="0" max="999" inputmode="numeric" value="${esc(t.members)}"></label>
    <label class="fld"><span>พาหนะ</span><select name="vehicle"><option value="">ไม่ระบุ</option>${Object.entries(VEH).map(([k,v])=>`<option value="${k}" ${t.vehicle===k?'selected':''}>${v}</option>`).join('')}</select></label>
    <label class="fld"><span>พื้นที่รับผิดชอบ</span><input name="zone" maxlength="80" placeholder="เช่น บึงกุ่ม, ลาดพร้าว" value="${esc(t.zone)}"></label>
    <label class="fld"><span>สถานะ</span><select name="status">${Object.entries(TST).map(([k,v])=>`<option value="${k}" ${t.status===k?'selected':''}>${v}</option>`).join('')}</select></label>
    <label class="fld"><span>หมายเหตุ</span><input name="note" maxlength="300" value="${esc(t.note)}"></label>
    <div class="fld wide trk-auto"><span>ลิงก์ติดตามตำแหน่งสด (สร้างอัตโนมัติ)</span>${t.view?`<div class="trk-auto-row"><input readonly value="${esc(location.origin+'/live/?v='+t.view)}" onclick="this.select()" aria-label="ลิงก์ติดตามตำแหน่งสดของทีม"><button type="button" class="btn ghost sm" data-copylive="${esc(location.origin+'/live/?v='+t.view)}">คัดลอก</button><a class="btn ghost sm" href="${esc('/live/?v='+t.view)}" target="_blank" rel="noopener">เปิด ↗</a></div><small class="muted">ส่งให้ใครก็ได้ เปิดดูตำแหน่งสดและเส้นทางของทีมได้ทันที ไม่ต้องเข้าระบบ · ตำแหน่งมาจากหน้าทีม/แอปติดตาม</small>`:'<small class="muted">ลิงก์จะขึ้นหลังบันทึกทีมครั้งแรก</small>'}</div>
    <details class="fld wide"><summary class="muted small">ลิงก์ตำแหน่งสดจาก Google Maps (ไม่บังคับ · ถ้าทีมแชร์จากแอป Google Maps)</summary><input name="gmaps" inputmode="url" maxlength="300" placeholder="https://maps.app.goo.gl/…" value="${esc(t.gmaps||'')}"></details>
    <div class="form-act"><button class="btn primary" type="submit">บันทึก</button>${t.id?'<button class="btn ghost" type="button" id="t-off">ปิดทีมนี้</button>':''}</div>
  </form>`;
  d.hidden=false;$('#drawer-bg').hidden=false;
  $('#d-close').onclick=closeForm;$('#drawer-bg').onclick=closeForm;
  $('#tform').onsubmit=async e=>{e.preventDefault();const fd=Object.fromEntries(new FormData(e.target));if(!fd.name.trim())return;
    const gm=String(fd.gmaps||'').trim();delete fd.gmaps;
    if(gm&&!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.(com|co\.th)\/maps|maps\.google\.)/.test((gm.match(/https:\/\/\S+/)||[''])[0])){toast('ลิงก์ต้องเป็นลิงก์แชร์จาก Google Maps เช่น https://maps.app.goo.gl/…');return}
    if(await saveTeam({...t,...fd,id:t.id||''})){if(gm!==(t.gmaps||''))await apiPost({action:'team_gmaps',team:fd.name.trim(),gmaps:gm}).catch(()=>{});closeForm();loadAll()}};
  const off=$('#t-off');if(off)off.onclick=async()=>{if(await saveTeam({...t,active:false},`ปิดทีม ${t.name} แล้ว`))closeForm()};
  setTimeout(()=>d.querySelector('input').focus(),50)}
function closeForm(){$('#drawer').hidden=true;$('#drawer-bg').hidden=true}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeForm()});

adminBoot({action:'roster'},'roster',r=>{T.roster=r.roster||[];T.live=r.live||[];T.hqPhone=r.hqPhone||'';if(typeof TRACK!=='undefined')TRACK.init($('#trk-map')).then(liveUI);render();loadAll();if(typeof VERIFY!=='undefined')VERIFY.load().then(render,()=>{});if(typeof COVERED!=='undefined')COVERED.load(API_URL,ADM.key).then(render,()=>{})});
if(typeof VERIFY!=='undefined')VERIFY.onUpdate=()=>render();

document.addEventListener('click',async e=>{const b=e.target.closest('[data-copylive]');if(!b)return;try{await navigator.clipboard.writeText(b.dataset.copylive);toast('คัดลอกลิงก์ติดตามแล้ว',true)}catch(err){b.previousElementSibling.select()}});
