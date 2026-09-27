/* ============================================================
   UM+ — เชื่อมกับ Google Sheet ผ่าน Apps Script Web app
   ============================================================ */
const API_URL = 'https://script.google.com/macros/s/AKfycbyWeVDhToFJntjTGHprDEByEfRFdSbOidlR7QhJ6xG1bz7co2gCRkTGIoKDI9tJqGkWTw/exec';

const $ = s => document.querySelector(s);
let currentView='home', detailOrigin='map', selectedCase=null, geo=null;
let cases=[], isVolunteer=false, lastLoaded=0, loading=false;
const STATUS_TH={open:'รอความช่วยเหลือ',going:'ทีมกำลังไป',done:'ช่วยเหลือแล้ว'};
const STATUS_CLASS={open:'wait',going:'enroute',done:'done'};

/* ---------------- storage helpers ---------------- */
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}},set(k,v){try{v?localStorage.setItem(k,v):localStorage.removeItem(k)}catch(e){}}};

/* ---------------- API ---------------- */
async function apiPost(body){
  const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});
  return r.json();
}
async function apiCreate(data){
  const clientId=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  let last;
  for(let i=0;i<3;i++){
    try{return await apiPost({action:'create',clientId,...data})}
    catch(e){last=e;await new Promise(r=>setTimeout(r,1000*(i+1)))}
  }
  throw last;
}
async function apiList(){
  const k=store.get('uh_vol_key','');
  const r=await fetch(API_URL+'?action=list'+(k?'&key='+encodeURIComponent(k):'')+'&t='+Date.now());
  return r.json();
}
function apiUpdate(id,status,volunteer){
  return apiPost({action:'update',key:store.get('uh_vol_key',''),id,status,volunteer:volunteer||''});
}

/* ---------------- helpers ---------------- */
function ago(ts){
  if(!ts)return '';
  const m=Math.max(0,Math.round((Date.now()-ts)/60000));
  if(m<1)return 'เมื่อสักครู่';
  if(m<60)return m+' นาทีที่แล้ว';
  const h=Math.floor(m/60);if(h<24)return h+' ชั่วโมงที่แล้ว';
  return new Date(ts).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}
function hasPin(c){return c.lat!==''&&c.lat!=null&&c.lng!==''&&c.lng!=null&&!isNaN(+c.lat)}
function caseTitle(c){
  const needs=(c.needs||[]).join(' · ')||'ขอความช่วยเหลือ';
  return `${needs} · ${c.people||1} คน`;
}
function caseArea(c){return c.district?('เขต'+c.district):(c.address||'ไม่ระบุที่อยู่')}
function isSOS(c){return Number(c.urgency)===3&&c.status==='open'}
function statusLabel(c){return (isSOS(c)?'SOS · ':'')+STATUS_TH[c.status]}
function statusClass(c){return isSOS(c)?'':STATUS_CLASS[c.status]}

