import './home.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const kind = document.body.dataset.homeVariant;
if (kind === 'realistic') {
  await import('../motion/icon-sliders.js');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({target,isIntersecting}) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      reveal(target);
    });
  }, {threshold: .35});
  function reveal(img) {
    if (reduced.matches) return;
    img.getAnimations().forEach(a => a.cancel());
    img.animate([{opacity:0,transform:'translateY(9px) scale(.83)'},{opacity:1,transform:'translateY(0) scale(1)'}],
      {duration:650,easing:'cubic-bezier(.22,.7,.2,1)'});
  }
  document.querySelectorAll('.service-art img').forEach(img => {
    observer.observe(img);
    const card = img.closest('.service-card');
    card.addEventListener('pointerenter', () => reveal(img));
    card.addEventListener('focus', () => reveal(img));
  });
} else if (kind === 'isometric') {
  await import('../motion/delivery-sliders.js');
  const {ProcessRenderer} = await import('../motion/process-renderer.js');
  const slots = new Map();
  const duration = 2000;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({target,isIntersecting}) => {
      const state = slots.get(target);
      if (isIntersecting && !state.seen) { state.seen=true; play(state); }
      if (!isIntersecting && state.frame) { cancelAnimationFrame(state.frame);state.frame=0;state.renderer.render(1); }
    });
  }, {threshold: .35});
  function play(state) {
    cancelAnimationFrame(state.frame);
    if (reduced.matches) { state.renderer.render(1); return; }
    const start = performance.now();
    function tick(now) {
      const progress=Math.min(1,(now-start)/duration);
      state.renderer.render(progress);
      state.frame=progress<1?requestAnimationFrame(tick):0;
    }
    state.frame=requestAnimationFrame(tick);
  }
  document.querySelectorAll('[data-service-scene]').forEach(canvas => {
    const renderer = new ProcessRenderer(canvas,'line',{compact:true,background:'#e5edf5'});
    renderer.setScene(Number(canvas.dataset.serviceScene));
    renderer.resize();renderer.render(1);
    const state={renderer,frame:0,seen:false};slots.set(canvas,state);
    new ResizeObserver(() => renderer.resize()).observe(canvas);
    observer.observe(canvas);
    const card=canvas.closest('.service-card');
    card.addEventListener('pointerenter', () => play(state));
    card.addEventListener('focus', () => play(state));
  });
  reduced.addEventListener('change',()=>{if(reduced.matches)slots.forEach(s=>{cancelAnimationFrame(s.frame);s.renderer.render(1);s.frame=0;});});
}
