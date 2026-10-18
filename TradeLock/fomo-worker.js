importScripts('paper-core.js');
let paperQueue=Promise.resolve();
function queuePaper(fn){const next=paperQueue.then(fn,fn);paperQueue=next.catch(()=>{});return next;}
function isFomoSender(sender){try{return new URL(sender.url).origin==='https://fomo.family'&&Number.isInteger(sender.tab?.id);}catch(_){return false;}}
function isWidget(sender){return sender.url?.startsWith(chrome.runtime.getURL('widget.html'))&&Number.isInteger(sender.tab?.id);}
function lockedPosition(a){return Object.entries(a.positions).find(([,p])=>p.locked===true);}
function account(s){return s.fomoAccount||TradeLockPaper.initial();}
function tradeLimit(s){return Number.isInteger(s.fomoTradeLimit)&&s.fomoTradeLimit>=1&&s.fomoTradeLimit<=100?s.fomoTradeLimit:1;}
function sessionCount(a){return Number.isInteger(a.sessionEntries)&&a.sessionEntries>0?a.sessionEntries:0;}
function screenLocked(s,a){return s.fomoTradingLock===true||(!!lockedPosition(a)&&s.fomoTradingLock!==false);}
async function handlePaper(m,sender){
 const store=await chrome.storage.local.get(['fomoAccount','fomoPageQuotes','fomoSlippage','fomoTradingLock','fomoLockMode','fomoTradeLimit','enabled']);
 const a=account(store),quotes=store.fomoPageQuotes||{},tab=String(sender.tab?.id);
 if(!Object.keys(a.positions).length&&sessionCount(a)>0&&Number.isFinite(a.sessionIdleSince)&&Date.now()-a.sessionIdleSince>=1800000){
  a.sessionEntries=0;delete a.sessionIdleSince;const release=store.fomoLockMode==='limit';if(release)store.fomoTradingLock=false;
  await chrome.storage.local.set({fomoAccount:a,...(release?{fomoTradingLock:false,fomoLockMode:'auto'}:{})});
 }
 const breakRemaining=Object.keys(a.positions).length||!Number.isFinite(a.sessionIdleSince)?null:Math.max(0,1800000-(Date.now()-a.sessionIdleSince));
 if(m.type==='fomo-snapshot'){
  if(!isFomoSender(sender))throw Error('Token snapshots must come from FOMO.');
  const page=chrome.tabs?.get?await chrome.tabs.get(sender.tab.id):sender.tab;
  const t=m.token,route=new URL(page?.url||sender.url).pathname.match(/^\/tokens\/([^/]+)\/([^/]+)\/?$/);
  if(!route||t?.key!==route[1].toLowerCase()+':'+route[2])throw Error('The token changed. Waiting for the current page.');
  if(typeof t.name!=='string'||t.name.length>120)throw Error('Invalid token name.');
  TradeLockPaper.validateQuote(t);if(store.enabled===false&&!lockedPosition(a))return {ok:true};
  const quote={key:t.key,chain:route[1].toLowerCase(),address:route[2],price:t.price,marketCap:TradeLockPaper.marketCapValue(t.marketCap),name:t.name,image:typeof t.image==='string'&&t.image.length<4096&&/^https:\/\//.test(t.image)?t.image:'',observedAt:Date.now()};quotes[tab]=quote;
  for(const [key,q] of Object.entries(quotes))if(Date.now()-q.observedAt>120000)delete quotes[key];
  a.marks[t.key]={price:t.price,marketCap:quote.marketCap,t:Date.now()};
  const p=a.positions[t.key];TradeLockPaper.observe(p,quote);
  const metric=p?.targetBasis==='marketCap'?quote.marketCap:t.price;
  if(p&&Number.isFinite(metric)&&((p.takeProfit&&metric>=p.takeProfit)||(p.stopLoss&&metric<=p.stopLoss))){
   const sold=TradeLockPaper.trade(a,quote,'sell',p.qty*t.price,store.fomoSlippage??4);
   sold.sessionIdleSince=Date.now();sold.marks[t.key]={price:t.price,marketCap:quote.marketCap,t:Date.now()};sold.trades.at(-1).marketCap=quote.marketCap;
   sold.lastNotice=`Paper ${p.takeProfit&&metric>=p.takeProfit?'take profit':'stop loss'} executed for ${t.name}.`;
   await chrome.storage.local.set({fomoAccount:sold,fomoPageQuotes:quotes,...((!['manual','limit'].includes(store.fomoLockMode))?{fomoTradingLock:false}: {})});
  }else{
   const last=a.history.at(-1);if(!last||Date.now()-last.t>60000){a.history.push({t:Date.now(),v:TradeLockPaper.value(a)});a.history=a.history.slice(-2000);}
   await chrome.storage.local.set({fomoAccount:a,fomoPageQuotes:quotes});
  }
  return {ok:true};
 }
 if(!isWidget(sender)&&!isFomoSender(sender))throw Error('Paper controls must come from TradeLock on FOMO.');
 if(m.type==='fomo-state')return {ok:true,account:a,enabled:store.enabled!==false,slippage:store.fomoSlippage??4,tradeLimit:tradeLimit(store),sessionEntries:sessionCount(a),limitReached:sessionCount(a)>=tradeLimit(store),breakRemainingMs:breakRemaining,tradingLock:screenLocked(store,a),locked:lockedPosition(a)?{key:lockedPosition(a)[0],...lockedPosition(a)[1],mark:a.marks[lockedPosition(a)[0]]}:null};
 if(m.type==='fomo-lock'){if(typeof m.locked!=='boolean')throw Error('Invalid lock state.');await chrome.storage.local.set({fomoTradingLock:m.locked,fomoLockMode:'manual'});return {ok:true};}
 if(screenLocked(store,a))throw Error('Switch Trading Lock off to use the paper controls.');
 if(m.type==='fomo-settings'){
  if(!Number.isFinite(m.slippage)||m.slippage<0||m.slippage>25)throw Error('Slippage must be between 0% and 25%.');
  const limit=m.tradeLimit??tradeLimit(store);
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Choose a trade limit from 1 to 100.');
  if(Object.keys(a.positions).length&&limit!==tradeLimit(store))throw Error('Close your paper position before changing the trade limit.');
  const reached=sessionCount(a)>=limit;
  await chrome.storage.local.set({fomoSlippage:m.slippage,fomoTradeLimit:limit,...(reached?{fomoTradingLock:true,fomoLockMode:'limit'}:{})});return {ok:true};
 }
 if(m.type==='fomo-session-reset'){if(Object.keys(a.positions).length||sessionCount(a)>0)throw Error('Sessions reset automatically after a 30-minute break with no open position.');return {ok:true};}
 if(m.type==='fomo-reset'){await chrome.storage.local.set({fomoAccount:TradeLockPaper.initial()});return {ok:true};}
 if(store.enabled===false)throw Error('Turn TradeLock on before paper trading.');
 const q=quotes[tab];TradeLockPaper.validateQuote(q);
 const current=chrome.tabs?.get?await chrome.tabs.get(sender.tab.id):sender.tab;
 const route=new URL(current?.url||sender.url).pathname.match(/^\/tokens\/([^/]+)\/([^/]+)\/?$/);
 if(!route||q.key!==route[1].toLowerCase()+':'+route[2])throw Error('The token changed. Wait for its market data before trading.');
 if(m.key!==q.key)throw Error('The token changed. Review the new token before trading.');
 if(m.type==='fomo-trade'){
  if(m.side==='buy'){
   if(sessionCount(a)>=tradeLimit(store))throw Error('Your trade limit is reached. Take a 30-minute break after your position closes.');
   if(Object.keys(a.positions).length)throw Error('Close your existing paper position before starting a locked trade.');
   if(!Number.isFinite(q.marketCap)||q.marketCap<=0)throw Error('Waiting for a current market cap from FOMO.');
   if(!Number.isFinite(m.takeProfitPct)||m.takeProfitPct<=0||!Number.isFinite(m.stopLossPct)||m.stopLossPct<=0||m.stopLossPct>=100||!Number.isFinite(q.marketCap*(1+m.takeProfitPct/100)))throw Error('Choose a positive take-profit percentage and a stop-loss percentage between 0 and 100.');
  }
  let amount=m.amount;
  if(m.mode==='percent'){
   if(!Number.isFinite(amount)||amount<=0||amount>100)throw Error('Choose a percentage between 0% and 100%.');
   amount=(m.side==='buy'?a.cash:(a.positions[q.key]?.qty||0)*q.price)*amount/100;
  }
  const next=TradeLockPaper.trade(a,q,m.side,amount,store.fomoSlippage??4);
  if(m.side==='buy'){delete next.sessionIdleSince;next.sessionEntries=sessionCount(a)+1;Object.assign(next.positions[q.key],{targetBasis:'marketCap',entryMarketCap:q.marketCap,takeProfitPct:m.takeProfitPct,stopLossPct:m.stopLossPct,takeProfit:q.marketCap*(1+m.takeProfitPct/100),stopLoss:q.marketCap*(1-m.stopLossPct/100),locked:true,chain:q.chain,address:q.address});}
  if(m.side==='sell'&&!next.positions[q.key])next.sessionIdleSince=Date.now();
  next.marks[q.key]={price:q.price,marketCap:q.marketCap,t:Date.now()};next.trades.at(-1).marketCap=q.marketCap;
  await chrome.storage.local.set({fomoAccount:next,...(m.side==='buy'?{fomoTradingLock:next.sessionEntries>=tradeLimit(store),fomoLockMode:next.sessionEntries>=tradeLimit(store)?'limit':'auto'}:{})});return {ok:true,receipt:next.trades.at(-1)};
 }
 if(m.type==='fomo-target'){
  const p=a.positions[q.key];if(!p)throw Error('Buy a paper position first.');
  if(!['takeProfit','stopLoss'].includes(m.target))throw Error('Invalid target.');
  if(p.targetBasis==='marketCap'){
   const pct=m.percent;
   if(!Number.isFinite(pct)||pct<=0||(m.target==='stopLoss'&&pct>=100))throw Error('Enter a positive percentage; stop loss must be below 100%.');
   const level=p.entryMarketCap*(1+(m.target==='takeProfit'?pct:-pct)/100);
   if(!Number.isFinite(q.marketCap)||!Number.isFinite(level)||level<=0)throw Error('Waiting for current market-cap data.');
   if(m.target==='takeProfit'&&level<=q.marketCap)throw Error('This take-profit target is already reached. Choose a higher percentage.');
   if(m.target==='stopLoss'&&level>=q.marketCap)throw Error('This stop-loss target is already reached. Choose a lower market-cap target.');
   p[m.target]=level;p[m.target+'Pct']=pct;
  }else if(m.price===null)delete p[m.target];else{
   if(!Number.isFinite(m.price)||m.price<=0)throw Error('Enter a positive target price.');
   if(m.target==='takeProfit'&&m.price<=q.price)throw Error('Take profit must be above the current price.');
   if(m.target==='stopLoss'&&m.price>=q.price)throw Error('Stop loss must be below the current price.');p[m.target]=m.price;
  }
  await chrome.storage.local.set({fomoAccount:a});return {ok:true};
 }
 throw Error('Unknown paper action.');
}
chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(m.type==='open-fomo'){
  (async()=>{
   const tabs=await chrome.tabs.query({url:'https://fomo.family/*'});
   const chosen=tabs.find(t=>t.active)||tabs[0];
   if(chosen){await chrome.tabs.update(chosen.id,{active:true});await chrome.windows.update(chosen.windowId,{focused:true});try{await chrome.tabs.sendMessage(chosen.id,{type:'show-fomo-widget'});}catch(_){return {ok:true,reloadNeeded:true};}return {ok:true};}
   await chrome.tabs.create({url:'https://fomo.family/r/lqvid'});return {ok:true};
  })().then(reply).catch(e=>reply({ok:false,error:e.message}));return true;
 }
 if(m.type?.startsWith('fomo-')){queuePaper(()=>handlePaper(m,s)).then(reply).catch(e=>reply({ok:false,error:e.message}));return true;}
});
