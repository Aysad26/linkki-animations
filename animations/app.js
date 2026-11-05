import { SceneTimeline } from './timeline.js';
import { DURATIONS, clamp, ease, interval, customsFrame, CUSTOMS_STAMP_CONTACT, CUSTOMS_INK_PLANE } from './motion.js';
import { GlobeScene } from './globe.js';

(() => {
  'use strict';
  const chapters = [...document.querySelectorAll('.chapter')];
  const hero = document.querySelector('.hero');
  const rail = document.querySelector('.scene-nav');
  const railLinks = [...rail.querySelectorAll('a')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const globe = new GlobeScene(hero.querySelector('.hero-scene'), { dimensional:true, entrance:true });

  function paint(el, type, p) {
    const set = (name, value) => el.style.setProperty(name, value.toFixed(4));
    if (type === 'hero') { set('--hp', ease(p)); globe.render(p); return; }
    set('--p', p);
    set('--e', ease(p));
    if (type === 'conveyor') {
      set('--reader-beam', reduce.matches ? 0 : interval(p,.43,.48)*(1-interval(p,.515,.56)));
      set('--reader-read', interval(p,.54,.65));
    }
    if (type === 'flight') {
      set('--ground-distance', interval(p,.02,.98));
      set('--aircraft-distance', interval(p,.04,.99));
    }
    if (type === 'customs') {
      const f=customsFrame(p);
      f.checks.forEach((value,i)=>set('--document-check-'+(i+1),value));
      set('--stamp-x',f.x);set('--stamp-y',f.y);
      set('--stamp-shadow-x',f.shadowX);set('--stamp-shadow-y',f.shadowY);
      set('--stamp-shadow',f.shadow);set('--stamp-imprint',f.imprint);set('--customs-release',f.release);
    }
    if (type === 'dispatch') {
      set('--dispatch-arrive', interval(p, .02, .65));
      set('--dispatch-place', interval(p, .30, .88));
    }
    set('--done', interval(p, .81, .96));

  }

  const states = [hero, ...chapters].map(el => {
    const type = el === hero ? 'hero' : el.dataset.scene;
    if (type === 'customs') {
      const {x,y}=CUSTOMS_STAMP_CONTACT;
      el.querySelector('.customs-imprint').setAttribute('transform',`translate(${x} ${y}) matrix(${CUSTOMS_INK_PLANE.join(' ')})`);
    }
    const state = { el, type, target: el.querySelector(el === hero ? '.hero-scene' : '.scene'), ratio: 0, armed: true, ready: false, preparing: null };
    el.dataset.motionState = 'idle';
    el.dataset.motionDuration = DURATIONS[type];
    state.timeline = new SceneTimeline({ duration: DURATIONS[type], render: p => paint(el, type, p), onState: value => { el.dataset.motionState = value; } });
    return state;
  });

  async function enter(state, manual = false) {
    if (reduce.matches) return;
    if (!manual && (!state.armed || ['playing', 'paused'].includes(state.timeline.state))) return;
    if (!state.ready) {
      state.preparing ||= Promise.allSettled([
        ...[...state.target.querySelectorAll('img')].map(img => { img.loading = 'eager'; return img.decode(); }),
        ...[...new Set([...state.target.querySelectorAll('svg image')].map(img => img.getAttribute('href')))].map(src => {
          const img = new Image(); img.src = src; return img.decode();
        }),
        ...(state.type === 'hero' ? [globe.ready] : [])
      ]);
      await state.preparing; state.ready = true;
    }
    if (reduce.matches || document.hidden || (!manual && (!state.armed || state.ratio < .55))) return;
    if (manual) state.timeline.reset();
    if (state.timeline.play()) state.armed = false;
  }

  for (const state of states.filter(state => state.type !== 'hero')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-replay';
    button.innerHTML = '<span aria-hidden="true">↻</span> Повторить';
    button.setAttribute('aria-label', 'Повторить сцену: ' + state.target.getAttribute('aria-label'));
    state.el.querySelector('.stage-scroll').before(button);
    button.addEventListener('click', () => enter(state, true));
  }

  const byTarget = new Map(states.map(state => [state.target, state]));
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = byTarget.get(entry.target);
      state.ratio = entry.intersectionRatio;
      // Only a full exit re-arms playback. Threshold jitter does not restart it.
      if (!entry.isIntersecting) state.armed = true;
      else if (state.ratio >= .55) enter(state);
    }
  }, { rootMargin: '-76px 0px -4% 0px', threshold: [0, .55] });

  function applyMotionPreference() {
    observer.disconnect();
    for (const state of states) {
      state.armed = true; state.ratio = 0;
      if (reduce.matches) state.timeline.finish();
      else { state.timeline.reset(); observer.observe(state.target); }
    }
  }
  reduce.addEventListener('change', applyMotionPreference);
  document.addEventListener('visibilitychange', () => {
    for (const state of states) {
      if (document.hidden) state.timeline.pause();
      else if (state.timeline.state === 'paused') state.timeline.resume();
      else if (state.ratio >= .55) enter(state);
    }
  });
  applyMotionPreference();

  // Scrolling updates reading/navigation indicators only, never scene time.
  let sections = [], pageHeight = 0, vh = innerHeight, ticking = false;
  function measure() {
    vh = innerHeight;
    sections = chapters.map(el => ({ el, top: el.offsetTop, height: el.offsetHeight }));
    pageHeight = document.documentElement.scrollHeight - vh;
    requestUpdate();
  }
  function update() {
    ticking = false;
    const y = scrollY;
    document.documentElement.style.setProperty('--read', clamp(y / Math.max(1, pageHeight)).toFixed(4));
    let current = -1;
    sections.forEach(({ top, height }, i) => {
      if (y + vh * .5 >= top && y + vh * .5 < top + height) current = i;
    });
    rail.classList.toggle('visible', current >= 0);
    railLinks.forEach((link, i) => {
      link.classList.toggle('active', i === current);
      if (i === current) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
  }
  function requestUpdate() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', measure, { passive: true });
  addEventListener('load', measure);
  document.fonts.ready.then(measure);
  measure();
  const toggle = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  function closeMenu() { toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Открыть меню'); mobileNav.hidden = true; }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    mobileNav.hidden = !open;
  });
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  document.querySelectorAll('.faq-list details').forEach(item => item.addEventListener('toggle', () => { if (item.open) document.querySelectorAll('.faq-list details').forEach(other => { if (other !== item) other.open = false; }); measure(); }));
})();
