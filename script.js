(() => {
"use strict";

/* NEON//DRIFT
   Systems: renderer / arena / snake / input / collectibles /
   collisions / camera / particles / audio / UI / persistence.
*/
const $=id=>document.getElementById(id);
const canvas=$("scene");
const ui={
 start:$("startScreen"),pause:$("pauseScreen"),over:$("gameOverScreen"),
 startBtn:$("startBtn"),resume:$("resumeBtn"),pauseRestart:$("pauseRestartBtn"),restart:$("restartBtn"),pauseBtn:$("pauseBtn"),
 score:$("score"),high:$("high"),length:$("length"),speed:$("speed"),status:$("statusText"),
 finalScore:$("finalScore"),finalLength:$("finalLength"),finalHigh:$("finalHigh"),boost:$("boostBar").firstElementChild,toast:$("toast")
};
const CFG={arena:38,initialLength:8,spacing:.52,baseSpeed:7.2,maxSpeed:16.5,turn:8.5,cameraBack:8.7,cameraHeight:6.1};

let scene,renderer,camera;
let arena,snakeGroup,fruitGroup,particleGroup,trailGroup;
let snake=[],history=[],particles=[],trails=[],fruit;
let dir=new THREE.Vector3(1,0,0),wanted=dir.clone();
let state="start",score=0,high=Number(localStorage.getItem("neonDriftHighScore")||0);
let elapsed=0,speed=CFG.baseSpeed,boost=1,boostHeld=false,shake=0;
let audio=null,last=performance.now();

const color=(hex,em=hex,intensity=1)=>new THREE.MeshStandardMaterial({color:hex,emissive:em,emissiveIntensity:intensity,metalness:.72,roughness:.22});
const basic=(hex,opacity=1)=>new THREE.MeshBasicMaterial({color:hex,transparent:opacity<1,opacity,depthWrite:false});

function init(){
 scene=new THREE.Scene();
 scene.background=new THREE.Color(0x02050d);
 scene.fog=new THREE.FogExp2(0x020714,.017);
 camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,220);
 camera.position.set(0,7,12);
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
 renderer.setSize(innerWidth,innerHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.25;
 setupLights(); buildArena(); buildSnake(); buildFruit(); buildParticles(); bind(); updateHUD();
 addEventListener("resize",resize);
 requestAnimationFrame(loop);
}
function setupLights(){
 scene.add(new THREE.HemisphereLight(0x78eaff,0x07021d,1.15));
 const a=new THREE.PointLight(0x42eaff,75,90);a.position.set(0,10,0);scene.add(a);
 const b=new THREE.PointLight(0x9c4cff,48,70);b.position.set(-22,7,-18);scene.add(b);
 const c=new THREE.PointLight(0xff3eb5,28,55);c.position.set(20,4,17);scene.add(c);
}
function buildArena(){
 arena=new THREE.Group();scene.add(arena);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(76,76),new THREE.MeshStandardMaterial({color:0x020a19,metalness:.88,roughness:.34}));
 floor.rotation.x=-Math.PI/2;arena.add(floor);
 const grid=new THREE.GridHelper(76,76,0x2bdfff,0x16385b);grid.material.transparent=true;grid.material.opacity=.34;arena.add(grid);
 const grid2=new THREE.GridHelper(76,19,0x794cff,0x12456d);grid2.material.transparent=true;grid2.material.opacity=.11;grid2.position.y=.015;arena.add(grid2);
 const ring=new THREE.Mesh(new THREE.RingGeometry(35,35.08,96),basic(0x43efff,.65));ring.rotation.x=-Math.PI/2;ring.position.y=.03;arena.add(ring);
 for(const [x,z] of [[-38,-38],[38,-38],[-38,38],[38,38]]){
   const g=new THREE.Group();
   g.add(new THREE.Mesh(new THREE.BoxGeometry(.34,7,.34),color(0x36eaff,0x36eaff,3)));
   for(let i=0;i<5;i++){const o=new THREE.Mesh(new THREE.SphereGeometry(.11,8,8),color(0xa263ff,0xa263ff,5));o.position.y=.7+i*1.15;g.add(o)}
   g.position.set(x,3.5,z);arena.add(g);
 }
 for(let i=0;i<10;i++){
   const rail=new THREE.Mesh(new THREE.BoxGeometry(62,.035,.035),basic(i%2?0x744dff:0x31efff,.3));
   rail.position.set(0,2+i*.9,-30);arena.add(rail);
 }
 for(let i=0;i<18;i++){
   const g=new THREE.Group();
   g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.13+Math.random()*.18,1),color(i%2?0x8259ff:0x35efff,i%2?0x8259ff:0x35efff,4)));
   g.position.set((Math.random()-.5)*90,3+Math.random()*17,(Math.random()-.5)*90);
   g.userData.phase=Math.random()*6.28;scene.add(g);
 }
}
function buildSnake(){
 snakeGroup=new THREE.Group();trailGroup=new THREE.Group();scene.add(snakeGroup,trailGroup);
 snake=[];history=[];
 const head=new THREE.Group();
 head.add(Object.assign(new THREE.Mesh(new THREE.IcosahedronGeometry(.72,2),color(0x5cf4ff,0x31ddff,2.7)),{scale:new THREE.Vector3(1.15,.82,1.15)}));
 const visor=new THREE.Mesh(new THREE.SphereGeometry(.73,24,12,0,Math.PI*2,0,Math.PI*.48),basic(0xd26cff,.9));visor.position.y=.12;visor.scale.set(.75,.5,1);head.add(visor);
 const e1=new THREE.Mesh(new THREE.SphereGeometry(.075,8,8),basic(0xffffff)),e2=e1.clone();e1.position.set(-.23,.25,.57);e2.position.set(.23,.25,.57);head.add(e1,e2);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.82,.045,8,32),basic(0x55efff,.8));ring.rotation.x=Math.PI/2;ring.position.y=-.15;head.add(ring);
 head.position.set(0,.72,0);snakeGroup.add(head);snake.push({group:head,pos:head.position.clone()});
 for(let i=1;i<CFG.initialLength;i++)addSegment(i);
 history=Array.from({length:70},()=>new THREE.Vector3(0,.72,0));
}
function addSegment(i){
 const g=new THREE.Group(),s=Math.max(.54,.68-i*.008);
 const core=new THREE.Mesh(new THREE.SphereGeometry(s,12,8),color(i%3===0?0x9d63ff:0x48ecff,i%3===0?0x7e45ff:0x2de6ff,2.2));core.scale.y=.78;g.add(core);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(s*.92,.025,6,18),basic(i%3===0?0xa66cff:0x4ff3ff,.55));ring.rotation.x=Math.PI/2;g.add(ring);
 g.position.set(0,.72,-i*CFG.spacing);snakeGroup.add(g);snake.push({group:g,pos:g.position.clone()});
}
function resetSnake(){snake.forEach(s=>snakeGroup.remove(s.group));buildSnake()}
function buildFruit(){fruitGroup=new THREE.Group();scene.add(fruitGroup);spawnFruit()}
function spawnFruit(){
 if(fruit)fruitGroup.remove(fruit.group);
 const g=new THREE.Group();
 g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.48,2),color(0xff66e8,0xff42cf,5)));
 g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.78,1),new THREE.MeshBasicMaterial({color:0x7f68ff,wireframe:true,transparent:true,opacity:.62})));
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.02,.028,8,32),basic(0x55efff,.82));ring.rotation.x=Math.PI/2;g.add(ring);
 let p;
 for(let tries=0;tries<100;tries++){
   p=new THREE.Vector3((Math.random()-.5)*66,0,(Math.random()-.5)*66);
   if(snake.every(s=>s.pos.distanceTo(p)>2.2))break;
 }
 g.position.set(p.x,1.05,p.z);fruit={group:g,pos:g.position.clone(),phase:Math.random()*6.28};fruitGroup.add(g);
}
function buildParticles(){
 particleGroup=new THREE.Group();scene.add(particleGroup);
 for(let i=0;i<170;i++){
   const p=new THREE.Mesh(new THREE.SphereGeometry(.018+Math.random()*.035,5,5),basic(i%3?0x40dfff:0xa96cff,.3+Math.random()*.5));
   p.position.set((Math.random()-.5)*90,Math.random()*20,(Math.random()-.5)*90);p.userData.ambient=true;p.userData.phase=Math.random()*6.28;particleGroup.add(p);
 }
}
function bind(){
 const map={ArrowUp:[0,0,-1],w:[0,0,-1],W:[0,0,-1],ArrowDown:[0,0,1],s:[0,0,1],S:[0,0,1],ArrowLeft:[-1,0,0],a:[-1,0,0],A:[-1,0,0],ArrowRight:[1,0,0],d:[1,0,0],D:[1,0,0]};
 addEventListener("keydown",e=>{
   if(map[e.key]){e.preventDefault();const v=new THREE.Vector3(...map[e.key]);if(v.dot(dir)>-.65)wanted.copy(v)}
   else if(e.code==="Space"){e.preventDefault();boostHeld=true}
   else if(e.key==="p"||e.key==="P")togglePause();
   else if((e.key==="r"||e.key==="R")&&state==="over")startGame();
 });
 addEventListener("keyup",e=>{if(e.code==="Space")boostHeld=false});
 ui.startBtn.onclick=startGame;ui.resume.onclick=()=>setState("playing");ui.pauseRestart.onclick=startGame;ui.restart.onclick=startGame;ui.pauseBtn.onclick=togglePause;
 canvas.addEventListener("pointerdown",e=>{
   if(state!=="playing"||innerWidth>800)return;
   const dx=e.clientX-innerWidth/2,dy=e.clientY-innerHeight/2;
   if(Math.abs(dx)>Math.abs(dy))wanted.set(Math.sign(dx),0,0);else wanted.set(0,0,Math.sign(dy));
   if(wanted.dot(dir)<=-.65)wanted.multiplyScalar(-1);
 });
}
function startGame(){
 score=0;elapsed=0;speed=CFG.baseSpeed;boost=1;shake=0;dir.set(1,0,0);wanted.copy(dir);resetSnake();spawnFruit();setState("playing");beep(220,.06,"sine");
}
function togglePause(){if(state==="playing")setState("paused");else if(state==="paused")setState("playing")}
function setState(s){
 state=s;ui.start.classList.toggle("active",s==="start");ui.pause.classList.toggle("active",s==="paused");ui.over.classList.toggle("active",s==="over");
 ui.pauseBtn.textContent=s==="paused"?"▶":"Ⅱ";ui.status.textContent=s==="playing"?"SYSTEM ONLINE":s==="paused"?"SIGNAL HOLD":s==="over"?"RUN TERMINATED":"SYSTEM READY";
}
function updateHUD(){
 ui.score.textContent=String(score).padStart(6,"0");ui.high.textContent=String(high).padStart(6,"0");ui.length.textContent=String(snake.length).padStart(2,"0");ui.speed.textContent=(speed/CFG.baseSpeed).toFixed(2)+"x";ui.boost.style.transform=`scaleX(${boost})`;
}
function updateSnake(dt){
 const blend=1-Math.exp(-CFG.turn*dt);dir.lerp(wanted,blend).normalize();
 let v=speed;
 if(boostHeld&&boost>.01){v*=1.82;boost=Math.max(0,boost-dt*.25)}else boost=Math.min(1,boost+dt*.12);
 const head=snake[0],step=v*dt;head.pos.addScaledVector(dir,step);head.group.position.copy(head.pos);head.group.rotation.y=Math.atan2(dir.x,dir.z);
 history.unshift(head.pos.clone());
 const need=Math.ceil((snake.length+2)*CFG.spacing/Math.max(step,.001))+5;if(history.length>need)history.length=need;
 snake.forEach((s,i)=>{
   if(!i)return;
   const idx=Math.min(history.length-1,Math.floor(i*CFG.spacing/Math.max(step,.001))),p=history[idx]||history.at(-1);
   s.pos.lerp(p,.75);s.group.position.copy(s.pos);
   const next=history[Math.min(history.length-1,idx+2)];if(next)s.group.rotation.y=Math.atan2(next.x-s.pos.x,next.z-s.pos.z);
   s.group.position.y=.72+Math.sin(performance.now()*.006-i*.52)*.035;
 });
 head.group.position.y=.72+Math.sin(performance.now()*.006)*.07;
 if(Math.random()<.65){const t=new THREE.Mesh(new THREE.SphereGeometry(.12,6,6),basic(0x43eaff,.34));t.position.set(head.pos.x,.54,head.pos.z);t.userData.life=.5;trailGroup.add(t);trails.push(t)}
}
function updateFruit(dt){
 if(!fruit)return;
 fruit.phase+=dt*2.4;fruit.group.position.y=1.05+Math.sin(fruit.phase)*.34;fruit.group.rotation.y+=dt*1.6;fruit.group.rotation.x+=dt*.7;
 if(snake[0].pos.distanceTo(fruit.group.position)<1.45)collect();
}
function collect(){
 score+=100+Math.floor(elapsed*2);if(score>high){high=score;localStorage.setItem("neonDriftHighScore",high)}
 addSegment(snake.length);burst(fruit.group.position,0xff5be7,40,2.8);burst(fruit.group.position,0x50efff,24,2.2);shake=.42;toast("ENERGY +100");beep(440,.07,"triangle");setTimeout(()=>beep(660,.06,"sine"),55);spawnFruit();
}
function collisions(){
 const p=snake[0].pos,limit=37;
 if(Math.abs(p.x)>limit||Math.abs(p.z)>limit)return gameOver("BOUNDARY");
 for(let i=7;i<snake.length;i++)if(p.distanceTo(snake[i].pos)<.7)return gameOver("SELF COLLISION");
}
function gameOver(reason){
 if(state==="over")return;setState("over");ui.finalScore.textContent=score;ui.finalLength.textContent=snake.length;ui.finalHigh.textContent=high;
 shake=1.1;burst(snake[0].pos,0xff3d9f,90,4);toast(reason);beep(90,.18,"sawtooth");
}
function burst(pos,c,n,power){
 for(let i=0;i<n;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.025+Math.random()*.055,5,5),basic(c,.9));m.position.copy(pos);m.userData.v=new THREE.Vector3(Math.random()-.5,Math.random()-.25,Math.random()-.5).normalize().multiplyScalar(power*(.35+Math.random()));m.userData.life=.45+Math.random()*.7;particleGroup.add(m);particles.push(m)}
}
function effects(dt){
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.userData.life-=dt;p.position.addScaledVector(p.userData.v,dt);p.userData.v.multiplyScalar(Math.pow(.03,dt));p.material.opacity=Math.max(0,p.userData.life);if(p.userData.life<=0){particleGroup.remove(p);particles.splice(i,1)}}
 for(let i=trails.length-1;i>=0;i--){const t=trails[i];t.userData.life-=dt;t.scale.multiplyScalar(.94);t.material.opacity=Math.max(0,t.userData.life*.5);if(t.userData.life<=0){trailGroup.remove(t);trails.splice(i,1)}}
 particleGroup.children.forEach((p,i)=>{if(p.userData.ambient)p.position.y+=Math.sin(performance.now()*.00045+p.userData.phase)*dt*.04});
 shake=Math.max(0,shake-dt*1.9);
}
function cameraUpdate(dt){
 const p=snake[0].pos,back=dir.clone().multiplyScalar(-CFG.cameraBack);
 const target=new THREE.Vector3(p.x+back.x,p.y+CFG.cameraHeight,p.z+back.z),blend=1-Math.exp(-3.3*dt);
 camera.position.lerp(target,blend);
 if(shake){const s=shake*shake;camera.position.x+=(Math.random()-.5)*s*.7;camera.position.y+=(Math.random()-.5)*s*.35;camera.position.z+=(Math.random()-.5)*s*.7}
 const look=p.clone();look.y+=.25;camera.lookAt(look);camera.rotation.z=Math.sin(elapsed*.35)*.012;
}
function toast(t){ui.toast.textContent=t;ui.toast.classList.remove("show");void ui.toast.offsetWidth;ui.toast.classList.add("show")}
function beep(freq,dur,type){
 try{
  audio ||= new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==="suspended")audio.resume();
  const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;
  g.gain.setValueAtTime(.0001,audio.currentTime);g.gain.exponentialRampToValueAtTime(.045,audio.currentTime+.008);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+dur);
  o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+dur+.02);
 }catch{}
}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight)}
function loop(now){
 requestAnimationFrame(loop);const dt=Math.min(.033,(now-last)/1000);last=now;
 if(state==="playing"){elapsed+=dt;speed=Math.min(CFG.maxSpeed,CFG.baseSpeed+elapsed*.085+snake.length*.035);updateSnake(dt);updateFruit(dt);collisions();updateHUD()}
 effects(dt);cameraUpdate(dt);
 scene.traverse(o=>{if(o.userData&&o.userData.phase!==undefined&&o.userData.ambient===undefined)o.rotation.y+=dt*.05});
 renderer.render(scene,camera);
}
init();
})();