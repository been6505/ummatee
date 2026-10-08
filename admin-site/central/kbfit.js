/* คีย์บอร์ดมือถือเด้งขึ้น: ให้หน้าต่าง Hermes / แชท พอดีพื้นที่ที่ยังมองเห็น (เหนือคีย์บอร์ด) ครบตั้งแต่หัวถึงช่องพิมพ์
   ใช้ visualViewport (iOS Safari + Android Chrome) · ระหว่างพิมพ์ซ่อนแถบเมนูล่าง */
(()=>{const vv=window.visualViewport;if(!vv)return;const SEL='.hz-win:not([hidden]),.chat-win:not([hidden])';
  function fit(){const kb=window.innerHeight-vv.height>120&&document.activeElement&&/INPUT|TEXTAREA/.test(document.activeElement.tagName);
    document.body.classList.toggle('kb-open',kb);
    document.querySelectorAll('.hz-win,.chat-win').forEach(w=>{if(kb&&!w.hidden&&w.contains(document.activeElement)){
        w.style.top=(vv.offsetTop+8)+'px';w.style.bottom='auto';w.style.height=Math.max(220,vv.height-16)+'px';w.style.maxHeight='none'}
      else{w.style.top='';w.style.bottom='';w.style.height='';w.style.maxHeight=''}})}
  vv.addEventListener('resize',fit);vv.addEventListener('scroll',fit);document.addEventListener('focusin',()=>setTimeout(fit,60));document.addEventListener('focusout',()=>setTimeout(fit,120));
  const st=document.createElement('style');st.textContent='body.kb-open .tabs,body.kb-open .wr-sub,body.kb-open .hz-fab,body.kb-open .chat-fab{display:none!important}';document.head.append(st)})();
