const ICONS={
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  map:'<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
  locate:'<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
  pin:'<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  car:'<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/><path d="M5 11h14"/>',
  boat:'<path d="M3 17c1.5 1.3 3 2 4.5 2s3-.7 4.5-2c1.5 1.3 3 2 4.5 2s3-.7 4.5-2"/><path d="M5 14 4 10h16l-1 4"/><path d="M12 10V4l5 4"/>',
  ambulance:'<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.5"/><circle cx="17" cy="17.5" r="1.5"/><path d="M8.5 9v4M6.5 11h4"/>',
  evac:'<circle cx="13" cy="4" r="2"/><path d="m9 21 2-6 3 3v3"/><path d="m6 12 3-4 4 1 3 3h3"/><path d="m11 15-1-5"/>',
  food:'<path d="M7 3v8a2 2 0 0 0 2 2v8"/><path d="M11 3v8"/><path d="M9 3v4"/><path d="M17 21V3c-2 1-3 4-3 7v3h3"/>',
  water:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  pill:'<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="m8.5 8.5 7 7"/>',
  patient:'<path d="M3 18V8"/><path d="M3 14h18v4"/><path d="M21 14v-2a3 3 0 0 0-3-3h-6v5"/><circle cx="7" cy="11" r="2"/>',
  more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  gps:'<path d="M12 2 4 20l8-4 8 4-8-18z"/>',
  heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  filter:'<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  next:'<path d="m9 5 7 7-7 7"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert:'<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
  ext:'<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  wave:'<path d="M2 15c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"/><path d="M2 19c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"/><path d="M12 3v8M8.5 7.5 12 11l3.5-3.5"/>',
  user:'<path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/><circle cx="12" cy="7" r="4"/>',
  note:'<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h6"/>',
  nav:'<path d="M3 11 21 3l-8 18-2-8-8-2z"/>',
  image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r=".6"/>',
  route:'<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 17V9a4 4 0 0 1 4-4h6M18 7v8a4 4 0 0 1-4 4H8"/>',
  shield:'<path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/>',
  up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
  refresh:'<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  wifi:'<path d="M2 9a15 15 0 0 1 20 0"/><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r=".8"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  sat:'<path d="m13 7 4 4"/><path d="m4 20 4-4"/><rect x="8.5" y="5.5" width="7" height="7" rx="1" transform="rotate(45 12 9)"/><path d="M15 15a4 4 0 0 0 4-4M15 19a8 8 0 0 0 8-8"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  road:'<path d="M6 21 9 3M18 21 15 3M12 5v2M12 11v2M12 17v2"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2M11 17.5h2"/>',
  qr:'<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2M16 16h2v2"/>',
  cam:'<path d="M3 7h11a2 2 0 0 1 2 2v1l5-3v10l-5-3v1a2 2 0 0 1-2 2H3z"/><circle cx="8.5" cy="12" r="2"/>',
  rain:'<path d="M7 15a4.5 4.5 0 1 1 .9-8.9A6 6 0 0 1 19 8.5 3.5 3.5 0 0 1 18 15z"/><path d="M8 18.5 7 21M12.5 18.5l-1 2.5M17 18.5l-1 2.5"/>',
  play:'<path d="M8 5.5v13l10.5-6.5z"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  share:'<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
  chev:'<path d="m6 9 6 6 6-6"/>',
  chart:'<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>'
};

