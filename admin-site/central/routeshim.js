const T={get cases(){return (A.cases||[]).filter(c=>!c.hm)},get roster(){return A.roster||[]},live:[]};
const TST={ready:'พร้อม',out:'ทีมกำลังไป',rest:'พัก'};
const tname=s=>String(s||'').replace(/^'/,'').trim();
const km=(a,b,c,d)=>{const R=6371,x=(c-a)*Math.PI/180,y=(d-b)*Math.PI/180,h=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const apiGet=p=>api({...p,key:A.key});
const apiPost=b=>post({by:store.get('uh_staff')||undefined,...b,key:A.key});
const loadAll=()=>{try{load()}catch(e){}};
async function rtLive(){try{const r=await apiGet({action:'teams'});if(r&&r.ok)T.live=r.teams||[]}catch(e){}}
const RTBOARD={open:false,inited:false,async toggle(){this.open=!this.open;const w=document.getElementById('rt-board');if(!w)return;w.hidden=!this.open;
  if(this.open){if(!A.roster)await loadRoster();await rtLive();if(typeof ROUTE!=='undefined'){if(!this.inited){this.inited=true;await ROUTE.init()}else ROUTE.render()}w.scrollIntoView({behavior:'smooth',block:'start'})}
  const b=document.getElementById('rt-board-btn');if(b)b.setAttribute('aria-pressed',String(this.open))}};
setInterval(()=>{if(RTBOARD.open&&!document.hidden)rtLive()},30000);
