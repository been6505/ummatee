/* สต็อก: คงเหลือ / รับเข้า / จ่ายออก / ต้องการ — แทนกระดานในศูนย์ */
const S={items:[],log:[],roster:[],cat:'all',loaded:0,view:location.hash==='#bags'?'bags':'stock'};
const BAG='ถุงยังชีพ',isBag=i=>i&&i.category===BAG;
const VEH={boat:'เรือ',truck:'รถสูง / รถบรรทุก',pickup:'รถกระบะ',car:'รถเก๋ง / รถตู้',motorbike:'มอเตอร์ไซค์',foot:'เดินเท้า',other:'อื่น ๆ'};
const TST={ready:'พร้อม',out:'ออกเคส',rest:'พัก'};
const TYPE={in:'รับเข้า',out:'จ่ายออก',set:'ตั้งยอด'};
const CATS=['อาหาร','ยา','ถุงยังชีพ','ของใช้'];

async function loadAll(){$('#sync').textContent='กำลังโหลด…';
  try{const [r,ro]=await Promise.all([apiGet({action:'stock'}),apiGet({action:'roster'}).catch(()=>null)]);if(r&&r.ok){S.items=r.items||[];S.log=r.log||[];if(ro&&ro.ok)S.roster=ro.roster||[];S.loaded=Date.now();render()}else throw 0}
  catch(e){$('#sync').textContent='โหลดไม่สำเร็จ'}}
$('#refresh').addEventListener('click',loadAll);
setInterval(()=>{if(ADM.key&&!document.hidden&&$('#drawer').hidden)loadAll()},20000);

function expTag(i){if(!i.expiry)return '';const d=Math.ceil((Date.parse(i.expiry)-Date.now())/864e5);if(isNaN(d))return '';const t=new Date(i.expiry).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});return d<0?` · <span class="needtag">หมดอายุแล้ว (${t})</span>`:d<=30?` · <span class="warn">หมดอายุใน ${d} วัน</span>`:` · หมดอายุ ${t}`}
const received=i=>S.log.filter(l=>l.itemId===i.id).reduce((s,l)=>s+Math.max(0,Number(l.delta)||0),0);
// ใกล้หมด: ถ้าตั้งขั้นต่ำไว้ใช้ขั้นต่ำ ไม่งั้นเหลือไม่เกิน 20% ของที่เคยรับเข้า
const low=i=>{const q=Number(i.qty)||0;if(q<=0)return false;if(i.min!==''&&i.min!=null)return q<=Number(i.min);const b=Math.max(received(i),q);return b>0&&q/b<=.2};
const kitOf=b=>(Array.isArray(b&&b.kit)?b.kit:[]).map(k=>({...k,it:S.items.find(i=>i.id===k.id)})).filter(k=>k.it);
const canPack=b=>{const K=kitOf(b);return K.length?Math.min(...K.map(k=>Math.floor((Number(k.it.qty)||0)/k.qty))):null};
function kitBox(b,n){const K=kitOf(b),cp=canPack(b);
  if(!K.length)return `<section class="kit-box"><div class="kit-h"><h3>ของใน 1 ถุง</h3><button type="button" class="btn ghost sm" data-kit="${esc(b.id)}">+ กำหนดของในถุง</button></div><p class="muted small">ยังไม่ได้กำหนดว่าใน 1 ถุงมีอะไรบ้าง กำหนดไว้แล้วระบบจะตัดของในคลังให้เองตอนแพ็คถุง และบอกได้ว่าแพ็คได้อีกกี่ถุง</p></section>`;
  return `<section class="kit-box"><div class="kit-h"><h3>ของใน 1 ถุง <small>${K.length} รายการ</small></h3><button type="button" class="btn ghost sm" data-kit="${esc(b.id)}"><i data-ic="note"></i> แก้ไขของในถุง</button></div>
    <table class="kit-t"><thead><tr><th>รายการ</th><th class="r">ต่อ 1 ถุง</th><th class="r">คลังมี</th>${n?`<th class="r">ใช้ ${nf(n)} ถุง</th>`:''}<th class="r">พอแพ็ค</th></tr></thead><tbody>${K.map(k=>{const have=Number(k.it.qty)||0,need=k.qty*(n||0),enough=Math.floor(have/k.qty);
      return `<tr class="${n&&need>have?'short':''}"><td>${esc(k.it.name)}</td><td class="r">${nf(k.qty)} ${esc(k.it.unit||'')}</td><td class="r">${nf(have)}</td>${n?`<td class="r"><b>${nf(need)}</b>${need>have?' <span class="schip zero">ไม่พอ</span>':''}</td>`:''}<td class="r">${nf(enough)} ถุง</td></tr>`}).join('')}</tbody></table>
    <p class="kit-cap">ของในคลังตอนนี้แพ็คได้อีก <b>${nf(cp)} ถุง</b>${cp<=0?' · ต้องเติมของก่อน':''}</p></section>`}
