/* คีย์บอร์ดมือถือเด้งขึ้น: ให้หน้าต่าง AI HELP / แชท พอดีพื้นที่ที่ยังมองเห็น (เหนือคีย์บอร์ดและแถบเติมข้อมูลอัตโนมัติ)
   ใช้ visualViewport เทียบกับความสูงเต็มจอที่วัดไว้ตอนยังไม่พิมพ์ (Android Chrome ย่อ innerHeight ด้วย จึงเทียบ innerHeight ไม่ได้)
   ระหว่างพิมพ์ซ่อนแถบเมนูล่างและปุ่มลอย */
(()=>{const vv=window.visualViewport;if(!vv)return;
  const typing=()=>{const a=document.activeElement;return a&&/INPUT|TEXTAREA/.test(a.tagName)?a:null};
  let base=Math.max(vv.height,window.innerHeight);
  const reset=()=>{if(!typing())base=Math.max(vv.height,window.innerHeight)};
  function fit(){reset();const a=typing(),kb=!!a&&vv.height<base*0.85;
    document.body.classList.toggle('kb-open',kb);
    document.querySelectorAll('.hz-win,.chat-win').forEach(w=>{if(kb&&!w.hidden&&w.contains(a)){
        w.style.top=(vv.offsetTop+6)+'px';w.style.bottom='auto';w.style.height=Math.max(200,vv.height-12)+'px';w.style.maxHeight='none';w.style.minHeight='0'}
      else{w.style.top='';w.style.bottom='';w.style.height='';w.style.maxHeight='';w.style.minHeight=''}})}
  const later=()=>{fit();setTimeout(fit,150);setTimeout(fit,400)}; // คีย์บอร์ดเลื่อนขึ้นเป็นแอนิเมชัน: วัดซ้ำหลังนิ่ง
  vv.addEventListener('resize',fit);vv.addEventListener('scroll',fit);window.addEventListener('resize',fit);
  window.addEventListener('orientationchange',()=>{base=0;setTimeout(()=>{base=Math.max(vv.height,window.innerHeight);fit()},500)});
  document.addEventListener('focusin',later);document.addEventListener('focusout',()=>setTimeout(fit,150));
  const st=document.createElement('style');st.textContent='body.kb-open .tabs,body.kb-open .wr-sub,body.kb-open .hz-fab,body.kb-open .chat-fab,body.kb-open #hmbc{display:none!important}';document.head.append(st)})();
