const IDS = ['bitcoin','ethereum','solana'];
let pending;
async function refresh() {
  if (pending) return pending;
  pending = (async () => {
    const s = await chrome.storage.local.get(['enabled','quotes','fetchedAt','lastAttempt']);
    if (s.enabled === false) return {ok:false,error:'Tracking paused'};
    if (Date.now() - (s.lastAttempt || 0) < 60000) return {ok:!!s.quotes,error:s.quotes ? '' : 'Please wait a minute before retrying.'};
    await chrome.storage.local.set({lastAttempt:Date.now()});
    try {
      async function get(path) {
        const r = await fetch('https://api.exchange.coinbase.com/products/' + path, {signal:AbortSignal.timeout(15000)});
        if (!r.ok) throw new Error(r.status === 429 ? 'Price service rate limit. Retrying automatically.' : `Coinbase price service unavailable (${r.status}).`);
        return r.json();
      }
      const quotes = {};
      const products = {bitcoin:'BTC-USD',ethereum:'ETH-USD',solana:'SOL-USD'};
      const end = new Date(), start = new Date(end.getTime()-7*86400000);
      for (const id of IDS) {
        const product = products[id];
        const [ticker,stats] = await Promise.all([get(product+'/ticker'),get(product+'/stats')]);
        const price = Number(ticker.price), open = Number(stats.open);
        if (!Number.isFinite(price) || price<=0 || !Number.isFinite(Date.parse(ticker.time))) throw new Error('Incomplete market data received.');
        // Chart failure must not prevent fresh prices from appearing.
        let history = [];
        try {
          const candles = await get(product+'/candles?granularity=3600&start='+encodeURIComponent(start.toISOString())+'&end='+encodeURIComponent(end.toISOString()));
          if (Array.isArray(candles)) history = candles.filter(c=>Array.isArray(c)&&c[0]>=start.getTime()/1000&&c[0]<=end.getTime()/1000&&Number.isFinite(c[4])).sort((a,b)=>a[0]-b[0]).map(c=>c[4]);
        } catch (_) { /* Price remains usable even without a chart. */ }
        quotes[id]={price,change:Number.isFinite(open)&&open>0?(price/open-1)*100:null,history,time:ticker.time};
      }
      await chrome.storage.local.set({quotes,fetchedAt:Date.now(),error:''});
      return {ok:true};
    } catch(e) {await chrome.storage.local.set({error:e.message});return {ok:false,error:e.message};}
  })();
  try {return await pending;} finally {pending=null;}
}
async function setup(){
  const s=await chrome.storage.local.get(['enabled','account','fomoUrl']);
  const defaults={};
  if(s.enabled===undefined) defaults.enabled=true;
  if(!s.account) defaults.account={cash:100,holdings:{},history:[{t:Date.now(),v:100}]};
  if(!s.fomoUrl) defaults.fomoUrl='https://fomo.family/r/lqvid';
  await chrome.storage.local.set(defaults);
  await chrome.alarms.create('prices',{periodInMinutes:2});
  await refresh();
}
chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='prices')refresh();});
chrome.runtime.onMessage.addListener((m,s,reply)=>{if(m.type==='refresh'){refresh().then(reply).catch(e=>reply({ok:false,error:e.message}));return true;}});

// FOMO token widget and serialized paper-account actions.
importScripts('fomo-worker.js');
