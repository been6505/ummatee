/* ปุ่มขยายแผนที่เต็มจอ ใช้ได้กับทุกแผนที่ Leaflet: MAPFS.add(map)
   ทำแบบ CSS (ตัวแผนที่เต็มหน้าต่าง) ใช้ได้ทั้งมือถือและคอม · ออกด้วยปุ่ม <i data-ic="close"></i>, Esc หรือปุ่มย้อนกลับของมือถือ
   MAPFS.add(map,{history:false}) สำหรับหน้าที่ใช้ปุ่มย้อนกลับเปลี่ยนหน้าเอง (ไม่ยุ่งกับประวัติเบราว์เซอร์) */
const MAPFS=(()=>{
  const IC={full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',close:'<path d="M6 6l12 12M18 6 6 18"/>'};
  const svg=k=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
  let styled=false,active=null;
  function style(){if(styled)return;styled=true;const s=document.createElement('style');
    s.textContent='.mapfs-btn{width:38px;height:38px;display:grid;place-items:center;background:#fff;border:0;border-radius:10px;color:#1F2A5E;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,.3);padding:0}'+
      '.mapfs-btn:hover{background:#f4f6fb}'+
      '.mapfs-on{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;z-index:3000!important}'+
      'body.mapfs-lock{overflow:hidden}';
    document.head.append(s)}
  function set(st,on){const el=st.map.getContainer();if(on===el.classList.contains('mapfs-on'))return;
    el.classList.toggle('mapfs-on',on);document.body.classList.toggle('mapfs-lock',on);
    // ย้ายแผนที่ไปไว้ใต้ body ชั่วคราว เพื่อไม่ให้กรอบด้านนอก (transform / z-index) บังการเต็มจอ
    if(on){st.home={parent:el.parentNode,next:el.nextSibling};document.body.append(el)}
    else if(st.home){st.home.parent.insertBefore(el,st.home.next);st.home=null}
    st.btn.innerHTML=svg(on?'close':'full');st.btn.title=on?'ออกจากเต็มจอ (Esc)':'ขยายแผนที่เต็มจอ';st.btn.setAttribute('aria-label',st.btn.title);
    const w=st.map.scrollWheelZoom;if(w){if(on){st.wheel=w.enabled();w.enable()}else if(!st.wheel)w.disable()}
    if(on){active=st;if(st.hist)try{history.pushState({mapfs:1},'')}catch(e){}}
    else{active=null;if(st.hist&&history.state&&history.state.mapfs&&!st.fromPop)try{history.back()}catch(e){}st.fromPop=false}
    setTimeout(()=>st.map.invalidateSize(),80)}
  function add(map,opt={}){if(!window.L||!map||map._mapfs)return;style();
    const st={map,btn:null,home:null,wheel:false,hist:opt.history!==false};map._mapfs=st;
    const C=L.Control.extend({options:{position:opt.position||'topright'},onAdd(){const b=L.DomUtil.create('button','mapfs-btn');b.type='button';
      b.innerHTML=svg('full');b.title='ขยายแผนที่เต็มจอ';b.setAttribute('aria-label',b.title);
      L.DomEvent.disableClickPropagation(b);L.DomEvent.on(b,'click',e=>{L.DomEvent.stop(e);set(st,!map.getContainer().classList.contains('mapfs-on'))});st.btn=b;return b}});
    map.addControl(new C());
    map.on('unload',()=>{if(active===st)set(st,false)})}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active)set(active,false)});
  addEventListener('popstate',()=>{if(active&&active.hist){active.fromPop=true;set(active,false)}});
  addEventListener('hashchange',()=>{if(active&&!active.hist)set(active,false)}); // หน้าที่เปลี่ยนหน้าด้วย # : ออกจากเต็มจอเมื่อเปลี่ยนหน้า
  return {add};
})();
