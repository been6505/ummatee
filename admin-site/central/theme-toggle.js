/* ธีม (สว่าง/มืด · เปลี่ยนที่หน้าตั้งค่า) + ปุ่มค้นหาทุกอย่าง มุมขวาบนของทุกหน้าหลังบ้าน · ค่าเริ่มต้นสว่าง · จำไว้ในเครื่อง (uh_theme)
   แดชบอร์ดมีปุ่มของตัวเอง (เปลี่ยนแผนที่ฐานด้วย) จึงข้ามถ้ามี #theme-btn แล้ว
   หน้าเดียวกันหลายแท็บ / กรอบคิวที่ฝังในหน้าจัดการเคส เปลี่ยนตามกันผ่าน storage event */
(()=>{
  const root=document.documentElement;
  const apply=t=>{if(t==='dark')root.dataset.theme='dark';else root.dataset.theme='light';const b=document.getElementById('theme-btn');if(b)label(b)};
  const label=b=>{const dark=root.dataset.theme==='dark',t=dark?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด';b.innerHTML=ic(dark?'sun':'moon');b.setAttribute('aria-pressed',String(dark));b.setAttribute('aria-label',t);b.title=t};
  window.addEventListener('storage',e=>{if(e.key==='uh_theme')apply(e.newValue)});
  /* มุมขวาบน: ปุ่มค้นหาทุกอย่าง (แทนปุ่มโหมดมืด · เปลี่ยนธีมได้ที่หน้าตั้งค่า) */
  const host=document.querySelector('.top-r')||document.querySelector('.top');if(!host||document.getElementById('gs-btn'))return;
  const b=document.createElement('button');b.type='button';b.id='gs-btn';b.className='btn ghost sm theme-btn';b.innerHTML=typeof ic==='function'?ic('search'):'⌕';b.title='ค้นหาทุกอย่าง (กด / )';b.setAttribute('aria-label','ค้นหาทุกอย่าง');
  const before=host.querySelector('#refresh');before?host.insertBefore(b,before):host.prepend(b);
  b.addEventListener('click',()=>GS.open());
  document.addEventListener('keydown',e=>{if((e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||''))||((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k')){e.preventDefault();GS.open()}});
})();
/* ---------- ค้นหาทุกอย่าง: เคส (ในระบบ + Help Me) · ทีม · สต็อก · War Room · เมนู ---------- */
const GS=(()=>{
  const e=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=()=>{try{return localStorage.getItem('uh_vol_key')||sessionStorage.getItem('uh_vol_key')||''}catch(x){return ''}};
  const base=(()=>{const p=location.pathname;return p.includes('/central/')?p.slice(0,p.indexOf('/central/')):p.replace(/\/[^/]*$/,'')})();
  const U=p=>base+p;
  const norm=s=>String(s==null?'':s).toLowerCase().replace(/\s+/g,' ');
  const MENU=[['แดชบอร์ด','/central/dashboard/','ภาพรวม สรุป ตัวชี้วัด dashboard'],['จัดการเคส','/central.html','เคส รายการ แผนที่ cases'],['War Room','/central/warroom/','วอร์รูม ศูนย์ย่อย หน่วยงาน'],['จัดทีม','/central/teams/','ทีม อาสา ติดตาม team'],['สต็อก','/central/stock/','คลัง ของ ถุงยังชีพ stock'],['ข่าวและเตือนภัย','/central/broadcast/#news','news ข่าว เตือนภัย กรมอุตุ แผ่นดินไหว ภัยพิบัติ'],['ประกาศ','/central/broadcast/','แจ้งเตือน broadcast'],['เคสจากโซเชียล','/central/leads/','โซเชียล คัดเคส leads'],['พื้นที่มอบแล้ว','/central/covered/','covered มอบของ'],['ตั้งค่า','/central/settings/','settings ประวัติ ธีม โหมดมืด discord sms ai']];
  let D=null,at=0,loading=null,el=null,sel=0,hits=[];
  async function get(q){const r=await fetch(U('/api')+'?'+new URLSearchParams({...q,key:key(),t:Date.now()}),{cache:'no-store'});return r.json()}
  function load(){if(D&&Date.now()-at<60e3)return Promise.resolve(D);if(loading)return loading;
    loading=Promise.all([get({action:'list'}).catch(()=>null),get({action:'helpme_cases'}).catch(()=>null),get({action:'roster'}).catch(()=>null),get({action:'stock'}).catch(()=>null),get({action:'warrooms'}).catch(()=>null)])
      .then(([l,h,r,s,w])=>{D={cases:[...((h&&h.cases)||[]).map(c=>({...c,_id:'hm-'+c.id,_hm:true})),...((l&&l.cases)||[]).map(c=>({...c,_id:String(c.id)}))],teams:(r&&r.roster)||[],stock:(s&&s.items)||[],rooms:(w&&(w.warrooms||w.rooms))||[]};at=Date.now();loading=null;return D})
      .catch(()=>{loading=null;return D||{cases:[],teams:[],stock:[],rooms:[]}});return loading}
  const ST={open:'รอความช่วยเหลือ',going:'ทีมกำลังไป',done:'ปิดเคส'};
  function search(q){const t=norm(q).trim();if(!t)return [];const words=t.split(' ');const m=h=>words.every(w=>h.includes(w));const out=[];
    MENU.forEach(([n,p,k])=>{if(m(norm(n+' '+k)))out.push({g:'เมนู',ic:'list',t:n,s:'เปิดหน้า',href:U(p)})});
    if(D){D.cases.forEach(c=>{const ph=String(c.phone||'').replace(/\D/g,''),h=norm([c.id,c.hmId,c.name,c.phone,ph,c.address,c.district,c.province,(c.needs||[]).join?(c.needs||[]).join(' '):c.needs,c.notes,c.volunteer,c.hqNote].join(' '));
        if(m(h))out.push({g:'เคส',ic:'pin',t:`#${c.hmId||c.id} · ${(Array.isArray(c.needs)?c.needs.join(' · '):c.needs)||'ขอความช่วยเหลือ'}`,s:[ST[c.status]||c.status,c.name,[c.address,c.district].filter(Boolean).join(' '),c.volunteer?'ทีม '+String(c.volunteer).replace(/^'/,''):''].filter(Boolean).join(' · '),href:U('/central.html')+'#'+encodeURIComponent(c._id)})});
      D.teams.forEach(x=>{if(x.active===0)return;if(m(norm([x.name,x.leader,x.phone,x.zone,x.vehicle,x.note].join(' '))))out.push({g:'ทีม',ic:'users',t:x.name,s:[x.leader?'หัวหน้า '+x.leader:'',x.phone,x.zone?'พื้นที่ '+x.zone:''].filter(Boolean).join(' · ')||'ทีมอาสา',href:U('/central/teams/')+'?team='+encodeURIComponent(x.name)})});
      D.stock.forEach(x=>{if(m(norm([x.name,x.category,x.location,x.note].join(' '))))out.push({g:'สต็อก',ic:'box',t:x.name,s:`เหลือ ${x.qty} ${x.unit||''}${x.category?' · '+x.category:''}`,href:U('/central/stock/')+'?q='+encodeURIComponent(x.name)})});
      D.rooms.forEach(x=>{if(x.active===0)return;if(m(norm([x.id,x.name,x.province,x.kind].join(' '))))out.push({g:'War Room',ic:'map',t:x.name||x.id,s:[x.province,x.id].filter(Boolean).join(' · '),href:U('/central/warroom/')+'?wr='+encodeURIComponent(x.id)})})}
    return out}
  function draw(){const q=el.querySelector('input').value,list=el.querySelector('.gs-list');hits=search(q);sel=Math.min(sel,Math.max(0,hits.length-1));
    if(!q.trim()){list.innerHTML=`<p class="gs-tip">พิมพ์ รหัสเคส · ชื่อ · เบอร์ · ที่อยู่ · ชื่อทีม · ของในสต็อก · War Room · เมนู${!D?'<br><small>กำลังโหลดข้อมูล…</small>':''}</p>`;return}
    if(!hits.length){list.innerHTML=`<p class="gs-tip">${loading?'กำลังค้นหา…':'ไม่พบ "'+e(q)+'"'}</p>`;return}
    const cnt={};let h='',i=0,last='';for(const x of hits){cnt[x.g]=(cnt[x.g]||0)+1;if(cnt[x.g]>30)continue;if(x.g!==last){last=x.g;h+=`<p class="gs-g">${e(x.g)} <span>${hits.filter(y=>y.g===x.g).length}</span></p>`}
      h+=`<a class="gs-it${i===sel?' on':''}" href="${e(x.href)}" data-i="${i}"><span class="gs-ic">${typeof ic==='function'?ic(x.ic):''}</span><span class="gs-tx"><b>${e(x.t)}</b><small>${e(x.s)}</small></span></a>`;i++}
    list.innerHTML=h}
  function go(a){if(!a)return;const href=a.getAttribute('href');close();const here=location.pathname===new URL(href,location.href).pathname;location.href=href;if(here&&href.includes('#'))setTimeout(()=>location.reload(),50)}
  function build(){el=document.createElement('div');el.className='gs';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-label','ค้นหาทุกอย่าง');
    el.innerHTML=`<div class="gs-box"><div class="gs-in">${typeof ic==='function'?ic('search'):''}<input type="search" placeholder="ค้นหาทุกอย่าง…" aria-label="ค้นหาทุกอย่าง" autocomplete="off"><button type="button" class="gs-x" aria-label="ปิด">ปิด</button></div><div class="gs-list"></div></div>`;
    document.body.append(el);const inp=el.querySelector('input');let t;
    inp.addEventListener('input',()=>{clearTimeout(t);sel=0;t=setTimeout(draw,120)});
    inp.addEventListener('keydown',ev=>{const n=el.querySelectorAll('.gs-it').length;if(ev.key==='ArrowDown'){ev.preventDefault();sel=Math.min(n-1,sel+1);draw()}else if(ev.key==='ArrowUp'){ev.preventDefault();sel=Math.max(0,sel-1);draw()}else if(ev.key==='Enter'){ev.preventDefault();go(el.querySelector('.gs-it.on'))}else if(ev.key==='Escape')close()});
    el.addEventListener('click',ev=>{if(ev.target===el||ev.target.closest('.gs-x')){close();return}const a=ev.target.closest('.gs-it');if(a){ev.preventDefault();go(a)}})}
  function open(){if(!el)build();el.hidden=false;document.body.classList.add('noscroll');const inp=el.querySelector('input');inp.value='';draw();setTimeout(()=>inp.focus(),30);load().then(()=>{if(!el.hidden)draw()})}
  function close(){if(el)el.hidden=true;document.body.classList.remove('noscroll')}
  return {open,close}})();
/* ---------- ช่องที่มีรายการให้เลือก (input + datalist) → รายการแบบเลื่อนได้ใต้ช่อง ----------
   มือถือ Android แสดง datalist เป็นแถบเล็กเหนือคีย์บอร์ดซึ่งเลือกยาก: แทนด้วยรายการใต้ช่อง กรองตามที่พิมพ์ · ไม่ล้นพ้นคีย์บอร์ด */
(()=>{let box=null,cur=null,opts=[];
  const close=()=>{if(box){box.remove();box=null}cur=null};
  const place=()=>{if(!box||!cur)return;const r=cur.getBoundingClientRect(),vv=window.visualViewport,vh=vv?vv.height+vv.offsetTop:innerHeight,below=vh-r.bottom-10;
    box.style.left=r.left+'px';box.style.width=r.width+'px';
    if(below>=140||below>r.top){box.style.top=(r.bottom+4)+'px';box.style.bottom='';box.style.maxHeight=Math.max(120,Math.min(300,below))+'px'}
    else{box.style.top='';box.style.bottom=(innerHeight-r.top+4)+'px';box.style.maxHeight=Math.min(300,r.top-10)+'px'}};
  const draw=()=>{if(!box||!cur)return;const q=cur.value.trim().toLowerCase(),list=opts.filter(o=>!q||o.toLowerCase().includes(q)).slice(0,80);
    box.innerHTML=list.length?list.map(o=>`<button type="button" data-o="${o.replace(/"/g,'&quot;')}">${o.replace(/[<&]/g,c=>c==='<'?'&lt;':'&amp;')}</button>`).join(''):'<p>ไม่พบ · พิมพ์ต่อได้เลย</p>';place()};
  document.addEventListener('focusin',e=>{const i=e.target;if(!(i instanceof HTMLInputElement))return;const id=i.getAttribute('list')||i.dataset.combo;if(!id)return;
    const dl=document.getElementById(id);if(!dl)return;if(i.getAttribute('list')){i.dataset.combo=id;i.removeAttribute('list')}
    opts=[...dl.options].map(o=>o.value).filter(Boolean);close();cur=i;box=document.createElement('div');box.className='combo-pop';(i.closest('dialog')||document.body).append(box); // ในกล่อง dialog ต้องอยู่ชั้นเดียวกัน
    box.addEventListener('mousedown',ev=>ev.preventDefault());box.addEventListener('click',ev=>{const b=ev.target.closest('[data-o]');if(!b||!cur)return;cur.value=b.dataset.o;cur.dispatchEvent(new Event('input',{bubbles:true}));cur.dispatchEvent(new Event('change',{bubbles:true}));const c=cur;close();c.blur()});
    draw();setTimeout(()=>{if(cur===i){cur.scrollIntoView({block:'nearest'});place()}},350)});
  document.addEventListener('input',e=>{if(e.target===cur)draw()});
  document.addEventListener('focusout',e=>{if(e.target===cur)setTimeout(()=>{if(document.activeElement!==cur)close()},150)});
  addEventListener('resize',place);if(window.visualViewport)visualViewport.addEventListener('resize',place);addEventListener('scroll',place,true);
})();
