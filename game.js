const canvas=document.getElementById("gameCanvas"),ctx=canvas.getContext("2d"),$=id=>document.getElementById(id);
const W=1200,H=675,bg=new Image();bg.src="assets/underwater-cave.jpg";
const diverSprite=new Image();diverSprite.src="assets/diver-sprite.png";
let state="menu",last=0,score=0,lives=3,oxygen=100,oxygenLost=0,depth=0,scroll=0,spawn=0,invuln=0,level=1,shieldTime=0;

let bestScore = 0;
try { bestScore = Number(localStorage.getItem("oceanAdventureBestScore")) || 0; } catch (error) { bestScore = 0; }
const keys={},diver={x:185,y:300,w:150,h:105,vy:0};let objects=[],bubbles=[],particles=[];
function clearInputs(){Object.keys(keys).forEach(k=>keys[k]=false);document.querySelectorAll(".touch-btn.active").forEach(button=>button.classList.remove("active"));}
for(let i=0;i<42;i++)bubbles.push({x:Math.random()*W,y:Math.random()*H,r:2+Math.random()*6,s:20+Math.random()*45});

// ---------------- SOUND EFFECTS (Web Audio API) ----------------
// Audio is initialized from a user click because browsers block autoplay.
let audioCtx = null;
let masterVolume = null;
let soundOn = true;
let ambienceNodes = [];

function initAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    notify("Audio is not supported by this browser");
    return false;
  }
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
    masterVolume = audioCtx.createGain();
    masterVolume.gain.value = soundOn ? 0.65 : 0;
    masterVolume.connect(audioCtx.destination);

    // Gentle, low-volume underwater ambience.
    const ambienceGain = audioCtx.createGain();
    ambienceGain.gain.value = 0.035;
    const lowPass = audioCtx.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 260;
    lowPass.connect(ambienceGain);
    ambienceGain.connect(masterVolume);

    [48, 63].forEach((hz, index) => {
      const oscillator = audioCtx.createOscillator();
      const level = audioCtx.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = hz;
      level.gain.value = index === 0 ? 0.45 : 0.18;
      oscillator.connect(level);
      level.connect(lowPass);
      oscillator.start();
      ambienceNodes.push(oscillator);
    });
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  startBackgroundMusic();
  return true;
}

function setSound(on) {
  soundOn = on;
  if (masterVolume && audioCtx) {
    masterVolume.gain.setTargetAtTime(on ? 0.65 : 0, audioCtx.currentTime, 0.04);
    if (on && audioCtx.state === "running") startBackgroundMusic();
  }
  const button = $("sound");
  if (button) {
    button.textContent = on ? "♫" : "♪̸";
    button.title = on ? "Mute sound" : "Enable sound";
    button.setAttribute("aria-label", button.title);
    button.classList.toggle("muted", !on);
  }
}

