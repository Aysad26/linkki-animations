import { clamp, ease, interval } from './motion.js';

const RAD = Math.PI / 180;
const CAMERA = 4.8, CAMERA_K = Math.sqrt(CAMERA * CAMERA - 1);
const frontDepth = rr => (CAMERA * rr + CAMERA_K * CAMERA_K * Math.sqrt(Math.max(0, 1 - rr))) / (CAMERA_K * CAMERA_K + rr);
export const MOSCOW = Object.freeze([37.6173, 55.7558]);
// Follow the fan from upper left around the lower hemisphere to the east.
// Each route has the same turn direction; the launch angles keep near bearings apart.
export const ROUTE_GUIDES = [
  [[-79.38, 43.65], 26],   // Toronto
  [[-.13, 51.51], 26],     // London
  [[-46.63, -23.55], 22],  // São Paulo
  [[18.42, -33.93], 27],   // Cape Town
  [[55.27, 25.20], 20],    // Dubai
  [[77.21, 28.61], 26],    // Delhi
  [[151.21, -33.87], 26],  // Sydney
  [[121.47, 31.23], 17]    // Shanghai
];
const HUB = MOSCOW;
const DESTINATIONS = ROUTE_GUIDES.map(([point])=>point);
const vector = ([lon, lat]) => [Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lon * RAD)];
const sampleGrid = (n, point) => Array.from({length:n+1},(_,i)=>vector(point(i/n)));
const GRID = [
  ...Array.from({length:12},(_,i)=>sampleGrid(120,t=>[i*30,-90+t*180])),
  ...Array.from({length:11},(_,i)=>sampleGrid(240,t=>[-180+t*360,-75+i*15]))
];
export function project(point, longitude = 33, latitude = 24) {
  const [x, y, z] = point;
  const lon = longitude * RAD, lat = latitude * RAD;
  const east = x * Math.cos(lon) - z * Math.sin(lon);
  const forward = x * Math.sin(lon) + z * Math.cos(lon);
  return [east, y * Math.cos(lat) - forward * Math.sin(lat), y * Math.sin(lat) + forward * Math.cos(lat)];
}
export function arcPoint(from, to, t, height = .17) {
  const a = vector(from), b = vector(to);
  const angle = Math.acos(clamp(a.reduce((sum, n, i) => sum + n * b[i], 0), -1, 1));
  const den = Math.sin(angle) || 1;
  const scale = 1 + Math.sin(Math.PI * t) * height;
  return a.map((n, i) => (n * Math.sin((1 - t) * angle) + b[i] * Math.sin(t * angle)) / den * scale);
}

export function globeView(progress, entrance=false) {
  const t=entrance?interval(progress,.02,.86):1-Math.pow(1-interval(progress,0,.93),2.6);
  return {turn:t, longitude:MOSCOW[0]+(entrance?51:44)*(1-t), latitude:MOSCOW[1]-(entrance?30:24)*(1-t)};
}

export function makeRoute(to, sweep) {
  const a=vector(MOSCOW), b=vector(to);
  const cosine=clamp(a.reduce((sum,n,i)=>sum+n*b[i],0),-1,1),angle=Math.acos(cosine);
  const tangent=b.map((n,i)=>(n-a[i]*cosine)/(Math.sin(angle)||1));
  const side=[a[1]*tangent[2]-a[2]*tangent[1],a[2]*tangent[0]-a[0]*tangent[2],a[0]*tangent[1]-a[1]*tangent[0]];
  return Array.from({length:129},(_,i)=>{
    if(i===0)return a;
    if(i===128)return b;
    const t=i/128,along=angle*t;
    const bend=-sweep*RAD*Math.pow(1-t,1.18);
    const radius=1+Math.sin(Math.PI*t)*(.043+angle*.047);
    return a.map((n,k)=>radius*(n*Math.cos(along)+
      Math.sin(along)*(tangent[k]*Math.cos(bend)+side[k]*Math.sin(bend))));
  });
}

