import {mountFeatureMotion,mountLineIcons,mountRoute,mountHomeGlobe} from './home/motion-kit.js';

const lab=document.querySelector('.home-motion-lab');
const replayFeature=mountFeatureMotion(lab);
mountLineIcons(lab);
const route=mountRoute(lab.querySelector('[data-route]'));
const globe=lab.querySelector('.home-globe');
let replayGlobe;
const primeGlobe=()=>replayGlobe??=mountHomeGlobe(globe);
const near=new IntersectionObserver(([entry])=>{
  if(entry.isIntersecting){primeGlobe();near.disconnect();}
},{rootMargin:'360px 0px'});
near.observe(globe);
lab.addEventListener('click',event=>{
  const button=event.target.closest('[data-demo-replay]');
  if(!button)return;
  const card=button.closest('.home-demo');
  switch(button.dataset.demoReplay){
    case 'globe': primeGlobe()();break;
    case 'feature': replayFeature(card.querySelector('[data-feature-motion]'));break;
    case 'icons': card.querySelectorAll('[data-line-icon]').forEach(icon=>icon.draw(720));break;
    case 'route': route.restart();break;
  }
});
