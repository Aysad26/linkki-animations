import {deliverySteps as steps} from './delivery-steps.js';
import {createNumberOutline} from './icon-number-outlines.js';

const arrow='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7" stroke="currentColor" stroke-width="1.25"/></svg>';
const variants=[
 {kind:'strict',number:'03',id:'icon-slider-realistic',title:'Реальный масштаб',label:'Реалистичные иконки',description:'Сдержанный объём, точные формы и естественные пропорции. Один предметный образ для каждого этапа доставки.'},
 {kind:'soft',number:'04',id:'icon-slider-dark',title:'Маршрут в объёме',label:'3D-иконки и крупные цифры',description:'Мягкие объёмные формы на глубоком синем фоне. За каждым объектом появляется крупный номер этапа.'},
 {kind:'soft',outline:true,number:'05',id:'icon-slider-outline',title:'Маршрут в объёме · контур',label:'3D-иконки и контурные цифры',description:'За объёмной иконкой тонкой белой линией прорисовывается номер этапа. Только контур, без заливки.'}
];
const HOLD=4800;
const clamp=n=>Math.max(0,Math.min(steps.length-1,n));
let serial=0;

export function mountIconSliders(root){
 if(root.dataset.mounted)return;
 root.dataset.mounted='true';
 const selected=root.dataset.iconVariant?variants.filter(v=>v.id===root.dataset.iconVariant):variants;
 root.innerHTML=selected.map(v=>{
  const uid=`icon-route-${++serial}`;
  return `<article class="icon-proposal icon-proposal--${v.kind}${v.outline?' icon-proposal--outline':''}" id="${v.id}" data-kind="${v.kind}" data-number-style="${v.outline?'outline':'solid'}">
   <header class="delivery-proposal-head"><div class="delivery-proposal-name"><span>ВАРИАНТ ${v.number} / ${v.label}</span><h4 id="${uid}-title">${v.title}</h4></div><p>${v.description}</p></header>
   <section class="icon-route" aria-roledescription="карусель" aria-labelledby="${uid}-title" tabindex="0" data-step="1" data-state="idle">
    <div class="icon-route-deck">
     <div class="icon-route-copy"><p class="icon-route-eyebrow">ОТ ДВЕРИ ДО ДВЕРИ</p><p class="icon-route-count"><strong>01</strong><span>/ 10</span></p>
      <div class="icon-route-text"><p class="icon-route-stage">${steps[0].title}</p><h5>${steps[0].headline}</h5><p class="icon-route-description">${steps[0].description}</p></div>
      <div class="icon-route-caption"><i aria-hidden="true"></i> Между странами. Между людьми.</div>
     </div>
     <div class="icon-route-visual" role="img" aria-label="${steps[0].title}"><span class="icon-route-visual-label">LINKKI / ${v.kind==='strict'?'PRECISION':'IN MOTION'}</span><div class="icon-route-frames" aria-hidden="true"></div></div>
    </div>
    <nav class="icon-route-stops" aria-label="Выбрать этап доставки">${steps.map(s=>`<button type="button" data-index="${s.id}" aria-label="Этап ${s.number}: ${s.title}" ${s.id===0?'aria-current="step"':''}><span class="icon-route-dot">${s.number}</span><span class="icon-route-stop-name">${s.short}</span></button>`).join('')}</nav>
    <div class="icon-route-controls"><button type="button" class="icon-route-play" aria-pressed="false"><span class="icon-route-play-symbol" aria-hidden="true"></span><span class="icon-route-play-label">Пауза</span></button><button type="button" class="icon-route-repeat" aria-label="Повторить появление текущей иконки"><span aria-hidden="true">↻</span><span>Повторить</span></button><span class="icon-route-hint">10 этапов · один маршрут</span><div class="icon-route-arrows"><button type="button" class="icon-route-prev" aria-label="Предыдущий этап" disabled>${arrow}</button><button type="button" class="icon-route-next" aria-label="Следующий этап">${arrow}</button></div></div>
    <p class="icon-route-status" role="status" aria-live="polite"></p>
   </section>
  </article>`;
 }).join('');
 root.querySelectorAll('.icon-proposal').forEach(mountRoute);
}