Object.assign(ICONS,{
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
  video:'<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="m3 3 18 18"/><path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  send:'<path d="m21.5 2.5-7 19-4-8.5-8.5-4 19.5-6.5z"/><path d="m21.5 2.5-11 10.5"/>',
  megaphone:'<path d="M3 10.5v3a1 1 0 0 0 1 1h3l7 4.5v-14L7 9.5H4a1 1 0 0 0-1 1z"/><path d="M17.5 9a4 4 0 0 1 0 6M20 6.5a8 8 0 0 1 0 11"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/><circle cx="12" cy="12" r="7"/>',
  link:'<path d="M10 13.5a4.5 4.5 0 0 0 6.8.5l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.6 1.6"/><path d="M14 10.5a4.5 4.5 0 0 0-6.8-.5l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20.5h16"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  hand:'<path d="M7 11.5V6.5a1.5 1.5 0 0 1 3 0V11M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-.5a6.5 6.5 0 0 1-5.4-2.9L3.5 14a1.6 1.6 0 0 1 2.6-1.8L7 13.5"/>',
  live:'<circle cx="12" cy="12" r="2.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
  drop:'<path d="M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z"/>',
  expand:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',board:'<rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/>',
  flag:'<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
  flame:'<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.4 2.6-5.3 3.7-8.4.3 2.3 1.8 3.4 2.8 3.9.4-2.2 1.3-4.3 3.3-6.4.1 3.5 3.2 6 3.2 10.4 0 3.8-2.6 6.6-6.5 6.6z"/>',
  storm:'<path d="M17.5 17A4.5 4.5 0 0 0 17 8a6 6 0 0 0-11.6 2A3.5 3.5 0 0 0 6 17"/><path d="m13 12-3 5h4l-3 5"/>',
  snow:'<path d="M12 2v20M4.9 7l14.2 10M4.9 17 19.1 7"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
  mountain:'<path d="m3 20 6.5-11 4 6.5L16 12l5 8z"/>',
  siren:'<path d="M7 18v-6a5 5 0 0 1 10 0v6"/><path d="M5 21h14v-3H5z"/><path d="M12 3V2M4.2 6.2l-.7-.7M19.8 6.2l.7-.7M2 12h1M21 12h1"/>',
  sparkle:'<path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z"/><path d="M19 15c.2 1.5 1 2.3 2.5 2.5-1.5.2-2.3 1-2.5 2.5-.2-1.5-1-2.3-2.5-2.5 1.5-.2 2.3-1 2.5-2.5z"/>',
  wifioff:'<path d="M2 2l20 20"/><path d="M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4.2-2.5M14.8 10.4A10 10 0 0 1 19 12.9M2 8.8a15 15 0 0 1 4.3-2.7M10.7 5a15 15 0 0 1 11.3 3.8"/><path d="M12 20h.01"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  belloff:'<path d="M2 2l20 20"/><path d="M8.7 3.7A6 6 0 0 1 18 8c0 3 .5 5.1 1.2 6.6M17 17H3s3-2 3-9a5.6 5.6 0 0 1 .3-1.8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  mobile:'<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  radio:'<rect x="3" y="9" width="18" height="12" rx="2"/><path d="m7 9 10-5"/><circle cx="15.5" cy="15" r="2.5"/><path d="M7 13h3M7 17h3"/>',
  clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2.8A.8.8 0 0 1 9.8 2h4.4a.8.8 0 0 1 .8.8V4"/><path d="M9 11h6M9 15h6"/>',
  arrows:'<path d="m18 8 4 4-4 4M6 8l-4 4 4 4M2 12h20"/>',
  dot:'<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>',
  hole:'<ellipse cx="12" cy="15" rx="9" ry="4"/><path d="M8 15c0-1.1 1.8-2 4-2s4 .9 4 2"/><path d="M7 9l2-4M17 9l-2-4M12 8V4"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  box:'<path d="m21 8-9-5-9 5v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8"/>'
});

function ic(name,cls){return `<svg class="ic${cls?' '+cls:''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`}
(()=>{const fill=root=>root.querySelectorAll&&root.querySelectorAll('i[data-ic]').forEach(i=>{i.outerHTML=ic(i.dataset.ic,i.className)});
  const EMO={'↗':'ext','⚠':'alert','🌊':'wave','📣':'megaphone','📢':'megaphone','✓':'check','✔':'check','✅':'check','📍':'pin','↔':'arrows','🌐':'globe','🔥':'flame','⛈':'storm','🌀':'storm','🧊':'snow','🌧':'rain','⛰':'mountain','🚨':'siren','▶':'play','⚙':'settings','✦':'sparkle','🕳':'hole','📴':'wifioff','✕':'close','✖':'close','❌':'close','🔔':'bell','🔕':'belloff','📱':'mobile','👁':'eye','👥':'users','📻':'radio','🔴':'dot','📋':'clipboard','🎉':'check','📡':'sat','🚗':'car','🚙':'car','🚤':'boat','⛵':'boat','📦':'box','🕘':'clock','⏰':'clock','🧾':'note','📝':'note','📞':'phone','☎':'phone','🙋':'hand','🎙':'mic','🎤':'mic','🗺':'map','🏠':'home','💬':'chat','🔍':'search','📷':'cam','📸':'cam','🎥':'video','💧':'drop','🛟':'shield','🛡':'shield','📊':'chart','📅':'calendar','🔗':'link','⬇':'down','⬆':'up','🧭':'nav','🔄':'refresh','🔁':'refresh','⏱':'clock','🌡':'alert','ℹ':'info','🆘':'siren','⚡':'storm','🌪':'storm','💡':'sparkle','⭐':'sparkle','✨':'sparkle','✋':'hand','🗓':'calendar','📆':'calendar','📌':'pin','🏥':'heart','🚑':'ambulance','🛶':'boat','🔇':'belloff','🔊':'bell','⏳':'clock','❗':'alert','❓':'info','➕':'plus','➖':'minus','👤':'user','🧑':'user','📄':'note','🗒':'note','🔒':'key','🔑':'key','📲':'mobile','🛰':'sat','📹':'video','🚚':'car','🏍':'car','🚶':'user'};
  const RE=new RegExp('('+Object.keys(EMO).map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')\\uFE0F?','g'),SKIP=/^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|SELECT|TITLE|NOSCRIPT|SVG|svg|CODE|PRE)$/;
  const emo=n=>{if(!n)return;if(n.nodeType===3){const p=n.parentNode,v=n.nodeValue;if(!p||!v||SKIP.test(p.nodeName)||p.closest&&p.closest('svg,[contenteditable],[data-noemo]'))return;RE.lastIndex=0;if(!RE.test(v))return;RE.lastIndex=0;
      const f=document.createDocumentFragment();let last=0;v.replace(RE,(m,k,i)=>{if(i>last)f.append(v.slice(last,i));const t=document.createElement('template');t.innerHTML=ic(EMO[k],'emo'+(k==='🔴'?' emo-live':''));f.append(t.content);last=i+m.length;return m});if(last<v.length)f.append(v.slice(last));p.replaceChild(f,n);return}
    if(n.nodeType===1&&!SKIP.test(n.nodeName)){const w=document.createTreeWalker(n,4),xs=[];while(w.nextNode())xs.push(w.currentNode);xs.forEach(emo)}};
  const go=()=>{fill(document);emo(document.body);new MutationObserver(ms=>ms.forEach(m=>{if(m.type==='characterData'){emo(m.target);return}m.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches&&n.matches('i[data-ic]'))n.outerHTML=ic(n.dataset.ic,n.className);else{fill(n);emo(n)}}else if(n.nodeType===3)emo(n)})})).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    const st=document.createElement('style');st.textContent='.ic.emo{width:1.15em;height:1.15em;vertical-align:-.2em;display:inline-block;flex:none;margin:0 .08em}.ic.emo-live{color:#E5383B}';document.head.append(st)};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go):go()})();

