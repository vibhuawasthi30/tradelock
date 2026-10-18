// Pure accounting helpers; all orders are simulations.
(function(root){
 function marketCapValue(text){
  if(typeof text!=='string')return NaN;
  const m=text.trim().replace(/[$,\s]/g,'').match(/^(\d+(?:\.\d+)?)([KMBT])?$/i);
  if(!m)return NaN;const n=Number(m[1])*({K:1e3,M:1e6,B:1e9,T:1e12}[m[2]?.toUpperCase()]||1);return Number.isFinite(n)&&n>0?n:NaN;
 }
 function observe(p,q,now=Date.now()){
  if(p?.performance&&!p.performance.image&&q.image)p.performance.image=q.image;
  if(!p?.performance||!Number.isFinite(q.marketCap)||q.marketCap<=0)return;
  const series=p.performance.series,last=series.at(-1);
  if(!last||now-last.t>=15000){series.push({t:now,cap:q.marketCap});if(series.length>300)p.performance.series=[series[0],...series.slice(1).filter((_,i)=>i%2===0),series.at(-1)];}
 }
 function completed(a){
  const cards=[...(a.completedPositions||[])],open={};
  for(const t of a.trades||[]){if(t.positionId)continue;
   if(t.side==='buy'){const p=open[t.key]||{id:'past:'+t.key+':'+t.t,key:t.key,name:t.name,image:t.image,openedAt:t.t,invested:0,received:0,qty:0,boughtQty:0,series:[],executions:[],entryMarketCap:t.marketCap,source:'execution points'};p.qty+=t.qty;p.boughtQty+=t.qty;p.invested+=t.usd;p.executions.push(t);if(Number.isFinite(t.marketCap))p.series.push({t:t.t,cap:t.marketCap});open[t.key]=p;}
   else if(open[t.key]){const p=open[t.key];if(t.qty>p.qty+Math.max(1e-12,p.qty*1e-8)){delete open[t.key];continue;}p.qty-=t.qty;p.received+=t.usd;p.executions.push(t);if(Number.isFinite(t.marketCap))p.series.push({t:t.t,cap:t.marketCap});if(p.qty<=Math.max(1e-12,p.boughtQty*1e-10)){p.closedAt=t.t;p.exitMarketCap=t.marketCap;p.pnl=p.received-p.invested;p.pnlPct=p.pnl/p.invested*100;delete p.qty;cards.push(p);delete open[t.key];}}
  }
  return cards.sort((a,b)=>b.closedAt-a.closedAt).slice(0,100);
 }
 const initial=()=>({cash:100,realizedPnl:0,positions:{},marks:{},history:[{t:Date.now(),v:100}],trades:[]});
 function validateQuote(q,now=Date.now()){
  if(!q||typeof q.key!=='string'||!Number.isFinite(q.price)||q.price<=0||!Number.isFinite(q.observedAt)||now-q.observedAt>15000||q.observedAt>now+1000)throw Error('Waiting for a fresh price from the current FOMO token page.');
 }
 function value(a){return a.cash+Object.entries(a.positions).reduce((sum,[key,p])=>sum+p.qty*(a.marks[key]?.price||p.cost/p.qty),0);}
 function trade(a,q,side,amount,slippage=4,now=Date.now()){
  validateQuote(q,now);
  if(!['buy','sell'].includes(side)||!Number.isFinite(amount)||amount<=0)throw Error('Enter a positive amount.');
  if(!Number.isFinite(slippage)||slippage<0||slippage>25)throw Error('Simulated slippage must be between 0% and 25%.');
  const next=structuredClone(a),p=next.positions[q.key]||{qty:0,cost:0,name:q.name};let qty,proceeds;
  if(side==='buy'){
   if(amount>next.cash+1e-9)throw Error('Not enough paper cash.');
   if(!p.performance){next.performanceSequence=(next.performanceSequence||0)+1;p.performance={id:'paper:'+now+':'+next.performanceSequence,key:q.key,name:q.name,image:q.image,openedAt:now,invested:0,received:0,entryMarketCap:q.marketCap,series:[],executions:[],source:'recorded market cap'};}
   p.performance.invested+=amount;
   qty=amount/(q.price*(1+slippage/100));next.cash=Math.max(0,next.cash-amount);p.qty+=qty;p.cost+=amount;
  }else{
   qty=amount/q.price;if(qty>p.qty+Math.max(1e-12,p.qty*1e-10))throw Error('Not enough paper tokens to sell.');
   qty=Math.min(qty,p.qty);proceeds=qty*q.price*(1-slippage/100);const soldCost=p.cost*qty/p.qty;next.realizedPnl=(next.realizedPnl||0)+proceeds-soldCost;p.cost-=soldCost;p.qty-=qty;next.cash+=proceeds;
  }
  observe(p,q,now);
  if(p.qty<=1e-12)delete next.positions[q.key];else next.positions[q.key]=p;
  next.marks[q.key]={price:q.price,t:now};next.history.push({t:now,v:value(next)});next.history=next.history.slice(-2000);
  next.trades.push({t:now,key:q.key,name:q.name,image:q.image,side,qty,usd:side==='buy'?amount:proceeds,price:side==='buy'?q.price*(1+slippage/100):q.price*(1-slippage/100),marketCap:q.marketCap,positionId:p.performance?.id});
  if(p.performance){const perf=p.performance,receipt=next.trades.at(-1);perf.executions.push(receipt);if(side==='sell')perf.received+=proceeds;if(p.qty<=1e-12){const result={...perf,closedAt:now,exitMarketCap:q.marketCap,pnl:perf.received-perf.invested,pnlPct:(perf.received-perf.invested)/perf.invested*100};if(Number.isFinite(q.marketCap))result.series.push({t:now,cap:q.marketCap});next.completedPositions=[...(next.completedPositions||[]),result].slice(-100);}}next.trades=next.trades.slice(-500);
  return next;
 }
 function statistics(a){
  const cards=completed(a),wins=cards.filter(t=>t.pnl>1e-9),losses=cards.filter(t=>t.pnl< -1e-9);
  const equity=value(a),realized=a.realizedPnl||0,values=(a.history||[]).map(p=>p.v).filter(Number.isFinite).concat([equity]);
  let peak=values.length?values[0]:100,drawdown=0,drawdownPct=0;
  for(const v of values){peak=Math.max(peak,v);drawdown=Math.max(drawdown,peak-v);if(peak>0)drawdownPct=Math.max(drawdownPct,(peak-v)/peak*100);}
  return {equity,totalPnl:equity-100,realized,unrealized:equity-100-realized,count:cards.length,wins:wins.length,losses:losses.length,winRate:cards.length?wins.length/cards.length*100:null,averageWin:wins.length?wins.reduce((sum,t)=>sum+t.pnl,0)/wins.length:null,averageLoss:losses.length?losses.reduce((sum,t)=>sum+t.pnl,0)/losses.length:null,drawdown,drawdownPct};
 }
 root.TradeLockPaper={initial,value,trade,validateQuote,marketCapValue,observe,completed,statistics};
})(globalThis);
