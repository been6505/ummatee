/* บอร์ดงาน: ทีมงานศูนย์วางแผนงาน · แยกตาม War Room (CENTRAL = บอร์ดกลาง)
   มุมมอง: บอร์ด (ต้องทำ · กำลังทำ · เสร็จ) และปฏิทินรายเดือน · การ์ดมีข้อความ รูป หมุดตำแหน่ง เคส วัน-เวลา ผู้รับผิดชอบ */
const BOARD=(()=>{
  const B={room:null,cards:[],rev:'',view:'board',month:null,img:new Map(),edit:null,map:null,mk:null,timer:null,drag:null};
  const COLS=[['todo','ต้องทำ'],['doing','กำลังทำ'],['done','เสร็จ']];
  const COLOR={'':'#9AA1B9',red:'#E5383B',orange:'#E8890C',green:'#2E9E57',blue:'#2D45C8',purple:'#7C4DFF'};
  const TH_D=['อา','จ','อ','พ','พฤ','ศ','ส'];
  const pad=n=>String(n).padStart(2,'0');
  const fmt=t=>t?new Date(t).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
  const fmtD=t=>t?new Date(t).toLocaleDateString('th-TH',{day:'numeric',month:'short'}):'';
  const toLocal=t=>{if(!t)return '';const d=new Date(t);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const fromLocal=v=>v?new Date(v).getTime():null;
  const roomKey=()=>(typeof room==='function'&&room()?room().id:'central');
  const me=()=>{try{return localStorage.getItem('uh_staff')||''}catch(e){return ''}};
  const caseOf=id=>W.cases.find(c=>String(c.id)===String(id)||String(c.hmId||'')===String(id));
  async function load(force){const k=roomKey();if(k!==B.room){B.room=k;B.cards=[];B.rev='';B.img.clear()}
    try{const r=await apiGet({action:'board_list',room:k});if(r&&r.ok&&(force||r.rev!==B.rev||r.room!==k)){B.cards=r.cards||[];B.rev=r.rev;if(!B.edit)draw()}}catch(e){}}
  async function img(id,el){if(B.img.has(id)){el.src=B.img.get(id);return}try{const r=await apiGet({action:'board_img',id});if(r&&r.ok){B.img.set(id,r.data);el.src=r.data}}catch(e){}}
  function loadImgs(root){root.querySelectorAll('img[data-img]').forEach(i=>img(i.dataset.img,i))}
  function due(c){if(!c.due)return '';const late=c.status!=='done'&&c.due<Date.now();return `<span class="bd-due${late?' late':''}"><i data-ic="clock"></i> ${c.allDay?fmtD(c.due):fmt(c.due)}${c.dueEnd?' – '+(c.allDay?fmtD(c.dueEnd):fmt(c.dueEnd)):''}</span>`}
  function card(c){return `<article class="bd-card" draggable="true" data-card="${esc(c.id)}" style="--c:${COLOR[c.color]||COLOR['']}">
      <b>${esc(c.title)}</b>${c.body?`<p>${esc(c.body.slice(0,140))}${c.body.length>140?'…':''}</p>`:''}
      ${c.imgs.length?`<div class="bd-thumbs">${c.imgs.slice(0,3).map(i=>`<img data-img="${esc(i)}" alt="">`).join('')}${c.imgs.length>3?`<span>+${c.imgs.length-3}</span>`:''}</div>`:''}
      <div class="bd-meta">${due(c)}${c.lat!=null?'<span><i data-ic="pin"></i> '+esc(c.place||'มีหมุด')+'</span>':''}${c.cases.length?`<span><i data-ic="list"></i> ${c.cases.length} เคส</span>`:''}${c.assignee?`<span><i data-ic="user"></i> ${esc(c.assignee)}</span>`:''}</div>
      <div class="bd-mv">${c.status!=='todo'?`<button type="button" data-mv="${esc(c.id)}" data-to="${c.status==='done'?'doing':'todo'}" aria-label="ย้ายกลับ">‹</button>`:''}${c.status!=='done'?`<button type="button" data-mv="${esc(c.id)}" data-to="${c.status==='todo'?'doing':'done'}" aria-label="ย้ายต่อ">›</button>`:''}</div></article>`}
  function boardView(){return `<div class="bd-cols">${COLS.map(([k,t])=>{const cs=B.cards.filter(c=>c.status===k);return `<section class="bd-col" data-col="${k}"><h3>${t} <span>${cs.length}</span></h3>${cs.map(card).join('')||'<p class="bd-empty">ลากการ์ดมาวาง</p>'}${k==='todo'?'<button type="button" class="bd-add" data-new="">+ เพิ่มงาน</button>':''}</section>`}).join('')}</div>`}
  function calView(){const m=B.month||new Date(new Date().getFullYear(),new Date().getMonth(),1),y=m.getFullYear(),mo=m.getMonth(),first=new Date(y,mo,1),start=new Date(y,mo,1-first.getDay()),today=new Date().toDateString();
    const days=[];for(let i=0;i<42;i++){const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i);days.push(d)}
    const on=d=>B.cards.filter(c=>{if(!c.due)return false;const s=new Date(c.due),e=new Date(c.dueEnd||c.due);s.setHours(0,0,0,0);e.setHours(23,59,59,999);return d>=s&&d<=e});
    const undated=B.cards.filter(c=>!c.due&&c.status!=='done');
    return `<div class="bd-cal-h"><button type="button" class="btn ghost sm" data-mo="-1">‹</button><b>${m.toLocaleDateString('th-TH',{month:'long',year:'numeric'})}</b><button type="button" class="btn ghost sm" data-mo="1">›</button><button type="button" class="btn ghost sm" data-mo="0">วันนี้</button></div>
      <div class="bd-cal">${TH_D.map(d=>`<div class="bd-dow">${d}</div>`).join('')}${days.map(d=>{const cs=on(d);return `<div class="bd-day${d.getMonth()!==mo?' out':''}${d.toDateString()===today?' today':''}" data-day="${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}"><span class="n">${d.getDate()}</span>${cs.slice(0,3).map(c=>`<button type="button" class="bd-ev${c.status==='done'?' done':''}" data-card="${esc(c.id)}" style="--c:${COLOR[c.color]||COLOR['']}">${c.allDay||!c.due?'':new Date(c.due).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})+' '}${esc(c.title)}</button>`).join('')}${cs.length>3?`<small>+${cs.length-3}</small>`:''}</div>`}).join('')}</div>
      ${undated.length?`<p class="bd-und">ยังไม่กำหนดวัน: ${undated.map(c=>`<button type="button" class="bd-ev" data-card="${esc(c.id)}" style="--c:${COLOR[c.color]||COLOR['']}">${esc(c.title)}</button>`).join('')}</p>`:''}`}
  function draw(){const el=$('#p-board');if(!el||el.hidden)return;const r=typeof room==='function'?room():null;
    el.innerHTML=`<div class="bd-top"><div><h2>บอร์ดงาน · ${esc(r?r.name:'CENTRAL')}</h2><small class="muted">วางแผนงานทีมงานศูนย์ · ${B.cards.filter(c=>c.status!=='done').length} งานค้าง</small></div>
      <div class="bd-tools"><div class="seg" role="tablist"><button type="button" data-bv="board" aria-selected="${B.view==='board'}" aria-label="บอร์ด" title="บอร์ด"><i data-ic="board"></i></button><button type="button" data-bv="cal" aria-selected="${B.view==='cal'}" aria-label="ปฏิทิน" title="ปฏิทิน"><i data-ic="calendar"></i></button></div><button type="button" class="btn primary" data-new="">+ งานใหม่</button></div></div>
      ${B.view==='cal'?calView():boardView()}`;
    if(typeof ic==='function')el.querySelectorAll('[data-ic]').forEach(i=>{i.outerHTML=ic(i.dataset.ic)});loadImgs(el)}
  /* ---------- ตัวแก้การ์ด ---------- */
  function editor(c){B.edit=c;const d=document.getElementById('bd-dlg')||Object.assign(document.createElement('dialog'),{id:'bd-dlg',className:'bd-dlg'});if(!d.isConnected)document.body.append(d);
    const cases=(typeof view==='function'?view().cases:W.cases).filter(x=>x.status!=='done').slice(0,400);
    d.innerHTML=`<form method="dialog" class="bd-f">
      <div class="bd-fh"><input name="title" required maxlength="140" placeholder="หัวข้องาน เช่น จัดส่งถุงยังชีพ ชุมชนบางชัน" value="${esc(c.title||'')}"><button type="button" class="btn ghost sm" data-x>ปิด</button></div>
      <div class="bd-row"><label>สถานะ<select name="status">${COLS.map(([k,t])=>`<option value="${k}" ${c.status===k?'selected':''}>${t}</option>`).join('')}</select></label>
        <label>สี<div class="bd-colors">${Object.entries(COLOR).map(([k,v])=>`<button type="button" data-color="${k}" style="background:${v}" aria-pressed="${(c.color||'')===k}" aria-label="สี ${k||'ปกติ'}"></button>`).join('')}</div></label>
        <label>ผู้รับผิดชอบ<input name="assignee" maxlength="80" value="${esc(c.assignee||'')}" placeholder="เช่น ทีมเรือ 2 / คุณเอ"></label></div>
      <div class="bd-row"><label>เริ่ม<input type="datetime-local" name="due" value="${toLocal(c.due)}"></label><label>สิ้นสุด<input type="datetime-local" name="dueEnd" value="${toLocal(c.dueEnd)}"></label><label class="bd-chk"><input type="checkbox" name="allDay" ${c.allDay?'checked':''}> ทั้งวัน</label></div>
      <label>รายละเอียด<textarea name="body" rows="4" maxlength="4000" placeholder="สิ่งที่ต้องทำ ขั้นตอน อุปกรณ์ ผู้ติดต่อ">${esc(c.body||'')}</textarea></label>
      <div class="bd-blk"><b>รูป</b><div class="bd-imgs">${(c.imgs||[]).map(i=>`<figure><img data-img="${esc(i)}" alt=""><button type="button" data-delimg="${esc(i)}" aria-label="ลบรูป">×</button></figure>`).join('')}<label class="bd-addimg">+ เพิ่มรูป<input type="file" accept="image/*" multiple hidden data-files></label></div>${c.id?'':'<small class="muted">รูปจะอัปโหลดหลังบันทึกการ์ดครั้งแรก</small>'}</div>
      <div class="bd-blk"><b>หมุดตำแหน่ง</b><small class="muted">แตะแผนที่เพื่อปักหมุด</small><div class="bd-map" id="bd-map"></div><div class="bd-row"><input name="place" maxlength="200" placeholder="ชื่อสถานที่" value="${esc(c.place||'')}"><button type="button" class="btn ghost sm" data-clearpin>ลบหมุด</button></div></div>
      <div class="bd-blk"><b>เคสที่เกี่ยวข้อง</b><div class="bd-cases" id="bd-cases">${(c.cases||[]).map(id=>caseChip(id)).join('')}</div>
        <div class="bd-row"><input list="bd-caselist" id="bd-casein" placeholder="พิมพ์รหัสเคส / ความต้องการ / เขต"><datalist id="bd-caselist">${cases.map(x=>`<option value="${esc(x.hmId||x.id)}">${esc((x.needs||[]).slice(0,2).join(', '))} · ${esc(x.district||'')}</option>`).join('')}</datalist><button type="button" class="btn ghost sm" data-addcase>+ เพิ่ม</button></div></div>
      <div class="bd-act">${c.id?'<button type="button" class="btn ghost danger" data-del>ลบการ์ด</button>':''}<span class="muted small">${c.id?`แก้ล่าสุด ${esc(fmt(c.updatedAt))}${c.by?' · '+esc(c.by):''}`:''}</span><button type="submit" class="btn primary" data-save>บันทึก</button></div></form>`;
    d.showModal();loadImgs(d);setTimeout(initMap,60);
    d.querySelector('form').onsubmit=e=>{e.preventDefault();save(d)}}
  function caseChip(id){const c=caseOf(id);return `<span class="bd-case" data-cid="${esc(id)}"><b>#${esc(id)}</b>${c?` ${esc((c.needs||[]).slice(0,2).join(', '))}`:''}<button type="button" data-rmcase="${esc(id)}" aria-label="เอาออก">×</button></span>`}
  function initMap(){if(B.map){try{B.map.remove()}catch(e){}B.map=null;B.mk=null}const m=document.getElementById('bd-map');if(!m||!window.L)return;const c=B.edit,r=typeof room==='function'?room():null;
    const ctr=c.lat!=null?[c.lat,c.lng]:r&&r.lat?[r.lat,r.lng]:[13.76,100.6];B.map=L.map(m,{scrollWheelZoom:false,zoomControl:false}).setView(ctr,c.lat!=null?15:11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(B.map);L.control.zoom({position:'topright'}).addTo(B.map);
    const pin=(a,o)=>{c.lat=a;c.lng=o;if(B.mk)B.mk.setLatLng([a,o]);else B.mk=L.marker([a,o]).addTo(B.map)};if(c.lat!=null)pin(c.lat,c.lng);
    (c.cases||[]).forEach(id=>{const x=caseOf(id);if(x&&x.lat)L.circleMarker([+x.lat,+x.lng],{radius:6,color:'#fff',weight:2,fillColor:'#E5383B',fillOpacity:1}).bindTooltip('#'+esc(id)).addTo(B.map)});
    B.map.on('click',e=>pin(+e.latlng.lat.toFixed(6),+e.latlng.lng.toFixed(6)));[150,500].forEach(t=>setTimeout(()=>B.map&&B.map.invalidateSize(),t))}
  function collect(f){const c=B.edit,g=n=>f.elements[n];return {...c,room:B.room,title:g('title').value.trim(),status:g('status').value,assignee:g('assignee').value.trim(),due:fromLocal(g('due').value),dueEnd:fromLocal(g('dueEnd').value),allDay:g('allDay').checked,body:g('body').value,place:g('place').value.trim()}}
  async function save(d){const f=d.querySelector('form'),btn=f.querySelector('[data-save]'),c=collect(f);if(!c.title){f.elements.title.focus();return}
    if(c.dueEnd&&c.due&&c.dueEnd<c.due){toast('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');return}
    btn.disabled=true;const r=await apiPost({action:'board_save',card:c,by:me()}).catch(()=>null);btn.disabled=false;
    if(!r||!r.ok){toast('บันทึกไม่สำเร็จ');return}const wasNew=!c.id;c.id=r.id;B.edit=c;toast('บันทึกแล้ว',true);
    if(wasNew&&B.pendingFiles&&B.pendingFiles.length){await upload(B.pendingFiles);B.pendingFiles=null}
    d.close();B.edit=null;await load(true)}
  function shrink(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const mx=1600,sc=Math.min(1,mx/Math.max(im.width,im.height)),cv=document.createElement('canvas');cv.width=Math.round(im.width*sc);cv.height=Math.round(im.height*sc);cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
      let q=.8,u=cv.toDataURL('image/jpeg',q);while(u.length>1100000&&q>.35){q-=.1;u=cv.toDataURL('image/jpeg',q)}res(u)};im.onerror=rej;im.src=fr.result};fr.onerror=rej;fr.readAsDataURL(file)})}
  async function upload(files){const c=B.edit;let ok=0;for(const f of files){try{const data=await shrink(f),r=await apiPost({action:'board_img_add',cardId:c.id,data});if(r&&r.ok){ok++;c.imgs=[...(c.imgs||[]),r.id];B.img.set(r.id,data)}else toast(r&&r.error==='too_many'?'รูปครบ 12 รูปแล้ว':'อัปโหลดรูปไม่สำเร็จ')}catch(e){toast('อ่านรูปไม่ได้')}}
    if(ok)toast(`เพิ่มรูป ${ok} รูป`,true);return ok}
  /* ---------- เหตุการณ์ ---------- */
  document.addEventListener('click',async e=>{const t=e.target;
    if(t.closest('#p-board')){
      const bv=t.closest('[data-bv]');if(bv){B.view=bv.dataset.bv;draw();return}
      const mo=t.closest('[data-mo]');if(mo){const v=+mo.dataset.mo,m=B.month||new Date(new Date().getFullYear(),new Date().getMonth(),1);B.month=v?new Date(m.getFullYear(),m.getMonth()+v,1):null;draw();return}
      const mv=t.closest('[data-mv]');if(mv){e.stopPropagation();const c=B.cards.find(x=>x.id===mv.dataset.mv);if(c){c.status=mv.dataset.to;draw();apiPost({action:'board_move',id:c.id,status:c.status,by:me()}).then(r=>{if(!r||!r.ok){toast('ย้ายไม่สำเร็จ');load(true)}})}return}
      const nw=t.closest('[data-new]');if(nw){editor({status:'todo',cases:[],imgs:[],lat:null,lng:null});return}
      const cd=t.closest('[data-card]');if(cd){const c=B.cards.find(x=>x.id===cd.dataset.card);if(c)editor(JSON.parse(JSON.stringify(c)));return}
      const day=t.closest('[data-day]');if(day){const d=new Date(day.dataset.day+'T09:00');editor({status:'todo',cases:[],imgs:[],lat:null,lng:null,due:d.getTime(),allDay:true});return}}
    if(!t.closest('#bd-dlg'))return;const d=$('#bd-dlg'),c=B.edit;
    if(t.closest('[data-x]')){d.close();B.edit=null;draw();return}
    const col=t.closest('[data-color]');if(col){c.color=col.dataset.color;d.querySelectorAll('[data-color]').forEach(x=>x.setAttribute('aria-pressed',String(x===col)));return}
    if(t.closest('[data-clearpin]')){c.lat=c.lng=null;if(B.mk){B.mk.remove();B.mk=null}return}
    if(t.closest('[data-addcase]')){const i=$('#bd-casein'),v=i.value.trim().replace(/^#/,'');if(!v)return;if(!c.cases.includes(v)){c.cases.push(v);$('#bd-cases').insertAdjacentHTML('beforeend',caseChip(v));const x=caseOf(v);if(x&&x.lat&&c.lat==null){c.lat=+x.lat;c.lng=+x.lng;initMap()}}i.value='';return}
    const rm=t.closest('[data-rmcase]');if(rm){c.cases=c.cases.filter(x=>x!==rm.dataset.rmcase);rm.closest('.bd-case').remove();return}
    const di=t.closest('[data-delimg]');if(di){if(!confirm('ลบรูปนี้?'))return;const r=await apiPost({action:'board_img_del',id:di.dataset.delimg}).catch(()=>null);if(r&&r.ok){c.imgs=c.imgs.filter(x=>x!==di.dataset.delimg);di.closest('figure').remove();load(true)}return}
    if(t.closest('[data-del]')){if(!confirm('ลบการ์ดนี้?'))return;const r=await apiPost({action:'board_delete',id:c.id,by:me()}).catch(()=>null);if(r&&r.ok){d.close();B.edit=null;toast('ลบแล้ว',true);load(true)}}});
  document.addEventListener('change',async e=>{const f=e.target.closest&&e.target.closest('[data-files]');if(!f||!B.edit)return;const files=[...f.files];f.value='';if(!files.length)return;
    if(!B.edit.id){B.pendingFiles=(B.pendingFiles||[]).concat(files);toast(`จะอัปโหลด ${files.length} รูปหลังบันทึก`);return}
    const box=$('#bd-dlg .bd-imgs');box.classList.add('busy');await upload(files);box.classList.remove('busy');
    box.querySelectorAll('figure').forEach(x=>x.remove());box.insertAdjacentHTML('afterbegin',B.edit.imgs.map(i=>`<figure><img data-img="${esc(i)}" alt=""><button type="button" data-delimg="${esc(i)}" aria-label="ลบรูป">×</button></figure>`).join(''));loadImgs(box);load(true)});
  document.addEventListener('close',e=>{if(e.target&&e.target.id==='bd-dlg'){B.edit=null;B.pendingFiles=null;draw()}},true);
  // ลากการ์ดระหว่างคอลัมน์ (คอม)
  document.addEventListener('dragstart',e=>{const c=e.target.closest&&e.target.closest('#p-board .bd-card');if(c){B.drag=c.dataset.card;e.dataTransfer.effectAllowed='move'}});
  document.addEventListener('dragover',e=>{const col=e.target.closest&&e.target.closest('#p-board [data-col]');if(col&&B.drag){e.preventDefault();col.classList.add('over')}});
  document.addEventListener('dragleave',e=>{const col=e.target.closest&&e.target.closest('#p-board [data-col]');if(col)col.classList.remove('over')});
  document.addEventListener('drop',e=>{const col=e.target.closest&&e.target.closest('#p-board [data-col]');if(!col||!B.drag)return;e.preventDefault();const c=B.cards.find(x=>x.id===B.drag);B.drag=null;
    if(c&&c.status!==col.dataset.col){c.status=col.dataset.col;draw();apiPost({action:'board_move',id:c.id,status:c.status,by:me()}).then(r=>{if(!r||!r.ok){toast('ย้ายไม่สำเร็จ');load(true)}})}else draw()});
  return {show(){load(true).then(draw);draw();clearInterval(B.timer);B.timer=setInterval(()=>{if(!document.hidden&&!$('#p-board').hidden)load()},15000)},draw}})();
