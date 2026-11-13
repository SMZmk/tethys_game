// ======================================================================
// TETHYS UI — rendering, input, online move codes. Game rules live in logic.js.
// ======================================================================
"use strict";
let G=null;
let MODE={mode:"local",seat:0};                 // local hotseat, or online with my seat (0/1)
const UI={screen:"title",speed:1,side:0,handoff:false,busy:false,rolling:null,shown:null,
  focus:null,heading:null,pickCls:null,pickFac:null,pickCrew:null,share:null,shareText:"",msg:"",msgErr:false,joinMsg:"",lastSeenTurn:0};
const SAVE_KEY="tethys.v2";
const P_COLORS=["#ffcf4a","#5fd0ff"];
const ST_COLOR={NAV:"var(--nav)",ATK:"var(--atk)",ENG:"var(--eng)",ANY:"var(--any)"};
const PORTRAIT=["...hhhhhh...","..hhhhhhhh..",".hhhsssshhh.",".hhssssssh..","..sesssesa..","..ssssssss..",
  "...ssaass...","....ssss....","..uuuaauuu..",".uuuuaauuuu.","uuuauuuuauuu","uuuuuuuuuuuu"];
const HP_LOW=0.4;
const reduceMotion=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep=ms=>new Promise(r=>setTimeout(r,reduceMotion()?Math.min(ms,60):ms));
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const myTurn=()=>G&&G.st!=="over"&&(MODE.mode==="local"||actor(G)===MODE.seat);

// ---------------- SAVE / LOAD ----------------
function save(){ try{ localStorage.setItem(SAVE_KEY,JSON.stringify({seed:G.seed,moves:G.moves,mode:MODE.mode,seat:MODE.seat,share:UI.share,shareText:UI.shareText})); }catch(e){} }
function loadSave(){ try{ const d=JSON.parse(localStorage.getItem(SAVE_KEY)||"null"); return d&&d.seed?d:null; }catch(e){ return null; } }
function restore(d){
  try{ G=replay(d.seed,d.moves); }catch(e){ G=null; return false; }
  MODE={mode:d.mode||"local",seat:d.seat||0}; UI.share=d.share||null; UI.shareText=d.shareText||"";
  UI.screen="game"; UI.handoff=false; UI.lastSeenTurn=G.turn; return true;
}

// ---------------- MOVE CODES ----------------
// A code holds the seed and the whole move list, so it always resyncs both games.
const b64u={enc:b=>{ let s=""; for(const x of b) s+=String.fromCharCode(x); return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); },
  dec:s=>{ s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4) s+="="; const t=atob(s); return Uint8Array.from(t,c=>c.charCodeAt(0)); }};
async function pipe(bytes,stream){ const r=new Response(new Blob([bytes]).stream().pipeThrough(stream)); return new Uint8Array(await r.arrayBuffer()); }
async function encodeGame(seed,moves){
  const raw=new TextEncoder().encode(seed+"|"+moves.join(" "));
  try{ if(typeof CompressionStream!=="undefined") return "TETHYS-"+b64u.enc(await pipe(raw,new CompressionStream("deflate-raw"))); }catch(e){}
  return "TETHYS0-"+b64u.enc(raw);
}
async function decodeGame(text){
  const m=String(text).match(/TETHYS(0?)-([A-Za-z0-9_-]+)/);
  if(!m) throw new Error("No move code found. Paste the whole message your friend sent.");
  let bytes=b64u.dec(m[2]);
  if(!m[1]) bytes=await pipe(bytes,new DecompressionStream("deflate-raw"));
  const s=new TextDecoder().decode(bytes), i=s.indexOf("|");
  const seed=+s.slice(0,i), moves=s.slice(i+1).split(" ").filter(Boolean);
  if(!seed) throw new Error("This code is damaged.");
  return {seed,moves};
}
async function makeShare(){
  const ps=plies(G.seed,G.moves), last=ps[ps.length-1];
  UI.share=await encodeGame(G.seed,G.moves); UI.msg=""; UI.msgErr=false;
  UI.shareText=`Tethys · move ${ps.length} · P${last.who+1}: ${plyText(last)}\n${UI.share}`;
  save(); render();
}

// ---------------- PLAYING MOVES ----------------
async function act(m){
  if(UI.busy||!myTurn()) return;
  if(!legal(G).includes(m)) return;
  const before=actor(G);
  apply(G,m); const evs=G.ev; G.ev=[]; UI.heading=null; UI.pickCls=null; UI.pickFac=null; UI.pickCrew=null;
  save();
  await present(evs);
  if(MODE.mode==="online"&&before===MODE.seat&&actor(G)!==MODE.seat) await makeShare();
  render();
}
async function present(evs){
  if(!evs.length){ return; }
  UI.busy=true; document.body.classList.add("busy");
  for(const e of evs){
    if(e.t==="move"){ disp[e.pid]={q:e.from.q,r:e.from.r}; }
  }
  for(const e of evs){
    switch(e.t){
      case "roll":
        UI.focus=e.roll.pid||UI.focus; UI.rolling={sides:e.roll.sides,shown:1}; paintDice();
        { const t0=performance.now(); while(performance.now()-t0<(reduceMotion()?60:480)){ UI.rolling.shown=1+Math.floor(Math.random()*e.roll.sides); paintDice(); await new Promise(r=>setTimeout(r,60)); } }
        UI.rolling=null; UI.shown=e.roll; paintDice(); await sleep(260); break;
      case "move": {
        UI.focus=e.pid; const dur=reduceMotion()?80:600+160*hexDist(e.to.q-e.from.q,e.to.r-e.from.r);
        disp[e.pid]={anim:{from:e.from,to:e.to,t0:performance.now(),dur}}; await new Promise(r=>setTimeout(r,dur));
        delete disp[e.pid]; break; }
      case "shot": UI.focus=e.from; fx.shot(e.from,e.to); await sleep(340); break;
      case "hit": fx.hit(e.pid,e.n); await sleep(260); break;
      case "miss": fx.text(e.pid,"MISS","#d8d0f0"); break;
      case "order": fx.text(e.pid,e.text.toUpperCase(),"#ffe066"); await sleep(200); break;
      case "story": paintStory(e.text); await sleep(120); break;
      case "turn": if(MODE.mode==="local") UI.handoff=true; UI.focus=null; break;
    }
  }
  for(const k in disp) delete disp[k];
  UI.busy=false; document.body.classList.remove("busy"); UI.focus=null;
}
async function importCode(text){
  UI.msg=""; UI.msgErr=false; UI.joinMsg="";
  let d;
  try{ d=await decodeGame(text); }catch(e){ return fail(e.message); }
  let tail;
  if(!G||G.seed!==d.seed){
    // new game from a friend's code: catch up silently, then watch their latest move
    let last, G2;
    try{ const ps=plies(d.seed,d.moves); last=ps.length?ps[ps.length-1].moves.length:0; G2=replay(d.seed,d.moves.slice(0,d.moves.length-last)); }
    catch(e){ return fail("This code contains an illegal move. It may be damaged, or from a different version of the game."); }
    G=G2;
    tail=d.moves.slice(d.moves.length-last);
    MODE={mode:"online",seat:null}; UI.share=null; UI.shareText="";
  } else {
    const n=G.moves.length;
    const prefix=d.moves.slice(0,n).every((m,i)=>m===G.moves[i]);
    if(!prefix) return fail("This code doesn't continue your game. It may be from an older turn, or from a different game.");
    if(d.moves.length<=n) return fail(d.moves.length===n?"You already have this move.":"This code is older than your game. You already have these moves.");
    tail=d.moves.slice(n);
  }
  UI.screen="game"; UI.handoff=false; render();
  for(const m of tail){
    try{ apply(G,m); }catch(e){ return fail("This code contains an illegal move. Ask your friend to send it again."); }
    const evs=G.ev; G.ev=[]; await present(evs);
  }
  if(MODE.seat===null) MODE.seat=Math.max(0,actor(G));
  UI.msg=G.st==="over"?"Game over.":"Their move is in. Your turn.";
  UI.share=null; save(); render();
  function fail(t){ UI.msg=t; UI.msgErr=true; UI.joinMsg=t; render(); }
}

