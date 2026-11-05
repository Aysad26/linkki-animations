import {clamp,ease,phase,mix,homography,project,flap,packingFrame,trackingFrame} from './math.js';
import {customsFrame,CUSTOMS_STAMP_CONTACT,CUSTOMS_INK_PLANE} from '../motion.js';
const W=1448,H=1086,BLUE='#2a497d',LIGHT='#e9f3fd';
const CLEAN=new Set([1,2,3,4,5,7,9,11,12,16]);
const cache=new Map();
function loadImage(url){if(!cache.has(url))cache.set(url,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{cache.delete(url);reject(new Error('Не удалось загрузить '+url))};im.src=url}));return cache.get(url)}
const polygon=(c,points)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath()};
function fillPoly(c,points,fill,stroke=null,width=2){polygon(c,points);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}}
function line(c,points,p=1,width=5,color=BLUE){
 if(p<=0)return;const lengths=points.slice(1).map((q,i)=>Math.hypot(q[0]-points[i][0],q[1]-points[i][1]));let remaining=lengths.reduce((a,b)=>a+b,0)*clamp(p);
 c.beginPath();c.moveTo(...points[0]);for(let i=0;i<lengths.length;i++){const t=Math.min(1,remaining/lengths[i]);c.lineTo(mix(points[i][0],points[i+1][0],t),mix(points[i][1],points[i+1][1],t));remaining-=lengths[i];if(remaining<=0)break}c.lineWidth=width;c.strokeStyle=color;c.lineCap='round';c.lineJoin='round';c.stroke();
}
function check(c,x,y,size,p,color=BLUE){line(c,[[x-size*.42,y],[x-size*.08,y+size*.29],[x+size*.48,y-size*.35]],p,Math.max(3,size*.12),color)}
function circle(c,x,y,r,fill){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill()}
function cut(c,img,path,dx=0,dy=0,angle=0,pivot=[0,0],alpha=1){c.save();c.globalAlpha=alpha;c.translate(dx+pivot[0],dy+pivot[1]);c.rotate(angle);c.translate(-pivot[0],-pivot[1]);c.clip(typeof path==='string'?new Path2D(path):path);c.drawImage(img,0,0,W,H);c.restore()}
function image(c,img,dx=0,dy=0,scale=1){c.save();c.translate(W/2+dx,H/2+dy);c.scale(scale,scale);c.drawImage(img,-W/2,-H/2,W,H);c.restore()}
function glow(c,points,p,width=14){c.save();c.shadowColor='#b8d0ee';c.shadowBlur=12;line(c,points,p,width,'#f6faff');c.restore()}
const CARTON=homography([[486,281],[1244,421],[1035,683],[211,500]]);
const STICKER=homography([[657,675],[947,738],[947,950],[657,885]]);
const STICKER_EDGE='M657 688 Q657 675 670 678 L934 735 Q947 738 947 750 L947 937 Q947 951 934 947 L670 888 Q657 885 657 873 Z';
const RECT=(M,u0,v0,u1,v1)=>[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>project(M,u,v));
const BARCODE=homography([[900,557],[1117,579],[1117,660],[900,640]]);
const PHONE_GLASS='M716 55 Q673 54 651 97 L513 855 Q499 913 539 936 L875 967 Q925 975 944 925 L1068 147 Q1093 81 1049 70 L981 66 Q970 101 949 98 L794 90 Q774 89 770 59 Z';
const TRACKING_STEPS=[
 ['Заказ оформлен','Заказ'],
 ['Груз принят','Отправитель'],
 ['Таможня пройдена','Оформление'],
 ['На складе назначения','Последняя миля'],
 ['Груз доставлен','Получатель']
];
const DECK=[[0,665],[1448,571],[1448,669],[0,767]];
function shade(c,x0,y0,x1,y1,from,to){
 const g=c.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,from);g.addColorStop(1,to);return g;
}
function packingPlate(c,source){
 image(c,source);
 // The clean source has the short flaps lying flat. Rebuild only the two
 // narrow strips they cover; the tray and its two machined parts stay intact.
 fillPoly(c,[[485,282],[607,304],[340,524],[209,501]],
   shade(c,475,298,551,395,'#42618a','#91a9ca'),'#6d8aaf',2);
 fillPoly(c,[[1085,389],[1243,419],[1031,685],[882,637]],
   shade(c,1140,411,1000,625,'#59779d','#9ab0ce'),'#6d8aaf',2);
 line(c,[[480,288],[215,496]],1,3,'#acc2df');
 line(c,[[1237,425],[1030,678]],1,3,'#adbed8');
 // The sticker is applied last. Use the blue board tone to cover the
 // placeholder print in the source, within the front wall only.
 c.save();c.shadowColor='#2c4b7f';c.shadowBlur=18;
 fillPoly(c,[[644,660],[960,728],[960,967],[644,899]],
   shade(c,640,662,900,948,'#2b487c','#2c4a80'));
 c.restore();
}
function paintFlap(c,pts,top,bottom,shadow){
 const g=shade(c,...pts[0],...pts[2],top,bottom);
 c.save();c.shadowColor='rgba(33,57,95,.16)';c.shadowBlur=shadow;c.shadowOffsetY=3;
 fillPoly(c,pts,g,'#37577e',2.4);c.restore();
 line(c,[pts[0],pts[1]],1,1.8,'#b7cee8');
 line(c,[pts[2],pts[3]],1,2.2,'#a9c1dd');
}
function triangle(c,source,s,d){
 const [s0,s1,s2]=s,[d0,d1,d2]=d;
 const den=(s1[0]-s0[0])*(s2[1]-s0[1])-(s2[0]-s0[0])*(s1[1]-s0[1]);
 const a=((d1[0]-d0[0])*(s2[1]-s0[1])-(d2[0]-d0[0])*(s1[1]-s0[1]))/den;
 const b=((d1[1]-d0[1])*(s2[1]-s0[1])-(d2[1]-d0[1])*(s1[1]-s0[1]))/den;
 const cc=((d2[0]-d0[0])*(s1[0]-s0[0])-(d1[0]-d0[0])*(s2[0]-s0[0]))/den;
 const dd=((d2[1]-d0[1])*(s1[0]-s0[0])-(d1[1]-d0[1])*(s2[0]-s0[0]))/den;
 const center=d.reduce((v,q)=>[v[0]+q[0]/3,v[1]+q[1]/3],[0,0]);
 const bleed=d.map(q=>{const len=Math.hypot(q[0]-center[0],q[1]-center[1]);return [q[0]+(q[0]-center[0])*1.8/len,q[1]+(q[1]-center[1])*1.8/len]});
 c.save();polygon(c,bleed);c.clip();c.transform(a,b,cc,dd,d0[0]-a*s0[0]-cc*s0[1],d0[1]-b*s0[0]-dd*s0[1]);c.drawImage(source,0,0);c.restore();
}
function texture(c,source,quad){
 const M=homography(quad),nx=8,ny=12,sw=source.width,sh=source.height;
 c.save();polygon(c,quad);c.clip();fillPoly(c,quad,'#eaf2fc');
 // Projective mesh keeps device graphics attached to the photographed screen plane.
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const uv=[[x/nx,y/ny],[(x+1)/nx,y/ny],[(x+1)/nx,(y+1)/ny],[x/nx,(y+1)/ny]];
  const src=uv.map(([u,v])=>[u*sw,v*sh]),dst=uv.map(([u,v])=>project(M,u,v));
  triangle(c,source,[src[0],src[1],src[2]],[dst[0],dst[1],dst[2]]);triangle(c,source,[src[0],src[2],src[3]],[dst[0],dst[2],dst[3]]);
 }
 c.restore();
}
const MASKS={
 stamp:'M1018 769 Q1016 778 1026 781 L1024 848 Q1024 857 1037 860 L1201 897 Q1215 900 1227 894 L1276 866 Q1284 861 1284 850 L1287 810 Q1291 807 1292 794 L1296 626 Q1297 601 1280 587 Q1244 565 1183 556 Q1137 548 1110 549 Q1088 550 1054 573 Q1030 590 1028 628 Z',
 plane:'M150 207 Q151 188 175 182 Q200 175 233 177 L654 365 L664 281 L645 278 L625 248 Q620 225 645 199 L664 187 L689 191 L746 219 L1194 0 L1238 7 L1063 363 L1026 411 L1007 415 L993 446 L975 448 L961 475 L1145 619 L1323 533 L1374 545 L1284 661 L1263 687 L1284 716 L1264 724 L1242 720 L1208 944 L1180 922 L1097 747 L680 512 L529 1019 L486 988 L497 668 L493 645 L471 629 L472 608 L449 601 L451 581 L432 574 L416 556 Q392 558 374 538 L377 512 Q393 494 412 496 L489 520 L485 442 L215 300 Q159 250 150 207 Z',
 courier:'M1060 183 Q1055 135 1073 105 L1058 106 Q1080 62 1130 49 Q1166 24 1205 33 Q1240 23 1290 42 Q1334 74 1336 128 Q1343 192 1313 241 L1338 300 L1364 297 L1385 335 L1448 388 L1448 1086 L1095 1086 L1095 1022 L1105 990 L1105 952 L1098 936 L1000 969 L936 992 L885 1000 L813 983 Q805 979 809 969 Q806 960 818 954 L861 946 L883 935 L904 922 L922 899 L880 901 L843 903 Q831 902 829 891 Q812 897 813 879 Q804 872 818 865 Q805 860 820 850 L860 830 L886 811 L894 793 L869 791 Q841 785 838 771 Q837 756 852 760 L898 766 L937 772 L954 783 L989 768 L1023 744 L1045 721 L1069 712 L1075 679 L1067 669 L1077 609 L1090 565 L1094 523 L1111 474 L1125 441 L1167 417 L1184 380 L1194 369 L1179 353 L1141 350 Q1110 354 1099 328 L1097 313 L1086 307 L1085 288 Q1053 281 1058 264 L1061 249 L1074 219 L1068 207 Z',
 box:'M489 432 L849 406 L977 444 L978 680 L610 705 L489 651 Z',
 cargo:'M602 573 L605 552 L625 529 L634 405 L782 398 L789 389 L818 389 L824 398 L911 392 L918 381 L934 382 L957 397 L1050 400 L1111 420 L1138 443 L1147 558 L1172 572 Z',
 van:'M40 744 L43 548 Q46 459 84 428 L411 399 Q534 385 633 405 L713 425 L766 461 L844 541 L895 564 L930 597 L948 616 L956 650 L968 673 L974 725 L986 744 L988 793 L975 814 L948 821 Q931 863 894 875 Q857 884 831 848 L734 838 Q719 892 677 906 Q635 913 605 879 L579 850 L462 829 Q422 854 382 835 L245 820 Q224 866 188 871 Q149 874 126 849 L112 827 L58 809 L43 793 Z',
 loader:'M243 265 Q237 255 232 241 Q226 226 231 209 Q228 201 238 191 Q247 180 263 176 Q276 170 290 174 Q310 174 323 187 L327 195 L322 205 L326 213 L326 231 L331 242 L327 246 L324 249 Q325 259 320 266 L309 282 L312 292 L324 305 L320 310 Q343 324 351 360 L354 389 L414 388 L496 397 L497 544 L443 554 Q441 564 431 560 Q423 571 418 562 Q408 571 403 564 L369 567 L335 564 Q337 589 332 608 L327 621 Q333 641 331 663 Q337 691 340 713 Q343 738 336 760 Q344 769 348 787 L352 810 Q359 828 363 839 Q368 849 366 861 Q379 871 381 888 Q390 888 396 898 L414 891 Q426 892 431 904 Q434 917 421 927 L399 938 L360 951 Q343 958 330 953 L330 929 Q328 911 321 901 Q310 894 310 877 L309 865 Q295 846 287 822 L279 801 Q272 778 268 760 Q252 781 239 804 L212 845 L194 872 Q193 891 179 897 L168 903 L159 924 Q166 930 165 943 L171 951 L185 953 Q200 952 201 971 Q203 982 190 986 L159 990 Q140 990 126 978 L95 950 Q86 942 93 925 L112 892 Q116 874 128 861 Q141 838 153 815 L173 779 Q188 751 202 731 Q211 717 206 703 L207 669 L216 633 Q198 617 198 593 L198 557 L191 554 Q195 532 188 519 Q181 499 192 474 Q171 461 171 433 L177 382 Q173 364 182 342 Q192 319 215 306 L233 289 Q231 279 243 265 Z'
};
export class Renderer{
 constructor(canvas,id,{variant='default'}={}){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.id=id;this.variant=variant;this.progress=0;this.surface=document.createElement('canvas');this.surface.width=id===14?720:480;this.surface.height=id===14?480:720;this.sc=this.surface.getContext('2d');}
 async load(){const n=String(this.id).padStart(2,'0');const top=this.id===2;[this.original,this.clean]=await Promise.all([loadImage(new URL(top?'../assets/flight-aircraft.webp':`assets/${n}.webp`,import.meta.url).href),top?loadImage(new URL('../assets/flight-ground.webp',import.meta.url).href):CLEAN.has(this.id)?loadImage(new URL(`assets/${n}-clean.webp`,import.meta.url).href):Promise.resolve(null)]);this.loaded=true;this.resize();this.render(this.progress);}
 resize(width){const w=Math.max(1,Math.round(Math.min(W,(width??this.canvas.getBoundingClientRect().width)*Math.min(devicePixelRatio||1,2))));if(w===this.canvas.width)return;this.canvas.width=w;this.canvas.height=Math.round(w*H/W);this.render(this.progress);}
 render(p){this.progress=clamp(p);if(!this.loaded)return;const c=this.ctx;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);c.globalAlpha=1;c.setLineDash([]);c.shadowBlur=0;c.lineCap='round';c.lineJoin='round';if(this.id===7){c.translate(-W*.04,0);c.scale(1.08,1.08)}if(this.id!==3&&this.id!==16&&this.id!==2)image(c,this.clean||this.original);this['scene'+this.id](c,this.progress);}
 scene1(c,p){
  const f=customsFrame(p);
  [[[626,619],[635,630],[674,612]],[[577,679],[586,690],[628,671]],[[524,742],[533,753],[573,733]]]
   .forEach((q,i)=>line(c,q,f.checks[i],8,BLUE));
  if(f.imprint>0){
   c.save();c.globalAlpha=f.imprint;c.translate(CUSTOMS_STAMP_CONTACT.x,CUSTOMS_STAMP_CONTACT.y);c.transform(...CUSTOMS_INK_PLANE);
   c.beginPath();c.roundRect(11,5,165,37,4);c.strokeStyle=BLUE;c.lineWidth=4;c.stroke();
   line(c,[[23,24],[29,30],[42,16]],1,4,BLUE);
   c.fillStyle=BLUE;c.font='700 22px system-ui';c.fillText('ВЫПУСК',53,31);c.restore();
  }
  c.save();c.translate(1153+f.shadowX,858+f.shadowY);c.rotate(.21);c.scale(136,36);
  const shadow=c.createRadialGradient(0,0,0,0,0,1);shadow.addColorStop(0,`rgba(40,69,113,${f.shadow*.55})`);shadow.addColorStop(1,'rgba(40,69,113,0)');
  circle(c,0,0,1,shadow);c.restore();
  cut(c,this.original,MASKS.stamp,f.x,f.y);
 }
 scene2(c,p){
  const t=phase(p,.04,.97);
  // Both assets were painted in the same vertical projection. Keep the
  // fuselage aligned with the image and let altitude separate the planes.
  c.save();c.filter='grayscale(1)';
  image(c,this.clean,0,mix(18,-18,t),mix(1.23,1.02,t));
  c.filter='none';c.globalCompositeOperation='color';c.fillStyle='#a8c2e2';c.fillRect(0,0,W,H);c.restore();
  const scale=mix(.72,.91,t),width=H*scale,height=width*this.original.height/this.original.width;
  c.save();c.shadowColor='rgba(32,59,97,.16)';c.shadowBlur=mix(10,25,t);
  c.shadowOffsetX=12;c.shadowOffsetY=18;
  c.drawImage(this.original,(W-width)/2,(H-height)/2+mix(-32,32,t),width,height);c.restore();
 }
 scene3(c,p){
  if(!this.packingPlate){
   this.packingPlate=document.createElement('canvas');
   this.packingPlate.width=W;this.packingPlate.height=H;
   packingPlate(this.packingPlate.getContext('2d'),this.clean);
  }
  image(c,this.packingPlate);
  const f=packingFrame(p),M=CARTON;
  const rear=()=>paintFlap(c,flap(M,'rear',f.rear),'#a8c0df','#819fc7',5);
  if(f.rear===1.76)rear();
  paintFlap(c,flap(M,'left',f.left),'#9bb6d7','#718fb6',4);
  paintFlap(c,flap(M,'right',f.right),'#7f9fc6','#5e7ea8',4);
  if(f.rear!==1.76)rear();
  paintFlap(c,flap(M,'front',f.front),'#8aa7cd','#607fae',5);
  if(f.along>0)fillPoly(c,RECT(M,0,.442,f.along,.558),'#c8dbee','rgba(241,248,255,.66)',1.5);
  if(f.across>0){
   const v=Math.min(1,f.across/.85);
   fillPoly(c,RECT(M,.455,0,.545,v),'#d7e6f6','rgba(246,251,255,.73)',1.5);
   if(f.across>.85){
    const tail=-(f.across-.85)/.15*.102;
    fillPoly(c,[project(M,.455,1),project(M,.545,1),project(M,.545,1,tail),project(M,.455,1,tail)],'#c4d8f0');
   }
  }
  if(f.paper>0){
   c.save();c.clip(new Path2D(STICKER_EDGE));
   fillPoly(c,RECT(STICKER,0,0,1,f.paper),'#eaf2fd');
   if(f.ink>0){
    const marks=[[.13,.14,.67,.225],[.13,.29,.51,.375],[.13,.44,.82,.525]];
    for(const [u,v,x,y] of marks)fillPoly(c,RECT(STICKER,u,v,mix(u,x,f.ink),y),'#8ba8cd');
    const bars=[2,1,2,3,1,2,1,1,3,2,1,2,3,1,1,2,3,1,2,1,2,2,1,3,1,2,3,1,1,2,1];
    const total=bars.reduce((n,b)=>n+b+1.1,0),end=mix(.14,.91,f.ink);
    let u=.14;
    for(const width of bars){
     const right=u+.77*width/total;
     if(u>=end)break;
     fillPoly(c,RECT(STICKER,u,.69,Math.min(right,end),.915),'#2a497d');
     u=right+.77*1.1/total;
    }
   }
   c.restore();
  }
 }
 scene4(c,p){
  const dims=[[[250,328],[250,785]],[[296,836],[980,888]],[[1026,863],[1218,721]]];
  dims.forEach((q,i)=>{const t=phase(p,.04+i*.21,.46+i*.21);if(!t)return;c.save();c.globalAlpha=t;line(c,q,t,3);const [a,b]=q,ang=Math.atan2(b[1]-a[1],b[0]-a[0]);for(const [pt,dir]of[[a,1],[b,-1]]){const x=pt[0],y=pt[1],u=ang+(dir===1?0:Math.PI);fillPoly(c,[[x,y],[x+Math.cos(u+.42)*18,y+Math.sin(u+.42)*18],[x+Math.cos(u-.42)*18,y+Math.sin(u-.42)*18]],BLUE)}c.restore()});
  c.save();c.globalAlpha=phase(p,0,.2);for(const q of [[[224,322],[278,325]],[[225,787],[278,791]],[[291,804],[291,855]],[[989,858],[989,910]],[[1018,848],[1018,881]],[[1196,697],[1237,712]]])line(c,q,1,2);c.restore();
 }
 scene5(c,p){
  const t=phase(p,.12,.66),a=phase(p,.05,.17)*(1-phase(p,.65,.76)),v=mix(.11,.85,t);
  const left=project(BARCODE,0,v),right=project(BARCODE,1,v),lens=[731,574];
  if(a>0){
   c.save();c.globalAlpha=a;
   const g=shade(c,...lens,...left,'rgba(174,207,244,.12)','rgba(201,229,253,.45)');
   fillPoly(c,[[lens[0],lens[1]-3],left,right,[lens[0],lens[1]+3]],g);
   c.save();polygon(c,RECT(BARCODE,0,0,1,1));c.clip();glow(c,[left,right],1,6);c.restore();
   c.restore();
  }
  const pulse=phase(p,.72,.79)*(1-phase(p,.80,.97));
  if(pulse>0){
   c.save();c.globalAlpha=pulse*.9;
   glow(c,[[530,511],[544,514]],1,7);glow(c,[[560,516],[574,519]],1,7);
   c.restore();
  }
 }
 scene6(c,p){
  const s=this.sc,f=trackingFrame(p),x=62,ys=TRACKING_STEPS.map((_,i)=>190+97*i);
  s.fillStyle='#eff5fc';s.fillRect(0,0,480,720);s.textBaseline='middle';
  s.fillStyle='#25446f';s.font='600 34px system-ui';s.fillText('Путь отправления',32,92);
  s.fillStyle='#607b9f';s.font='23px system-ui';s.fillText('Этапы доставки',32,130);
  line(s,[[32,153],[449,153]],1,2,'#cbdced');
  f.lines.forEach((t,i)=>{
   const leg=[[x,ys[i]],[x,ys[i+1]]];
   line(s,leg,1,4,'#c4d6eb');line(s,leg,t,6,BLUE);
  });
  TRACKING_STEPS.forEach(([label,detail],i)=>{
   const y=ys[i],t=f.checks[i],pulse=Math.sin(Math.PI*t);
   if(pulse>0)circle(s,x,y,18+pulse*12,'rgba(92,132,187,.20)');
   circle(s,x,y,17,'#b0c6e1');circle(s,x,y,13,'#eff5fc');
   if(t>0){circle(s,x,y,12+t*5,BLUE);check(s,x,y,19,t,'#fff');}
   s.fillStyle=t>0?'#284674':'#637d9e';s.font='600 29px system-ui';s.fillText(label,100,y-3,345);
   s.fillStyle='#627da0';s.font='21px system-ui';s.fillText(detail,100,y+25,345);
  });
  // Align the status bar with the lower edge of the glass, which is a little
  // steeper than the average axis used for the rest of the phone interface.
  s.save();s.transform(1,.020,0,1,0,-4.8);
  s.fillStyle=f.delivered>.5?'#294875':'#dbe8f7';
  s.beginPath();s.roundRect(40,623,400,51,9);s.fill();
  s.fillStyle=f.delivered>.5?'#f6faff':'#294875';s.font='600 24px system-ui';s.textAlign='center';
  s.fillText(f.delivered>.5?'Отправление доставлено':'Отправление в пути',240,648);s.restore();
  // The front glass is nearly a parallelogram. One clipped transform keeps
  // the small type and route continuous without a tiled texture's seams.
  c.save();c.clip(new Path2D(PHONE_GLASS));
  c.transform(459/480,29/480,-153/720,929/720,646,42);
  c.drawImage(this.surface,0,0);c.restore();
 }
 scene7(c,p){
  const t=phase(p,.04,.92),x=mix(74,-78,t),y=mix(0,-44,t);
  const actor=(path)=>{c.save();c.translate(1100,950);c.scale(1-.022*t,1-.022*t);c.translate(-1100,-950);cut(c,this.original,path,x,y);c.restore()};
  actor(MASKS.courier);
  // The far palm goes behind the parcel, the receiving palm stays in front.
  cut(c,this.clean,'M349 656 L682 618 L804 647 L804 908 L456 956 L349 895 Z');
  actor('M813 983 Q805 979 809 969 Q806 960 818 954 L861 946 L883 935 L904 922 L922 899 L950 893 L995 926 L1000 969 L936 992 L885 1000 Z');
 }
 scene8(c,p){
  // Only ink changes. The original hand and label border stay in the foreground.
  const label=[[869,725],[1063,727],[1064,940],[868,934]];c.save();polygon(c,label);c.clip();fillPoly(c,label,'#eef4fd');
  const t=phase(p,.02,.65);const bars=[[895,747,117],[895,769,144],[902,793,81],[910,822,131]];
  bars.forEach(([x,y,w],i)=>{c.fillStyle='#95afd9';c.fillRect(x,y,w*phase(p,.03+i*.10,.25+i*.10),7)});
  c.save();c.beginPath();c.rect(908,866,135*phase(p,.35,.91),63);c.clip();c.drawImage(this.original,0,0,W,H);c.restore();c.restore();
  cut(c,this.original,'M853 796 Q890 790 913 807 Q932 823 916 837 Q936 850 917 865 Q932 881 909 894 Q914 915 890 927 L845 943 L817 883 L813 835 Z');
  cut(c,this.original,'M995 697 L1015 720 Q1029 741 1041 735 L1064 720 L1082 681 L1051 656 Z');
 }
 scene9(c,p){
  const x=mix(-285,268,phase(p,.04,.95)),y=x*(-.064);
  // Both feet are on the belt's two rails. The crossbeam follows the same
  // depth axis as the parcel side and the rollers: (+205, +92), not screen Y.
  const far=[660,622],near=[865,714],height=345;
  fillPoly(c,[[far[0]-11,far[1]],[far[0]+10,far[1]-1],[far[0]+10,far[1]-height-1],[far[0]-11,far[1]-height]],'#91accd','#6d89ab',2);
  fillPoly(c,[[640,622],[677,619],[688,627],[650,631]],'#91accd','#6d89ab',2);
  c.save();polygon(c,DECK);c.clip();
  c.translate(x,y);
  fillPoly(c,[[489,651],[846,629],[982,680],[611,709]],'rgba(39,67,113,.19)');
  c.shadowColor='rgba(28,53,92,.53)';c.shadowBlur=12;
  line(c,[[492,651],[610,704],[977,680]],1,7,'rgba(35,61,105,.25)');
  c.restore();
  cut(c,this.original,MASKS.box,x,y);
  // The top extrusion is parallel to the near/far footprint. The front
  // upright occludes the parcel at the crossing; there is no flattened arch.
  fillPoly(c,[[649,277],[670,276],[875,368],[854,369]],'#e0ebf7','#7793b3',2);
  fillPoly(c,[[649,277],[854,369],[854,397],[649,305]],'#b9cfe5','#6d89ab',2);
  fillPoly(c,[[854,369],[875,368],[875,713],[854,714]],'#b5cbe2','#6685a8',2);
  fillPoly(c,[[875,368],[883,375],[883,719],[875,713]],'#8ea9c8','#6685a8',1.5);
  fillPoly(c,[[841,713],[884,710],[895,721],[851,725]],'#9eb8d5','#688ab0',2);
  line(c,[[656,281],[858,373]],1,1.7,'#f0f6fd');
  const active=phase(p,.36,.43)*(1-phase(p,.69,.76));
  if(active>0){
   c.save();c.globalAlpha=active*.55;
   const g=c.createLinearGradient(743,350,743,650);g.addColorStop(0,'rgba(176,218,255,.07)');g.addColorStop(1,'rgba(229,246,255,.5)');
   fillPoly(c,[[659,307],[850,393],[850,706],[659,621]],g);
   line(c,[[671,614],[847,693]],1,3,'#dbeeff');c.restore();
  }
  circle(c,863,418,4,p>.74?'#eff8ff':'#52769f');
 }
 scene10(c,p){
  const t=phase(p,.08,.9),a=Math.sin(Math.PI*t);
  c.save();polygon(c,[[279,288],[1163,280],[1168,888],[288,895]]);c.clip();
  const x=mix(140,1280,t),g=c.createLinearGradient(x-120,0,x+120,0);
  g.addColorStop(0,'rgba(233,243,253,0)');g.addColorStop(.5,'rgba(244,249,255,.22)');g.addColorStop(1,'rgba(233,243,253,0)');
  c.globalAlpha=a;c.fillStyle=g;c.fillRect(x-120,270,240,640);c.restore();
 }
 scene11(c,p){
  const t=ease(p);cut(c,this.original,MASKS.cargo,mix(-32,58,t),mix(6,-12,t));
  // Front safety railing remains in front of cargo throughout the move.
  cut(c,this.clean,'M1138 430 L1173 430 L1175 569 L1266 569 L1266 589 L1141 589 Z');
 }
 scene12(c,p){
  const t=ease(p),x=mix(-115,0,t),y=0;c.save();c.globalAlpha=.13;c.fillStyle=BLUE;c.beginPath();c.ellipse(506+x,857,450,44,.035,0,Math.PI*2);c.fill();c.globalAlpha=.24;for(const [cx,cy,r] of [[188,869,64],[677,905,65],[894,874,47]]){c.beginPath();c.ellipse(cx+x,cy,r,9,0,0,Math.PI*2);c.fill()}c.restore();cut(c,this.original,MASKS.van,x,y);
  for(const [cx,cy,r]of[[174,801,39],[655,831,48]]){c.save();c.translate(cx+x,cy);c.rotate((t-1)*1.7);c.globalAlpha=.17;c.strokeStyle='#e9f3fd';c.lineWidth=3;for(let i=0;i<8;i++){c.rotate(Math.PI/4);c.beginPath();c.moveTo(r*.34,0);c.lineTo(r*.81,0);c.stroke()}c.restore()}
 }
 scene13(c,p){
  const scan=phase(p,.02,.66),alpha=Math.sin(Math.PI*scan);c.save();c.globalAlpha=alpha*.2;fillPoly(c,[[288,466+scan*163],[578,497+scan*180],[581,516+scan*180],[291,485+scan*163]],'#91afd7');c.restore();
  check(c,322,961,27,phase(p,.25,.57));check(c,309,990,27,phase(p,.58,.89));
 }
 scene14(c,p){
  const s=this.sc;s.clearRect(0,0,720,480);s.fillStyle='#eef5ff';s.fillRect(0,0,720,480);s.fillStyle='#95afd9';s.fillRect(0,0,720,42);[24,45,66].forEach(x=>circle(s,x,21,5,'#eaf4ff'));
  for(let i=0;i<3;i++){circle(s,50,155+i*77,10,'#ccdcf0');s.fillStyle='#d9e5f5';s.fillRect(80,145+i*77,310,20);s.fillStyle='#95afd9';s.fillRect(80,145+i*77,310*phase(p,.04+i*.13,.35+i*.13),20)}
  const t=phase(p,.53,.88);s.save();s.globalAlpha=t;s.translate(570,230+12*(1-t));s.scale(.90+.1*t,.90+.1*t);s.fillStyle='#fff';s.beginPath();s.roundRect(-96,-105,192,210,14);s.fill();s.strokeStyle='#b3c9e5';s.lineWidth=3;s.stroke();circle(s,0,0,44,BLUE);check(s,0,0,53,phase(p,.66,.96),'#fff');s.restore();
  if(this.variant==='order'){
   s.fillStyle='#eff5fc';s.fillRect(0,42,720,438);s.fillStyle='#294875';s.font='600 31px Onest, sans-serif';s.fillText('Заявка на отправку',44,94);
   ['Отправитель','Получатель','Параметры груза'].forEach((label,i)=>{
    const y=156+i*76;s.fillStyle='#7287a2';s.font='22px Onest, sans-serif';s.fillText(label,44,y);
    s.fillStyle='#d2e1f1';s.fillRect(44,y+14,570,14);s.fillStyle='#8caacb';s.fillRect(44,y+14,570*phase(p,.05+i*.15,.32+i*.15),14);
   });
   s.fillStyle='#294875';s.beginPath();s.roundRect(44,380,570,60,6);s.fill();
   s.fillStyle='#f6faff';s.font='500 27px Onest, sans-serif';s.fillText(p>.8?'Заказ принят':'Отправить заявку',68,419);check(s,570,410,30,phase(p,.8,.98),'#fff');
  }
  texture(c,this.surface,[[1018,478],[1404,448],[1350,783],[948,740]]);
 }
 scene15(c,p){
  const signature=[[351,675],[372,669],[362,690],[388,665],[378,695],[397,685],[413,681],[427,685],[446,683]];
  line(c,signature,phase(p,.05,.62),3,'#466b9d');const t=phase(p,.61,.95);c.save();c.globalAlpha=t;circle(c,405,735,22,'#edf5ff');circle(c,405,735,19,BLUE);check(c,405,735,22,phase(p,.69,.98),'#fff');c.restore();
 }
 scene16(c,p){
  const ground=phase(p,0,.79), walk=phase(p,.055,.91), opacity=phase(p,.07,.37);
  c.fillStyle='#e4edf8';c.fillRect(0,0,W,H);
  c.save();c.globalAlpha=mix(.40,1,phase(p,0,.45));image(c,this.clean,0,0,mix(1,1.054,ground));c.restore();
  if(opacity<=0)return;
  // Scale the worker around the planted shoe so the floor contact doesn't drift.
  const scale=1.054*mix(1.10,1,walk), anchor=[344,949];
  c.save();c.translate(W/2+(anchor[0]-W/2)*1.054+mix(-75,48,walk),H/2+(anchor[1]-H/2)*1.054);
  c.scale(scale,scale);c.translate(-anchor[0],-anchor[1]);
  c.save();c.globalAlpha=opacity*.62;c.translate(246,963);c.rotate(-.13);c.scale(170,29);
  const shadow=c.createRadialGradient(0,0,0,0,0,1);shadow.addColorStop(0,'rgba(30,59,101,.38)');shadow.addColorStop(1,'rgba(30,59,101,0)');circle(c,0,0,1,shadow);c.restore();
  this.loaderMask??=new Path2D(MASKS.loader);
  cut(c,this.original,this.loaderMask,0,0,0,[0,0],opacity);c.restore();
 }
}
