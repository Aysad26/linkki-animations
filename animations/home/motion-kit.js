import {GlobeScene} from '../globe.js';
import {SceneTimeline} from '../timeline.js';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const narrow=matchMedia('(max-width: 760px)');
const DURATION=400;
const GLOBE_DURATION=1760;
const ICON_ENTRY_DURATION=820;

export function mountFeatureMotion(root){
// Decode the scene before replacing the accessible fallback image.
const featureAssets=new WeakMap();
const prepareFeature=(figure)=>{
  if(!featureAssets.has(figure)){
    if(!CSS.supports('mask-image','url("")'))return Promise.resolve(false);
    const images=[...figure.querySelectorAll('.feature-still,.feature-layers img')];
    const masks=images.filter(image=>image.dataset.mask).map(image=>{
      const mask=new Image();
      mask.src=image.dataset.mask;
      return mask;
    });
    if(figure.classList.contains('feature-handoff')){
      const settled=new Image();
      settled.src=new URL('assets/feature-delivery-settled.svg',import.meta.url).href;
      masks.push(settled);
    }
    images.forEach(image=>{image.loading='eager'});
    featureAssets.set(figure,Promise.all([...images,...masks].map(image=>image.decode())).then(()=>{
      figure.classList.add('has-layers');
      return true;
    },()=>false));
  }
  return featureAssets.get(figure);
};
const featurePreload=new IntersectionObserver(entries=>{
  for(const {target,isIntersecting} of entries)if(isIntersecting){
    featurePreload.unobserve(target);
    prepareFeature(target);
  }
},{rootMargin:'240px 0px'});
const featureReveal=new IntersectionObserver(entries=>{
  for(const {target,intersectionRatio} of entries){
    const inView=intersectionRatio>=(narrow.matches ? .38 : .24);
    target.classList.toggle('is-in-view',inView);
    if(!inView||target.classList.contains('is-visible'))continue;
    (async()=>{
      const ready=await prepareFeature(target);
      if(!target.classList.contains('is-in-view')||target.classList.contains('is-visible'))return;
      featureReveal.unobserve(target);
      target.classList.add('is-visible');
      if(!ready||reduced.matches)return;
      playFeature(target);
    })();
  }
},{threshold:[.24,.38]});
root.querySelectorAll('[data-feature-motion]').forEach(figure=>{
  featurePreload.observe(figure);
  featureReveal.observe(figure);
});

const watched=new WeakSet();
function playFeature(target){
      const layers=target.querySelector('.feature-actors');
      const cleanup=event=>{
        if(event.target===layers)target.classList.remove('is-playing');
      };
      if(!watched.has(target)){
        watched.add(target);
        layers.addEventListener('animationend',cleanup);
        reduced.addEventListener('change',()=>{if(reduced.matches)target.classList.remove('is-playing')});
      }
      target.classList.add('is-playing');
}
return async function replay(figure){
  if(!await prepareFeature(figure))return;
  featureReveal.unobserve(figure);
  figure.classList.add('is-visible');
  figure.classList.remove('is-playing');
  if(reduced.matches)return;
  // Flush the resting state so the same entrance can restart immediately.
  void figure.offsetWidth;
  playFeature(figure);
};
}

export function mountLineIcons(root){
const ns='http://www.w3.org/2000/svg';
function sEl(name,attrs={}){const el=document.createElementNS(ns,name);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el}

const ROUTES={
 order:['M23 12h18v8H23z','M23 16H15v40h34V16h-8','m24 38 6 6 12-14'],
 pickup:['m13 24 19-10 19 10-19 11-19-11Z','M13 24v23l19 10V35m19-11v16','m24 19 19 11v11','M41 49h17m-6-6 6 6-6 6'],
 warehouse:['M9 28 32 11l23 17v29H9V28Z','M24 57V39h16v18','M18 31h4m8 0h4m8 0h4','M29 48h6'],
 document:['M17 9h22l10 10v21M17 9v47h23','M39 9v12h10','M24 28h17M24 35h13M24 42h9','M50 43a9 9 0 1 1-9 9 9 9 0 0 1 9-9Z','m46 52 3 3 6-7'],
 terminal:['M9 50h46v7H9z','M24 50V27h13v23','M20 20h21l-4 7H24l-4-7Z','M30 12v8','M46 30h11M51 25v11'],
 plane:['m29 8 5-2 4 21 19 10v5l-20-4-1 12 8 6v4l-13-3-12 3v-4l8-6-1-12-20 4v-5l20-10 3-21Z'],
 scan:['M12 24V12h12M40 12h12v12M52 40v12H40M24 52H12V40','M24 23v18m5-18v18m6-18v18m5-18v18','M7 32h50'],
 special:['m10 21 17-9 17 9-17 9-17-9Z','M10 21v21l17 9V30M44 21v8','m18 17 17 9v5','M45 33c4 3 8 4 12 5-1 10-5 17-12 21-7-4-11-11-12-21 4-1 8-2 12-5Z'],
 receive:['m18 21 15-8 15 8-15 8-15-8Z','M18 21v17l15 8 15-8V21M33 29v17','m25 17 16 8v8','M9 47c6-3 9-1 14 2l8 4 13-5c4-1 6 3 3 6L29 61l-20-7']
};
const iconObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.intersectionRatio>=.64){
    entry.target.draw(ICON_ENTRY_DURATION);
    iconObserver.unobserve(entry.target);
  }
},{threshold:.64});