/* ---------------- views ---------------- */
function setView(view,record=true){
  if(!document.querySelector(`#view-${view}`))return;
  currentView=view;
  if(record&&location.hash!==`#${view}`)history.pushState(null,'',`#${view}`);
  document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));
  const navView=['request','summary'].includes(view)?'home':view==='detail'?'map':view;
  document.querySelectorAll('nav [data-view]').forEach(el=>{const active=el.dataset.view===navView;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
  if(view==='map'){renderMap();loadCases()}
  if(view==='home'){renderHomeStats();loadCases()}
  if(view==='request')ensureRequestMap();
  window.scrollTo({top:0,behavior:'instant'});
  $('#main').focus({preventScroll:true});
}

/* ---------------- cases list ---------------- */
function caseCard(c){
  const div=document.createElement('button');div.className='case-card case-simple';div.type='button';
  const top=document.createElement('div');top.className='case-top';
  const st=document.createElement('span');st.className='status '+statusClass(c);st.textContent=statusLabel(c);
  const t=document.createElement('span');t.className='case-id';t.textContent=ago(c.createdAt);
  top.append(st,t);
  const h=document.createElement('h3');h.textContent=(c.needs||[]).join(' · ')||'ขอความช่วยเหลือ';
  div.append(top,h);
  div.addEventListener('click',()=>openCase(c.id));
  return div;
}
function filteredCases(){
  const filter=$('#case-filter').value,st=$('#case-status').value;
  const rank={open:0,going:1,done:2};
  return cases
    .filter(c=>st==='all'?true:st==='active'?c.status!=='done':c.status===st)
    .filter(c=>filter==='all'||(c.needs||[]).join(' ').includes(filter))
    .sort((a,b)=>(rank[a.status]-rank[b.status])||(Number(b.urgency)-Number(a.urgency))||((a.createdAt||0)-(b.createdAt||0)));
}
function renderMap(){
  const matching=filteredCases();
  $('#case-count').textContent=loading&&!lastLoaded?'กำลังโหลด…':`${matching.length} เคส`;
  const el=$('#map-cases');el.replaceChildren(...matching.map(caseCard));
  if(!matching.length&&lastLoaded){const empty=document.createElement('div');empty.className='empty';empty.textContent=cases.length?'ไม่พบเคสที่ตรงกับการค้นหา':'ยังไม่มีเคสขอความช่วยเหลือ';el.append(empty)}
  renderVolunteerBar();
  drawCaseMarkers();
}
async function loadCases(){
  if(loading)return;loading=true;
  try{
    const r=await apiList();
    if(!r.ok)throw new Error(r.error||'error');
    cases=(r.cases||[]).map(c=>({...c,lat:c.lat===''?'':+c.lat,lng:c.lng===''?'':+c.lng}));
    isVolunteer=!!r.volunteer;lastLoaded=Date.now();
    $('#sync-status').textContent='อัปเดตล่าสุด '+new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
    if(selectedCase){selectedCase=cases.find(c=>c.id===selectedCase.id)||selectedCase;if(currentView==='detail')renderDetail()}
  }catch(e){
    $('#sync-status').textContent='โหลดข้อมูลไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต แล้วลองใหม่';
  }finally{loading=false;if(currentView==='map')renderMap();renderHomeStats()}
}
setInterval(()=>{if(['map','detail','home'].includes(currentView)&&!document.hidden)loadCases()},30000);

/* ---------------- home stats ---------------- */
function renderHomeStats(){
  const el=id=>document.getElementById(id);if(!el('st-total'))return;
  if(!lastLoaded)return;
  const n={open:0,going:0,done:0};let people=0;
  cases.forEach(c=>{n[c.status]=(n[c.status]||0)+1;people+=Number(c.people)||0});
  const f=x=>x.toLocaleString('th-TH');
  el('st-total').textContent=f(cases.length);el('st-open').textContent=f(n.open);el('st-going').textContent=f(n.going);el('st-done').textContent=f(n.done);el('st-people').textContent=f(people);
  el('stats-updated').textContent='อัปเดต '+new Date(lastLoaded).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
}

/* ---------------- volunteer mode ---------------- */
function renderVolunteerBar(){
  const bar=$('#volunteer-bar');bar.replaceChildren();
  if(isVolunteer){
    const s=document.createElement('span');s.className='vol-on';s.textContent='● โหมดอาสา · เห็นเบอร์และรับเคสได้';
    const out=document.createElement('button');out.type='button';out.className='text-button';out.textContent='ออกจากโหมดอาสา';
    out.onclick=()=>{store.set('uh_vol_key','');isVolunteer=false;loadCases()};
    bar.append(s,out);return;
  }
  const s=document.createElement('span');s.className='vol-note';s.textContent='ชื่อและเบอร์ถูกซ่อนเพื่อความเป็นส่วนตัว ทีมอาสาใส่รหัสเพื่อรับเคส';
  const inp=document.createElement('input');inp.type='password';inp.id='vol-key';inp.placeholder='รหัสอาสา';inp.setAttribute('aria-label','รหัสอาสา');inp.autocomplete='off';
  const btn=document.createElement('button');btn.type='button';btn.className='secondary-button';btn.textContent='เข้าโหมดอาสา';
  btn.onclick=async()=>{const k=inp.value.trim();if(!k){inp.focus();return}store.set('uh_vol_key',k);await loadCases();if(!isVolunteer){store.set('uh_vol_key','');$('#sync-status').textContent='รหัสอาสาไม่ถูกต้อง'}};
  bar.append(s,inp,btn);
}

function drawCaseMarkers(){}

/* ---------------- case detail ---------------- */
function openCase(id){selectedCase=cases.find(c=>c.id===id);if(!selectedCase)return;detailOrigin='map';renderDetail();setView('detail')}
function renderDetail(){
  const c=selectedCase,el=$('#detail-content');el.replaceChildren();
  const wrap=document.createElement('div');wrap.className='detail-shell';
  const head=document.createElement('div');head.className='detail-heading';
  const title=document.createElement('div');
  const status=document.createElement('span');status.className='status '+statusClass(c);status.textContent=statusLabel(c);
  const h=document.createElement('h1');h.id='detail-title';h.textContent=caseTitle(c);
  const muted=document.createElement('p');muted.className='case-meta';muted.textContent=`#${c.id} · แจ้งเมื่อ ${ago(c.createdAt)}`;
  title.append(status,h,muted);head.append(title);
  const card=document.createElement('div');card.className='detail-card';
  const facts=document.createElement('div');facts.className='detail-facts';
  const rows=[...(c.district?[['พื้นที่','เขต'+c.district]]:[]),['จำนวนคน',`${c.people||1} คน`],['ความต้องการ',(c.needs||[]).join(', ')||'-'],['ความเร่งด่วน',Number(c.urgency)===3?'ด่วนมาก · เสี่ยงต่อชีวิต':Number(c.urgency)===2?'ต้องการความช่วยเหลือเร็ว':'ทั่วไป']];
  if(c.address&&c.district)rows.push(['ที่อยู่ / จุดสังเกต',c.address]);
  if(c.name)rows.push(['ผู้ติดต่อ',c.name]);
  rows.push(['เบอร์โทร',c.phone||'-']);
  if(c.volunteer&&c.status!=='open')rows.push(['ทีมที่รับเคส',c.volunteer]);
  rows.forEach(([key,val])=>{const cell=document.createElement('div');cell.className='fact';const s=document.createElement('span');s.textContent=key;const st=document.createElement('strong');st.textContent=val;cell.append(s,st);facts.append(cell)});
  card.append(facts);
  if(c.address&&!c.district){const h2=document.createElement('h2');h2.textContent='ที่อยู่ / จุดสังเกต';const p=document.createElement('p');p.textContent=c.address;card.prepend(h2,p)}
  if(isVolunteer&&c.notes){const h2=document.createElement('h2');h2.textContent='สถานการณ์';const p=document.createElement('p');p.textContent=c.notes;card.append(h2,p)}
  const actions=document.createElement('div');actions.className='detail-actions';
  if(hasPin(c)){const a=document.createElement('a');a.className='secondary-button';a.textContent='นำทางด้วย Google Maps ↗';a.href=`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;a.target='_blank';a.rel='noopener';actions.append(a)}
  if(isVolunteer){
    const tel=String(c.phone||'').replace(/[^\d+]/g,'');
    if(tel){const call=document.createElement('a');call.className='secondary-button';call.href='tel:'+tel;call.textContent='☎ โทรหาผู้แจ้ง';actions.append(call)}
    if(c.status==='open'){
      const team=document.createElement('input');team.className='team-input';team.placeholder='ชื่อทีม / อาสา';team.value=store.get('uh_team','');team.setAttribute('aria-label','ชื่อทีม');
      const accept=document.createElement('button');accept.className='solid-button';accept.textContent='รับเคสนี้';
      accept.onclick=()=>{const t=team.value.trim();if(!t){team.focus();team.placeholder='ใส่ชื่อทีมก่อนรับเคส';return}store.set('uh_team',t);changeStatus(c,'going',t,accept)};
      actions.append(team,accept);
    }else if(c.status==='going'){
      const done=document.createElement('button');done.className='solid-button';done.textContent='ช่วยเหลือเสร็จแล้ว';done.onclick=()=>changeStatus(c,'done','',done);
      const release=document.createElement('button');release.className='secondary-button';release.textContent='ปล่อยเคส';release.onclick=()=>changeStatus(c,'open','',release);
      actions.append(done,release);
    }else{
      const reopen=document.createElement('button');reopen.className='secondary-button';reopen.textContent='เปิดเคสอีกครั้ง';reopen.onclick=()=>changeStatus(c,'open','',reopen);
      actions.append(reopen);
    }
  }else{
    const note=document.createElement('div');note.className='detail-disclaimer';
    note.textContent='ทีมอาสาที่มีรหัสจะเห็นเบอร์โทรและรับเคสได้ในหน้า "ดูเคส" หากพบผู้ประสบภัยอยู่ในอันตราย โทร 1669 หรือ 1784';
    card.append(note);
  }
  card.append(actions);wrap.append(head,card);el.append(wrap);
}
async function changeStatus(c,status,team,btn){
  btn.disabled=true;
  try{
    const r=await apiUpdate(c.id,status,team);
    if(!r.ok){if(r.error==='not_volunteer'){store.set('uh_vol_key','');isVolunteer=false}throw new Error(r.error)}
    c.status=status;if(team)c.volunteer=team;if(status==='open')c.volunteer='';
    renderDetail();loadCases();
  }catch(e){btn.disabled=false;alertInline(btn,'อัปเดตไม่สำเร็จ ลองอีกครั้ง')}
}
function alertInline(anchor,msg){const p=document.createElement('p');p.className='field-error';p.textContent=msg;anchor.after(p);setTimeout(()=>p.remove(),5000)}

/* ---------------- request form ---------------- */
let pendingRequest=null;
$('#request-form').addEventListener('submit',e=>{
  e.preventDefault();
  const checked=[...document.querySelectorAll('#needs input:checked')].map(x=>x.value);
  $('#needs-error').hidden=checked.length>0;
  if(!checked.length){$('#needs input').focus();return}
  const form=new FormData(e.currentTarget);
  const phone=String(form.get('phone')||'').trim(),address=String(form.get('address')||'').trim();
  if(phone.replace(/\D/g,'').length<9){e.currentTarget.phone.focus();return}
  if(!address&&!geo){e.currentTarget.address.focus();return}
  pendingRequest={
    needs:checked,urgencyLabel:form.get('urgency'),people:Number(form.get('people'))||1,
    address,lat:geo?+geo.lat.toFixed(6):'',lng:geo?+geo.lng.toFixed(6):'',
    phone,name:String(form.get('name')||'').trim(),details:String(form.get('details')||'').trim(),
    website:String(form.get('website')||'')
  };
  const rows=[['ความช่วยเหลือ',checked.join(', ')],['ความเร่งด่วน',form.get('urgency')],['จำนวนคน',`${pendingRequest.people} คน`],['สถานการณ์',pendingRequest.details],['ที่อยู่ / จุดสังเกต',address],['ตำแหน่ง',geo?'ปักหมุดแล้ว ✓':''],['ผู้ติดต่อ',pendingRequest.name],['เบอร์โทร',phone]];
  const summary=$('#summary-content');
  summary.replaceChildren(...rows.filter(([,val])=>val).map(([key,val])=>{const row=document.createElement('div');row.className='summary-row';const s=document.createElement('span');s.textContent=key;const v=document.createElement('strong');v.textContent=val;row.append(s,v);return row}));
  $('#send-result').hidden=true;$('#summary-actions').hidden=false;$('#send-request').disabled=false;$('#send-request').textContent='ส่งคำขอความช่วยเหลือ';
  setView('summary');
});
$('#send-request').addEventListener('click',async()=>{
  if(!pendingRequest)return;
  const btn=$('#send-request');btn.disabled=true;btn.textContent='กำลังส่ง…';
  const res=$('#send-result');
  try{
    const r=await apiCreate(pendingRequest);
    if(!r.ok)throw new Error(r.error||'error');
    res.className='notice success';
    res.innerHTML='';
    const s=document.createElement('strong');s.textContent='ส่งคำขอแล้ว · เลขเคส '+r.id;
    const p=document.createElement('p');p.textContent='ทีมงานจะโทรกลับที่ '+pendingRequest.phone+' · อันตราย โทร 1669';
    const wrap=document.createElement('div');wrap.append(s,p);res.append(wrap);res.hidden=false;
    $('#summary-actions').hidden=true;
    pendingRequest=null;$('#request-form').reset();document.querySelectorAll('#needs input').forEach(i=>i.checked=false);
    if(typeof clearRequestLocation==='function')clearRequestLocation();
    $('#summary-back').hidden=true;
    lastLoaded=0;
  }catch(e){
    res.className='notice warning';res.innerHTML='';
    const s=document.createElement('strong');s.textContent='ส่งไม่สำเร็จ';
    const p=document.createElement('p');p.textContent='อาจเป็นเพราะสัญญาณอินเทอร์เน็ต กดส่งอีกครั้ง หรือโทรแจ้ง 1555 / 1784 พร้อมข้อมูลด้านบน';
    const wrap=document.createElement('div');wrap.append(s,p);res.append(wrap);res.hidden=false;
    btn.disabled=false;btn.textContent='ลองส่งอีกครั้ง';
  }
});
$('#new-request').addEventListener('click',()=>{$('#summary-back').hidden=false;$('#send-result').hidden=true;setView('request')});

/* ---------------- wiring ---------------- */
document.addEventListener('click',e=>{const btn=e.target.closest('[data-view]');if(btn){e.preventDefault();setView(btn.dataset.view);}});
$('#start-request').addEventListener('click',()=>setView('request'));
$('#detail-back').addEventListener('click',()=>setView(detailOrigin));
$('#case-filter').addEventListener('change',renderMap);$('#case-status').addEventListener('change',renderMap);
$('#refresh-cases').addEventListener('click',loadCases);
function restoreView(){let target=location.hash.slice(1)||'home';if(target==='volunteer')target='map';if(target==='detail'&&!selectedCase)target='map';if(target==='summary'&&!$('#summary-content').children.length)target='request';if(!['home','map','request','emergency','summary','detail'].includes(target))target='home';setView(target,false)}
window.addEventListener('popstate',restoreView);
document.querySelectorAll('#needs input').forEach(el=>el.addEventListener('change',()=>{$('#needs-error').hidden=[...document.querySelectorAll('#needs input')].some(i=>i.checked)}));
restoreView();
