// Original LINKKI process miniatures. Every point belongs to one 3D coordinate
// system; the two treatments share proportions, not raster gallery artwork.
export const PROCESS_DURATION=2200;
export const PROCESS_DWELL=5100;
export const clamp=n=>Math.max(0,Math.min(1,n));
export const smooth=n=>{n=clamp(n);return n*n*(3-2*n)};
export const phase=(p,a,b)=>smooth((p-a)/(b-a));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const palette={navy:'#2a497d',blue:'#7193bd',pale:'#b8cce3',ice:'#dce8f5',white:'#f3f7fc',ink:'#45668e',carton:'#96b2d2'};
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n)};
export function mesh(){return {faces:[],lines:[]}}
function polygon(m,points,color='ice',normal=null){
 let n=normal||norm(cross(sub(points[1],points[0]),sub(points[2],points[0])));
 m.faces.push({points,color,normal:n});
}
function convexFace(m,points,center,color){
 let n=norm(cross(sub(points[1],points[0]),sub(points[2],points[0])));
 const mid=points.reduce((s,v)=>s.map((q,i)=>q+v[i]/points.length),[0,0,0]);
 if(dot(n,sub(mid,center))<0){points=[...points].reverse();n=n.map(v=>-v)}
 polygon(m,points,color,n);
}
export function stroke(m,points,{color='ink',width=1,delay=0,dash=false}={}){m.lines.push({points,color,width,delay,dash});}
export function cuboid(m,center,size,color='ice',bevel=0){
 const h=size.map(v=>v/2),b=Math.min(bevel,...h.map(v=>v*.4));
 if(!b){
  const v=[];for(let i=0;i<8;i++)v.push(h.map((n,k)=>center[k]+n*((i>>k&1)?1:-1)));
  for(const ids of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]])convexFace(m,ids.map(i=>v[i]),center,color);
  return;
 }
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const other=[0,1,2].filter(k=>k!==axis);
  const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(q=>{const p=[...center];p[axis]+=sign*h[axis];other.forEach((k,j)=>p[k]+=q[j]*(h[k]-b));return p});
  convexFace(m,points,center,color);
 }
 for(let along=0;along<3;along++){
  const [a,baxis]=[0,1,2].filter(k=>k!==along);
  for(const sa of [-1,1])for(const sb of [-1,1]){
   const points=[];
   for(const [t,edge] of [[-1,0],[1,0],[1,1],[-1,1]]){const p=[...center];p[along]+=t*(h[along]-b);p[a]+=sa*(h[a]-(edge?b:0));p[baxis]+=sb*(h[baxis]-(edge?0:b));points.push(p)}
   convexFace(m,points,center,color);
  }
 }
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){
  const signs=[sx,sy,sz];const pts=[0,1,2].map(full=>h.map((v,k)=>center[k]+signs[k]*(v-(k===full?0:b))));convexFace(m,pts,center,color);
 }
}
function cylinder(m,center,radius,height,color='ice',axis='y',segments=64){
 segments=Math.max(24,segments);
 const k={x:0,y:1,z:2}[axis],others=[0,1,2].filter(v=>v!==k);
 const rings=[-1,1].map(s=>Array.from({length:segments},(_,i)=>{const p=[...center],a=i/segments*Math.PI*2;p[k]+=s*height/2;p[others[0]]+=Math.cos(a)*radius;p[others[1]]+=Math.sin(a)*radius;return p}));
 convexFace(m,rings[0],center,color);convexFace(m,rings[1],center,color);
 for(let i=0;i<segments;i++){const j=(i+1)%segments;convexFace(m,[rings[0][i],rings[0][j],rings[1][j],rings[1][i]],center,color)}
}
function plane(m,points,color='white',normal=[0,0,1]){polygon(m,points,color,normal)}
function roundedLine(m,x,y,z,w,h,color='ink',width=1){stroke(m,[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z],[x,y,z]],{color,width})}
function detail(m,anchor,build){
 const nf=m.faces.length,nl=m.lines.length;build();
 m.faces.slice(nf).forEach((f,i)=>{f.depthAnchor=anchor;f.bias=.008+i*.0002;f.decal=true});
 m.lines.slice(nl).forEach((l,i)=>{l.depthAnchor=anchor;l.bias=.022+i*.0002});
}
function label(m,center,w,h){
 const [x,y,z]=center;
 plane(m,[[x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z]],'white');
 for(let i=0;i<3;i++)stroke(m,[[x-w*.37,y+h*(.29-i*.13),z+.002],[x+w*(i===1?.1:.29),y+h*(.29-i*.13),z+.002]],{color:'blue',width:1.6,delay:.12+i*.05});
 let u=-.35;for(let i=0;i<20;i++){const bw=i%4===0?.022:.011;plane(m,[[x+w*u,y-h*.34,z+.003],[x+w*(u+bw),y-h*.34,z+.003],[x+w*(u+bw),y-h*.04,z+.003],[x+w*u,y-h*.04,z+.003]],'navy');u+=bw+.012}
}
function carton(m,size,mode){
 const [w,h,d]=size;const b=mode==='solid'?.035:0;
 cuboid(m,[0,h/2,0],size,mode==='solid'?'carton':'navy',b);
 detail(m,[0,h,0],()=>plane(m,[[-.065,h+.001,-d/2],[.065,h+.001,-d/2],[.065,h+.001,d/2],[-.065,h+.001,d/2]],'pale',[0,1,0]));
 detail(m,[0,h/2,d/2],()=>{plane(m,[[-.065,h-.17,d/2+.002],[.065,h-.17,d/2+.002],[.065,h,d/2+.002],[-.065,h,d/2+.002]],'pale');
 label(m,[w*.12,h*.43,d/2+.006],w*.42,h*.48);});
}
function item(items,key,position,build,options={}){const geometry=mesh();build(geometry);const o={key,position,geometry,delay:options.delay??.08,enter:options.enter??'rise',...options};items.push(o);return o}
function packageItem(items,mode,pos=[.65,0,.5],size=[1,.78,.82]){size=[size[0],size[0]*.78,size[0]*.82];return item(items,'shipment',pos,m=>carton(m,size,mode),{delay:0,enter:'parcel',size})}
function documentMesh(m,mode,{check=false}={}){
 cuboid(m,[0,.86,0],[1.17,1.7,.07],'white',mode==='solid'?.025:0);
 // All ruled fields are decals on the same sheet surface.
 detail(m,[0,.86,.04],()=>{plane(m,[[.31,1.71,.045],[.58,1.44,.045],[.31,1.44,.045]],'pale');
 for(let i=0;i<4;i++){
  const y=1.37-i*.24;roundedLine(m,-.42,y-.05,.041,.095,.095,'blue',.8);
  stroke(m,[[-.23,y,.042],[i===2?.23:.42,y,.042]],{color:'blue',width:1.5,delay:.09*i});
 }
 stroke(m,[[-.42,.25,.042],[.14,.25,.042]],{color:'blue',width:1.1});
 if(check)stroke(m,[[.08,.44,.05],[.2,.31,.05],[.47,.65,.05]],{color:'navy',width:2.7,delay:.4});});
}
function badge(items,pos,mode,key='approved'){
 return item(items,key,pos,m=>{cylinder(m,[0,0,0],.32,.1,'navy','z');detail(m,[0,0,.056],()=>stroke(m,[[-.14,.01,.056],[-.035,-.09,.056],[.16,.13,.056]],{color:'white',width:3.5}))},{delay:.73,enter:'badge'});
}
function door(items,mode,{end=false}={}){
 const b=mode==='solid'?.018:0;
 item(items,'door',[-.7,0,-.35],m=>{
  cuboid(m,[-.65,1.05,0],[.12,2.1,.22],'pale',b);cuboid(m,[.65,1.05,0],[.12,2.1,.22],'pale',b);cuboid(m,[0,2.1,0],[1.42,.13,.22],'pale',b);
  cuboid(m,[0,.035,.32],[1.6,.07,1.2],'ice',b);

 },{delay:.02});
 item(items,'door-leaf',[-1.29,0,-.40],m=>{
  cuboid(m,[.55,1.03,0],[1.08,1.97,.05],'ice',b);
  detail(m,[.55,1.03,.03],()=>roundedLine(m,.12,.18,.031,.82,1.72,'blue',.8));
  cuboid(m,[.97,1.04,.075],[.025,.27,.065],'navy',.008);
 },{delay:.12,enter:'door'});
 // A short directional line communicates pickup or delivery without people.
 item(items,'handoff-direction',[.13,.045,.93],m=>{
  const d=end?-1:1;stroke(m,[[-.35*d,0,0],[.38*d,0,0]],{color:'blue',width:1.4});stroke(m,[[.23*d,0,-.14],[.38*d,0,0],[.23*d,0,.14]],{color:'blue',width:1.4});
 },{delay:.52,enter:'draw'});
}
function warehouse(items,mode,ending=false){
 const b=mode==='solid'?.012:0;
 item(items,'racking',[-.25,0,-.6],m=>{
  for(const x of [-1.3,0,1.3])for(const z of [-.3,.3])cuboid(m,[x,1,z],[.065,2,.065],'blue',b);
  for(const y of [.12,.93,1.73])cuboid(m,[0,y,0],[2.7,.065,.7],'pale',b);
  for(const x of [-1.3,1.3]){stroke(m,[[x,.17,-.3],[x,.9,.3],[x,1.65,-.3]],{color:'blue',width:.8})}
 },{delay:.02});
 const placements=[[-.92,.16,-.63],[.43,.16,-.63],[-.8,.97,-.63],[.45,.97,-.63]];
 placements.forEach((pos,i)=>item(items,'stock-'+i,pos,m=>carton(m,[.57+(i%2)*.12,.58,.52],mode),{delay:.15+i*.045}));
 item(items,'pallet',[.7,.08,.75],m=>{for(const z of [-.4,0,.4])cuboid(m,[0,.03,z],[1.35,.07,.15],'blue',b);for(const x of [-.5,.5])cuboid(m,[x,-.04,0],[.16,.1,1.04],'pale',b)},{delay:.3});
 packageItem(items,mode,[.7,.18,.75],[.98,.71,.72]);
 if(ending)badge(items,[1.55,1.33,.55],mode);
}
function terminal(items,mode,arrival=false){
 item(items,'terminal-shell',[0,0,-.75],m=>{
  cuboid(m,[0,.85,0],[2.6,1.7,.55],'ice',mode==='solid'?.035:0);
  cuboid(m,[0,1.74,.02],[2.8,.12,.7],'pale',.02);
  // Loading doors and a row of small upper windows.
  for(const x of [-.72,.72]){
   plane(m,[[x-.48,.07,.282],[x+.48,.07,.282],[x+.48,1.21,.282],[x-.48,1.21,.282]],'blue');
   for(let i=0;i<6;i++)stroke(m,[[x-.44,.18+i*.17,.287],[x+.44,.18+i*.17,.287]],{color:'ice',width:.7});
  }
  for(let i=0;i<5;i++)plane(m,[[-1.08+i*.45,1.41,.283],[-.8+i*.45,1.41,.283],[-.8+i*.45,1.57,.283],[-1.08+i*.45,1.57,.283]],'white');
 },{delay:.02});
 conveyor(items,mode,{gate:arrival});
 const parcel=packageItem(items,mode,[arrival?.66:-.1,.53,.65],[.8,.64,.64]);if(arrival)parcel.motion='conveyor';
}
function conveyor(items,mode,{gate=false}={}){
 const b=mode==='solid'?.014:0;
 item(items,'conveyor',[.2,0,.65],m=>{
  for(const z of [-.42,.42]){cuboid(m,[0,.46,z],[2.65,.13,.07],'blue',b);for(const x of [-1.1,1.1])cuboid(m,[x,.23,z],[.08,.46,.08],'pale',b)}
  for(let i=0;i<13;i++)cylinder(m,[-1.18+i*.197,.49,0],.045,.79,'white','z',16);
 },{delay:.12});
 if(gate){
  item(items,'scan-gate',[0,0,.65],m=>{
   for(const z of [-.5,.5])cuboid(m,[0,1.08,z],[.12,1.25,.10],'pale',b);
   cuboid(m,[0,1.73,0],[.16,.12,1.10],'blue',b);
   cuboid(m,[.065,1.47,.55],[.015,.09,.035],'navy',0);
  },{delay:.27});
  item(items,'scanner-light',[0,0,.65],m=>{stroke(m,[[.01,.55,-.36],[.01,1.66,-.36],[.01,1.66,.36],[.01,.55,.36]],{color:'blue',width:2.1})},{delay:.6,enter:'scan'});
 }
}
function aircraftMesh(m,mode){
 // A single top-plan silhouette extruded in world space. Nose points -Z.
 const shape=[[0,-1.5],[.095,-1.32],[.12,-.48],[1.13,.18],[1.13,.32],[.12,.04],[.08,.95],[.45,1.2],[.45,1.31],[.06,1.15],[0,1.33],[-.06,1.15],[-.45,1.31],[-.45,1.2],[-.08,.95],[-.12,.04],[-1.13,.32],[-1.13,.18],[-.12,-.48],[-.095,-1.32]];
 const upper=shape.map(([x,z])=>[x,.10,z]),lower=shape.map(([x,z])=>[x,-.025,z]);
 plane(m,upper,'white',[0,1,0]);plane(m,[...lower].reverse(),'pale',[0,-1,0]);
 for(let i=0;i<shape.length;i++){const j=(i+1)%shape.length;const n=norm([shape[j][1]-shape[i][1],0,shape[i][0]-shape[j][0]]);polygon(m,[lower[i],lower[j],upper[j],upper[i]],'pale',n)}
 if(mode==='solid'){
  const rings=[[-1.50,.006],[-1.36,.052],[-1.14,.103],[-.75,.119],[.1,.116],[.62,.087],[.98,.035],[1.18,.008]];
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<24;i++){
   const pts=[[j,i],[j,(i+1)%24],[j+1,(i+1)%24],[j+1,i]].map(([ri,ai])=>{const [z,r]=rings[ri],a=ai/24*Math.PI*2;return [Math.cos(a)*r,.11+Math.sin(a)*r*.78,z]});
   const z=(rings[j][0]+rings[j+1][0])/2;convexFace(m,pts,[0,.11,z],'white');
  }
 }else{stroke(m,[[0,.115,-1.37],[0,.115,1.13]],{color:'blue',width:.8})}
 for(const x of [-.44,.44])cylinder(m,[x,-.035,.08],.09,.43,'blue','z',24);
 stroke(m,[[-.05,.203,-1.0],[.05,.203,-1.0]],{color:'navy',width:2.3});
 plane(m,[[0,.17,.55],[0,.53,1.07],[0,.12,1.15]],'blue',[1,0,0]);
}
function vanMesh(m,mode){
 const b=mode==='solid'?.035:0;
 cuboid(m,[-.23,.63,0],[1.6,1.1,.82],'white',b);
 cuboid(m,[.84,.44,0],[.64,.74,.82],'pale',b);
 plane(m,[[.62,.62,.416],[1.1,.62,.416],[1.05,.89,.416],[.62,.89,.416]],'blue');
 for(const z of [-.44,.44])for(const x of [-.67,.82]){cylinder(m,[x,.19,z],.22,.13,'navy','z',32);cylinder(m,[x,.19,z+(z>0?.07:-.07)],.11,.015,'pale','z',24)}
 cuboid(m,[.0,.64,.417],[.009,.85,.008],'blue');
}
export function createProcessScene(index,mode='line'){
 const items=[];
 if(index===0){
  item(items,'order-screen',[-.45,0,-.35],m=>{
   cuboid(m,[0,1.15,0],[1.8,1.24,.1],'blue',mode==='solid'?.04:0);
   detail(m,[0,1.15,.058],()=>{plane(m,[[-.79,.66,.057],[.79,.66,.057],[.79,1.65,.057],[-.79,1.65,.057]],'white');});
   cuboid(m,[0,.38,0],[.12,.44,.12],'pale',.02);cuboid(m,[0,.14,.2],[.94,.075,.55],'pale',.02);
   detail(m,[0,1.15,.061],()=>{for(let i=0;i<3;i++){roundedLine(m,-.62,.91+i*.20,.061,1.05,.105,'blue',.9);stroke(m,[[-.53,.961+i*.20,.062],[-.02+i*.1,.961+i*.20,.062]],{color:'blue',width:1.8,delay:i*.08})}});
   cuboid(m,[0,.065,.83],[1.5,.065,.42],'ice',.015);
   for(let i=0;i<6;i++)stroke(m,[[-.54+i*.18,.102,.69],[-.54+i*.18,.102,.96]],{color:'blue',width:.65});
  },{delay:.02});
  packageItem(items,mode,[1.02,0,.59],[.78,.68,.67]);badge(items,[.68,1.62,.25],mode);
 }else if(index===1||index===9){
  door(items,mode,{end:index===9});const parcel=packageItem(items,mode,[.45,0,.67],[1.08,.86,.85]);parcel.motion=index===9?'delivery':'pickup';
  if(index===9)badge(items,[1.05,1.31,.55],mode);else item(items,'pickup-ticket',[.8,1.35,-.2],m=>{cuboid(m,[0,0,0],[.7,.42,.05],'white',.02);label(m,[0,0,.03],.58,.32)},{delay:.55});
 }else if(index===2||index===8){
  warehouse(items,mode,index===8);
  if(index===8)item(items,'last-mile-van',[1.52,.04,-.15],m=>vanMesh(m,mode),{delay:.43,scale:.46});
 }else if(index===3||index===7){
  item(items,'customs-document',index===3?[-.72,.07,.60]:[-.72,.02,-.35],m=>documentMesh(m,mode),{delay:.02,pitch:index===3?-Math.PI/2:0});
  packageItem(items,mode,[.7,0,.64],[.89,.72,.74]);
  if(index===3){
   item(items,'stamp',[-.72,.17,-.18],m=>{cuboid(m,[0,0,0],[.62,.12,.42],'blue',.025);cylinder(m,[0,.18,0],.07,.3,'pale');cuboid(m,[0,.37,0],[.32,.12,.18],'navy',.035)},{delay:.40,enter:'stamp'});
   item(items,'customs-imprint',[-.72,.113,-.18],m=>{
    detail(m,[0,0,-.08],()=>{
     stroke(m,[[-.25,0,-.14],[.25,0,-.14],[.25,0,.14],[-.25,0,.14],[-.25,0,-.14]],{color:'navy',width:1.3});
     stroke(m,[[-.12,0,0],[-.03,0,.07],[.13,0,-.08]],{color:'navy',width:2.1});
    });
   },{delay:.70,enter:'imprint'});
   badge(items,[-1.10,.87,-.25],mode);
  }else{
   item(items,'scanner',[1.25,1.12,-.26],m=>{cuboid(m,[0,0,0],[.22,.5,.23],'navy',.04);cuboid(m,[0,.3,.08],[.49,.22,.36],'blue',.04);plane(m,[[-.19,.25,.263],[.19,.25,.263],[.19,.36,.263],[-.19,.36,.263]],'white')},{delay:.3,enter:'scanner'});
   badge(items,[-.26,.58,-.25],mode);
  }
 }else if(index===4||index===6){
  terminal(items,mode,index===6);
  if(index===4)item(items,'mini-aircraft',[-.64,1.94,-.65],m=>aircraftMesh(m,mode),{delay:.42,scale:.32,rotate:.25});
 }else if(index===10){
  // A compact protected-cargo emblem for the homepage service card.
  packageItem(items,mode,[-.3,0,.05],[1.45,1.13,1.19]);
  item(items,'cargo-shield',[.65,.02,.95],m=>{
   const outline=[[0,1.58],[.48,1.36],[.43,.64],[0,.23],[-.43,.64],[-.48,1.36]];
   const back=outline.map(([x,y])=>[x,y,-.045]),front=outline.map(([x,y])=>[x,y,.045]);
   const center=[0,.95,0];
   convexFace(m,front,center,'blue');convexFace(m,back,center,'blue');
   for(let i=0;i<outline.length;i++){const j=(i+1)%outline.length;convexFace(m,[front[i],front[j],back[j],back[i]],center,'pale')}
   detail(m,[0,.95,.046],()=>stroke(m,[[-.21,.97,.05],[-.04,.8,.05],[.23,1.12,.05]],{color:'navy',width:2.3,delay:.2}));
  },{delay:.28,enter:'draw'});
 }else if(index===5){
  item(items,'runway',[0,.01,0],m=>{cuboid(m,[0,0,0],[.54,.035,3.2],'pale',.015);for(let i=0;i<7;i++)stroke(m,[[0,.021,-1.35+i*.43],[0,.021,-1.12+i*.43]],{color:'white',width:2.5})},{delay:.02});
  item(items,'aircraft',[0,1.2,0],m=>aircraftMesh(m,mode),{delay:.2,enter:'flight',scale:1.26,rotate:.12});
  item(items,'route',[-.3,.09,0],m=>{
   const points=[];for(let i=0;i<=60;i++){const a=i/60*Math.PI*1.55-.4;points.push([Math.cos(a)*1.7,.02,Math.sin(a)*1.7])}stroke(m,points,{color:'blue',width:1.0,dash:true});
  },{delay:.45,enter:'draw'});
 }
 return {index,items,focus:index===5?[0,.75,0]:[0,.8,0],label:['Заявка','От двери отправителя','Подготовка','Экспорт','Терминал убытия','Международный маршрут','Терминал прибытия','Импорт','Последняя миля','До двери получателя'][index]};
}
export function itemPose(item,p,mode='line'){
 const t=phase(p,item.delay,Math.min(.98,item.delay+.32));
 let offset=[0,0,0],scale=item.scale??1,alpha=1,rotation=item.rotate??0,draw=t;
 if(mode==='solid'){
  alpha=phase(p,item.delay,item.delay+.16);scale*=lerp(.76,1,t);offset[1]=lerp(.42,0,t);rotation+=lerp(-.16,0,t);
 }
 if(item.enter==='parcel'){alpha=1;scale=item.scale??1;draw=1;offset[1]=0;rotation=item.rotate??0}
 if(item.enter==='stamp'){
  const down=phase(p,.50,.69),up=phase(p,.72,.88);offset[1]+=.64*(1-down)+.20*up;
 }
 if(item.enter==='flight'){offset[1]+=lerp(-.65,0,phase(p,.28,.9));offset[2]+=lerp(.5,-.15,phase(p,.28,.94));rotation+=lerp(-.18,0,phase(p,.3,.94))}
 if(item.enter==='imprint'){alpha=phase(p,.7,.73);scale=1;offset=[0,0,0];rotation=0}
 if(item.enter==='door'){rotation-=.68*phase(p,.3,.8)}
 if(item.motion==='conveyor'){offset[0]=lerp(-1.8,0,phase(p,.12,.9));}
 if(item.motion==='pickup'){offset[0]=lerp(-.55,0,phase(p,.35,.90));}
 if(item.motion==='delivery'){offset[0]=lerp(.65,0,phase(p,.32,.90));}
 if(item.enter==='badge'){scale*=lerp(.6,1,t);draw=phase(p,item.delay+.04,Math.min(1,item.delay+.25))}
 if(item.enter==='scan'){alpha=Math.sin(Math.PI*phase(p,.57,.86));draw=1}
 return {position:add(item.position,offset),scale,rotation,pitch:item.pitch??0,alpha,draw};
}
export function rotatePoint(p,rotation=0,pitch=0){if(pitch){const c=Math.cos(pitch),s=Math.sin(pitch);p=[p[0],p[1]*c-p[2]*s,p[1]*s+p[2]*c]}const co=Math.cos(rotation),si=Math.sin(rotation);return[p[0]*co+p[2]*si,p[1],-p[0]*si+p[2]*co]}
export function viewPoint(point,{yaw=.57,elevation=.43,scale=144,cx=450,cy=430}={}){
 const co=Math.cos(yaw),si=Math.sin(yaw),ce=Math.cos(elevation),se=Math.sin(elevation);
 const x=point[0]*co-point[2]*si,z=point[0]*si+point[2]*co;
 return [cx+x*scale,cy+(-point[1]*ce+z*se)*scale,point[1]*se+z*ce];
}
export function faceVisible(normal,yaw,elevation){return dot(normal,[Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation)])>.001}
