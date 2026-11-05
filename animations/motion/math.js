export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
export const phase=(p,a,b)=>ease((p-a)/(b-a));
export const mix=(a,b,t)=>a+(b-a)*t;
// Project a unit rectangle into a perspective quadrilateral, with fixed corners.
export function homography(q){
 const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=q;
 const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3;
 const dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
 const den=dx1*dy2-dx2*dy1;
 const g=(dx3*dy2-dx2*dy3)/den,h=(dx1*dy3-dx3*dy1)/den;
 return [x1-x0+g*x1,x3-x0+h*x3,x0,y1-y0+g*y1,y3-y0+h*y3,y0,g,h];
}
export function project(H,u,v,z=0){const d=H[6]*u+H[7]*v+1;return[(H[0]*u+H[1]*v+H[2])/d,(H[3]*u+H[4]*v+H[5]-z*470)/d]}
export function flap(H,side,angle){
 if(side==='left'||side==='right'){
  const left=side==='left',hinge=left?0:1;
  const u=hinge+(left?1:-1)*Math.cos(angle)*.18;
  const z=Math.sin(angle)*.29;
  return[project(H,hinge,0),project(H,hinge,1),project(H,u,1,z),project(H,u,0,z)];
 }
 const co=Math.cos(angle)*.5,si=Math.sin(angle)*.5;
 if(side==='rear')return[project(H,0,0),project(H,1,0),project(H,1,co,si),project(H,0,co,si)];
 return[project(H,0,1),project(H,1,1),project(H,1,1-co,si),project(H,0,1-co,si)];
}

// Each tape pass starts once its preceding surface or layer is in place.
export function packingFrame(p){
 return {
  left: mix(1.72,0,phase(p,.07,.25)),
  right: mix(1.8,0,phase(p,.11,.30)),
  rear: mix(1.76,0,phase(p,.31,.51)),
  front: mix(2.22,0,phase(p,.38,.59)),
  along: phase(p,.60,.71),
  across: phase(p,.72,.83),
  paper: phase(p,.84,.92),
  ink: phase(p,.92,1)
 };
}

// Each leg reaches its destination before the corresponding checkmark appears.
export function trackingFrame(p){
 const legs=[[.10,.23],[.28,.41],[.46,.59],[.64,.79]];
 return {
  lines:legs.map(([start,end])=>phase(p,start,end)),
  checks:[phase(p,.015,.09),...legs.map(([,end],i)=>phase(p,end,end+(i===3?.075:.048)))],
  delivered:phase(p,.865,.97)
 };
}
