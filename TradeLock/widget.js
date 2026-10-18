globalThis.TradeLockWidget=(root,hooks)=>{
const $=id=>root.getElementById(id);
const body=$('widget-body');
const monteCarlo=TradeLockMonteCarloPanel.mount($('monteCarloPanel'),()=>state?TradeLockPaper.completed(reportAccount()):[]);
TradeLockTheme.mount(body,$('themeToggle'),theme=>hooks.theme?.(theme));
const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const capFormat=n=>Number.isFinite(n)?'$'+n.toLocaleString('en-US',{notation:'compact',maximumFractionDigits:2}):'—';
const priceFormat=n=>Number.isFinite(n)?'$'+n.toLocaleString('en-US',{maximumSignificantDigits:7}):'—';
let token=null,state=null,side='buy',percent=false,busy=false,target=null,notice='';
// Preview reports use a separate in-memory account. Orders always use state.account.
let demoDatasets=[],demoChoice='saved';
const demoBanner=document.createElement('section'),demoLabel=document.createElement('p'),demoSelect=document.createElement('select'),demoTitle=document.createElement('label'),demoNote=document.createElement('small');
demoBanner.id='demoHistoryBanner';demoBanner.hidden=true;
demoBanner.style.cssText='border:1px solid currentColor;border-radius:14px;padding:12px;margin:12px 0';
demoLabel.style.cssText='margin:8px 0;font-size:12px;line-height:1.5';
demoSelect.id='demoDataset';demoSelect.style.cssText='min-height:44px;width:100%';
demoTitle.htmlFor='demoDataset';demoTitle.textContent='History source';demoTitle.style.cssText='display:block;margin-bottom:6px';
demoNote.style.cssText='display:block;line-height:1.5';
demoBanner.append(demoTitle,demoSelect,demoLabel,demoNote);$('viewTabs').after(demoBanner);
function selectedDemo(){return demoDatasets.find(d=>d.id===demoChoice);}
function reportAccount(){return selectedDemo()?.account||state?.account;}
function paintDemoBanner(){
 const demo=selectedDemo();demoBanner.hidden=!demoDatasets.length||view==='trade';
 demoLabel.textContent=demo?'FICTIONAL DEMO · 100 closed positions. '+demo.description:'Showing your saved paper history. Sample datasets never change your account.';
 demoNote.hidden=!demo||view!=='math';
 demoNote.textContent='Monte Carlo uses each recorded percentage return with your chosen allocation; it does not replay the varying dollar stakes. Stop-loss exits are synthetic assumptions, not proof of a strategy. No borrowing or leverage is modeled.';
}
demoSelect.onchange=()=>{demoChoice=demoSelect.value;selectedCard=null;historyPage=0;historySignature='';paintDemoBanner();render();};
async function loadDemoHistory(){
 try{
  // Optional local file: no API requests and no writes to saved account history.
  const response=await fetch(chrome.runtime.getURL('demo-trades.json'),{cache:'no-store'});
  if(!response.ok)return;const fixture=await response.json();
  if(fixture.isDemo!==true||fixture.schemaVersion!==2||!Array.isArray(fixture.datasets))return;
  demoDatasets=fixture.datasets.filter(d=>typeof d.id==='string'&&typeof d.label==='string'&&d.account&&TradeLockPaper.completed(d.account).length===100);
  if(!demoDatasets.length)return;
  for(const [value,text] of [['saved','My saved history'],...demoDatasets.map(d=>[d.id,d.label])]){const option=document.createElement('option');option.value=value;option.textContent=text;demoSelect.append(option);}
  demoChoice=demoDatasets[0].id;demoSelect.value=demoChoice;paintDemoBanner();render();
 }catch(_){/* Removing the optional file leaves saved history as the source. */}
}
async function ask(type,data={}){const r=await chrome.runtime.sendMessage({type,...data});if(!r?.ok)throw Error(r?.error||'Reload this FOMO tab after reloading TradeLock.');return r;}
function fresh(){return !!token&&Date.now()-token.observedAt<15000&&Number.isFinite(token.price)&&token.price>0;}
function amountUSD(){const amount=Number($('amount').value);if(!percent)return amount;const base=side==='buy'?state?.account.cash||0:(state?.account.positions[token?.key]?.qty||0)*(token?.price||0);return base*amount/100;}
function graph(values){const svg=$('balanceChart');svg.replaceChildren();const v=values.filter(Number.isFinite);if(v.length<2)return;const lo=Math.min(...v),hi=Math.max(...v);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',v.map((n,i)=>`${i?'L':'M'}${2+i*136/(v.length-1)},${hi===lo?30:56-(n-lo)/(hi-lo)*50}`).join(' '));path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2');path.setAttribute('fill','none');svg.append(path);}
function signed(el,value,suffix=''){el.textContent=(value>=0?'+':'')+usd(value)+suffix;el.classList.toggle('down',value<0);}
function render(){
 if(!state)return;
 const a=state.account,paused=!state.enabled;
 body.classList.toggle('off',paused);body.classList.remove('loading');$('dashboard').inert=paused;$('dashboard').setAttribute('aria-hidden',String(paused));$('paused').hidden=!paused;
 $('tokenName').textContent=token?.name||'Choose a token on FOMO';$('chain').textContent=token?.chain?.toUpperCase()||'TOKEN';
 $('copyAddress').textContent=token?token.address.slice(0,6)+'…'+token.address.slice(-6)+' ⧉':'—';$('copyAddress').disabled=!token;
 const im=$('tokenImage');if(token?.image&&/^https:\/\//.test(token.image)){if(im.src!==token.image)im.src=token.image;im.hidden=false;}else{im.hidden=true;im.removeAttribute('src');}
 const cap=TradeLockPaper.marketCapValue(token?.marketCap);$('price').textContent=Number.isFinite(cap)?capFormat(cap):'—';$('change').textContent=token?.change||'—';$('change').classList.toggle('down',/▼|-/.test(token?.change||''));
 $('marketCap').textContent=capFormat(a.positions[token?.key]?.entryMarketCap);$('volume').textContent=token?.volume||'—';$('liquidity').textContent=token?.liquidity||'—';
 $('quoteStatus').textContent=fresh()?'● From FOMO page · updated '+new Date(token.observedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}):'Waiting for current token data · paper trades paused';
 const value=TradeLockPaper.value(a);$('balance').textContent=usd(value);signed($('balancePnl'),value-100,` (${(value-100).toFixed(2)}%)`);$('cash').textContent=usd(a.cash)+' available virtual cash';
 const cut=$('period').value==='all'?0:Date.now()-Number($('period').value)*86400000;graph(a.history.filter(x=>x.t>=cut).map(x=>x.v).concat([value]));
 const p=a.positions[token?.key],qty=p?.qty||0,current=qty*(token?.price||0),pnl=current-(p?.cost||0);
 $('positionQty').textContent=qty?qty.toLocaleString('en-US',{maximumSignificantDigits:6}):'—';$('entry').textContent=qty?capFormat(p.entryMarketCap):'—';$('positionValue').textContent=qty?usd(current):'—';
 if(qty)signed($('positionPnl'),pnl,` (${(pnl/p.cost*100).toFixed(2)}%)`);else $('positionPnl').textContent='—';
 $('targetsNote').textContent=p?.targetBasis==='marketCap'?`Take profit +${p.takeProfitPct}% · Stop loss −${p.stopLossPct}% · market-cap change from entry.`:(p?.takeProfit?'Take profit '+priceFormat(p.takeProfit)+' · ':'')+(p?.stopLoss?'Stop loss '+priceFormat(p.stopLoss)+' · ':'')+'Paper triggers run while this token page is open.';
 $('clearPosition').disabled=!qty||!fresh();$('takeProfit').disabled=!qty;$('stopLoss').disabled=!qty;
 $('buy').classList.toggle('selected',side==='buy');$('sell').classList.toggle('selected',side==='sell');$('amountMode').classList.toggle('selected',percent);$('amountMode').textContent=percent?'$':'%';$('amountLabel').textContent=percent?'Amount (% of '+(side==='buy'?'paper cash':'position')+')':'Amount (USD)';$('amount').max=percent?'100':'';
 const presets=percent?[25,50,75,100]:[5,10,25,100];
 Array.from($('quickAmounts').querySelectorAll('button')).forEach((b,i)=>{b.dataset.amount=presets[i];b.textContent=percent?presets[i]+'%':'$'+presets[i];});
 $('available').textContent=side==='buy'?usd(a.cash)+' paper cash available':qty?qty.toLocaleString('en-US',{maximumSignificantDigits:6})+' '+(token?.name||'tokens')+' available to sell ('+usd(current)+')':'No paper position in this token yet.';
 const amount=amountUSD(),estimate=token?(side==='buy'?amount/(token.price*(1+state.slippage/100)):amount/token.price):0;
 $('estimate').textContent=estimate>0?'≈ '+estimate.toLocaleString('en-US',{maximumSignificantDigits:5})+' tokens':'— tokens';$('slippageNote').textContent=state.slippage+'% simulated slippage';$('submitTrade').textContent='Simulate '+(side==='buy'?'Buy':'Sell');$('submitTrade').disabled=busy||paused||!fresh()||!Number.isFinite(amount)||amount<=0||(percent&&Number($('amount').value)>100)||(side==='sell'&&!qty)||(side==='buy'&&(amount>a.cash+1e-9||Object.keys(a.positions).length>0));
 $('entryTargets').hidden=side!=='buy';
 const tpPct=Number($('entryTakeProfit').value),slPct=Number($('entryStopLoss').value);
 const validTargets=Number.isFinite(cap)&&Number.isFinite(tpPct)&&Number.isFinite(slPct)&&tpPct>0&&slPct>0&&slPct<100;
 $('entryTargetPreview').textContent=validTargets?'At '+capFormat(cap)+' MC: take profit '+capFormat(cap*(1+tpPct/100))+' · stop loss '+capFormat(cap*(1-slPct/100))+'. Targets are fixed when you buy.':slPct>=100?'Stop loss must be less than 100%.':tpPct<0||slPct<0?'Use positive percentages.':'Choose both percentages.';
 for(const [id,input] of [['profitPresets','entryTakeProfit'],['lossPresets','entryStopLoss']])for(const b of $(id).querySelectorAll('button'))b.classList.toggle('selected',Number(b.dataset.pct)===Number($(input).value));
 if(side==='buy'&&!validTargets)$('submitTrade').disabled=true;$('tradeLock').disabled=busy;
 $('tradeLock').setAttribute('aria-checked',String(state.tradingLock));$('lockNote').textContent=state.tradingLock?'Screen locked · switch off to unlock.':'Switch on to lock the FOMO screen.';
 signed($('realizedPnl'),a.realizedPnl||0,' realized');
 $('historyRows').replaceChildren();
 const recent=a.trades.slice(-6).reverse();
 if(!recent.length){$('historyRows').textContent='Your paper trades will appear here.';}
 recent.forEach(t=>{const row=document.createElement('div');row.className='history-row';const left=document.createElement('span'),right=document.createElement('b');left.textContent=(t.side==='buy'?'Bought ':'Sold ')+t.qty.toLocaleString('en-US',{maximumSignificantDigits:5})+' '+t.name;right.textContent=usd(t.usd);row.append(left,right);$('historyRows').append(row);});
 renderHistory();renderPerformance();monteCarlo.refresh();
 $('sessionProgress').textContent=(state.sessionEntries||0)+' of '+(state.tradeLimit||1)+' trades'+(state.limitReached?' · Limit reached':'');
 $('sessionBreak').textContent=Object.keys(a.positions).length?'Close your position to start the 30-minute break timer.':state.breakRemainingMs>0?'Count resets after '+Math.ceil(state.breakRemainingMs/60000)+' more minutes without a trade.':'A 30-minute break resets your count.';
 if(state.limitReached&&side==='buy')$('submitTrade').disabled=true;
 if(a.lastNotice&&notice!==a.lastNotice){notice=a.lastNotice;$('message').textContent=notice;}
}
let loading=false,again=false;
async function load(){if(loading){again=true;return;}loading=true;try{state=await ask('fomo-state');render();hooks.trades?.(state.account.trades,state.enabled);hooks.lock?.(state);}catch(e){$('message').textContent=e.message;}finally{loading=false;if(again){again=false;load();}}}
function setToken(t){
 if(t&&(!Number.isFinite(t.price)||t.price<=0||typeof t.key!=='string'||typeof t.name!=='string'||typeof t.address!=='string'||typeof t.chain!=='string'))return;
 if(token?.key!==t?.key){$('targetPanel').hidden=true;target=null;$('entryTakeProfit').value='';$('entryStopLoss').value='';$('message').textContent='Only virtual funds. No wallet connection.';}
 token=t;render();
}
$('minimize').onclick=()=>hooks.minimize();
for(const [id,input] of [['profitPresets','entryTakeProfit'],['lossPresets','entryStopLoss']])$(id).onclick=e=>{const b=e.target.closest('button[data-pct]');if(b){$(input).value=b.dataset.pct;render();}};
$('entryTakeProfit').oninput=render;$('entryStopLoss').oninput=render;
$('period').onchange=render;$('amount').oninput=()=>{render();const amount=amountUSD();$('message').textContent=!Number.isFinite(amount)||amount<=0?'Enter an amount above zero.':side==='buy'&&amount>(state?.account.cash||0)?'Not enough paper cash. Choose a smaller amount.':'Only virtual funds. No wallet connection.';};
$('buy').onclick=()=>{side='buy';percent=false;$('amount').value=10;render();};$('sell').onclick=()=>{side='sell';percent=true;$('amount').value=100;render();};$('amountMode').onclick=()=>{percent=!percent;render();};
$('quickAmounts').onclick=e=>{const b=e.target.closest('button[data-amount]');if(b){$('amount').value=b.dataset.amount;render();}};
async function action(fn){if(busy)return;busy=true;render();try{await fn();await load();}catch(e){$('message').textContent=e.message;}finally{busy=false;render();}}
$('submitTrade').onclick=e=>{if(e.detail>1)return;return action(async()=>{if(!fresh())throw Error('Waiting for current FOMO token data.');const v=Number($('amount').value);if(!Number.isFinite(v)||v<=0||(percent&&v>100))throw Error('Enter a valid positive amount.');const key=token.key;const takeProfitPct=Number($('entryTakeProfit').value),stopLossPct=Number($('entryStopLoss').value);if(side==='buy'&&(!Number.isFinite(takeProfitPct)||takeProfitPct<=0||!Number.isFinite(stopLossPct)||stopLossPct<=0||stopLossPct>=100))throw Error('Choose both percentages. Stop loss must be below 100%.');const r=await ask('fomo-trade',{key,side,mode:percent?'percent':'usd',amount:percent?v:amountUSD(),takeProfitPct,stopLossPct});const t=r.receipt;$('message').textContent=(t.side==='buy'?'Bought ':'Sold ')+t.qty.toLocaleString('en-US',{maximumSignificantDigits:6})+' '+t.name+' · '+usd(t.usd)+(t.side==='buy'?' paper cash spent.':' paper cash received.');});};
$('clearPosition').onclick=()=>action(async()=>{const p=state.account.positions[token?.key];if(!p||!fresh())throw Error('Waiting for a fresh quote.');if(!confirm('Close this entire paper position at the current displayed price with simulated slippage?'))return;await ask('fomo-trade',{key:token.key,side:'sell',mode:'percent',amount:100});$('message').textContent='Paper position closed.';});
$('copyAddress').onclick=async()=>{try{await navigator.clipboard.writeText(token.address);$('message').textContent='Contract address copied.';}catch(_){$('message').textContent=token.address;}};
function settings(){if(view==='math')return;const open=$('settingsPanel').hidden;$('settingsPanel').hidden=!open;$('slippage').value=state?.slippage??4;$('tradeLimit').value=state?.tradeLimit||1;paintLimitPresets();if(open)$('settingsPanel').scrollIntoView({block:'nearest',behavior:'smooth'});}
$('settingsButton').onclick=settings;$('slippageButton').onclick=settings;
$('saveSettings').onclick=()=>action(async()=>{await ask('fomo-settings',{slippage:Number($('slippage').value),tradeLimit:Number($('tradeLimit').value)});$('message').textContent='Paper settings saved.';});
$('tradeLock').onclick=()=>action(async()=>{await ask('fomo-lock',{locked:!state.tradingLock});});
$('reset').onclick=()=>action(async()=>{if(confirm('Reset all FOMO paper positions and return to $100 virtual cash?'))await ask('fomo-reset');});
function openTarget(kind){target=kind;const p=state.account.positions[token.key];const capTarget=p?.targetBasis==='marketCap';$('targetLabel').textContent=capTarget?'Market-cap change from entry (%)':'Trigger price (USD)';$('removeTarget').hidden=capTarget;$('targetPanel').hidden=false;$('targetTitle').textContent=kind==='takeProfit'?'Paper take profit':'Paper stop loss';$('targetPrice').value=capTarget?p[kind+'Pct']:p?.[kind]||token.price*(kind==='takeProfit'?1.2:.8);$('targetPanel').scrollIntoView({block:'nearest',behavior:'smooth'});}
$('takeProfit').onclick=()=>openTarget('takeProfit');$('stopLoss').onclick=()=>openTarget('stopLoss');$('cancelTarget').onclick=()=>{$('targetPanel').hidden=true;};
$('saveTarget').onclick=()=>action(async()=>{await ask('fomo-target',{key:token.key,target,...(state.account.positions[token.key]?.targetBasis==='marketCap'?{percent:Number($('targetPrice').value)}:{price:Number($('targetPrice').value)})});$('targetPanel').hidden=true;$('message').textContent='Paper target saved.';});
$('removeTarget').onclick=()=>action(async()=>{await ask('fomo-target',{key:token.key,target,price:null});$('targetPanel').hidden=true;});
chrome.storage.onChanged.addListener((c,a)=>{if(a==='local'&&(c.fomoAccount||c.enabled||c.fomoSlippage||c.fomoTradingLock||c.fomoTradeLimit))load();});
let view='trade',historyPage=0,selectedCard=null,previewCard=null,previewCanvas=null,previewVersion=0,historySignature='',previewFocus=null;
const previewInert=new Map();
const stamp=t=>new Date(t).toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
const duration=ms=>{const s=Math.max(0,Math.round(ms/1000));return s<60?s+' sec':s<3600?Math.floor(s/60)+' min '+s%60+' sec':Math.floor(s/3600)+' hr '+Math.floor(s%3600/60)+' min';};
const signedMoney=n=>(n>=0?'+':'−')+usd(Math.abs(n));
function statGrid(el,items){el.replaceChildren();for(const [label,value,tone] of items){const cell=document.createElement('div'),small=document.createElement('small'),b=document.createElement('b');small.textContent=label;b.textContent=value;if(tone)b.className=tone;cell.append(small,b);el.append(cell);}}
function chart(svg,points,executions=[]){
 svg.replaceChildren();const v=points.filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.cap)).sort((a,b)=>a.t-b.t);if(v.length<2)return;
 const ns='http://www.w3.org/2000/svg',lo=Math.min(...v.map(p=>p.cap)),hi=Math.max(...v.map(p=>p.cap)),spread=hi-lo||Math.max(hi*.01,1),start=v[0].t,range=Math.max(1,v.at(-1).t-start);
 const x=t=>18+(t-start)/range*304,y=n=>126-(n-lo)/spread*99;
 const path=document.createElementNS(ns,'path');path.setAttribute('d',v.map((p,i)=>(i?'L':'M')+x(p.t)+','+y(p.cap)).join(' '));path.setAttribute('stroke','#557047');path.setAttribute('stroke-width','3');path.setAttribute('stroke-linejoin','round');path.setAttribute('fill','none');svg.append(path);
 for(const t of executions.filter(t=>Number.isFinite(t.marketCap)&&t.marketCap>0&&Number.isFinite(t.t))){const buy=t.side==='buy',cx=x(t.t),cy=y(t.marketCap),mark=document.createElementNS(ns,'path');mark.setAttribute('d',buy?`M${cx},${cy-8}l-5,9h10z`:`M${cx},${cy+8}l-5,-9h10z`);mark.setAttribute('fill',buy?'#4b8435':'#b75449');const title=document.createElementNS(ns,'title');title.textContent=(buy?'Buy':'Sell')+' · '+capFormat(t.marketCap)+' MC · '+stamp(t.t);mark.append(title);svg.append(mark);}
}
function showView(next){view=next;paintDemoBanner();
 // Math Models shows only its analysis and the shared Trading Lock control.
 const isMath=next==='math';
 $('settingsButton').hidden=isMath;
 const sessionCard=root.querySelector('.session-card');if(sessionCard)sessionCard.hidden=isMath;
 if(isMath)$('settingsPanel').hidden=true;
for(const name of ['trade','history','performance','math'])$(name+'View').hidden=name!==next;for(const b of $('viewTabs').querySelectorAll('button')){b.classList.toggle('selected',b.dataset.view===next);b.setAttribute('aria-pressed',String(b.dataset.view===next));}if(next==='history')renderHistory(true);if(next==='performance')renderPerformance();if(next==='math')monteCarlo.refresh();}
function renderPerformance(){if(!state)return;const a=reportAccount(),s=TradeLockPaper.statistics(a);statGrid($('performanceStats'),[['Account value',usd(s.equity)],['Total P&L',signedMoney(s.totalPnl),s.totalPnl>=0?'positive':'negative'],['Realized P&L',signedMoney(s.realized),s.realized>=0?'positive':'negative'],['Open P&L',signedMoney(s.unrealized),s.unrealized>=0?'positive':'negative'],['Saved closed trades',String(s.count)],['Win rate',s.winRate===null?'—':s.winRate.toFixed(1)+'%'],['Average win',s.averageWin===null?'—':signedMoney(s.averageWin),'positive'],['Average loss',s.averageLoss===null?'—':signedMoney(s.averageLoss),'negative'],['Biggest drop',usd(s.drawdown)],['Biggest drop (%)',s.drawdownPct.toFixed(2)+'%']]);chart($('performanceChart'),a.history.map(p=>({t:p.t,cap:p.v})).concat([{t:Date.now(),cap:s.equity}]));}
function renderDetails(card){
 $('tradeDetails').hidden=!card;$('shareRows').hidden=!!card;$('historyPaging').hidden=!!card;if(!card)return;
 $('detailName').textContent=card.name;$('detailDate').textContent=stamp(card.openedAt)+' → '+stamp(card.closedAt)+' · Held '+duration(card.closedAt-card.openedAt);
 statGrid($('detailStats'),[['Entry MC',capFormat(card.entryMarketCap)],['Exit MC',capFormat(card.exitMarketCap)],['Invested',usd(card.invested)],['Received',usd(card.received)],['P&L',signedMoney(card.pnl),card.pnl>=0?'positive':'negative'],['Return',(card.pnlPct>=0?'+':'')+card.pnlPct.toFixed(2)+'%',card.pnl>=0?'positive':'negative']]);
 const points=[...(card.series||[]),...(card.executions||[]).map(t=>({t:t.t,cap:t.marketCap}))].filter(p=>Number.isFinite(p.cap)&&p.cap>0);chart($('detailChart'),points,card.executions||[]);$('detailChart').hidden=points.length<2;
 $('detailChartNote').textContent=points.length<2?'Market-cap chart unavailable for this past trade.':card.source==='execution points'?'Recorded execution points only · green buy / red sell':'Recorded market cap · green buy / red sell';
 $('detailExecutions').replaceChildren();for(const t of card.executions||[]){const row=document.createElement('div');row.className='history-row';const left=document.createElement('div'),label=document.createElement('b'),sub=document.createElement('small'),right=document.createElement('b');label.textContent=(t.side==='buy'?'▲ Bought ':'▼ Sold ')+t.qty.toLocaleString('en-US',{maximumSignificantDigits:5})+' tokens';label.className=t.side==='buy'?'positive':'negative';sub.textContent=stamp(t.t)+' · '+capFormat(t.marketCap)+' MC';right.textContent=usd(t.usd);left.append(label,sub);row.append(left,right);$('detailExecutions').append(row);}
}
function renderHistory(force=false){
 if(!state)return;const cards=TradeLockPaper.completed(reportAccount()),search=$('historySearch').value.toLowerCase().trim(),filter=$('historyFilter').value;
 const list=cards.filter(c=>(!search||(c.name+' '+c.key).toLowerCase().includes(search))&&(filter==='all'||(filter==='wins'?c.pnl>1e-9:c.pnl< -1e-9)));const pages=Math.max(1,Math.ceil(list.length/10));historyPage=Math.min(historyPage,pages-1);
 const signature=JSON.stringify([cards.map(c=>[c.id,c.closedAt,c.pnl,c.executions?.length]),search,filter,historyPage,selectedCard?.id]);if(!force&&signature===historySignature)return;historySignature=signature;
 if(selectedCard){selectedCard=cards.find(c=>c.id===selectedCard.id)||null;}renderDetails(selectedCard);
 $('historyCount').textContent=list.length+' saved completed '+(list.length===1?'trade':'trades');$('shareRows').replaceChildren();if(!list.length)$('shareRows').textContent=cards.length?'No trades match your search.':'Finish a paper trade to see it here.';
 for(const card of list.slice(historyPage*10,historyPage*10+10)){const row=document.createElement('div');row.className='trade-card';const top=document.createElement('div');top.className='row';const info=document.createElement('div'),name=document.createElement('b'),result=document.createElement('p'),date=document.createElement('small'),actions=document.createElement('div');actions.className='actions';name.textContent=card.name;result.textContent=signedMoney(card.pnl)+' · '+(card.pnlPct>=0?'+':'')+card.pnlPct.toFixed(2)+'%';result.className=card.pnl>=0?'positive':'negative';date.textContent=stamp(card.closedAt)+' · '+duration(card.closedAt-card.openedAt);info.append(name,result,date);const detail=document.createElement('button'),preview=document.createElement('button');detail.textContent='Details';detail.setAttribute('aria-label','Details for '+card.name);detail.onclick=()=>{selectedCard=card;renderHistory(true);$('closeDetails').focus();};preview.textContent='Share';preview.setAttribute('aria-label','Preview '+card.name+' share card');preview.onclick=()=>openPreview(card);actions.append(detail,preview);top.append(info,actions);row.append(top);$('shareRows').append(row);}
 $('historyPrev').disabled=historyPage===0;$('historyNext').disabled=historyPage>=pages-1;$('historyPage').textContent=(historyPage+1)+' / '+pages;
}
async function paintPreview(){const version=++previewVersion;$('downloadShare').disabled=true;$('shareStatus').textContent='Creating your preview…';previewCanvas=null;try{const canvas=await TradeLockShare.drawCard(previewCard,{hideAmounts:$('hideAmounts').checked});if(version!==previewVersion||$('sharePanel').hidden)return;previewCanvas=canvas;$('shareCanvas').replaceChildren(canvas);$('downloadShare').disabled=false;$('shareStatus').textContent=$('hideAmounts').checked?'Dollar amounts are hidden in this PNG.':'Ready to download. Paper results include simulated slippage.';}catch(e){if(version===previewVersion)$('shareStatus').textContent='Could not create preview: '+e.message;}}
function openPreview(card){previewCard={...card,image:card.image||(token?.key===card.key?token.image:'')};previewFocus=root.activeElement;$('sharePanel').hidden=false;$('shareBackdrop').hidden=false;const header=root.querySelector('header');previewInert.set(header,header.inert);header.inert=true;$('hideAmounts').checked=false;for(const el of $('dashboard').children)if(el!==$('sharePanel')&&el!==$('shareBackdrop')){previewInert.set(el,el.inert);el.inert=true;}$('closeShare').focus();paintPreview();}
function closePreview(){previewVersion++;previewCard=null;previewCanvas=null;$('sharePanel').hidden=true;$('shareBackdrop').hidden=true;$('shareCanvas').replaceChildren();for(const [el,was] of previewInert)el.inert=was;previewInert.clear();if(previewFocus?.isConnected)previewFocus.focus();else $('viewTabs').querySelector('[data-view="history"]').focus();}
$('viewTabs').onclick=e=>{const b=e.target.closest('button[data-view]');if(b)showView(b.dataset.view);};
$('historySearch').oninput=()=>{historyPage=0;selectedCard=null;renderHistory(true);};$('historyFilter').onchange=()=>{historyPage=0;selectedCard=null;renderHistory(true);};
$('historyPrev').onclick=()=>{historyPage=Math.max(0,historyPage-1);renderHistory(true);};$('historyNext').onclick=()=>{historyPage++;renderHistory(true);};$('closeDetails').onclick=()=>{selectedCard=null;renderHistory(true);};$('detailPreview').onclick=()=>{if(selectedCard)openPreview(selectedCard);};$('closeShare').onclick=closePreview;$('shareBackdrop').onclick=closePreview;$('hideAmounts').onchange=paintPreview;
$('sharePanel').onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();closePreview();}if(e.key==='Tab'){const focusable=Array.from($('sharePanel').querySelectorAll('button,input')).filter(el=>!el.disabled);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&root.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&root.activeElement===last){e.preventDefault();first.focus();}}};
$('downloadShare').onclick=async()=>{if(!previewCanvas||!previewCard)return;$('downloadShare').disabled=true;try{await TradeLockShare.downloadCanvas(previewCanvas,previewCard);$('shareStatus').textContent='PNG downloaded.';}catch(e){$('shareStatus').textContent='Could not download PNG: '+e.message;}finally{$('downloadShare').disabled=!previewCanvas;}};
$('limitPresets').onclick=e=>{const b=e.target.closest('button[data-limit]');if(b){$('tradeLimit').value=b.dataset.limit;paintLimitPresets();}};
function paintLimitPresets(){for(const b of $('limitPresets').querySelectorAll('button'))b.classList.toggle('selected',Number(b.dataset.limit)===Number($('tradeLimit').value));}
$('tradeLimit').oninput=paintLimitPresets;$('editLimit').onclick=()=>{if($('settingsPanel').hidden)settings();$('tradeLimit').focus();};


load();loadDemoHistory();setInterval(()=>{render();load();},3000);
return {setToken,blocked:()=>{$('message').textContent='Trading Lock blocked a FOMO trade button. Use the paper controls here.';}};
};