const stChip=i=>Number(i.qty)<=0?'<span class="schip zero">หมด</span>':low(i)?'<span class="schip low">ใกล้หมด</span>':'';
function filtered(){const q=$('#q').value.trim().toLowerCase();
  return S.items.filter(i=>{if(isBag(i))return false;if(q&&!(i.name+' '+i.category+' '+i.note+' '+(i.location||'')).toLowerCase().includes(q))return false;
    if(S.cat==='low')return low(i)||Number(i.qty)<=0;if(S.cat==='need')return i.needed;if(S.cat!=='all'&&i.category!==S.cat)return false;return true})}
function render(){
  $('#sync').textContent=S.loaded?'อัปเดต '+new Date(S.loaded).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'';
  $$('.views [data-view]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.view===S.view)));$('#view-stock').hidden=S.view!=='stock';$('#view-bags').hidden=S.view!=='bags';
  const bagQty=S.items.filter(isBag).reduce((a,i)=>a+(Number(i.qty)||0),0);$('#bag-badge').textContent=nf(bagQty);
  renderBags();
  const I=S.items.filter(i=>!isBag(i)),today=new Date();today.setHours(0,0,0,0);const tl=S.log.filter(l=>Number(l.time)>=today.getTime()&&!isBag(S.items.find(i=>i.id===l.itemId)));
  const warnI=S.items.filter(i=>Number(i.qty)<=0||low(i)).sort((a,b)=>(Number(a.qty)>0)-(Number(b.qty)>0));
  $('#lowchips').innerHTML=warnI.length?`<span class="lc-lab"><i data-ic="alert"></i> ต้องเติม</span>`+warnI.map(i=>`<button class="lchip ${Number(i.qty)<=0?'zero':'low'}" data-mv="in" data-item="${esc(i.id)}" title="กดเพื่อรับเข้า">${esc(i.name)} <b>${Number(i.qty)<=0?'หมด':'เหลือ '+nf(i.qty)+' '+esc(i.unit||'')}</b></button>`).join(''):'';
  $('#stats').innerHTML=[['รายการในคลัง',I.length,''],['ของหมด',I.filter(i=>Number(i.qty)<=0).length,'red'],['ใกล้หมด',I.filter(i=>low(i)&&Number(i.qty)>0).length,'wait'],['ต้องการเพิ่ม',I.filter(i=>i.needed).length,'go'],
    ['รับเข้าวันนี้',tl.filter(l=>l.type==='in').length+' ครั้ง','done'],['จ่ายออกวันนี้',tl.filter(l=>l.type==='out').length+' ครั้ง','']].map(([t,v,k])=>`<div class="stat ${k}"><b>${esc(v)}</b><span>${t}</span></div>`).join('');
  const cats=[['all','ทั้งหมด'],...CATS.filter(c=>c!==BAG).map(c=>[c,c]),...[...new Set(I.map(i=>i.category).filter(c=>c&&!CATS.includes(c)&&c!==BAG))].map(c=>[c,c]),['low','หมด / ใกล้หมด'],['need','ต้องการ']];
  $('#cat').innerHTML=cats.map(([k,t])=>`<button data-cat="${esc(k)}" aria-selected="${S.cat===k}">${esc(t)}</button>`).join('');
  const L=filtered();
  // แบบกระดาน: สต็อก (ยอดตั้งต้นของช่วง) + เพิ่ม − ลด = เหลือ · การตั้งยอด/ปรับยอดรวมไว้ในช่องสต็อก
  const t0=new Date();t0.setHours(0,0,0,0);const from=S.period==='today'?t0.getTime():0;
  const mv=i=>{let add=0,sub=0;S.log.forEach(l=>{if(l.itemId!==i.id||Number(l.time)<from)return;const d=Number(l.delta)||0;if(l.type==='in')add+=d;else if(l.type==='out')sub-=d});return {add,sub,start:(Number(i.qty)||0)-add+sub}};
  $('#items').innerHTML=L.length?`<div class="gt-top"><div class="seg sm" role="tablist" aria-label="ช่วงเวลา"><button data-period="all" aria-selected="${S.period!=='today'}">ทั้งหมด</button><button data-period="today" aria-selected="${S.period==='today'}">วันนี้</button></div><small class="muted">${S.period==='today'?'สต็อก = ยอดเมื่อเริ่มวัน':'สต็อก = ยอดตั้งต้น (รวมการปรับยอด)'} · สต็อก + เพิ่ม − ลด = เหลือ</small></div>
  <div class="gt-wrap"><table class="gt"><thead><tr><th class="n">#</th><th>รายการ</th><th class="r">สต็อก</th><th class="r">เพิ่ม</th><th class="r">ลด</th><th class="r">เหลือ</th><th>หน่วย</th><th class="c">ต้องการ</th><th class="r">จัดการ</th></tr></thead><tbody>${L.map((i,n)=>{const q=Number(i.qty)||0,cls=q<=0?'zero':low(i)?'low':'',m=mv(i);
    return `<tr class="${cls}" data-id="${esc(i.id)}"><td class="n muted">${n+1}</td><td><b>${esc(i.name)}</b><small>${esc(i.category||'')}${i.location?' · <i data-ic="pin"></i> '+esc(i.location):''}${expTag(i)}</small></td>
      <td class="r">${nf(m.start)}</td><td class="r add">${m.add?'+'+nf(m.add):'<span class="muted">-</span>'}</td><td class="r sub">${m.sub?'−'+nf(m.sub):'<span class="muted">-</span>'}</td>
      <td class="r q">${nf(q)}${stChip(i)?'<br>'+stChip(i):''}</td><td class="muted">${esc(i.unit||'')}</td>
      <td class="c"><button class="needbtn" data-need="${esc(i.id)}" aria-pressed="${!!i.needed}" title="กดเพื่อ${i.needed?'เอาออกจาก':'เพิ่มใน'}รายการต้องการ">${i.needed?'<i data-ic="check"></i> ต้องการ':'+'}</button></td>
      <td class="r act"><button class="ib in" data-mv="in" data-item="${esc(i.id)}" title="เพิ่ม (รับเข้า)" aria-label="เพิ่ม ${esc(i.name)}">＋</button><button class="ib out" data-mv="out" data-item="${esc(i.id)}" title="ลด (จ่ายออก)" aria-label="ลด ${esc(i.name)}">−</button><button class="ib" data-ed="${esc(i.id)}" title="แก้ไข" aria-label="แก้ไข ${esc(i.name)}"><i data-ic="note"></i></button></td></tr>`}).join('')}</tbody></table></div>`:'<p class="empty">ไม่มีรายการ</p>';
  const need=I.filter(i=>i.needed||Number(i.qty)<=0||low(i));
  $('#need-list').innerHTML=need.length?need.map(i=>`<li><b>${esc(i.name)}</b> <small>${i.needed?'ต้องการ':''}${Number(i.qty)<=0?(i.needed?' · ':'')+'หมด':low(i)?(i.needed?' · ':'')+'เหลือ '+nf(i.qty)+' '+esc(i.unit):''}</small></li>`).join(''):'<li class="muted">ยังไม่มี</li>';
  $('#log').innerHTML=S.log.length?S.log.slice(0,80).map(l=>`<div class="lg lg-${esc(l.type)}"><span class="lg-d">${l.type==='set'?'=':Number(l.delta)>0?'+':''}${nf(l.type==='set'?l.after:l.delta)}</span><div><b>${esc(l.item)}</b> <small>${esc(TYPE[l.type]||l.type)} · เหลือ ${nf(l.after)}${l.note?' · '+esc(l.note):''}${l.team?' · <i data-ic="car"></i> '+esc(l.team):''}${l.caseId?' · เคส #'+esc(l.caseId):''}</small><small class="muted">${esc(ago(l.time))}${l.by?' · '+esc(l.by):''}</small></div></div>`).join(''):'<p class="muted small">ยังไม่มีการรับเข้า / จ่ายออก</p>';
}
$('#q').addEventListener('input',render);
document.addEventListener('click',e=>{
  const v=e.target.closest('[data-view]');if(v){S.view=v.dataset.view;history.replaceState(null,'',S.view==='bags'?'#bags':location.pathname);render();scrollTo(0,0);return}
  const pr=e.target.closest('[data-period]');if(pr){S.period=pr.dataset.period;render();return}
  const nb=e.target.closest('[data-need]');if(nb){toggleNeed(S.items.find(i=>i.id===nb.dataset.need),nb);return}
  const c=e.target.closest('[data-cat]');if(c){S.cat=c.dataset.cat;render();return}
  const kb=e.target.closest('[data-kit]');if(kb){openKit(S.items.find(i=>i.id===kb.dataset.kit));return}
  const ld=e.target.closest('[data-load]');if(ld){openLoad(S.roster.find(t=>t.id===ld.dataset.load),ld.dataset.mode||'out');return}
  const m=e.target.closest('[data-mv]');if(m){openMove(S.items.find(i=>i.id===m.dataset.item),m.dataset.mv);return}
  const ed=e.target.closest('[data-ed]');if(ed){openItem(S.items.find(i=>i.id===ed.dataset.ed));return}
});
$('#add-item').addEventListener('click',()=>openItem(null));
$('#add-bag').addEventListener('click',()=>openItem({category:BAG,unit:'ถุง'}));
addEventListener('hashchange',()=>{const v=location.hash==='#bags'?'bags':'stock';if(v!==S.view){S.view=v;render()}});
$('#add-team').addEventListener('click',openTeam);

/* ---------- แท็บถุงยังชีพ: ส่งถุงขึ้นรถของแต่ละทีม ---------- */
const VEH_ORDER=['truck','pickup','boat','car','motorbike','other','foot',''];
function bagLoads(){const ids=new Set(S.items.filter(isBag).map(i=>i.id));return S.log.filter(l=>ids.has(l.itemId)&&l.team)}
function renderBags(){
  const B=S.items.filter(isBag),total=B.reduce((a,i)=>a+(Number(i.qty)||0),0),L=bagLoads(),t0=new Date();t0.setHours(0,0,0,0);
  const sent=l=>l.type==='out'?-(Number(l.delta)||0):l.type==='in'?-(Number(l.delta)||0):0; // ขึ้นรถ = +, คืน = −
  const today=L.filter(l=>Number(l.time)>=t0.getTime()),sum=a=>a.reduce((s,l)=>s+sent(l),0);
  $('#bag-stats').innerHTML=[['ถุงคงเหลือในคลัง',nf(total)+' ถุง',total<=0?'red':''],['ส่งขึ้นรถวันนี้',nf(sum(today))+' ถุง','go'],['ส่งขึ้นรถทั้งหมด',nf(sum(L))+' ถุง','done'],['ทีมรถ',nf(S.roster.length)+' ทีม','']]
    .map(([t,v,k])=>`<div class="stat ${k}"><b>${esc(v)}</b><span>${t}</span></div>`).join('');
  $('#bag-hint').textContent=!B.length?'ยังไม่มีรายการถุงยังชีพ กด "+ เพิ่มชนิดถุง" ด้านขวาก่อน':total<=0?'ถุงยังชีพในคลังหมด กด "+ รับเข้า" ที่ถุงด้านขวาก่อนส่งขึ้นรถ':'กด "+ ส่งถุงขึ้นรถ" ที่ทีม เพื่อตัดถุงออกจากคลังและบันทึกว่าอยู่กับทีมไหน';
  const R=[...S.roster].sort((a,b)=>(a.status==='rest')-(b.status==='rest')||VEH_ORDER.indexOf(a.vehicle||'')-VEH_ORDER.indexOf(b.vehicle||'')||String(a.name).localeCompare(String(b.name),'th'));
  $('#bag-teams').innerHTML=R.length?R.map(t=>{const mine=L.filter(l=>l.team===t.name),td=sum(mine.filter(l=>Number(l.time)>=t0.getTime())),all=sum(mine);
    return `<article class="team st-${esc(t.status)}"><div class="team-h"><div><b>${esc(t.name)}</b><small>${[t.vehicle?VEH[t.vehicle]:'',t.leader?'หัวหน้า '+t.leader:'',t.phone].filter(Boolean).map(esc).join(' · ')||'ยังไม่ระบุพาหนะ'}</small></div><span class="tst tst-${esc(t.status)}">${esc(TST[t.status]||'')}</span></div>
      <div class="bagcount"><span><b>${nf(td)}</b> ถุง วันนี้</span><span class="muted">รวม ${nf(all)} ถุง</span></div>
      <div class="team-f"><button class="btn primary sm" data-load="${esc(t.id)}" data-mode="out" ${total<=0?'disabled':''}>+ ส่งถุงขึ้นรถ</button><button class="btn ghost sm" data-load="${esc(t.id)}" data-mode="in" ${all<=0?'disabled':''}>คืนถุง</button></div></article>`}).join('')
    :`<p class="empty">ยังไม่มีทีมรถ กด "+ เพิ่มทีมรถ" หรือเพิ่มที่หน้า <a href="../teams/">จัดทีม</a></p>`;
  $('#bag-items').innerHTML=B.length?B.map(i=>`<div class="bag-it${Number(i.qty)<=0?' zero':low(i)?' low':''}"><div><b>${esc(i.name)}</b> ${stChip(i)}<small class="muted">${i.location?'<i data-ic="pin"></i> '+esc(i.location):''}${expTag(i)}</small></div><div class="bag-q">${nf(i.qty)} <span class="unit">${esc(i.unit||'ถุง')}</span></div>
      <div class="bag-kit">${kitOf(i).length?`<span class="muted">ในถุง:</span> ${kitOf(i).map(k=>`${esc(k.it.name)} ${nf(k.qty)} ${esc(k.it.unit||'')}`).join(' · ')}<br><span class="muted">แพ็คได้อีก</span> <b>${nf(canPack(i))} ถุง</b>`:'<span class="muted">ยังไม่ได้กำหนดของในถุง</span>'}</div>
      <div class="bag-a"><button class="btn primary sm" data-mv="in" data-item="${esc(i.id)}">+ รับเข้า / แพ็ค</button><button class="btn ghost sm" data-kit="${esc(i.id)}">ของในถุง</button><button class="btn ghost sm" data-ed="${esc(i.id)}" aria-label="แก้ไข ${esc(i.name)}"><i data-ic="note"></i></button></div></div>`).join(''):'<p class="muted small">ยังไม่มี</p>';
  $('#bag-log').innerHTML=L.length?L.slice(0,60).map(l=>{const n=sent(l);return `<div class="lg lg-${n>0?'out':'in'}"><span class="lg-d">${n>0?'−':'+'}${nf(Math.abs(n))}</span><div><b><i data-ic="car"></i> ${esc(l.team)}</b> <small>${n>0?'ขึ้นรถ':'คืนเข้าคลัง'} · ${esc(l.item)} · คลังเหลือ ${nf(l.after)}${l.caseId?' · เคส #'+esc(l.caseId):''}${l.note?' · '+esc(l.note):''}</small><small class="muted">${esc(ago(l.time))}${l.by?' · '+esc(l.by):''}</small></div></div>`}).join(''):'<p class="muted small">ยังไม่มีการส่งถุงขึ้นรถ</p>';
}
function openLoad(t,mode){if(!t)return;const B=S.items.filter(isBag);if(!B.length){toast('ยังไม่มีรายการถุงยังชีพ');return}
  const out=mode==='out',had=bagLoads().filter(l=>l.team===t.name);
  drawer(`<div class="d-head"><div><small class="muted">${esc(t.vehicle?VEH[t.vehicle]:'ทีม')}</small><h2>${out?'ส่งถุงขึ้นรถ':'คืนถุงเข้าคลัง'} · ${esc(t.name)}</h2><small>ถุงในคลัง <b>${nf(B.reduce((a,i)=>a+(Number(i.qty)||0),0))}</b> ถุง</small></div><button class="x" id="d-close" aria-label="ปิด"><i data-ic="close"></i></button></div>
  <form id="lform" class="form-grid">
    <label class="fld wide"><span>ชนิดถุง</span><select name="bag">${B.map(i=>`<option value="${esc(i.id)}">${esc(i.name)} (เหลือ ${nf(i.qty)})</option>`).join('')}</select></label>
    <label class="fld"><span>จำนวน (ถุง)</span><input name="amount" type="number" min="1" inputmode="numeric" required></label>
    <div class="quick">${[10,20,50,100].map(n=>`<button type="button" class="chip" data-q="${n}">+${n}</button>`).join('')}</div>
    <p class="small muted" id="preview"></p>
    ${out?'<label class="fld"><span>เลขเคส (ถ้าส่งให้เคสเดียว)</span><input name="caseId" maxlength="30" placeholder="เว้นว่างได้"></label>':''}
    <label class="fld"><span>หมายเหตุ</span><input name="note" maxlength="200" placeholder="${out?'เช่น รอบเช้า ไปชุมชน…':'เช่น เหลือจากรอบบ่าย'}"></label>
    <div class="form-act"><button class="btn primary" type="submit" id="l-go">${out?'ส่งขึ้นรถ':'คืนเข้าคลัง'}</button></div>
  </form>`);
  const f=$('#lform'),amt=f.elements.amount,sel=f.elements.bag; // ไม่ใช้ชื่อ item: ชนกับ elements.item()
  const upd=()=>{const it=B.find(i=>i.id===sel.value),a=Number(amt.value)||0,q=Number(it.qty)||0,after=out?q-a:q+a;$('#preview').textContent=amt.value===''?'':`${it.name} ในคลังหลังบันทึก: ${nf(after)} ถุง${after<0?' — ถุงไม่พอ':''}`;$('#preview').className='small '+(after<0?'warn':'muted')};
  $$('#lform [data-q]').forEach(b=>b.onclick=()=>{amt.value=(Number(amt.value)||0)+Number(b.dataset.q);upd()});amt.oninput=upd;sel.onchange=upd;
  f.onsubmit=async e=>{e.preventDefault();const it=B.find(i=>i.id===sel.value),a=Math.round(Number(amt.value));if(!(a>0)){amt.focus();return}
    if(out&&a>(Number(it.qty)||0)){toast(`ถุงไม่พอ เหลือ ${nf(it.qty)} ถุง`);return}
    $('#l-go').disabled=true;
    try{const r=await apiPost({action:'stock_move',itemId:it.id,type:out?'out':'in',amount:a,team:t.name,note:f.elements.note.value||(out?'ขึ้นรถ ':'คืนจาก ')+t.name,caseId:out&&f.elements.caseId?f.elements.caseId.value:'',by:staffName()});
      if(!r.ok){toast(r.error==='not_enough'?`ถุงไม่พอ (เหลือ ${nf(r.qty)})`:'บันทึกไม่สำเร็จ: '+(r.error||''));return}
      toast(`${out?'ส่ง':'คืน'} ${nf(a)} ถุง ${out?'ขึ้นรถ':'จาก'} ${t.name} · คลังเหลือ ${nf(r.qty)}`,true);closeD();loadAll()}
    catch(err){if(err.message!=='auth')toast('บันทึกไม่สำเร็จ ลองใหม่')}finally{const b=$('#l-go');if(b)b.disabled=false}};
}
function openKit(b){if(!b)return;const opts=S.items.filter(i=>!isBag(i)).sort((x,y)=>String(x.category).localeCompare(String(y.category),'th')||String(x.name).localeCompare(String(y.name),'th'));
  let rows=(Array.isArray(b.kit)?b.kit:[]).map(k=>({...k}));if(!rows.length)rows=[{id:'',qty:1}];
  drawer(`<div class="d-head"><div><small class="muted">ถุงยังชีพ</small><h2>ของใน 1 ถุง · ${esc(b.name)}</h2><small>เลือกของจากคลังและจำนวนที่ใส่ใน 1 ถุง</small></div><button class="x" id="d-close" aria-label="ปิด"><i data-ic="close"></i></button></div>
  <form id="kform" class="form-grid"><div class="wide kit-rows" id="kit-rows"></div><div class="wide"><button type="button" class="btn ghost sm" id="kit-add">+ เพิ่มของ</button></div>
    <div class="form-act"><button class="btn primary" type="submit" id="k-go">บันทึกของในถุง</button></div></form>`);
  const draw=()=>{$('#kit-rows').innerHTML=rows.map((r,n)=>`<div class="kit-row"><select data-r="${n}" aria-label="ของชิ้นที่ ${n+1}"><option value="">เลือกของ…</option>${opts.map(i=>`<option value="${esc(i.id)}" ${i.id===r.id?'selected':''}>${esc(i.name)} (${esc(i.unit||'')})</option>`).join('')}</select><input type="number" min="1" inputmode="numeric" data-q="${n}" value="${esc(r.qty)}" aria-label="จำนวนต่อถุง"><button type="button" class="ib" data-del="${n}" aria-label="ลบ"><i data-ic="close"></i></button></div>`).join('')};
  draw();const box=$('#kit-rows');
  box.onchange=e=>{const r=e.target.dataset.r,q=e.target.dataset.q;if(r!=null)rows[r].id=e.target.value;if(q!=null)rows[q].qty=Math.max(1,Math.round(Number(e.target.value)||1))};
  box.oninput=box.onchange;
  box.onclick=e=>{const d=e.target.closest('[data-del]');if(d){rows.splice(+d.dataset.del,1);if(!rows.length)rows=[{id:'',qty:1}];draw()}};
  $('#kit-add').onclick=()=>{rows.push({id:'',qty:1});draw()};
  $('#kform').onsubmit=async e=>{e.preventDefault();const kit=[];rows.forEach(r=>{if(!r.id)return;const x=kit.find(k=>k.id===r.id);x?x.qty+=r.qty:kit.push({id:r.id,qty:r.qty})});
    $('#k-go').disabled=true;
    try{const r=await apiPost({action:'stock_item',item:{id:b.id,name:b.name,unit:b.unit,category:b.category,min:b.min,needed:b.needed,note:b.note,expiry:b.expiry,location:b.location,kit}});
      if(!r.ok){toast('บันทึกไม่สำเร็จ: '+(r.error||''));return}toast(`บันทึกของในถุงแล้ว (${kit.length} รายการ)`,true);closeD();loadAll()}
    catch(err){if(err.message!=='auth')toast('บันทึกไม่สำเร็จ ลองใหม่')}finally{const x=$('#k-go');if(x)x.disabled=false}};
}
async function toggleNeed(i,btn){if(!i)return;btn.disabled=true;
  try{const r=await apiPost({action:'stock_item',item:{id:i.id,name:i.name,unit:i.unit,category:i.category,min:i.min,needed:!i.needed,note:i.note,expiry:i.expiry,location:i.location}});
    if(!r.ok){toast('บันทึกไม่สำเร็จ: '+(r.error||''));return}i.needed=!i.needed;toast(i.needed?`เพิ่ม ${i.name} ในรายการต้องการ`:`เอา ${i.name} ออกจากรายการต้องการ`,true);render()}
  catch(err){if(err.message!=='auth')toast('บันทึกไม่สำเร็จ')}finally{btn.disabled=false}}
function openTeam(){
  drawer(`<div class="d-head"><div><h2>เพิ่มทีมรถ</h2><small class="muted">ทีมจะขึ้นที่หน้าจัดทีมด้วย</small></div><button class="x" id="d-close" aria-label="ปิด"><i data-ic="close"></i></button></div>
  <form id="tform" class="form-grid">
    <label class="fld"><span>ชื่อทีม / ทะเบียนรถ *</span><input name="name" required maxlength="60" placeholder="เช่น รถกระบะ 1 / กข 1234"></label>
    <label class="fld"><span>พาหนะ</span><select name="vehicle">${Object.entries(VEH).map(([k,v])=>`<option value="${k}" ${k==='pickup'?'selected':''}>${v}</option>`).join('')}</select></label>
    <label class="fld"><span>หัวหน้าทีม</span><input name="leader" maxlength="60"></label>
    <label class="fld"><span>เบอร์โทร</span><input name="phone" type="tel" inputmode="tel" maxlength="20"></label>
    <div class="form-act"><button class="btn primary" type="submit" id="t-go">เพิ่มทีม</button></div>
  </form>`);
  $('#tform').onsubmit=async e=>{e.preventDefault();const f=e.target,v=n=>f.elements[n].value.trim();if(!v('name'))return;$('#t-go').disabled=true;
    try{const r=await apiPost({action:'roster_save',team:{name:v('name'),vehicle:v('vehicle'),leader:v('leader'),phone:v('phone'),status:'ready'},by:staffName()});
      if(!r.ok){toast(r.error==='duplicate_name'?'มีทีมชื่อนี้แล้ว':'เพิ่มไม่สำเร็จ: '+(r.error||''));return}
      toast('เพิ่มทีม '+v('name')+' แล้ว',true);closeD();loadAll()}catch(err){if(err.message!=='auth')toast('เพิ่มไม่สำเร็จ ลองใหม่')}finally{const b=$('#t-go');if(b)b.disabled=false}};
}

/* ---------- รับเข้า / จ่ายออก ---------- */
function drawer(html){const d=$('#drawer');d.innerHTML=html;d.hidden=false;$('#drawer-bg').hidden=false;$('#d-close').onclick=closeD;$('#drawer-bg').onclick=closeD;setTimeout(()=>{const f=d.querySelector('input');if(f)f.focus()},50)}
function closeD(){$('#drawer').hidden=true;$('#drawer-bg').hidden=true}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeD()});
function openMove(it,type){if(!it)return;
  drawer(`<div class="d-head"><div><small class="muted">${esc(it.category||'')}</small><h2>${esc(it.name)}</h2><small>คงเหลือ <b>${nf(it.qty)}</b> ${esc(it.unit||'')}</small></div><button class="x" id="d-close" aria-label="ปิด"><i data-ic="close"></i></button></div>
  <form id="mform" class="form-grid">
    <div class="seg mv-seg">${Object.entries(TYPE).map(([k,v])=>`<button type="button" data-t="${k}" aria-selected="${k===type}">${v}</button>`).join('')}</div>
    <label class="fld"><span id="amt-lab">จำนวน (${esc(it.unit||'หน่วย')})</span><input name="amount" type="number" min="0" inputmode="numeric" required></label>
    <p class="muted small" id="preview"></p>
    <label class="fld"><span>หมายเหตุ</span><input name="note" maxlength="200" placeholder="เช่น รับบริจาคจาก… / แจกชุมชน…"></label>
    <label class="fld" id="case-f"><span>เลขเคส (ถ้าจ่ายให้เคส)</span><input name="caseId" maxlength="30" placeholder="เช่น C10011527-M3WZ"></label>
    ${isBag(it)&&kitOf(it).length?`<label class="chk wide" id="pack-f"><input name="pack" type="checkbox" checked><span>แพ็คเองที่ศูนย์: ตัดของในคลังตามรายการในถุงให้อัตโนมัติ</span></label>`:''}
    <div class="form-act"><button class="btn primary" type="submit" id="m-go">บันทึก</button></div>
  </form>${isBag(it)?`<div id="kit-area">${kitBox(it)}</div>`:''}`);
  let t=type;const f=$('#mform'),amt=f.elements.amount;
  const upd=()=>{$$('.mv-seg [data-t]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.t===t)));$('#case-f').hidden=t!=='out';const a=Number(amt.value)||0,q=Number(it.qty)||0,after=t==='in'?q+a:t==='out'?q-a:a;
    $('#preview').textContent=amt.value===''?'':`หลังบันทึก: ${nf(after)} ${it.unit||''}${after<0?' — ของไม่พอ':''}`;$('#preview').className='small '+(after<0?'warn':'muted');
    const pk=f.elements.pack,packing=pk&&t==='in'&&pk.checked;if($('#pack-f'))$('#pack-f').hidden=t!=='in';$('#m-go').textContent=packing?'แพ็คถุง':TYPE[t];
    if($('#kit-area'))$('#kit-area').innerHTML=kitBox(it,packing?a:0)};
  if(f.elements.pack)f.elements.pack.onchange=upd;
  $$('.mv-seg [data-t]').forEach(b=>b.onclick=()=>{t=b.dataset.t;upd()});amt.oninput=upd;upd();
  f.onsubmit=async e=>{e.preventDefault();const a=Math.round(Number(amt.value));if(!(a>=0)||amt.value===''){amt.focus();return}
    const q=Number(it.qty)||0;if(t==='out'&&a>q){toast(`ของไม่พอ เหลือ ${nf(q)} ${it.unit||''}`);return}
    $('#m-go').disabled=true;
    if(t==='in'&&f.elements.pack&&f.elements.pack.checked){
      try{const r=await apiPost({action:'bag_pack',itemId:it.id,amount:a,note:f.elements.note.value,by:staffName()});
        if(!r.ok){toast(r.error==='not_enough'?`ของไม่พอ: ${(r.short||[]).map(x=>x.name+' ขาด '+nf(x.need-x.have)).join(', ')} · แพ็คได้สูงสุด ${nf(r.canPack)} ถุง`:'แพ็คไม่สำเร็จ: '+(r.error||''));return}
        toast(`แพ็ค ${it.name} ${nf(a)} ถุง · ตัดของในคลัง ${r.used.length} รายการ`,true);closeD();loadAll()}
      catch(err){if(err.message!=='auth')toast('แพ็คไม่สำเร็จ ลองใหม่')}finally{const b=$('#m-go');if(b)b.disabled=false}
      return}
    try{const r=await apiPost({action:'stock_move',itemId:it.id,type:t,amount:a,note:f.elements.note.value,caseId:t==='out'?f.elements.caseId.value:'',by:staffName()});
      if(!r.ok){toast(r.error==='not_enough'?`ของไม่พอ (เหลือ ${nf(r.qty)})`:'บันทึกไม่สำเร็จ: '+(r.error||''));return}
      it.qty=r.qty;toast(`${TYPE[t]} ${it.name} ${nf(a)} ${it.unit||''} · เหลือ ${nf(r.qty)}`,true);closeD();render();loadAll()}
    catch(err){if(err.message!=='auth')toast('บันทึกไม่สำเร็จ ลองใหม่')}finally{const b=$('#m-go');if(b)b.disabled=false}};
}
/* ---------- เพิ่ม / แก้ไขรายการ ---------- */
function openItem(it){it=it||{};const isNew=!it.id;
  drawer(`<div class="d-head"><div><h2>${isNew?'เพิ่มรายการใหม่':'แก้ไขรายการ'}</h2></div><button class="x" id="d-close" aria-label="ปิด"><i data-ic="close"></i></button></div>
  <form id="iform" class="form-grid">
    <label class="fld"><span>ชื่อรายการ *</span><input name="name" required maxlength="80" value="${esc(it.name)}"></label>
    <label class="fld"><span>หมวด</span><input name="category" list="cats" maxlength="30" value="${esc(it.category)}" placeholder="อาหาร, ยา, ของใช้…"><datalist id="cats">${CATS.map(c=>`<option value="${c}">`).join('')}</datalist></label>
    ${isNew?`<label class="fld"><span>จำนวนรับเข้าตอนนี้</span><input name="qty0" type="number" min="0" inputmode="numeric" placeholder="เว้นว่าง = 0"></label>`:''}
    <label class="fld"><span>หน่วย</span><input name="unit" maxlength="20" list="units" placeholder="ห่อ, แผง, ขวด…" value="${esc(it.unit)}"><datalist id="units">${['ห่อ','แผง','ขวด','แพ็ค','ถุง','กล่อง','ชิ้น','ซอง','หลอด','ตลับ','กระป๋อง','คู่','ชุด','ฟอง','กิโลกรัม'].map(u=>`<option value="${u}">`).join('')}</datalist></label>
    ${isNew?`<label class="fld"><span>รับจาก / ผู้บริจาค</span><input name="source" maxlength="80" placeholder="เช่น มัสยิด… / ร้าน… / ซื้อเอง"></label>`:''}
    <label class="fld"><span>วันหมดอายุ (ถ้ามี)</span><input name="expiry" type="date" value="${esc(it.expiry)}"></label>
    <label class="fld"><span>ที่เก็บ</span><input name="location" maxlength="60" placeholder="เช่น ห้องเก็บของ ชั้น 2 / ชั้นวาง A" value="${esc(it.location)}"></label>
    <label class="fld"><span>แจ้งเตือนเมื่อเหลือไม่เกิน</span><input name="min" type="number" min="0" inputmode="numeric" value="${esc(it.min)}" placeholder="เว้นว่าง = ไม่แจ้งเตือน"></label>
    <label class="fld"><span>หมายเหตุ</span><input name="note" maxlength="200" value="${esc(it.note)}"></label>
    <label class="chk"><input name="needed" type="checkbox" ${it.needed?'checked':''}><span>ต้องการรับบริจาคเพิ่ม (ขึ้นในรายการ "ต้องการ")</span></label>
    <div class="form-act"><button class="btn primary" type="submit" id="i-go">บันทึก</button></div>
  </form>`);
  $('#iform').onsubmit=async e=>{e.preventDefault();const f=e.target,v=n=>f.elements[n]?f.elements[n].value.trim():'';
    const d={id:it.id||'',name:v('name'),unit:v('unit'),category:v('category'),min:v('min'),needed:f.elements.needed.checked,note:v('note'),expiry:v('expiry'),location:v('location')};
    if(!d.name)return;const q0=Math.max(0,Math.round(Number(v('qty0'))||0));$('#i-go').disabled=true;
    try{const r=await apiPost({action:'stock_item',item:d});if(!r.ok){toast('บันทึกไม่สำเร็จ: '+(r.error||''));return}
      if(isNew&&q0>0){const m=await apiPost({action:'stock_move',itemId:r.id,type:'in',amount:q0,note:['ยอดตั้งต้น',v('source')?'จาก '+v('source'):''].filter(Boolean).join(' · '),by:staffName()});
        if(!m.ok)toast('เพิ่มรายการแล้ว แต่บันทึกจำนวนไม่สำเร็จ กด "+ รับเข้า" อีกครั้ง');else toast(`เพิ่ม ${d.name} · ${nf(q0)} ${d.unit}`,true)}
      else toast('บันทึกรายการแล้ว',true);
      closeD();loadAll()}catch(err){if(err.message!=='auth')toast('บันทึกไม่สำเร็จ ลองใหม่')}finally{const b=$('#i-go');if(b)b.disabled=false}};
}
/* ---------- คัดลอก / ส่งออก ---------- */
$('#copy-need').addEventListener('click',()=>{const need=S.items.filter(i=>i.needed||Number(i.qty)<=0||low(i));
  const txt='<i data-ic="box"></i> ศูนย์ UMMATEE ต้องการรับบริจาค\n'+need.map((i,n)=>`${n+1}. ${i.name}${Number(i.qty)<=0?' (หมด)':low(i)?` (เหลือ ${nf(i.qty)} ${i.unit||''})`:''}`).join('\n');
  (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('คัดลอกแล้ว วางในไลน์ / เพจได้เลย',true)).catch(()=>toast('คัดลอกไม่สำเร็จ'))});
$('#export').addEventListener('click',()=>{const cell=v=>{let s=String(v==null?'':v);if(/^[=+\-@]/.test(s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
  const rows=[['รายการ','หมวด','คงเหลือ','หน่วย','ขั้นต่ำ','ต้องการ','วันหมดอายุ','ที่เก็บ','หมายเหตุ'],...S.items.map(i=>[i.name,i.category,i.qty,i.unit,i.min,i.needed?'ต้องการ':'',i.expiry||'',i.location||'',i.note])];
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));a.download=`umplus-stock-${new Date().toISOString().slice(0,10)}.csv`;a.click()});

adminBoot({action:'stock'},'items',r=>{S.items=r.items||[];S.log=r.log||[];S.loaded=Date.now();render();loadAll()});

/* เปิดจากช่องค้นหา (?q=ชื่อของ): ใส่คำค้นให้เลย */
{const q=new URLSearchParams(location.search).get('q');if(q){$('#q').value=q;setTimeout(()=>$('#q').dispatchEvent(new Event('input')),1500)}}