function umPin(k,o={}){
  const mark=k==='cov'?'<path class="pm" d="M11 15.6l3.4 3.4 6.6-6.8"/>':'<circle class="pd" cx="16" cy="15" r="5.2"/>';
  return L.divIcon({className:'um-pin2 pin-'+k+(o.approx?' approx':'')+(o.cls?' '+o.cls:''),
    html:`<svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true"><path class="pb" d="M16 1.5C8 1.5 1.5 7.9 1.5 15.8c0 9.9 11.6 21.9 13.6 23.9a1.3 1.3 0 0 0 1.8 0c2-2 13.6-14 13.6-23.9C30.5 7.9 24 1.5 16 1.5z"/>${mark}</svg>`+(o.extra||''),
    iconSize:[32,42],iconAnchor:[16,41],popupAnchor:[0,-38],tooltipAnchor:[0,-34]});
}

{const fit=()=>{const t=document.querySelector('.tabs'),a=t&&t.querySelector('[aria-current=page]');if(!t)return;const max=Math.max(0,t.scrollWidth-t.clientWidth);t.scrollLeft=a&&max?Math.min(max,Math.max(0,a.offsetLeft-(t.clientWidth-a.offsetWidth)/2)):0};
  addEventListener('load',fit);addEventListener('resize',fit);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);setTimeout(fit,1500)}

function glideTo(m,ll,ms=900,mv){if(!m||!window.L)return;const a=m.getLatLng(),b=L.latLng(ll);cancelAnimationFrame(m._glide);
  const sp=mv&&Number(mv.speed)>=3&&mv.heading!=null&&isFinite(mv.heading)?Number(mv.speed)/3.6:0,hd=sp?Number(mv.heading)*Math.PI/180:0;
  const drift=(p,t0)=>{if(!sp)return;const step=t=>{const s=Math.min(4,(t-t0)/1000),d=Math.min(50,sp*s),dy=d*Math.cos(hd)/111320,dx=d*Math.sin(hd)/(111320*Math.cos(p.lat*Math.PI/180));m.setLatLng([p.lat+dy,p.lng+dx]);if(s<4&&d<50)m._glide=requestAnimationFrame(step)};m._glide=requestAnimationFrame(step)};
  if(!a||document.hidden||a.distanceTo(b)>3000){m.setLatLng(b);return}
  if(a.distanceTo(b)<0.3){drift(b,performance.now());return}
  const t0=performance.now(),step=t=>{const k=Math.min(1,(t-t0)/ms),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;m.setLatLng([a.lat+(b.lat-a.lat)*e,a.lng+(b.lng-a.lng)*e]);if(k<1)m._glide=requestAnimationFrame(step);else drift(b,t)};m._glide=requestAnimationFrame(step)}
