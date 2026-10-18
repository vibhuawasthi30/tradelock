(()=>{
 if(document.getElementById('tradelock-widget-host'))return;
 const host=document.createElement('div');host.id='tradelock-widget-host';
 host.style.cssText='position:fixed;right:16px;top:16px;width:405px;max-width:calc(100vw - 24px);height:calc(100vh - 32px);max-height:860px;z-index:2147483646;';
 const shadow=host.attachShadow({mode:'closed'});
 const style=document.createElement('style');style.textContent=':host{color-scheme:light}.widget-container{display:block;width:100%;height:100%;overflow:auto;border:1px solid #daddcf;border-radius:22px;background:#f7f6f0;box-shadow:0 20px 70px #0006}.widget-container[hidden],button[hidden]{display:none!important}button.restore{border:1px solid #a6b096;border-radius:16px;background:#536744;color:white;padding:12px 18px;cursor:pointer;font:bold 13px Arial;box-shadow:0 8px 25px #0004}';shadow.append(style);
 const container=document.createElement('div');container.className='widget-container';container.innerHTML=TradeLockWidgetTemplate;
 const restore=document.createElement('button');restore.className='restore';restore.textContent='TradeLock · Paper';restore.hidden=true;
 shadow.append(container,restore);
 document.documentElement.append(host);
 let minimized=false,latest=null,lastUrl='',guard=false;
 function show(open){minimized=!open;container.hidden=!open;restore.hidden=open;host.style.width=open?'405px':'auto';host.style.height=open?'calc(100vh - 32px)':'auto';host.style.top=open?'16px':'auto';host.style.bottom=open?'auto':'18px';}
 const markers=document.createElement('div');markers.id='tradelock-paper-markers';markers.style.cssText='position:fixed;z-index:2147483645;pointer-events:none;display:flex;gap:6px;max-width:600px;overflow:hidden;font:12px Arial;';document.documentElement.append(markers);
 let markerTrades=[],markersEnabled=true;
 window.addEventListener('message',e=>{if(e.source===window&&e.data?.type==='tradelock-lines-status'){const el=shadow.getElementById('lineStatus');if(el)el.textContent=e.data.ready?'Green buy and red sell lines follow the chart scale.':'Chart lines unavailable: refresh FOMO after reloading TradeLock.';}});
 function paintMarkers(){
  const chart=document.querySelector('[id^="tradingview_"]');const rect=chart?.getBoundingClientRect();
  window.postMessage({type:'tradelock-paper-lines',key:identity()?.key,trades:markersEnabled?markerTrades.filter(t=>t.key===identity()?.key).slice(-20):[],quote:latest},location.origin);
  markers.replaceChildren();if(!rect||rect.width<100||!markersEnabled)return;
  markers.style.left=(rect.left+75)+'px';markers.style.top=(rect.top+75)+'px';markers.style.maxWidth=Math.max(100,Math.min(rect.width-100,host.getBoundingClientRect().left-rect.left-90))+'px';
  for(const t of markerTrades.filter(t=>t.key===identity()?.key).slice(-4)){
   const badge=document.createElement('span');badge.style.cssText='flex:none;padding:7px 9px;border-radius:8px;background:#101810ee;border:1px solid '+(t.side==='buy'?'#49c87b':'#ff6969')+';color:'+(t.side==='buy'?'#49c87b':'#ff6969');
   badge.textContent=(t.side==='buy'?'▲ PAPER BUY':'▼ PAPER SELL')+' · '+(Number.isFinite(t.marketCap)?'$'+t.marketCap.toLocaleString('en-US',{maximumFractionDigits:0})+' MC':'Paper execution')+' · '+new Date(t.t).toLocaleTimeString();markers.append(badge);
  }
 }
 const curtain=document.createElement('div');curtain.id='tradelock-position-lock';curtain.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#11170ff5;display:none;align-items:center;justify-content:center;color:#f5f6ef;font:16px Arial;';
 const lockRoot=curtain.attachShadow({mode:'closed'});lockRoot.innerHTML='<style>[hidden]{display:none!important}*{box-sizing:border-box}.card{width:min(480px,90vw);padding:35px;border:1px solid #536744;border-radius:24px;background:#202a1b;text-align:center}h1{font-size:27px}p{line-height:1.6;color:#c9d2bf}.metrics{display:grid;gap:12px;margin:22px 0}b{color:#89bd70}button{padding:13px;border-radius:12px;background:#536744;color:white;border:0;cursor:pointer}</style><div class="card" role="dialog" aria-modal="true" aria-label="Paper position locked"><h1>🔒 Trading Lock is on</h1><button id="screenLockSwitch" role="switch" aria-checked="true" aria-label="Trading Lock" style="background:#536744;border-radius:25px;min-width:120px">ON ●</button><h2 id="lockedName"></h2><p id="lockIntro">Switch Trading Lock off to unlock this screen.</p><div class="metrics" id="lockedMetrics"><span>Current market cap: <b id="lockedPrice"></b></span><span>Take profit: <b id="lockedTP"></b></span><span>Stop loss: <b id="lockedSL"></b></span></div><p id="lockedStatus"></p><button id="returnToPosition" hidden>Return to the monitored token</button><p>Keep this FOMO tab open so TradeLock can monitor market cap. Paper trades only.</p></div>';
 document.documentElement.append(curtain);let activeLock=null,screenIsLocked=false;const savedInert=new Map();
 const fmt=n=>Number.isFinite(n)?'$'+n.toLocaleString('en-US',{maximumFractionDigits:0}):'—';
 function applyLock(state){
  const p=state.locked;activeLock=p;screenIsLocked=state.tradingLock;curtain.style.display=screenIsLocked?'flex':'none';
  if(screenIsLocked){for(const el of document.documentElement.children){if(el!==curtain&&!savedInert.has(el)){savedInert.set(el,el.inert);el.inert=true;}}
   lockRoot.getElementById('lockedMetrics').hidden=!p;lockRoot.getElementById('lockIntro').textContent=state.limitReached?'Your '+state.tradeLimit+'-trade limit is reached. Take a 30-minute break after this position closes. Switching off lets you review history; the count stays.':'Switch Trading Lock off to unlock this screen. Exit targets keep running while this token tab is open.';
   lockRoot.getElementById('lockedName').textContent=p?.name||'FOMO screen locked';lockRoot.getElementById('lockedPrice').textContent=fmt(p?.mark?.marketCap);
   if(p?.targetBasis==='marketCap'){lockRoot.getElementById('lockedTP').textContent='+'+p.takeProfitPct+'% · '+fmt(p.takeProfit)+' MC';lockRoot.getElementById('lockedSL').textContent='−'+p.stopLossPct+'% · '+fmt(p.stopLoss)+' MC';}
   else{lockRoot.getElementById('lockedTP').textContent=p?'Existing price target: $'+p.takeProfit:'—';lockRoot.getElementById('lockedSL').textContent=p?'Existing price target: $'+p.stopLoss:'—';}
   const current=!!p&&identity()?.key===p.key;lockRoot.getElementById('returnToPosition').hidden=!p||current;lockRoot.getElementById('lockedStatus').textContent=!p?(state.limitReached&&state.breakRemainingMs>0?'Break remaining: '+Math.ceil(state.breakRemainingMs/60000)+' minutes.':'FOMO is locked until you switch Trading Lock off.'):current&&Date.now()-(p.mark?.t||0)<15000&&(p.targetBasis!=='marketCap'||Number.isFinite(p.mark?.marketCap))?'Monitoring exit targets…':'Price monitoring paused. Return to the position’s token page.';
  }else{for(const [el,was] of savedInert)el.inert=was;savedInert.clear();}
 }
 lockRoot.getElementById('screenLockSwitch').onclick=async()=>{const b=lockRoot.getElementById('screenLockSwitch');b.disabled=true;try{const r=await chrome.runtime.sendMessage({type:'fomo-lock',locked:false});if(!r?.ok)throw Error(r?.error||'Unable to unlock');applyLock(await chrome.runtime.sendMessage({type:'fomo-state'}));}catch(e){lockRoot.getElementById('lockedStatus').textContent=e.message;}finally{b.disabled=false;}};
 lockRoot.getElementById('returnToPosition').onclick=()=>{if(activeLock)location.href='https://fomo.family/tokens/'+encodeURIComponent(activeLock.chain)+'/'+encodeURIComponent(activeLock.address);};
 document.addEventListener('keydown',e=>{if(screenIsLocked&&!(e.composedPath().includes(curtain))){e.preventDefault();e.stopImmediatePropagation();}},true);
 TradeLockTheme.mount(curtain,null,theme=>{const dark=theme==='dark';curtain.style.background=dark?'#151b13f5':'#eeefe7f5';curtain.style.color=dark?'#f1f1e9':'#171b15';});
 lockRoot.querySelector('style').textContent+=':host([data-theme=light]) .card{background:#f7f6f0;border-color:#cbd2bf}:host([data-theme=light]) p{color:#646f59}:host([data-theme=light]) b{color:#4b8435}:host([data-theme=dark]) .card{background:#1c2419;border-color:#35402d}:host([data-theme=dark]) button{background:#bdcca5;color:#151b13}';
 const controls=TradeLockWidget(shadow,{theme:theme=>{container.style.colorScheme=theme;container.style.background=theme==='dark'?'#151b13':'#f7f6f0';container.style.borderColor=theme==='dark'?'#35402d':'#daddcf';},minimize:()=>show(false),lock:applyLock,trades:(trades,enabled)=>{markerTrades=trades;markersEnabled=enabled;paintMarkers();}});
 window.addEventListener('resize',paintMarkers);window.addEventListener('scroll',paintMarkers,true);
 restore.onclick=()=>show(true);
 function out(data){if(data.type==='TOKEN')controls.setToken(data.token);if(data.type==='BLOCKED')controls.blocked();}
 chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.type==='show-fomo-widget'){show(true);scan();reply({ok:true});}});
 function priceValue(el){
  if(!el)return NaN;
  const sub=el.querySelector('sub');
  if(sub){const zeros=Number(sub.textContent);if(!Number.isInteger(zeros)||zeros<0||zeros>18)return NaN;const text=el.textContent.replace(/[$,\s]/g,'');const marker=sub.textContent;const at=text.indexOf(marker,2);if(at>=0)return Number(text.slice(0,2)+'0'.repeat(zeros)+text.slice(at+marker.length));}
  return Number(el.textContent.replace(/[$,\s]/g,''));
 }
 function identity(){const m=location.pathname.match(/^\/tokens\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9]+)\/?$/);return m?{chain:m[1].toLowerCase(),address:m[2],key:m[1].toLowerCase()+':'+m[2]}:null;}
 function read(){
  const token=identity();if(!token)return null;
  const imageButton=document.querySelector('button[aria-label="View token image"]');
  const header=imageButton?.parentElement;
  const addr=header?.querySelector('button[aria-label="Copy address"]')?.textContent.replace(/\s/g,'');
  // During SPA navigation the URL can change before the old token header disappears.
  if(!header||!addr||!addr.startsWith(token.address.slice(0,6))||!addr.endsWith(token.address.slice(-6)))return null;
  const title=header.querySelector('[translate="no"]');token.name=title?.textContent.trim().slice(0,120)||'Token';
  const image=imageButton.querySelector('img')?.src;token.image=image&&image.startsWith('https://')?image:'';
  const labels=['Price','Market cap','24H change','24H Vol.','Liquidity'];const fields={};
  for(const el of document.querySelectorAll('div')){
   if(el.children.length||!labels.includes(el.textContent.trim()))continue;
   const value=el.nextElementSibling;if(value)fields[el.textContent.trim()]=value;
  }
  const price=priceValue(fields.Price);if(!Number.isFinite(price)||price<=0)return null;
  token.price=price;token.observedAt=Date.now();token.marketCap=fields['Market cap']?.textContent.trim()||'—';token.volume=fields['24H Vol.']?.textContent.trim()||'—';token.liquidity=fields.Liquidity?.textContent.trim()||'—';token.change=fields['24H change']?.textContent.trim()||'—';return token;
 }
 async function scan(){
  try{
   if(!chrome.runtime?.id)return;
   const url=location.href;if(url!==lastUrl){lastUrl=url;latest=null;out({type:'TOKEN',token:null});}
   const token=read();latest=token;
   if(token){const result=await chrome.runtime.sendMessage({type:'fomo-snapshot',token});out({type:'TOKEN',token:result?.ok&&token.key===identity()?.key?token:null});}
   else out({type:'TOKEN',token:null});
   paintMarkers();
  }catch(_){} // Extension reload invalidates old page scripts; a page refresh restores them.
 }
 async function syncGuard(){try{const s=await chrome.storage.local.get(['fomoTradingLock','enabled']);guard=s.fomoTradingLock===true&&s.enabled!==false;}catch(_){guard=false;}}
 syncGuard();chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&(c.fomoTradingLock||c.enabled))syncGuard();});
 function guardedButton(target){const b=target instanceof Element?target.closest('button'):null;return b&&/^\s*(Buy|Sell|Swap)(?:\s|$)/i.test(b.textContent.trim())&&!/^Swap settings$/i.test(b.textContent.trim());}
 function block(e){if(!guard||!identity()||!guardedButton(e.target))return;e.preventDefault();e.stopImmediatePropagation();show(true);out({type:'BLOCKED'});}
 document.addEventListener('click',block,true);
 document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')block(e);},true);
 // Do not submit a trade form while the optional guard is enabled.
 document.addEventListener('submit',e=>{if(guard&&identity()&&e.target.querySelector('button')&&Array.from(e.target.querySelectorAll('button')).some(b=>guardedButton(b))){e.preventDefault();e.stopImmediatePropagation();show(true);out({type:'BLOCKED'});}},true);
 setInterval(scan,2000);scan();
})();