export function projectRoutePoint(v, longitude, latitude) {
  const [x,y,z]=project(v,longitude,latitude), scale=CAMERA_K/(CAMERA-z);
  const u=x*scale,w=y*scale,rr=u*u+w*w;
  return {u,w,visible:rr>=1 || z>=frontDepth(rr)-.001};
}
const between=(a,b,t)=>a.map((n,k)=>n+(b[k]-n)*t);

const VERTEX = `attribute vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;
const FRAGMENT = `precision highp float;
uniform vec2 center;
uniform float radius;
uniform float longitude;
uniform float latitude;
uniform float perspective;
uniform sampler2D land;
const float PI=3.14159265359;
void main(){
  vec2 p=(gl_FragCoord.xy-center)/radius;
  float rr=dot(p,p);
  if(rr>1.0) discard;
  vec3 n=vec3(p,sqrt(max(0.0,1.0-rr)));
  if(perspective>.5){
    const float d=4.8, k2=d*d-1.0;
    float z=(d*rr+k2*n.z)/(k2+rr);
    n=vec3(p*(d-z)/sqrt(k2),z);
  }
  float wy=n.y*cos(latitude)+n.z*sin(latitude);
  float az=n.z*cos(latitude)-n.y*sin(latitude);
  float lon=atan(n.x,az)+longitude;
  float lat=asin(clamp(wy,-1.0,1.0));
  vec2 uv=vec2(fract(lon/(2.0*PI)+.5),.5-lat/PI);
  float mask=texture2D(land,uv).r;
  float edge=abs(mask-texture2D(land,uv+vec2(.00065,0.0)).r)+abs(mask-texture2D(land,uv+vec2(0.0,.0013)).r);
  vec3 ocean=vec3(.90,.946,.990);
  vec3 continent=vec3(.65,.757,.899);
  vec3 base=mix(ocean,continent,mask);
  float diffuse=max(0.0,dot(n,normalize(vec3(-.45,.7,1.35))));
  base=mix(vec3(.58,.68,.83),base,.65+.35*diffuse);
  float highlight=pow(max(0.0,dot(n,normalize(vec3(-.38,.48,1.0)))),22.0);
  base=mix(base,vec3(.98,.991,1.0),highlight*.22);
  base=mix(base,vec3(.44,.57,.76),min(edge*.16,.23));
  float rim=smoothstep(.965,.998,rr);
  base=mix(base,vec3(.64,.75,.90),rim*.40);
  if(perspective>.5){
    vec3 water=vec3(.917,.958,.995);
    vec3 terrain=vec3(.60,.726,.876);
    vec3 ink=vec3(.27,.42,.62);
    vec3 key=normalize(vec3(-.63,.69,.66));
    float light=max(dot(n,key),0.0);
    base=mix(ink,mix(water,terrain,mask),.39+.61*pow(light,.65));
    base=mix(base,vec3(.99,.997,1.0),pow(max(dot(n,normalize(vec3(-.40,.47,1.0))),0.0),12.0)*.37);
    base=mix(base,ink,min(edge*.11,.15));
    float fresnel=pow(1.0-sqrt(max(0.0,1.0-rr)),3.6);
    base=mix(base,vec3(.71,.84,.99),fresnel*(.26+.38*light));
    base=mix(base,vec3(.82,.91,.99),rim*.19);
  }
  float alpha=1.0-smoothstep(1.0-1.8/radius,1.0,rr);
  gl_FragColor=vec4(base,alpha);
}`;

export class GlobeScene {
  constructor(element, { dimensional = false, entrance = false, showGrid = true, showHubLabel = true } = {}) {
    this.element = element;
    this.dimensional = dimensional;
    this.entrance = entrance;
    this.showGrid = showGrid;
    this.showHubLabel = showHubLabel;
    this.surface = element.querySelector('.globe-surface');
    this.overlay = element.querySelector('.globe-routes');
    this.ctx = this.overlay.getContext('2d');
    this.progress = 0;
    this.paths = ROUTE_GUIDES.map(([to,sweep])=>makeRoute(to,sweep));
    this.gl = this.surface.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (this.gl) this.setupGL();
    else { this.element.dataset.globeFallbackReason = 'webgl-unavailable'; this.setupFallback(); }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(element);
    this.ready = this.prepareLand().then(() => { this.loaded = true; this.resize(); });
  }
  setupGL() {
    const gl = this.gl;
    const compile = (type, source) => {
      const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    try {
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Globe shader link failed');
      gl.useProgram(program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.uniforms = Object.fromEntries(['center','radius','longitude','latitude','perspective','land'].map(k => [k, gl.getUniformLocation(program, k)]));
      this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      this.element.dataset.globeRenderer = 'webgl';
    } catch (error) {
      this.element.dataset.globeFallbackReason = error.message;
      this.setupFallback();
    }
  }
  setupFallback() {
    this.gl = null;
    // A separate canvas is required after a WebGL context has been requested.
    this.surface.replaceWith(this.surface = Object.assign(document.createElement('canvas'), { className: 'globe-surface' }));
    this.surface.setAttribute('aria-hidden', 'true');
    this.fallback = this.surface.getContext('2d');
    this.element.dataset.globeRenderer = 'canvas';
  }
  async prepareLand() {
    const response = await fetch(new URL('assets/land-110m.json',import.meta.url));
    if (!response.ok) throw new Error('Globe geography unavailable');
    const data = await response.json();
    const texture = document.createElement('canvas'); texture.width = 2048; texture.height = 1024;
    const ctx = texture.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0,0,2048,1024); ctx.fillStyle = '#fff';
    for (const feature of data.features) {
      const polygons = feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates];
      for (const polygon of polygons) {
        ctx.beginPath();
        for (const ring of polygon) {
          ring.forEach(([lon,lat],i) => {
            const x=(lon+180)/360*2048, y=(90-lat)/180*1024;
            if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
          });
          ctx.closePath();
        }
        ctx.fill('evenodd');
      }
    }
    if (this.gl) this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,texture);
    else this.landPixels = ctx.getImageData(0,0,2048,1024).data;
  }
  resize() {
    const box=this.element.getBoundingClientRect();
    if(this.width===box.width && this.height===box.height && this.surface.width) { this.render(this.progress); return; }
    this.width=box.width; this.height=box.height;
    this.dpr=Math.min(devicePixelRatio || 1,2);
    for(const canvas of [this.surface,this.overlay]) {
      canvas.width=Math.round(box.width*this.dpr); canvas.height=Math.round(box.height*this.dpr);
    }
    this.fallbackCache=null;
    this.render(this.progress);
  }
  drawSoftwareSphere(lon,lat,r) {
    const size=Math.min(this.dimensional && this.progress<1?320:720,Math.ceil(r*2*this.dpr));
    const cache=this.fallbackCache;
    if(!cache || Math.abs(cache.lon-lon)>1.2 || Math.abs(cache.lat-lat)>.7 ||
        this.progress===1 && (cache.lon!==lon || cache.canvas.width!==size)) {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d'), image=ctx.createImageData(size,size), out=image.data;
      const ocean=this.dimensional?[234,244,254]:[230,241,252],continent=this.dimensional?[153,185,223]:[166,193,229],shadow=this.dimensional?[69,107,158]:[148,173,212],light=[250,253,255],rim=[181,214,252];
      const sinLat=Math.sin(lat*RAD),cosLat=Math.cos(lat*RAD),lonRad=lon*RAD;
      for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
        const sx=(x+.5)/size*2-1,sy=1-(y+.5)/size*2,rr=sx*sx+sy*sy;
        if(rr>=1) continue;
        const nz=this.dimensional?frontDepth(rr):Math.sqrt(1-rr);
        const perspective=this.dimensional?(CAMERA-nz)/CAMERA_K:1;
        const nx=sx*perspective,ny=sy*perspective;
        const wy=ny*cosLat+nz*sinLat,az=nz*cosLat-ny*sinLat;
        const longitude=Math.atan2(nx,az)+lonRad,latitude=Math.asin(clamp(wy,-1,1));
        const u=((longitude/(2*Math.PI)+.5)%1+1)%1,v=.5-latitude/Math.PI;
        const land=this.landPixels[(Math.min(1023,Math.floor(v*1024))*2048+Math.min(2047,Math.floor(u*2048)))*4]/255;
        const diffuse=this.dimensional?Math.max(0,(-.63*nx+.69*ny+.66*nz)/1.144):Math.max(0,(-.45*nx+.7*ny+1.35*nz)/1.586);
        const shade=this.dimensional ? .39+.61*Math.pow(diffuse,.65):.65+.35*diffuse;
        const i=(y*size+x)*4;
        const highlight=Math.pow(Math.max(0,(-.40*nx+.47*ny+nz)/1.175),this.dimensional?12:22)*(this.dimensional ? .37:.22);
        const atmosphere=this.dimensional?Math.pow(1-Math.sqrt(1-rr),3.6)*(.26+.38*diffuse):0;
        for(let k=0;k<3;k++) {
          const color=ocean[k]*(1-land)+continent[k]*land;
          const lit=shadow[k]*(1-shade)+color*shade;
          out[i+k]=(lit*(1-highlight)+light[k]*highlight)*(1-atmosphere)+rim[k]*atmosphere;
        }
        out[i+3]=255*Math.min(1,(1-rr)*size/2);
      }
      ctx.putImageData(image,0,0); this.fallbackCache={lon,lat,canvas};
    }
    const ctx=this.fallback;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.width,this.height);
    ctx.drawImage(this.fallbackCache.canvas,this.cx-r,this.cy-r,r*2,r*2);
  }
  drawGrid(lon,lat,radius) {
    const ctx=this.ctx;
    const front=this.dimensional?1/CAMERA:0;
    const fadeStart=this.dimensional?.12:.04, fadeEnd=this.dimensional?.32:.24;
    const lonSin=Math.sin(lon*RAD),lonCos=Math.cos(lon*RAD);
    const latSin=Math.sin(lat*RAD),latCos=Math.cos(lat*RAD);
    const lines=GRID.map(line=>line.map(([x,y,z])=>{
      const forward=x*lonSin+z*lonCos;
      return [x*lonCos-z*lonSin,y*latCos-forward*latSin,y*latSin+forward*latCos];
    }));
    const screen=([x,y,z])=>{
      const scale=radius*(this.dimensional?CAMERA_K/(CAMERA-z):1);
      return [this.cx+x*scale,this.cy-y*scale];
    };
    // Both renderers use the same surface projection. Softer strokes at the
    // limb preserve the shading instead of drawing a bright edge around it.
    for(const [min,max,opacity] of [[front,front+fadeStart,.19],[front+fadeStart,front+fadeEnd,.42],[front+fadeEnd,1.01,.72]]){
      ctx.beginPath();
      for(const line of lines){
        let a=line[0],pen=false;
        for(let i=1;i<line.length;i++){
          const b=line[i],dz=b[2]-a[2];
          if(Math.max(a[2],b[2])<min||Math.min(a[2],b[2])>=max){a=b;pen=false;continue;}
          if(!pen||a[2]<min||a[2]>=max){
            const z=clamp(a[2],min,max),t=dz?(z-a[2])/dz:0;
            ctx.moveTo(...screen(between(a,b,t)));
          }
          const z=clamp(b[2],min,max),t=dz?(z-a[2])/dz:1;
          ctx.lineTo(...screen(between(a,b,t)));
          pen=b[2]>=min&&b[2]<max;
          a=b;
        }
      }
      ctx.strokeStyle=`rgba(255,255,255,${opacity})`;
      ctx.lineWidth=clamp(radius*.0035,.66,1.05);
      ctx.lineCap='butt';ctx.lineJoin='round';ctx.stroke();
    }
  }
  render(p) {
    this.progress=p;
    if(!this.loaded || !this.width) return;
    const view=globeView(p,this.entrance),turn=view.turn,move=ease(p);
    const lon=view.longitude,lat=view.latitude;
    this.cx=this.width*(this.dimensional ? .54:.53);this.cy=this.height*.48;
    const reveal=this.entrance?interval(p,0,.51):1;
    const radius=Math.min(this.width*.40,this.height*.43)*(this.entrance?.70+.30*reveal:this.dimensional?.89+.11*turn:.965+.035*move);
    if(this.entrance){
      this.element.style.setProperty('--sphere-reveal',reveal);
      this.element.style.setProperty('--sphere-x',`${this.cx}px`);
      this.element.style.setProperty('--sphere-floor',`${this.cy+radius*.98}px`);
      this.element.style.setProperty('--sphere-shadow-width',`${radius*1.77}px`);
    }
    if(this.gl) {
      const gl=this.gl,u=this.uniforms;
      gl.viewport(0,0,this.surface.width,this.surface.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.center,this.cx*this.dpr,(this.height-this.cy)*this.dpr);gl.uniform1f(u.radius,radius*this.dpr);
      gl.uniform1f(u.longitude,lon*RAD);gl.uniform1f(u.latitude,lat*RAD);
      gl.uniform1f(u.perspective,this.dimensional?1:0);gl.uniform1i(u.land,0);gl.drawArrays(gl.TRIANGLES,0,6);
    } else this.drawSoftwareSphere(lon,lat,radius);
    const ctx=this.ctx;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.width,this.height);
    if(this.showGrid)this.drawGrid(lon,lat,radius);
    if(this.dimensional){this.drawDimensionalRoutes(p,lon,lat,radius);return;}
    const point=v=>{const q=project(v,lon,lat);return {x:this.cx+q[0]*radius,y:this.cy-q[1]*radius,z:q[2],outside:q[0]*q[0]+q[1]*q[1]>1};};
    const drawNode=(coordinates,visibility,pulse=0)=>{
      const q=point(vector(coordinates)); if(q.z<0 || visibility<=0)return;
      const dot=Math.max(3.2,radius*.019), halo=dot*(2.3+pulse*1.3);
      ctx.globalAlpha=visibility;ctx.fillStyle='rgba(42,73,125,.09)';ctx.beginPath();ctx.arc(q.x,q.y,halo,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(42,73,125,.32)';ctx.lineWidth=1;ctx.stroke();
      ctx.fillStyle='#2a497d';ctx.strokeStyle='#e9f3fd';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(q.x,q.y,dot,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.globalAlpha=1;
    };
    const hubVisible=interval(p,.03,.20);
    this.paths.forEach((path,i)=>{
      const start=.09+i*.045,end=.57+i*.055, progress=interval(p,start,end);
      const last=progress*(path.length-1);
      ctx.strokeStyle='rgba(42,73,125,.75)';ctx.lineWidth=Math.max(1.05,radius*.0054);ctx.lineCap='round';ctx.lineJoin='round';
      ctx.beginPath();let pen=false;
      for(let j=0;j<=Math.floor(last);j++){
        const q=point(path[j]);
        if(q.z>=0 || q.outside){if(pen)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);pen=true;}else pen=false;
      }
      ctx.stroke();
      const active=interval(p,end-.06,Math.min(1,end+.05));
      const pulse=Math.sin(Math.PI*interval(p,end-.07,Math.min(1,end+.15)));
      drawNode(DESTINATIONS[i],active,pulse*.7);
    });
    drawNode(HUB,hubVisible);
    this.element.dataset.connectedPoints=String(p===1?DESTINATIONS.length+1:Math.floor(p*(DESTINATIONS.length+1)));
  }
  drawDimensionalRoutes(p,lon,lat,radius) {
    const ctx=this.ctx;
    const screen=v=>{
      const {u,w,visible}=projectRoutePoint(v,lon,lat);
      return {x:this.cx+u*radius,y:this.cy-w*radius,visible};
    };
    const limb=(a,b,firstVisible)=>{
      let lo=0,hi=1;
      for(let i=0;i<9;i++){
        const t=(lo+hi)*.5;
        if(screen(between(a,b,t)).visible===firstVisible)lo=t;else hi=t;
      }
      return screen(between(a,b,firstVisible?lo:hi));
    };
    const node=(v,opacity,pulse=0,hub=false)=>{
      const q=screen(v);
      if(!q.visible || opacity<=0)return;
      const dot=clamp(radius*(hub ? .016:.012),2,4.1), ring=dot*(1.95+pulse*.75);
      ctx.globalAlpha=opacity;ctx.lineWidth=.85;
      ctx.beginPath();ctx.arc(q.x,q.y,ring,0,Math.PI*2);
      ctx.fillStyle='rgba(225,240,255,.27)';ctx.fill();
      ctx.strokeStyle='rgba(38,70,112,.36)';ctx.stroke();
      ctx.beginPath();ctx.arc(q.x,q.y,dot,0,Math.PI*2);
      ctx.fillStyle='#294f80';ctx.fill();ctx.strokeStyle='#e9f3fd';ctx.lineWidth=1.2;ctx.stroke();
      ctx.globalAlpha=1;
    };
    ctx.lineCap='round';ctx.lineJoin='round';
    const width=clamp(radius*.0039,.79,1.12), dash=clamp(radius*.017,2.4,4.3);
    let connected=0;
    this.paths.forEach((path,i)=>{
      const start=(this.entrance?.24:.13)+i*(this.entrance?.037:.047),end=(this.entrance?.57:.53)+i*(this.entrance?.050:.058);
      const draw=interval(p,start,end);
      if(draw<=0)return;
      const last=draw*(path.length-1),whole=Math.floor(last);
      ctx.beginPath();let previous,visibleBefore=false,tip;
      for(let j=0;j<=Math.ceil(last);j++){
        const v=j<=whole?path[j]:between(path[whole],path[j],last-whole);
        const q=screen(v);
        if(q.visible){
          if(visibleBefore)ctx.lineTo(q.x,q.y);
          else {
            const first=previous?limb(previous,v,false):q;
            ctx.moveTo(first.x,first.y);ctx.lineTo(q.x,q.y);
          }
          tip=q;
        }else{
          if(visibleBefore){
            const lastVisible=limb(previous,v,true);
            ctx.lineTo(lastVisible.x,lastVisible.y);
          }
          tip=null;
        }
        previous=v;visibleBefore=q.visible;
      }
      ctx.setLineDash([dash,dash*.89]);
      ctx.strokeStyle='rgba(237,247,255,.35)';ctx.lineWidth=width+.55;ctx.stroke();
      ctx.strokeStyle='rgba(24,51,91,.95)';ctx.lineWidth=width;ctx.stroke();
      ctx.setLineDash([]);
      if(tip&&draw<1){
        ctx.globalAlpha=Math.min(1,draw*8,(1-draw)*12);
        ctx.fillStyle='#e9f3fd';ctx.beginPath();ctx.arc(tip.x,tip.y,width+1.32,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#345c8f';ctx.beginPath();ctx.arc(tip.x,tip.y,width+.43,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      }
      node(path[path.length-1],interval(p,end-.035,end+.05),Math.sin(Math.PI*interval(p,end-.025,end+.08)));
      if(draw===1)connected++;
    });
    const hubEnd=this.entrance?.30:.17;
    const hub=vector(HUB),q=screen(hub);
    node(hub,interval(p,this.entrance?.19:.025,hubEnd),0,true);
    if(this.showHubLabel&&q.visible&&p>.53){
      ctx.save();
      ctx.globalAlpha=interval(p,.53,.72);
      ctx.font=`600 ${clamp(radius*.064,9,13)}px Onest, sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineJoin='round';
      const y=q.y-clamp(radius*.087,8,16);
      ctx.lineWidth=2.25;ctx.strokeStyle='rgba(231,242,253,.94)';ctx.strokeText('Москва',q.x,y);
      ctx.fillStyle='#264771';ctx.fillText('Москва',q.x,y);ctx.restore();
    }
    this.element.dataset.connectedPoints=String(connected+(p>=hubEnd?1:0));
  }
}