function playTone(startHz, endHz, duration, type = "sine", volume = 0.12) {
  if (!soundOn || !audioCtx || !masterVolume || audioCtx.state !== "running") return;
  const now = audioCtx.currentTime;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(1, startHz), now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(masterVolume);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function playSound(eventName) {
  if (!soundOn || !audioCtx || audioCtx.state !== "running") return;
  switch (eventName) {
    case "start":
      playTone(440, 660, 0.16); 
      window.setTimeout(() => playTone(660, 880, 0.18), 110);
      break;
    case "pearl":
      playTone(620, 980, 0.14, "sine", 0.10);
      break;
    case "gold":
      playTone(740, 1180, 0.20, "triangle", 0.13);
      window.setTimeout(() => playTone(990, 1480, 0.20), 100);
      break;
    case "chest":
      playTone(390, 650, 0.18, "triangle", 0.14);
      window.setTimeout(() => playTone(650, 1050, 0.24), 130);
      break;
    case "shield":
      playTone(520, 860, 0.18, "sine", 0.12);
      window.setTimeout(() => playTone(860, 1120, 0.22, "triangle", 0.09), 100);
      break;
    case "oxygen":
      playTone(330, 520, 0.15);
      window.setTimeout(() => playTone(520, 820, 0.20), 120);
      break;
    case "hit":
      // Soft, muffled underwater impact: a low thump followed by a small bubble-like tone.
      playTone(145, 72, 0.22, "sine", 0.17);
      window.setTimeout(() => playTone(260, 155, 0.16, "sine", 0.055), 55);
      break;
    case "gameover":
      playTone(330, 110, 0.55, "triangle", 0.13);
      break;
  }
}


let musicTimer = null;
let musicStep = 0;

// A calm, repeating ambient phrase using soft sine/triangle tones.
const underwaterMelody = [
  [392.00, 0.22], [523.25, 0.18], [440.00, 0.20], [587.33, 0.18],
  [493.88, 0.20], [659.25, 0.16], [440.00, 0.22], [523.25, 0.18],
  [349.23, 0.22], [440.00, 0.18], [392.00, 0.20], [523.25, 0.18],
  [329.63, 0.22], [392.00, 0.18], [440.00, 0.20], [392.00, 0.24]
];

function playBackgroundNote() {
  if (!audioCtx || !soundOn || audioCtx.state !== "running" || !masterVolume) return;

  const [frequency, duration] = underwaterMelody[musicStep % underwaterMelody.length];
  const now = audioCtx.currentTime;

  const oscillator = audioCtx.createOscillator();
  const noteGain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, now);
  filter.type = "lowpass";
  filter.frequency.value = 1100;

  // Quiet, soft attack and release so the melody stays in the background.
  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.linearRampToValueAtTime(0.026, now + 0.12);
  noteGain.gain.setValueAtTime(0.026, now + duration * 0.55);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(filter);
  filter.connect(noteGain);
  noteGain.connect(masterVolume);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);

  // A very soft octave shimmer adds a little underwater sparkle.
  if (musicStep % 4 === 0) {
    const sparkle = audioCtx.createOscillator();
    const sparkleGain = audioCtx.createGain();
    sparkle.type = "sine";
    sparkle.frequency.value = frequency * 2;
    sparkleGain.gain.setValueAtTime(0.0001, now);
    sparkleGain.gain.linearRampToValueAtTime(0.008, now + 0.10);
    sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    sparkle.connect(sparkleGain);
    sparkleGain.connect(masterVolume);
    sparkle.start(now);
    sparkle.stop(now + 0.5);
  }

  musicStep++;
}

function startBackgroundMusic() {
  if (!audioCtx || musicTimer !== null) return;
  playBackgroundNote();
  musicTimer = window.setInterval(playBackgroundNote, 620);
}

function hud(){$("score").textContent=String(score).padStart(5,"0");$("level").textContent=level;$("bestScore").textContent=String(bestScore).padStart(5,"0");$("shieldStatus").textContent=shieldTime>0?Math.ceil(shieldTime)+"s":"—";$("lives").textContent=lives;$("oxygenText").textContent=Math.ceil(oxygen)+"%";$("oxygenBar").style.width=oxygen+"%";$("depth").textContent=Math.floor(depth/10)+" m";$("oxygenBar").style.background=oxygen<25?"linear-gradient(90deg,#ff648c,#ffb45f)":"linear-gradient(90deg,#56e9be,#9affdf)";}
function reset(){score=0;lives=3;oxygen=100;oxygenLost=0;depth=0;scroll=0;spawn=0;invuln=0;level=1;shieldTime=0;objects=[];particles=[];diver.x=185;diver.y=300;diver.vy=0;hud();}
function show(title,msg,button){
  if(state==="over")clearInputs();
  $("panelTitle").innerHTML=title;
  $("panelText").textContent=msg;
  $("play").innerHTML=button+" <b>→</b>";

  // Use a different label and layout for each overlay state.
  const isGameOver = state === "over";
  $("panelKicker").textContent = isGameOver
    ? "DIVE SUMMARY"
    : state === "paused"
      ? "DIVE PAUSED"
      : "YOUR UNDERWATER JOURNEY BEGINS";

  // Controls are useful on the start/pause screens, but clutter the result screen.
  $("keyGuide").style.display = isGameOver ? "none" : "flex";
  const results = $("resultStats");
  results.classList.toggle("hidden", !isGameOver);
  if(isGameOver){
    $("finalScore").textContent=String(score).padStart(5,"0");
    $("finalBest").textContent=String(bestScore).padStart(5,"0");
    $("finalLevel").textContent=level;
    $("finalDistance").textContent=Math.floor(depth/10)+" m";
    $("finalOxygen").textContent=Math.floor(oxygenLost)+"%";
    $("recordMessage").textContent=score>=bestScore && score>0 ? "✦ NEW PERSONAL BEST! ✦" : "KEEP EXPLORING — YOUR NEXT RECORD AWAITS";
  }
  $("overlay").classList.remove("hidden");
}
function start(){initAudio();setSound(soundOn);reset();state="playing";$("overlay").classList.add("hidden");playSound("start");last=performance.now();requestAnimationFrame(loop);}
function pause(){if(state==="playing"){state="paused";clearInputs();show("Take a <em>Breather</em>","Your dive is paused. Resume when you're ready.","RESUME DIVE");}else if(state==="paused"){state="playing";$("overlay").classList.add("hidden");last=performance.now();requestAnimationFrame(loop);}}
$("play").onclick=()=>state==="paused"?pause():start();$("pause").onclick=pause;
$("sound").onclick=()=>{initAudio();setSound(!soundOn);};
window.addEventListener("keydown",e=>{if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();keys[e.code]=true;if((e.code==="KeyP"||e.code==="Escape")&&!e.repeat)pause();});
window.addEventListener("keyup",e=>keys[e.code]=false);window.addEventListener("blur",clearInputs);

