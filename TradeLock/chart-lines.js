// Uses TradingView's public drawing API. Never submits FOMO orders.
(()=>{
 const widgets=new Set(),wrapped=new WeakSet(),entries=new Map();let request=null,running=false,rerun=false;
 function readBar(record,bar){if(Number.isFinite(bar?.close)&&bar.close>0)record.close=bar.close;}
 function captureOptions(options,record){
  if(!options?.datafeed)return options;
  const feed=options.datafeed;
  const proxy=new Proxy(feed,{get(target,key){const fn=Reflect.get(target,key);if(typeof fn!=='function')return fn;
   if(key==='subscribeBars')return function(symbol,resolution,onRealtime,...rest){return fn.call(target,symbol,resolution,bar=>{readBar(record,bar);onRealtime(bar);sync();},...rest);};
   if(key==='getBars')return function(symbol,resolution,period,onHistory,...rest){return fn.call(target,symbol,resolution,period,(bars,meta)=>{if(bars?.length)readBar(record,bars.at(-1));onHistory(bars,meta);sync();},...rest);};
   return fn.bind(target);
  }});return {...options,datafeed:proxy};
 }
 function wrapConstructor(ctor){if(typeof ctor!=='function'||wrapped.has(ctor))return ctor;
  const proxy=new Proxy(ctor,{construct(target,args,newTarget){const record={close:null};const adjusted=[captureOptions(args[0],record),...args.slice(1)];const widget=Reflect.construct(target,adjusted,newTarget);record.widget=widget;widgets.add(record);widget.onChartReady?.(()=>{record.ready=true;sync();});return widget;}});wrapped.add(proxy);return proxy;
 }
 function wrapNamespace(namespace){if(!namespace||!['object','function'].includes(typeof namespace))return namespace;try{const desc=Object.getOwnPropertyDescriptor(namespace,'widget');if(desc?.configurable===false)return namespace;let ctor=wrapConstructor(namespace.widget);Object.defineProperty(namespace,'widget',{configurable:true,enumerable:true,get:()=>ctor,set:value=>{ctor=wrapConstructor(value);}});}catch(_){}return namespace;}
 try{const desc=Object.getOwnPropertyDescriptor(window,'TradingView');if(!desc||desc.configurable){let namespace=wrapNamespace(window.TradingView);Object.defineProperty(window,'TradingView',{configurable:true,enumerable:true,get:()=>namespace,set:value=>{namespace=wrapNamespace(value);}});}}catch(_){}
 function status(ready){window.postMessage({type:'tradelock-lines-status',ready},location.origin);}
 function valid(t){return t&&['buy','sell'].includes(t.side)&&Number.isFinite(t.t)&&Number.isFinite(t.price)&&t.price>0&&Number.isFinite(t.marketCap)&&t.marketCap>0;}
 async function sync(){if(running){rerun=true;return;}running=true;try{
  if(!request)return;let available=false;
  for(const record of widgets){try{if(!record.ready)continue;let chart;try{chart=record.widget.activeChart?.();}catch(_){widgets.delete(record);entries.delete(record);continue;}if(!chart?.createShape||!Number.isFinite(record.close)||!request.quote)continue;
   const quote=request.quote;if(quote.key!==request.key)continue;const cap=Number(String(quote.marketCap||'').replace(/[$,\s]/g,'').replace(/([KMBT])$/i,(_,s)=>'e'+({K:3,M:6,B:9,T:12}[s.toUpperCase()]))),price=quote.price;
   if(!(cap>0&&price>0))continue;
   const symbol=chart.symbol?.()||'';if(quote.address&&!symbol.toLowerCase().includes(quote.address.toLowerCase()))continue;
   const capDiff=Math.abs(Math.log(record.close/cap)),priceDiff=Math.abs(Math.log(record.close/price));if(Math.min(capDiff,priceDiff)>.7)continue;
   const mode=capDiff<priceDiff?'marketCap':'price',context=request.key+'|'+symbol+'|'+mode;
   let owned=entries.get(record);if(!owned||owned.context!==context){if(owned)for(const id of owned.lines.values())try{chart.removeEntity(id);}catch(_){}owned={context,lines:new Map(),missing:new Map()};entries.set(record,owned);}
   const present=new Set((chart.getAllShapes?.()||[]).map(x=>x.id));if(chart.getAllShapes)for(const [key,id] of owned.lines){if(present.has(id))owned.missing.delete(key);else{const since=owned.missing.get(key)||Date.now();owned.missing.set(key,since);if(Date.now()-since>5000){owned.lines.delete(key);owned.missing.delete(key);}}}
   available=true;const wanted=new Set(request.trades.filter(valid).map(t=>t.t+'|'+t.side+'|'+t.qty));
   for(const [key,id] of owned.lines)if(!wanted.has(key)){try{chart.removeEntity(id);}catch(_){}owned.lines.delete(key);owned.missing.delete(key);}
   for(const t of request.trades.filter(valid)){
    const key=t.t+'|'+t.side+'|'+t.qty;if(owned.lines.has(key))continue;
    const color=t.side==='buy'?'#49c87b':'#ff6969',level=t[mode];
    const id=await chart.createShape({time:Math.floor(t.t/1000),price:level},{shape:'horizontal_line',text:'PAPER '+t.side.toUpperCase()+' · '+new Date(t.t).toLocaleTimeString(),lock:true,disableSelection:true,disableSave:true,disableUndo:true,overrides:{linecolor:color,linewidth:2,showLabel:true,textcolor:color}});
    if(id)owned.lines.set(key,id);
   }
  }catch(_){} }
  status(available);
 }catch(_){status(false);}finally{running=false;if(rerun){rerun=false;sync();}}}
 window.addEventListener('message',event=>{if(event.source!==window||event.data?.type!=='tradelock-paper-lines')return;const data=event.data;if(typeof data.key!=='string'||!Array.isArray(data.trades))return;request={key:data.key,trades:data.trades.slice(-20),quote:data.quote};sync();});
})();
