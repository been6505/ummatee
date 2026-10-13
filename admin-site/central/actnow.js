// "ต้องจัดการตอนนี้" — คิวงานของศูนย์ เหนือการ์ดสถิติในหน้าจัดการเคส
// 1) เคสที่ยังไม่มีทีม เรียงตามความเร่งด่วน + เวลาที่รอ พร้อมปุ่มมอบทีมที่ใกล้ที่สุดกดครั้งเดียว
// 2) ทีมแจ้งปัญหา  3) ทีมแจ้งช่วยเหลือแล้ว รอศูนย์ยืนยัน
// ระยะทางเป็นเส้นตรงจากตำแหน่งล่าสุดของทีม (T.live จาก routeshim.js) — บอกว่า "เส้นตรง" ให้ชัด ไม่อ้างเป็นเวลาเดินทาง
const ACTNOW=(()=>{
  const LIVE_MAX=30*60e3,SHOW=matchMedia('(max-width:760px)').matches?3:5,tn=s=>String(s||'').replace(/^'/,'').trim();
  // เกณฑ์เวลารอที่ถือว่า "เกินแล้ว" (นาที) ตามระดับ
  const LATE={3:15,2:30,1:60};
  let open=true;try{open=localStorage.getItem('uh_actnow_open')!=='0'}catch(e){}
  let all=false,busy=new Set();
  const mins=t=>Math.max(0,Math.round((Date.now()-Number(t||0))/60000));
  const dur=m=>m<60?m+' นาที':m<1440?Math.floor(m/60)+' ชม. '+(m%60?m%60+' นาที':''):Math.floor(m/1440)+' วัน';
  function activeOf(team){return (A.cases||[]).filter(c=>tn(c.volunteer)===team&&c.status==='going'&&!c.teamDoneAt).length}
  function teams(c){
    if(!hasPin(c))return [];
    const rest=new Set((A.roster||[]).filter(t=>t.status==='rest').map(t=>t.name)),known=new Set((A.roster||[]).map(t=>t.name));
    return (T.live||[]).filter(t=>t.lat!=null&&t.lng!=null&&Date.now()-t.updatedAt<LIVE_MAX&&!rest.has(t.team)&&(!A.roster||known.has(t.team)))
      .map(t=>({name:t.team,d:km(+c.lat,+c.lng,+t.lat,+t.lng),n:activeOf(t.team),age:mins(t.updatedAt)}))
      .sort((a,b)=>(a.n>0)-(b.n>0)||a.d-b.d);
  }
  function items(){
    const cs=(A.cases||[]).filter(c=>!c.dupOf),out=[];
    for(const c of cs){const s=stOf(c);
      if(s==='open'&&!tn(c.volunteer))out.push({k:'new',c,t:c.createdAt,sv:sev(c)});
      else if(c.teamIssue&&c.status!=='done'&&s!=='teamdone')out.push({k:'issue',c,t:c.teamIssueAt||c.updatedAt,sv:4});
      else if(s==='teamdone')out.push({k:'confirm',c,t:c.teamDoneAt,sv:0});}
    // ปัญหาจากทีมขึ้นก่อน → เคสใหม่ (วิกฤต→ทั่วไป, รอนานก่อน) → รอยืนยัน
    const rank={issue:0,new:1,confirm:2};
    return out.sort((a,b)=>rank[a.k]-rank[b.k]||b.sv-a.sv||Number(a.t||0)-Number(b.t||0));
  }
  function row(it){const c=it.c,m=mins(it.t),id=esc(c.id),late=it.k==='new'&&m>=LATE[it.sv],title=esc((c.needs||[]).join(' · ')||'ขอความช่วยเหลือ');
    const where=esc([c.district?'เขต'+String(c.district).replace(/^เขต/,''):'',c.people>1?c.people+' คน':''].filter(Boolean).join(' · '));
    const tag=it.k==='issue'?'<span class="an-tag an-issue">ทีมแจ้งปัญหา</span>':it.k==='confirm'?'<span class="an-tag an-ok">รอยืนยัน ช่วยแล้ว</span>':`<span class="an-tag an-u${it.sv}">${URG[it.sv]}</span>`;
    const wait=it.k==='new'?`รอ ${dur(m)}`:it.k==='issue'?`${esc(c.teamIssue||'')} · ${dur(m)}`:`ทีม${esc(tn(c.volunteer))} · ${dur(m)}`;
    let act='';
    if(it.k==='new'){const ts=teams(c),b=ts[0];
      act=b?`<button type="button" class="an-go" data-an-assign="${id}" data-an-team="${esc(b.name)}" ${busy.has(c.id)?'disabled':''}><i data-ic="check"></i><span>มอบ <b>${esc(b.name)}</b><small>${b.d<1?Math.round(b.d*1000)+' ม.':b.d.toFixed(1)+' กม.'} เส้นตรง · ${b.n?'มีงาน '+b.n+' เคส':'ว่าง'}</small></span></button>`
        +`<button type="button" class="an-more" data-an-open="${id}">${ts.length>1?'ทีมอื่น':'เลือกเอง'}</button>`
        :`<button type="button" class="an-more" data-an-open="${id}" title="${hasPin(c)?'ยังไม่มีทีมที่ส่งตำแหน่งใน 30 นาที':'เคสนี้ไม่มีพิกัด'}">เลือกทีม</button>`}
    else act=`<button type="button" class="an-more" data-an-open="${id}">เปิดเคส</button>`;
    return `<li class="an-i${late?' an-late':''}${act.includes('an-go')?' an-sug':''}"><div class="an-h" data-an-open="${id}"><div class="an-t">${tag}<b>${title}</b></div><small>${where?where+' · ':''}<span class="an-w">${wait}</span></small></div><div class="an-a">${act}</div></li>`}
  function draw(){let box=document.getElementById('actnow');const st=document.getElementById('stats');if(!st||!A.key)return;
    if(!box){box=document.createElement('section');box.id='actnow';box.className='actnow';box.setAttribute('aria-label','ต้องจัดการตอนนี้');st.before(box);
      box.addEventListener('click',onClick)}
    const L=items(),late=L.filter(x=>x.k==='new'&&mins(x.t)>=LATE[x.sv]).length;
    if(!L.length){box.innerHTML=`<div class="an-top"><span class="an-ic an-ok"><i data-ic="check"></i></span><b class="an-ttl">ไม่มีงานค้าง</b><small>ทุกเคสมีทีมดูแลแล้ว</small></div>`;box.classList.add('an-empty');box.hidden=false;return}
    box.classList.remove('an-empty');
    const shown=all?L:L.slice(0,SHOW);
    // หัวกล่องบรรทัดเดียว: ไอคอน + ชื่อ + จำนวน (แดงเมื่อมีเคสเกินเวลา) · ป้าย "เกิน N" เฉพาะเมื่อเกินบางส่วน
    box.innerHTML=`<button type="button" class="an-top" data-an-toggle aria-expanded="${open}"><span class="an-ic"><i data-ic="alert"></i></span><b class="an-ttl">ต้องจัดการตอนนี้</b><span class="an-n${late?' an-hot':''}">${L.length}</span>${late&&late<L.length?`<small class="an-latec">เกิน ${late}</small>`:''}<i data-ic="chev" class="an-chev"></i></button>`
      +(open?`<ul class="an-list">${shown.map(row).join('')}</ul>${L.length>SHOW?`<button type="button" class="an-all" data-an-all>${all?'ย่อรายการ':`ดูทั้งหมด ${L.length} รายการ`}<i data-ic="chev"></i></button>`:''}`:'');
  }
  async function onClick(e){const g=e.target.closest('[data-an-assign]');
    if(g){const id=g.dataset.anAssign,team=g.dataset.anTeam;busy.add(id);draw();try{await changeStatus(id,'assigned',null,team)}finally{busy.delete(id);draw()}return}
    const o=e.target.closest('[data-an-open]');if(o){openDrawer(o.dataset.anOpen);return}
    if(e.target.closest('[data-an-toggle]')){open=!open;try{localStorage.setItem('uh_actnow_open',open?'1':'0')}catch(e2){}draw();return}
    if(e.target.closest('[data-an-all]')){all=!all;draw()}}
  async function live(){if(!A.key||document.hidden)return;await rtLive();draw()}
  // เรียกทุกครั้งที่หน้าเคส render ใหม่ (ข้อมูลเปลี่ยน) + อัปเดตตำแหน่งทีม/เวลารอทุก 60 วินาที
  const base=render;render=function(){const r=base.apply(this,arguments);try{draw()}catch(e){}return r};
  setInterval(()=>{if(A.key&&!document.hidden)live()},60e3);
  setTimeout(live,1500);
  return {draw,items,teams}})();
