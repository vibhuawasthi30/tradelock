// Local paper-performance exports. Charts use recorded market caps only.
(function(root){
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
 const cap=n=>Number.isFinite(n)?'$'+n.toLocaleString('en-US',{notation:'compact',minimumFractionDigits:1,maximumFractionDigits:1}):'Unavailable';
 function rounded(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
 function text(c,value,x,y,size=30,color='#10140e',weight='400'){c.font=weight+' '+size+'px Arial';c.fillStyle=color;c.fillText(value,x,y);}
 function fit(c,value,width,size,weight='700'){c.font=weight+' '+size+'px Arial';while(c.measureText(value).width>width&&size>20){size-=2;c.font=weight+' '+size+'px Arial';}return size;}
 function loadImage(url){return new Promise(resolve=>{if(!url)return resolve(null);const img=new Image();img.crossOrigin='anonymous';let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};const timer=setTimeout(()=>finish(null),3000);img.onload=()=>finish(img.naturalWidth&&img.naturalHeight?img:null);img.onerror=()=>finish(null);img.src=url;});}
 function imageURL(value){try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch(_){return null;}}
 function brand(c,x,y,size){text(c,'Trade',x,y,size,'#0d120c','700');const offset=c.measureText('Trade').width;text(c,'Lock',x+offset,y,size,'#41582c','700');}
 async function drawCard(card,options={}){
  const dollars=n=>options.hideAmounts?'$•••':money(n),market=n=>options.hideAmounts?'$•••':cap(n);
  if(!card||!Number.isFinite(card.invested)||card.invested<=0||!Number.isFinite(card.received)||!Number.isFinite(card.closedAt))throw Error('This trade does not have enough recorded data.');
  const pnl=card.received-card.invested,pct=pnl/card.invested*100,up=pnl>=0,color=up?'#3e682b':'#b04f43';
  const [helmet,tokenImage]=await Promise.all([loadImage(chrome.runtime.getURL('assets/icons/tradelock-128.png')),loadImage(imageURL(card.image))]);
  const canvas=document.createElement('canvas');canvas.width=1160;canvas.height=1360;const c=canvas.getContext('2d');
  const dark=c.createLinearGradient(0,0,1160,1360);dark.addColorStop(0,'#2c3025');dark.addColorStop(1,'#191e18');c.fillStyle=dark;c.fillRect(0,0,1160,1360);
  rounded(c,25,23,1110,1313,44);const cream=c.createLinearGradient(0,0,1160,1360);cream.addColorStop(0,'#fcfbf7');cream.addColorStop(.5,'#f5f5ed');cream.addColorStop(1,'#fafaf4');c.fillStyle=cream;c.fill();
  if(helmet)c.drawImage(helmet,75,63,146,132);brand(c,helmet?231:80,142,58);
  const date=new Date(card.closedAt).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});c.font='26px Arial';text(c,date,1094-c.measureText(date).width,99,26,'#575b50');
  const gx=55,gy=196,gw=1050,gh=330;rounded(c,gx,gy,gw,gh,28);c.fillStyle='#f5f5ee';c.fill();c.strokeStyle='#dddfd4';c.lineWidth=1.7;c.stroke();
  const points=[...(card.series||[]),...(card.executions||[]).filter(t=>Number.isFinite(t.marketCap)).map(t=>({t:t.t,cap:t.marketCap}))].filter(p=>Number.isFinite(p.cap)&&p.cap>0&&Number.isFinite(p.t)).sort((a,b)=>a.t-b.t);
  if(points.length>=2){
   const t0=points[0].t,t1=points.at(-1).t,lo=Math.min(...points.map(p=>p.cap)),hi=Math.max(...points.map(p=>p.cap)),pad=Math.max((hi-lo)*.08,hi*.002),min=lo-pad,max=hi+pad;
   const xx=t=>gx+38+(t-t0)/Math.max(1,t1-t0)*(gw-76),yy=n=>gy+gh-42-(n-min)/(max-min)*(gh-80);
   c.beginPath();points.forEach((p,i)=>i?c.lineTo(xx(p.t),yy(p.cap)):c.moveTo(xx(p.t),yy(p.cap)));c.lineTo(xx(t1),gy+gh-10);c.lineTo(xx(t0),gy+gh-10);c.closePath();const fill=c.createLinearGradient(0,gy,0,gy+gh);fill.addColorStop(0,up?'#819d6475':'#cf8e7e65');fill.addColorStop(1,'#f5f5ee00');c.fillStyle=fill;c.fill();
   c.beginPath();points.forEach((p,i)=>i?c.lineTo(xx(p.t),yy(p.cap)):c.moveTo(xx(p.t),yy(p.cap)));c.strokeStyle=up?'#425f2f':color;c.lineWidth=6;c.lineJoin='round';c.lineCap='round';c.stroke();
   const end=points.at(-1),ex=xx(end.t),ey=yy(end.cap);c.fillStyle=up?'#72995330':'#bd645430';c.beginPath();c.arc(ex,ey,26,0,Math.PI*2);c.fill();c.fillStyle=color;c.beginPath();c.arc(ex,ey,12,0,Math.PI*2);c.fill();c.strokeStyle='#fffef9';c.lineWidth=3;c.stroke();
   const executions=(card.executions||[]).filter(t=>Number.isFinite(t.marketCap)&&t.marketCap>0&&Number.isFinite(t.t));
   executions.forEach((t,i)=>{const x=xx(t.t),y=yy(t.marketCap),buy=t.side==='buy';c.fillStyle=buy?'#52823a':'#ba5547';c.beginPath();c.moveTo(x,y+(buy?-14:14));c.lineTo(x-9,y+(buy?4:-4));c.lineTo(x+9,y+(buy?4:-4));c.closePath();c.fill();if(i===0||i===executions.length-1){const labelY=buy?Math.min(gy+gh-17,y+32):Math.max(gy+23,y-24);text(c,buy?'BUY':'SELL',Math.max(gx+27,Math.min(gx+gw-73,x-21)),labelY,16,buy?'#52823a':'#ba5547','700');}});
   if(card.source==='execution points')text(c,'Recorded entry / exit points',gx+35,gy+27,15,'#8a8e80');
  }else text(c,'No recorded market-cap chart for this past trade.',gx+120,gy+180,25,'#879078');
  let nameX=80;
  if(tokenImage){c.save();c.beginPath();c.arc(137,610,60,0,Math.PI*2);c.clip();const crop=Math.min(tokenImage.naturalWidth,tokenImage.naturalHeight);c.drawImage(tokenImage,(tokenImage.naturalWidth-crop)/2,(tokenImage.naturalHeight-crop)/2,crop,crop,77,550,120,120);c.restore();nameX=232;}
  const name=String(card.name||'Token').slice(0,40);text(c,name,nameX,607,fit(c,name,1090-nameX,52),'#10150e','700');
  const address=card.key?.split(':').slice(1).join(':')||'',rawChain=card.key?.split(':')[0]||'',chain=({solana:'SOL',ethereum:'ETH',base:'BASE',bitcoin:'BTC'})[rawChain]||rawChain.toUpperCase()||'TOKEN';
  const identity=chain+'  ·  '+(address?address.slice(0,6)+'…'+address.slice(-6):'Contract unavailable');text(c,identity,nameX+5,650,fit(c,identity,1090-nameX,29,'400'),'#777c70');
  const percentage=(pct>=0?'+':'−')+Math.abs(pct).toFixed(2)+'%';c.fillStyle=up?'#638a43':'#b04f43';c.beginPath();if(up){c.moveTo(116,742);c.lineTo(87,793);c.lineTo(146,793);}else{c.moveTo(116,793);c.lineTo(87,742);c.lineTo(146,742);}c.closePath();c.fill();text(c,percentage,169,815,fit(c,percentage,920,146),color,'700');
  rounded(c,67,860,1027,298,29);c.fillStyle='#f1f2e9';c.fill();c.strokeStyle='#daddd0';c.lineWidth=1.7;c.stroke();
  text(c,'Avg. Entry MC',115,910,28,'#74796d');text(c,'Exit MC',638,910,28,'#74796d');text(c,market(card.entryMarketCap),115,969,fit(c,market(card.entryMarketCap),425,44),'#0e150d','700');text(c,market(card.exitMarketCap),638,969,fit(c,market(card.exitMarketCap),400,44),'#0e150d','700');
  c.strokeStyle='#d9ddd0';c.beginPath();c.moveTo(582,884);c.lineTo(582,975);c.moveTo(96,1003);c.lineTo(1063,1003);c.moveTo(405,1035);c.lineTo(405,1127);c.moveTo(789,1035);c.lineTo(789,1127);c.stroke();
  text(c,'Invested',105,1059,28,'#74796d');text(c,'Received',481,1059,28,'#74796d');text(c,'P&L',850,1059,28,'#74796d');
  text(c,dollars(card.invested),105,1116,fit(c,dollars(card.invested),270,44),'#0e150d','700');text(c,dollars(card.received),481,1116,fit(c,dollars(card.received),278,44),'#0e150d','700');const result=options.hideAmounts?'$•••':(pnl>=0?'+':'−')+money(Math.abs(pnl));text(c,result,850,1116,fit(c,result,217,44),color,'700');
  // Quiet topographic contours echo the supplied footer artwork.
  c.save();rounded(c,25,23,1110,1313,44);c.clip();c.strokeStyle='#cdd2c250';c.lineWidth=1.4;
  for(let i=0;i<7;i++){const y=1205+i*20;c.beginPath();c.moveTo(560+i*7,1370);c.bezierCurveTo(605,1245+i*16,710,1285+i*10,785,y+22);c.bezierCurveTo(859,y-45,898,y+25,954,y-10);c.bezierCurveTo(1030,y-78,1061,y+17,1165,y-43);c.stroke();}c.restore();
  brand(c,81,1257,44);text(c,'STAY DISCIPLINED',89,1287,18,'#828879');text(c,'PAPER TRADING · SIMULATED FUNDS',636,1262,17,'#838b78','700');text(c,'Net of simulated slippage',636,1289,16,'#909786');
  return canvas;
 }
 async function downloadCanvas(canvas,card){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG export unavailable');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='TradeLock-'+String(card.name||'Token').replace(/[^a-z0-9_-]/gi,'-').slice(0,40)+'-'+new Date(card.closedAt).toISOString().slice(0,10)+'.png';a.style.display='none';document.documentElement.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 async function download(card,options={}){return downloadCanvas(await drawCard(card,options),card);}
 root.TradeLockShare={drawCard,download,downloadCanvas};
})(globalThis);
