// Shared local appearance preference for popup, widget and lock screen.
(function(root){
 function mount(target,button,onApply=()=>{}){
  let current='light',saving=false;
  function apply(value){current=value==='dark'?'dark':'light';target.dataset.theme=current;target.style.colorScheme=current;if(button){button.textContent=current==='dark'?'☀':'☾';button.setAttribute('aria-label',current==='dark'?'Switch to light mode':'Switch to dark mode');button.title=current==='dark'?'Switch to light mode':'Switch to dark mode';}onApply(current);}
  apply('light');chrome.storage.local.get(['theme']).then(s=>apply(s.theme));
  chrome.storage.onChanged.addListener((c,area)=>{if(area==='local'&&c.theme)apply(c.theme.newValue);});
  if(button)button.onclick=async()=>{if(saving)return;saving=true;button.disabled=true;const next=current==='dark'?'light':'dark';try{await chrome.storage.local.set({theme:next});apply(next);}finally{saving=false;button.disabled=false;}};
  return {get current(){return current;}};
 }
 root.TradeLockTheme={mount};
})(globalThis);