for(const slot of root.querySelectorAll('[data-line-icon]')){
  const svg=sEl('svg',{width:64,height:64,viewBox:'0 0 64 64',fill:'none','aria-hidden':'true'});
  for(const d of ROUTES[slot.dataset.lineIcon])svg.append(sEl('path',{d,stroke:'currentColor','stroke-width':1.55,'stroke-linecap':'round','stroke-linejoin':'round'}));
  slot.append(svg);
  const paths=[...svg.querySelectorAll('path')].map(path=>({path,length:path.getTotalLength()+1}));
  let animations=[];
  slot.draw=(total=DURATION)=>{
    slot.classList.add('is-drawn');
    animations.forEach(animation=>animation.cancel());
    const spread=total*.28;
    animations=reduced.matches?[]:paths.map(({path,length},index)=>path.animate([
      {strokeDasharray:String(length),strokeDashoffset:length},
      {strokeDasharray:String(length),strokeDashoffset:0}
    ],{duration:total-spread,delay:index/Math.max(1,paths.length-1)*spread,easing:'cubic-bezier(.42,0,.2,1)',fill:'both'}));
  };
  const card=slot.closest('.service-card, .demo-icon');
  if(card){
    const replay=()=>{
      if(!slot.classList.contains('is-drawn')){
        iconObserver.unobserve(slot);
        slot.draw(ICON_ENTRY_DURATION);
      }else if(!animations.some(animation=>animation.playState==='running'))slot.draw();
    };
    iconObserver.observe(slot);
    card.addEventListener('pointerenter',replay);
    card.addEventListener('focusin',replay);
  }
}


reduced.addEventListener('change',()=>{if(reduced.matches)root.querySelectorAll('[data-line-icon]').forEach(slot=>slot.draw?.())});
}