const VEH_IMG={boat:'boat',truck:'truck',pickup:'pickup',car:'car',motorbike:'motorbike',foot:'foot',other:'other'};
const VEH_FACE={boat:1,truck:-1,pickup:-1,car:-1,motorbike:-1,foot:1,other:1};
const headArrow=(t,veh)=>{const v=VEH_IMG[veh]||'car',mv=t&&t.speed!=null&&t.speed>=3,h=mv&&t.heading!=null?((+t.heading%360)+360)%360:null;
  const east=h==null?null:(h>0&&h<180),flip=east==null?1:((east?1:-1)*VEH_FACE[v]);
  return `<s class="veh${mv?' run':''}" aria-hidden="true"><img src="/assets/veh/${v}.png" alt="" draggable="false" style="transform:scaleX(${flip})"></s>`};

addEventListener('DOMContentLoaded',()=>{const M=[['/board/','calendar'],['dashboard','board'],['central.html','list'],['warroom','map'],['teams','users'],['stock','box'],['covered','hand'],['news','info'],['broadcast','megaphone'],['settings','settings']];
  document.querySelectorAll('.tabs a').forEach(a=>{if(a.querySelector('.tab-ic'))return;const h=a.getAttribute('href')||'',m=M.find(([k])=>h.includes(k));if(!m||typeof ic!=='function')return;
    a.insertAdjacentHTML('afterbegin',ic(m[1],'tab-ic'))})});
(()=>{const of=window.fetch;if(!of||of._hm)return;const nf=function(u,o){try{if(typeof u==='string'&&!(o&&o.method&&o.method!=='GET')){const x=new URL(u,location.href);if(x.origin===location.origin&&x.pathname==='/api'&&x.searchParams.has('key')){const k=x.searchParams.get('key');x.searchParams.delete('key');const h=new Headers((o&&o.headers)||{});if(k)h.set('x-hm-key',k);o={...(o||{}),headers:h};u=x.pathname+x.search}}}catch(e){}return of.call(this,u,o)};nf._hm=1;window.fetch=nf})();
window.HMT={t:'',exp:0,k:'',p:null,key(){try{return localStorage.getItem('uh_vol_key')||sessionStorage.getItem('uh_vol_key')||''}catch(e){return ''}},
  get(){const k=this.key();if(!k)return Promise.resolve('');if(this.t&&this.k===k&&this.exp-Date.now()>600000)return Promise.resolve(this.t);if(this.p)return this.p;
    this.p=fetch('/api',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'ticket',key:k})}).then(r=>r.json()).then(j=>{this.p=null;if(j&&j.ok){this.t=j.t;this.exp=j.exp;this.k=k;return j.t}return ''}).catch(()=>{this.p=null;return ''});return this.p},
  tiles(u,o){const T=L.TileLayer.extend({getTileUrl(c){return L.TileLayer.prototype.getTileUrl.call(this,c)+(u.includes('?')?'&':'?')+'t='+encodeURIComponent(HMT.t||'')}});const l=new T(u,o);if(!HMT.t)HMT.get().then(()=>{if(l._map)l.redraw()});return l}};
(()=>{const go=()=>{const f=document.getElementById('login-form'),k=document.getElementById('login-key');if(!f||!k||document.getElementById('login-user'))return;
  const lab=k.closest('label');const u=document.createElement('label');u.className='fld';u.innerHTML='<span>ชื่อผู้ใช้</span><input id="login-user" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="บัญชีส่วนตัว · เว้นว่างถ้าใช้รหัสกลาง">';lab.before(u);
  const s=lab.querySelector('span');if(s)s.textContent='รหัสผ่าน';
  f.addEventListener('submit',async e=>{const un=document.getElementById('login-user').value.trim();if(!un||f._ok)return;e.preventDefault();e.stopImmediatePropagation();
    const err=document.getElementById('login-err'),b=document.getElementById('login-go');if(b)b.disabled=true;if(err)err.textContent='กำลังเข้าสู่ระบบ…';
    try{const r=await(await fetch('/api',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'staff_login',username:un,password:k.value})})).json();
      if(r&&r.ok){k.value=r.key;try{localStorage.setItem('uh_staff',r.name);localStorage.setItem('uh_staff_role',r.role)}catch(x){}if(b)b.disabled=false;f._ok=1;f.requestSubmit();f._ok=0;return}
      if(err)err.textContent=r&&r.error==='locked'?'บัญชีถูกล็อก 15 นาที (ใส่รหัสผิดหลายครั้ง)':r&&r.error==='too_many'?'ลองหลายครั้งเกินไป · รอสักครู่':'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'}
    catch(x){if(err)err.textContent='เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ต'}if(b)b.disabled=false},true);
  document.addEventListener('click',e=>{if(!e.target.closest||!e.target.closest('#logout'))return;const key=HMT.key();if(/^st_/.test(key))fetch('/api',{method:'POST',keepalive:true,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'staff_logout',key})}).catch(()=>{});try{localStorage.removeItem('uh_staff_role')}catch(x){}HMT.t=''},true)};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go):go()})();
