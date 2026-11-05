import {ProcessRenderer} from './process-renderer.js';
import {PROCESS_DURATION,PROCESS_DWELL} from './process-models.js';
import {deliverySteps as steps,nextStep} from './delivery-steps.js';
const arrow='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7" stroke="currentColor" stroke-width="1.25"/></svg>';
const definitions=[
 ['line','01','Контур маршрута','Линейная геометрия','Склад, документы и транспорт собираются из точных линий. Детали прорисовываются по очереди, соединяя всю цепочку доставки.'],
 ['solid','02','Предметный маршрут','Объёмные миниатюры','Коробка переходит из одной сцены в другую. Объекты мягко поворачиваются, собираются из частей и показывают действие каждого этапа.']
];
let serial=0;
export function mountDeliverySliders(root){
 if(root.dataset.mounted)return;root.dataset.mounted='true';
 const selected=root.dataset.deliveryVariant?definitions.filter(([kind])=>kind===root.dataset.deliveryVariant):definitions;
 root.innerHTML=selected.map(([kind,n,title,subtitle,description])=>{
  const uid='delivery-'+(++serial);
  return `<article class="delivery-proposal delivery-${kind}" data-kind="${kind}" id="concept-${kind}" aria-labelledby="${uid}-title">
   <header class="delivery-proposal-head"><div class="delivery-proposal-name"><span>ВАРИАНТ ${n} / ${subtitle}</span><h4 id="${uid}-title">${title}</h4></div><p>${description}</p></header>
   <section class="delivery-slider" aria-roledescription="карусель" aria-label="${title}: десять этапов доставки" tabindex="0" data-step="1">
    <div class="delivery-deck">
     <div class="delivery-copy"><p class="delivery-category">ОТ ДВЕРИ ДО ДВЕРИ</p><div class="delivery-count" aria-hidden="true"><strong>01</strong><span>/ 10</span></div>
      <div class="delivery-copy-body"><p class="delivery-step-title">${steps[0].title}</p><h5>${steps[0].headline}</h5><p class="delivery-description">${steps[0].description}</p></div>
      <div class="delivery-completion"><span></span>Между странами. Между людьми.</div>
     </div>
     <div class="delivery-visual" role="img" aria-label="${steps[0].title}"><canvas width="900" height="675" aria-hidden="true"></canvas><span class="delivery-visual-caption">${subtitle}</span></div>
    </div>
    <nav class="delivery-stops" aria-label="Этапы доставки">${steps.map(s=>`<button type="button" class="delivery-stop" data-step="${s.id}" aria-label="Этап ${s.number}: ${s.title}" ${s.id===0?'aria-current="step"':''}><span class="delivery-stop-dot">${s.number}</span><span class="delivery-stop-text">${s.short}</span></button>`).join('')}</nav>
    <div class="delivery-controls"><button type="button" class="delivery-play" aria-pressed="false"><span class="delivery-play-mark" aria-hidden="true"></span><span class="delivery-play-label">Пауза</span></button><button type="button" class="delivery-replay" aria-label="Повторить текущий этап"><span aria-hidden="true">↻</span> <span>Повторить этап</span></button><span class="delivery-gesture">10 этапов · один маршрут</span><div class="delivery-arrows"><button type="button" class="delivery-prev" aria-label="Предыдущий этап" disabled>${arrow}</button><button type="button" class="delivery-next" aria-label="Следующий этап">${arrow}</button></div></div>
    <p class="delivery-announcement" role="status" aria-live="polite"></p>
   </section></article>`;
 }).join('');
 root.querySelectorAll('.delivery-proposal').forEach(mountSlider);
}
function mountSlider(article){
 const kind=article.dataset.kind,slider=article.querySelector('.delivery-slider'),visual=article.querySelector('.delivery-visual');
 const dark=article.closest('[data-delivery-sliders]')?.dataset.deliveryTheme==='dark';
 const renderer=new ProcessRenderer(visual.querySelector('canvas'),kind,dark?{
  dark:true,bare:true,background:getComputedStyle(article).getPropertyValue('--deep').trim()||'#233e70'
 }:{});
 const copy=article.querySelector('.delivery-copy-body'),count=article.querySelector('.delivery-count strong');
 const stops=[...article.querySelectorAll('.delivery-stop')],nav=article.querySelector('.delivery-stops');
 const play=article.querySelector('.delivery-play'),playLabel=article.querySelector('.delivery-play-label');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let index=0,visible=false,started=false,auto=!reduce.matches,motionPaused=false,sceneTime=0,holdTime=0,last=0,raf=null;
 function stop(){if(raf!==null)cancelAnimationFrame(raf);raf=null}
 function controls(){
  play.dataset.playing=String(auto&&!motionPaused&&index<9);play.setAttribute('aria-pressed',String(!auto||motionPaused));
  playLabel.textContent=index===9?'С начала':auto&&!motionPaused?'Пауза':'Продолжить';
  play.setAttribute('aria-label',index===9?'Воспроизвести весь маршрут сначала':auto&&!motionPaused?'Приостановить маршрут':'Продолжить маршрут');
  article.querySelector('.delivery-prev').disabled=index===0;article.querySelector('.delivery-next').disabled=index===9;
 }
 function stepText(manual){
  const s=steps[index];count.textContent=s.number;
  copy.querySelector('.delivery-step-title').textContent=s.title;copy.querySelector('h5').textContent=s.headline;copy.querySelector('.delivery-description').textContent=s.description;
  visual.setAttribute('aria-label',s.title+'. '+s.description);slider.dataset.step=String(index+1);
  stops.forEach((b,i)=>{if(i===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');b.classList.toggle('is-complete',i<index)});
  slider.style.setProperty('--step',index/9);slider.style.setProperty('--dwell',0);
  const b=stops[index];nav.scrollTo({left:Math.max(0,b.offsetLeft-nav.offsetLeft-(nav.clientWidth-b.offsetWidth)/2),behavior:reduce.matches?'instant':'smooth'});
  if(manual)article.querySelector('.delivery-announcement').textContent=`Этап ${index+1} из 10. ${s.title}`;
  controls();
 }
 function go(target,manual=false,replay=false){
  stop();const previous=started&&!replay?index:null;index=Math.max(0,Math.min(9,target));started=true;
  if(manual)auto=false;motionPaused=false;sceneTime=0;holdTime=0;
  renderer.setScene(index,previous===index?null:previous);stepText(manual);
  if(reduce.matches){sceneTime=PROCESS_DURATION;renderer.render(1)}
  if(!reduce.matches)copy.animate([{opacity:.2,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:600,easing:'cubic-bezier(.22,.7,.15,1)'});
  run();
 }
 function tick(now){
  raf=null;if(!visible||document.hidden||motionPaused)return;
  const delta=Math.min(80,Math.max(0,now-last));last=now;
  holdTime+=delta;
  if(sceneTime<PROCESS_DURATION){sceneTime=Math.min(PROCESS_DURATION,sceneTime+delta);renderer.render(sceneTime/PROCESS_DURATION)}
  slider.dataset.sceneState=sceneTime===PROCESS_DURATION?'complete':'playing';
  slider.style.setProperty('--dwell',Math.min(1,holdTime/PROCESS_DWELL));
  if(auto&&!reduce.matches&&index<9&&holdTime>=PROCESS_DWELL){go(index+1);return}
  if(sceneTime<PROCESS_DURATION||(auto&&index<9))raf=requestAnimationFrame(tick);
  else controls();
 }
 function run(){stop();if(!visible||document.hidden||motionPaused)return;if(sceneTime>=PROCESS_DURATION&&(!auto||index===9))return;last=performance.now();raf=requestAnimationFrame(tick)}
 stops.forEach((b,i)=>b.addEventListener('click',()=>go(i,true,i===index)));
 article.querySelector('.delivery-prev').addEventListener('click',()=>go(nextStep(index,-1),true));
 article.querySelector('.delivery-next').addEventListener('click',()=>go(nextStep(index,1),true));
 article.querySelector('.delivery-replay').addEventListener('click',()=>go(index,true,true));
 play.addEventListener('click',()=>{
  if(index===9){auto=!reduce.matches;go(0);return}
  if(auto&&!motionPaused){auto=false;motionPaused=true;stop()}
  else{auto=!reduce.matches;motionPaused=false;holdTime=Math.min(holdTime,PROCESS_DURATION);run()}
  controls();
 });
 slider.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();go(e.key==='Home'?0:e.key==='End'?9:nextStep(index,e.key==='ArrowRight'?1:-1),true)});
 let touch=null;
 visual.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touch=[e.clientX,e.clientY]},{passive:true});
 visual.addEventListener('pointerup',e=>{if(!touch)return;const dx=e.clientX-touch[0],dy=e.clientY-touch[1];touch=null;if(Math.abs(dx)>42&&Math.abs(dx)>Math.abs(dy)*1.5)go(nextStep(index,dx<0?1:-1),true)},{passive:true});
 visual.addEventListener('pointercancel',()=>touch=null);
 new IntersectionObserver(([e])=>{visible=e.intersectionRatio>.28;if(visible){if(!started)go(0);else run()}else stop()},{threshold:[0,.3]}).observe(visual);
 new ResizeObserver(()=>renderer.resize(visual.clientWidth)).observe(visual);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else run()});
 reduce.addEventListener('change',()=>{if(reduce.matches){stop();auto=false;sceneTime=PROCESS_DURATION;renderer.render(1);controls()}else run()});
 renderer.resize(visual.clientWidth);renderer.render(reduce.matches?1:0);controls();
}
document.querySelectorAll('[data-delivery-sliders]').forEach(mountDeliverySliders);
