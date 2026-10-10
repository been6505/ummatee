(()=>{
  const KEY=()=>{try{return localStorage.getItem('uh_vol_key')||sessionStorage.getItem('uh_vol_key')||''}catch(e){return ''}};
  const me=()=>{try{return localStorage.getItem('uh_staff')||''}catch(e){return ''}};
  const page=()=>(document.title.split('·')[0]||'').trim()+' · '+location.pathname.replace(/^\/+/,'');
  const ICON='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>';
  function build(){const host=document.querySelector('.top-r');if(!host||document.getElementById('fb-btn'))return;
    const b=document.createElement('button');b.type='button';b.id='fb-btn';b.className='btn ghost sm theme-btn';b.innerHTML=ICON;b.title=b.ariaLabel='ข้อเสนอแนะ / แจ้งปัญหา';
    const out=host.querySelector('#logout');out?host.insertBefore(b,out):host.append(b);
    const d=document.createElement('dialog');d.className='fb-dlg';d.innerHTML=`<form method="dialog" class="fb-f">
      <b>ข้อเสนอแนะ / แจ้งปัญหา</b>
      <textarea name="t" rows="4" maxlength="1000" required placeholder="ติดตรงไหน อยากให้ปรับอะไร"></textarea>
      <input name="by" maxlength="60" placeholder="ชื่อ (ไม่ใส่ก็ได้)" autocomplete="name">
      <div class="fb-a"><button value="cancel" formnovalidate class="btn ghost">ยกเลิก</button><button value="send" class="btn primary">ส่ง</button></div></form>`;
    document.body.append(d);const f=d.querySelector('form');
    b.onclick=()=>{f.by.value=me();d.showModal();setTimeout(()=>f.t.focus(),30)};
    d.addEventListener('close',async()=>{if(d.returnValue!=='send')return;const text=f.t.value.trim();if(!text)return;
      try{if(f.by.value.trim())localStorage.setItem('uh_staff',f.by.value.trim())}catch(e){}
      try{const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'feedback_save',key:KEY(),text,page:page(),by:f.by.value.trim()})}).then(x=>x.json());
        if(r.ok){f.t.value='';typeof toast==='function'?toast('ส่งแล้ว ขอบคุณครับ',true):alert('ส่งแล้ว ขอบคุณครับ')}else throw 0}
      catch(e){typeof toast==='function'?toast('ส่งไม่สำเร็จ ลองใหม่'):alert('ส่งไม่สำเร็จ ลองใหม่')}});
    const st=document.createElement('style');st.textContent=`.fb-dlg{border:0;border-radius:24px;padding:0;width:min(440px,calc(100% - 24px));box-shadow:0 18px 48px rgba(22,27,61,.25)}
      .fb-dlg::backdrop{background:rgba(15,18,34,.35)}.fb-f{display:grid;gap:10px;padding:18px}.fb-f b{font-size:17px}
      .fb-f textarea,.fb-f input{font:inherit;font-size:15px;border:1px solid var(--line,#e8e8ec);border-radius:14px;padding:10px 12px;resize:vertical;background:var(--surface,#fff);color:inherit}
      .fb-a{display:flex;gap:8px;justify-content:flex-end}`;document.head.append(st)}
  const t=setInterval(()=>{if(KEY()&&document.querySelector('.top-r')){clearInterval(t);build()}},1000);
})();
