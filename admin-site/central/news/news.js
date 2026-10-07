/* ข่าวและเตือนภัย: ประกาศกรมอุตุฯ + แผ่นดินไหวใกล้ไทย + หัวข้อข่าวล่าสุด (API action=news ดึงและแคชที่ Worker) */
const N={data:null,tag:'',q:'',timer:null};
const TAGS=[['','ทั้งหมด'],['flood','น้ำท่วม'],['storm','พายุ / ฝน'],['alert','ประกาศ / เตือนภัย'],['quake','แผ่นดินไหว']];
const fmtD=t=>t?new Date(t).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
const live=w=>{const n=Date.now();return(!w.start||w.start<=n)&&(!w.end||w.end>=n)};

function render(){
  const d=N.data;if(!d)return;
  $('#warn').innerHTML=d.warnings.length?d.warnings.map((w,i)=>`<article class="nw-warn${live(w)?' live':''}">
      <div class="nw-wt">${live(w)?'<span class="nw-badge">มีผลตอนนี้</span>':''}<b>${esc(w.title)}</b></div>
      <p class="muted small">ประกาศ ${esc(fmtD(w.announced))}${w.start||w.end?` · มีผล ${esc(fmtD(w.start))} – ${esc(fmtD(w.end))}`:''}</p>
      <details${i===0?' open':''}><summary>อ่านประกาศ</summary><p class="nw-txt">${esc(w.text)}</p></details>
      <p class="small">${w.url&&/^https:\/\//.test(w.url)?`<a href="${esc(w.url)}" target="_blank" rel="noopener">ฉบับเต็ม (PDF) ↗</a> · `:''}${esc(w.contact)}</p>
    </article>`).join(''):'<p class="muted">ตอนนี้ไม่มีประกาศเตือนภัยที่ยังมีผล</p>';
  $('#quake').innerHTML=d.quakes.length?`<ul class="nw-quakes">${d.quakes.map(q=>`<li><b class="mag${q.mag>=5?' hi':''}">${esc(q.mag.toFixed(1))}</b><span>${esc(q.place)}<small class="muted">${esc(fmtD(q.time))} · ลึก ${esc(q.depth)} กม.</small></span></li>`).join('')}</ul>`:'<p class="muted">ไม่มีรายงานแผ่นดินไหวในภูมิภาค</p>';
  const cnt=k=>k?d.news.filter(n=>n.tags.includes(k)).length:d.news.length;
  $('#tags').innerHTML=TAGS.map(([k,l])=>`<button data-t="${k}" aria-selected="${k===N.tag}">${l} <small>${cnt(k)}</small></button>`).join('');
  const q=N.q.trim().toLowerCase(),list=d.news.filter(n=>(!N.tag||n.tags.includes(N.tag))&&(!q||(n.title+' '+n.source).toLowerCase().includes(q)));
  $('#news').innerHTML=list.length?list.map(n=>`<li><a href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a><small class="muted">${esc(n.source)}${n.time?' · '+esc(ago(n.time)):''}</small></li>`).join(''):'<li class="muted">ไม่พบข่าวที่ตรงกับตัวกรอง</li>';
  const err=d.errors&&d.errors.length?' · บางแหล่งโหลดไม่ได้ ลองใหม่ภายหลัง':'';
  $('#status').textContent=`อัปเดต ${ago(d.time)} · ประกาศ ${d.warnings.length} ฉบับ · ข่าว ${d.news.length} ข่าว${err}`;
}

async function load(){
  $('#refresh').disabled=true;
  try{const r=await apiGet({action:'news'});if(!r||!r.ok)throw new Error(r&&r.error);N.data=r;render()}
  catch(e){$('#status').textContent='โหลดข่าวไม่สำเร็จ ลองกด "โหลดใหม่" อีกครั้ง'}
  finally{$('#refresh').disabled=false}
}

$('#tags').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;N.tag=b.dataset.t;render()});
$('#q').addEventListener('input',e=>{N.q=e.target.value;render()});
$('#refresh').addEventListener('click',load);
adminBoot({action:'chat_rev'},'rev',()=>{load();clearInterval(N.timer);N.timer=setInterval(()=>{if(!document.hidden)load()},10*60000)});