// Mobile touch controls: hold a direction to keep swimming that way.
document.querySelectorAll(".touch-btn").forEach(button=>{
  const key=button.dataset.key;
  const release=()=>{
    keys[key]=false;
    button.classList.remove("active");
  };
  button.addEventListener("pointerdown",event=>{
    event.preventDefault();
    keys[key]=true;
    button.classList.add("active");
    try { button.setPointerCapture(event.pointerId); } catch(error) {}
  });
  button.addEventListener("pointerup",release);
  button.addEventListener("pointercancel",release);
  button.addEventListener("lostpointercapture",release);
  button.addEventListener("contextmenu",event=>event.preventDefault());
});

function spawnObject(){
  const r=Math.random();
  let type;
  if(r<.30) type="pearl";
  else if(r<.38) type="goldPearl";
  else if(r<.44) type="chest";
  else if(r<.60) type="mine";
  else if(r<.70) type="tank";
  else if(r<.78) type="shield";
  else if(r<.90) type="shark";
  else type="jellyfish";

  const dimensions = {
    pearl:[30,30], goldPearl:[34,34], chest:[52,42],
    star:[35,35], gold:[35,35], mine:[47,47], tank:[31,36],
    shark:[92,52], jellyfish:[54,70], shield:[38,42]
  };
  const [w,h]=dimensions[type];
  const baseY=100+Math.random()*(H-230);
  objects.push({
    type,x:W+60,y:baseY,w,h,phase:Math.random()*Math.PI*2,
    baseY,wave:35+Math.random()*35,direction:-1
  });
}
function overlaps(a,b){return a.x+28<b.x+b.w&&a.x+a.w-25>b.x&&a.y+18<b.y+b.h&&a.y+a.h-15>b.y;}
function notify(msg){let t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>t.classList.remove("show"),850);}
function burst(x,y){for(let i=0;i<12;i++)particles.push({x,y,vx:(Math.random()-.5)*180,vy:(Math.random()-.6)*180,t:.6});}
function collect(o){
  const oldLevel=level;
  if(o.type==="pearl"){
    score+=10;burst(o.x,o.y);playSound("pearl");notify("+10 PEARL");
  }else if(o.type==="goldPearl"){
    score+=30;burst(o.x,o.y);playSound("gold");notify("+30 GOLDEN PEARL");
  }else if(o.type==="chest"){
    score+=50;burst(o.x,o.y);playSound("chest");notify("+50 TREASURE CHEST");
  }else if(o.type==="star"){
    score+=10;burst(o.x,o.y);notify("+10 STAR");
  }else if(o.type==="gold"){
    score+=50;burst(o.x,o.y);notify("+50 GOLDEN STAR");
  }else if(o.type==="tank"){
    oxygen=Math.min(100,oxygen+30);burst(o.x,o.y);playSound("oxygen");notify("OXYGEN +30%");
  }else if(o.type==="shield"){
    shieldTime=8;burst(o.x,o.y);playSound("shield");notify("SHIELD ACTIVATED — 8 SECONDS");
  }else if(shieldTime>0){
    shieldTime=0;burst(diver.x+diver.w/2,diver.y+diver.h/2);playSound("shield");notify("SHIELD ABSORBED THE HIT!");
  }else if(invuln<=0){
    lives--;
    playSound("hit");
    invuln=1.5;
    diver.vy=-180;
    notify(o.type==="shark"?"SHARK ATTACK!":o.type==="jellyfish"?"JELLYFISH STING!":"MINE HIT!");
    if(lives<=0){
      state="over";
      show("Dive <em>Complete</em>",`Final score: ${score} · Distance: ${Math.floor(depth/10)} m · Oxygen used: ${Math.floor(oxygenLost)}%`,"DIVE AGAIN");
    }
  }
  level=Math.min(5,Math.floor(score/100)+1);
  if(score>bestScore){
    bestScore=score;
    try { localStorage.setItem("oceanAdventureBestScore",String(bestScore)); } catch (error) { /* Storage may be disabled. */ }
  }
  if(level>oldLevel){playSound("gold");notify("LEVEL "+level+" — DIVE FASTER!");}
  hud();
}
function update(dt){let speed=250+(level-1)*35+Math.min(40,(score%100)*.4);scroll+=speed*dt;depth+=speed*dt;const oxygenDrain=Math.min(oxygen,4*dt);oxygen-=oxygenDrain;oxygenLost+=oxygenDrain;if(oxygen<=0){oxygen=0;if(invuln<=0){lives--;playSound("hit");oxygen=30;invuln=1.5;notify("OXYGEN LOW!");if(lives<=0){playSound("gameover");state="over";show("Out of <em>Oxygen</em>",`Final score: ${score} · Oxygen used: ${Math.floor(oxygenLost)}%`,"TRY AGAIN");}}}if(invuln>0)invuln-=dt;if(shieldTime>0)shieldTime=Math.max(0,shieldTime-dt);
if(keys.ArrowUp||keys.KeyW||keys.Space)diver.vy-=540*dt;if(keys.ArrowDown||keys.KeyS)diver.vy+=540*dt;if(keys.ArrowLeft||keys.KeyA)diver.x-=270*dt;if(keys.ArrowRight||keys.KeyD)diver.x+=270*dt;diver.vy+=85*dt;diver.vy*=Math.pow(.14,dt);diver.y+=diver.vy*dt;diver.x=Math.max(25,Math.min(W-diver.w-25,diver.x));diver.y=Math.max(70,Math.min(H-105,diver.y));
spawn+=dt;if(spawn>Math.max(.48,1.15-(level-1)*.12)){spawnObject();spawn=0;}objects.forEach(o=>{
  o.x-=speed*dt;
  o.phase+=dt*(o.type==="shark"?2.6:o.type==="jellyfish"?2:3);
  if(o.type==="shark"){
    o.y=o.baseY+Math.sin(o.phase)*o.wave*.45;
  }else if(o.type==="jellyfish"){
    o.y=o.baseY+Math.sin(o.phase)*o.wave;
  }
  if(overlaps(diver,o)){collect(o);o.dead=true;}
});objects=objects.filter(o=>!o.dead&&o.x>-70);
bubbles.forEach(b=>{b.y-=b.s*dt;b.x-=b.s*.25*dt;if(b.y<-10){b.y=H+10;b.x=Math.random()*W;}});particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.t-=dt;});particles=particles.filter(p=>p.t>0);hud();}
function drawDiver(){
  const now = performance.now();
  if(invuln>0 && Math.floor(now/90)%2===0) return;

  // Gentle swimming cycle: body bob, fin-kick pulse and pitch.
  const swim = Math.sin(now/125);
  const bob = Math.sin(now/190)*3.2;
  const movingVertically = Math.abs(diver.vy) > 12;
  const pitch = Math.max(-0.13, Math.min(0.13, diver.vy/950));
  const kick = swim * 0.035;
  const facingLeft = !!(keys.ArrowLeft || keys.KeyA) &&
                     !(keys.ArrowRight || keys.KeyD);

  const x = diver.x;
  const y = diver.y + bob;
  const cx = x + diver.w*0.48;
  const cy = y + diver.h*0.50;

  // Soft protective bubble glow.
  const aura = ctx.createRadialGradient(cx,cy,24,cx,cy,88);
  aura.addColorStop(0,"#7cf5ff00");
  aura.addColorStop(.78,"#7cf5ff0a");
  aura.addColorStop(.91,"#f18de044");
  aura.addColorStop(1,"#70eaff00");
  ctx.fillStyle=aura;
  ctx.beginPath();
  ctx.arc(cx,cy,88,0,Math.PI*2);
  ctx.fill();
  ctx.strokeStyle="#f4a7f577";
  ctx.lineWidth=2.5;
  ctx.beginPath();
  ctx.arc(cx,cy,81,0,Math.PI*2);
  ctx.stroke();

  if(shieldTime>0){
    const pulse= Math.sin(now/110)*4;
    ctx.save();
    ctx.strokeStyle="#7ceeffcc";ctx.lineWidth=4;ctx.shadowColor="#55ddff";ctx.shadowBlur=22;
    ctx.beginPath();ctx.ellipse(cx,cy,diver.w*.66+pulse,diver.h*.72+pulse,0,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#71eaff12";ctx.fill();ctx.restore();
  }

  // Tiny bubble trail behind the diver, pulsing with each swimming kick.
  const trailX = facingLeft ? x+diver.w+8 : x-8;
  for(let i=0;i<4;i++){
    const phase = now/150 + i*1.7;
    const bx = trailX + Math.sin(phase)*5;
    const by = y + 34 + i*13 + Math.cos(phase)*3;
    const radius = 2.2 + (i%2)*1.2;
    ctx.globalAlpha = .48 - i*.08;
    ctx.strokeStyle = "#d9ffff";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(bx,by,radius,0,Math.PI*2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Animate the illustrated diver with a gentle kick/pitch cycle.
  // Flip the complete sprite when the player swims left.
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(pitch + kick);
  ctx.scale(facingLeft ? -1 : 1, 1 + Math.abs(swim)*0.012);
  if(diverSprite.complete && diverSprite.naturalWidth){
    ctx.drawImage(diverSprite,-diver.w*0.5,-diver.h*0.5,diver.w,diver.h);
  }else{
    ctx.fillStyle="#f2ae80";
    ctx.beginPath();
    ctx.arc(diver.w*.17,-diver.h*.22,18,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle="#17466b";
    ctx.fillRect(-diver.w*.3,-diver.h*.12,diver.w*.55,diver.h*.3);
  }
  ctx.restore();
}function drawMine(o){let x=o.x+o.w/2,y=o.y+o.h/2;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(o.phase)*.1);ctx.shadowColor="#ffc76c";ctx.shadowBlur=12;ctx.fillStyle="#b8894d";ctx.strokeStyle="#382b24";ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;for(let i=0;i<8;i++){ctx.rotate(Math.PI/4);ctx.fillStyle="#d8a75f";ctx.beginPath();ctx.moveTo(13,-5);ctx.lineTo(27,0);ctx.lineTo(13,5);ctx.closePath();ctx.fill();ctx.stroke();}ctx.restore();}
function drawStar(o){ctx.save();ctx.translate(o.x+o.w/2,o.y+o.h/2);ctx.rotate(Math.sin(o.phase)*.13);ctx.shadowColor="#ffd35d";ctx.shadowBlur=18;ctx.fillStyle=o.type==="gold"?"#ffb42e":"#ffdb4e";ctx.strokeStyle="#79431d";ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<10;i++){let a=-Math.PI/2+i*Math.PI/5,r=i%2?9:21;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}
function drawPearl(o,golden=false){
  const cx=o.x+o.w/2, cy=o.y+o.h/2+Math.sin(o.phase*2)*2;
  const radius=Math.min(o.w,o.h)*.36;
  ctx.save();
  ctx.translate(cx,cy);
  ctx.shadowColor=golden?"#ffd45e":"#c9fbff";
  ctx.shadowBlur=golden?20:15;
  const grad=ctx.createRadialGradient(-radius*.35,-radius*.4,2,0,0,radius*1.25);
  if(golden){
    grad.addColorStop(0,"#fff8c9");grad.addColorStop(.35,"#ffe27a");
    grad.addColorStop(.75,"#e8a92e");grad.addColorStop(1,"#a96719");
  }else{
    grad.addColorStop(0,"#ffffff");grad.addColorStop(.38,"#e9ffff");
    grad.addColorStop(.78,"#9de7f1");grad.addColorStop(1,"#4aa4bb");
  }
  ctx.fillStyle=grad;
  ctx.strokeStyle=golden?"#9b641c":"#4b9eae";
  ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;
  ctx.fillStyle="#ffffffaa";
  ctx.beginPath();ctx.ellipse(-radius*.34,-radius*.38,radius*.22,radius*.13,-.5,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function drawTreasureChest(o){
  const bob=Math.sin(o.phase*2)*2;
  ctx.save();ctx.translate(o.x,o.y+bob);
  ctx.shadowColor="#ffbd4a";ctx.shadowBlur=14;
  // Rounded wooden lid.
  ctx.fillStyle="#9a552b";ctx.strokeStyle="#4b2b24";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(5,19);ctx.lineTo(9,8);
  ctx.quadraticCurveTo(26,-5,43,8);ctx.lineTo(48,19);ctx.closePath();
  ctx.fill();ctx.stroke();
  // Chest body.
  const wood=ctx.createLinearGradient(0,17,0,42);
  wood.addColorStop(0,"#d88a3e");wood.addColorStop(1,"#8b421f");
  ctx.fillStyle=wood;
  ctx.beginPath();ctx.roundRect(4,17,45,24,5);ctx.fill();ctx.stroke();
  // Gold bands and lock.
  ctx.shadowBlur=0;ctx.fillStyle="#f8c64d";
  ctx.fillRect(12,16,5,26);ctx.fillRect(36,16,5,26);
  ctx.fillStyle="#ffe48a";ctx.strokeStyle="#8a5a1e";ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(22,22,10,12,3);ctx.fill();ctx.stroke();
  ctx.fillStyle="#80501c";ctx.beginPath();ctx.arc(27,27,1.8,0,Math.PI*2);ctx.fill();
  // Sparkles above the chest.
  ctx.fillStyle="#fff0a8";
  for(let i=0;i<3;i++){
    const sx=9+i*17, sy=3+Math.sin(o.phase*2+i)*3;
    ctx.beginPath();ctx.arc(sx,sy,1.8,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawShark(o){
  const cx=o.x+o.w/2, cy=o.y+o.h/2;
  const tailSwing=Math.sin(o.phase*3.2)*7;

  ctx.save();
  ctx.translate(cx,cy);
  // Sharks enter from the right and face the diver.
  ctx.scale(o.direction || -1,1);

  // Tail fin, animated from its base.
  ctx.save();
  ctx.translate(-o.w*.34,0);
  ctx.rotate(Math.sin(o.phase*3.2)*.16);
  const tailGrad=ctx.createLinearGradient(-28,-24,5,24);
  tailGrad.addColorStop(0,"#294f70");
  tailGrad.addColorStop(.55,"#668da8");
  tailGrad.addColorStop(1,"#a8c3d1");
  ctx.fillStyle=tailGrad;
  ctx.strokeStyle="#183b57";
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.quadraticCurveTo(-17,-13,-34,-27);
  ctx.lineTo(-29,-3);
  ctx.quadraticCurveTo(-42,0,-34,27);
  ctx.quadraticCurveTo(-13,12,0,0);
  ctx.closePath();
  ctx.fill();ctx.stroke();
  ctx.restore();

  // Dorsal fin and lower fins sit behind the body.
  ctx.fillStyle="#426d8b";
  ctx.strokeStyle="#183b57";
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(-13,-10);
  ctx.quadraticCurveTo(-2,-31,12,-43);
  ctx.quadraticCurveTo(15,-24,29,-12);
  ctx.closePath();ctx.fill();ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-13,12);
  ctx.quadraticCurveTo(-3,28,13,34);
  ctx.lineTo(8,12);
  ctx.closePath();ctx.fill();ctx.stroke();

  // Main streamlined body with a soft blue-grey gradient.
  const bodyGrad=ctx.createLinearGradient(0,-o.h*.48,0,o.h*.48);
  bodyGrad.addColorStop(0,"#9bb9c9");
  bodyGrad.addColorStop(.42,"#668da8");
  bodyGrad.addColorStop(.72,"#426b89");
  bodyGrad.addColorStop(1,"#294e6c");
  ctx.shadowColor="#062c48";
  ctx.shadowBlur=9;
  ctx.fillStyle=bodyGrad;
  ctx.strokeStyle="#173b58";
  ctx.lineWidth=3.2;
  ctx.beginPath();
  ctx.moveTo(-o.w*.38,-1);
  ctx.bezierCurveTo(-o.w*.27,-o.h*.43,o.w*.12,-o.h*.47,o.w*.37,-o.h*.13);
  ctx.quadraticCurveTo(o.w*.52,0,o.w*.37,o.h*.13);
  ctx.bezierCurveTo(o.w*.12,o.h*.43,-o.w*.27,o.h*.37,-o.w*.38,1);
  ctx.closePath();
  ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;

  // Pale underside.
  ctx.fillStyle="#d9e8e9";
  ctx.beginPath();
  ctx.moveTo(-o.w*.27,o.h*.12);
  ctx.quadraticCurveTo(0,o.h*.35,o.w*.31,o.h*.12);
  ctx.quadraticCurveTo(o.w*.16,o.h*.27,-o.w*.12,o.h*.23);
  ctx.closePath();ctx.fill();

  // Pectoral fin on the visible side.
  const finGrad=ctx.createLinearGradient(-4,2,25,25);
  finGrad.addColorStop(0,"#789bb0");
  finGrad.addColorStop(1,"#345d7b");
  ctx.fillStyle=finGrad;
  ctx.strokeStyle="#1b425f";
  ctx.lineWidth=2.5;
  ctx.beginPath();
  ctx.moveTo(-2,5);
  ctx.quadraticCurveTo(13,4,31,12);
  ctx.quadraticCurveTo(18,24,3,26);
  ctx.quadraticCurveTo(6,15,-2,5);
  ctx.closePath();ctx.fill();ctx.stroke();

  // Three gill marks.
  ctx.strokeStyle="#315875";
  ctx.lineWidth=2;
  ctx.lineCap="round";
  for(let i=0;i<3;i++){
    const gx=-o.w*.06+i*6;
    ctx.beginPath();
    ctx.moveTo(gx,-8);
    ctx.quadraticCurveTo(gx-3,1,gx,9);
    ctx.stroke();
  }

  // Friendly but alert eye.
  ctx.fillStyle="#f5ffff";
  ctx.beginPath();ctx.arc(o.w*.28,-o.h*.12,4.1,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#102f48";
  ctx.beginPath();ctx.arc(o.w*.30,-o.h*.12,2.1,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#ffffff";
  ctx.beginPath();ctx.arc(o.w*.305,-o.h*.15,.8,0,Math.PI*2);ctx.fill();

  // Slight smile and small triangular teeth.
  ctx.strokeStyle="#17364e";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(o.w*.39,o.h*.025);
  ctx.quadraticCurveTo(o.w*.29,o.h*.16,o.w*.16,o.h*.12);
  ctx.stroke();
  ctx.fillStyle="#ffffff";
  for(let i=0;i<4;i++){
    const tx=o.w*.22+i*4;
    ctx.beginPath();
    ctx.moveTo(tx,o.h*.105);
    ctx.lineTo(tx+2,o.h*.15);
    ctx.lineTo(tx+4,o.h*.105);
    ctx.closePath();ctx.fill();
  }

  // Small water highlight along the back.
  ctx.strokeStyle="#d7f5ff99";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(-o.w*.20,-o.h*.25);
  ctx.quadraticCurveTo(o.w*.04,-o.h*.39,o.w*.25,-o.h*.20);
  ctx.stroke();

  ctx.restore();
}function drawJellyfish(o){
  const x=o.x+o.w/2, y=o.y+o.h*.38;
  const pulse=1+Math.sin(o.phase*2)*.07;
  ctx.save();
  ctx.translate(x,y);
  ctx.shadowColor="#ff8be8";
  ctx.shadowBlur=18;
  ctx.fillStyle="#d78be9";
  ctx.strokeStyle="#743d9c";
  ctx.lineWidth=3;
  ctx.beginPath();
  ctx.ellipse(0,0,o.w*.43* pulse,o.h*.31/pulse,0,Math.PI,0);
  ctx.quadraticCurveTo(o.w*.42,o.h*.26,0,o.h*.25);
  ctx.quadraticCurveTo(-o.w*.42,o.h*.26,-o.w*.43,0);
  ctx.fill();ctx.stroke();

  // Bright inner bell highlights.
  ctx.shadowBlur=0;
  ctx.fillStyle="#ffd4f8";
  ctx.globalAlpha=.7;
  ctx.beginPath();
  ctx.ellipse(-o.w*.12,-o.h*.08,o.w*.12,o.h*.10,-.3,0,Math.PI*2);
  ctx.fill();
  ctx.globalAlpha=1;

  // Four tentacles wave independently.
  for(let i=0;i<4;i++){
    const tx=(i-1.5)*o.w*.17;
    const sway=Math.sin(o.phase*2+i*1.4)*7;
    ctx.strokeStyle=i%2?"#f3a5ef":"#b96bdc";
    ctx.lineWidth=4;
    ctx.lineCap="round";
    ctx.beginPath();
    ctx.moveTo(tx,o.h*.18);
    ctx.bezierCurveTo(tx+sway,-o.h*.02,tx-sway,o.h*.48,tx+sway*.7,o.h*.72);
    ctx.stroke();
  }
  ctx.restore();
}
function drawObject(o){
  if(o.type==="shield"){
    ctx.save();
    ctx.translate(o.x+o.w/2,o.y+o.h/2);
    const pulse=1+Math.sin(o.phase*2)*.08;
    ctx.scale(pulse,pulse);
    ctx.shadowColor="#68eaff";ctx.shadowBlur=22;
    ctx.fillStyle="#167da8";ctx.strokeStyle="#baf8ff";ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(0,-19);ctx.lineTo(16,-12);ctx.lineTo(13,7);
    ctx.quadraticCurveTo(8,17,0,21);ctx.quadraticCurveTo(-8,17,-13,7);
    ctx.lineTo(-16,-12);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.shadowBlur=0;ctx.fillStyle="#eaffff";
    ctx.font="bold 18px Arial";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("✦",0,1);
    ctx.restore();
  }else if(o.type==="mine") drawMine(o);
  else if(o.type==="pearl") drawPearl(o,false);
  else if(o.type==="goldPearl") drawPearl(o,true);
  else if(o.type==="chest") drawTreasureChest(o);
  else if(o.type==="star"||o.type==="gold") drawStar(o);
  else if(o.type==="shark") drawShark(o);
  else if(o.type==="jellyfish") drawJellyfish(o);
  else{
    // Oxygen tank collectible.
    ctx.save();
    ctx.translate(o.x,o.y);
    ctx.fillStyle="#ff914d";ctx.strokeStyle="#713e36";ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(7,6,18,27,5);ctx.fill();ctx.stroke();
    ctx.fillStyle="#ffe8c8";ctx.fillRect(11,1,10,7);
    ctx.fillStyle="#eaffff";ctx.font="bold 10px Arial";ctx.fillText("O₂",8,23);
    ctx.restore();
  }
}
function drawScrollingBackground(){
  if(!bg.complete || !bg.naturalWidth){
    ctx.fillStyle="#087b95";
    ctx.fillRect(0,0,W,H);
    return;
  }

  // Move the cave more slowly than the foreground to create a parallax effect.
  // Alternating mirrored tiles keep the background continuous at the screen edges.
  const backgroundTravel = scroll * 0.32;
  const tileIndex = Math.floor(backgroundTravel / W);
  const offset = -(backgroundTravel % W);

  for(let i=-1; i<=2; i++){
    const index = tileIndex + i;
    const x = offset + i * W;

    ctx.save();
    if(Math.abs(index % 2) === 1){
      ctx.translate(x + W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(bg, 0, 0, W, H);
    }else{
      ctx.drawImage(bg, x, 0, W, H);
    }
    ctx.restore();
  }
}

function draw(){
  drawScrollingBackground();

  // Bubbles, collectibles and the diver are foreground elements.
  bubbles.forEach(b=>{
    ctx.strokeStyle="#d7ffff88";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
    ctx.stroke();
  });

  objects.forEach(drawObject);
  particles.forEach(p=>{
    ctx.globalAlpha=Math.max(0,p.t);
    ctx.fillStyle="#ffe58a";
    ctx.beginPath();
    ctx.arc(p.x,p.y,4,0,Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha=1;
  drawDiver();
}
function loop(now){if(state!=="playing")return;let dt=Math.min((now-last)/1000,.035);last=now;update(dt);draw();if(state==="playing")requestAnimationFrame(loop);}
bg.onload=draw;draw();

window.addEventListener("pagehide",clearInputs);
