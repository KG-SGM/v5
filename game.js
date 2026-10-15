import * as T from './vendor/three.module.min.js';
import {STEP,TOP,COLORS,NAMES,createCourse,createPlayer,updateCourse,stepPlayer,respawn} from './physics.js';
const $=id=>document.getElementById(id),clamp=T.MathUtils.clamp;
const store={get(k){try{return localStorage.getItem('tower-rush-'+k)}catch{return null}},set(k,v){try{localStorage.setItem('tower-rush-'+k,v)}catch{}}};
let renderer;
try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch{ $('loading').innerHTML='<p>Enable WebGL / hardware acceleration, then reload.</p>';throw Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
$('world').appendChild(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#a8c9d7');scene.fog=new T.Fog('#94b1bf',36,105);
const camera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.08,150);
scene.add(new T.HemisphereLight('#e7f5ff','#61716c',2.7));
const sun=new T.DirectionalLight('#fff1dd',3);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:.5,far:65});sun.shadow.bias=-.0005;sun.shadow.normalBias=.03;scene.add(sun,sun.target);
const tower=new T.Group();scene.add(tower);
const box=new T.BoxGeometry(1,1,1),materials=COLORS.map(color=>new T.MeshStandardMaterial({color,roughness:.67}));
const trim=new T.MeshStandardMaterial({color:'#d8e6ec',roughness:.7}),killMat=new T.MeshStandardMaterial({color:'#ff467d',emissive:'#ff155d',emissiveIntensity:1.5,roughness:.3});
function cube(group,x,y,z,w,h,d,mat,shadow=false){const m=new T.Mesh(box,mat);m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=shadow;m.receiveShadow=true;group.add(m);return m;}
function label(text,color,subtitle=''){
 const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.textAlign='center';ctx.font='bold 108px sans-serif';ctx.fillText(text,256,137);ctx.font='bold 17px sans-serif';ctx.fillText(subtitle,256,183);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
for(let s=0;s<6;s++){
 const wall=new T.Mesh(new T.CylinderGeometry(15.5,15.5,9.2,32,1,true),new T.MeshStandardMaterial({color:new T.Color(COLORS[s]).multiplyScalar(.36),side:T.BackSide,roughness:1}));wall.position.y=s*9.2+4.6;tower.add(wall);
 const ring=new T.Mesh(new T.TorusGeometry(15.42,.09,6,64),materials[s]);ring.rotation.x=Math.PI/2;ring.position.y=s*9.2+.08;tower.add(ring);
 const pillarMat=new T.MeshStandardMaterial({color:new T.Color(COLORS[s]).multiplyScalar(.48)});
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;cube(tower,Math.sin(a)*15.35,s*9.2+4.6,Math.cos(a)*15.35,.1,9.2,.12,pillarMat).rotation.y=a;}
 const banner=new T.Mesh(new T.PlaneGeometry(5.5,2.75),new T.MeshBasicMaterial({map:label('0'+(s+1),COLORS[s],NAMES[s]),transparent:true,depthWrite:false,side:T.DoubleSide}));const a=-Math.PI/2+(s*8+4)*.37;banner.position.set(Math.cos(a)*15.12,s*9.2+5.3,Math.sin(a)*15.12);banner.lookAt(0,banner.position.y,0);tower.add(banner);
}
const floor=new T.Mesh(new T.CylinderGeometry(15.45,15.45,.6,64),new T.MeshStandardMaterial({color:'#d4e0df',roughness:.88}));floor.position.y=-.3;floor.receiveShadow=true;tower.add(floor);
const grid=new T.GridHelper(30,30,'#a5c0bd','#bdcfcd');grid.position.y=.012;tower.add(grid);
cube(tower,0,.025,-9,3.8,.05,3.8,materials[0]);
const startSign=new T.Mesh(new T.PlaneGeometry(4,2),new T.MeshBasicMaterial({map:label('START','#426d65','FOLLOW THE COLORED PLATFORMS'),transparent:true,depthWrite:false}));startSign.rotation.x=-Math.PI/2;startSign.position.set(0,.06,-5.5);tower.add(startSign);
let course=createCourse(),player=createPlayer(),seed=0,mode='classic',state='menu',started=false;
let elapsed=0,remaining=480,falls=0,respawnAt=0,grace=0,yaw=-Math.PI/2,pitch=.48,distance=8.3,accumulator=0,last=0,jumpQueued=false,drag=null,toastUntil=0;
let sound=store.get('sound')!=='off',audio,best=0;
const keys=new Set(),stick={x:0,z:0,pointer:null},previous=new T.Vector3(player.x,player.y,player.z),renderPos=previous.clone(),target=new T.Vector3(),desired=new T.Vector3(),look=new T.Vector3(1,0,0);
const platformMeshes=new Map(),cameraObstacles=[],hazardMeshes=[];
const studGeo=new T.CylinderGeometry(.1,.1,.065,8);
for(const p of course.platforms.slice(1)){
 const group=new T.Group();cameraObstacles.push(cube(group,0,p.h/2,0,p.w,p.h,p.d,materials[p.stage],true));
 cube(group,0,p.h-.025,p.d/2-.035,p.w,.05,.07,new T.MeshStandardMaterial({color:new T.Color(COLORS[p.stage]).lerp(new T.Color('white'),.35)}));
 const matrices=[];for(let x=-p.w/2+.42;x<p.w/2-.2;x+=.55)for(let z=-p.d/2+.42;z<p.d/2-.2;z+=.55)matrices.push(new T.Matrix4().makeTranslation(x,p.h+.025,z));
 const studs=new T.InstancedMesh(studGeo,new T.MeshStandardMaterial({color:new T.Color(COLORS[p.stage]).multiplyScalar(.92)}),matrices.length);matrices.forEach((m,i)=>studs.setMatrixAt(i,m));group.add(studs);
 group.position.set(p.x,p.y,p.z);tower.add(group);platformMeshes.set(p.id,group);
}
for(const h of course.hazards){const group=new T.Group();cube(group,0,0,0,h.length,.24,h.width,killMat);const hub=new T.Mesh(new T.CylinderGeometry(.3,.3,.8,12),trim);hub.position.y=-.18;group.add(hub);for(const x of [-h.length/2,h.length/2]){const end=new T.Mesh(new T.SphereGeometry(.17,8,8),killMat);end.position.x=x;group.add(end);}group.position.set(h.x,h.y,h.z);group.rotation.y=h.angle;tower.add(group);hazardMeshes.push(group);}
const finish=new T.Group(),lastPlatform=course.platforms[48];finish.position.set(lastPlatform.x,TOP,lastPlatform.z);
const gold=new T.MeshStandardMaterial({color:'#fff4b0',emissive:'#f5bd39',emissiveIntensity:.35,metalness:.2,roughness:.35});cube(finish,-1.6,1.8,0,.22,3.6,.3,gold);cube(finish,1.6,1.8,0,.22,3.6,.3,gold);cube(finish,0,3.5,0,3.4,.22,.3,gold);
const sign=new T.Mesh(new T.PlaneGeometry(3.8,1.9),new T.MeshBasicMaterial({map:label('FINISH','#fff4b0'),transparent:true,side:T.DoubleSide}));sign.position.y=4.3;finish.add(sign);tower.add(finish);
const avatar=new T.Group(),body=new T.Group();avatar.add(body);scene.add(avatar);
const skin=new T.MeshStandardMaterial({color:'#ffcd9d',roughness:.8}),shirt=new T.MeshStandardMaterial({color:'#f1f1e9',roughness:.85}),pants=new T.MeshStandardMaterial({color:'#43586c'}),shoe=new T.MeshStandardMaterial({color:'#f5f5ef'}),hair=new T.MeshStandardMaterial({color:'#49372c'}),ink=new T.MeshBasicMaterial({color:'#352e31'});
cube(body,0,1.10,0,.74,.7,.42,shirt,true);cube(body,0,1.66,0,.50,.46,.48,skin,true);cube(body,0,1.89,0,.54,.16,.51,hair,true);cube(body,0,1.74,-.23,.54,.25,.12,hair);
for(const x of [-.105,.105])cube(body,x,1.68,.245,.045,.065,.012,ink);cube(body,0,1.56,.245,.11,.028,.014,ink);
const limbs=[];for(const side of [-1,1]){const arm=new T.Group();arm.position.set(side*.51,1.36,0);body.add(arm);cube(arm,0,-.18,0,.25,.42,.34,shirt,true);cube(arm,0,-.45,0,.24,.21,.32,skin,true);const leg=new T.Group();leg.position.set(side*.2,.75,0);body.add(leg);cube(leg,0,-.30,0,.30,.58,.35,pants,true);cube(leg,0,-.66,.04,.32,.18,.43,shoe,true);limbs.push({arm,leg,side});}
const shadow=new T.Mesh(new T.CircleGeometry(.57,24),new T.MeshBasicMaterial({color:'#244239',transparent:true,opacity:.2,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
const nextMarker=new T.Mesh(new T.ConeGeometry(.2,.35,4),new T.MeshBasicMaterial({color:'white',transparent:true,opacity:.9}));nextMarker.rotation.z=Math.PI;scene.add(nextMarker);
const particleGeo=new T.BufferGeometry(),positions=new Float32Array(480),particleColors=new Float32Array(480),particles=[];
for(let i=0;i<160;i++){new T.Color(COLORS[i%6]).toArray(particleColors,i*3);particles.push({x:(Math.random()-.5)*18,y:Math.random()*14,z:(Math.random()-.5)*18,speed:1.5+Math.random()*2});}
particleGeo.setAttribute('position',new T.BufferAttribute(positions,3));particleGeo.setAttribute('color',new T.BufferAttribute(particleColors,3));const confetti=new T.Points(particleGeo,new T.PointsMaterial({vertexColors:true,size:.12}));confetti.visible=false;scene.add(confetti);let celebration=0;
COLORS.forEach((color,i)=>{const d=document.createElement('div');d.className='piece';d.style.setProperty('--color',color);d.innerHTML=`<span>0${i+1}</span>`;$('track').appendChild(d);});const pieces=[...document.querySelectorAll('.piece')],marker=document.createElement('div');marker.className='marker';$('track').appendChild(marker);
const format=s=>{s=Math.max(0,Math.ceil(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
function tone(f,d=.12,volume=.03){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.setValueAtTime(f,audio.currentTime);o.frequency.exponentialRampToValueAtTime(f*.55,audio.currentTime+d);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d);}catch{}}
function syncBest(){best=Number(store.get('best-'+mode))||0;$('best').textContent=best?format(best):'—';}syncBest();
function toast(message,seconds=2.5){$('toast').textContent=message;$('toast').classList.add('visible');toastUntil=performance.now()+seconds*1000;}
function clearInput(){keys.clear();jumpQueued=false;drag=null;stick.x=0;stick.z=0;stick.pointer=null;$('knob').style.transform='';}
function menu(kind){
 clearInput();$('menu').classList.remove('hidden');document.body.classList.remove('playing');$('modes').classList.toggle('hidden',kind!=='menu');$('change-mode').classList.toggle('hidden',kind==='menu');
 const data={menu:['WELCOME TO','TOWER<br><em>RUSH</em><span class="arrow"></span>','Six stages. One shot at the top.<br>Jump, balance, and beat the clock.','LET’S CLIMB'],paused:['TAKE A BREATHER','ON<br><em>PAUSE</em>','Your climb is right where you left it.<br>The clock is paused, too.','KEEP CLIMBING'],won:['TOP OF THE WORLD','TOWER<br><em>CLEARED</em>',`You made it in ${format(elapsed)} with ${falls} falls.<br>That view was worth the climb.`,'CLIMB AGAIN'],timeout:['THE CLOCK RAN OUT','ONE<br><em>MORE?</em>',`You reached ${Math.floor(player.best/48*100)}% of the tower.<br>A fresh eight minutes. You’ve got this.`,'TRY AGAIN']}[kind];
 $('overline').textContent=data[0];$('title').innerHTML=data[1];$('copy').innerHTML=data[2];$('play').innerHTML=`${data[3]} <span class="arrow"></span>`;
}
function cameraReset(){const cp=mode==='practice'?Math.min(40,Math.floor(player.best/8)*8):0,next=course.platforms[cp+1];yaw=Math.atan2(player.x-next.x,player.z-next.z);pitch=.48;camera.position.set(player.x+Math.sin(yaw)*distance*Math.cos(pitch),player.y+1.25+Math.sin(pitch)*distance,player.z+Math.cos(yaw)*distance*Math.cos(pitch));}
function start(){clearInput();course=createCourse(++seed);player=createPlayer();elapsed=0;remaining=480;falls=0;grace=0;respawnAt=0;accumulator=0;celebration=0;confetti.visible=false;previous.set(player.x,player.y,player.z);renderPos.copy(previous);cameraReset();state='playing';started=true;$('menu').classList.add('hidden');document.body.classList.add('playing');$('mode-label').textContent=mode==='practice'?'PRACTICE · STAGE CHECKPOINTS':'CLASSIC · NO CHECKPOINTS';toast(mode==='practice'?'Each new section saves your progress.':'Reach the top. Avoid pink. Make every jump count.',4);tone(540);}
function pause(){if(state!=='playing')return;state='paused';menu('paused');}
function resume(){clearInput();state='playing';accumulator=0;last=performance.now();$('menu').classList.add('hidden');document.body.classList.add('playing');}
function die(){falls++;respawnAt=.5;tone(160,.3,.06);$('flash').style.opacity='.27';setTimeout(()=>$('flash').style.opacity='0',100);toast(mode==='practice'&&player.best>=8?'Back to your checkpoint. Keep going.':'Take a breath. Back to the start.',1.8);}
function win(){state='won';celebration=.01;confetti.visible=true;if(!best||elapsed<best){store.set('best-'+mode,elapsed);syncBest();}tone(880,.4,.05);menu('won');}
$('play').onclick=()=>state==='paused'?resume():start();$('pause').onclick=()=>state==='playing'?pause():state==='paused'?resume():null;
$('change-mode').onclick=()=>{state='menu';started=false;camera.position.set(-4,10,2);menu('menu');};
$('sound').onclick=()=>{sound=!sound;store.set('sound',sound?'on':'off');$('sound').setAttribute('aria-pressed',String(sound));$('sound').style.opacity=sound?'1':'.4';if(sound)tone(660);};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(a=>a.classList.toggle('selected',a===b));syncBest();});
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat){if(state==='playing')pause();else if(state==='paused')resume();}return;}if(state!=='playing')return;if(e.code==='KeyR'&&!e.repeat){if(!player.dead){player.dead=true;die();}return;}keys.add(e.code);if(e.code==='Space'&&!e.repeat)jumpQueued=true;});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{if(state!=='playing')return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId||state!=='playing')return;yaw-=(e.clientX-drag.x)*.005;pitch=clamp(pitch+(e.clientY-drag.y)*.004,.12,1.15);drag.x=e.clientX;drag.y=e.clientY;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,e=>{if(drag?.id===e.pointerId)drag=null;});
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=clamp(distance+e.deltaY*.008,4,11);},{passive:false});
function moveStick(e){if(e.pointerId!==stick.pointer)return;const r=$('stick').getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/36,z=(e.clientY-r.top-r.height/2)/36;const l=Math.max(1,Math.hypot(x,z));stick.x=x/l;stick.z=z/l;$('knob').style.transform=`translate(${stick.x*36}px,${stick.z*36}px)`;}
$('stick').addEventListener('pointerdown',e=>{if(state!=='playing')return;stick.pointer=e.pointerId;$('stick').setPointerCapture(e.pointerId);moveStick(e);});$('stick').addEventListener('pointermove',moveStick);for(const event of ['pointerup','pointercancel','lostpointercapture'])$('stick').addEventListener(event,()=>{stick.pointer=null;stick.x=0;stick.z=0;$('knob').style.transform='';});$('jump').addEventListener('pointerdown',e=>{e.preventDefault();if(state==='playing')jumpQueued=true;});
function simulate(){
 updateCourse(course,STEP);previous.set(player.x,player.y,player.z);remaining-=STEP;elapsed+=STEP;grace=Math.max(0,grace-STEP);
 if(remaining<=0){state='timeout';menu('timeout');return;}
 if(respawnAt>0){respawnAt-=STEP;if(respawnAt<=0){respawn(player,course,mode==='practice');grace=1.6;previous.set(player.x,player.y,player.z);renderPos.copy(previous);cameraReset();}return;}
 let x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+stick.x,z=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+stick.z;
 yaw+=(Number(keys.has('KeyQ'))-Number(keys.has('KeyE')))*STEP*1.7;
 const input={x:x*Math.cos(yaw)+z*Math.sin(yaw),z:-x*Math.sin(yaw)+z*Math.cos(yaw),jump:jumpQueued,invulnerable:grace>0,onJump:()=>tone(420,.11,.018)};jumpQueued=false;const oldStage=player.stage;stepPlayer(player,input,course);
 if(player.ground===0&&previous.y>.04&&player.best>0)player.dead=true;
 if(player.stage>oldStage){tone(720,.18);toast(`SECTION ${player.stage+1} · ${NAMES[player.stage]}${mode==='practice'?' · Checkpoint saved':''}`);}
 if(player.dead)die();if(player.won)win();
}
function draw(dt,now){
 for(const p of course.platforms.slice(1))platformMeshes.get(p.id).position.set(p.x,p.y,p.z);hazardMeshes.forEach((m,i)=>m.rotation.y=course.hazards[i].angle);
 if(state==='playing'){const a=accumulator/STEP;renderPos.set(T.MathUtils.lerp(previous.x,player.x,a),T.MathUtils.lerp(previous.y,player.y,a),T.MathUtils.lerp(previous.z,player.z,a));}else if(!started)renderPos.set(player.x,player.y,player.z);
 avatar.position.copy(renderPos);avatar.visible=(!player.dead||Math.floor(now/80)%2===0)&&(grace<=0||Math.floor(now/100)%3!==0);
 const speed=Math.hypot(player.vx,player.vz);if(speed>.3)look.set(player.vx/speed,0,player.vz/speed);const angle=Math.atan2(look.x,look.z);avatar.rotation.y+=Math.atan2(Math.sin(angle-avatar.rotation.y),Math.cos(angle-avatar.rotation.y))*(1-Math.exp(-dt*17));
 const swing=state==='playing'&&player.grounded?Math.sin(now*.014)*Math.min(speed/7.5,1)*.65:0;for(const l of limbs){l.arm.rotation.x=player.grounded?swing*l.side:-1.15;l.leg.rotation.x=player.grounded?-swing*l.side:.22*l.side;}body.position.y=player.grounded?Math.abs(swing)*.025:0;
 shadow.visible=player.grounded;shadow.position.set(player.x,player.y+.014,player.z);
 const next=course.platforms[Math.min(48,player.ground>=0?player.ground+1:player.best+1)];nextMarker.position.set(next.x,next.y+1.7+Math.sin(now*.004)*.14,next.z);nextMarker.visible=state==='playing'&&!player.won;
 if(!started){desired.set(-4*Math.cos(now*.000035),10,2+Math.sin(now*.000035)*2);target.set(5,19,-5);camera.position.lerp(desired,1-Math.exp(-dt*3));}
 else{target.copy(renderPos);target.y+=1.25;desired.set(target.x+Math.sin(yaw)*distance*Math.cos(pitch),target.y+Math.sin(pitch)*distance,target.z+Math.cos(yaw)*distance*Math.cos(pitch));const r=Math.hypot(desired.x,desired.z);if(r>14.7){desired.x*=14.7/r;desired.z*=14.7/r;}desired.y=Math.max(desired.y,.8);camera.position.lerp(desired,1-Math.exp(-dt*12));const direction=camera.position.clone().sub(target),ray=new T.Raycaster(target,direction.clone().normalize(),.6,direction.length()),hits=ray.intersectObjects(cameraObstacles,false);if(hits.length)camera.position.copy(target).addScaledVector(direction.normalize(),Math.max(.6,hits[0].distance-.18));}
 camera.lookAt(target);sun.position.set(player.x-9,player.y+18,player.z+7);sun.target.position.set(player.x,player.y,player.z);
 if(celebration){celebration+=dt;particles.forEach((p,i)=>{positions[i*3]=lastPlatform.x+p.x;positions[i*3+1]=TOP+1+((p.y-celebration*p.speed)%14+14)%14;positions[i*3+2]=lastPlatform.z+p.z;});particleGeo.attributes.position.needsUpdate=true;}
 $('timer').textContent=format(remaining);$('timer').style.color=remaining<60?'#ff91bb':'';$('clock-line').style.width=remaining/480*100+'%';const percent=clamp(player.y/TOP*100,0,100);$('height').textContent=Math.floor(Math.max(0,player.y))+'m';$('progress').textContent=Math.floor(percent)+'%';marker.style.bottom=percent+'%';pieces.forEach((d,i)=>d.classList.toggle('active',i===player.stage));$('stage-name').textContent=NAMES[player.stage];$('stage-number').textContent='0'+(player.stage+1);$('stage-number').style.color=COLORS[player.stage];if(now>toastUntil)$('toast').classList.remove('visible');renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);});
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-(last||now))/1000,.08);last=now;if(state==='playing'){accumulator+=dt;while(accumulator>=STEP&&state==='playing'){simulate();accumulator-=STEP;}}else accumulator=0;draw(dt,now);}
camera.position.set(-4,10,2);menu('menu');$('loading').classList.add('hidden');requestAnimationFrame(frame);
