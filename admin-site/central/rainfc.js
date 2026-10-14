// พยากรณ์ฝนต่อจุด: ฝนตกไหม · เริ่มกี่โมง · หยุดกี่โมง (ใช้ร่วมกันในแอปศูนย์และแอปทีม)
// ข้อมูลจาก /api?action=rain_fc (Open-Meteo รายชั่วโมง ความละเอียดราว 10 กม.) — เวลาเป็น "ประมาณ" ระดับชั่วโมง
// หน้าที่ใช้ต้องกำหนด window.RAINFC_FETCH = (lat,lng) => Promise<{ok,hours,sum,at}> เอง (แต่ละหน้ามีวิธีส่งรหัส/ลิงก์ทีมต่างกัน)
// แล้วใส่ <div class="rf-box" data-rf="lat,lng"></div> ในหน้า จากนั้นเรียก RAINFC.mount(root) หลัง render
const RAINFC=(()=>{
  const LV=['','ฝนเล็กน้อย','ฝนปานกลาง','ฝนหนัก','ฝนหนักมาก'],FRESH=5*60e3,OLD=30*60e3;
  const memo=new Map(),inflight=new Map();
  const gk=(la,lo)=>(Math.round(la*10)/10).toFixed(1)+','+(Math.round(lo*10)/10).toFixed(1);
  const hm=t=>new Date(t).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});
  const hh=t=>String(new Date(t+7*36e5).getUTCHours()).padStart(2,'0');
  const rel=t=>{const d=Math.ceil((t-Date.now())/6e4);return d<=0?'ภายในชั่วโมงนี้':d<60?`อีก ~${d} นาที`:`อีก ~${Math.round(d/60)} ชม.`};
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function css(){if(document.getElementById('rf-css'))return;const s=document.createElement('style');s.id='rf-css';s.textContent=`
.rf-box:empty{display:none}
.rf{--rf-a:#2D7A4F;--rf-bg:#EAF6EF;margin:10px 0;padding:12px 14px;border-radius:16px;background:var(--rf-bg);color:#14301F}
.rf[data-lv="1"]{--rf-a:#2D6BB0;--rf-bg:#EAF2FB;color:#12263D}.rf[data-lv="2"]{--rf-a:#2D55C8;--rf-bg:#E9EEFC;color:#12263D}
.rf[data-lv="3"]{--rf-a:#B7611A;--rf-bg:#FFF2E0;color:#3A2208}.rf[data-lv="4"]{--rf-a:#C8102E;--rf-bg:#FFEBEE;color:#4A0B16}
.rf-h{display:flex;gap:10px;align-items:flex-start}.rf-ic{flex:none;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:var(--rf-a);color:#fff}.rf-ic svg{width:19px;height:19px}
.rf-t{min-width:0}.rf-t b{display:block;font-size:15.5px;line-height:1.3}.rf-t small{display:block;font-size:13px;line-height:1.4;opacity:.85;margin-top:1px}
.rf-bars{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:3px;align-items:end;height:44px;margin-top:10px}
.rf-bars i{display:block;border-radius:4px 4px 1px 1px;background:var(--rf-a);opacity:.28;min-height:3px}
.rf-bars i[data-c="1"]{opacity:.5;background:#2D6BB0}.rf-bars i[data-c="2"]{opacity:.8;background:#2D55C8}.rf-bars i[data-c="3"]{opacity:1;background:#B7611A}.rf-bars i[data-c="4"]{opacity:1;background:#C8102E}
.rf-bars i[data-c="0"]{background:#8A93A8;opacity:.35}
.rf-x{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:3px;margin-top:3px;font-size:11px;opacity:.7;text-align:center;font-variant-numeric:tabular-nums}
.rf-f{margin:8px 0 0;font-size:11.5px;opacity:.65;line-height:1.4}.rf.old{opacity:.75}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .rf{background:#1d2a33;color:#dbe7ef}:root:not([data-theme="light"]) .rf[data-lv="3"]{background:#2e2414}:root:not([data-theme="light"]) .rf[data-lv="4"]{background:#3a1d22}}
:root[data-theme="dark"] .rf{background:#1d2a33;color:#dbe7ef}:root[data-theme="dark"] .rf[data-lv="3"]{background:#2e2414}:root[data-theme="dark"] .rf[data-lv="4"]{background:#3a1d22}`;
    document.head.appendChild(s)}
  const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/><path d="M8 19v2M12 19v2M16 19v2"/></svg>';
  function text(fc){const s=fc.sum,lv=s.wetNow?Math.max(1,s.nowLevel):s.level;let head,sub;
    if(s.wetNow){head=`ฝนตกอยู่ · ${LV[Math.max(1,s.nowLevel)]}`;
      sub=s.stopsAt?`คาดหยุดประมาณ ${hm(s.stopsAt)} (${rel(s.stopsAt)})${s.again?` · แล้วตกอีกประมาณ ${hm(s.again)}`:''}`:'ยังตกต่อเนื่องเกิน 24 ชม.'}
    else if(s.startsAt){head=`คาดฝนเริ่มตกประมาณ ${hm(s.startsAt)} (${rel(s.startsAt)})`;
      sub=`${LV[Math.max(1,s.level)]}${s.stopsAt?` · หยุดประมาณ ${hm(s.stopsAt)}`:' · ตกต่อเนื่อง'} · รวม ${s.total24} มม. ใน 24 ชม.`}
    else{head='ไม่มีฝนใน 24 ชม. ข้างหน้า';sub=s.maxProb24>=40?`โอกาสฝนสูงสุด ${s.maxProb24}% แต่โมเดลคาดว่าปริมาณน้อยมาก`:'ท้องฟ้าโล่งตามโมเดลพยากรณ์'}
    return {lv,head,sub}}
  function card(fc){if(!fc||!fc.hours||!fc.sum)return '';css();const t=text(fc),hs=fc.hours.slice(0,12),old=Date.now()-fc.at>OLD;
    const top=Math.max(5,...hs.map(h=>Number(h.mm)||0)),bars=hs.map(h=>{h={t:Number(h.t),mm:Number(h.mm)||0,p:h.p==null?null:Number(h.p)};const c=h.mm<0.1?0:h.mm<2.5?1:h.mm<10?2:h.mm<30?3:4,ht=h.mm<0.1?8:Math.max(18,Math.min(100,h.mm/top*100));
      return `<i data-c="${c}" style="height:${ht}%" title="${hh(h.t)}:00 · ${h.mm} มม.${h.p!=null?' · โอกาส '+h.p+'%':''}"></i>`}).join('');
    const xs=hs.map((h,i)=>`<span>${i%3===0?hh(h.t):''}</span>`).join('');
    return `<div class="rf${old||fc.stale?' old':''}" data-lv="${t.lv}"><div class="rf-h"><span class="rf-ic">${ICON}</span><div class="rf-t"><b>${esc(t.head)}</b><small>${esc(t.sub)}</small></div></div>
      <div class="rf-bars" role="img" aria-label="ปริมาณฝนรายชั่วโมง 12 ชม. ข้างหน้า">${bars}</div><div class="rf-x">${xs}</div>
      <p class="rf-f">พยากรณ์รายชั่วโมง ความละเอียดราว 10 กม. จึงเป็นเวลาโดยประมาณ · ${old||fc.stale?`ข้อมูลเมื่อ ${hm(fc.at)} น. · `:''}ดูเรดาร์ฝนสดที่แผนที่</p></div>`}
  async function get(la,lo){const k=gk(la,lo),m=memo.get(k);if(m&&Date.now()-m.at<FRESH)return m.v;
    if(inflight.has(k))return inflight.get(k);
    const f=window.RAINFC_FETCH;if(typeof f!=='function')throw new Error('no fetcher');
    const p=Promise.resolve(f(la,lo)).then(r=>{if(!r||!r.ok||!r.hours)throw new Error('rain_fc');memo.set(k,{at:Date.now(),v:r});try{localStorage.setItem('uh_rf_'+k,JSON.stringify(r))}catch(e){}return r})
      .catch(e=>{try{const raw=localStorage.getItem('uh_rf_'+k);if(raw){const r=JSON.parse(raw);if(r&&r.hours&&Date.now()-r.at<6*36e5)return {...r,stale:true}}}catch(e2){}throw e})
      .finally(()=>inflight.delete(k));
    inflight.set(k,p);return p}
  function mount(root){(root||document).querySelectorAll('.rf-box[data-rf]').forEach(el=>{const [la,lo]=String(el.dataset.rf).split(',').map(Number);if(!isFinite(la)||!isFinite(lo))return;
    const m=memo.get(gk(la,lo));if(m&&Date.now()-m.at<FRESH){const h=card(m.v);if(el.dataset.rfH!==h){el.innerHTML=h;el.dataset.rfH=h}return}
    get(la,lo).then(r=>{if(!el.isConnected)return;const h=card(r);if(el.dataset.rfH!==h){el.innerHTML=h;el.dataset.rfH=h}}).catch(()=>{if(el.isConnected&&!el.dataset.rfH)el.innerHTML=''})})}
  return {mount,get,card,text};
})();
