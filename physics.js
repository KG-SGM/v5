export const STEP = 1 / 120, HEIGHT = 1.98, RADIUS = .36, TOP = 55.2;
export const COLORS = ['#64d9b0','#6dbbff','#ad94ff','#ff91bb','#ffb66e','#f7dd77'];
export const NAMES = ['FIRST STEPS','BLUE SHIFT','THE CROSSOVER','PINK PANIC','AFTERBURN','GOLDEN HOUR'];
export function createCourse(seed=0) {
  const platforms=[{id:0,x:0,y:-.6,z:0,w:31,h:.6,d:31,stage:0,floor:true}];
  for(let i=1;i<=48;i++){
    const a=-Math.PI/2+i*.37,stage=Math.floor((i-1)/8),landing=i%8===0;
    const p={id:i,x:Math.cos(a)*9,z:Math.sin(a)*9,y:i*1.15-.45,w:landing?4.8:i%3===0?2.15:3.1,d:landing?4.8:i%3===1?2.3:3.1,h:.45,stage,landing,moving:stage>=1&&i%8===4,baseX:Math.cos(a)*9,baseZ:Math.sin(a)*9,phase:seed*.6+i,dx:0,dz:0};
    if(!landing&&stage===2){p.w=1.35;p.d=3.7;}
    if(!landing&&stage===3){p.w=2;p.d=2;}
    if(!landing&&stage===4){p.w=4;p.d=1.3;}
    if(!landing&&stage===5){p.w=2.1;p.d=2.1;}
    platforms.push(p);
  }
  const hazards=platforms.filter(p=>p.landing&&p.id<48).map(p=>({x:p.x,y:p.y+p.h+.65,z:p.z,length:6.4,width:.24,angle:p.id,speed:(p.stage%2?-1:1)*(.65+p.stage*.08)}));
  return {platforms,hazards,time:0};
}
export function createPlayer(){return {x:0,y:0,z:-9,vx:0,vy:0,vz:0,grounded:true,ground:0,coyote:.1,buffer:0,stage:0,best:0,dead:false,won:false};}
export function updateCourse(c,dt){
  c.time+=dt;
  for(const p of c.platforms){const x=p.x,z=p.z;if(p.moving){p.x=p.baseX+Math.sin(c.time*1.1+p.phase)*.7;p.z=p.baseZ+Math.cos(c.time*1.1+p.phase)*.35;}p.dx=p.x-x;p.dz=p.z-z;}
  for(const h of c.hazards)h.angle+=dt*h.speed;
}
export function stepPlayer(p,input,c,dt=STEP){
  if(p.dead||p.won)return;
  const ground=c.platforms.find(b=>b.id===p.ground);
  if(p.grounded&&ground){p.x+=ground.dx||0;p.z+=ground.dz||0;}
  p.coyote=p.grounded?.10:Math.max(0,p.coyote-dt);
  p.buffer=input.jump?.12:Math.max(0,p.buffer-dt);
  if(p.buffer>0&&p.coyote>0){p.vy=10;p.grounded=false;p.ground=-1;p.coyote=0;p.buffer=0;input.onJump?.();}
  const l=Math.max(1,Math.hypot(input.x,input.z)),blend=1-Math.exp(-(p.grounded?28:16)*dt);
  p.vx+=(input.x/l*7.5-p.vx)*blend;p.vz+=(input.z/l*7.5-p.vz)*blend;
  for(const axis of ['x','z']){
    const other=axis==='x'?'z':'x';p[axis]+=p[axis==='x'?'vx':'vz']*dt;
    for(const b of c.platforms){
      if(b.floor||p.y+HEIGHT<=b.y+.001||p.y>=b.y+b.h-.001)continue;
      if(Math.abs(p[other]-b[other])>=(axis==='x'?b.d:b.w)/2+RADIUS-.001)continue;
      const half=(axis==='x'?b.w:b.d)/2+RADIUS,delta=p[axis]-b[axis];
      if(Math.abs(delta)<half){p[axis]=b[axis]+(delta>=0?half:-half);p[axis==='x'?'vx':'vz']=0;}
    }
  }
  const radial=Math.hypot(p.x,p.z);if(radial>14.9){p.x*=14.9/radial;p.z*=14.9/radial;}
  const oldY=p.y;p.vy-=25*dt;p.y+=p.vy*dt;p.grounded=false;p.ground=-1;
  for(const b of c.platforms){
    if(Math.abs(p.x-b.x)>=b.w/2+RADIUS-.04||Math.abs(p.z-b.z)>=b.d/2+RADIUS-.04)continue;
    const top=b.y+b.h;
    if(p.vy<=0&&oldY>=top-.002&&p.y<=top){p.y=top;p.vy=0;p.grounded=true;p.ground=b.id;p.stage=Math.min(5,Math.floor(b.id/8));p.best=Math.max(p.best,b.id);}
    else if(p.vy>0&&oldY+HEIGHT<=b.y+.002&&p.y+HEIGHT>=b.y){p.y=b.y-HEIGHT;p.vy=0;}
  }
  if(!input.invulnerable)for(const h of c.hazards){
    if(p.y+HEIGHT<h.y-.12||p.y>h.y+.12)continue;
    const x=p.x-h.x,z=p.z-h.z;
    if(Math.abs(x*Math.cos(h.angle)-z*Math.sin(h.angle))<h.length/2+RADIUS&&Math.abs(x*Math.sin(h.angle)+z*Math.cos(h.angle))<h.width/2+RADIUS)p.dead=true;
  }
  if(p.y< -4)p.dead=true;if(p.ground===48)p.won=true;
}
export function respawn(p,c,practice=false){
  const best=p.best,id=practice?Math.min(40,Math.floor(best/8)*8):0;
  Object.assign(p,createPlayer());p.best=best;
  if(id){const b=c.platforms[id];Object.assign(p,{x:b.x,z:b.z,y:b.y+b.h+2,grounded:false,ground:-1,stage:Math.floor(id/8)});}
}
