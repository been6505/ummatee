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
  function html(c){
    const live=c.hls?`<div class="cam-live"><video data-hls="${esc(c.hls)}" muted autoplay playsinline aria-label="ภาพสดจากกล้อง ${esc(c.title)}"></video><span class="cam-badge">● สด</span><span class="cam-msg">กำลังเปิดภาพสด…</span></div>`
      :c.img?`<img class="cam-img" src="${esc(c.img)}${c.img.includes('?')?'&':'?'}t=${Date.now()}" alt="ภาพกล้อง ${esc(c.title)}" onerror="this.replaceWith(Object.assign(document.createElement('p'),{className:'cam-msg static',textContent:'โหลดภาพจากกล้องไม่ได้ตอนนี้'}))">`:'';
    return `<div class="cam-pop"><b>📷 ${esc(c.title)}</b>${live}<small>${esc(c.org||'iTIC')} · ${c.hls?'ภาพสด':'ภาพนิ่งอัปเดตทุกไม่กี่นาที'}${c.hls?` · <a href="${esc(c.hls)}" target="_blank" rel="noopener">เปิดในแท็บใหม่ ↗</a>`:''}</small></div>`}
  function fail(v,t){const box=v.closest('.cam-live');if(box){box.classList.add('err');box.querySelector('.cam-msg').textContent=t||'เปิดภาพสดไม่ได้ตอนนี้ ลองกด "เปิดในแท็บใหม่"'}}
  function ok(v){const box=v.closest('.cam-live');if(box)box.classList.add('on')}
  async function start(root){
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
  function stop(root){if(!root)return;root.querySelectorAll('video[data-hls]').forEach(v=>{if(v._hls){v._hls.destroy();v._hls=null}v._live=false;v.removeAttribute('src');try{v.load()}catch(e){}})}
  function bind(marker){marker.on('popupopen',e=>start(e.popup.getElement()));marker.on('popupclose',e=>stop(e.popup.getElement()));return marker}
  return {html,bind,start,stop}
})();
