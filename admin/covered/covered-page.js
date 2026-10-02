/* หน้า "พื้นที่มอบแล้ว": ตารางสดจากชีต + นับเคสที่อาจซ้ำ */
const P={cases:[],org:'',q:''};
$('#sheet-link').href=COVERED.SHEET_URL;
function render(){
  const rows=COVERED.C.rows.slice().sort((a,b)=>b.t-a.t||a.org.localeCompare(b.org,'th'));
  const st=$('#status');
  if(!rows.length){st.hidden=false;st.innerHTML=COVERED.C.error?esc(COVERED.C.error)+' · ตรวจว่าชีตแชร์แบบ "ทุกคนที่มีลิงก์ดูได้" <button class="linkish" id="retry">ลองใหม่</button>':'กำลังโหลดข้อมูลจากชีต…';
    const r=$('#retry');if(r)r.onclick=()=>{COVERED.C.loaded=0;load()};$('#tb').innerHTML='';$('#stats').innerHTML='';return}
  st.hidden=true;
  // นับเคสที่ยังไม่เสร็จที่ตรงกับแต่ละพื้นที่
  const hit=new Map();P.cases.filter(c=>c.status!=='done').forEach(c=>{const m=COVERED.match(c);if(m)m.all.forEach(h=>{const a=hit.get(h.r)||[];a.push(c);hit.set(h.r,a)})});
  const orgs=[...new Set(rows.map(r=>r.org).filter(Boolean))];
  $('#orgs').innerHTML=['',...orgs].map(o=>`<button data-o="${esc(o)}" aria-selected="${o===P.org}">${o?esc(o):'ทั้งหมด'} <small>${o?rows.filter(r=>r.org===o).length:rows.length}</small></button>`).join('');
  const q=P.q.trim().toLowerCase();
  const v=rows.filter(r=>(!P.org||r.org===P.org)&&(!q||[r.org,r.area,r.district,r.note].join(' ').toLowerCase().includes(q)));
  const sets=v.reduce((a,r)=>a+(parseInt(String(r.sets).replace(/,/g,''))||0),0);
  $('#stats').innerHTML=[[v.length,'พื้นที่'],[orgs.length,'องค์กร'],[v.filter(r=>!r.link).length,'ยังไม่มีลิงก์แผนที่'],[sets?nf(sets):'–','ชุดที่ระบุ'],[v.filter(r=>hit.has(r)).length,'พื้นที่ที่มีเคสอาจซ้ำ']]
    .map(([n,l],i)=>`<div class="cv-stat${i===4&&n?' alert':''}"><b>${n}</b><span>${l}</span></div>`).join('');
  $('#tb').innerHTML=v.length?v.map(r=>{const cs=hit.get(r)||[];
    const map=r.link?`<a href="${esc(r.link)}" target="_blank" rel="noopener">เปิดแผนที่ ↗</a>`:'<span class="cv-warn">ยังไม่มีลิงก์</span>';
    const pos=r.lat==null?'<small class="muted">ไม่พบตำแหน่ง</small>':r.approx?'<small class="muted">ตำแหน่งโดยประมาณ</small>':'<small class="cv-ok">ตำแหน่งจากลิงก์</small>';
    return `<tr><td data-l="องค์กร"><span class="cov">${esc(r.org)}</span></td><td data-l="พื้นที่"><b>${esc(r.area)}</b>${r.note?`<small class="muted cv-note">${esc(r.note)}</small>`:''}</td><td data-l="เขต">${esc(r.district)}</td><td data-l="วันที่" class="d">${esc(r.date)}</td><td data-l="ชุด" class="n">${r.sets?nf(String(r.sets).replace(/,/g,'')):''}</td><td data-l="แผนที่">${map}<br>${pos}</td>
      <td data-l="เคสที่อาจซ้ำ">${cs.length?`<a class="cv-dup" href="../../admin.html" title="${esc(cs.map(c=>'#'+c.id+' '+(c.address||'')).join('\n'))}">${cs.length} เคส</a>`:'<span class="muted">–</span>'}</td></tr>`}).join(''):'<tr><td colspan="7" class="empty">ไม่พบพื้นที่ที่ตรงกับการค้นหา</td></tr>';
  $('#sync').textContent=COVERED.C.loaded?'อัปเดต '+ago(COVERED.C.loaded):'';
}
function load(){render();return COVERED.load(API_URL,ADM.key).then(render,render)}
$('#orgs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;P.org=b.dataset.o;render()});
$('#q').addEventListener('input',e=>{P.q=e.target.value;render()});
$('#refresh').addEventListener('click',async()=>{COVERED.C.loaded=0;const r=await apiGet({action:'list'}).catch(()=>null);if(r&&r.cases)P.cases=r.cases;load()});
setInterval(()=>{if(!document.hidden)load()},5*60e3);
adminBoot({action:'list'},'cases',r=>{P.cases=r.cases||[];load()});
