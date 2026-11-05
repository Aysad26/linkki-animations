import {SceneTimeline} from '../timeline.js';
import {Renderer} from './renderer.js';
import {scenes} from './scenes.js';
export function mountMotionGallery(root){
root.innerHTML=`    <section class="toolbar" aria-label="Настройки просмотра">
      <nav class="filters" aria-label="Группы сюжетов"><button class="filter active" data-filter="all" aria-pressed="true">Все <sup>${scenes.length}</sup></button><button class="filter" data-filter="cargo" aria-pressed="false">Груз и документы</button><button class="filter" data-filter="transport" aria-pressed="false">Транспорт</button><button class="filter" data-filter="people" aria-pressed="false">Люди и сервис</button></nav>
      <div class="view-controls"><label>Темп <select id="speed" aria-label="Скорость анимаций"><option value="1">Обычный</option><option value="0.35">Замедленный</option></select></label><button id="motion-toggle" aria-pressed="false">Остановить анимации</button></div>
    </section>
    <div id="gallery" class="gallery" aria-label="Анимационные эскизы LINKKI"></div>
  <dialog id="viewer" aria-labelledby="viewer-title">
    <div class="viewer-head"><div><span id="viewer-number"></span><h2 id="viewer-title"></h2></div><button class="close" aria-label="Закрыть просмотр">✕</button></div>
    <div class="viewer-stage"></div>
    <div class="viewer-controls"><button id="viewer-play">↻ Повторить</button><button id="viewer-pause">Пауза</button><label for="viewer-progress">Кадр</label><input id="viewer-progress" type="range" min="0" max="100" value="0" aria-label="Кадр анимации"><output id="viewer-percent">0%</output></div>
    <p id="viewer-description"></p>
  </dialog>
`;
const gallery=root.querySelector('#gallery'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
const viewer=root.querySelector('#viewer'),slider=root.querySelector('#viewer-progress'),percent=root.querySelector('#viewer-percent');
const replayIcon='<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5a5.3 5.3 0 1 1-.2 6M3 1v4h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let speed=1,stopped=false,modal=null,lastFocus=null;
const records=[];
const asset=name=>new URL('assets/'+name,import.meta.url).href;
const titleTag=root.dataset.cardHeading==='h4'?'h4':'h2';
function stageHTML(s,expanded=false){return `<div class="study-stage" data-scene="${s.id}" role="group" aria-label="${s.title}. ${s.description}"><img class="poster" src="${s.id===2?new URL('../assets/flight-ground.webp',import.meta.url).href:asset(s.number+'.webp')}" width="1448" height="1086" alt="" loading="${s.id<3&&!root.dataset.embedded?'eager':'lazy'}"><canvas aria-hidden="true"></canvas><span class="loading">Подготовка сцены…</span>${expanded?'':`<button class="scene-expand" aria-label="Открыть эскиз ${s.number}">↗</button>`}</div>`}
for(const s of scenes){
 const card=document.createElement('article');card.className='card';card.id=`scene-${s.number}`;card.dataset.group=s.group;
 card.innerHTML=stageHTML(s)+`<div class="motion-line" aria-hidden="true"><span></span></div><div class="card-meta"><div class="title-group"><span class="number">${s.number}</span><${titleTag}>${s.title}</${titleTag}></div><button class="replay" disabled aria-label="Повторить эскиз ${s.number}">${replayIcon}Повторить</button></div><p>${s.description}</p><div class="card-tag">${s.tag}</div>`;
 gallery.append(card);const stage=card.querySelector('.study-stage'),r={spec:s,card,stage,renderer:new Renderer(stage.querySelector('canvas'),s.id),ratio:0,armed:true,ready:false,loading:null};
 r.timeline=new SceneTimeline({duration:s.duration,render:p=>{r.renderer.render(p);card.style.setProperty('--progress',p);stage.dataset.progress=p.toFixed(3)},onState:state=>stage.dataset.motionState=state});
 records.push(r);card.querySelector('.replay').addEventListener('click',()=>play(r,true));card.querySelector('.scene-expand').addEventListener('click',()=>openViewer(r));
}
async function prepare(r){
 if(!r.loading)r.loading=r.renderer.load().then(()=>{r.ready=true;r.stage.classList.add('ready');r.card?.querySelector('.replay')?.removeAttribute('disabled');if(reduce.matches||stopped)r.timeline.finish();return true}).catch(()=>{r.stage.querySelector('.loading').textContent='Не удалось загрузить. Обновите страницу.';return false});
 return r.loading;
}
async function play(r,manual=false){
 if(!await prepare(r))return;
 if(reduce.matches||stopped){r.timeline.finish();return}
 if(!manual&&(r.ratio<.55||!r.armed||document.hidden||viewer.open))return;
 if(manual){r.userPaused=false;r.timeline.reset();}r.timeline.duration=r.spec.duration/speed;if(r.timeline.play())r.armed=false;
}
const observer=new IntersectionObserver(entries=>{for(const e of entries){const r=records.find(r=>r.stage===e.target);r.ratio=e.intersectionRatio;if(!e.isIntersecting)r.armed=true;else if(r.ratio>=.55)play(r)}},{rootMargin:root.dataset.embedded?'0px 0px -3% 0px':'-118px 0px -3% 0px',threshold:[0,.55]});
const preload=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){const r=records.find(r=>r.stage===e.target);prepare(r);preload.unobserve(e.target)}},{rootMargin:'700px 0px'});
for(const r of records){observer.observe(r.stage);preload.observe(r.stage)}
const ro=new ResizeObserver(entries=>{for(const e of entries){const r=records.find(r=>r.stage===e.target);if(r&&r.stage.getBoundingClientRect().width>0)r.renderer.resize()}if(modal&&viewer.open)modal.renderer.resize()});records.forEach(r=>ro.observe(r.stage));
root.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
 const group=button.dataset.filter;root.querySelectorAll('.filter').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button))});
 for(const r of records){r.card.hidden=group!=='all'&&r.spec.group!==group;if(r.card.hidden)r.timeline.finish();else{r.armed=true;if(r.ready)r.renderer.resize()}}
 gallery.scrollIntoView({block:'start',behavior:reduce.matches?'instant':'smooth'});
}));
root.querySelector('#speed').addEventListener('change',e=>{speed=Number(e.target.value);for(const r of records)r.timeline.setDuration(r.spec.duration/speed);if(modal)modal.timeline.setDuration(modal.spec.duration/speed)});
root.querySelector('#motion-toggle').addEventListener('click',e=>{stopped=!stopped;e.currentTarget.textContent=stopped?'Включить анимации':'Остановить анимации';e.currentTarget.setAttribute('aria-pressed',String(stopped));for(const r of records)if(stopped)r.timeline.finish();else{r.armed=true;if(r.ratio>=.55)play(r)}if(modal&&stopped)modal.timeline.finish()});
async function openViewer(source){
 lastFocus=document.activeElement;records.forEach(r=>r.timeline.pause());
 const s=source.spec;root.querySelector('#viewer-number').textContent=s.number;root.querySelector('#viewer-title').textContent=s.title;root.querySelector('#viewer-description').textContent=s.description;
 const holder=root.querySelector('.viewer-stage');holder.innerHTML=stageHTML(s,true);const stage=holder.querySelector('.study-stage');
 const r={spec:s,stage,renderer:new Renderer(stage.querySelector('canvas'),s.id),ready:false,loading:null,ratio:1,armed:true};modal=r;
 r.timeline=new SceneTimeline({duration:s.duration/speed,render:p=>{r.renderer.render(p);slider.value=String(Math.round(p*100));percent.value=`${Math.round(p*100)}%`;stage.dataset.progress=p.toFixed(3)},onState:state=>{stage.dataset.motionState=state;const pause=root.querySelector('#viewer-pause');pause.textContent=state==='paused'?'Продолжить':'Пауза';pause.disabled=state==='complete'||state==='idle'}});
 viewer.showModal();document.body.style.overflow='hidden';await prepare(r);r.renderer.resize();if(modal===r)play(r,true);
}
function closeViewer(){modal?.timeline.reset();modal=null;viewer.close();document.body.style.overflow='';for(const r of records){if(r.timeline.state==='paused')r.timeline.resume();else if(r.ratio>=.55&&r.armed)play(r)}lastFocus?.focus()}
root.querySelector('.close').addEventListener('click',closeViewer);viewer.addEventListener('cancel',e=>{e.preventDefault();closeViewer()});viewer.addEventListener('click',e=>{if(e.target===viewer){const b=viewer.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeViewer()}});
root.querySelector('#viewer-play').addEventListener('click',()=>modal&&play(modal,true));
root.querySelector('#viewer-pause').addEventListener('click',()=>{if(!modal)return;modal.userPaused=modal.timeline.state!=='paused';if(modal.userPaused)modal.timeline.pause();else modal.timeline.resume()});
slider.addEventListener('input',()=>{if(!modal)return;modal.userPaused=true;modal.timeline.cancelPending();modal.timeline.elapsed=modal.timeline.duration*Number(slider.value)/100;modal.timeline.setState('paused');modal.timeline.render(Number(slider.value)/100)});
document.addEventListener('visibilitychange',()=>{for(const r of [...records,...(modal?[modal]:[])]){if(document.hidden){r.resumeAfterVisibility=r.timeline.state==='playing';r.timeline.pause();}else if(r.resumeAfterVisibility&&!r.userPaused&&!stopped&&r.timeline.state==='paused'&&(!viewer.open||r===modal)){r.resumeAfterVisibility=false;r.timeline.resume()}}});
reduce.addEventListener('change',()=>{if(reduce.matches)[...records,...(modal?[modal]:[])].forEach(r=>r.timeline.finish())});
addEventListener('resize',()=>modal?.renderer.resize());

}

document.querySelectorAll('[data-motion-gallery]').forEach(mountMotionGallery);
