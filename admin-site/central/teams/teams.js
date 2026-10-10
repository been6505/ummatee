const T={roster:[],live:[],cases:[],filter:/^(busy|ready|out|rest|live|sos)$/.test(new URLSearchParams(location.search).get('f')||'')?new URLSearchParams(location.search).get('f'):'all',loaded:0,hqPhone:''};
const TST={ready:'พร้อม',out:'ทีมกำลังไป',rest:'พัก'};
const VEH={boat:'เรือ',truck:'รถสูง / รถบรรทุก',pickup:'รถกระบะ',car:'รถเก๋ง / รถตู้',motorbike:'มอเตอร์ไซค์',foot:'เดินเท้า',other:'อื่น ๆ'};
const URG={3:'วิกฤต',2:'เร่งด่วน',1:'ทั่วไป'};
const LEVEL={ankle:'ข้อเท้า',knee:'เข่า',waist:'เอว',chest:'อก',roof:'มิดหัว'};
const sev=c=>typeof VERIFY!=='undefined'&&VERIFY.level?VERIFY.level(c):Math.min(3,Math.max(1,Number(c.urgency)||1));
const hasPin=c=>c&&c.lat!==''&&c.lat!=null&&c.lng!==''&&c.lng!=null&&isFinite(+c.lat)&&isFinite(+c.lng);
const km=(a,b,c,d)=>{const R=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,h=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const tname=s=>String(s||'').replace(/^'/,'').trim();
const tel=p=>String(p||'').replace(/^'/,'').replace(/[^\d+]/g,'');

async function loadAll(){T.loadedAt=Date.now();
  $('#sync').textContent='กำลังโหลด…';
  try{const [r,c,h]=await Promise.all([apiGet({action:'roster'}),apiGet({action:'list'}),apiGet({action:'helpme_cases'}).catch(()=>null)]);
    if(r&&r.ok){T.roster=r.roster||[];T.live=r.live||[];T.hqPhone=r.hqPhone||''}
    if(c&&c.ok)T.cases=(c.cases||[]).map(x=>({...x,needs:Array.isArray(x.needs)?x.needs:String(x.needs||'').split(/\s*,\s*/).filter(Boolean)}));
    if(h&&h.ok){const own=new Set(T.cases.map(x=>String(x.id)));T.hm=(h.cases||[]).filter(x=>!own.has(String(x.id))&&!x.dupOf).map(x=>({...x,_hm:true,needs:Array.isArray(x.needs)?x.needs:String(x.needs||'').split(/\s*,\s*/).filter(Boolean)}))}
    T.loaded=Date.now();render()}
  catch(e){$('#sync').textContent='โหลดไม่สำเร็จ'}}
$('#refresh').addEventListener('click',loadAll);
setInterval(()=>{if(ADM.key&&!document.hidden&&(!(typeof LIVE!=='undefined'&&LIVE.ok())||Date.now()-(T.loadedAt||0)>300000))loadAll()},15000);document.addEventListener('visibilitychange',()=>{if(ADM.key&&!document.hidden)loadAll()});
let liveBusy=false;setInterval(async()=>{if(!ADM.key||document.hidden||!T.loaded||liveBusy||(typeof LIVE!=='undefined'&&LIVE.ok()))return;liveBusy=true;try{const r=await apiGet({action:'teams'});if(r&&r.ok){T.live=r.teams||[];liveUI()}}catch(e){}finally{liveBusy=false}},2000);
function tcBox(t,g,d){const eta=typeof TRACK!=='undefined'&&TRACK.eta?TRACK.eta(t.name):null,ord=eta?[...g.filter(c=>String(c.id)===String(eta.caseId)),...g.filter(c=>String(c.id)!==String(eta.caseId))]:g;
  const card=(c,i)=>{const id=String(c.id),go=eta&&String(eta.caseId)===id,ph=tel(c.phone),rep=!!c.teamDoneAt;
    return `<div class="tc u${sev(c)}${go?' go':''}${rep?' rep':''}"><div class="tc-h"><small class="tc-tag">${i===0?'ตอนนี้':i===1?'ถัดไป':'ลำดับ '+(i+1)}</small><span class="urg urg-${sev(c)}">${URG[sev(c)]}</span><a class="tc-id" href="../../central.html#${encodeURIComponent(id)}" title="เปิดรายละเอียดเคส">#${esc(id.length>8?id.split('-').pop():id)} ↗</a></div>
      <b>${esc((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')} · ${esc(c.people||1)} คน</b>
      <small class="tc-ad">${esc([c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ')||'ไม่ระบุที่อยู่')}</small>
      ${c.name||ph?`<small>${esc(c.name||'')}${ph.length>=9?` · <a href="tel:${esc(ph)}">${esc(ph)}</a>`:''}</small>`:''}
      ${go?`<em class="tc-eta">${eta.km.toFixed(1)} กม.${eta.min!=null?` · ~${Math.max(1,Math.round(eta.min))} นาที`:''}${eta.plan?' · ศูนย์กำหนดเส้นทาง':''}</em>`:''}
      ${rep?`<small class="tc-ok">ทีมแจ้งช่วยแล้ว ${esc(ago(c.teamDoneAt))} · รอปิดเคส</small>`:c.teamIssue?`<small class="tc-bad">แจ้งปัญหา: ${esc(c.teamIssue)}</small>`:''}
      ${c.teamMemo?`<small class="tc-memo">หมายเหตุทีม: ${esc(c.teamMemo)}</small>`:''}
      <div class="tc-f"><small class="muted">${c.pickedAt?'มอบ '+esc(ago(c.pickedAt)):''}</small><button class="linkish" data-done="${esc(id)}"><i data-ic="check"></i> ช่วยแล้ว</button></div></div>`};
  return `<div class="tcbox"><div class="tcbox-h"><b>เคสของทีม</b><small class="muted">กำลังไป ${g.length} · ช่วยแล้ว ${d.length}</small></div>${ord.length?`<div class="tc-row">${ord.map(card).join('')}</div>${ord.length>2?`<small class="ts-more">เลื่อนดูอีก ${ord.length-2} เคส →</small>`:''}`:'<p class="muted small">ไม่มีเคสที่กำลังไป</p>'}</div>`}
function side(){const el=$('#trk-side');if(!el||el.querySelector('.ptt-press'))return;const now=Date.now();
  const sig=a=>a==null?[0,'ไม่มีตำแหน่ง','off']:a<90e3?[4,'ดีมาก','on']:a<5*60e3?[3,'ดี','on']:a<15*60e3?[2,'อ่อน','idle']:a<30*60e3?[1,'อ่อนมาก','idle']:[0,'ขาดการติดต่อ','off'];
  const dir=TK.dir;
  const rows=T.roster.map(t=>{const l=liveOf(t.name),age=l?now-Number(l.updatedAt):null,cs=teamCases(t.name).filter(c=>c.status==='going'&&!c.teamDoneAt),sos=sosOn(t);return {t,l,age,cs,sos}})
    .sort((a,b)=>(b.sos-a.sos)||((b.cs.length>0)-(a.cs.length>0))||((a.age??9e15)-(b.age??9e15)));
  const on=rows.filter(r=>r.age!=null&&r.age<30*60e3).length;
  const NET=TK.NET;
  el.innerHTML=`<div class="ts-h"><b>สถานะทีมสด</b><small>ออนไลน์ ${on}/${rows.length}${typeof LIVE!=='undefined'&&LIVE.ok()?' · <span class="ts-live">● สด</span>':''}</small></div><div class="ts-list">${rows.map(({t,l,age,cs,sos})=>{
    const fresh=sig(age),realSig=l&&l.sig!=null&&age!=null&&age<15*60e3,bars=realSig?Math.max(0,Math.min(4,+l.sig)):fresh[0],eta=TRACK.eta?TRACK.eta(t.name):null,bat=l&&l.battery!=null?+l.battery:null,sp=l&&l.speed!=null?Math.round(+l.speed):null;
    const net=l&&l.net?(NET[l.net]||String(l.net).toUpperCase()):'',alt=l&&l.alt!=null?Math.round(+l.alt):null;
    return `<button type="button" class="ts ${sos?'sos':''}" data-tsel="${esc(t.name)}"><div class="ts-1"><span class="ts-dot ${fresh[2]}"></span><b>${esc(t.name)}</b><small class="ts-age" data-age="${l?Number(l.updatedAt):''}">${age!=null?(age<60e3?Math.round(age/1000)+' วิ':Math.round(age/60e3)+' นาที'):'–'}</small>${sos?'<span class="ts-sos">SOS</span>':`<span class="ts-st ${esc(t.status||'ready')}">${esc(TST[t.status]||'พร้อม')}</span>`}</div>
      <div class="ts-g">
        <span title="${realSig?'สัญญาณมือถือ (จากเครื่อง)':'ประมาณจากความสดของตำแหน่ง'}"><i class="ts-sig b${bars}"><i></i><i></i><i></i><i></i></i>${realSig?['ไม่มี','อ่อนมาก','อ่อน','ดี','ดีมาก'][bars]:fresh[1]}${net?' · '+esc(net):''}${l&&l.carrier?' · '+esc(l.carrier):''}</span>
        <span title="แบตเตอรี่" class="${bat!=null&&bat<=20&&!(l&&l.charging)?'low':''}"><i class="ts-bat${l&&l.charging?' chg':''}"><i style="width:${bat??0}%"></i></i>${bat!=null?bat+'%':'–'}${l&&l.charging?' · ชาร์จ':''}</span>
        <span title="ความเร็ว · ทิศ"><i data-ic="nav" style="transform:rotate(${l&&l.heading!=null?+l.heading:0}deg)"></i>${sp!=null?sp+' กม./ชม.':'–'}${sp>=3&&l.heading!=null?' · '+dir(l.heading):sp!=null&&sp<3?' · จอดอยู่':''}</span>
        <span title="ความสูงจากระดับน้ำทะเล (GPS) · ความแม่นยำ"><i data-ic="mountain"></i>${alt!=null?alt+' ม.':'–'}${l&&l.accuracy?` · ±${Math.round(l.accuracy)} ม.`:''}</span>
        <span title="อุณหภูมิ ณ จุดทีม (สถานีอากาศ)"><i data-ic="sun"></i>${l&&l.temp!=null?(+l.temp).toFixed(1)+'°C':'–'}</span>
        <span title="ความชื้นสัมพัทธ์ ณ จุดทีม (สถานีอากาศ)"><i data-ic="drop"></i>${l&&l.hum!=null?Math.round(+l.hum)+'%':'–'}</span>
      </div>
      ${cs.length?(()=>{const ord=eta?[...cs.filter(c=>String(c.id)===String(eta.caseId)),...cs.filter(c=>String(c.id)!==String(eta.caseId))]:cs;return `<div class="ts-cases" data-n="${ord.length}">${ord.map((c,i)=>{const id=String(c.id),sh=id.length>8?id.split('-').pop():id,lv=c.sevSet||c.urgency||1,go=eta&&String(eta.caseId)===id;return `<div class="ts-cc u${esc(lv)}${go?' go':''}" title="เคส #${esc(id)}"><small class="ts-tag">${i===0?'ตอนนี้':i===1?'ถัดไป':'ลำดับ '+(i+1)}</small><b><i data-ic="flag"></i>#${esc(sh)}</b><span>${esc((c.needs||[]).slice(0,2).join(', ')||'เคส')}</span>${go?`<em>${eta.km.toFixed(1)} กม.${eta.min!=null?` · ~${Math.max(1,Math.round(eta.min))} น.`:''}</em>${eta.plan?'<small>ศูนย์กำหนด</small>':''}`:''}</div>`}).join('')}</div>${ord.length>2?`<small class="ts-more">เลื่อนดูอีก ${ord.length-2} เคส →</small>`:''}`})():''}
      ${t.vehicle||t.members||typeof PTT!=='undefined'?`<small class="ts-x">${esc([VEH[t.vehicle]||'',t.members?t.members+' คน':'',t.phone?tel(t.phone):''].filter(Boolean).join(' · '))}</small>`:''}${typeof PTT!=='undefined'?`<span class="ts-ptt" role="button" tabindex="0" data-ptt="${esc(t.name)}" title="วอ ถึง ${esc(t.name)} · กดค้างเพื่อพูด" aria-label="วอ ถึง ${esc(t.name)}"><i data-ic="mic"></i></span>`:''}</button>`}).join('')||'<p class="muted small">ยังไม่มีทีม</p>'}</div>`;
  if(typeof PTT!=='undefined')el.querySelectorAll('.ts-ptt').forEach(b=>{const n=b.dataset.ptt;PTT.bind(b,{ch:()=>'tm:'+n,tap:()=>{if(typeof toast==='function')toast('กดค้างไว้เพื่อพูดกับทีม '+n)}})})}
setInterval(()=>{if(document.hidden)return;const now=Date.now();document.querySelectorAll('#trk-side .ts-age[data-age]').forEach(x=>{const t=+x.dataset.age;if(!t)return;const a=now-t;x.textContent=a<60e3?Math.round(a/1000)+' วิ':Math.round(a/60e3)+' นาที'})},1000);
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#trk-side [data-tsel]');if(!b||e.target.closest('.ts-ptt'))return;const n=b.dataset.tsel;if(typeof TRACK!=='undefined'){TRACK.focus(n);const eta=TRACK.eta&&TRACK.eta(n);if(eta&&e.target.closest('.ts-cc')&&TRACK.edit)TRACK.edit(n)}});
setInterval(()=>{if(T.loaded&&!document.hidden)side()},5000);
setInterval(()=>{if(T.loaded&&!document.hidden&&typeof TRACK!=='undefined'&&TRACK.routes)TRACK.routes(T.live,allCases())},5000);
if(typeof LIVE!=='undefined')LIVE.start(rows=>{if(!T.loaded)return;T.live=mergeLive(T.live,rows);liveUI()});
function liveUI(){if(typeof TRACK!=='undefined'){TRACK.update(T.live,T.roster);if(TRACK.routes)TRACK.routes(T.live,allCases())}side();
  $$('[data-live-of]').forEach(el=>{const t=T.roster.find(x=>String(x.id)===el.dataset.liveOf);if(t)el.outerHTML=liveTag(t)})}
function liveTag(t){const lv=liveOf(t.name),id=esc(t.id);
  if(!lv)return `<span class="lv lv-none" data-live-of="${id}">${t.status==='out'?'<i data-ic="alert"></i> ไม่แชร์ตำแหน่ง':'ไม่แชร์ตำแหน่ง'}</span>`;
  const m=(Date.now()-lv.updatedAt)/60000,k=m<5?'on':m<30?'idle':'old',lost=t.status==='out'&&m>=10;
  return `<span class="lv lv-${lost?'lost':k}" data-live-of="${id}">● ${lost?'ขาดการติดต่อ ':''}${esc(ago(lv.updatedAt))}${lv.battery!=null?` · แบต ${lv.battery}%`:''}${lv.speed!=null&&lv.speed>=1?` · ${Math.round(lv.speed)} กม./ชม.`:''}</span>`}
const sosOn=t=>t&&t.sosAt&&(!t.sosAck||t.sosAck<t.sosAt);

const allCases=()=>T.cases.concat((T.hm||[]).filter(c=>c.status==='going'));
function teamCases(name){const n=tname(name);return allCases().filter(c=>tname(c.volunteer)===n)}
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
  $('#stats').innerHTML=[['ทีมทั้งหมด',R.length,'','all'],['พร้อมออกเคส',cnt('ready'),'done','ready'],['ทีมกำลังไป',cnt('out'),'go','out'],['ถือเคสอยู่',R.filter(t=>teamCases(t.name).some(c=>c.status==='going')).length,'go','busy'],['แชร์ตำแหน่ง',sharing,'go','live'],['อาสาทั้งหมด',people||'–','','people'],['เคสรอจัดทีม',queue.length,'red','queue'],['SOS',sos.length,sos.length?'red':'','sos']]
    .map(([t,v,k,f])=>`<button type="button" class="stat ${k}" data-sf="${f}" aria-pressed="${T.sf===f}"><b>${esc(v)}</b><span>${t}</span></button>`).join('');
  $('#sos-list').innerHTML=sos.map(t=>{const lv=liveOf(t.name),p=tel(t.phone);return `<div class="sos-card" role="alert"><b><i data-ic="alert"></i> SOS · ${esc(t.name)}</b><span>${esc(ago(t.sosAt))}${lv?' · ตำแหน่ง '+esc(ago(lv.updatedAt)):''}</span>
    <span class="sos-acts">${lv?`<button class="btn sm" data-track="${esc(t.name)}"><i data-ic="pin"></i> ดูตำแหน่ง</button>`:''}${p.length>=9?`<a class="btn sm" href="tel:${esc(p)}"><i data-ic="phone"></i> โทร</a>`:''}<button class="btn sm" data-tchat="${esc(t.name)}"><i data-ic="chat"></i> แชท</button><button class="btn sm primary" data-sosack="${esc(t.id)}">รับทราบ</button></span></div>`}).join('');
  if(document.activeElement!==$('#hq-phone'))$('#hq-phone').value=tname(T.hqPhone);
  liveUI();
  const list=R.filter(t=>T.filter==='all'||(T.filter==='live'?(()=>{const l=liveOf(t.name);return l&&Date.now()-l.updatedAt<30*60e3})():T.filter==='sos'?sosOn(t):T.filter==='busy'?teamCases(t.name).some(c=>c.status==='going'):T.filter==='one'?tname(t.name)===tname(T.one):t.status===T.filter)).sort((a,b)=>({ready:0,out:1,rest:2}[a.status]??3)-({ready:0,out:1,rest:2}[b.status]??3)||String(a.name).localeCompare(String(b.name),'th'));
  const el=$('#team-list');
  if(!R.length)el.innerHTML='<p class="empty">ยังไม่มีทีม กด "+ เพิ่มทีม" เพื่อเริ่ม<br><small>ทีมที่เคยรับเคสจะขึ้นด้านล่างให้เพิ่มได้ในคลิกเดียว</small></p>';
  else el.innerHTML=list.map(t=>{const cs=teamCases(t.name),g=cs.filter(c=>c.status==='going'),d=cs.filter(c=>c.status==='done'),lv=liveOf(t.name),p=tel(t.phone);
    return `<article class="team st-${esc(t.status)}${sosOn(t)?' sos':''} tw2" data-team-id="${esc(t.id)}"><div class="team-main"><div class="team-h"><div><b>${esc(t.name)}</b><small>${[t.vehicle?VEH[t.vehicle]:'',t.members?t.members+' คน':'',t.zone?'พื้นที่ '+t.zone:''].filter(Boolean).map(esc).join(' · ')||'ยังไม่ระบุรายละเอียด'}</small></div>
      <select class="tst tst-${esc(t.status)}" data-tst="${esc(t.id)}" aria-label="สถานะทีม ${esc(t.name)}">${Object.entries(TST).map(([k,v])=>`<option value="${k}" ${t.status===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="team-m">${t.leader?`หัวหน้าทีม ${esc(t.leader)} `:''}${p.length>=9?`<a href="tel:${esc(p)}">${esc(tname(t.phone))}</a>`:''}${liveTag(t)}${lv?`<button class="linkish" data-track="${esc(t.name)}"><i data-ic="pin"></i> ติดตาม</button>`:''}${t.view?`<a class="linkish" href="${esc('/live/?v='+t.view)}" target="_blank" rel="noopener" title="ลิงก์ติดตามตำแหน่งสด (ส่งต่อได้)"><i data-ic="live"></i> ลิงก์ติดตาม ↗</a>`:''}${/^https:\/\//.test(t.gmaps||'')?`<a class="linkish gm" href="${esc(t.gmaps)}" target="_blank" rel="noopener" title="ตำแหน่งสดที่ทีมแชร์จาก Google Maps (ส่งต่อแม้ล็อกจอ)"><i data-ic="live"></i> ตำแหน่งสด Google Maps ↗</a>`:''}</div>
      ${typeof TEAMCALL!=='undefined'?TEAMCALL.buttons(t,{caseText:g[0]?TEAMCALL.caseText(g[0]):''}):''}
      <div class="team-f"><span class="muted small">ช่วยแล้ว ${d.length} เคส${t.note?' · '+esc(t.note):''}</span><span><button class="btn ghost sm" data-tlink="${esc(t.id)}"><i data-ic="link"></i> ลิงก์ทีม</button> <button class="btn ghost sm" data-edit="${esc(t.id)}">แก้ไข</button></span></div></div>${tcBox(t,g,d)}</article>`}).join('')||'<p class="empty">ไม่มีทีมในสถานะนี้</p>';
  const known=new Set(R.map(t=>tname(t.name))),seen=[...new Set(T.cases.map(c=>tname(c.volunteer)).filter(Boolean))].filter(n=>!known.has(n));
  if(seen.length)el.insertAdjacentHTML('beforeend',`<div class="seen"><small class="muted">ทีมที่เคยรับเคสแต่ยังไม่อยู่ในรายชื่อ:</small> ${seen.map(n=>`<button class="chip" data-quick="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>`);
  const order=c=>{const v=typeof VERIFY!=='undefined'?VERIFY.assess(c).score:0;return sev(c)*100+v};
  const q=queue.slice().sort((a,b)=>order(b)-order(a)||(Number(a.createdAt)-Number(b.createdAt)));
  $('#q-count').textContent=q.length?q.length+' เคส':'';
  $('#queue').innerHTML=q.length?q.slice(0,60).map(c=>{const sg=suggest(c),best=sg[0],vr=typeof VERIFY!=='undefined'?VERIFY.assess(c):null;
    return `<article class="qcase u${sev(c)}"><div class="q-h"><span class="urg urg-${sev(c)}">${URG[sev(c)]}</span>${vr&&vr.result.k!=='nopin'?`<span class="vr vr-${vr.result.k}">${esc(vr.result.t)}</span>`:''}${(()=>{const m=typeof COVERED!=='undefined'?COVERED.match(c):null;return m?`<span class="cov" title="${esc(m.best.r.area+' · '+m.best.how)}"><i data-ic="hand"></i> ${esc(m.best.r.org)} เคยมอบใกล้เคียง</span>`:''})()}<small class="muted">${esc(ago(c.createdAt))} · #${esc(c.id)}</small></div>
      <b>${esc((c.needs||[]).join(' · ')||'ขอความช่วยเหลือ')}</b><div class="small">${esc(c.people||1)} คน${c.level?' · น้ำ'+esc(LEVEL[c.level]||''):''} · ${esc([c.address,c.district?'เขต'+c.district:''].filter(Boolean).join(' · ')||'ไม่ระบุที่อยู่')}</div>
      ${R.length?`<div class="assign"><select data-pick="${esc(c.id)}" aria-label="เลือกทีมสำหรับเคส ${esc(c.id)}">${sg.map((x,i)=>`<option value="${esc(x.t.name)}">${i===0?'แนะนำ: ':''}${esc(x.t.name)} (${esc(x.why)})</option>`).join('')}</select><button class="btn primary sm" data-assign="${esc(c.id)}">มอบหมาย</button><button class="btn ghost sm" data-callpick="${esc(c.id)}" title="โทร / SMS / วิดีโอคอล ทีมที่เลือก"><i data-ic="phone"></i> ติดต่อทีม</button></div>`:'<p class="muted small">เพิ่มทีมก่อนจึงจะมอบหมายได้</p>'}
    </article>`}).join(''):'<p class="empty">ไม่มีเคสรอจัดทีม <i data-ic="check"></i></p>';
}

async function saveTeam(t,msg){try{const r=await apiPost({action:'roster_save',team:t,by:staffName()});
  if(!r.ok){toast(r.error==='duplicate_name'?'มีทีมชื่อนี้อยู่แล้ว':'บันทึกไม่สำเร็จ: '+(r.error||''));return false}toast(msg||'บันทึกทีมแล้ว',true);await loadAll();return true}catch(e){if(e.message!=='auth')toast('บันทึกไม่สำเร็จ ลองใหม่');return false}}
async function updateCase(c,status,team){const prev={status:c.status,volunteer:c.volunteer};c.status=status;if(team)c.volunteer=team;render();
  try{const r=await apiPost({action:'update',id:c.id,status,volunteer:team||c.volunteer||''});if(!r.ok)throw 0;toast(status==='going'?`มอบหมายเคส #${c.id} ให้ ${team} แล้ว`:`ปิดเคส #${c.id} แล้ว`,true)}
  catch(e){Object.assign(c,prev);render();if(e&&e.message==='auth')return;toast('บันทึกไม่สำเร็จ ลองใหม่')}}
document.addEventListener('change',e=>{const s=e.target.closest('[data-tst]');if(!s)return;const t=T.roster.find(x=>String(x.id)===s.dataset.tst);if(t)saveTeam({...t,status:s.value},`${t.name} → ${TST[s.value]}`)});
document.addEventListener('click',e=>{
  const sc=e.target.closest('#stats [data-sf]');if(sc){let k=sc.dataset.sf;if(T.sf===k&&k!=='all')k='all';T.sf=k==='all'?'':k;
    const tf=k==='people'?'all':k==='queue'?T.filter:k;
    if(k!=='queue'){T.filter=tf;$$('#team-filter [data-f]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.f===tf)))}
    render();const to=k==='queue'?$('#queue').closest('.panel'):$('#team-list').closest('.panel');
    if(to)to.scrollIntoView({behavior:'smooth',block:'start'});
    if(k==='sos'&&!$$('#team-list .team').length)toast('ไม่มีทีมที่ส่ง SOS');if(k==='live'&&!$$('#team-list .team').length)toast('ยังไม่มีทีมที่แชร์ตำแหน่ง');return}
  const f=e.target.closest('#team-filter [data-f]');if(f)T.sf='';if(f){T.filter=f.dataset.f;$$('#team-filter [data-f]').forEach(b=>b.setAttribute('aria-selected',String(b===f)));render();return}
  const a=e.target.closest('[data-assign]');if(a){const c=T.cases.find(x=>String(x.id)===a.dataset.assign),sel=document.querySelector(`[data-pick="${CSS.escape(a.dataset.assign)}"]`);if(c&&sel&&sel.value){updateCase(c,'going',sel.value);const t=T.roster.find(x=>x.name===sel.value);if(t&&t.status==='ready')saveTeam({...t,status:'out'},`${t.name} → ทีมกำลังไป`)}return}
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

const QR_SRI='sha384-3zSEDfvllQohrq0PHL1fOXJuC/jSOO34H46t6UQfobFOmxE5BpjjaIJY5F2/bMnU';
const teamUrl=t=>location.origin+'/team/?id='+encodeURIComponent(t.token||'');
const appUrl=t=>location.origin+'/app/?id='+encodeURIComponent(t.token||'');
let qrP=null;
function loadQR(){if(window.QRCode)return Promise.resolve();return qrP||(qrP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';s.integrity=QR_SRI;s.crossOrigin='anonymous';s.onload=res;s.onerror=()=>{qrP=null;rej()};document.head.append(s)}))}
function linkSheet(t){if(!t)return;const url=teamUrl(t),p=tel(t.phone),msg=`Helpme+ หน้าทีม ${t.name}: ${url}\nเปิดแล้วกด "เปิดตำแหน่ง" · เปิดหน้านี้ค้างไว้ระหว่างออกเคส\nดาวน์โหลดแอป Help Me ทีม: ${appUrl(t)}`;
  const sms=`sms:${p}${/iPhone|iPad|Mac/.test(navigator.userAgent)?'&':'?'}body=${encodeURIComponent(msg)}`;
  const d=$('#drawer');d.innerHTML=`<div class="d-head"><div><h2><i data-ic="link"></i> ลิงก์ทีม ${esc(t.name)}</h2><p class="muted small">ลิงก์นี้ใช้แทนรหัส · ส่งให้ทีมนี้เท่านั้น</p></div><button class="x" id="d-close" aria-label="ปิด"><i data-ic="close"></i></button></div>
    <div class="link-sheet"><div class="qr" id="qr" aria-label="QR โค้ดลิงก์ทีม"></div><p class="muted small" style="text-align:center;margin:0">สแกนด้วยกล้องมือถือ = ดาวน์โหลดแอป + เข้าทีม · สแกนในแอป = เข้าทีมทันที</p>
      <input class="tc-link" readonly value="${esc(url)}" aria-label="ลิงก์ทีม" onclick="this.select()">
      <div class="tc-acts"><button class="btn primary" type="button" id="l-copy"><i data-ic="copy"></i> คัดลอก</button>${p.length>=9?`<a class="btn ghost" href="${esc(sms)}"><i data-ic="chat"></i> ส่ง SMS</a>`:''}<a class="btn ghost" href="https://line.me/R/share?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">ส่ง LINE</a><a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">เปิดดู ↗</a></div>
      <p class="muted small">ติดตามได้แม้ทีมปิดหน้าเว็บ: ให้ทีมเปิดลิงก์นี้ → ตั้งค่า → "ให้ศูนย์ติดตามได้แม้ปิดหน้านี้" แล้วติดตั้งแอปฟรี Traccar Client ตามขั้นตอน</p>
      <p class="muted small">ลิงก์หลุดหรือคนออกจากทีม: สร้างลิงก์ใหม่ ลิงก์เดิมจะใช้ไม่ได้ทันที (แอปติดตามต้องใส่รหัสใหม่ด้วย)</p>
      <button class="btn ghost" type="button" id="l-new"><i data-ic="refresh"></i> สร้างลิงก์ใหม่</button></div>`;
  d.hidden=false;$('#drawer-bg').hidden=false;$('#d-close').onclick=closeForm;$('#drawer-bg').onclick=closeForm;
  loadQR().then(()=>{const q=$('#qr');if(q){q.innerHTML='';new QRCode(q,{text:appUrl(t),width:220,height:220,correctLevel:QRCode.CorrectLevel.M})}}).catch(()=>{const q=$('#qr');if(q)q.hidden=true});
  $('#l-copy').onclick=async e=>{try{await navigator.clipboard.writeText(url);toast('คัดลอกลิงก์แล้ว',true)}catch(err){d.querySelector('.tc-link').select()}};
  $('#l-new').onclick=async()=>{if(!confirm(`สร้างลิงก์ใหม่ให้ ${t.name}? ลิงก์เดิมจะใช้ไม่ได้`))return;try{const r=await apiPost({action:'team_link',id:t.id});if(r.ok){t.token=r.token;toast('สร้างลิงก์ใหม่แล้ว · ส่งให้ทีมอีกครั้ง',true);linkSheet(t)}else toast('สร้างไม่สำเร็จ')}catch(err){}}}

function callSheet(t,c){const txt=TEAMCALL.caseText(c),p=tel(t.phone);
  const d=$('#drawer');d.innerHTML=`<div class="d-head"><div><h2><i data-ic="phone"></i> ติดต่อ ${esc(t.name)}</h2><p class="muted small">${[t.leader?'หัวหน้าทีม '+t.leader:'',p.length>=9?p:'ยังไม่มีเบอร์ (แก้ไขทีมเพื่อใส่เบอร์)',t.vehicle?VEH[t.vehicle]:''].filter(Boolean).map(esc).join(' · ')}</p></div><button class="x" id="d-close" aria-label="ปิด"><i data-ic="close"></i></button></div>
    <div class="call-sheet"><p class="muted small">ข้อความที่จะส่ง</p><div class="call-msg">${esc(txt)}</div>${TEAMCALL.buttons(t,{caseText:txt})}</div>`;
  d.hidden=false;$('#drawer-bg').hidden=false;$('#d-close').onclick=closeForm;$('#drawer-bg').onclick=closeForm}

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

adminBoot({action:'roster'},'roster',r=>{setTimeout(()=>{if(typeof ROUTE!=='undefined')ROUTE.init();if(typeof RALLY!=='undefined'){RALLY.load();const q=new URLSearchParams(location.search).get('rally');if(q!==null){document.body.classList.add('rl-open');if(q&&q!=='open')setTimeout(()=>RALLY.start(q),1500)}}},500);T.roster=r.roster||[];T.live=r.live||[];T.hqPhone=r.hqPhone||'';if(typeof TRACK!=='undefined')TRACK.init($('#trk-map')).then(()=>{liveUI();if(typeof RALLY!=='undefined')RALLY.load()});render();loadAll();if(typeof VERIFY!=='undefined')VERIFY.load().then(render,()=>{});if(typeof COVERED!=='undefined')COVERED.load(API_URL,ADM.key).then(render,()=>{})});
if(typeof VERIFY!=='undefined')VERIFY.onUpdate=()=>render();

document.addEventListener('click',async e=>{const b=e.target.closest('[data-copylive]');if(!b)return;try{await navigator.clipboard.writeText(b.dataset.copylive);toast('คัดลอกลิงก์ติดตามแล้ว',true)}catch(err){b.previousElementSibling.select()}});
{const one=new URLSearchParams(location.search).get('team');if(one){T.one=one;T.filter='one'}}
if(T.filter!=='all'){T.sf=T.filter;$$('#team-filter [data-f]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.f===T.filter)));
  const go=()=>{const p=$('#team-list')&&$('#team-list').closest('.panel');if(p&&$$('#team-list .team').length)p.scrollIntoView({block:'start'});else if(!go.n||go.n++<20)setTimeout(go,500)};go.n=1;setTimeout(go,800)}

window.addEventListener('hm-rev',e=>{if(ADM.key&&T.loaded&&e.detail.what.includes('rev'))loadAll()});