// ======================================================================
// MAP RENDERER (low-res pixel canvas)
// ======================================================================
const W=384,H=264,HS=11,SQ3=Math.sqrt(3);
const hexPx=(q,r)=>[HS*1.5*q, HS*(SQ3/2*q+SQ3*r)];
let cv,ctx,img,qBuf,rBuf,cam={x:0,y:0},hover=null,dust=[],parts=[],floats=[],shake=0,shots=[],disp={},terrainKey="";
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>v/16);
function hash2(x,y){ let h=(x*374761393+y*668265263)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967295; }
const PAL={sandA:[196,170,118],sandB:[180,154,104],
  o1:[[62,68,84],[92,100,118],[40,44,56]],o2:[[132,76,44],[170,106,64],[92,50,30]],o3:[[26,24,34],[52,48,72],[12,10,16]],fog:[13,11,20]};
function initCanvas(el){
  cv=el; ctx=cv.getContext("2d"); ctx.imageSmoothingEnabled=false; terrainKey="";
  img=ctx.createImageData(W,H); qBuf=new Int32Array(W*H); rBuf=new Int32Array(W*H);
  if(!dust.length) for(let i=0;i<70;i++) dust.push({x:Math.random()*W,y:Math.random()*H,s:.2+Math.random()*.5,c:Math.random()});
  cv.addEventListener("pointermove",e=>{ hover=screenToHex(e); });
  cv.addEventListener("pointerleave",()=>{ hover=null; });
  cv.addEventListener("click",e=>{ const h=screenToHex(e); if(h) onHexClick(h[0],h[1]); });
}
function screenToHex(e){
  const b=cv.getBoundingClientRect(); const sx=(e.clientX-b.left)/b.width*W, sy=(e.clientY-b.top)/b.height*H;
  const wx=sx-W/2+cam.x, wy=sy-H/2+cam.y;
  return hexRound((2/3*wx)/HS,(-wx/3+SQ3/3*wy)/HS);
}
function shipPos(s){
  const d=disp[s.pid];
  if(d&&d.anim){ const a=d.anim, t=Math.min(1,(performance.now()-a.t0)/a.dur), e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    return {q:a.from.q+(a.to.q-a.from.q)*e, r:a.from.r+(a.to.r-a.from.r)*e}; }
  if(d) return {q:d.q,r:d.r};
  return {q:s.q,r:s.r};
}
function focusShip(){
  if(UI.focus) return G.ships[UI.focus-1];
  if(G.st==="over") return G.ships.find(s=>s.pid===G.winner)||G.ships[0];
  if(MODE.mode==="online"&&!myTurn()) return G.ships[MODE.seat]||G.ships[0];
  return G.ships[Math.max(0,actor(G))];
}
function showHints(){ return myTurn()&&!UI.busy&&!UI.handoff; }
// heading preview while choosing where to face after a stable drift
const previewHeading=()=>UI.heading===null?S(G).o:UI.heading;
const ARROWS=["↑","↗","↘","↓","↙","↖"];
function dirToward(s,q,r){
  const [x1,y1]=hexPx(s.q,s.r), [x2,y2]=hexPx(q,r);
  const deg=Math.atan2(x2-x1,-(y2-y1))*180/Math.PI;
  return mod(Math.round(deg/60),6);
}
function highlights(){
  const hl=new Map(), s=S(G); if(!showHints()) return hl;
  if(G.st==="nav_pick"){
    for(const o of allNavOptions(s)){
      const sel=o.speed===UI.speed&&o.side===UI.side;
      const c=o.dc<=12?[64,220,220]:o.dc<=15?[48,120,255]:[170,60,255];
      hl.set(o.q*10007+o.r,{c,a:sel?.75:.38,sel});
    }
  } else if(G.st==="nav_heading"){
    const h=previewHeading();
    for(const [q,r] of arcHexes({...s,o:h})) hl.set(q*10007+r,{c:[240,60,50],a:.32});
    const [aq,ar]=DIRS[h]; for(let k=1;k<=3;k++) hl.set((s.q+aq*k)*10007+(s.r+ar*k),{c:[255,235,120],a:.5});
  } else if(G.st==="atk_acquire"||G.st==="atk_menu"||G.st==="atk_debuff"){
    for(const [q,r] of arcHexes(s)) hl.set(q*10007+r,{c:[240,60,50],a:.28});
  }
  return hl;
}
function drawTerrain(cs){
  setTerrainSeed(G.seed);
  const key=[G.seed,cam.x.toFixed(2),cam.y.toFixed(2),hover&&hover.join(","),G.st,UI.speed,UI.side,UI.heading,G.moves.length,showHints(),cs.q.toFixed(2),cs.r.toFixed(2)].join("|");
  if(key===terrainKey){ ctx.putImageData(img,0,0); return; }
  terrainKey=key;
  const d=img.data, hl=highlights(), hv=hover&&showHints()?hover[0]*10007+hover[1]:null;
  const looted=new Set(G.looted), ox=cam.x-W/2, oy=cam.y-H/2, ar=Math.round(cs.q), arr=Math.round(cs.r);
  for(let y=0;y<H;y++){ const wy=y+oy;
    for(let x=0;x<W;x++){ const wx=x+ox, i=y*W+x;
      const fq=(2/3*wx)/HS, fr=(-wx/3+SQ3/3*wy)/HS, fy=-fq-fr;
      let rx=Math.round(fq), ry=Math.round(fy), rz=Math.round(fr);
      const ex=Math.abs(rx-fq), ey=Math.abs(ry-fy), ez=Math.abs(rz-fr);
      if(ex>ey&&ex>ez) rx=-ry-rz; else if(ey>ez) ry=-rx-rz; else rz=-rx-ry;
      qBuf[i]=rx; rBuf[i]=rz; } }
  for(let y=0;y<H;y++){ const wy=Math.floor(y+oy);
    for(let x=0;x<W;x++){
      const i=y*W+x, q=qBuf[i], r=rBuf[i], wx=Math.floor(x+ox);
      const t=terrain(q,r), b=BAYER[(wy&3)*4+(wx&3)], n=hash2(wx,wy);
      let c;
      if(t>=1&&t<=3){
        const p=t===1?PAL.o1:t===2?PAL.o2:PAL.o3, [hx,hy]=hexPx(q,r), dy=wy-hy, dx=wx-hx;
        c=dy<-HS*0.45?p[1]:(dy>HS*0.55||dx>HS*0.75)?p[2]:p[0];
        if(n>0.86) c=c===p[1]?p[0]:p[1];
      } else {
        c=((q+r)&1)===0?PAL.sandA:PAL.sandB;
        const rip=Math.sin(wx*0.35+wy*0.9+((q*7+r*13)%5))*0.5+0.5;
        if(rip>0.82&&b<0.5) c=[c[0]+12,c[1]+10,c[2]+8];
        else if(n>0.93) c=[c[0]-22,c[1]-22,c[2]-20];
        if(t===4){ const [hx,hy]=hexPx(q,r), dd=Math.hypot(wx-hx,wy-hy);
          if(!looted.has(q+","+r)){ if(dd<6&&n>0.45) c=n>0.8?[200,120,60]:n>0.62?[120,110,104]:[70,58,52]; }
          else if(dd<6&&n>0.88) c=[96,84,70]; }
      }
      let R0=c[0],G0=c[1],B0=c[2];
      const h=hl.get(q*10007+r);
      if(h){ const a=h.a; R0=R0*(1-a)+h.c[0]*a; G0=G0*(1-a)+h.c[1]*a; B0=B0*(1-a)+h.c[2]*a; }
      if(hv!==null&&q*10007+r===hv){ R0+=26; G0+=26; B0+=26; }
      const edge=(x>0&&(qBuf[i-1]!==q||rBuf[i-1]!==r))||(y>0&&(qBuf[i-W]!==q||rBuf[i-W]!==r));
      if(edge){ if(h&&h.sel){R0=255;G0=255;B0=255;} else {R0*=.62;G0*=.62;B0*=.66;} }
      const dist=hexDist(q-ar,r-arr);
      if(dist>5){ const f=Math.min(1,(dist-5)/4.5), lv=Math.floor(f*4+b)/4;
        R0=R0*(1-lv)+PAL.fog[0]*lv; G0=G0*(1-lv)+PAL.fog[1]*lv; B0=B0*(1-lv)+PAL.fog[2]*lv; }
      const k=i*4; d[k]=R0; d[k+1]=G0; d[k+2]=B0; d[k+3]=255;
    } }
  ctx.putImageData(img,0,0);
}
// Ship silhouettes, facing north. A = player colour, F = faction colour.
// Skiff: twin-hull sand-catamaran. Hauler: diesel barge with stacks. Dreadnought: riveted gunboat. Construct: old-world relic.
const SHIP_ART={
  SKIFF:["..oo....oo..",".oAAo..oAAo.",".oAAo..oAAo.",".oAAo..oAAo.",".oAAooooAAo.",".oAAmccmAAo.",
         ".oAAmccmAAo.",".oAAmFFmAAo.",".oAAooooAAo.",".osAo..oAso.",".osAo..oAso.",".osso..osso.","..ff....ff.."],
  HAULER:["....oooooooooo....","...oAAAAAAAAAAo...","..oAAwwwwwwwwAAo..","..oAwwddwwddwwAo..","..oAwwddwwddwwAo..",
          "..oAwwwwccwwwwAo..","..oAwwwmccmwwwAo..","..oAwddwwwwddwAo..","..oAwddwwwwddwAo..","..oAwwwwwwwwwwAo..",
          "..oAwwkkwwkkwwAo..","..oAwwkkwwkkwwAo..","..oAFFFFFFFFFFAo..","..oAssssssssssAo..","..oAAAAAAAAAAAAo..",
          "...oooooooooooo...","....f..f..f..f...."],
  DREAD:[".......oo.......","......omdo......","......omdo......",".....oAmdAo.....","....oAAddAAo....",
         "....oAmddmAo....","...oAAAmmAAAo...","...oAdAAAAdAo...","..oAAdAkkAdAAo..","..oAAAAkkAAAAo..",
         "..oAFFFFFFFFAo..","..oAssssssssAo..",".oAAsAAAAAAsAAo.",".oAsoooooooosAo.","oAso........osAo",
         "oso..........oso","o..f........f..o"],
  RELIC:["......oo......",".....oggo.....","....ogAAgo....","...ogAssAgo...","..ogAsGGsAgo..",".ogAsGFFGsAgo.",
         "ogAsGFFFFGsAgo","ogAsGFFFFGsAgo",".ogAsGFFGsAgo.","..ogAsGGsAgo..","...ogAssAgo...","....ogAAgo....",
         ".....oggo.....","......oo......"],
};
const STACKS={HAULER:[[6,10],[11,10]],DREAD:[[7,8]]};   // smokestack pixels (x,y) in the sprite
const shipSprites={};
function shade(hex,amt){ const n=parseInt(hex.slice(1),16); const f=v=>Math.max(0,Math.min(255,Math.round(v*(1+amt)))); return `rgb(${f(n>>16)},${f(n>>8&255)},${f(n&255)})`; }
function shipSprite(cls,color,fac,frame){
  cls=SHIP_ART[cls]?cls:"SKIFF";
  const k=cls+color+fac+frame; if(shipSprites[k]) return shipSprites[k];
  const art=SHIP_ART[cls], w=Math.max(...art.map(r=>r.length)), h=art.length;
  const c=document.createElement("canvas"); c.width=w; c.height=h; const x=c.getContext("2d");
  const fc=(FACTIONS[fac]||{color:"#c0c0c0"}).color;
  const map={o:"#120e18",A:color,s:shade(color,-0.45),c:"#7fe8ff",m:"#8a909c",d:"#4a4e58",w:"#a8865a",k:"#2a2a30",
    F:fc,f:frame?"#ffffff":"#ffb040",g:frame?"#60f0ff":"#3ab0e0",G:frame?"#e0ffff":"#a0f0ff"};
  if(cls==="SKIFF") map.f=frame?"#ffffff":"#3fd8ff";
  art.forEach((row,yy)=>[...row].forEach((ch,xx)=>{ if(map[ch]){ x.fillStyle=map[ch]; x.fillRect(xx,yy,1,1);} }));
  return shipSprites[k]=c;
}
function paintShips(){
  document.querySelectorAll("canvas[data-ship]").forEach(c=>{
    const sp=shipSprite(c.dataset.ship,P_COLORS[+c.dataset.pid-1]||P_COLORS[0],c.dataset.fac||"",0), x=c.getContext("2d");
    x.clearRect(0,0,c.width,c.height); x.imageSmoothingEnabled=false;
    x.drawImage(sp,Math.floor((c.width-sp.width)/2),Math.floor((c.height-sp.height)/2));
  });
}
const shipCanvas=(cls,pid,fac,cl="")=>`<canvas class="shipimg ${cl}" width="20" height="20" data-ship="${cls}" data-pid="${pid}" data-fac="${fac||""}" aria-hidden="true"></canvas>`;
function toScreen(q,r){ const [x,y]=hexPx(q,r); return [Math.round(x-cam.x+W/2),Math.round(y-cam.y+H/2)]; }
const fx={
  shot(a,b){ const pa=shipPos(G.ships[a-1]),pb=shipPos(G.ships[b-1]); shots.push({a:hexPx(pa.q,pa.r),b:hexPx(pb.q,pb.r),t0:performance.now(),col:P_COLORS[a-1]}); },
  hit(pid,n){ const s=G.ships[pid-1], p=shipPos(s), [x,y]=hexPx(p.q,p.r);
    for(let i=0;i<26;i++){ const a=Math.random()*6.28,v=.4+Math.random()*1.6; parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:30+Math.random()*30,c:["#fff3b0","#ffb030","#ff5a2a","#5a5060"][i%4]}); }
    floats.push({x,y:y-8,t:`-${n}`,c:"#ff5a5a",l:60}); shake=reduceMotion()?0:8; },
  text(pid,t,c){ const p=shipPos(G.ships[pid-1]), [x,y]=hexPx(p.q,p.r); floats.push({x,y:y-10,t,c,l:70}); },
};
function drawX(x,y,c){ ctx.fillStyle=c; for(let k=-4;k<=4;k++){ ctx.fillRect(x+k,y+k,1,1); ctx.fillRect(x+k,y-k,1,1);} }
function hexOutline(x,y,s){ ctx.beginPath(); for(let i=0;i<6;i++){ const a=Math.PI/3*i; const px=x+s*Math.cos(a)+.5, py=y+s*Math.sin(a)+.5; i?ctx.lineTo(px,py):ctx.moveTo(px,py);} ctx.closePath(); ctx.stroke(); }
function frame(now){
  requestAnimationFrame(frame);
  if(!cv||!cv.isConnected||!G||UI.screen!=="game"||G.st==="draft") return;
  const fs=focusShip(), sp=shipPos(fs), [tx,ty]=hexPx(sp.q,sp.r);
  cam.x+=(tx-cam.x)*.18; cam.y+=(ty-cam.y)*.18;
  if(Math.abs(tx-cam.x)<.3) cam.x=tx; if(Math.abs(ty-cam.y)<.3) cam.y=ty;
  const sx=shake>0?Math.round((Math.random()-.5)*shake):0, sy=shake>0?Math.round((Math.random()-.5)*shake):0;
  shake=Math.max(0,shake-.6);
  const saved={...cam}; cam.x-=sx; cam.y-=sy;
  drawTerrain(sp);
  const s=S(G);
  if(G.st==="nav_pick"&&showHints()){ const o=navOption(s,UI.speed,UI.side); if(o) drawX(...toScreen(o.q,o.r),"#ff2a6a"); }
  if(G.st==="nav_drift"&&G.aim) drawX(...toScreen(G.aim.q,G.aim.r),"#ff2a6a");
  const fr=(now/120|0)%2;
  for(const sh of G.ships){
    if(sh.hp<=0&&!disp[sh.pid]) continue;
    const p=shipPos(sh), [x,y]=toScreen(p.q,p.r);
    if(sh===s&&G.st!=="over"){ ctx.strokeStyle=fr?"#ffffff":P_COLORS[sh.pid-1]; ctx.lineWidth=1; hexOutline(x,y,HS-1); }
    if(G.target===sh.pid&&G.phase==="ATK"){ ctx.strokeStyle=s.f.locked?"#3dff6a":"#ff4040"; hexOutline(x,y,HS-1); hexOutline(x,y,HS-3); }
    ctx.save(); ctx.translate(x,y); ctx.rotate((sh===s&&G.st==="nav_heading"&&showHints()?previewHeading():sh.o)*Math.PI/3); const spr=shipSprite(sh.cls,P_COLORS[sh.pid-1],sh.fac,fr), sw=spr.width, sh2=spr.height;
    ctx.drawImage(spr,-Math.floor(sw/2),-Math.floor(sh2/2));
    if(sh.cls==="RELIC"){ const a=now/400; for(let k=0;k<3;k++){ const b=a+k*2.094; ctx.fillStyle=k?"#60f0ff":"#e0ffff"; ctx.fillRect(Math.round(Math.cos(b)*9)-1,Math.round(Math.sin(b)*9)-1,2,2); } }
    for(const [px,py] of (STACKS[sh.cls]||[])) if(Math.random()<0.05&&!reduceMotion()){
      const ang=(sh===s&&G.st==="nav_heading"&&showHints()?previewHeading():sh.o)*Math.PI/3, lx=px-sw/2, ly=py-sh2/2;
      const [wx,wy]=hexPx(p.q,p.r); parts.push({x:wx+lx*Math.cos(ang)-ly*Math.sin(ang),y:wy+lx*Math.sin(ang)+ly*Math.cos(ang),vx:.15+Math.random()*.2,vy:-.25,l:40,c:Math.random()<.5?"#5a5660":"#3a3840"}); }
    ctx.restore();
    const w=16, f=Math.ceil(w*sh.hp/sh.maxHp), top=y-Math.ceil(Math.max(sw,sh2)/2)-4;
    ctx.fillStyle="#000"; ctx.fillRect(x-w/2-1,top,w+2,4);
    ctx.fillStyle=sh.hp/sh.maxHp<HP_LOW?"#ff4d5e":"#5be37a"; ctx.fillRect(x-w/2,top+1,f,2);
    if(sh.evasive){ ctx.fillStyle="#7fe8ff"; ctx.fillRect(x+9,top+1,2,2); }
  }
  const o=other(G,fs);
  if(o&&o.hp>0){
    const op=shipPos(o), [x,y]=toScreen(op.q,op.r);
    if(x<6||x>W-6||y<6||y>H-6){
      const cx=W/2,cy=H/2,a=Math.atan2(y-cy,x-cx);
      const k=Math.min((W/2-12)/Math.abs(Math.cos(a)||1e-6),(H/2-12)/Math.abs(Math.sin(a)||1e-6));
      const px=cx+Math.cos(a)*k, py=cy+Math.sin(a)*k;
      ctx.save(); ctx.translate(Math.round(px),Math.round(py)); ctx.rotate(a);
      ctx.fillStyle=P_COLORS[o.pid-1]; ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-4,-5); ctx.lineTo(-4,5); ctx.fill(); ctx.restore();
      ctx.font='8px "Press Start 2P"'; ctx.fillStyle=P_COLORS[o.pid-1];
      const dtx=`P${o.pid} ${hexDist(o.q-fs.q,o.r-fs.r)}`, tw=ctx.measureText(dtx).width;
      ctx.fillText(dtx,Math.max(2,Math.min(W-tw-2,Math.round(px-Math.cos(a)*14-tw/2))),Math.max(10,Math.min(H-3,Math.round(py-Math.sin(a)*14+4))));
    }
  }
  shots=shots.filter(sh=>{
    const t=(now-sh.t0)/320; if(t>1.3) return false;
    const tt=Math.min(1,t);
    ctx.fillStyle="#fff"; ctx.fillRect(Math.round(sh.a[0]+(sh.b[0]-sh.a[0])*tt-cam.x+W/2)-1,Math.round(sh.a[1]+(sh.b[1]-sh.a[1])*tt-cam.y+H/2)-1,3,3); ctx.fillStyle=sh.col;
    for(let k=1;k<5;k++){ const t2=Math.max(0,tt-k*.05); ctx.fillRect(Math.round(sh.a[0]+(sh.b[0]-sh.a[0])*t2-cam.x+W/2),Math.round(sh.a[1]+(sh.b[1]-sh.a[1])*t2-cam.y+H/2),2,2); }
    return true; });
  parts=parts.filter(p=>{ p.x+=p.vx; p.y+=p.vy; p.vx*=.95; p.vy*=.95; p.l--; ctx.fillStyle=p.c; ctx.fillRect(Math.round(p.x-cam.x+W/2),Math.round(p.y-cam.y+H/2),2,2); return p.l>0; });
  ctx.font='8px "Press Start 2P"'; ctx.textBaseline="alphabetic";
  floats=floats.filter(f=>{ f.l--; f.y-=.35; const tw=ctx.measureText(f.t).width, x=Math.round(f.x-cam.x+W/2-tw/2), y=Math.round(f.y-cam.y+H/2);
    ctx.fillStyle="#000"; ctx.fillText(f.t,x+1,y+1); ctx.fillStyle=f.c; ctx.fillText(f.t,x,y); return f.l>0; });
  const moving=Object.values(disp).some(d=>d.anim);
  for(const p of dust){ p.x+=p.s*(moving?6:1); p.y+=p.s*(moving?6:1)*.6; if(p.x>W) p.x-=W; if(p.y>H) p.y-=H;
    ctx.fillStyle=p.c<.33?"#8a7a5a":p.c<.66?"#b8a078":"#e0caa0"; ctx.fillRect(p.x|0,p.y|0,1,1); }
  cam.x=saved.x; cam.y=saved.y;
  const hud=document.getElementById("hud");
  if(hud){
    let t="";
    if(hover){
      const [q,r]=hover, ob=terrain(q,r);
      if(G.st==="nav_heading"&&showHints()&&(q!==s.q||r!==s.r)) t=`TAP TO FACE ${DIR_NAMES[dirToward(s,q,r)]}`;
      if(G.st==="nav_pick"&&showHints()){ const op=allNavOptions(s).find(x=>x.q===q&&x.r===r); if(op) t=`SPEED ${op.speed} · TURN ${op.side>0?"+":""}${op.side} · DC ${op.dc}`; }
      if(!t){ const sh=G.ships.find(x=>x.hp>0&&x.q===q&&x.r===r); if(sh&&sh!==s){ const ai=arcInfo(s,sh); t=`P${sh.pid} · ${hexDist(q-s.q,r-s.r)} HEX · ${ai?"IN ARC, RANGE "+ai.range:"OUT OF ARC"}`; } }
      if(!t&&ob) t=ob===4?(G.looted.includes(q+","+r)?"PICKED-CLEAN WRECK":"OLD-WORLD WRECK · +1 PART"):TERRAIN_NAMES[ob].toUpperCase()+" · 5 DMG";
    }
    if(hud.textContent!==t) hud.textContent=t;
  }
}
function onHexClick(q,r){
  if(!showHints()) return;
  const s=S(G);
  if(G.st==="nav_pick"){ const o=allNavOptions(s).find(x=>x.q===q&&x.r===r); if(o){ UI.speed=o.speed; UI.side=o.side; render(); } }
  else if(G.st==="nav_heading"){ if(q!==s.q||r!==s.r){ UI.heading=dirToward(s,q,r); render(); } }
  else if(G.st==="atk_acquire"){ const t=other(G,s); if(t.q===q&&t.r===r&&legal(G).includes("TGT")) act("TGT"); }
}

