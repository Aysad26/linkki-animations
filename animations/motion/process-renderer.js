import {createProcessScene,itemPose,rotatePoint,viewPoint,faceVisible,palette,phase,lerp,clamp} from './process-models.js';
import {DepthSurface,featureEdges,edgeVisible,faceVertices,lineVertices} from './process-surface.js';
const WIDTH=900,HEIGHT=675;
const mix3=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
const hex=hex=>hex.replace('#','').match(/../g).map(v=>parseInt(v,16));
function tone(color,light){return hex(palette[color]||color).map(v=>(light>=1?lerp(v,255,Math.min(.22,light-1)):v*light)/255)}
const modelCache=new Map();
export function model(index,style){const key=index+style;if(!modelCache.has(key))modelCache.set(key,createProcessScene(index,style));return modelCache.get(key)}
function traced(c,points,progress,closed=false){
 if(progress<=0)return;const pts=closed?[...points,points[0]]:points;
 const lengths=pts.slice(1).map((p,i)=>Math.hypot(p[0]-pts[i][0],p[1]-pts[i][1]));
 let left=lengths.reduce((a,b)=>a+b,0)*clamp(progress);c.beginPath();c.moveTo(pts[0][0],pts[0][1]);
 for(let i=0;i<lengths.length;i++){const t=Math.min(1,left/(lengths[i]||1));c.lineTo(lerp(pts[i][0],pts[i+1][0],t),lerp(pts[i][1],pts[i+1][1],t));left-=lengths[i];if(left<=0)break}c.stroke();
}
export class ProcessRenderer{
 constructor(canvas,style='line',options={}){
  this.canvas=canvas;this.context=canvas.getContext('2d',{alpha:false});this.style=style;this.index=0;this.previous=null;this.progress=0;this.surface=new DepthSurface();
  this.options=options;this.background=options.background||(style==='solid'?'#213b65':'#edf3f9');
 }
 resize(width){
  const css=width??this.canvas.getBoundingClientRect().width;
  const ratio=this.surface.gl?Math.min(devicePixelRatio||1,2):2;
  const w=Math.max(1,Math.round(Math.min(this.surface.gl?1800:900,css*ratio)));
  if(w===this.canvas.width)return;this.canvas.width=w;this.canvas.height=Math.round(w*HEIGHT/WIDTH);this.render(this.progress);
 }
 setScene(index,previous=null){this.index=index;this.previous=previous;this.render(0)}
 render(progress){
  this.progress=clamp(progress);const p=this.progress,c=this.context,solid=this.style==='solid';
  c.setTransform(this.canvas.width/WIDTH,0,0,this.canvas.height/HEIGHT,0,0);
  c.globalAlpha=1;c.shadowBlur=0;c.setLineDash([]);c.lineJoin='round';c.lineCap='round';
  c.fillStyle=this.background;c.fillRect(0,0,WIDTH,HEIGHT);
  const entry=phase(p,0,.72);
  const view={yaw:solid?lerp(.81,.57,entry):.57,elevation:solid?.48:.45,scale:178*(solid?lerp(.92,1,entry):1),cx:450,cy:468};
  if (this.options.compact) {
   view.scale = 190;
   view.cy = 500;
  } else if (!this.options.bare) {
   this.backdrop(c, view, p);
  }
  const incoming=model(this.index,this.style),outgoing=this.previous===null?null:model(this.previous,this.style);
  const pieces=[];
  if(outgoing&&this.previous!==this.index&&p<.25){
   const out=1-phase(p,0,.25);
   this.collect(outgoing,1,view,pieces,{alpha:out,exit:1-out,omitParcel:true});
  }
  this.collect(incoming,p,view,pieces,{old:outgoing});
  // Preserve a continuous hairline at phone sizes instead of subpixel dashes.
  const cssWidth=this.canvas.getBoundingClientRect().width||WIDTH;
  const minimumStroke=(this.options.compact?1:solid?.65:.85)*WIDTH/Math.max(this.options.compact?120:240,cssWidth);
  for(const piece of pieces)if(piece.type==='line')piece.width=Math.max(piece.width,minimumStroke);
  const faces=faceVertices(pieces,piece=>this.color(piece));
  const lines=lineVertices(pieces,piece=>this.color(piece));
  c.drawImage(this.surface.draw(faces,lines,this.canvas.width,this.canvas.height),0,0,WIDTH,HEIGHT);
  c.globalAlpha=1;c.setLineDash([]);
  if(!solid&&!this.options.compact&&!this.options.bare)this.annotations(c,incoming.label,p);
 }
 backdrop(c,view,p){
  const solid=this.style==='solid';c.save();
  if(solid){
   const gradient=c.createRadialGradient(460,280,10,450,350,370);gradient.addColorStop(0,'#3d5a813b');gradient.addColorStop(1,'#213b6500');c.fillStyle=gradient;c.fillRect(0,0,900,675);
   c.translate(450,482);c.scale(1,.28);const g=c.createRadialGradient(0,0,10,0,0,230);g.addColorStop(0,'#1127475c');g.addColorStop(.6,'#122a4a22');g.addColorStop(1,'#122a4a00');c.fillStyle=g;c.beginPath();c.arc(0,0,230,0,Math.PI*2);c.fill();c.restore();
   c.save();c.globalAlpha=.18;c.strokeStyle='#aac3de';c.lineWidth=1;c.beginPath();c.ellipse(450,480,285,98,0,0,Math.PI*2);c.stroke();
  }else{
   c.strokeStyle='#b5c9df';c.lineWidth=.75;c.globalAlpha=.32;
   for(let i=-3;i<=3;i++)for(const axis of [0,2]){const a=[-2.4,0,-2.4],b=[2.4,0,2.4];a[axis]=b[axis]=i*.8;traced(c,[viewPoint(a,view),viewPoint(b,view)],phase(p,0,.36))}
  }
  c.restore();
 }
 collect(scene,p,view,pieces,{alpha=1,exit=0,old=null,omitParcel=false}={}){
  for(const item of scene.items){
   if(omitParcel&&item.key==='shipment')continue;
   const pose=itemPose(item,p,this.style);pose.alpha*=alpha;if(pose.alpha<.001)continue;
   if(exit){pose.position[1]-=exit*.28;pose.scale*=1-exit*.08;pose.rotation-=exit*.12}
   const oldParcel=old?.items.find(o=>o.key==='shipment');
   if(item.key==='shipment'&&!item.motion&&oldParcel&&old.index!==scene.index){
    const t=phase(p,0,.67);pose.position=mix3(oldParcel.position,item.position,t);pose.position[1]+=Math.sin(Math.PI*t)*.30;
    pose.scale=lerp(oldParcel.size[0]/item.size[0],1,t);
   }
   const transform=pt=>{const rot=rotatePoint(pt.map(v=>v*pose.scale),pose.rotation,pose.pitch);return rot.map((v,k)=>v+pose.position[k])};
   const toScreen=pt=>viewPoint(transform(pt),view);
   const entrance=this.style==='line'?phase(p,item.delay,Math.min(1,item.delay+.24)):pose.alpha;
   for(const [i,face] of item.geometry.faces.entries()){
    const normal=rotatePoint(face.normal,pose.rotation,pose.pitch);
    if(!faceVisible(normal,view.yaw,view.elevation))continue;
    const pts=face.points.map(toScreen);
    pieces.push({type:'face',points:pts,normal,color:face.color,decal:face.decal,alpha:pose.alpha,fill:item.key==='shipment'&&!this.options.compact?1:entrance});
   }
   if(this.style==='line')for(const [i,edge] of featureEdges(item.geometry).entries()){
    if(!edgeVisible(edge,n=>faceVisible(rotatePoint(n,pose.rotation,pose.pitch),view.yaw,view.elevation)))continue;
    const face=edge.faces[0],draw=item.key==='shipment'&&!this.options.compact?1:phase(p,item.delay+(i%4)*.018,Math.min(1,item.delay+.32+(i%4)*.018));
    pieces.push({type:'line',points:edge.points.map(toScreen),color:face.color==='white'?'#7896b7':'#486e9b',width:face.color==='navy'?1.8:1.4,draw,alpha:pose.alpha});
   }
   for(const ln of item.geometry.lines){
    const pts=ln.points.map(toScreen);
    const draw=phase(p,item.delay+ln.delay,Math.min(1,item.delay+ln.delay+.26));
    pieces.push({type:'line',points:pts,alpha:pose.alpha,color:this.style==='line'&&ln.color==='white'?'#6586ad':ln.color,width:ln.width*(this.style==='solid'?1.15:1.3),draw:item.key==='shipment'&&!this.options.compact?1:draw,dash:ln.dash});
   }
  }
 }
 color(piece){
  const solid=this.style==='solid',background=hex(this.background).map(v=>v/255);
  let color;
  if(piece.type==='face'){
   if(solid){const n=piece.normal;color=tone(piece.color,.73+Math.max(0,n[0]*-.30+n[1]*.86+n[2]*.41)*.42)}
   else if(this.options.dark){
    // Opaque, quiet blue planes keep rear edges hidden. Light contours carry
    // the form directly on the homepage's dark section, without a pale plate.
    const shades=piece.decal?{navy:'#c3d7ed',blue:'#7e9dc0',pale:'#48668f',white:'#2d4b78'}:{navy:'#294674',blue:'#2b4977',pale:'#294571',ice:'#25416d',white:'#2c4a77'};
    color=hex(shades[piece.color]||'#2a4774').map(v=>v/255);
   }
   else color=hex(piece.decal?(palette[piece.color]||piece.color):piece.color==='navy'?'#dde8f5':piece.color==='blue'?'#e6eff8':'#f5f8fc').map(v=>v/255);
  }else if(this.options.dark&&!solid)color=hex(piece.color==='navy'||piece.color==='white'?'#eef5fd':'#b9d0ea').map(v=>v/255);
  else color=hex(palette[piece.color]||piece.color).map(v=>v/255);
  // Fade the surface colour, not its opacity: hidden lines stay hidden during
  // the entrance as well as in the final frame.
  const opacity=piece.alpha*(piece.type==='face'&&!solid?piece.fill:1);
  return color.map((v,i)=>lerp(background[i],v,opacity));
 }
 annotations(c,label,p){
  c.save();c.globalAlpha=phase(p,.40,.82);c.strokeStyle='#9eb5ce';c.lineWidth=1;
  const marks=[[[68,157],[68,132],[93,132]],[[808,132],[833,132],[833,157]],[[68,514],[68,539],[93,539]],[[808,539],[833,539],[833,514]]];
  marks.forEach(pts=>traced(c,pts,1));
  c.fillStyle='#7290b0';c.font='400 12px Onest, sans-serif';c.fillText('LINKKI / СХЕМА ДОСТАВКИ',69,590);
  c.textAlign='right';c.fillText(String(this.index+1).padStart(2,'0')+' / 10',832,590);c.restore();
 }
}
