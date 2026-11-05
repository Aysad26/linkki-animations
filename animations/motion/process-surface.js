// Hidden-surface rendering for the process miniatures. Faces and linework use
// the same per-pixel depth buffer, so rear edges cannot show through a parcel.
const edgeCache=new WeakMap();
const key=p=>p.map(v=>Math.round(v*1e6)).join(',');
export function featureEdges(geometry){
 if(edgeCache.has(geometry))return edgeCache.get(geometry);
 const edges=new Map();
 for(const face of geometry.faces){
  if(face.decal)continue;
  face.points.forEach((a,i)=>{
   const b=face.points[(i+1)%face.points.length],ka=key(a),kb=key(b),id=ka<kb?ka+'|'+kb:kb+'|'+ka;
   if(!edges.has(id))edges.set(id,{points:[a,b],faces:[]});
   edges.get(id).faces.push(face);
  });
 }
 const result=[...edges.values()];edgeCache.set(geometry,result);return result;
}
export function edgeVisible(edge,normalVisible){
 const front=edge.faces.filter(face=>normalVisible(face.normal));
 if(!front.length)return false;
 if(edge.faces.length===1||front.length!==edge.faces.length)return true;
 // Keep real corners; suppress the tiny angular steps of cylindrical surfaces.
 return edge.faces.some((face,i)=>edge.faces.slice(i+1).some(other=>
  face.normal.reduce((sum,v,k)=>sum+v*other.normal[k],0)<Math.cos(Math.PI/6)));
}
const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function triangulate(points){
 if(points.length===3)return [[0,1,2]];
 const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1]},0);
 if(Math.abs(area)<1e-8)return [];
 const sign=area>0?1:-1,ids=points.map((_,i)=>i),triangles=[];
 if(points.every((p,i)=>cross2(points[(i+points.length-1)%points.length],p,points[(i+1)%points.length])*sign>=-1e-8))
  return points.slice(2).map((_,i)=>[0,i+1,i+2]);
 for(let guard=0;ids.length>3&&guard<points.length*points.length;guard++){
  let found=false;
  for(let j=0;j<ids.length;j++){
   const a=ids[(j+ids.length-1)%ids.length],b=ids[j],c=ids[(j+1)%ids.length];
   if(cross2(points[a],points[b],points[c])*sign<1e-9)continue;
   const inside=ids.some(k=>k!==a&&k!==b&&k!==c&&
    cross2(points[a],points[b],points[k])*sign>1e-8&&
    cross2(points[b],points[c],points[k])*sign>1e-8&&
    cross2(points[c],points[a],points[k])*sign>1e-8);
   if(inside)continue;
   triangles.push([a,b,c]);ids.splice(j,1);found=true;break;
  }
  if(!found)break;
 }
 if(ids.length===3)triangles.push([...ids]);
 return triangles;
}
const mix=(a,b,t)=>a+(b-a)*t;
function vertex(data,p,color,edge=0,radius=100){data.push(p[0]/450-1,1-p[1]/337.5,-p[2]/16,...color,edge,radius)}
export function faceVertices(pieces,colorFor){
 const data=[];
 for(const piece of pieces){
  if(piece.type!=='face')continue;
  const color=colorFor(piece);
  for(const ids of triangulate(piece.points))for(const i of ids)vertex(data,piece.points[i],color);
 }
 return new Float32Array(data);
}
function segment(data,a,b,color,width){
 const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<.01)return;
 const radius=width/2,pad=radius+.7,nx=-dy/length*pad,ny=dx/length*pad;
 // A tiny outline offset keeps subpixel strokes above their own sloping
 // surfaces; it is far smaller than the separation between physical objects.
 const bias=.007;
 const corners=[[a[0]+nx,a[1]+ny,a[2]+bias],[a[0]-nx,a[1]-ny,a[2]+bias],
  [b[0]+nx,b[1]+ny,b[2]+bias],[b[0]-nx,b[1]-ny,b[2]+bias]];
 for(const i of [0,1,2,2,1,3])vertex(data,corners[i],color,i%2?-pad:pad,radius);
}
export function lineVertices(pieces,colorFor){
 const data=[];
 for(const piece of pieces){
  if(piece.type!=='line'||piece.draw<=0)continue;
  const pts=piece.points,lengths=pts.slice(1).map((p,i)=>Math.hypot(p[0]-pts[i][0],p[1]-pts[i][1]));
  let remaining=lengths.reduce((s,v)=>s+v,0)*Math.min(1,piece.draw),offset=0;
  const color=colorFor(piece);
  for(let i=0;i<lengths.length&&remaining>0;i++){
   const len=lengths[i],end=Math.min(len,remaining),a=pts[i],b=pts[i+1];
   const at=t=>a.map((v,k)=>mix(v,b[k],len?t/len:0));
   if(piece.dash){
    // Integer dash indices avoid an infinitesimal floating-point remainder
    // stalling an animation frame at a period boundary.
    const first=Math.floor(offset/13),last=Math.floor((offset+end)/13);
    for(let dash=first;dash<=last;dash++){
     const start=Math.max(0,dash*13-offset),stop=Math.min(end,dash*13+6-offset);
     if(stop>start)segment(data,at(start),at(stop),color,piece.width);
    }
   }else segment(data,a,at(end),color,piece.width);
   remaining-=len;offset+=len;
  }
 }
 return new Float32Array(data);
}
function compile(gl,type,source){
 const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;
}
export class DepthSurface{
 constructor(){
  this.canvas=document.createElement('canvas');
  const gl=this.canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true,depth:true});
  this.gl=gl;
  if(!gl){this.software=this.canvas.getContext('2d');return;}
  const program=gl.createProgram();
  gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,`
   attribute vec3 a_position;attribute vec3 a_color;attribute vec2 a_edge;
   varying vec3 v_color;varying vec2 v_edge;
   void main(){gl_Position=vec4(a_position,1.0);v_color=a_color;v_edge=a_edge;}`));
  gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,`
   precision mediump float;varying vec3 v_color;varying vec2 v_edge;
   void main(){float a=1.0-smoothstep(v_edge.y-0.4,v_edge.y+0.6,abs(v_edge.x));
    if(a<0.01)discard;gl_FragColor=vec4(v_color*a,a);}`));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  this.program=program;this.buffer=gl.createBuffer();
  this.attributes=['a_position','a_color','a_edge'].map(name=>gl.getAttribLocation(program,name));
 }
 draw(faces,lines,width,height){
  const canvas=this.canvas;if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  if(!this.gl){this.drawSoftware(faces,lines,width,height);return canvas;}
  const gl=this.gl;gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.depthMask(true);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  this.attributes.forEach((id,i)=>{gl.enableVertexAttribArray(id);gl.vertexAttribPointer(id,i===2?2:3,gl.FLOAT,false,32,[0,12,24][i])});
  gl.bufferData(gl.ARRAY_BUFFER,faces,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,faces.length/8);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  gl.bufferData(gl.ARRAY_BUFFER,lines,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,lines.length/8);
  gl.depthMask(true);return canvas;
 }
 // Correct occlusion also survives disabled/unavailable WebGL. This is used only
 // as a fallback; both paths consume identical triangles and depth coordinates.
 drawSoftware(faces,lines,width,height){
  const image=this.software.createImageData(width,height),pixels=image.data;
  const depths=new Float32Array(width*height);depths.fill(Infinity);
  for(const [data,isLine] of [[faces,false],[lines,true]])for(let t=0;t<data.length;t+=24){
   const v=[0,8,16].map(i=>[(data[t+i]+1)*width/2,(1-data[t+i+1])*height/2,data[t+i+2],...data.slice(t+i+3,t+i+8)]);
   const area=cross2(v[0],v[1],v[2]);if(Math.abs(area)<.001)continue;
   const minX=Math.max(0,Math.floor(Math.min(v[0][0],v[1][0],v[2][0]))),maxX=Math.min(width-1,Math.ceil(Math.max(v[0][0],v[1][0],v[2][0])));
   const minY=Math.max(0,Math.floor(Math.min(v[0][1],v[1][1],v[2][1]))),maxY=Math.min(height-1,Math.ceil(Math.max(v[0][1],v[1][1],v[2][1])));
   const ux=(v[1][1]-v[2][1])/area,uy=(v[2][0]-v[1][0])/area;
   const wx=(v[0][1]-v[1][1])/area,wy=(v[1][0]-v[0][0])/area;
   let rowU=cross2(v[1],v[2],[minX+.5,minY+.5])/area,rowW=cross2(v[0],v[1],[minX+.5,minY+.5])/area;
   const z0=v[1][2],zu=v[0][2]-z0,zw=v[2][2]-z0;
   const e0=v[1][6],eu=v[0][6]-e0,ew=v[2][6]-e0,radius=v[0][7];
   const red=v[0][3]*255,green=v[0][4]*255,blue=v[0][5]*255;
   for(let y=minY;y<=maxY;y++,rowU+=uy,rowW+=wy){
    let u=rowU,w=rowW,index=y*width+minX;
    for(let x=minX;x<=maxX;x++,u+=ux,w+=wx,index++){
     if(u<-.000001||w<-.000001||u+w>1.000001)continue;
     const z=z0+u*zu+w*zw;if(z>depths[index]+1e-7)continue;
     const k=index*4;
     if(!isLine){pixels[k]=red;pixels[k+1]=green;pixels[k+2]=blue;pixels[k+3]=255;depths[index]=z;continue;}
     let a=Math.max(0,Math.min(1,radius+.6-Math.abs(e0+u*eu+w*ew)));a=a*a*(3-2*a);if(a<.01)continue;
     const oldAlpha=pixels[k+3]/255,outAlpha=a+oldAlpha*(1-a),old=oldAlpha*(1-a);
     pixels[k]=(red*a+pixels[k]*old)/outAlpha;pixels[k+1]=(green*a+pixels[k+1]*old)/outAlpha;pixels[k+2]=(blue*a+pixels[k+2]*old)/outAlpha;pixels[k+3]=outAlpha*255;
    }
   }
  }
  this.software.putImageData(image,0,0);
 }
}