export function mountRoute(route){
const deck=route.querySelector('.route-slides');
const slides=[...route.querySelectorAll('.route-slide')];
const stops=[...route.querySelectorAll('.route-stop')];
const previous=route.querySelector('.route-previous');
const next=route.querySelector('.route-next');
const play=route.querySelector('.route-play');
const playText=route.querySelector('[data-play-text]');
const status=route.querySelector('[data-route-status]');
let stage=0,playing=!reduced.matches,routeVisible=false,hovered=false,routeFocus=false,timer,transition;

function updateControls(){
  previous.setAttribute('aria-disabled',String(stage===0));
  next.setAttribute('aria-disabled',String(stage===slides.length-1));
  play.dataset.playing=String(playing);
  playText.textContent=playing?'Пауза':stage===slides.length-1?'Сначала':'Воспроизвести';
  play.setAttribute('aria-label',playing?'Приостановить маршрут':stage===slides.length-1?'Воспроизвести маршрут сначала':'Воспроизвести маршрут');
}
function schedule(){
  clearTimeout(timer);
  if(playing&&routeVisible&&!hovered&&!routeFocus&&!document.hidden&&stage<slides.length-1)
    timer=setTimeout(()=>showStage(stage+1),3300);
}
function showStage(index,{manual=false,animate=true}={}){
  if(index<0||index>=slides.length)return;
  const direction=Math.sign(index-stage);
  if(manual)playing=false;
  stage=index;
  if(stage===slides.length-1)playing=false;
  route.style.setProperty('--route-progress',String(stage/(slides.length-1)));
  slides.forEach((slide,i)=>{
    slide.classList.toggle('is-active',i===stage);
    slide.inert=i!==stage;
    if(i===stage)slide.removeAttribute('aria-hidden');
    else slide.setAttribute('aria-hidden','true');
  });
  stops.forEach((stop,i)=>{
    stop.classList.toggle('is-complete',i<stage);
    if(i===stage)stop.setAttribute('aria-current','step');
    else stop.removeAttribute('aria-current');
  });
  transition?.cancel();
  if(animate&&direction&&!reduced.matches){
    transition=slides[stage].animate([{opacity:.35,transform:`translateX(${direction*22}px)`},{opacity:1,transform:'translateX(0)'}],
      {duration:DURATION,easing:'cubic-bezier(.22,1,.36,1)'});
    slides[stage].querySelector('[data-line-icon]').draw();
  }
  if(manual)status.textContent=stops[stage].getAttribute('aria-label');
  updateControls();
  schedule();
}

showStage(0,{animate:false});
route.classList.add('is-ready');
const routeObserver=new IntersectionObserver(([entry])=>{
  const wasVisible=routeVisible;
  routeVisible=entry.isIntersecting;
  if(routeVisible&&!wasVisible)slides[stage].querySelector('[data-line-icon]').draw();
  schedule();
},{rootMargin:'0px 0px -80px 0px',threshold:.2});
routeObserver.observe(deck);
stops.forEach((stop,i)=>stop.addEventListener('click',()=>showStage(i,{manual:true})));
previous.addEventListener('click',()=>showStage(stage-1,{manual:true}));
next.addEventListener('click',()=>showStage(stage+1,{manual:true}));
play.addEventListener('click',()=>{
  playing=!playing;
  if(playing&&stage===slides.length-1)showStage(0);
  updateControls();schedule();
});
route.addEventListener('keydown',event=>{
  const target={ArrowLeft:stage-1,ArrowRight:stage+1,Home:0,End:slides.length-1}[event.key];
  if(target!==undefined&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){
    event.preventDefault();showStage(target,{manual:true});
    if(event.target.classList.contains('route-stop'))stops[stage].focus();
  }
});
deck.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovered=true;schedule()}});
deck.addEventListener('pointerleave',()=>{hovered=false;schedule()});
route.addEventListener('focusin',event=>{routeFocus=!play.contains(event.target);schedule()});
route.addEventListener('focusout',event=>{if(!route.contains(event.relatedTarget)){routeFocus=false;schedule()}});
let swipe;
deck.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')swipe={id:event.pointerId,x:event.clientX,y:event.clientY}});
deck.addEventListener('pointerup',event=>{
  if(swipe?.id!==event.pointerId)return;
  const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;swipe=undefined;
  if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.35)showStage(stage-Math.sign(dx),{manual:true});
});
deck.addEventListener('pointercancel',()=>{swipe=undefined});
document.addEventListener('visibilitychange',schedule);
reduced.addEventListener('change',()=>{if(reduced.matches){playing=false;transition?.cancel();updateControls();schedule()}});


return { restart(){ playing=!reduced.matches; showStage(0); } };
}

export function mountHomeGlobe(globeElement){
const globe=new GlobeScene(globeElement,{
  dimensional:true,
  showGrid:globeElement.dataset.globeGrid!=='false',
  showHubLabel:globeElement.dataset.globeHubLabel!=='false'
});
let armed=true,globeRatio=0;
const timeline=new SceneTimeline({duration:GLOBE_DURATION,render:p=>{globe.render(p);globeElement.dataset.progress=p.toFixed(3)},onState:s=>globeElement.dataset.motionState=s});
async function playGlobe(){
  try{await globe.ready}catch{return}
  if(reduced.matches){timeline.finish();return}
  if(armed&&globeRatio>=.25&&!document.hidden&&timeline.play())armed=false;
}
const globeObserver=new IntersectionObserver(entries=>{for(const e of entries){globeRatio=e.intersectionRatio;if(!e.isIntersecting)armed=true;else if(globeRatio>=.25)playGlobe()}},{threshold:[0,.25]});globeObserver.observe(globeElement);
globe.ready.catch(()=>{globeElement.dataset.globeError='unavailable'});
document.addEventListener('visibilitychange',()=>{if(document.hidden)timeline.pause();else if(timeline.state==='paused')timeline.resume();else playGlobe()});
reduced.addEventListener('change',()=>{if(reduced.matches)timeline.finish();else{armed=true;playGlobe()}});


return async function replay(){
  try{await globe.ready}catch{return}
  if(reduced.matches){timeline.finish();return;}
  timeline.reset(); timeline.play(); armed=false;
};
}