function mountRoute(article){
 const kind=article.dataset.kind,route=article.querySelector('.icon-route'),visual=article.querySelector('.icon-route-visual'),frames=article.querySelector('.icon-route-frames');
 const outline=article.dataset.numberStyle==='outline';
 const text=article.querySelector('.icon-route-text'),count=article.querySelector('.icon-route-count strong'),nav=article.querySelector('.icon-route-stops'),stops=[...nav.querySelectorAll('button')];
 const play=article.querySelector('.icon-route-play'),prev=article.querySelector('.icon-route-prev'),next=article.querySelector('.icon-route-next'),status=article.querySelector('.icon-route-status');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),cache=new Map();
 let index=0,requested=0,sequence=0,frame=null,effects=[],started=false,visible=false,busy=false,auto=!reduced.matches,elapsed=0,last=0,raf=null;
 const imageURL=i=>new URL(`assets/icons/${kind}/${steps[i].number}.webp`,import.meta.url).href;
 function asset(i){
  if(!cache.has(i)){
   const img=new Image();img.decoding='async';
   const promise=new Promise((resolve,reject)=>{img.onload=()=>img.decode().catch(()=>{}).then(()=>resolve(img));img.onerror=()=>{cache.delete(i);reject(new Error('Icon failed to load'))};img.src=imageURL(i)});
   cache.set(i,promise);
  }
  return cache.get(i);
 }
 function stopClock(){if(raf!==null)cancelAnimationFrame(raf);raf=null}
 function controls(){
  play.dataset.playing=String(auto&&index<9);play.setAttribute('aria-pressed',String(!auto));
  play.querySelector('.icon-route-play-label').textContent=index===9?'Сначала':auto?'Пауза':'Продолжить';
  play.setAttribute('aria-label',index===9?'Начать маршрут сначала':auto?'Приостановить смену этапов':'Включить смену этапов');
  prev.disabled=requested===0;next.disabled=requested===9;
 }
 function tick(now){
  raf=null;if(!visible||document.hidden||busy||!auto||index===9)return;
  elapsed+=Math.min(120,Math.max(0,now-last));last=now;
  route.style.setProperty('--icon-dwell',Math.min(1,elapsed/HOLD));
  if(elapsed>=HOLD){go(index+1);return}
  raf=requestAnimationFrame(tick);
 }
 function runClock(){stopClock();if(!visible||document.hidden||busy||!auto||index===9||!started)return;last=performance.now();raf=requestAnimationFrame(tick)}
 function settle(){
  effects.forEach(a=>a.cancel());effects=[];
  [...frames.children].forEach(child=>{if(child!==frame)child.remove()});
  if(frame){frame.querySelectorAll('img,.icon-route-number').forEach(el=>{el.style.opacity='1';el.style.transform='none'})}
 }
 function animate(el,keyframes,options){
  const a=el.animate(keyframes,{fill:'both',...options});effects.push(a);return a.finished.catch(()=>{});
 }
 function update(manual){
  const s=steps[index];route.dataset.step=String(index+1);count.textContent=s.number;
  text.querySelector('.icon-route-stage').textContent=s.title;text.querySelector('h5').textContent=s.headline;text.querySelector('.icon-route-description').textContent=s.description;
  visual.setAttribute('aria-label',`${s.title}. ${s.description}`);
  route.style.setProperty('--icon-step',index/9);route.style.setProperty('--icon-dwell',0);
  stops.forEach((b,i)=>{b.toggleAttribute('data-complete',i<index);if(i===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});
  const b=stops[index];nav.scrollTo({left:Math.max(0,b.offsetLeft-nav.offsetLeft-(nav.clientWidth-b.offsetWidth)/2),behavior:reduced.matches?'instant':'smooth'});
  if(manual)status.textContent=`Этап ${index+1} из 10. ${s.title}`;
  controls();
 }
 async function go(target,manual=false,replay=false){
  target=clamp(target);if(target===index&&requested===index&&started&&!busy&&!replay)return;
  if(manual)auto=false;
  requested=target;const token=++sequence;busy=true;stopClock();settle();controls();route.dataset.state='loading';
  let source;
  try{source=await asset(target)}catch{
   if(token!==sequence)return;
   requested=index;busy=false;auto=false;route.dataset.state='error';status.textContent='Иконка не загрузилась. Нажмите «Повторить».';controls();return;
  }
  if(token!==sequence)return;
  const old=frame;
  frame=document.createElement('div');frame.className='icon-route-frame';frame.dataset.stage=String(target+1);
  if(kind==='soft'){
   if(outline)frame.append(createNumberOutline(steps[target].number));
   else{const n=document.createElement('span');n.className='icon-route-number';n.textContent=steps[target].number;frame.append(n)}
  }
  const img=source.cloneNode();img.alt='';img.className='icon-route-image';img.draggable=false;frame.append(img);frames.append(frame);
  index=target;started=true;elapsed=0;route.dataset.state='transitioning';update(manual);
  const promises=[];
  if(!reduced.matches){
   if(old){
    promises.push(animate(old.querySelector('img'),[{transform:'scale(1)',opacity:1},{transform:'scale(.14)',opacity:0}],{duration:180,easing:'cubic-bezier(.42,0,.85,.4)'}));
    const n=old.querySelector('.icon-route-number');if(n)promises.push(animate(n,[{transform:'scale(1)',opacity:1},{transform:'scale(.88)',opacity:0}],{duration:170,easing:'ease-in'}));
   }
   promises.push(animate(img,[{transform:'scale(.18)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:320,delay:old?120:0,easing:'cubic-bezier(.16,.72,.22,1)'}));
   const n=frame.querySelector('.icon-route-number');
   if(n&&outline){
    // The path itself is traced; completed digits remain unfilled outlines.
    n.querySelectorAll('path').forEach(path=>promises.push(animate(path,[{strokeDasharray:'1',strokeDashoffset:'1'},{strokeDasharray:'1',strokeDashoffset:'0'}],{duration:4000,delay:0,easing:'ease-in-out'})));
   }else if(n)promises.push(animate(n,[{transform:'scale(.78) translateY(12px)',opacity:0},{transform:'scale(1) translateY(0)',opacity:1}],{duration:330,delay:old?85:20,easing:'cubic-bezier(.2,.65,.2,1)'}));
   promises.push(animate(text,[{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,delay:old?120:60,easing:'ease-out'}));
  }
  await Promise.all(promises);
  if(token!==sequence)return;
  settle();busy=false;route.dataset.state='settled';controls();runClock();
  if(index<9)asset(index+1).catch(()=>{});
 }
 stops.forEach((b,i)=>b.addEventListener('click',()=>go(i,true,i===index)));
 prev.addEventListener('click',()=>go(requested-1,true));next.addEventListener('click',()=>go(requested+1,true));
 article.querySelector('.icon-route-repeat').addEventListener('click',()=>go(index,true,true));
 play.addEventListener('click',()=>{
  if(index===9){auto=true;go(0);return}
  auto=!auto;if(auto){if(!started)go(index);else runClock()}else stopClock();controls();
 });
 route.addEventListener('focusin',e=>{if(e.target===play)return;auto=false;stopClock();controls()});
 route.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();go(e.key==='Home'?0:e.key==='End'?9:requested+(e.key==='ArrowRight'?1:-1),true);
 });
 let touch=null;
 visual.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touch=[e.clientX,e.clientY]},{passive:true});
 visual.addEventListener('pointerup',e=>{if(!touch)return;const dx=e.clientX-touch[0],dy=e.clientY-touch[1];touch=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4)go(requested+(dx<0?1:-1),true)},{passive:true});
 visual.addEventListener('pointercancel',()=>touch=null);
 const warm=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){asset(0).catch(()=>{});warm.disconnect()}},{rootMargin:'450px 0px'});warm.observe(visual);
 new IntersectionObserver(([entry])=>{
  visible=entry.isIntersecting&&entry.intersectionRatio>=.2;
  if(visible){if(!started&&!busy)go(0);else runClock()}else stopClock();
 },{threshold:[0,.2,.5]}).observe(visual);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopClock();else runClock()});
 reduced.addEventListener('change',()=>{if(reduced.matches){auto=false;stopClock();if(started)go(index,false,true);controls()}});
 controls();
}

document.querySelectorAll('[data-icon-sliders]').forEach(mountIconSliders);
