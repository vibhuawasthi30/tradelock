const $=id=>document.getElementById(id);
TradeLockTheme.mount(document.body,$('themeToggle'));
const coins=[['bitcoin','Bitcoin','BTC','assets/coins/bitcoin.png'],['ethereum','Ethereum','ETH','assets/coins/ethereum.svg'],['solana','Solana','SOL','assets/coins/solana.png']];
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
let state={},selected=null,busy=false;
const fresh=()=>state.enabled!==false && state.quotes && !state.error && Date.now()-(state.fetchedAt||0)<300000 && coins.every(([id])=>{const t=Date.parse(state.quotes[id]?.time);return Number.isFinite(t)&&Date.now()-t<300000;});
function graph(svg,values){
 svg.replaceChildren(); const v=values.filter(Number.isFinite);if(v.length<2)return;
 const lo=Math.min(...v),hi=Math.max(...v),span=hi-lo||1;
 const ns='http://www.w3.org/2000/svg';const path=document.createElementNS(ns,'path');
 path.setAttribute('d',v.map((n,i)=>`${i?'L':'M'}${i*146/(v.length-1)+2},${hi===lo?30:56-(n-lo)/span*50}`).join(' '));
 path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2.5');path.setAttribute('stroke-linecap','round');svg.append(path);
}
function render(){
 const a=state.account||{cash:100,holdings:{},history:[]},q=state.quotes||{};
 const total=a.cash+Object.entries(a.holdings).reduce((sum,[id,n])=>sum+n*(q[id]?.price||0),0);
 const valued=Object.keys(a.holdings).every(id=>q[id]);
 $('balance').textContent=valued?money(total):'—'; const pnl=total-100;
 $('pnl').textContent=valued?`${pnl>=0?'+':''}${money(pnl)} (${pnl.toFixed(2)}%)`:'Waiting for prices';$('pnl').classList.toggle('negative',pnl<0);
 $('cash').textContent=`${money(a.cash)} available cash · virtual account`;
 const days=$('period').value,cut=days==='all'?0:Date.now()-Number(days)*86400000;
 graph($('portfolioChart'),a.history.filter(x=>x.t>=cut).map(x=>x.v).concat(valued?[total]:[]));
 const paused=state.enabled===false;
 document.body.classList.toggle('locked',paused);
 $('dashboard').inert=paused;
 $('dashboard').setAttribute('aria-hidden',String(paused));
 $('pauseOverlay').hidden=!paused;
 $('toggle').setAttribute('aria-checked',String(!paused));
 $('toggleLabel').textContent=paused?'OFF':'ON';
 $('toggle').disabled=false;
 document.body.classList.remove('initializing');
 $('fomo').href='https://fomo.family/r/lqvid';
 $('status').textContent=state.enabled===false?'● PAUSED':fresh()?'● LIVE PRICES':'● OFFLINE / STALE';
 $('updated').textContent=state.fetchedAt?`Updated ${new Date(state.fetchedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:'Waiting for market data';
 $('message').textContent=state.error || (state.enabled===false?'Tracking paused.':fresh()?'USD · 24h change · 7-day price charts':'Connecting or cached prices. Paper trades require fresh data.');
 $('tokens').replaceChildren();
 coins.forEach(([id,name,symbol,image])=>{
 const c=q[id],btn=document.createElement('button');btn.className='token';btn.setAttribute('aria-label',`Paper trade ${name}`);
 btn.innerHTML=`<span class="coin ${id}"><img src="${image}" alt="${name} logo"></span><span class="name"><b>${name}</b><small>${symbol}</small></span><span class="price"><b></b><span class="change"></span></span><svg viewBox="0 0 150 60" aria-label="7-day price history"></svg><span>›</span>`;
 btn.querySelector('.price b').textContent=c?money(c.price):'—';const change=btn.querySelector('.change');change.textContent=Number.isFinite(c?.change)?`${c.change>=0?'+':''}${c.change.toFixed(2)}%`:'—';change.classList.toggle('negative',c?.change<0);graph(btn.querySelector('svg'),c?.history||[]);btn.onclick=()=>{selected=id;$('tradePanel').hidden=false;$('tradeTitle').textContent=`Paper trade · ${name}`;renderHolding();};$('tokens').append(btn);
 });renderHolding();
}
function renderHolding(){if(selected)$('holding').textContent=`Holding ${(state.account?.holdings[selected]||0).toFixed(8)} ${coins.find(c=>c[0]===selected)[2]} · Simulated trades only`;}
async function load(){state=await chrome.storage.local.get(null);render();}
$('period').onchange=render;
$('toggle').onclick=async()=>{await chrome.storage.local.set({enabled:state.enabled===false});await load();if(state.enabled)chrome.runtime.sendMessage({type:'refresh'});};
$('refresh').onclick=async()=>{if(busy)return;busy=true;$('refresh').disabled=true;try{await chrome.runtime.sendMessage({type:'refresh'});await load();}finally{busy=false;$('refresh').disabled=false;}};
$('watchlist').onclick=()=>{$('tokens').hidden=!$('tokens').hidden;$('watchlist').setAttribute('aria-expanded',String(!$('tokens').hidden));};
$('tradeForm').onsubmit=async e=>{
 e.preventDefault();if(busy)return;busy=true;
 try{
 await load();const amount=Number($('amount').value),side=e.submitter?.value;
 if(!selected||!fresh())throw Error('Refresh prices before placing a paper trade.');
 if(!Number.isFinite(amount)||amount<=0||!['buy','sell'].includes(side))throw Error('Enter a positive USD amount.');
 const a=structuredClone(state.account),price=state.quotes[selected].price,qty=amount/price,held=a.holdings[selected]||0;
 if(side==='buy'){if(amount>a.cash+1e-9)throw Error('Not enough virtual cash.');a.cash=Math.max(0,a.cash-amount);a.holdings[selected]=held+qty;}
 else{if(qty>held+1e-12)throw Error('Not enough tokens to sell.');a.cash+=amount;a.holdings[selected]=Math.max(0,held-qty);}
 a.history.push({t:Date.now(),v:a.cash+Object.entries(a.holdings).reduce((s,[id,n])=>s+n*state.quotes[id].price,0)});a.history=a.history.slice(-2000);
 await chrome.storage.local.set({account:a});await load();$('message').textContent=`Paper ${side} completed: ${money(amount)}.`;
 }catch(err){$('message').textContent=err.message;}finally{busy=false;}
};
$('settings').onsubmit=async e=>{e.preventDefault();await chrome.storage.local.set({enabled:state.enabled!==false});$('message').textContent='Settings saved.';};
$('reset').onclick=async()=>{if(confirm('Reset all paper holdings and virtual cash to $100?')){await chrome.storage.local.set({account:{cash:100,holdings:{},history:[{t:Date.now(),v:100}]}});await load();}};
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local')load();});
(async()=>{await load();await chrome.runtime.sendMessage({type:'refresh'});await load();})();
setInterval(()=>load(),30000);

$('fomo').onclick=async e=>{e.preventDefault();try{const r=await chrome.runtime.sendMessage({type:'open-fomo'});if(!r?.ok)throw Error(r?.error||'Could not open FOMO.');if(r.reloadNeeded)$('message').textContent='Refresh your FOMO tab to load the TradeLock widget.';else window.close();}catch(err){$('message').textContent=err.message;}};