// ======================================================================
// HTML UI
// ======================================================================
const app=document.getElementById("app");
const faceCanvas=key=>`<canvas width="12" height="12" data-face="${key}"></canvas>`;
function paintFaces(){
  document.querySelectorAll("canvas[data-face]").forEach(c=>{
    const d=CREW_BY[c.dataset.face], x=c.getContext("2d"); x.clearRect(0,0,12,12);
    const m={s:d.pal[0],h:d.pal[1],u:d.pal[2],a:d.pal[3],e:"#101018"};
    PORTRAIT.forEach((row,yy)=>[...row].forEach((ch,xx)=>{ if(m[ch]){ x.fillStyle=m[ch]; x.fillRect(xx,yy,1,1);} }));
  });
}
function header(){
  let track="";
  if(G&&UI.screen==="game"&&G.st!=="draft"){
    const s=S(G), slots=["CMD",...G.queue]; while(slots.length<1+slotsAllowed(G)) slots.push("···");
    track=`<div class="track" aria-label="Phase plan">`+slots.map((p,i)=>{ const on=G.phase==="CMD"?i===0:i===G.qi+1; const col=p==="NAV"?"var(--nav)":p==="ATK"?"var(--atk)":p==="ENG"?"var(--eng)":"var(--dim)";
      return `<span class="slot ${on?"on":""}" style="border-color:${col};${on?`background:${col}`:""}">${p}</span>`; }).join("")+`</div>`;
    const who=MODE.mode==="online"?(myTurn()?"YOUR TURN":`WAITING · P${s.pid}`):`PLAYER ${s.pid}`;
    track+=`<span class="turnchip" style="color:${P_COLORS[s.pid-1]}">${G.st==="over"?"GAME OVER":who}</span>`;
  }
  const seatChip=G&&MODE.mode==="online"&&MODE.seat!==null?`<span class="turnchip" style="color:${P_COLORS[MODE.seat]}">YOU ARE P${MODE.seat+1}</span>`:"";
  return `<div class="top"><div class="logo">TETHYS<small>DESERT DRIFTER · THE ROAD TO EUROPA</small></div>${track}${seatChip}</div>`;
}
const RULES=[["var(--sand)","1 · Ships & crew","Pick a hull and a faction, then draft 3 crew from 15 (picks go 1-2-2-1-1-2). Crew of your own faction add hull."],
  ["var(--any)","2 · Plan the turn","Choose the order of NAV, ATK and ENG. A jammed ship gets only 2 phases."],
  ["var(--nav)","NAV","Pick speed and turn. Roll BOOST to reach the hex, then DRIFT to hold your heading."],
  ["var(--atk)","ATK","Target a ship in your front arc. Lock on to cripple a system or stun crew, then fire."],
  ["var(--eng)","ENG","Spend energy on ENGINE, BOOST, DRIFT, WEAPONS. Repair with spare parts."],
  ["#c9a0ff","Online","Each turn becomes a short move code. Send it to your friend; their game replays your moves."]];
