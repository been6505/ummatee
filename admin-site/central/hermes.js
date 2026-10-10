const HERMES=(()=>{
  const KEY=()=>{try{return localStorage.getItem('uh_vol_key')||sessionStorage.getItem('uh_vol_key')||''}catch(e){return ''}};
  const me=()=>{try{return localStorage.getItem('uh_staff')||'ศูนย์'}catch(e){return 'ศูนย์'}};
  const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const I=n=>typeof ic==='function'?ic(n):'';
  const get=async p=>{const r=await fetch('/api?'+new URLSearchParams({...p,key:KEY(),t:Date.now()}),{cache:'no-store'});return r.json()};
  const post=async b=>{const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...b,key:KEY()})});return r.json()};
  const sevOf=c=>typeof VERIFY!=='undefined'&&VERIFY.level?VERIFY.level(c):Math.min(3,Math.max(1,Number(c.urgency)||1));
  const URG={3:'วิกฤต',2:'เร่งด่วน',1:'ปกติ'},STS={open:'รอช่วย',going:'กำลังไป',done:'ช่วยแล้ว'},TST={ready:'พร้อม',out:'ทีมกำลังไป',rest:'พัก'};
  const pin=c=>c&&c.lat!==''&&c.lat!=null&&isFinite(+c.lat)&&+c.lat!==0;
  const km=(a,b,c,d)=>{const R=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,h=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
  const mins=t=>t?Math.max(0,Math.round((Date.now()-t)/60000)):0;
  const wait=t=>{const m=mins(t);return m<60?m+' นาที':m<1440?Math.floor(m/60)+' ชม.':Math.floor(m/1440)+' วัน'};
  const vol=c=>String(c.volunteer||'').replace(/^'/,'').trim();
  const S={scope:null,data:null,at:0,log:[],busy:false,el:null,focus:null};

  async function data(){
    if(S.scope&&S.scope.cases)return {cases:S.scope.cases.filter(c=>!c.dupOf),roster:S.scope.roster||[],live:S.scope.live||[],title:S.scope.title||'War Room'};
    if(S.data&&Date.now()-S.at<30000)return S.data;
    if(S.loading)return S.loading;
    return S.loading=(async()=>{try{
    const [h,o,r,t]=await Promise.all([get({action:'helpme_cases'}).catch(()=>null),get({action:'list'}).catch(()=>null),get({action:'roster'}).catch(()=>null),get({action:'teams'}).catch(()=>null)]);
    const hm=h&&h.ok?h.cases:[],own=o&&o.cases?o.cases:[],ids=new Set(hm.map(c=>String(c.id)));
    S.data={cases:hm.concat(own.filter(c=>!ids.has(String(c.id)))).filter(c=>!c.dupOf),roster:r&&r.ok?r.roster||[]:[],live:t&&t.ok?t.teams||[]:[],title:'ภาพรวมทั้งหมด'};S.at=Date.now();return S.data}finally{S.loading=null}})()}
  const HZ={High:'สูง',Moderate:'ปานกลาง',Low:'ต่ำ','Very Low':'ต่ำมาก','No Data':'ไม่มีข้อมูล'};
  async function fiw(d){const pin=c=>c.lat!==''&&c.lat!=null&&isFinite(+c.lat)&&+c.lat;const open=d.cases.filter(c=>c.status!=='done'&&pin(c)).sort((a,b)=>sevOf(b)-sevOf(a)||(a.createdAt||0)-(b.createdAt||0));
    const f=S.focus&&d.cases.find(c=>String(c.id)===S.focus),pick=[...(f&&pin(f)?[f]:[]),...open.filter(c=>c!==f)].slice(0,20),key=pick.map(c=>c.id).join(',');
    if(S.fw&&S.fwKey===key&&Date.now()-S.fwAt<300000)return S.fw;
    const r=await get({action:'fiw',pts:pick.map(c=>`${(+c.lat).toFixed(5)},${(+c.lng).toFixed(5)},${c.id}`).join(';')}).catch(()=>null);S.fw=r&&r.ok?r:null;S.fwKey=key;S.fwAt=Date.now();return S.fw}
  function fiwText(F){if(!F)return '';const o=F.ov,L=[`ข้อมูลความเสี่ยงน้ำท่วม (${F.src}, ตาราง H3 ~0.1 ตร.กม.):`];
    if(o){const c=o.classes||{};L.push(`ทั้งพื้นที่: เสี่ยงสูง ${c.High||0} ช่อง · ปานกลาง ${c.Moderate||0} · ต่ำ ${c.Low||0} · ต่ำมาก ${c['Very Low']||0}`);
      if(o.high&&o.high.length)L.push('จุดเสี่ยงสูงสุด: '+o.high.slice(0,8).map(h=>`${h.c?h.c.join(','):'-'} (คะแนน ${h.score}${h.rain24!=null?`, ฝน24ชม. ${h.rain24} มม.`:''}${h.river?`, ใกล้แม่น้ำ ${h.river} ม.`:''})`).join(' · '));
      if(o.rain&&o.rain.length)L.push('ฝนสะสม 24 ชม. สูงสุด: '+o.rain.slice(0,6).map(x=>`${x.name} ${x.r24} มม.`).join(' · '));
      if(o.wl&&o.wl.length)L.push('สถานีระดับน้ำเฝ้าระวัง: '+o.wl.slice(0,6).map(x=>`${x.river||x.basin||'-'} ระดับ ${x.lv}/5${x.bank?` (${x.bank})`:''}${x.store?` น้ำ ${Math.round(x.store)}% ตลิ่ง`:''}`).join(' · '))}
    if(F.at&&F.at.length)L.push('ความเสี่ยง ณ จุดเคส:\n'+F.at.map(x=>`#${x.id}: ${HZ[x.cls]||x.cls}${x.score!=null?` คะแนน ${x.score}/100`:x.phys!=null?` (สภาพพื้นที่ ${Math.round(x.phys)}/100)`:''}${x.rain24!=null?` · ฝน24ชม. ${x.rain24} มม.`:''}${x.low!=null?` · ที่ลุ่ม ${x.low}`:''}${x.elev!=null?` · สูง ~${Math.round(x.elev)} ม.`:''}${x.river?` · ห่างแม่น้ำสายหลัก <${x.river} ม.`:''}${x.sit?` · สถานีน้ำใกล้ระดับ ${x.sit}`:''}`).join('\n'));
    return L.join('\n')}
  async function stock(){if(S.stk&&Date.now()-S.stkAt<60000)return S.stk;const r=await get({action:'stock'}).catch(()=>null);S.stk=r&&r.ok?r.items||[]:[];S.stkAt=Date.now();return S.stk}
  function stockText(items,d){const room=S.scope&&S.scope.roomId,its=items.filter(i=>!room||!i.warroom||i.warroom===room);if(!its.length)return 'สต็อก: ไม่มีข้อมูล';
    const byId=new Map(items.map(i=>[i.id,i]));
    const lines=its.map(i=>{const low=i.min!==''&&i.min!=null&&+i.qty<=+i.min;let t=`${i.name}: ${i.qty} ${i.unit||''}${low?' (ใกล้หมด · ขั้นต่ำ '+i.min+')':''}${+i.qty<=0?' (หมด)':''}${i.needed?' (ต้องการเพิ่ม)':''}${i.warroom?' · คลัง '+i.warroom:''}`;
      if(Array.isArray(i.kit)&&i.kit.length){const can=Math.min(...i.kit.map(k=>{const c=byId.get(k.id);return c&&+k.qty>0?Math.floor(+c.qty/+k.qty):0}));
        t+=` · ชุดละ: ${i.kit.map(k=>(byId.get(k.id)||{}).name+' ×'+k.qty).join(', ')} · ประกอบเพิ่มได้อีก ${isFinite(can)?can:0} ชุด`}return t});
    const open=d.cases.filter(c=>c.status!=='done'),need=open.reduce((a,c)=>a+(Number(c.bags)||0),0),noBags=open.filter(c=>c.bags===''||c.bags==null).length;
    return `สต็อก (${its.length} รายการ):\n${lines.join('\n')}\nถุงยังชีพที่เคสค้างต้องการ (ที่ระบุแล้ว): ${need} ถุง · เคสค้างที่ยังไม่ระบุจำนวนถุง ${noBags} เคส`}
  const teamPos=(d,name)=>{const l=d.live.find(x=>x.team===name&&Date.now()-x.updatedAt<30*60e3);if(l)return {lat:+l.lat,lng:+l.lng,src:'สด '+mins(l.updatedAt)+' นาทีก่อน'};
    const g=d.cases.filter(c=>c.status==='going'&&vol(c)===name&&pin(c));if(g.length)return {lat:g.reduce((a,c)=>a+ +c.lat,0)/g.length,lng:g.reduce((a,c)=>a+ +c.lng,0)/g.length,src:'จากเคสที่รับอยู่'};return null};

  function plan(d,opt={}){const MAXB=opt.max||3,NEAR=opt.near||2.5;
    const open=d.cases.filter(c=>c.status!=='done'&&c.status!=='going'&&!vol(c)).map(c=>({c,s:sevOf(c),w:mins(c.createdAt)})).sort((a,b)=>b.s-a.s||b.w-a.w);
    const busy=new Set(d.cases.filter(c=>c.status==='going').map(vol));
    const teams=d.roster.filter(t=>t.status!=='rest'&&(t.status==='ready'||!busy.has(t.name))).map(t=>({t,p:teamPos(d,t.name)}));
    const used=new Set(),out=[];
    for(const T of teams){const boat=/boat|truck/.test(T.t.vehicle||'');
      const cand=open.filter(x=>!used.has(x.c.id)).map(x=>{const dist=T.p&&pin(x.c)?km(T.p.lat,T.p.lng,+x.c.lat,+x.c.lng):null;
        const needBoat=/เรือ|อพยพ/.test((x.c.needs||[]).join(' '))||/อก|คอ|หลังคา|ท่วมมิด/.test(x.c.levelText||x.c.level||'');
        return {...x,dist,score:x.s*100+Math.min(x.w,1440)/30-(dist==null?15:dist*4)-(needBoat&&!boat?40:0),needBoat}}).sort((a,b)=>b.score-a.score);
      const first=cand[0];if(!first)break;used.add(first.c.id);const bundle=[first];
      if(pin(first.c))for(const x of cand.slice(1)){if(bundle.length>=MAXB)break;if(pin(x.c)&&km(+first.c.lat,+first.c.lng,+x.c.lat,+x.c.lng)<=NEAR&&!(x.needBoat&&!boat)){bundle.push(x);used.add(x.c.id)}}
      const why=[`${URG[first.s]} รอ ${wait(first.c.createdAt)}`,first.dist!=null?`ห่างทีม ~${first.dist.toFixed(1)} กม.`:'ไม่ทราบตำแหน่งทีม',bundle.length>1?`รวมเคสใกล้กันอีก ${bundle.length-1} เคส`:'',first.needBoat&&boat?'ต้องใช้เรือ/รถสูง · ทีมมี':''].filter(Boolean).join(' · ');
      out.push({team:T.t.name,vehicle:T.t.vehicle||'',cases:bundle.map(x=>x.c),why})}
    return {plan:out,left:open.filter(x=>!used.has(x.c.id)).length,teams:teams.length}}

  const bagsOf=c=>c.bags!==''&&c.bags!=null&&!isNaN(+c.bags)?+c.bags:Math.max(1,Number(c.households)||Math.ceil((Number(c.people)||1)/4));
  function teamsFor(d,c){const busy=new Map();d.cases.forEach(x=>{if(x.status==='going'&&vol(x))busy.set(vol(x),(busy.get(vol(x))||0)+1)});
    const needBoat=/เรือ|อพยพ/.test((c.needs||[]).join(' '))||/อก|คอ|หลังคา|ท่วมมิด/.test(c.levelText||c.level||'');
    return d.roster.filter(t=>t.status!=='rest').map(t=>{const p=teamPos(d,t.name),dist=p&&pin(c)?km(p.lat,p.lng,+c.lat,+c.lng):null,boat=/boat|truck/.test(t.vehicle||''),b=busy.get(t.name)||0;
      const score=100-(dist==null?20:dist*5)-b*15+(t.status==='ready'?10:0)+(needBoat?(boat?20:-40):0);
      return {t,dist,b,score,why:[dist!=null?`~${dist.toFixed(1)} กม.`:'ไม่ทราบตำแหน่ง',b?`รับอยู่ ${b} เคส`:'ว่าง',needBoat?(boat?'มีเรือ/รถสูง':'ไม่มีเรือ'):''].filter(Boolean).join(' · ')}}).sort((a,b)=>b.score-a.score)}
  function dups(d){const L=d.cases.filter(c=>c.status!=='done'),P=L.map((_,i)=>i),f=i=>P[i]===i?i:(P[i]=f(P[i])),why=new Map();
    const u=(i,j,w)=>{const a=f(i),b=f(j);if(a!==b)P[b]=a;why.set(i+'-'+j,w)};
    const ph=c=>String(c.phone||'').replace(/\D/g,'').slice(-9);
    for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j];
      if(ph(a).length===9&&ph(a)===ph(b)){u(i,j,'เบอร์เดียวกัน');continue}
      if(pin(a)&&pin(b)&&Math.abs((a.createdAt||0)-(b.createdAt||0))<3*864e5&&km(+a.lat,+a.lng,+b.lat,+b.lng)<=0.15){const na=new Set(a.needs||[]),nb=b.needs||[];
        if(!na.size||!nb.length||nb.some(x=>na.has(x)))u(i,j,'ตำแหน่งเดียวกัน (≤150 ม.)')}}
    const g=new Map();L.forEach((c,i)=>{const r=f(i);if(!g.has(r))g.set(r,[]);g.get(r).push(i)});
    return [...g.values()].filter(x=>x.length>1).map(ix=>{const cs=ix.map(i=>L[i]).sort((a,b)=>(vol(b)?1:0)-(vol(a)?1:0)||(a.createdAt||0)-(b.createdAt||0));
      const w=new Set();for(const i of ix)for(const j of ix){const x=why.get(i+'-'+j);if(x)w.add(x)}return {keep:cs[0],dup:cs.slice(1),why:[...w].join(' · ')}})}
  function clusters(d,R=1){const L=d.cases.filter(c=>c.status!=='done'&&c.status!=='going'&&!vol(c)&&pin(c)),seen=new Set(),out=[];
    for(let i=0;i<L.length;i++){if(seen.has(i))continue;const q=[i],g=[];seen.add(i);
      while(q.length){const k=q.pop();g.push(L[k]);for(let j=0;j<L.length;j++)if(!seen.has(j)&&km(+L[k].lat,+L[k].lng,+L[j].lat,+L[j].lng)<=R){seen.add(j);q.push(j)}}
      if(g.length>1){const lat=g.reduce((a,c)=>a+ +c.lat,0)/g.length,lng=g.reduce((a,c)=>a+ +c.lng,0)/g.length;out.push({cases:g.sort((a,b)=>sevOf(b)-sevOf(a)),lat,lng,people:g.reduce((a,c)=>a+(Number(c.people)||1),0),top:Math.max(...g.map(sevOf))})}}
    return out.sort((a,b)=>b.top-a.top||b.cases.length-a.cases.length)}
  const NEED_MAP=[[/อาหาร/,i=>Array.isArray(i.kit)&&i.kit.length||/ถุงยังชีพ/.test(i.name+i.category),c=>bagsOf(c),'ถุงยังชีพ'],[/น้ำ/,i=>/น้ำดื่ม|น้ำเปล่า/.test(i.name),c=>Math.max(1,Number(c.people)||1),'น้ำดื่ม (ขวด · 1 ขวด/คน)'],
    [/ยา/,i=>/ยา/.test(i.category+i.name)&&!/ยาง/.test(i.name),c=>1,'ชุดยา'],[/นม/,i=>/นม/.test(i.name),c=>1,'นม'],[/ผ้าอ้อม|แพมเพิส/,i=>/ผ้าอ้อม|แพมเพิส/.test(i.name),c=>1,'ผ้าอ้อม'],[/แมว|สัตว์|หมา/,i=>/สัตว์|แมว|หมา/.test(i.name),c=>1,'อาหารสัตว์']];
  function stockMatch(d,items){const room=S.scope&&S.scope.roomId,its=items.filter(i=>!room||!i.warroom||i.warroom===room);
    const open=d.cases.filter(c=>c.status!=='done').sort((a,b)=>sevOf(b)-sevOf(a)||(a.createdAt||0)-(b.createdAt||0));
    const rows=NEED_MAP.map(([re,pick,amt,label])=>{const stockItems=its.filter(pick),have=stockItems.reduce((a,i)=>a+(+i.qty||0),0),cs=open.filter(c=>re.test((c.needs||[]).join(' ')));
      let left=have,ok=0;const short=[];for(const c of cs){const n=amt(c);if(left>=n){left-=n;ok++}else short.push(c)}
      return {label,have,unit:(stockItems[0]||{}).unit||'',need:cs.reduce((a,c)=>a+amt(c),0),cases:cs.length,ok,short,items:stockItems.map(i=>i.name)}}).filter(r=>r.cases||r.have);
    return rows}
  async function match(k){add({team:'เคส ↔ ทีม',dup:'หาเคสซ้ำ',stock:'เคส ↔ สต็อก',near:'กลุ่มเคสใกล้กัน'}[k],'hz-m u');let d;try{d=await data()}catch(e){note('โหลดข้อมูลไม่ได้');return}
    if(k==='dup'){const G=dups(d);if(!G.length){note('ไม่พบเคสซ้ำในเคสที่ยังไม่เสร็จ');return}note(`พบเคสที่น่าจะซ้ำ ${G.length} กลุ่ม · ตรวจก่อนรวม`);G.slice(0,20).forEach(g=>actCard({type:'merge',keep:g.keep,dup:g.dup,why:g.why},d));return}
    if(k==='near'){const C=clusters(d);if(!C.length){note('ไม่มีเคสค้างที่อยู่ใกล้กัน (≤1 กม.)');return}note(`พบ ${C.length} กลุ่ม · เลือกทีมแล้วกดยืนยัน`);
      C.slice(0,12).forEach(g=>{const T=teamsFor(d,{...g.cases[0],lat:g.lat,lng:g.lng});actCard({type:'assign',team:(T[0]||{t:{}}).t.name||'',choices:T.slice(0,6).map(x=>({name:x.t.name,why:x.why})),cases:g.cases.map(c=>String(c.id)),why:`${g.cases.length} เคส · ${g.people} คน · ใกล้กันในรัศมี 1 กม.`},d)});return}
    if(k==='stock'){let items=[];try{items=await stock()}catch(e){}const R=stockMatch(d,items);if(!R.length){note('ไม่มีข้อมูลสต็อกหรือความต้องการ');return}
      add(R.map(r=>`<b>${E(r.label)}</b> · มี ${E(r.have)} ${E(r.unit)} · ต้องใช้ ~${E(r.need)} (${E(r.cases)} เคส) · จัดได้ครบ ${E(r.ok)} เคส${r.short.length?` · <span style="color:#C62828">ขาด ${E(r.short.length)} เคส</span>`:' ✓'}${r.short.length?`<br><small>เคสที่ของไม่พอ: ${r.short.slice(0,6).map(c=>'#'+E(c.id)+' '+E(c.district||'')).join(', ')}${r.short.length>6?'…':''}</small>`:''}`).join('<br>'),'hz-m a');
      if(typeof LOCALAI!=='undefined'&&LOCALAI.on()){const go=()=>S.busy?setTimeout(go,600):ask('ดูผลจับคู่เคสกับสต็อก (ข้อมูลสต็อกอยู่ท้ายข้อมูล) แล้วแนะนำว่าควรเบิก/เติมอะไรก่อน และเคสไหนควรได้ของก่อน สั้น ๆ',{label:'ให้ AI HELP แนะนำการเบิกของ'});go()}return}
    if(k==='team')return quick('plan')}
  function caseLine(c){return `#${c.id} | ${URG[sevOf(c)]} | ${STS[c.status]||c.status} | ต้องการ: ${(c.needs||[]).join(', ')||'-'} | ${c.people||1} คน | ระดับน้ำ: ${c.levelText||c.level||'-'} | ${[c.district,c.province].filter(Boolean).join(' ')||'-'} | ที่อยู่: ${String(c.address||'').slice(0,80)||'-'} | ผู้แจ้ง: ${c.name||'-'} ${String(c.phone||'').replace(/^'/,'')} | ถุงยังชีพ ${c.bags===''||c.bags==null?'ยังไม่ระบุ':c.bags+' ถุง'} | รอ ${wait(c.createdAt)} | ทีม: ${vol(c)||'-'}${pin(c)?` | พิกัด ${(+c.lat).toFixed(4)},${(+c.lng).toFixed(4)}`:''}`}
  function context(d,P,stk){const open=d.cases.filter(c=>c.status!=='done'),crit=open.filter(c=>sevOf(c)===3&&c.status!=='going');
    const done7=d.cases.filter(c=>c.status==='done'&&(c.doneAt||c.updatedAt)>Date.now()-7*864e5).length;
    const top=open.slice().sort((a,b)=>sevOf(b)-sevOf(a)||(a.createdAt||0)-(b.createdAt||0)).slice(0,typeof LOCALAI!=='undefined'&&LOCALAI.isCloud&&LOCALAI.isCloud(LOCALAI.cfg())?18:35);
    const teams=d.roster.map(t=>{const p=teamPos(d,t.name),g=d.cases.filter(c=>c.status==='going'&&vol(c)===t.name);
      return `${t.name} | ${TST[t.status]||t.status||'-'} | พาหนะ ${t.vehicle||'-'} | ${t.members||'?'} คน | ${p?`ตำแหน่ง ${p.lat.toFixed(4)},${p.lng.toFixed(4)} (${p.src})`:'ไม่ทราบตำแหน่ง'} | รับอยู่ ${g.length} เคส${g.length?' ('+g.map(c=>'#'+c.id).join(', ')+')':''}`});
    let s=`ขอบเขต: ${d.title}\nเวลา: ${new Date().toLocaleString('th-TH')}\nตัวชี้วัด: เคสค้าง ${open.length} · วิกฤตยังไม่มีทีม ${crit.length} · กำลังไป ${open.filter(c=>c.status==='going').length} · ช่วยแล้ว 7 วัน ${done7} · รอเกิน 24 ชม. ${open.filter(c=>c.status!=='going'&&mins(c.createdAt)>1440).length}\n\nทีม (${d.roster.length}):\n${teams.join('\n')||'-'}\n\nเคสค้างที่สำคัญ (${top.length} จาก ${open.length}):\n${top.map(caseLine).join('\n')}`;
    if(P&&P.plan.length)s+=`\n\nแผนที่ระบบคำนวณ (ทีมว่าง × เคสสำคัญ + รวมเคสใกล้กัน):\n${P.plan.map(x=>`- ${x.team}: ${x.cases.map(c=>'#'+c.id).join(', ')} (${x.why})`).join('\n')}\nเคสที่ยังไม่มีทีมพอ: ${P.left}`;
    if(stk)s+='\n\n'+stockText(stk,d);
    if(S.focus){const f=d.cases.find(c=>String(c.id)===S.focus);if(f)s+=`\n\nเคสที่กำลังดู:\n${caseLine(f)}\nหมายเหตุผู้แจ้ง: ${f.notes||'-'}\nคนกลุ่มเปราะบาง: ${(f.vulnerable||[]).join(', ')||'-'}`}
    return s}
  const SYS=`\n\nกติกา:\n- ใช้เฉพาะข้อมูลที่ให้ ห้ามแต่งรหัสเคสหรือชื่อทีม ถ้าข้อมูลไม่พอให้บอกตรง ๆ\n- ตอบภาษาไทย สั้น เป็นข้อ ๆ\n- ถ้าจะเสนอการกระทำ ให้ใส่บล็อกนี้ท้ายคำตอบ (คนจะกดยืนยันเองทีละรายการ):\n\`\`\`actions\n[{"type":"assign","case":"<รหัสเคส>","team":"<ชื่อทีม>","reason":"<เหตุผลสั้น>"},{"type":"message","team":"<ชื่อทีม>","text":"<ข้อความถึงทีม>"}]\n\`\`\``;

  function parseActions(t,d){const m=String(t).match(/```actions\s*([\s\S]*?)```/)||String(t).match(/<actions>([\s\S]*?)<\/actions>/);if(!m)return {text:t,acts:[]};
    let a=[];try{a=JSON.parse(m[1])}catch(e){}const names=new Set(d.roster.map(x=>x.name)),ids=new Set(d.cases.map(c=>String(c.id)));
    const acts=(Array.isArray(a)?a:[]).filter(x=>x&&((x.type==='assign'&&ids.has(String(x.case).replace(/^#/,''))&&names.has(x.team))||(x.type==='message'&&names.has(x.team)&&x.text)))
      .map(x=>x.type==='assign'?{type:'assign',cases:[String(x.case).replace(/^#/,'')],team:x.team,why:x.reason||''}:{type:'message',team:x.team,text:String(x.text).slice(0,1000)});
    return {text:t.replace(m[0],'').trim(),acts}}
  async function run(a,d){
    if(a.type==='assign'){for(const id of a.cases){const r=await post({action:'update',id,status:'going',volunteer:a.team});if(!r.ok)throw new Error(r.error||'update')}
      d.cases.forEach(c=>{if(a.cases.includes(String(c.id))){c.status='going';c.volunteer=a.team}});S.at=0}
    if(a.type==='merge'){for(const c of a.dup){const r=await post({action:'update',id:c.id,status:'done',volunteer:vol(a.keep)||vol(c)||'',dupOf:String(a.keep.id)});if(!r.ok)throw new Error(r.error||'update')}
      d.cases=d.cases.filter(c=>!a.dup.includes(c));S.at=0}
    if(a.type==='message'){const r=await post({action:'chat_send',team:a.team,from:'hq',name:me(),text:a.text});if(!r.ok)throw new Error(r.error||'chat')}}

  const CSS=`.hz-fab{position:fixed;right:18px;bottom:86px;z-index:2490;width:52px;height:52px;padding:0;justify-content:center;border-radius:50%;border:0;cursor:pointer;display:flex;align-items:center;gap:6px;
      font:700 14px/1 inherit;color:#fff;background:linear-gradient(135deg,#17181C,#3a2c6e);box-shadow:0 8px 22px rgba(22,27,61,.3)}.hz-fab svg{width:24px;height:24px}
    .hz-win{position:fixed;right:18px;bottom:18px;z-index:2600;width:min(440px,calc(100vw - 24px));height:min(640px,calc(100vh - 110px));background:var(--surface,#fff);color:var(--ink);border-radius:24px;box-shadow:0 18px 48px rgba(22,27,61,.28);display:flex;flex-direction:column;overflow:hidden}
    .hz-h{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line,#ececf0)}.hz-h b{font-size:16px}.hz-h small{color:var(--muted);font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .hz-h a,.hz-h button{border:0;background:var(--bg,#f2f2f5);border-radius:50%;width:32px;height:32px;display:grid;place-items:center;cursor:pointer;color:inherit}.hz-h svg{width:17px;height:17px}
    .hz-dot{width:9px;height:9px;border-radius:50%;background:#c9ccd6}.hz-dot.on{background:#2E9E57}
    .hz-chips{display:flex;gap:6px;padding:8px 12px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--line,#ececf0)}.hz-chips button{flex:none;border:0;border-radius:999px;padding:6px 12px;font:600 13px/1.2 inherit;background:var(--tint,#FDEDEE);color:var(--primary,#DD2027);cursor:pointer}
    .hz-log{flex:1;overflow:auto;padding:12px;display:grid;gap:10px;align-content:start;background:var(--bg,#f5f5f7)}
    .hz-m{max-width:92%;border-radius:16px;padding:9px 12px;font-size:14.5px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.hz-m.u{justify-self:end;background:var(--primary,#DD2027);color:#fff}.hz-m.a{background:var(--surface,#fff);box-shadow:0 1px 2px rgba(22,27,61,.06)}.hz-m.n{background:transparent;color:var(--muted);font-size:13px;padding:2px 4px}
    .hz-act{background:var(--surface,#fff);border-radius:16px;padding:10px 12px;display:grid;gap:6px;box-shadow:inset 4px 0 0 #7B3FC4}.hz-act b{font-size:14px}.hz-act small{color:var(--muted);font-size:12.5px}
    .hz-act ul{margin:0;padding-left:18px;font-size:13.5px;display:grid;gap:2px}.hz-act textarea{font:inherit;font-size:14px;border:1px solid var(--line,#e8e8ec);border-radius:12px;padding:8px;resize:vertical;background:var(--surface,#fff);color:inherit}
    .hz-act select{font:inherit;font-size:14px;border:1px solid var(--line,#e8e8ec);border-radius:12px;padding:8px;background:var(--surface,#fff);color:inherit;max-width:100%}
    .hz-act label{font-size:13px;display:flex;gap:6px;align-items:center}.hz-act .row{display:flex;gap:6px;flex-wrap:wrap}
    .hz-act .row button{border:0;border-radius:999px;padding:7px 14px;font:700 13.5px/1 inherit;cursor:pointer}.hz-act .ok{background:#2E9E57;color:#fff}.hz-act .no{background:var(--bg,#f2f2f5);color:inherit}
    .hz-act.done{opacity:.6;box-shadow:inset 4px 0 0 #2E9E57}
    .hz-f{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line,#ececf0)}.hz-f input{flex:1;min-width:0;border:1px solid var(--line,#e8e8ec);border-radius:999px;padding:10px 14px;font:inherit;font-size:16px;background:var(--surface,#fff);color:inherit}
    .hz-f button{border:0;border-radius:999px;padding:0 16px;font:700 14px inherit;background:#17181C;color:#fff;cursor:pointer}
    .hz-sum{margin-left:8px;border:0;border-radius:999px;padding:4px 10px;font:700 12.5px inherit;background:#efe8fb;color:#5B2BA8;cursor:pointer;vertical-align:middle}
    .chat-draft{flex:none;border:0;border-radius:999px;padding:0 12px;font:700 13px inherit;background:#efe8fb;color:#5B2BA8;cursor:pointer}
    @media(max-width:760px){.hz-fab{bottom:calc(var(--tab-h,64px) + 84px + var(--safe-b,0px));right:14px;width:50px;height:50px}.hz-win{left:8px;right:8px;width:auto;bottom:calc(var(--tab-h,64px) + 24px + var(--safe-b,0px));height:min(70vh,calc(100vh - 150px))}}
    body.map-fs .hz-fab,body.noscroll .hz-fab{display:none}`;
  const SPARK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
  function build(){if(S.el||!KEY())return;const st=document.createElement('style');st.textContent=CSS;document.head.append(st);
    const fab=document.createElement('button');fab.type='button';fab.className='hz-fab';fab.innerHTML=SPARK;fab.title='AI HELP';fab.setAttribute('aria-label','AI HELP');fab.onclick=()=>toggle();document.body.append(fab);
    const w=document.createElement('section');w.className='hz-win';w.hidden=true;w.setAttribute('aria-label','AI HELP');
    w.innerHTML=`<header class="hz-h"><i class="hz-dot"></i><b>AI HELP</b><small class="hz-sc"></small><a href="${location.pathname.includes('/central/')?'../settings/':'./central/settings/'}" title="ตั้งค่า Local AI">${I('settings')}</a><button type="button" class="hz-x" aria-label="ปิด">${I('close')}</button></header>
      <div class="hz-chips"><button data-q="sum">สรุปสถานการณ์</button><button data-q="intel">น้ำ · ดาวเทียม · ข่าว</button><button data-q="plan">จัดเคสให้ทีม</button><button data-m="near">กลุ่มเคสใกล้กัน</button><button data-m="dup">หาเคสซ้ำ</button><button data-m="stock">เคส ↔ สต็อก</button><button data-q="first">เคสไหนก่อน</button><button data-q="msg">ร่างข้อความถึงทีม</button></div>
      <div class="hz-log" aria-live="polite"></div><form class="hz-f"><input placeholder="ถาม AI HELP…" maxlength="800" aria-label="คำถาม"><button>ถาม</button></form>`;
    document.body.append(w);S.el=w;S.fab=fab;
    w.querySelector('.hz-x').onclick=()=>toggle(false);
    w.querySelector('.hz-chips').onclick=e=>{const b=e.target.closest('[data-q]');if(b)quick(b.dataset.q);const m=e.target.closest('[data-m]');if(m)match(m.dataset.m)};
    w.querySelector('.hz-f').onsubmit=e=>{e.preventDefault();const i=w.querySelector('.hz-f input'),q=i.value.trim();if(!q)return;i.value='';ask(q)};
    w.querySelector('.hz-log').addEventListener('click',onAct);
    const css2=document.createElement('style');css2.textContent='.chat-fab[aria-expanded=true]~.hz-fab{display:none}';document.head.append(css2);
    drawerHook();setTimeout(()=>{data().catch(()=>{});stock()},1500)}
  function toggle(on){if(!S.el)build();if(!S.el)return;const v=on==null?S.el.hidden:on;S.el.hidden=!v;S.fab.hidden=v;
    if(v){data().catch(()=>{});S.el.querySelector('.hz-sc').textContent=S.scope&&S.scope.title?S.scope.title:'ภาพรวมทั้งหมด';const on2=typeof LOCALAI!=='undefined'&&LOCALAI.on();S.el.querySelector('.hz-dot').className='hz-dot'+(on2?' on':'');
      if(!S.log.length)note(on2?'ถามได้เลย หรือกดปุ่มด้านบน · ทุกการกระทำต้องกดยืนยันก่อน':'ยังไม่ได้เปิด Local AI · กด ⚙ เพื่อตั้งค่า (ปุ่ม "จัดเคสให้ทีม" ใช้ได้แม้ไม่มี AI)');setTimeout(()=>S.el.querySelector('.hz-f input').focus(),40)}}
  const log=()=>S.el.querySelector('.hz-log');
  function add(html,cls){const d=document.createElement('div');d.className=cls;d.innerHTML=html;log().append(d);log().scrollTop=log().scrollHeight;S.log.push(1);return d}
  const note=t=>add(E(t),'hz-m n');
  let actSeq=0;const ACTS=new Map();
  function actCard(a,d){const id='a'+(++actSeq);ACTS.set(id,{a,d});
    if(a.type==='merge'){const row=c=>`#${E(c.id)} · ${E(STS[c.status]||c.status)}${vol(c)?' · '+E(vol(c)):''} · ${E((c.needs||[]).join(', ')||'-')} · ${E(c.people||1)} คน · ${E(c.name||'')} ${E(String(c.phone||'').replace(/^'/,''))} · ${E(String(c.address||c.district||'').slice(0,50))} · แจ้ง ${E(wait(c.createdAt))}ก่อน`;
      return add(`<b>${I('copy')} เคสซ้ำ ${a.dup.length+1} เคส</b><small>${E(a.why)}</small><ul><li><b>เก็บ</b> ${row(a.keep)}</li>${a.dup.map(c=>`<li>รวมเข้า: ${row(c)}</li>`).join('')}</ul>
        <div class="row"><button type="button" class="ok" data-run="${id}">ยืนยันรวมเคส</button><button type="button" class="no" data-skip="${id}">ไม่ใช่เคสซ้ำ</button></div>`,'hz-act')}
    if(a.type==='assign'){const cs=a.cases.map(x=>d.cases.find(c=>String(c.id)===x)).filter(Boolean);
      if(a.choices&&a.choices.length)return add(`<b>${I('users')} ${cs.length>1?`กลุ่ม ${cs.length} เคส · เลือกทีม`:`เลือกทีมให้เคส #${E(cs[0]&&cs[0].id)}`}</b>${a.why?`<small>${E(a.why)}</small>`:''}<ul>${cs.map(c=>`<li>#${E(c.id)} · ${URG[sevOf(c)]} · ${E((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')} · ${E(c.people||1)} คน · ${E(c.district||'')}</li>`).join('')}</ul>
        <select data-team>${a.choices.map(x=>`<option value="${E(x.name)}">${E(x.name)} · ${E(x.why)}</option>`).join('')}</select>
        <label><input type="checkbox" data-notify checked> ส่งรายละเอียดเคสให้ทีมทางแชทด้วย</label><div class="row"><button type="button" class="ok" data-run="${id}">ยืนยันมอบกลุ่มนี้</button><button type="button" class="no" data-skip="${id}">ข้าม</button></div>`,'hz-act');
      return add(`<b>${I('users')} มอบ ${cs.length} เคส ให้ ${E(a.team)}</b>${a.why?`<small>${E(a.why)}</small>`:''}<ul>${cs.map(c=>`<li>#${E(c.id)} · ${URG[sevOf(c)]} · ${E((c.needs||[]).join(', ')||'ขอความช่วยเหลือ')} · ${E(c.people||1)} คน · ${E(c.district||'')}${c.name?' · '+E(c.name):''}</li>`).join('')}</ul>
        <label><input type="checkbox" data-notify checked> ส่งรายละเอียดเคสให้ทีมทางแชทด้วย</label><div class="row"><button type="button" class="ok" data-run="${id}">ยืนยันมอบเคส</button><button type="button" class="no" data-skip="${id}">ข้าม</button></div>`,'hz-act')}
    return add(`<b>${I('chat')} ข้อความถึง ${E(a.team)}</b><textarea rows="3" data-text>${E(a.text)}</textarea><div class="row"><button type="button" class="ok" data-run="${id}">ยืนยันส่ง</button><button type="button" class="no" data-skip="${id}">ข้าม</button></div>`,'hz-act')}
  async function onAct(e){const sk=e.target.closest('[data-skip]');if(sk){const card=sk.closest('.hz-act');card.classList.add('done');card.querySelector('.row').innerHTML='<small>ข้ามแล้ว</small>';return}
    const b=e.target.closest('[data-run]');if(!b)return;const {a,d}=ACTS.get(b.dataset.run)||{};if(!a)return;const card=b.closest('.hz-act');
    if(a.type==='message')a.text=card.querySelector('[data-text]').value.trim();const ts=card.querySelector('[data-team]');if(ts)a.team=ts.value;if(a.type==='assign')a.notify=card.querySelector('[data-notify]').checked;
    b.disabled=true;b.textContent='กำลังทำ…';
    try{await run(a,d);card.classList.add('done');card.querySelector('.row').innerHTML=`<small>✓ ${a.type==='assign'?'มอบเคสให้ '+E(a.team)+' แล้ว':a.type==='merge'?'รวมเคสแล้ว':'ส่งแล้ว'} โดย ${E(me())}</small>`;if(typeof toast==='function')toast('ทำแล้ว',true);
      window.dispatchEvent(new CustomEvent('hermes:done',{detail:a}))}
    catch(err){b.disabled=false;b.textContent='ลองอีกครั้ง';note('ทำไม่สำเร็จ: '+(err.message||''))}}

  const hist=[];
  async function ask(q,o={}){if(S.busy){note('รอคำตอบก่อนหน้าให้เสร็จก่อน');return}S.busy=true;add(E(o.label||q),'hz-m u');
    const t0=Date.now(),wait1=note('AI HELP กำลังคิด…'),tick=setInterval(()=>{wait1.textContent=`AI HELP กำลังคิด… ${Math.round((Date.now()-t0)/1000)} วิ`},1000);
    let bub=null;
    try{const [d,stk]=await Promise.all([data(),stock()]),P=o.plan||null,F=await fiw(d).catch(()=>null),ctx=context(d,P,stk)+(F?'\n\n'+fiwText(F):'');
      if(typeof LOCALAI==='undefined'||!LOCALAI.on()){wait1.remove();note('ยังไม่ได้เปิด Local AI · กด ⚙ เพื่อตั้งค่า');return}
      const sys=(LOCALAI.cfg().system||'').replace('คุณคือ Hermes','คุณคือ AI HELP')+SYS;
      const msgs=[{role:'system',content:sys},{role:'user',content:'ข้อมูลปัจจุบัน:\n'+ctx},{role:'assistant',content:'รับทราบข้อมูลแล้ว'},...hist.slice(-6),{role:'user',content:q+'\n(ตอบกระชับ ไม่เกิน 10 บรรทัด)'}];
      const clean=t=>String(t).split('```')[0].replace(/<actions>[\s\S]*/,'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/^#{1,4}\s*/gm,'').trim();
      const ans=await LOCALAI.ask(msgs,{timeout:180000,max_tokens:700,onToken:all=>{if(!bub){clearInterval(tick);wait1.remove();bub=add('','hz-m a')}bub.textContent=clean(all);log().scrollTop=log().scrollHeight}});
      clearInterval(tick);wait1.remove();hist.push({role:'user',content:q},{role:'assistant',content:ans});
      const {text,acts}=parseActions(ans,d);if(!bub)bub=add('','hz-m a');bub.textContent=clean(text)||'(ไม่มีข้อความ)';acts.forEach(a=>actCard(a,d));
      if(o.plan&&!acts.length&&P.plan.length)note('ใช้แผนที่ระบบคำนวณด้านบนได้เลย');
      if(acts.length)note(`เสนอ ${acts.length} รายการ · ${Math.round((Date.now()-t0)/1000)} วิ`)}
    catch(e){clearInterval(tick);wait1.remove();note('ถาม AI HELP ไม่สำเร็จ: '+(e.name==='AbortError'?'หมดเวลา':e.message||'ตรวจการตั้งค่า Local AI'))}
    finally{clearInterval(tick);S.busy=false}}
  async function quick(k){
    if(k==='intel')return ask('วิเคราะห์สถานการณ์จากข้อมูลภายนอกในฐานข้อมูล (ประกาศกรมอุตุฯ ข่าว ระดับน้ำ ThaiWater เซ็นเซอร์น้ำ กทม. ดาวเทียม GISTDA): พื้นที่ไหนน่าห่วง เคสไหนที่ดาวเทียมยืนยันว่าอยู่ในน้ำท่วมควรส่งทีมก่อน และควรเตรียมอะไรใน 24 ชม.ข้างหน้า · อ้างแหล่งข้อมูล',{label:'น้ำ · ดาวเทียม · ข่าว'});
    if(k==='sum')return ask('สรุปสถานการณ์ตอนนี้: จุดที่น่าห่วงที่สุด 3 ข้อ ทีมพร้อมแค่ไหน และควรทำอะไรต่อทันที',{label:'สรุปสถานการณ์'});
    if(k==='first')return ask('เคสไหนควรส่งทีมก่อน 5 อันดับ พร้อมเหตุผลสั้น ๆ และเสนอทีมที่เหมาะ (ใส่ actions)',{label:'เคสไหนก่อน'});
    if(k==='msg')return ask('ร่างข้อความถึงทีมที่กำลังลงพื้นที่ ทีมละ 1 ข้อความ สั้น ชัด บอกสิ่งที่ต้องทำต่อ (ใส่ actions แบบ message)',{label:'ร่างข้อความถึงทีม'});
    if(k==='plan'){add('จัดเคสให้ทีม','hz-m u');let d;try{d=await data()}catch(e){note('โหลดข้อมูลไม่ได้');return}
      const P=plan(d);if(!P.plan.length){note(P.teams?'ไม่มีเคสค้างที่ยังไม่มีทีม':'ไม่มีทีมว่างตอนนี้');return}
      note(`ระบบคำนวณ: ${P.teams} ทีมว่าง · จัดได้ ${P.plan.reduce((a,x)=>a+x.cases.length,0)} เคส · ยังเหลือ ${P.left} เคส`);
      P.plan.forEach(x=>actCard({type:'assign',team:x.team,cases:x.cases.map(c=>String(c.id)),why:x.why},d));
      if(typeof LOCALAI!=='undefined'&&LOCALAI.on()){const go=()=>S.busy?setTimeout(go,600):ask('ตรวจแผนจัดเคสที่ระบบคำนวณ (อยู่ท้ายข้อมูล) ว่าเหมาะไหม มีจุดเสี่ยงอะไร ถ้าควรปรับให้เสนอ actions ใหม่ ถ้าดีแล้วตอบสั้น ๆ',{label:'ให้ AI HELP ตรวจแผน',plan:P});go()}}}
  function drawerHook(){const dr=document.getElementById('drawer');if(!dr)return;
    new MutationObserver(()=>{const sm=dr.querySelector('.d-head small');if(!sm||dr.querySelector('.hz-sum'))return;const b=document.createElement('button');b.type='button';b.className='hz-sum hz-ic';b.title='สรุปด้วย AI';b.setAttribute('aria-label','สรุปด้วย AI');b.innerHTML='<span aria-hidden="true">✦</span>';
      b.onclick=()=>{S.focus=String(dr.dataset.case||'').replace(/^hm-/,'');toggle(true);ask('สรุปเคสที่กำลังดู: สถานการณ์ ความเสี่ยง สิ่งที่ต้องเตรียม และเสนอทีมที่เหมาะ (ใส่ actions ถ้ามีทีมเหมาะ)',{label:'สรุปเคสนี้'})};const row=document.createElement('div');row.className='hz-row';row.append(b);sm.after(row);
      const t=document.createElement('button');t.type='button';t.className='hz-sum hz-ic';t.title='หาทีมให้เคสนี้';t.setAttribute('aria-label','หาทีมให้เคสนี้');t.innerHTML=(typeof ic==='function'?ic('users'):'👥')+'<span class="hz-spark" aria-hidden="true">✦</span>';t.onclick=async()=>{const id=String(dr.dataset.case||'').replace(/^hm-/,'');toggle(true);add('หาทีมให้เคสนี้','hz-m u');
        const d=await data(),c=d.cases.find(x=>String(x.id)===id);if(!c){note('ไม่พบเคสในข้อมูล');return}const T=teamsFor(d,c);if(!T.length){note('ไม่มีทีมที่ว่าง');return}
        note('ทีมที่เหมาะ (เลือกแล้วกดยืนยัน)');actCard({type:'assign',team:T[0].t.name,choices:T.slice(0,6).map(x=>({name:x.t.name,why:x.why})),cases:[id],why:'เรียงจากใกล้ · ว่าง · พาหนะเหมาะ'},d)};row.append(t)}).observe(dr,{childList:true,subtree:true})}
  async function draft(team,msgs){if(typeof LOCALAI==='undefined'||!LOCALAI.on())throw new Error('ยังไม่ได้เปิด Local AI (หน้า ตั้งค่า)');
    const d=await data().catch(()=>null),t=d&&d.roster.find(x=>x.name===team),g=d?d.cases.filter(c=>c.status==='going'&&vol(c)===team):[];
    const conv=(msgs||[]).slice(-12).map(m=>`${m.sender==='hq'?'ศูนย์':team}: ${m.kind==='sos'?'[SOS] ':''}${m.text||(m.lat!=null?'[ส่งตำแหน่ง]':'')}`).join('\n');
    const ans=await LOCALAI.ask([{role:'system',content:(LOCALAI.cfg().system||'')+'\nร่างข้อความตอบกลับจากศูนย์ถึงทีมภาคสนาม 1 ข้อความ สั้น ชัด ทำได้จริง ไม่ต้องมีคำอธิบายอื่น'},
      {role:'user',content:`ทีม: ${team}${t?` (${TST[t.status]||''} · พาหนะ ${t.vehicle||'-'})`:''}\nเคสที่ทีมรับอยู่:\n${g.map(caseLine).join('\n')||'-'}\n\nบทสนทนาล่าสุด:\n${conv||'-'}\n\nร่างข้อความตอบของศูนย์:`}],{timeout:120000});
    return ans.replace(/```[\s\S]*?```/g,'').replace(/^["“]|["”]$/g,'').trim()}
  const t0=setInterval(()=>{if(KEY()&&document.getElementById('app')&&!document.getElementById('app').hidden&&!document.documentElement.classList.contains('embed')){clearInterval(t0);build()}},1200);
  return {open:q=>{toggle(true);if(q)ask(q)},plan,dups,clusters,teamsFor,setScope:sc=>{S.scope=sc||null;if(S.el&&!S.el.hidden)S.el.querySelector('.hz-sc').textContent=sc&&sc.title||'ภาพรวมทั้งหมด'},draft};
})();
