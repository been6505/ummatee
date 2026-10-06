/* ปุ่มเปลี่ยนธีม (สว่าง ↔ มืด) มุมขวาบนของทุกหน้าหลังบ้าน · ค่าเริ่มต้นสว่าง · จำไว้ในเครื่อง (uh_theme)
   แดชบอร์ดมีปุ่มของตัวเอง (เปลี่ยนแผนที่ฐานด้วย) จึงข้ามถ้ามี #theme-btn แล้ว
   หน้าเดียวกันหลายแท็บ / กรอบคิวที่ฝังในหน้าจัดการเคส เปลี่ยนตามกันผ่าน storage event */
(()=>{
  const root=document.documentElement;
  const apply=t=>{if(t==='dark')root.dataset.theme='dark';else delete root.dataset.theme;const b=document.getElementById('theme-btn');if(b)label(b)};
  const label=b=>{const dark=root.dataset.theme==='dark',t=dark?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด';b.textContent=dark?'☀️':'🌙';b.setAttribute('aria-pressed',String(dark));b.setAttribute('aria-label',t);b.title=t};
  window.addEventListener('storage',e=>{if(e.key==='uh_theme')apply(e.newValue)});
  if(document.getElementById('theme-btn'))return;
  const host=document.querySelector('.top-r')||document.querySelector('.top');if(!host)return;
  const b=document.createElement('button');b.type='button';b.id='theme-btn';b.className='btn ghost sm theme-btn';label(b);
  b.addEventListener('click',()=>{const dark=root.dataset.theme!=='dark';apply(dark?'dark':'light');try{localStorage.setItem('uh_theme',dark?'dark':'light')}catch(e){}});
  const before=host.querySelector('#refresh');before?host.insertBefore(b,before):host.prepend(b);
})();
