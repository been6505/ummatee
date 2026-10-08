/* Local AI (Hermes Agent) — AI ที่รันบนเครื่องของผู้ใช้เอง ผ่าน API แบบ OpenAI (/v1/chat/completions)
   ตั้งค่าเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น (localStorage: uh_ai) · เบราว์เซอร์เรียกเครื่อง AI ตรง ๆ ข้อมูลไม่ผ่านเซิร์ฟเวอร์ CENTRAL
   ใช้: LOCALAI.on() · await LOCALAI.ask('คำถาม') หรือ LOCALAI.ask([{role,content}...]) → ข้อความตอบ */
const LOCALAI=(()=>{
  const PRESETS={hermes:{label:'Hermes Agent',url:'http://localhost:8642/v1',model:'hermes-agent'},
    ollama:{label:'Ollama',url:'http://localhost:11434/v1',model:'hermes3'},
    lmstudio:{label:'LM Studio',url:'http://localhost:1234/v1',model:'hermes-3-llama-3.1-8b'},custom:{label:'กำหนดเอง',url:'',model:''}};
  const DEF={enabled:false,preset:'hermes',url:PRESETS.hermes.url,model:PRESETS.hermes.model,key:'',system:'คุณคือ Hermes ผู้ช่วยศูนย์สั่งการภัยพิบัติ HELP ME CENTRAL ตอบภาษาไทย สั้น ชัด ใช้ได้จริง'};
  const cfg=()=>{try{return {...DEF,...JSON.parse(localStorage.getItem('uh_ai')||'{}')}}catch(e){return {...DEF}}};
  const save=c=>{try{localStorage.setItem('uh_ai',JSON.stringify({...cfg(),...c}))}catch(e){}};
  const base=c=>String(c.url||'').trim().replace(/\/+$/,'');
  const hdr=c=>({'Content-Type':'application/json',...(c.key?{Authorization:'Bearer '+c.key}:{})});
  async function models(c=cfg()){const r=await fetch(base(c)+'/models',{headers:hdr(c)});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();return (j.data||j.models||[]).map(m=>m.id||m.name).filter(Boolean)}
  async function ask(q,o={}){const c={...cfg(),...(o.cfg||{})};if(!base(c))throw new Error('ยังไม่ได้ตั้งค่าที่อยู่ Local AI');
    const messages=Array.isArray(q)?q:[{role:'system',content:c.system},{role:'user',content:String(q)}];
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),o.timeout||120000);
    try{const r=await fetch(base(c)+'/chat/completions',{method:'POST',headers:hdr(c),signal:o.signal||ctl.signal,body:JSON.stringify({model:c.model,messages,stream:false,temperature:o.temperature??0.3})});
      if(!r.ok)throw new Error('HTTP '+r.status+' '+(await r.text().catch(()=>'')).slice(0,160));
      const j=await r.json();return (j.choices&&j.choices[0]&&(j.choices[0].message||{}).content)||j.message?.content||''}
    finally{clearTimeout(t)}}
  return {PRESETS,cfg,save,models,ask,on:()=>cfg().enabled&&!!base(cfg())};
})();