function render(){
  if(UI.screen==="title"||!G) return renderTitle();
  if(G.st==="draft") return renderDraft();
  renderGame();
}
function renderTitle(){
  const sv=loadSave();
  app.innerHTML=header()+`<section class="full"><div class="hero"><div><h1>TETHYS<small>DESERT DRIFTER</small></h1></div>
  <div style="display:flex;flex-direction:column;gap:14px"><p>The old world is sand and scrap. Somewhere beyond the dunes lies Europa. Two ships have heard the same rumour of a relic that points the way, and only one will carry it home.</p>
  <div class="btnrow"><button class="go" data-ui="local" id="btn-local">Play on this device</button><button data-ui="online" id="btn-online">Start online game</button>${sv?`<button data-ui="continue" id="btn-continue">Continue saved game</button>`:""}</div>
  <div class="join"><label class="prompt" for="join-code">JOIN A FRIEND'S GAME<span class="sub">Paste the move code your friend sent you.</span></label>
  <textarea id="join-code" class="code" placeholder="TETHYS-…"></textarea>
  <div class="btnrow"><button data-ui="join" id="btn-join">Load code</button><span class="msg ${UI.joinMsg?"err":""}">${esc(UI.joinMsg)}</span></div></div>
  </div></div><div class="rules">${RULES.map(x=>`<div class="rule" style="--c:${x[0]}"><h4>${x[1]}</h4><p>${x[2]}</p></div>`).join("")}</div></section>`;
}
function waitingPanel(){
  const s=G.ships[actor(G)];
  return `<div class="join"><div class="prompt">WAITING FOR PLAYER ${s.pid}<span class="sub">${UI.share?"Send this to your friend, then paste their reply below.":"Paste your friend's latest move code."}</span></div>
    ${UI.share?`<textarea id="share-code" class="code" readonly>${esc(UI.shareText)}</textarea><div class="btnrow"><button class="go" data-ui="copy" id="btn-copy">Copy move</button><span class="msg" id="copy-msg"></span></div>`:""}
    <textarea id="reply-code" class="code" placeholder="Paste their move code here"></textarea>
    <div class="btnrow"><button data-ui="reply" id="btn-reply">Load their move</button><span class="msg ${UI.msgErr?"err":""}">${esc(UI.msg)}</span></div></div>`;
}
function canUndo(){
  if(!G||UI.busy||!G.moves.length) return false;
  const last=G.moves[G.moves.length-1];
  if(!/^[CR]:/.test(last)) return false;
  if(MODE.mode==="local") return true;
  const prev=replay(G.seed,G.moves.slice(0,-1));
  return actor(prev)===MODE.seat&&actor(G)===MODE.seat;      // online: only inside your own, unsent turn
}
function undoLast(){
  if(!canUndo()) return;
  G=replay(G.seed,G.moves.slice(0,-1)); UI.pickCrew=null; UI.handoff=false; save();
}
const facChip=f=>f?`<span class="fchip" style="--fc:${FACTIONS[f].color}">${FACTIONS[f].name.toUpperCase()}</span>`:"";
function renderDraft(){
  const pi=actor(G), s=G.ships[pi], mine=myTurn();
  const undo=canUndo()?`<button data-ui="undo" id="btn-undo">Undo last pick</button>`:"";
  let body;
  if(!mine) body=waitingPanel();
  else if(!s.cls){
    const cl=UI.pickCls, fa=UI.pickFac;
    body=`<div class="prompt" style="color:${P_COLORS[pi]}">PLAYER ${s.pid}: CHOOSE YOUR SHIP<span class="sub">Pick a hull and the faction you sail under. You can change both until you confirm.</span></div>
    <div class="classes">${Object.entries(CLASSES).map(([k,c])=>`<button class="cls ${cl===k?"picked":""}" data-ui="selcls" data-v="${k}" id="sel-${k}" aria-pressed="${cl===k}">
      <span class="clshead">${shipCanvas(k,s.pid,fa,"big")}<span class="nm">${c.name.toUpperCase()}<em>${c.role.toUpperCase()} · ${c.size.toUpperCase()}</em></span></span>
      <span class="row"><span>HULL ${c.hull}</span><span>ENERGY ${c.energy}</span><span>PARTS ${c.parts}</span></span><span>${esc(c.text)}</span><span class="dim">${esc(c.lore)}</span></button>`).join("")}</div>
    <div class="prompt">FACTION<span class="sub">Each crew member of your faction adds +${KINDRED_HULL} hull.</span></div>
    <div class="classes facs">${Object.entries(FACTIONS).map(([k,f])=>`<button class="cls fac ${fa===k?"picked":""}" style="--fc:${f.color}" data-ui="selfac" data-v="${k}" id="sel-${k}" aria-pressed="${fa===k}">
      <span class="nm" style="color:${f.color}">${f.name.toUpperCase()}<em>${esc(f.long.toUpperCase())}</em></span><span>${esc(f.perk)}</span><span class="dim">“${esc(f.creed)}”</span>
      <span class="dim">Crew: ${CREW.filter(c=>c.f===k).map(c=>c.name).join(", ")}</span></button>`).join("")}</div>
    <div class="btnrow">${cl&&fa?`<button class="go" data-m="C:${cl}:${fa}" id="m-confirm-ship">Confirm: ${CLASSES[cl].name} of the ${FACTIONS[fa].name} ▸</button>`:`<button class="go" disabled>Choose a ship and a faction</button>`}${undo}</div>`;
  } else {
    const pk=UI.pickCrew&&G.draft.pool.includes(UI.pickCrew)?UI.pickCrew:null;
    const kin=kindred(s);
    body=`<div class="prompt" style="color:${P_COLORS[pi]}">PLAYER ${s.pid}: RECRUIT A CREW MEMBER<span class="sub">Pick ${G.draft.idx+1} of ${G.draft.order.length}. You sail with the ${FACTIONS[s.fac].name}: their crew add +${KINDRED_HULL} hull each (now ${kin}).</span></div>
    ${Object.entries(FACTIONS).map(([fk,f])=>`<div class="facgroup" style="--fc:${f.color}"><div class="fachead">${f.name.toUpperCase()} <span class="dim">· ${esc(f.long)}${fk===s.fac?" · YOUR FACTION":""}</span></div>
      <div class="cards">${CREW.filter(c=>c.f===fk).map(c=>{ const taken=!G.draft.pool.includes(c.key);
      return `<button class="card ${taken?"taken":""} ${pk===c.key?"picked":""}" style="--st:${ST_COLOR[c.st]}" data-ui="selcrew" data-v="${c.key}" id="sel-${c.key}" ${taken?"disabled":""} aria-pressed="${pk===c.key}">
      ${faceCanvas(c.key)}<div class="nm">${c.name}<em>${c.role.toUpperCase()} · ${c.st}</em></div>
      <div class="full2"><span class="k">PASSIVE</span><span>${esc(c.passive)}</span><span class="k">ORDER · ${esc(c.order.toUpperCase())}</span><span>${esc(c.text)}</span></div></button>`; }).join("")}</div></div>`).join("")}
    <div class="btnrow">${pk?`<button class="go" data-m="R:${pk}" id="m-confirm-crew">Recruit ${CREW_BY[pk].name} ▸</button>`:`<button class="go" disabled>Choose a crew member</button>`}<button data-ui="randpick" id="btn-rand">Random pick</button>${undo}</div>`;
  }
  app.innerHTML=header()+`<section class="full" style="border-color:${P_COLORS[pi]}">${storyHTML()}${body}
    <div class="picks">${G.ships.map(sh=>`<div style="color:${P_COLORS[sh.pid-1]}">P${sh.pid}: ${sh.cls?CLASSES[sh.cls].name:"—"} ${facChip(sh.fac)} · ${sh.crew.map(c=>CREW_BY[c.key].name).join(", ")||"no crew yet"}</div>`).join("")}</div></section>`;
  paintFaces(); paintShips();
}
function storyHTML(){
  const st=G.story.slice(0,3);
  return `<div class="story" id="story" aria-live="polite"><h4>THE CHRONICLE</h4>${st.map((t,i)=>`<p class="${i?"old":""}">${esc(t)}</p>`).join("")}</div>`;
}
function paintStory(){ const el=document.getElementById("story"); if(el) el.outerHTML=storyHTML(); }
function shipCard(s){
  const active=s===S(G)&&G.st!=="over", cap=energyCap(s), used=energyUsed(s), pct=s.hp/s.maxHp, c=CLASSES[s.cls];
  const flags=[]; if(s.evasive) flags.push(["EVASIVE",""]); if(s.jammed) flags.push(["JAMMED","red"]); if(s.surge) flags.push([`SURGE +${s.surge}`,""]); if(s.autoBoost) flags.push(["AFTERBURN",""]);
  if(s.fury) flags.push(["SCRAP FURY",""]); if(s.chain) flags.push(["CHAIN SHOT",""]); if(s.tailwind) flags.push(["TAILWIND",""]); if(s.brace) flags.push(["BRACED",""]); if(s.storm) flags.push(["SANDSTORM −2","red"]);
  if(active&&G.phase==="ATK"&&s.f.locked) flags.push(["LOCKED",""]); if(active&&s.f.debuff) flags.push([`AIM ${s.f.debuff}`,"red"]);
  if(pct<R.HP_FAIL&&s.hp>0) flags.push(["HULL CRITICAL −1","red"]);
  const sysCell=([k,lab,dk])=>`<div class="stat"><span>${lab}</span>+${s.sys[k]}${s.dmg[dk]?` <span class="hurt" style="display:inline;font-family:var(--f-txt);font-size:18px">−${s.dmg[dk]}</span>`:""}</div>`;
  const canAct=active&&myTurn()&&!UI.busy, L=canAct?legal(G):[];
  const crew=s.crew.map((cm,i)=>{
    const d=CREW_BY[cm.key], block=orderBlock(G,s,cm), stt=cm.stun?["STUNNED","bad"]:cm.rest>0?(cm.used===G.turn?["ORDER GIVEN","dim"]:[`REST ${cm.rest}`,"dim"]):["READY","ok"];
    return `<div class="cm ${cm.stun?"stun":""}" style="--st:${ST_COLOR[d.st]}">${faceCanvas(cm.key)}
      <div><div class="nm">${d.name} <em>${d.st}</em></div><div class="tx">${esc(d.passive)}<br><b>${esc(d.order)}:</b> ${esc(d.text)}</div></div>
      <div><div class="stt ${stt[1]}">${stt[0]}</div>${active&&(MODE.mode==="local"||s.pid-1===MODE.seat)?`<button data-m="O:${i+1}" id="m-O-${s.pid}-${i+1}" ${L.includes("O:"+(i+1))?"":"disabled"} title="${esc(block||"Give order")}">Order</button>`:""}</div></div>`;
  }).join("");
  return `<section class="ship ${active?"active":""} ${s.hp<=0?"dead":""}" style="--c:${P_COLORS[s.pid-1]}">
    <h3><span class="shiphead">${shipCanvas(s.cls,s.pid,s.fac)}P${s.pid} · ${c?c.name.toUpperCase():""}${MODE.mode==="online"&&MODE.seat===s.pid-1?" (YOU)":""}</span><span>${s.hp}/${s.maxHp}</span></h3>
    <div class="flags">${facChip(s.fac)}<span class="flag" style="background:transparent;color:var(--dim)">${s.fac?esc(FACTIONS[s.fac].perk):""}${kindred(s)?` · KINDRED ${kindred(s)}`:""}</span></div>
    <div class="bar"><i class="${pct<HP_LOW?"lo":""}" style="width:${pct*100}%"></i></div>
    <div class="stats"><div class="stat"><span>ENERGY</span>${used}/${cap}</div><div class="stat"><span>AMMO</span>${s.ammo}</div><div class="stat"><span>PARTS</span>${s.parts}</div><div class="stat"><span>HEAD</span>${DIR_NAMES[s.o]}</div>
    ${SYS.map(sysCell).join("")}</div>
    ${flags.length?`<div class="flags">${flags.map(f=>`<span class="flag ${f[1]}">${f[0]}</span>`).join("")}</div>`:""}
    <div class="crew">${crew}</div></section>`;
}
function diceInner(){
  if(UI.rolling) return `<div class="die ${UI.rolling.sides!==20?"d6":""} rolling">${UI.rolling.shown}</div><div class="formula">Rolling d${UI.rolling.sides}…</div>`;
  const r=UI.shown||G.roll; if(!r) return `<div class="die" style="opacity:.25">20</div><div class="formula dim">No roll yet this turn.</div>`;
  let body;
  if(r.auto) body=`<b>${r.label}</b><br><span class="ok">AUTO-SUCCESS</span> <span class="dim">(Afterburn)</span>`;
  else {
    const m=(r.mods||[]).map(x=>` ${x[0]>0?"+":"−"}${Math.abs(x[0])} <span class="dim">${x[1]}</span>`).join("");
    const res=r.dmg?`<span class="bad">${r.total} damage</span>`:r.heal?`<span class="ok">+${r.total} hull</span>`:`${r.total} vs ${r.vs} → <span class="${r.ok?"ok":"bad"}">${r.ok?"SUCCESS":"FAIL"}</span>`;
    body=`<b>P${r.pid} ${r.label}</b><br>${r.die}${m} = ${res}`;
  }
  return `<div class="die ${r.sides!==20?"d6":""}">${r.auto?"✓":r.die}</div><div class="formula">${body}</div>`;
}
function paintDice(){ const d=document.getElementById("dicebox"); if(d) d.innerHTML=diceInner(); }
function btn(m,label,cls="",L){ return `<button class="${cls}" data-m="${m}" id="m-${m.replace(/[^A-Za-z0-9+-]/g,"-")}" ${L.includes(m)?"":"disabled"}>${label}</button>`; }
function fixNavSide(){
  const s=S(G); if(navOption(s,UI.speed,UI.side)) return;
  for(const d of [0,1,-1,2,-2,3,-3]) if(navOption(s,UI.speed,d)){ UI.side=d; return; }
  for(const sp of [1,2,3]) for(const d of [0,1,-1,2,-2,3,-3]) if(navOption(s,sp,d)){ UI.speed=sp; UI.side=d; return; }
}
function actionsHTML(){
  const s=S(G), L=myTurn()&&!UI.busy?legal(G):[], endLbl=G.qi+1<G.queue.length?"End phase ▸":"End turn ▸";
  const end=()=>btn("END",endLbl,"go",L);
  let p="",sub="",rows=[];
  switch(G.st){
    case "cmd": {
      const n=slotsAllowed(G);
      p="PLAN YOUR TURN"; sub=`Pick the order of ${n} phases.${s.jammed?" Your comms are jammed.":""} Chosen: ${G.queue.join(" → ")||"none"}`;
      rows.push(`<div class="btnrow">${["NAV","ATK","ENG"].map(x=>btn("Q:"+x,x,x.toLowerCase(),L)).join("")}${btn("Q-","Undo","",L)}</div>`); break; }
    case "nav_pick": {
      fixNavSide();
      const o=navOption(s,UI.speed,UI.side), ee=effEngine(s);
      p="NAVIGATION · SET COURSE"; sub=`Choose speed and turn, or tap a lit hex.${ee?` Engine +${ee} adds ${ee*R.ENG_DIST_BONUS} hexes and raises the DC.`:" Power the ENGINE in ENG to fly further."}`;
      const can=L.length>0;
      rows.push(`<div class="btnrow"><span class="lab">SPEED</span>${[1,2,3].map(v=>`<button data-ui="speed" data-v="${v}" id="ui-speed-${v}" class="${UI.speed===v?"sel":""}" ${can&&[-3,-2,-1,0,1,2,3].some(d=>navOption(s,v,d))?"":"disabled"}>${v}</button>`).join("")}</div>`);
      rows.push(`<div class="btnrow"><span class="lab">TURN</span>${[-3,-2,-1,0,1,2,3].map(v=>`<button data-ui="side" data-v="${v}" id="ui-side-${v}" class="${UI.side===v?"sel":""}" ${can&&navOption(s,UI.speed,v)?"":"disabled"}>${v>0?"+":""}${v}</button>`).join("")}</div>`);
      const bm=o?`B:${o.speed}:${o.side>0?"+":""}${o.side}`:"B:none";
      rows.push(`<div class="btnrow">${btn(bm,o?(s.autoBoost?"Afterburn ▸":`Roll boost · DC ${o.dc}`):"No open course","nav",L)}${L.includes("PIVOT:L")?btn("PIVOT:L","Pivot left","",L)+btn("PIVOT:R","Pivot right","",L):""}${btn("END","Skip move","",L)}</div>`);
      if(L.includes("PIVOT:L")) sub="Rocks block every course. Pivot in place, or skip the move.";
      break; }
    case "nav_drift": p="NAVIGATION · HOLD THE DRIFT"; sub=`Roll DRIFT vs DC ${G.dc}. Success lets you set a new heading and allows lock-on this turn.`;
      rows.push(`<div class="btnrow">${btn("DRIFT",`Roll drift · DC ${G.dc}`,"nav",L)}</div>`); break;
    case "nav_heading": {
      const h=previewHeading(), t=other(G,s), ai=t.hp>0?arcInfo({...s,o:h},t):null, can=L.length>0;
      p="NAVIGATION · CHOOSE HEADING";
      sub=`Pick a direction or tap the map, check the preview, then confirm. Facing ${DIR_NAMES[h]}${h===s.o?" (unchanged)":""}: ${ai?`P${t.pid} would be in your firing arc at range ${ai.range}.`:`P${t.pid} would be outside your firing arc.`}`;
      rows.push(`<div class="btnrow"><span class="lab">FACE</span>${DIR_NAMES.map((d,i)=>`<button data-ui="heading" data-v="${i}" id="ui-heading-${d}" class="${h===i?"sel":""}" ${can?"":"disabled"} aria-pressed="${h===i}"><span class="arr" aria-hidden="true">${ARROWS[i]}</span> ${d}</button>`).join("")}</div>`);
      rows.push(`<div class="btnrow">${btn("H:"+DIR_NAMES[h],`Confirm heading ${DIR_NAMES[h]} ▸`,"go",L)}</div>`);
      break; }
    case "done": p="PHASE COMPLETE"; rows.push(`<div class="btnrow">${end()}</div>`); break;
    case "atk_acquire": { const t=other(G,s), ai=arcInfo(s,t);
      p="COMBAT · ACQUIRE TARGET"; sub=ai?`P${t.pid} is in your firing arc at range ${ai.range}.`:`No ship in your arc (front, range 1–3). You can still reload.`;
      rows.push(`<div class="btnrow">${btn("TGT",`Target P${t.pid}`,"atk",L)}${btn("RLD","Reload","",L)}${end()}</div>`); break; }
    case "atk_menu": { const t=tgt(G), ai=arcInfo(s,t);
      p=`COMBAT · P${t.pid} AT RANGE ${ai?ai.range:"—"}`;
      sub=`Lock on (needs a stable drift): +${R.LOCK_BONUS} to hit and a critical. Fire: d20 vs AC ${ai?R.BASE_AC+R.AC_DIST[ai.range-1]:"—"}.`;
      rows.push(`<div class="btnrow">${btn("LOCK",s.f.drift?"Lock on":"Lock on (no drift)","",L)}${btn("RLD","Reload","",L)}${btn("FIRE",`Fire · ammo ${s.ammo}`,"atk",L)}${end()}</div>`); break; }
    case "atk_debuff": p="COMBAT · PICK A SYSTEM TO CRIPPLE"; sub="Applied if your next shot hits. CREW stuns a random enemy crew member.";
      rows.push(`<div class="btnrow">${DEBUFFS.map(([k,l])=>btn("AIM:"+k,l,"atk",L)).join("")}</div>`); break;
    case "atk_dmg": p="COMBAT · HIT!"; rows.push(`<div class="btnrow">${btn("DMG","Roll damage · d6","atk",L)}</div>`); break;
    case "eng": { const cap=energyCap(s), used=energyUsed(s);
      p=`ENGINEERING · ENERGY ${used}/${cap}`; sub="Power stays allocated between turns. Heavy hull damage lowers the cap.";
      rows.push(`<div class="eng-grid">${SYS.map(([k,lab])=>{ const K={eng:"ENG",bst:"BST",dft:"DFT",wpn:"WPN"}[k];
        return `<span class="sys">${lab}</span>${btn("-"+K,"−","",L)}<span>+${s.sys[k]}${k==="eng"?' <span class="dim">(max 2)</span>':""}</span>${btn("+"+K,"+","eng",L)}`; }).join("")}</div>`);
      rows.push(`<div class="btnrow">${btn("REP",`Repair · ${s.parts} parts`,"eng",L)}${end()}</div>`); break; }
  }
  if(UI.busy) sub="…";
  return `<div class="prompt">${p}${sub?`<span class="sub">${esc(sub)}</span>`:""}</div>${rows.join("")}`;
}
function recordHTML(){
  const ps=plies(G.seed,G.moves);
  return ps.map((p,i)=>`<div>${i+1}. <b style="color:${P_COLORS[p.who]}">P${p.who+1}</b> ${esc(plyText(p))}</div>`).reverse().join("");
}
function renderGame(){
  let overlay="";
  const s=S(G);
  if(G.st==="over"){
    const w=G.ships.find(x=>x.pid===G.winner), c=w?P_COLORS[w.pid-1]:"var(--bad)";
    overlay=`<div class="overlay"><div class="box ${MODE.mode==="online"&&UI.share?"wide":""}" style="--c:${c}"><h2>${w?`PLAYER ${w.pid} WINS`:"BOTH SHIPS LOST"}</h2>
      ${w?`<p class="dim">${CLASSES[w.cls].name} · crew ${w.crew.map(c=>CREW_BY[c.key].name).join(", ")}</p>`:""}
      ${MODE.mode==="online"&&UI.share?`<p class="dim">Send the final move so your friend sees the end:</p><textarea id="share-code" class="code" readonly>${esc(UI.shareText)}</textarea><button class="go" data-ui="copy" id="btn-copy">Copy move</button><span class="msg" id="copy-msg"></span>`:""}
      <button data-ui="newgame" id="btn-new">New game</button></div></div>`;
  } else if(MODE.mode==="online"&&!myTurn()&&!UI.busy){
    overlay=`<div class="overlay"><div class="box wide" style="--c:${P_COLORS[actor(G)]}">${waitingPanel()}</div></div>`;
  } else if(MODE.mode==="local"&&UI.handoff&&!UI.busy){
    overlay=`<div class="overlay"><div class="box" style="--c:${P_COLORS[s.pid-1]}"><h2>PLAYER ${s.pid}<br>TAKE THE HELM</h2>
      <p class="dim">${s.jammed?"Your comms are jammed: plan only 2 phases.":"Plan NAV, ATK and ENG in any order."}</p><button class="go" data-ui="begin" id="btn-begin">Begin turn</button></div></div>`;
  }
  if(!cv||!cv.isConnected){
    app.innerHTML=`<div id="hdr"></div><div class="main"><div class="col">
      <div class="screen"><canvas id="map" width="${W}" height="${H}" aria-label="Battle map"></canvas><div class="hud" id="hud"></div><div id="ovl"></div></div>
      <div id="storywrap"></div>
      <div class="console" id="console"></div><div class="log" id="log" aria-live="polite"></div>
      <details class="help" id="record-box"><summary>Game record</summary><div class="record" id="record"></div></details>
      <details class="help"><summary>Rules quick reference</summary><ul>
      <li>Rolls: d20 + modifiers must meet the DC or AC.</li><li>Boost fail: you overshoot by 50%. Drift fail: you spin one step and cannot lock on this turn.</li>
      <li>Rocks and rams deal 5 damage. Old-world wrecks give +1 spare part the first time a ship lands on them.</li>
      <li>The open flats are in the middle. Rock gets denser further out, and canyons lead back in.</li>
      <li>Under 40% hull your energy cap drops to 1; under 20% it drops to 0 and all rolls get −1.</li>
      <li>Hit damage: d6 + 4 + WPN. A locked shot also cripples a system (−1 to its rolls) or stuns a crew member.</li>
      <li>After an order, a crew member sits out your next 2 turns (Nomads: 1). Stunned crew lose their passive until the end of their next turn.</li>
      <li>Factions: Scrappers repair +2, Nomads rest less, Drifters +1 boost and drift. Each crew member of your faction adds +2 hull.</li></ul></details>
      </div><div class="col" id="side"></div></div>`;
    initCanvas(document.getElementById("map"));
  }
  document.getElementById("hdr").innerHTML=header();
  document.getElementById("ovl").innerHTML=overlay;
  document.getElementById("storywrap").innerHTML=storyHTML();
  document.getElementById("console").innerHTML=G.st==="over"?`<div class="prompt">GAME OVER</div>`:`<div class="split"><div style="flex:2 1 320px;display:flex;flex-direction:column;gap:10px;min-width:0">${actionsHTML()}</div><div class="dice" id="dicebox">${diceInner()}</div></div>`;
  document.getElementById("log").innerHTML=G.log.slice(0,40).map(l=>{
    const c=l.c==="ok"?"var(--good)":l.c==="bad"?"var(--bad)":l.c==="crew"?"var(--any)":l.c==="p1"?P_COLORS[0]:l.c==="p2"?P_COLORS[1]:"var(--ink)";
    return `<div style="color:${c}">${esc(l.t)}</div>`; }).join("");
  const rb=document.getElementById("record-box"); if(rb.open) document.getElementById("record").innerHTML=recordHTML();
  document.getElementById("side").innerHTML=G.ships.map(shipCard).join("");
  paintFaces(); paintShips();
}

