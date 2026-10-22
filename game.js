import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const $ = id => document.getElementById(id);
const ui = {
  loading:$('loading'), loadingBar:$('loadingBar'), loadingText:$('loadingText'), menu:$('menu'), hud:$('hud'),
  pause:$('pauseMenu'), over:$('gameOver'), mobile:$('mobileControls'), toast:$('toast'), hint:$('hint'),
  interact:$('interactLabel'), objective:$('objectiveText')
};
let scene, camera, renderer, clock, worldGroup, player, yaw=0, pitch=0, running=false, paused=false, dead=false;
let resources=[], campfires=[], entities=[], colliders=[], keys={}, nearby=null, toastTimer=0, elapsed=0, day=1, mobileLook=false, lastTouchX=0,lastTouchY=0, flashlightOn=true, flashlight;
const state={health:100,hunger:100,thirst:100,stamina:100,wood:0,stone:0,berries:0,water:2, campfire:false};
const isMobile=('ontouchstart' in window)||navigator.maxTouchPoints>0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);
const mat=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness});
const mats={
  grass:mat('#202b24'), grass2:mat('#29382b'), dirt:mat('#24231d'), bark:mat('#30251e'),
  leaf:mat('#344f3b'), leaf2:mat('#4b6747'), rock:mat('#777c73'), stone:mat('#96978b'),
  wood:mat('#806044'), berry:mat('#6c2948'), water:mat('#345b61',.38)
};


function makeSurfaceTexture(base, accent, kind='grain'){
 const c=document.createElement('canvas');c.width=256;c.height=256;const x=c.getContext('2d');
 x.fillStyle=base;x.fillRect(0,0,256,256);
 if(kind==='wood'){
   for(let i=0;i<95;i++){x.strokeStyle=i%3?accent:base;x.globalAlpha=.12+Math.random()*.18;x.lineWidth=1+Math.random()*3;x.beginPath();let yy=Math.random()*256;x.moveTo(0,yy);x.bezierCurveTo(80,yy-8,170,yy+10,256,yy+Math.random()*8);x.stroke()}
 }else if(kind==='tile'){
   x.strokeStyle=accent;x.globalAlpha=.35;x.lineWidth=2;
   for(let y=0;y<256;y+=32){x.beginPath();x.moveTo(0,y);x.lineTo(256,y);x.stroke()}
   for(let y=0;y<256;y+=32)for(let xx=(y/32%2)*16;xx<256;xx+=32){x.beginPath();x.moveTo(xx,y);x.lineTo(xx,y+32);x.stroke()}
 }else if(kind==='concrete'){
   for(let i=0;i<1800;i++){x.fillStyle=Math.random()>.5?accent:base;x.globalAlpha=Math.random()*.2;x.fillRect(Math.random()*256,Math.random()*256,1+Math.random()*5,1+Math.random()*3)}
 }else{
   for(let i=0;i<700;i++){x.fillStyle=accent;x.globalAlpha=Math.random()*.12;x.fillRect(Math.random()*256,Math.random()*256,2+Math.random()*18,1+Math.random()*3)}
 }
 x.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function textured(color, accent, kind, roughness=1){return new THREE.MeshStandardMaterial({color,map:makeSurfaceTexture(color,accent,kind),roughness});}

function init(){
  scene=new THREE.Scene(); scene.background=new THREE.Color('#030605'); scene.fog=new THREE.FogExp2('#030605',.045);
  camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.1,500); camera.rotation.order='YXZ';
  renderer=new THREE.WebGLRenderer({antialias:!isMobile,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?1.5:2)); renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=!isMobile; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
  document.body.prepend(renderer.domElement);
  worldGroup=new THREE.Group();scene.add(worldGroup);
  const hemi=new THREE.HemisphereLight('#647268','#080b09',.22);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#a7b6a6',.12);sun.position.set(-45,75,25);sun.castShadow=!isMobile;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;scene.add(sun);
  buildSchoolMap();
  createEntities();
  player={pos:new THREE.Vector3(0,1.7,0),vel:new THREE.Vector3(),onGround:true};
  camera.position.copy(player.pos);
  flashlight=new THREE.SpotLight(0xfff1cf,42,24,Math.PI/7,.45,1.4);
  flashlight.position.set(0,0,0); flashlight.target.position.set(0,0,-1);
  camera.add(flashlight); camera.add(flashlight.target); scene.add(camera);
  clock=new THREE.Clock();
  setupControls();
  $('startBtn').addEventListener('click',startGame);
  $('pauseBtn').addEventListener('click',pauseGame);
  $('resumeBtn').addEventListener('click',resumeGame);
  $('restartBtn').addEventListener('click',()=>location.reload());
  $('againBtn').addEventListener('click',()=>location.reload());
  $('eatBtn').addEventListener('click',eatBerry);
  $('drinkBtn').addEventListener('click',drinkWater);
  $('fireBtn').addEventListener('click',buildCampfire);
  $('collectBtn').addEventListener('click',collectNearby);
  $('sprintBtn').addEventListener('touchstart',e=>{e.preventDefault();keys.ShiftLeft=true},{passive:false});
  $('sprintBtn').addEventListener('touchend',()=>keys.ShiftLeft=false);
  $('jumpBtn').addEventListener('click',jump);
  $('collectBtn').addEventListener('click',collectNearby);
  $('lookNote')?.addEventListener('click',()=>{flashlightOn=!flashlightOn;flashlight.visible=flashlightOn;showToast(flashlightOn?'Flashlight on':'Flashlight off')});
  $('flashBtn')?.addEventListener('click',()=>{flashlightOn=!flashlightOn;flashlight.visible=flashlightOn;showToast(flashlightOn?'Flashlight on':'Flashlight off')});
  $('mobileEatBtn')?.addEventListener('click',eatBerry);
  $('mobileDrinkBtn')?.addEventListener('click',drinkWater);
  window.addEventListener('resize',onResize);
  ui.loadingBar.style.width='100%';ui.loadingText.textContent='Wilderness ready';
  setTimeout(()=>{ui.loading.classList.add('hidden');ui.menu.classList.remove('hidden')},450);
  animate();
}


