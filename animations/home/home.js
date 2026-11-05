import {mountFeatureMotion,mountLineIcons,mountRoute,mountHomeGlobe} from './motion-kit.js';

document.documentElement.classList.add('js');
const visible=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('is-visible');visible.unobserve(e.target)}},{threshold:.12,rootMargin:'0px 0px -20px 0px'});
document.querySelectorAll('[data-reveal]').forEach(e=>visible.observe(e));

mountFeatureMotion(document);
mountLineIcons(document);
const route = document.querySelector('[data-route]');
if (route) mountRoute(route);
mountHomeGlobe(document.querySelector('.home-globe'));

const menu=document.querySelector('.menu-button'),mobileNav=document.querySelector('#mobile-nav');
function closeMenu(){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Открыть меню');mobileNav.hidden=true}
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');mobileNav.hidden=!open});mobileNav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});

const info=document.querySelector('#info-dialog'),infoTitle=document.querySelector('#info-title'),infoBody=document.querySelector('#info-body'),search=document.querySelector('#search-dialog');
function openInfo(title,content){infoTitle.textContent=title;infoBody.replaceChildren();if(typeof content==='string'){const p=document.createElement('p');p.textContent=content;infoBody.append(p)}else infoBody.append(content);info.showModal()}
function waybill(){const box=document.createElement('div');const p=document.createElement('p');p.textContent='Индивидуальная накладная содержит уникальный номер вашего отправления. Используйте его для отслеживания.';const example=document.createElement('div');example.className='waybill-preview';example.innerHTML='<svg width="42" height="52" viewBox="0 0 42 52" fill="none" aria-hidden="true"><path d="M5 2h22l10 10v38H5V2Zm22 0v12h10M12 24h18M12 31h18M12 38h10" stroke="currentColor" stroke-width="1.2"/></svg><div><div class="waybill-number">№ LK 000 000 000</div><small>Пример расположения номера</small></div>';const a=document.createElement('a');a.className='text-link';a.href='https://linkki.webanatomy.ru/invoice/';a.textContent='Индивидуальная накладная →';box.append(p,example,a);openInfo('Где найти номер накладной?',box)}
document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>{closeMenu();if(button.dataset.open==='waybill')waybill();if(button.dataset.open==='account')openInfo('Вход / Регистрация','Личный кабинет показан в навигации как часть согласованной главной. В этой демонстрационной версии авторизация не подключена.');if(button.dataset.open==='search'){search.showModal();document.querySelector('#search-query').focus();updateSearch()}}));
for(const dialog of document.querySelectorAll('dialog')){dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}})}
document.querySelector('#tracking-form').addEventListener('submit',e=>{e.preventDefault();const input=document.querySelector('#tracking-number'),numbers=input.value.split(',').map(s=>s.trim()).filter(Boolean);if(!numbers.length){input.setCustomValidity('Введите номер отправления');input.reportValidity();return}input.setCustomValidity('');const box=document.createElement('div'),p=document.createElement('p');p.textContent='Демонстрация формы отслеживания. Онлайн-статусы отправлений в этом макете не подключены.';const list=document.createElement('ul');list.className='info-numbers';numbers.forEach(n=>{const li=document.createElement('li');li.textContent=n;list.append(li)});box.append(p,list);openInfo('Отследить груз',box)});
document.querySelector('#tracking-number').addEventListener('input',e=>e.target.setCustomValidity(''));
const SEARCH_ITEMS=[['Услуги','#services'],['Отправить','#services'],['Получить','#services'],['Специальный сервис','#services'],['О компании','#expertise'],['Найдите решения для вашего бизнеса','#solutions'],['Новости','#solutions'],['Таможенное оформление','https://linkki.webanatomy.ru/customs/'],['Индивидуальная накладная','https://linkki.webanatomy.ru/invoice/'],['Коммерческий счет (инвойс)','https://linkki.webanatomy.ru/commercial/'],['Контакты','#contacts']];
function updateSearch(){const q=document.querySelector('#search-query').value.trim().toLocaleLowerCase('ru'),out=document.querySelector('.search-results');out.replaceChildren();const found=SEARCH_ITEMS.filter(([name])=>!q||name.toLocaleLowerCase('ru').includes(q));for(const [name,url]of found){const a=document.createElement('a');a.href=url;a.textContent=name+' →';a.addEventListener('click',()=>search.close());out.append(a)}if(!found.length){const p=document.createElement('p');p.textContent='Ничего не найдено. Попробуйте другой запрос.';out.append(p)}}
document.querySelector('#search-query').addEventListener('input',updateSearch);