app.addEventListener("toggle",e=>{ if(e.target.id==="record-box"&&e.target.open) document.getElementById("record").innerHTML=recordHTML(); },true);
app.addEventListener("click",async e=>{
  const b=e.target.closest("button"); if(!b||b.disabled) return;
  if(b.dataset.m){ if(b.dataset.m==="B:none") return; await act(b.dataset.m); return; }
  const a=b.dataset.ui, v=b.dataset.v;
  switch(a){
    case "local": G=newGame(1+Math.floor(Math.random()*2e9)); MODE={mode:"local",seat:0}; UI.screen="game"; UI.share=null; UI.handoff=false; save(); break;
    case "online": G=newGame(1+Math.floor(Math.random()*2e9)); MODE={mode:"online",seat:0}; UI.screen="game"; UI.share=null; UI.msg=""; save(); break;
    case "continue": { const sv=loadSave(); if(!sv||!restore(sv)){ UI.joinMsg="The saved game could not be loaded."; } break; }
    case "join": { const t=document.getElementById("join-code").value; await importCode(t); return; }
    case "reply": { const t=document.getElementById("reply-code").value; await importCode(t); return; }
    case "copy": {
      const ta=document.getElementById("share-code"), msg=document.getElementById("copy-msg");
      try{ await navigator.clipboard.writeText(UI.shareText); msg.textContent="Copied."; }
      catch(err){ ta.focus(); ta.select(); msg.textContent="Press Ctrl+C (or ⌘C) to copy."; }
      return; }
    case "randpick": { const ls=legal(G).filter(m=>m.startsWith("R:")); UI.pickCrew=ls[Math.floor(Math.random()*ls.length)].slice(2); break; }
    case "begin": UI.handoff=false; break;
    case "speed": UI.speed=+v; fixNavSide(); break;
    case "side": UI.side=+v; break;
    case "heading": UI.heading=+v; break;
    case "selcls": UI.pickCls=v; break;
    case "selfac": UI.pickFac=v; break;
    case "selcrew": UI.pickCrew=v; break;
    case "undo": undoLast(); break;
    case "newgame": G=null; UI.screen="title"; UI.share=null; try{ localStorage.removeItem(SAVE_KEY); }catch(err){} break;
  }
  render();
});

// keep a running game across live page updates
window.claude?.hot?.snapshot?.(()=>({save:G?{seed:G.seed,moves:G.moves,mode:MODE.mode,seat:MODE.seat,share:UI.share,shareText:UI.shareText}:null}));
function start(data){
  const sv=(data&&data.save)||null;
  if(sv) restore(sv);
  render(); requestAnimationFrame(frame);
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