// Blueprint-inspired 3D blockout of Het Erasmus, based on the supplied floor-plan screenshots.
// Dimensions and coordinates are approximate, not a surveyed architectural model.
const schoolMat={
 floor:textured('#bcb8ad','#77766e','tile'), corridor:textured('#b9b6ad','#77756c','tile'),
 wall:textured('#d8d4c8','#9b988e','concrete'), side:textured('#aaa79d','#77756f','concrete'),
 door:textured('#70513b','#30251d','wood'), room:textured('#c7c3b8','#8e8a80','tile')
};
function schoolBox(w,h,d,material,x,y,z){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
 mesh.position.set(x,y+h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;worldGroup.add(mesh);
 if(h>1.5 && (material===schoolMat.wall || material===schoolMat.side)) colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,minY:y,maxY:y+h});
 return mesh;
}
function registerResource(group,type,x,z,label){
 group.position.set(x,0,z);group.userData={type,label,collected:false};
 group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 worldGroup.add(group);resources.push(group);return group;
}
function createEntities(){
 const creature=new THREE.Group();
 const body=new THREE.Mesh(new THREE.SphereGeometry(.62,12,10),new THREE.MeshStandardMaterial({color:0x101512,roughness:1}));body.scale.set(.8,1.15,1.25);body.position.y=1.05;body.castShadow=true;creature.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.34,10,8),new THREE.MeshStandardMaterial({color:0x080a09}));head.position.set(0,1.85,-.25);creature.add(head);
 for(const x of [-.15,.15]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),new THREE.MeshBasicMaterial({color:0xff3322}));eye.position.set(x,1.9,-.55);creature.add(eye)}
 creature.position.set(20,0,-16);scene.add(creature);entities.push({group:creature,origin:new THREE.Vector3(20,0,-16),phase:0,speed:.75});
}
function schoolLabel(label,x,y,z){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,96);
 ctx.fillStyle='#243128';ctx.font='bold 40px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,128,48);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.4,.8),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));
 mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y+.025,z);worldGroup.add(mesh);
}
function schoolRoom(label,x,z,w,d,y=0,doorSide='south',height=3.15){
 schoolBox(w,.16,d,schoolMat.room,x,y-.16,z);
 const t=.18,door=1.15;
 if(doorSide==='south'){
  schoolBox(w,height,t,schoolMat.wall,x,y,z+d/2-t/2);
  schoolBox((w-door)/2,height,t,schoolMat.wall,x-w/2+(w-door)/4,y,z-d/2+t/2);
  schoolBox((w-door)/2,height,t,schoolMat.wall,x+w/2-(w-door)/4,y,z-d/2+t/2);
  schoolBox(door,.08,t,schoolMat.door,x,y+1.05,z-d/2+t/2);
 }else{
  schoolBox(w,height,t,schoolMat.wall,x,y,z-d/2+t/2);
  schoolBox((w-door)/2,height,t,schoolMat.wall,x-w/2+(w-door)/4,y,z+d/2-t/2);
  schoolBox((w-door)/2,height,t,schoolMat.wall,x+w/2-(w-door)/4,y,z+d/2-t/2);
  schoolBox(door,.08,t,schoolMat.door,x,y+1.05,z+d/2-t/2);
 }
 schoolBox(t,height,d,schoolMat.wall,x-w/2+t/2,y,z);
 schoolBox(t,height,d,schoolMat.wall,x+w/2-t/2,y,z);
 // Realistic classroom finish: ceiling panels, window glazing, skirting, a teaching board,
 // desks, chairs, ceiling lights and a teacher's desk. All props are lightweight meshes.
 const ceiling=new THREE.Mesh(new THREE.BoxGeometry(w,.12,d),schoolMat.ceiling);
 ceiling.position.set(x,y+height-.06,z);ceiling.receiveShadow=true;worldGroup.add(ceiling);
 const trim=mat('#e9e4d8');
 for(const side of [-1,1]){
   const winW=Math.max(.75,Math.min(1.45,(w-.6)/3));
   for(let i=0;i<Math.min(3,Math.floor((w-.5)/1.5));i++){
     const wx=x-w/2+.55+winW/2+i*(winW+.18);
     const frame=new THREE.Mesh(new THREE.BoxGeometry(winW,.95,.06),schoolMat.glass);
     frame.position.set(wx,y+2.05,z+side*(d/2-.12));worldGroup.add(frame);
     const mullion=new THREE.Mesh(new THREE.BoxGeometry(.045,1,.08),schoolMat.side);mullion.position.set(wx,y+2.05,z+side*(d/2-.12));worldGroup.add(mullion);
     for(const yy of [1.55,2.55]){const rail=new THREE.Mesh(new THREE.BoxGeometry(winW,.045,.08),trim);rail.position.set(wx,y+yy,z+side*(d/2-.12));worldGroup.add(rail)}
   }
 }
 // Front teaching wall with a green board and bright white projection screen.
 const board=new THREE.Mesh(new THREE.BoxGeometry(Math.min(w-0.7,2.5),1.05,.09),schoolMat.board);
 board.position.set(x,y+1.95,z+(doorSide==='south'?-1:1)*(d/2-.22));worldGroup.add(board);
 const boardFrame=new THREE.Mesh(new THREE.BoxGeometry(Math.min(w-.58,2.65),1.15,.06),schoolMat.desk);
 boardFrame.position.set(board.position.x,board.position.y,board.position.z+.055);worldGroup.add(boardFrame);board.position.z-=.04;
 const rows=Math.max(1,Math.min(3,Math.floor((d-1.1)/1.15)));
 const cols=Math.max(1,Math.min(4,Math.floor((w-1.0)/1.2)));
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const dx=x-(cols-1)*.53+col*1.06;
   const dz=z-(rows-1)*.48+row*.96;
   // Leave a clear route from the doorway to the board.
   if(doorSide==='south'&&row===0&&Math.abs(dx-x)<.65)continue;
   const top=new THREE.Mesh(new THREE.BoxGeometry(.78,.09,.48),schoolMat.desk);top.position.set(dx,y+.83,dz);top.castShadow=true;worldGroup.add(top);
   for(const lx of [-.31,.31])for(const lz of [-.17,.17]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.045,.76,.045),schoolMat.metal);leg.position.set(dx+lx,y+.42,dz+lz);worldGroup.add(leg)}
   const seat=new THREE.Mesh(new THREE.BoxGeometry(.42,.07,.4),schoolMat.desk);seat.position.set(dx,y+.48,dz+.42);worldGroup.add(seat);
   const back=new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.06),schoolMat.desk);back.position.set(dx,y+.7,dz+.61);worldGroup.add(back);
 }
 const teacherDesk=new THREE.Mesh(new THREE.BoxGeometry(1.05,.12,.55),schoolMat.desk);teacherDesk.position.set(x,y+.88,z+(doorSide==='south'?1:-1)*(d/2-.8));worldGroup.add(teacherDesk);
 // Ceiling-mounted LED panels add a believable modern school interior.
 const lightCount=Math.max(1,Math.min(3,Math.floor(w/2.8)));
 for(let i=0;i<lightCount;i++){
   const panel=new THREE.Mesh(new THREE.BoxGeometry(.85,.055,.22),schoolMat.light);
   panel.position.set(x-(lightCount-1)*.85/2+i*.85,y+height-.16,z);worldGroup.add(panel);
   const glow=new THREE.PointLight(0xffdfaa,.32,5,2);glow.position.set(panel.position.x,y+height-.35,z);worldGroup.add(glow);
 }
 // Door leaf and handle sit inside the opening, rather than sealing it shut.
 const doorZ=z+(doorSide==='south'?-1:1)*(d/2-.19);
 const leaf=new THREE.Mesh(new THREE.BoxGeometry(.88,2.05,.07),schoolMat.door);leaf.position.set(x,y+1.03,doorZ);worldGroup.add(leaf);
 const handle=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),schoolMat.light);handle.position.set(x+.34,y+1.05,doorZ-.05);worldGroup.add(handle);
 schoolLabel(label,x,y,z);
}
function schoolCorridor(x,z,w,d,y=0){schoolBox(w,.16,d,schoolMat.corridor,x,y-.16,z);}
function schoolFloor(y,rooms,corridors){
 schoolBox(76,.22,56,schoolMat.floor,0,y-.22,0);
 // Floor-level wall trims make corridors and classroom edges read like a finished building.
 const skirting=schoolBox(76,.12,.08,schoolMat.side,0,y+.05,-27.55);skirting.castShadow=false;
 corridors.forEach(c=>schoolCorridor(c[0],c[1],c[2],c[3],y));
 rooms.forEach(r=>schoolRoom(r[0],r[1],r[2],r[3],r[4],y,r[5]||'south',r[6]||3.15));
 // Outer shell.
 schoolBox(76,3.2,.3,schoolMat.side,0,y,-27.8);
 schoolBox(76,3.2,.3,schoolMat.side,0,y,27.8);
 schoolBox(.3,3.2,56,schoolMat.side,-38,y,0);
 schoolBox(.3,3.2,56,schoolMat.side,38,y,0);
}
function schoolStairs(x,z,y){
 for(let i=0;i<12;i++)schoolBox(1.8,.16,.24,schoolMat.side,x,y+(i+.5)*.24,z+(i-6)*.24);
 schoolBox(.07,.85,3,schoolMat.side,x-1,y+1.4,z);
 schoolBox(.07,.85,3,schoolMat.side,x+1,y+1.4,z);
}
function buildSchoolMap(){
 // Ground floor: gyms and theatre at northwest, central corridor, numbered classrooms and southwest wing.
 schoolFloor(0,[
 ['028',-32,-21,4.5,3.2],['027',-32,-17.5,4.5,3.2],['026',-32,-14,4.5,3.2],['025',-32,-10.5,4.5,3.2],
 ['GYMZAAL 1 · 029',-20,-19,12,7.3,'south',5],['GYMZAAL 2 · 030',-20,-10.5,12,7.3,'south',5],['THEATER',-7,-18,8,12,'south',5],
 ['024',-31,1,5,5,'north'],['023',-21,8,4,3.4,'north'],['022',-21,12,4,3.4,'north'],['021',-21,16,4,3.4,'north'],['020',-21,20,4,3.4,'north'],['019',-21,23.7,4,3,'north'],['018',-21,26,4,2.3,'north'],
 ['ADMINISTRATIE',-13,11,7,4,'north'],['017',-5,11,3.6,4,'north'],['016',-1,11,3.6,4,'north'],['015',3,11,3.6,4,'north'],
 ['014',7,6,3.5,3.4],['013',11,7,3.4,3.8],['012',15,7,3.5,4],['011',20,7,4,4],['010',25,7,4,4],
 ['009',31,10,5,5],['008 · DRAMA',31,4,5,5],['007',31,-2,5,5],['006',25,-3,4,4],['005',20,-3,4,4],['004',15,-3,4,4],['003',10,-3,4,4],['002',2,2,8,3.4,'north'],['001',5,-3,4,4]
 ],[[0,0,70,5.5],[-20,-3,12,7],[-25,5,5,20],[-10,7,25,4],[11,2,36,4],[30,2,6,20]]);
 // First floor: rooms 101–119 and studio.
 schoolFloor(4,[
 ['116',-32,-20,4.5,3.2],['115',-32,-16.5,4.5,3.2],['114',-32,-13,4.5,3.2],['113',-32,-9.5,4.5,3.2],
 ['117',-22,-17,8,8],['118 · STUDIO',-15,-8,7,9],['119',-22,-3,8,3.4],
 ['112',-31,2,5,4,'north'],['111',-26,2,4,4,'north'],['110',-22,2,4,4,'north'],['109',-18,2,4,4,'north'],['108',-14,2,4,4,'north'],
 ['107',-30,11,4,4,'north'],['106',-30,15,4,4,'north'],['105',-30,19,4,4,'north'],['104',-30,23,4,4,'north'],
 ['PERSONEELSKAMER',-21,11,8,4,'north'],['103',-13,11,3.5,4,'north'],['102',-9,11,3.5,4,'north'],['101',-5,11,3.5,4,'north']
 ],[[0,0,66,6],[-23,0,5,20],[-20,5,14,4],[-20,10,22,4],[7,0,10,5]]);
 // Second floor: rooms 201–214 and tower.
 schoolFloor(8,[
 ['214',-30,-13,5,5],['213',-31,2,5,4,'north'],['212',-26,2,4,4,'north'],['211',-22,2,4,4,'north'],['210',-18,2,4,4,'north'],['209',-14,2,4,4,'north'],
 ['208',-28,8,3.5,3.4,'north'],['207',-28,12,3.5,3.4,'north'],['206',-23,10,5,5,'north'],['205',-17,10,4,4,'north'],['204',-13,10,4,4,'north'],['203',-9,10,4,4,'north'],['202',-5,10,4,4,'north'],['201 · TOREN',1,0,3,5]
 ],[[0,0,66,6],[-22,0,5,20],[-17,7,20,4],[4,0,8,5]]);
 schoolStairs(-8,0,0);schoolStairs(-8,0,4);
 schoolBox(3.8,.2,5,schoolMat.corridor,-8,3.8,0);
 schoolBox(3.8,.2,5,schoolMat.corridor,-8,7.8,0);
 schoolLabel('BEGANE GROND',0,0,25);schoolLabel('EERSTE VERDIEPING',0,4,25);schoolLabel('TWEEDE VERDIEPING',0,8,25);
 // Gatherable supplies in hallways.
 for(const [x,z] of [[-24,-1],[-16,0],[-3,0],[12,0],[24,1],[-26,9],[-10,8],[5,2],[18,-1],[28,5]]){
  const g=new THREE.Group();const b=new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,1.1,6),mats.wood);b.rotation.z=Math.PI/2;b.position.y=.13;g.add(b);registerResource(g,'wood',x,z,'Fallen wood');
 }
 for(const [x,z] of [[-29,-2],[-11,-1],[8,1],[21,0],[-24,7],[0,8],[14,7]]){
  const g=new THREE.Group();const r=new THREE.Mesh(new THREE.DodecahedronGeometry(.38,1),mats.rock);r.position.y=.35;g.add(r);registerResource(g,'stone',x,z,'Stone');
 }
}
function setupControls(){
  document.addEventListener('keydown',e=>{
    keys[e.code]=true;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    if(e.code==='KeyE')collectNearby();
    if(e.code==='KeyQ')drinkWater();
    if(e.code==='KeyF')buildCampfire();
    if(e.code==='KeyL'){flashlightOn=!flashlightOn;if(flashlight)flashlight.visible=flashlightOn;showToast(flashlightOn?'Flashlight on':'Flashlight off');}
    if(e.code==='KeyE'&&e.repeat)return;
    if(e.code==='Space')jump();
    if(e.code==='Escape'&&running){paused?resumeGame():pauseGame()}
  });
  document.addEventListener('keyup',e=>keys[e.code]=false);
  renderer.domElement.addEventListener('click',()=>{
    if(running&&!paused&&!dead&&!isMobile&&document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock?.();
  });
  document.addEventListener('mousemove',e=>{
    if(document.pointerLockElement===renderer.domElement&&running&&!paused){yaw-=e.movementX*.0022;pitch=clamp(pitch-e.movementY*.0018,-1.25,1.25)}
  });
  let touchStart=null;
  renderer.domElement.addEventListener('touchstart',e=>{
    if(!running||paused)return;
    const t=e.changedTouches[0];touchStart={x:t.clientX,y:t.clientY,id:t.identifier};
  },{passive:true});
  renderer.domElement.addEventListener('touchmove',e=>{
    if(!touchStart||!running||paused)return;
    const t=[...e.changedTouches].find(v=>v.identifier===touchStart.id);if(!t)return;
    const dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;
    if(t.clientX>innerWidth*.36){yaw-=dx*.005;pitch=clamp(pitch-dy*.004,-1.2,1.2)}
    touchStart={x:t.clientX,y:t.clientY,id:t.identifier};
  },{passive:true});
  renderer.domElement.addEventListener('touchend',()=>touchStart=null,{passive:true});
  const joy=$('joystick'),stick=$('stick');let joyId=null,joyCenter={x:0,y:0};
  joy.addEventListener('touchstart',e=>{e.preventDefault();const t=e.changedTouches[0];joyId=t.identifier;const r=joy.getBoundingClientRect();joyCenter={x:r.left+r.width/2,y:r.top+r.height/2};moveStick(t)},{passive:false});
  joy.addEventListener('touchmove',e=>{e.preventDefault();const t=[...e.changedTouches].find(t=>t.identifier===joyId);if(t)moveStick(t)},{passive:false});
  const endJoy=e=>{if([...e.changedTouches].some(t=>t.identifier===joyId)){joyId=null;keys.joyX=keys.joyY=0;stick.style.transform='translate(0,0)'}};
  joy.addEventListener('touchend',endJoy);joy.addEventListener('touchcancel',endJoy);
  function moveStick(t){const dx=t.clientX-joyCenter.x,dy=t.clientY-joyCenter.y,len=Math.hypot(dx,dy),max=34,k=len>max?max/len:1;keys.joyX=dx*k/max;keys.joyY=dy*k/max;stick.style.transform=`translate(${dx*k}px,${dy*k}px)`}
}

function startGame(){
  ui.menu.classList.add('hidden');ui.hud.classList.remove('hidden');if(isMobile)ui.mobile.classList.remove('hidden');
  running=true;paused=false;clock.getDelta();
  if(!isMobile)renderer.domElement.requestPointerLock?.();
  showToast('Welcome to Het Erasmus! Explore the school and gather supplies.');
}
function pauseGame(){if(!running||dead)return;paused=true;ui.pause.classList.remove('hidden');document.exitPointerLock?.()}
function resumeGame(){paused=false;ui.pause.classList.add('hidden');if(!isMobile)renderer.domElement.requestPointerLock?.();clock.getDelta()}
function showToast(msg){ui.toast.textContent=msg;ui.toast.classList.add('show');toastTimer=3.2}
function eatBerry(){
  if(!running||paused)return;
  if(state.berries<1){showToast('No berries in your pack. Find a berry bush.');return}
  state.berries--;state.hunger=clamp(state.hunger+22,0,100);state.health=clamp(state.health+3,0,100);showToast('You eat a handful of berries. Hunger restored.');
}
function drinkWater(){
  if(!running||paused)return;
  if(state.water<1){showToast('Your bottle is empty. Find the shoreline to refill.');return}
  state.water--;state.thirst=clamp(state.thirst+32,0,100);showToast('You take a drink from your bottle.');
}
function buildCampfire(){
  if(!running||paused)return;
  if(state.campfire){showToast('You already built a campfire. Keep it safe.');return}
  if(state.wood<5||state.stone<3){showToast(`Need ${Math.max(0,5-state.wood)} more wood and ${Math.max(0,3-state.stone)} more stone.`);return}
  state.wood-=5;state.stone-=3;state.campfire=true;
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.62,.7,.13,8),mats.bark);base.position.y=.15;g.add(base);
  for(let i=0;i<4;i++){const log=new THREE.Mesh(new THREE.CylinderGeometry(.09,.12,1.2,7),mats.wood);log.position.set(0,.24,0);log.rotation.z=Math.PI/2;log.rotation.y=i*Math.PI/4;g.add(log)}
  const flameMat=new THREE.MeshBasicMaterial({color:'#ff8c38',transparent:true,opacity:.88});
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.28,.9,7),flameMat);flame.position.y=.8;g.add(flame);
  const light=new THREE.PointLight('#ff8b3c',3,13);light.position.y=1;g.add(light);
  g.position.copy(player.pos);g.position.y=0;g.position.add(new THREE.Vector3(Math.sin(yaw)*2,0,-Math.cos(yaw)*2));scene.add(g);campfires.push({group:g,flame,light});
  ui.objective.textContent='Campfire built — survive until dawn';
  showToast('Campfire built. Its light will help you through the night.');
}
function collectNearby(){
  if(!running||paused||dead)return;
  if(nearby){const r=nearby.userData;
    if(r.type==='stone'){state.stone+=2;showToast('Collected stone. +2 stone')}
    else if(r.type==='berries'){state.berries+=3;showToast('Picked wild berries. +3 berries')}
    else if(r.type==='wood'){state.wood+=3;showToast('Gathered fallen wood. +3 wood')}
    r.collected=true;worldGroup.remove(nearby);resources=resources.filter(v=>v!==nearby);nearby=null;ui.interact.classList.add('hidden');updateUI();return;
  }
  // Collect from closest visible-ish fallen branch or rock.
  showToast('Move closer to a resource to collect it.');
}
function jump(){if(!running||paused||!player.onGround)return;player.vel.y=5.5;player.onGround=false}

