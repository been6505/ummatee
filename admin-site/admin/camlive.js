/* ภาพสดจากกล้อง CCTV ในป๊อปอัปแผนที่ (หน้าจัดการเคส + แดชบอร์ด)
   กล้อง iTIC ส่งเป็นวิดีโอสด HLS (.m3u8, เปิดให้ทุกเว็บดึงได้) — Safari เล่นเอง เบราว์เซอร์อื่นใช้ hls.js (โหลดตอนเปิดกล้องครั้งแรก)
   ปิดป๊อปอัป = หยุดสตรีม ไม่กินเน็ตต่อ
   ใช้: marker.bindPopup(CAMLIVE.html(cam),{maxWidth:320}); CAMLIVE.bind(marker) */
const CAMLIVE=(()=>{
  const HLS_JS='https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.20/hls.min.js';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let libP=null;
  function lib(){if(window.Hls)return Promise.resolve();if(libP)return libP;
    libP=new Promise((res,rej)=>{const s=document.createElement('script');s.src=HLS_JS;s.crossOrigin='anonymous';s.onload=res;s.onerror=()=>{libP=null;rej()};document.head.append(s)});return libP}
  /* กล้องที่ไม่ส่งภาพใหม่เกิน 3 ชม. = ไม่อัปเดต (ไอคอนสีเทา) */
  const stale=c=>!c.hls&&c.at&&Date.now()/1000-c.at>3*3600;
  const ago=t=>{const m=Math.max(0,Math.round((Date.now()/1000-t)/60));return m<1?'เมื่อสักครู่':m<60?m+' นาทีที่แล้ว':Math.round(m/60)+' ชม.ที่แล้ว'};
  function html(c){
    const live=c.hls?`<div class="cam-live"><video data-hls="${esc(c.hls)}" muted autoplay playsinline aria-label="ภาพสดจากกล้อง ${esc(c.title)}"></video><span class="cam-badge">● สด</span><span class="cam-msg">กำลังเปิดภาพสด…</span></div>`
      :c.img?`<img class="cam-img" data-still="${esc(c.img)}" src="${esc(c.img)}${c.img.includes('?')?'&':'?'}t=${Date.now()}" alt="ภาพกล้อง ${esc(c.title)}" onerror="this.replaceWith(Object.assign(document.createElement('p'),{className:'cam-msg static',textContent:'โหลดภาพจากกล้องไม่ได้ตอนนี้'}))">`:'';
    const st=stale(c),when=c.hls?'ภาพสด':c.at?(st?'<i data-ic="alert"></i> กล้องนี้ไม่ส่งภาพใหม่มา '+ago(c.at).replace('ที่แล้ว',''):'ภาพเมื่อ '+ago(c.at)+' · โหลดภาพใหม่ทุก 10 วิ'):'ภาพนิ่ง · โหลดภาพใหม่ทุก 10 วิ';
    const nl=!c.hls&&c._near?`<button type="button" class="cam-golive" data-golive="${esc(c._near.c.id)}"><i data-ic="video"></i> ดูภาพสดเคลื่อนไหวจากกล้องใกล้สุด · ${esc(c._near.c.title)} (${c._near.km.toFixed(1)} กม.)</button>`:'';
    const more=c.hls?` · <a href="${esc(c.hls)}" target="_blank" rel="noopener">เปิดในแท็บใหม่ ↗</a>`:c.src==='POPNIX Flood'?` · <a href="https://flood.pop.in.th/#cctv" target="_blank" rel="noopener">POPNIX Flood ↗</a>`:'';
    return `<div class="cam-pop"><b>${c.hls?'<i data-ic="live"></i>':'<i data-ic="cam"></i>'} ${esc(c.title)}</b>${live}<small>${esc(c.org||'iTIC')} · ${when}${more}</small>${nl}</div>`}
  function fail(v,t){const box=v.closest('.cam-live');if(box){box.classList.add('err');box.querySelector('.cam-msg').textContent=t||'เปิดภาพสดไม่ได้ตอนนี้ ลองกด "เปิดในแท็บใหม่"'}}
  function ok(v){const box=v.closest('.cam-live');if(box)box.classList.add('on')}
  async function start(root){
    // ภาพนิ่ง (POPNIX): โหลดภาพล่าสุดใหม่ทุก 30 วินาทีระหว่างเปิดป๊อปอัป
    const im=root&&root.querySelector('img[data-still]');
    if(im&&!im._t)im._t=setInterval(()=>{if(!document.hidden&&im.isConnected){const u=im.dataset.still;im.src=u+(u.includes('?')?'&':'?')+'r='+Date.now()}},10000);
    const v=root&&root.querySelector('video[data-hls]');if(!v||v._live)return;v._live=true;const src=v.dataset.hls;
    v.addEventListener('playing',()=>ok(v),{once:true});v.addEventListener('timeupdate',function t(){if(v.currentTime>0){ok(v);v.removeEventListener('timeupdate',t)}});
    // hls.js ก่อน (Chrome/Edge/Firefox) · ไม่มี MediaSource (iPhone) ค่อยใช้ตัวเล่นของเครื่อง
    const native=()=>{if(v.canPlayType('application/vnd.apple.mpegurl')){v.src=src;v.play().catch(()=>{});return true}return false};
    try{await lib()}catch(e){if(!native())fail(v,'โหลดตัวเล่นวิดีโอไม่ได้');return}
    if(!window.Hls||!Hls.isSupported()){if(!native())fail(v,'เบราว์เซอร์นี้เล่นภาพสดไม่ได้');return}
    const h=new Hls({liveSyncDurationCount:2,maxBufferLength:6,lowLatencyMode:true});v._hls=h;
    h.on(Hls.Events.MANIFEST_PARSED,()=>v.play().catch(()=>{}));
    h.on(Hls.Events.ERROR,(e,d)=>{if(d&&d.fatal){h.destroy();v._hls=null;fail(v)}});
    h.loadSource(src);h.attachMedia(v)}
  function stop(root){if(!root)return;root.querySelectorAll('img[data-still]').forEach(im=>{clearInterval(im._t);im._t=null});root.querySelectorAll('video[data-hls]').forEach(v=>{if(v._hls){v._hls.destroy();v._hls=null}v._live=false;v.removeAttribute('src');try{v.load()}catch(e){}})}
  function bind(marker){marker.on('popupopen',e=>start(e.popup.getElement()));marker.on('popupclose',e=>stop(e.popup.getElement()));return marker}
  /* กล้องหลักพันตัว: วาดไอคอนลง canvas (เบากว่า HTML ทีละตัว) และแสดงเมื่อซูมเข้า (ระดับ 12 ขึ้นไป) แบบ Help Me */
  const CAM_SVG='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32"><rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="#111827" stroke="#fff" stroke-width="2.4"/><path d="M7 14.2 21.4 9.6l2.3 7.1-14.4 4.6z" fill="#fff"/><path d="M7.6 16.2 4.6 17.2l1.1 3.4 3-1" fill="none" stroke="#fff" stroke-width="1.9" stroke-linejoin="round"/><path d="M18.6 10.7 20.3 7h4.2M24.6 5.1v3.8" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const LIVE_SVG=CAM_SVG.replace('#111827','#E5383B'),OLD_SVG=CAM_SVG.replace('#111827','#9AA1AA');
  const img=s=>{const i=new Image();i.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);return i},CAM_IMG=img(CAM_SVG),LIVE_IMG=img(LIVE_SVG),OLD_IMG=img(OLD_SVG);
  let CamMarker=null;
  function camMarker(ll,opt,live){if(!CamMarker)CamMarker=L.CircleMarker.extend({_updatePath(){const r=this._renderer;if(!r._drawing||this._empty())return;
      const im=this.options.live?LIVE_IMG:this.options.old?OLD_IMG:CAM_IMG;if(!im.complete||!im.naturalWidth)return L.CircleMarker.prototype._updatePath.call(this);const p=this._point,z=24;r._ctx.drawImage(im,p.x-z/2,p.y-z/2,z,z)}});
    return new CamMarker(ll,{...opt,live,old:opt.old})}
  const MIN_ZOOM=12;
  /* layer(map, cams) → {remove()} · ซ่อนเองเมื่อซูมออก · ป๊อปอัปเล่นภาพสด/ภาพนิ่ง */
  function layer(map,cams,onZoomHint){
    const rd=L.canvas({padding:.3}),lives=cams.filter(c=>c.hls),byId=new Map();
    const km=(a,b)=>{const R=6371,x=(b.lat-a.lat)*Math.PI/180,y=(b.lng-a.lng)*Math.PI/180,h=Math.sin(x/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
    // กล้องภาพนิ่ง: หากล้องภาพสดที่ใกล้ที่สุดในรัศมี 5 กม. ไว้ให้กดสลับไปดู
    cams.forEach(c=>{if(c.hls||!lives.length)return;let best=null;for(const l of lives){const d=km(c,l);if(d<=5&&(!best||d<best.km))best={c:l,km:d}}if(best)c._near=best});
    const g=L.layerGroup(cams.map(c=>{const mk=bind(camMarker([c.lat,c.lng],{renderer:rd,radius:12,weight:0,fillOpacity:0,old:!!stale(c)},!!c.hls).bindPopup(()=>html(c),{maxWidth:320,minWidth:280,offset:[0,-6],autoPanPaddingTopLeft:[190,70],autoPanPaddingBottomRight:[70,40]}));byId.set(c.id,mk);return mk}));
    const go=e=>{const b=e.target.closest&&e.target.closest('[data-golive]');if(!b)return;const mk=byId.get(b.dataset.golive);if(!mk)return;map.closePopup();map.setView(mk.getLatLng(),Math.max(map.getZoom(),MIN_ZOOM));mk.openPopup()};
    map.getContainer().addEventListener('click',go);
    const sync=()=>{const show=map.getZoom()>=MIN_ZOOM;if(show&&!map.hasLayer(g))g.addTo(map);else if(!show&&map.hasLayer(g))map.removeLayer(g);if(onZoomHint)onZoomHint(show)};
    [CAM_IMG,LIVE_IMG].forEach(i=>{if(!i.complete)i.onload=()=>rd._redraw&&rd._redraw()});
    map.on('zoomend',sync);sync();
    return {remove(){map.off('zoomend',sync);map.getContainer().removeEventListener('click',go);map.removeLayer(g)},count:cams.length}}
  return {html,bind,start,stop,layer,MIN_ZOOM}
})();