function updatePlayer(dt){
  const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const move=new THREE.Vector3();
  if(keys.KeyW||keys.ArrowUp)move.add(forward);
  if(keys.KeyS||keys.ArrowDown)move.sub(forward);
  if(keys.KeyD||keys.ArrowRight)move.add(right);
  if(keys.KeyA||keys.ArrowLeft)move.sub(right);
  if(keys.joyY)move.addScaledVector(forward,-keys.joyY);
  if(keys.joyX)move.addScaledVector(right,keys.joyX);
  if(move.lengthSq()>0)move.normalize();
  const sprint=(keys.ShiftLeft||keys.ShiftRight)&&state.stamina>1;
  const speed=sprint?8.3:4.6;
  const oldX=player.pos.x,oldZ=player.pos.z;
  player.pos.addScaledVector(move,speed*dt);
  for(const c of colliders){
    if(player.pos.y>c.maxY+.4 || player.pos.y+1.7<c.minY)continue;
    const r=.34;
    if(player.pos.x+r>c.minX&&player.pos.x-r<c.maxX&&player.pos.z+r>c.minZ&&player.pos.z-r<c.maxZ){
      const tryX=player.pos.x;player.pos.x=oldX;
      if(!(player.pos.x+r>c.minX&&player.pos.x-r<c.maxX&&player.pos.z+r>c.minZ&&player.pos.z-r<c.maxZ))player.pos.x=tryX;else player.pos.z=oldZ;
    }
  }
  player.vel.y-=13*dt;player.pos.y+=player.vel.y*dt;
  if(player.pos.y<1.7){player.pos.y=1.7;player.vel.y=0;player.onGround=true}
  player.pos.x=clamp(player.pos.x,-36,36);player.pos.z=clamp(player.pos.z,-25,26);
  if(sprint&&move.lengthSq()>0)state.stamina=clamp(state.stamina-19*dt,0,100);else state.stamina=clamp(state.stamina+12*dt,0,100);
  camera.position.copy(player.pos);camera.rotation.set(pitch,yaw,0,'YXZ');
}
function updateNeeds(dt){
  elapsed+=dt;
  state.hunger=clamp(state.hunger-.22*dt,0,100);state.thirst=clamp(state.thirst-.34*dt,0,100);
  if(state.hunger<=0||state.thirst<=0)state.health=clamp(state.health-2.4*dt,0,100);
  if(state.hunger>70&&state.thirst>70&&state.health<100)state.health=clamp(state.health+.25*dt,0,100);
  const secondsPerDay=240, total=elapsed%secondsPerDay, dayNow=Math.floor(elapsed/secondsPerDay)+1;
  if(dayNow!==day){day=dayNow;$('dayNum').textContent=day;showToast(`Day ${day}. The wilderness waits.`)}
  const hour=(7+total/secondsPerDay*24)%24;
  $('timeLabel').textContent=`${String(Math.floor(hour)).padStart(2,'0')}:${String(Math.floor((hour%1)*60)).padStart(2,'0')}`;
  const night=Math.max(0,Math.sin((hour-18)/24*Math.PI*2));
  scene.fog.density=.038+night*.018;
  scene.background.setRGB(.012+night*.006,.018+night*.008,.014+night*.006);
  scene.children.forEach(o=>{if(o.isDirectionalLight)o.intensity=.12;});
  $('weatherLabel').textContent=night>.5?'NIGHTFALL':'MISTY';
  if(state.health<=0&&!dead){dead=true;running=false;document.exitPointerLock?.();$('finalDay').textContent=`Day ${day}`;ui.over.classList.remove('hidden');ui.mobile.classList.add('hidden')}
  updateUI();
}
function updateUI(){
  for(const [key,id] of [['health','health'],['hunger','hunger'],['thirst','thirst'],['stamina','stamina']]){
    $(id+'Bar').style.width=state[key]+'%';$(id+'Val').textContent=Math.round(state[key]);
  }
  $('woodVal').textContent=state.wood;$('stoneVal').textContent=state.stone;$('berryVal').textContent=state.berries;
  $('drinkBtn').innerHTML=`Drink water <kbd>Q</kbd><small>${state.water} sips</small>`;
  if(state.campfire)ui.objective.textContent='Campfire built — survive until dawn';
  else if(state.wood>=5&&state.stone>=3)ui.objective.textContent='You have enough supplies — build a campfire';
  else ui.objective.textContent=`Gather supplies (${state.wood}/5 wood · ${state.stone}/3 stone)`;
}
const raycaster=new THREE.Raycaster();
function findNearby(){
  nearby=null;let best=3.3;
  for(const r of resources){
    const p=r.position;const d=Math.hypot(p.x-player.pos.x,p.z-player.pos.z);
    if(d<best){best=d;nearby=r}
  }
  if(nearby){ui.interact.classList.remove('hidden');ui.interact.textContent=isMobile?'[ E ] Collect '+nearby.userData.label:'[ E ] Collect '+nearby.userData.label}
  else ui.interact.classList.add('hidden');
}
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.04);
  if(running&&!paused&&!dead){updatePlayer(dt);updateNeeds(dt);findNearby();if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.remove('show')}}
  for(const f of campfires){f.flame.scale.y=rand(.8,1.15);f.light.intensity=rand(2.2,3.5)}
  for(const e of entities){e.phase+=dt*e.speed;e.group.position.x=e.origin.x+Math.sin(e.phase*.55)*5;e.group.position.z=e.origin.z+Math.cos(e.phase*.7)*4;e.group.rotation.y=Math.atan2(Math.cos(e.phase*.55),-Math.sin(e.phase*.7));}
  renderer.render(scene,camera);
}
function onResize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?1.5:2))}
init();
