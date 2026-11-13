// ======================================================================
// TETHYS RULES CORE  — pure and deterministic, no DOM.
// The whole game is  newGame(seed)  +  apply(G, move)  for every move.
// Two players with the same seed and the same move list see the same game.
// ======================================================================
"use strict";
const R = {
  START_ENERGY:3, START_PARTS:2, START_AMMO:1,
  DC_BASE:8, DC_MOD_EASY:1, DC_MOD_HARD:2, ENG_DIST_BONUS:2, ENG_DC_MULT:0.5,
  BASE_AC:10, AC_DIST:[0,2,4], DMG_BONUS:4, LOCK_DC:8, LOCK_BONUS:4,
  HP_CRIT:0.40, HP_FAIL:0.20, CRASH_DMG:3, REST:2,   // REST = own turns a crew member sits out after an order
};
const DIRS = [[0,-1],[1,-1],[1,0],[0,1],[-1,1],[-1,0]];
const DIR_NAMES = ["N","NE","SE","S","SW","NW"];
const SYS = [["eng","ENGINE","SPEED"],["bst","BOOST","BOOST"],["dft","DRIFT","DRIFT"],["wpn","WEAPONS","WEAPONS"]];
const SYS_KEYS = {ENG:"eng",BST:"bst",DFT:"dft",WPN:"wpn"};
const DEBUFFS = [["SPEED","SPD"],["BOOST","BST"],["DRIFT","DFT"],["WEAPONS","WPN"],["CREW","CREW"]];
const mod = (a,n)=>((a%n)+n)%n;

// ---------------- HEX MATH ----------------
const hexDist = (q,r)=>(Math.abs(q)+Math.abs(q+r)+Math.abs(r))/2;
function hexRound(q,r){
  const x=q,z=r,y=-x-z; let rx=Math.round(x),ry=Math.round(y),rz=Math.round(z);
  const dx=Math.abs(rx-x),dy=Math.abs(ry-y),dz=Math.abs(rz-z);
  if(dx>dy&&dx>dz) rx=-ry-rz; else if(dy>dz) ry=-rx-rz; else rz=-rx-ry;
  return [rx,rz];
}
const RING_CACHE={};
function ring(radius){
  if(RING_CACHE[radius]) return RING_CACHE[radius];
  if(radius===0) return RING_CACHE[0]=[[0,0]];
  let q=DIRS[4][0]*radius, r=DIRS[4][1]*radius; const out=[];
  for(let i=0;i<6;i++) for(let j=0;j<radius;j++){ out.push([q,r]); q+=DIRS[i][0]; r+=DIRS[i][1]; }
  return RING_CACHE[radius]=out;
}
const idxOf=(rg,q,r)=>rg.findIndex(c=>c[0]===q&&c[1]===r);
function navToCoords(dir,side,speed){
  const d=speed+1, rg=ring(d), s=idxOf(rg,DIRS[dir][0]*d,DIRS[dir][1]*d);
  return s<0?[0,0]:rg[mod(s+side,rg.length)];
}
function relInfo(q,r,dir){
  const d=Math.trunc(hexDist(q,r)); if(d===0) return [0,-1];
  const rg=ring(d), s=idxOf(rg,DIRS[dir][0]*d,DIRS[dir][1]*d), t=idxOf(rg,q,r);
  if(s<0||t<0) return [null,null];
  let diff=t-s; const n=rg.length;
  if(diff>n/2) diff-=n; else if(diff<-n/2) diff+=n;
  return [diff,d-1];
}

// ---------------- TERRAIN ----------------
// The arena is centred between the two spawns. Open flats in the middle;
// rock gets denser the further out you drift, but six winding canyons run
// back toward the centre. Salvage wrecks lie in the flats. Nothing stops you
// leaving — the desert just makes coming back the easy way.
const SPAWNS=[[0,5,0],[0,-5,3]];
let T_SEED=1, T_CACHE=new Map(), T_PULL=true;
function setPull(v){ T_PULL=v; T_CACHE=new Map(); }
function setTerrainSeed(seed){ if(seed!==T_SEED){ T_SEED=seed; T_CACHE=new Map(); } }
function noise(q,r,scale,seed){ const v=Math.sin((q/scale)*12.9898+(r/scale)*78.233+seed)*43758.5453; return Math.abs(v-Math.trunc(v)); }
const TERRAIN_NAMES=["Open sand","Slate rock","Rust mesa","Tar pit","Old-world wreck"];
function terrain(q,r){
  const k=(q+4096)*8192+(r+4096); let v=T_CACHE.get(k); if(v!==undefined) return v;
  v=computeTerrain(q,r); T_CACHE.set(k,v); return v;
}
function computeTerrain(q,r){
  const so=(T_SEED%9973)/131.7, d=hexDist(q,r);
  if(d<=2) return 0;
  for(const [sq,sr] of SPAWNS) if(hexDist(q-sq,r-sr)<=1) return 0;
  if(T_PULL&&d>=3&&d<=8&&noise(q,r,1,77.7+so)>0.955) return 4;
  let th=T_PULL?0.72-Math.min(0.40,Math.max(0,(d-8)*0.05)):0.72;
  if(T_PULL&&d>=5&&d<=16){
    const x=1.5*q, y=Math.sqrt(3)/2*q+Math.sqrt(3)*r;
    const rot=(T_SEED%360)*Math.PI/180, a=Math.atan2(y,x)-rot;
    const wiggle=Math.sin(d*0.7+so)*0.18;
    const gap=Math.abs(mod(a+wiggle+Math.PI/6,Math.PI/3)-Math.PI/6);
    if(gap*d<1.1) th=0.97;
  }
  const c=noise(q,r,5,0.123+so)*0.7+noise(q,r,1.5,9.876+so)*0.3;
  if(c<=th) return 0;
  const b=noise(q,r,15,42.1337+so); return b<0.33?1:b<0.66?2:3;
}
const isObstacle=(q,r)=>{ const t=terrain(q,r); return t>=1&&t<=3; };
function angleDifficulty(dir,tq,tr,sq,sr){
  if(isObstacle(sq+tq,sr+tr)) return [0,false];
  const [side,speed]=relInfo(tq,tr,dir);
  if(side===null) return [0,true];
  const d=speed+1; if(d===0) return [0,true];
  const dev=Math.abs(side)/d;
  if(dev<0.5) return [0,true]; if(dev<=1) return [R.DC_MOD_EASY,true]; if(dev<=1.5) return [R.DC_MOD_HARD,true];
  return [0,false];
}

// ---------------- FACTIONS, SHIPS & CREW ----------------
// Every ship sails under a faction; every crew member belongs to one.
// Kindred: each crew member who shares the ship's faction adds +2 hull.
const FACTIONS = {
  MACHINE:{name:"Scrappers",long:"Followers of the Machine",color:"#c4622c",
    perk:"+1 damage on hits. Epic orders after a hit",creed:"The ship is the living body. Mercy is for the weak."},
  HEART:{name:"Nomads",long:"Followers of the Heart",color:"#3fb0a0",
    perk:"After a stable drift: +1 to all rolls. Epic orders after a stable drift",creed:"When the wind is right, crew and ship move as one."},
  WIND:{name:"Drifters",long:"Followers of the Wind",color:"#e2c27a",
    perk:"+1 to boost and drift rolls. Every order rests only 1 turn",creed:"Born to fly and fight. Owned by no one, lost never."},
};
const KINDRED_HULL=1;
// Hulls a faction will not sail: Scrappers distrust the old-world relic, Drifters scorn the slow fortress.
const FORBIDDEN={MACHINE:["RELIC"],WIND:["HAULER"]};
const shipAllowed=(cls,fac)=>!(FORBIDDEN[fac]||[]).includes(cls);
const CLASSES = {
  SKIFF:{name:"Skiff",role:"Runner",size:"Small",hull:13,energy:3,parts:2,bst:1,dft:1,atk:0,dmg:0,rep:2,speed:4,salvage:2,
    text:"Light and quick. Only 13 hull, but speed up to 4, +1 boost and drift, repairs +2, wrecks give 2 parts.",lore:"A regatta catamaran of the dune sea: two knife hulls, a tall wing sail, no armour."},
  HAULER:{name:"Hauler",role:"Fortress",size:"Huge",hull:14,energy:3,parts:2,bst:-1,dft:0,atk:0,dmg:0,rep:0,crew:4,
    text:"Mobile fortress. Room for 4 crew, −1 to boost rolls.",lore:"A great junk with three battened sails that carries a whole camp on its back."},
  DREAD:{name:"Dreadnought",role:"Ripper",size:"Large",hull:17,energy:3,parts:1,bst:0,dft:0,atk:1,dmg:1,rep:0,twin:true,half:true,
    text:"Twin guns: every shot rolls to hit twice, each hit does half damage (+1 before halving). Steadier damage, fewer clean misses. +1 attack, one fewer part.",lore:"A war junk: a ram at the bow, a gun behind it and cannons along both rails."},
  RELIC:{name:"Construct",role:"Relic",size:"Medium",hull:15,energy:5,parts:2,bst:0,dft:0,atk:0,dmg:0,rep:0,
    text:"Old-world tech. 5 energy: power every system at once.",lore:"A manta ray of old-world metal. Nobody knows who built it. It hums when the wind dies."},
};
// f = faction, st = station (phase where the order works)
const CREW = [
  // Followers of the Machine — Scrappers
  {key:"IRONCAPT",f:"MACHINE",name:"VOSS",role:"Iron Captain",st:"ATK",epic:"HIT",passive:"+1 attack rolls",order:"Knock Them Down!",text:"After a hit: stun a random enemy crew member (no lock needed)",pal:["#c08a68","#7a3a1c","#3a2418","#e8dcc8"]},
  {key:"HARPOON",f:"MACHINE",name:"GRIT",role:"Harpooner",st:"ATK",epic:"HIT",passive:"+1 damage on hits",order:"Chain Shot",text:"After a hit, no lock needed: d6 1 speed, 2 boost, 3 drift, 4 weapons −1; 5–6 fire in the engines (enemy loses NAV or ENG next turn)",pal:["#a87050","#a4502a","#4a2c1c","#2a1a14"]},
  {key:"MECHANIC",f:"MACHINE",name:"BRAKK",role:"Engineer",st:"ENG",passive:"Repair heals +1",order:"Field Fix",text:"All system damage −1",pal:["#c89068","#c06a28","#5a3a24","#e8dcc8"]},
  {key:"TECH",f:"MACHINE",name:"IVO",role:"Reactor Tech",st:"ENG",passive:"+1 energy cap",order:"Surge",text:"Next roll this turn +5",pal:["#d8a888","#8a5a3a","#3a2a22","#5ab8b0"]},
  {key:"QM",f:"MACHINE",name:"SAL",role:"Scavenger",st:"ENG",passive:"+1 part; reload gives 2 ammo",order:"Salvage",text:"+2 spare parts",pal:["#b88860","#6a4a30","#7a4a28","#c83c28"]},
  // Followers of the Heart — Nomads
  {key:"CAPTAIN",f:"HEART",name:"RHO",role:"Captain",st:"ANY",epic:"DRIFT",passive:"+1 to all rolls",order:"Battle Stations",text:"Repeat this phase once",pal:["#e0b088","#e8d8b8","#7a4a2a","#2f8fb0"]},
  {key:"GUNNER",f:"HEART",name:"KAEL",role:"Soldier",st:"ATK",passive:"+2 attack rolls",order:"Double Tap",text:"+1 ammo, fire again",pal:["#d09870","#5a3a24","#6a4024","#d8402c"]},
  {key:"BULWARK",f:"HEART",name:"DOV",role:"Bulwark",st:"ATK",passive:"Enemy attacks on you −1",order:"Brace",text:"Damage you take −3 until your next turn",pal:["#8a5a40","#b08048","#4a3020","#e8b830"]},
  {key:"ECO",f:"HEART",name:"FENN",role:"Ecologist",st:"NAV",epic:"DRIFT",passive:"Crashing into rock deals 1, not 3",order:"Sandstorm",text:"Enemy −2 to all rolls on their next turn",pal:["#c8a078","#7a8a3a","#6a4a30","#3ab89a"]},
  {key:"MEDIC",f:"HEART",name:"ANA",role:"Medic",st:"ENG",epic:"DRIFT",passive:"Your stunned crew recover at the start of your turn",order:"Patch Up",text:"Heal 3 hull, no parts needed",pal:["#f0c8a8","#a04a2a","#7a3a28","#c84a9a"]},
  // Followers of the Wind — Drifters
  {key:"WINDCAPT",f:"WIND",name:"SELA",role:"Wind Captain",st:"NAV",passive:"A failed drift still lets you set your heading. Epic, Song of the Wind: below half hull, engine power adds no DC and +2 to boost rolls",order:"Tailwind",text:"Next boost this turn: DC −4",pal:["#d8b090","#f0e6cc","#d8c08a","#5ad8e8"]},
  {key:"ACE",f:"WIND",name:"VEX",role:"Ace Pilot",st:"NAV",passive:"+2 boost rolls",order:"Afterburn",text:"Next boost auto-succeeds",pal:["#f0c098","#e0b860","#c8a060","#f0a040"]},
  {key:"DRIFTER",f:"WIND",name:"ORO",role:"Wayfinder",st:"NAV",passive:"+2 drift rolls",order:"Evasive",text:"Enemy attacks −3 until your next turn",pal:["#b07850","#c8a878","#e0cc9a","#6ae0c8"]},
  {key:"SPOTTER",f:"WIND",name:"NYX",role:"Spotter",st:"ATK",passive:"+3 lock rolls",order:"Auto-Lock",text:"Instant lock, no roll",pal:["#f0d0b0","#e8d8a8","#b89058","#e86a8a"]},
  {key:"JAMMER",f:"WIND",name:"ZED",role:"Jammer",st:"ATK",passive:"Enemy locks on you −2",order:"Jam Weapons",text:"Enemy −2 to lock and attack rolls on their next turn",pal:["#986848","#a08858","#d4b878","#a0e860"]},
];
const CREW_BY = Object.fromEntries(CREW.map(c=>[c.key,c]));

// ---------------- RNG (seeded, part of the game state) ----------------
function rnd(G,n){
  let t=(G.rng=(G.rng+0x6D2B79F5)>>>0);
  t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61);
  const u=((t^(t>>>14))>>>0)/4294967296;
  return 1+Math.floor(u*n);
}
function hashStr(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h; }

// ---------------- STATE ----------------
function newShip(pid,q,r,o){
  return {pid,cls:null,fac:null,q,r,o,hp:26,maxHp:26,baseEnergy:R.START_ENERGY,parts:R.START_PARTS,ammo:R.START_AMMO,
    sys:{eng:0,bst:0,dft:0,wpn:0},dmg:{SPEED:0,BOOST:0,DRIFT:0,WEAPONS:0},
    f:{targeted:false,reloaded:false,shots:0,drift:false,locked:false,debuff:null},
    crew:[],evasive:false,surge:0,autoBoost:false,
    tailwind:false,storm:false,brace:false,jamW:false,lostPhase:null};
}
function newGame(seed){
  seed=(seed>>>0)||1; setTerrainSeed(seed);
  const G={v:2,seed,rng:seed,moves:[],ships:SPAWNS.map((s,i)=>newShip(i+1,s[0],s[1],s[2])),active:0,
    draft:{order:[0,1],idx:0},
    phase:"DRAFT",queue:[],qi:0,repeated:false,st:"draft",target:null,dc:0,aim:null,
    roll:null,winner:null,looted:[],turn:0,hits:0,log:[],story:[],ev:[]};
  tell(G,"open",{});
  return G;
}
const S=G=>G.ships[G.active];
const other=(G,s)=>G.ships.find(x=>x!==s);
const tgt=G=>G.ships.find(x=>x.pid===G.target)||null;
const shipName=s=>"P"+s.pid;
function actor(G){ if(G.st==="over") return -1; return G.st==="draft"?G.draft.order[G.draft.idx]:G.active; }
function log(G,t,c=""){ G.log.unshift({t,c}); if(G.log.length>80) G.log.pop(); }
function ev(G,e){ G.ev.push(e); }

const cls=s=>CLASSES[s.cls]||{bst:0,dft:0,atk:0,dmg:0,rep:0};
const maxSpeed=s=>cls(s).speed||3;
const crewSlots=s=>cls(s).crew||3;
const songOfWind=s=>has(s,"WINDCAPT")&&s.hp*2<s.maxHp;
const maxShots=s=>cls(s).shots||1;
const has=(s,key)=>s.crew.some(c=>c.key===key&&!c.stun);
function energyCap(s){ const p=s.hp/s.maxHp; if(p<R.HP_FAIL) return 0; if(p<R.HP_CRIT) return 1; return s.baseEnergy+(has(s,"TECH")?1:0); }
const energyUsed=s=>s.sys.eng+s.sys.bst+s.sys.dft+s.sys.wpn;
const hullPen=s=>(s.hp/s.maxHp<R.HP_FAIL?-1:0);
const effEngine=s=>Math.max(0,s.sys.eng-s.dmg.SPEED);
function integrity(G,s){
  const cap=energyCap(s);
  if(energyUsed(s)>cap){
    log(G,`${shipName(s)} power failure! Cap dropped to ${cap}.`,"bad");
    s.sys={eng:0,bst:0,dft:0,wpn:0};
    if(cap===1){ s.sys.eng=1; log(G,"Emergency power to engines."); }
  }
}
function crewMods(s,kind,target,consume){
  const m=[];
  if(has(s,"CAPTAIN")) m.push([1,"RHO"]);
  if(kind==="ATK"&&has(s,"IRONCAPT")) m.push([1,"VOSS"]);
  if((kind==="BOOST"||kind==="DRIFT")&&s.fac==="WIND") m.push([1,"Drifters"]);
  if(s.fac==="HEART"&&s.f&&s.f.drift) m.push([1,"Nomads"]);
  if((kind==="LOCK"||kind==="ATK")&&s.jamW) m.push([-2,"jammed"]);
  if(s.storm) m.push([-2,"sandstorm"]);
  if(kind==="BOOST"&&has(s,"ACE")) m.push([2,"VEX"]);
  if(kind==="BOOST"&&songOfWind(s)) m.push([2,"Song of the Wind"]);
  if(kind==="DRIFT"&&has(s,"DRIFTER")) m.push([2,"ORO"]);
  if(kind==="ATK"&&has(s,"GUNNER")) m.push([2,"KAEL"]);
  if(kind==="LOCK"&&has(s,"SPOTTER")) m.push([3,"NYX"]);
  if(s.surge>0){ m.push([s.surge,"surge"]); if(consume) s.surge=0; }
  if(target){
    if(kind==="LOCK"&&has(target,"JAMMER")) m.push([-2,"jammer"]);
    if(kind==="ATK"&&target.evasive) m.push([-3,"evasive"]);
    if(kind==="ATK"&&has(target,"BULWARK")) m.push([-1,"DOV"]);
  }
  return m;
}
function rollCheck(G,label,sides,mods,vs,vsLabel,pid){
  const v=rnd(G,sides), m=mods.filter(x=>x[0]!==0), total=v+m.reduce((a,x)=>a+x[0],0), ok=total>=vs;
  G.roll={label,sides,die:v,mods:m,total,vs:`${vsLabel} ${vs}`,ok,pid};
  log(G,`${label}: d${sides} ${v}${m.map(x=>` ${x[0]>0?"+":""}${x[0]} ${x[1]}`).join("")} = ${total} vs ${vsLabel} ${vs}`,ok?"ok":"bad");
  ev(G,{t:"roll",roll:{...G.roll}});
  return ok;
}

// ---------------- STORYTELLER ----------------
// Deterministic: both players read the same chronicle.
// Generic lines, then faction lines that replace them when the ship has that faction.
// {p} = the ship acting, {t} = the other ship, {c} = a crew name, {s} = a system.
const TALES={
  open:["The bazaar burns behind you. Somewhere past the dunes lies Europa, and only one of these ships will carry the tale.",
        "Two hulls drift across the salt-flats of Tethys. The old roads to Europa are wide enough for one.",
        "Wind scours the bones of the old world. Two crews have heard the same rumour of a relic, and neither will share it."],
  turnFar:["{p} scans the horizon. A dust plume, far off, betrays the enemy.","The badlands swallow sound. {p}'s lookout swears the enemy is still out there."],
  turnNear:["{p} can see the enemy's crew on deck now. Nobody speaks.","Close enough to hear their engines. {p} readies for a fight."],
  boostOk:["{p}'s engines roar and the hull leaps across the sand."],
  boostFail:["{p}'s boost kicks too hard. The ship skates far past the mark."],
  driftOk:["{p} carves a clean arc through the dust."],
  driftFail:["{p} spins out in a spray of sand."],
  crash:["{p} grinds into the rocks. Metal shrieks."],
  ram:["The two hulls slam together. Crews are thrown across the decks."],
  wreck:["{p} finds an old-world wreck half-buried in the dunes and strips it for parts."],
  hit:["{p}'s shot punches through {t}'s plating."],
  miss:["{p}'s shot kicks up a fountain of sand beside {t}."],
  stun:["Shrapnel sweeps {t}'s deck. {c} goes down hard."],
  crit:["{t}'s {s} sputters and smokes."],
  repair:["{p}'s engineers weld scrap over the worst of the holes."],
  order:["{c} of {p}: \"{o}!\""],
  win:["{p} stands alone on the sand. The road to Europa is theirs, for now."],
  fire:["Fire in the engines! Flames lick through {t}'s {s}."],
};
const FACTION_TALES={
  MACHINE:{
    turnFar:["{p} sniffs the wind for diesel. The engine purrs like a hungry animal.","The Scrappers of {p} press their ears to the hull and listen for the enemy's engine."],
    turnNear:["{p}'s Scrappers bang wrenches on the rails. The ship wants a fight.","{p}'s Scrappers flick away their smokes, slap fresh paint on their faces and pull down their helmets."],
    boostOk:["{p} bellows black smoke and lunges forward. The Scrappers howl with it."],
    boostFail:["{p}'s pistons scream past the redline and the ship careens on. The crew curse the engine, then apologise to it."],
    driftOk:["{p} drifts, chains rattling, and the Scrappers bang the hull in praise."],
    driftFail:["{p} lurches sideways. Somewhere below, a Scrapper whispers sorry to the gearbox."],
    crash:["{p} tears its plating on the rocks. The Scrappers wail as if they were the ones bleeding."],
    hit:["Scrap-iron arrows hiss from {p}'s launchers and bite deep into {t}.","{p}'s rivet guns hammer {t}. Bolts and splinters fly."],
    miss:["{p}'s metal arrows clatter off the stones. The Scrappers spit and reload."],
    stun:["{c} of {t} goes down and {p}'s Scrappers cheer, hammering the rails."],
    crit:["{t}'s Scrappers cry out as if wounded themselves: their {s} is hurt."],
    repair:["{p}'s Scrappers stitch the hull with scrap and sing to the engine while they work."],
    win:["{p} rolls over the wreck, already stripping it. The Machine is fed. Europa waits."],
    fire:["\"Fire in the engines!\" {p}'s Scrappers howl as flames gut {t}'s {s}. They want it to burn."],
  },
  HEART:{
    turnFar:["{p}'s Nomads share the last of the water and watch the dunes together.","Around a small stove on {p}'s deck, the Nomads tell stories of Europa while the lookout watches."],
    turnNear:["{p}'s Nomads clasp hands before the fight. Nobody will be left behind.","The enemy is close. {p}'s Nomads pull up their bandanas, push their sunglasses up and tip their hats to each other."],
    boostOk:["{p} surges ahead as one: every hand on a rope, every voice in the chant."],
    boostFail:["{p} overshoots. The Nomads laugh it off and count heads. Everyone is still aboard."],
    driftOk:["{p} swings round with the grace of a caravan that has done this a thousand times."],
    driftFail:["{p} spins out. The Nomads grab each other until the deck stops moving."],
    crash:["{p} strikes rock. The Nomads rush below, first to check on each other, then on the ship."],
    hit:["{p}'s old longrifles crack in unison. The shots strike {t} true.","The Nomads of {p} fire the family guns, and {t} shudders."],
    miss:["{p}'s volley falls short. The elders shake their heads: patience."],
    stun:["{c} of {t} falls. On {p}, the Nomads lower their eyes for a moment before reloading."],
    crit:["{t}'s Nomads call to each other over the noise: the {s} is hurt, but everyone is alive."],
    repair:["{p}'s Nomads patch the hull together, passing tools hand to hand."],
    win:["{p}'s Nomads stand on deck, counting every face. All here. Now, Europa."],
  },
  WIND:{
    turnFar:["{p}'s sails catch a gust that smells of salt and somewhere else.","The Drifters on {p} pull their scarves tight and read the dune ripples like a map.","A low bass thrums from {p}'s deck, carried against the wind. Somewhere out there, other Drifters answer."],
    turnNear:["{p}'s Drifters loosen the sails. Close enough to dance.","The enemy is near. Behind their scarves, {p}'s Drifters hum through their mouth-amps: a deep bass that rolls against the wind."],
    boostOk:["{p} skims the dunes like a thrown stone."],
    boostFail:["A rogue gust takes {p} too far. The Drifters only laugh: the wind decides."],
    driftOk:["{p} slides around the turn, sails singing."],
    driftFail:["{p} spins like a leaf. The Drifters hold on and wait for the wind to be kind."],
    crash:["{p} clips a ridge. The Drifters curse the stone that would not move."],
    hit:["Glass-tipped bolts sing from {p}'s sail-bows and shatter on {t}.","{p} fires from the wind's blind side and {t} never sees it coming."],
    miss:["{p}'s bolts vanish into the sand. The wind was not with them."],
    stun:["{c} of {t} drops. On {p}, a Drifter's mouth-amp drops to a slow, satisfied bass."],
    crit:["{t}'s Drifters groan as their {s} sputters. The wind turns its back."],
    repair:["{p}'s Drifters patch the sails and tie new knots, singing to the breeze."],
    win:["{p}'s sails fill. The Drifters turn toward the horizon. Europa is a direction, not a place."],
  },
};
function tell(G,key,vars,fac){
  const opts=(fac&&FACTION_TALES[fac]&&FACTION_TALES[fac][key])||TALES[key]; if(!opts) return;
  const h=hashStr(G.seed+":"+G.moves.length+":"+G.story.length+":"+key);
  let t=opts[h%opts.length];
  for(const k in vars) t=t.split("{"+k+"}").join(vars[k]);
  G.story.unshift(t); if(G.story.length>40) G.story.pop();
  ev(G,{t:"story",text:t});
}
const cname=s=>s.cls?`P${s.pid}'s ${CLASSES[s.cls].name.toLowerCase()}`:`P${s.pid}`;
const kindred=s=>s.crew.filter(c=>CREW_BY[c.key].f===s.fac).length;

// ---------------- TURN FLOW ----------------
function startTurn(G,idx){
  G.active=idx; const s=S(G); G.turn++;
  s.f={targeted:false,reloaded:false,shots:0,drift:false,locked:false,debuff:null};
  s.evasive=false; s.brace=false; s.crew.forEach(c=>{ if(c.rest>0) c.rest--; });
  if(has(s,"MEDIC")&&s.crew.some(c=>c.stun)){ s.crew.forEach(c=>c.stun=false); log(G,`ANA tends the wounded: ${shipName(s)} crew back on their feet.`,"ok"); }
  G.repeated=false; G.phase="CMD"; G.queue=[]; G.qi=0; G.st="cmd"; G.target=null; G.roll=null; G.aim=null;
  log(G,`— Turn ${G.turn}: Player ${s.pid} —`,"p"+s.pid);
  if(s.lostPhase) log(G,`Fire in the engines! ${shipName(s)} cannot use ${s.lostPhase} this turn.`,"bad");
  if(s.jamW) log(G,`${shipName(s)} weapons jammed: −2 to lock and attack this turn.`,"bad");
  if(s.storm) log(G,`${shipName(s)} is caught in a sandstorm: −2 to all rolls this turn.`,"bad");
  integrity(G,s);
  const o=other(G,s);
  tell(G,hexDist(o.q-s.q,o.r-s.r)<=4?"turnNear":"turnFar",{p:cname(s)},s.fac);
  ev(G,{t:"turn",pid:s.pid});
}
function endTurn(G){
  const s=S(G);
  s.jamW=false; s.lostPhase=null; s.surge=0; s.autoBoost=false; s.tailwind=false; s.storm=false; s.crew.forEach(c=>c.stun=false);
  startTurn(G,G.ships.indexOf(other(G,s)));
}
const slotsAllowed=G=>S(G).lostPhase?2:3;
function beginPhase(G,i){
  G.qi=i; G.phase=G.queue[i]; G.target=null; G.aim=null; const s=S(G);
  if(G.phase==="NAV") G.st="nav_pick";
  if(G.phase==="ATK"){ Object.assign(s.f,{targeted:false,reloaded:false,shots:0,locked:false,debuff:null}); G.st="atk_acquire"; }
  if(G.phase==="ENG") G.st="eng";
}
function endPhase(G){ if(G.qi+1<G.queue.length) beginPhase(G,G.qi+1); else endTurn(G); }

function navOption(s,speed,side){
  const ee=effEngine(s), total=speed+ee*R.ENG_DIST_BONUS;
  const [rq,rr]=navToCoords(s.o,side,total-1);
  const [m,ok]=angleDifficulty(s.o,rq,rr,s.q,s.r);
  if(!ok) return null;
  const mult=songOfWind(s)?1:1+ee*R.ENG_DC_MULT;                     // Song of the Wind: engine power costs no DC
  return {speed,side,q:s.q+rq,r:s.r+rr,dc:Math.trunc((R.DC_BASE+total+m)*mult)-(s.tailwind?4:0)};
}
function allNavOptions(s){ const o=[]; for(let sp=1;sp<=maxSpeed(s);sp++) for(let sd=-3;sd<=3;sd++){ const x=navOption(s,sp,sd); if(x) o.push(x);} return o; }
function arcInfo(s,t){
  if(!t||t.hp<=0) return null;
  const [side,sp]=relInfo(t.q-s.q,t.r-s.r,s.o);
  if(side===null||sp<0||sp>2||Math.abs(side)>3) return null;
  return {range:sp+1,side};
}
function arcHexes(s){ const h=[]; for(let d=1;d<=3;d++) for(let sd=-3;sd<=3;sd++){ const [q,r]=navToCoords(s.o,sd,d-1); h.push([s.q+q,s.r+r]); } return h; }

function damage(G,s,n){
  s.hp=Math.max(0,s.hp-n); ev(G,{t:"hit",pid:s.pid,n});
  if(s.hp===0) log(G,`${shipName(s)} hull breached — ship lost!`,"bad");
  else { log(G,`${shipName(s)} takes ${n} damage (${s.hp} left).`,"bad"); integrity(G,s); }
}
function checkWin(G){
  const alive=G.ships.filter(s=>s.hp>0);
  if(alive.length<=1){
    G.winner=alive[0]?alive[0].pid:0; G.st="over"; G.phase="OVER";
    if(alive[0]) tell(G,"win",{p:cname(alive[0])},alive[0].fac);
    return true;
  }
  return false;
}
function stunCrew(G,t,by){
  const pool=t.crew.filter(c=>!c.stun);
  if(!pool.length){ log(G,"No crew left to stun."); return; }
  const c=pool[rnd(G,pool.length)-1]; c.stun=true;
  log(G,`Crew hit: ${shipName(t)} ${CREW_BY[c.key].name} stunned!`,"bad");
  tell(G,"stun",{p:cname(by),t:cname(t),c:CREW_BY[c.key].name},by.fac);
}

function orderBlock(G,s,c){
  const d=CREW_BY[c.key];
  if(G.st==="over"||s!==S(G)||G.st==="draft") return "Not your turn";
  if(c.stun) return "Stunned";
  if(c.rest>0) return c.used===G.turn?"Order given this turn":`Resting: ready in ${c.rest} turn${c.rest>1?"s":""}`;
  if(G.phase==="CMD") return "Plan your phases first";
  if(d.st!=="ANY"&&d.st!==G.phase) return `Usable in the ${d.st} phase`;
  if(d.epic==="HIT"&&!s.f.hit) return "Epic: hit the enemy first this turn";
  if(d.epic==="DRIFT"&&!s.f.drift) return "Epic: needs a stable drift this turn";
  const t=tgt(G);
  switch(c.key){
    case "CAPTAIN": return G.repeated?"A phase was already repeated":null;
    case "ACE": return G.st!=="nav_pick"?"Use before the boost roll":s.autoBoost?"Already active":null;
    case "DRIFTER": return s.evasive?"Already active":null;
    case "GUNNER": return null;
    case "SPOTTER": return G.st!=="atk_menu"?"Target an enemy first":s.f.targeted?"Lock already used":null;
    case "JAMMER": return !t?"Target an enemy first":t.jamW?"Enemy already jammed":null;
    case "MECHANIC": return Object.values(s.dmg).some(v=>v>0)?null:"No system damage to fix";
    case "TECH": return s.surge?"Already active":null;
    case "QM": return null;
    case "IRONCAPT": { const o=other(G,s); return o.hp<=0?"No target":o.crew.every(c=>c.stun)?"Enemy crew already down":null; }
    case "HARPOON": return other(G,s).hp<=0?"No target":null;
    case "BULWARK": return s.brace?"Already active":null;
    case "ECO": { const o=other(G,s); return o.storm?"Already in a storm":null; }
    case "MEDIC": return s.hp>=s.maxHp?"Hull is full":null;
    case "WINDCAPT": return G.st!=="nav_pick"?"Use before the boost roll":s.tailwind?"Already active":null;
  }
  return null;
}

// ---------------- LEGAL MOVES ----------------
function legal(G){
  const L=[];
  if(G.st==="over") return L;
  if(G.st==="draft"){
    const s=G.ships[actor(G)];
    if(!s.cls){ for(const k in CLASSES) for(const f in FACTIONS) if(shipAllowed(k,f)) L.push("C:"+k+":"+f); }
    else { for(const f in FACTIONS) L.push(defaultCrewMove(s,f)); }   // examples; any valid crew is legal (see isLegal)
    return L;
  }
  const s=S(G);
  if(G.phase!=="CMD") s.crew.forEach((c,i)=>{ if(!orderBlock(G,s,c)) L.push("O:"+(i+1)); });
  switch(G.st){
    case "cmd": for(const p of ["NAV","ATK","ENG"]) if(!G.queue.includes(p)&&p!==s.lostPhase) L.push("Q:"+p); if(G.queue.length) L.push("Q-"); break;
    case "nav_pick": {
      const opts=allNavOptions(s);
      for(const o of opts) L.push(`B:${o.speed}:${o.side>0?"+":""}${o.side}`);
      if(!opts.length) L.push("PIVOT:L","PIVOT:R");
      L.push("END"); break; }
    case "nav_drift": L.push("DRIFT"); break;
    case "nav_heading": for(const d of DIR_NAMES) L.push("H:"+d); break;
    case "done": L.push("END"); break;
    case "atk_acquire": if(arcInfo(s,other(G,s))) L.push("TGT"); if(!s.f.reloaded) L.push("RLD"); L.push("END"); break;
    case "atk_menu": {
      const t=tgt(G);
      if(!s.f.targeted&&!s.f.reloaded&&s.f.drift) L.push("LOCK");
      if(!s.f.targeted&&!s.f.reloaded) L.push("RLD");
      if(s.f.shots<maxShots(s)&&s.ammo>0&&arcInfo(s,t)) L.push("FIRE");
      L.push("END"); break; }
    case "atk_debuff": for(const [k] of DEBUFFS) L.push("AIM:"+k); break;
    case "atk_dmg": L.push("DMG"); break;
    case "eng": {
      const cap=energyCap(s), used=energyUsed(s);
      for(const [k,lab] of SYS){ const K=Object.keys(SYS_KEYS).find(x=>SYS_KEYS[x]===k);
        if(used<cap&&!(k==="eng"&&s.sys.eng>=2)) L.push("+"+K);
        if(s.sys[k]>0) L.push("-"+K); }
      if(s.parts>0&&s.hp<s.maxHp) L.push("REP");
      L.push("END"); break; }
  }
  return L;
}

// Crew are picked in one move:  CREW:KEY1,KEY2,KEY3  (Hauler: 4).  Crew are not exclusive.
function validCrewMove(G,a){
  if(G.st!=="draft"||!a.startsWith("CREW:")) return false;
  const s=G.ships[actor(G)]; if(!s.cls) return false;
  const keys=a.slice(5).split(",");
  return keys.length===crewSlots(s)&&new Set(keys).size===keys.length&&keys.every(k=>CREW_BY[k])
    &&keys.filter(k=>/Captain/.test(CREW_BY[k].role)).length<=1;          // only one captain per crew
}
// The computer's crew for each faction, in pick order (a Hauler takes the 4th as well).
const AI_CREW={MACHINE:["IRONCAPT","HARPOON","TECH","MECHANIC"],HEART:["CAPTAIN","GUNNER","MEDIC","BULWARK"],WIND:["WINDCAPT","ACE","SPOTTER","DRIFTER"]};
function defaultCrewMove(s,f){ return "CREW:"+AI_CREW[f].slice(0,crewSlots(s)).join(","); }
function isLegal(G,a){ return validCrewMove(G,a)||legal(G).includes(a); }

// ---------------- APPLY ----------------
function apply(G,a){
  if(!isLegal(G,a)) throw new Error("Illegal move: "+a+" (state "+G.st+")");
  G.moves.push(a); G.ev=[];
  if(a.startsWith("O:")) { useOrder(G,+a.slice(2)-1); return G; }
  const [head,arg,arg2]=a.split(":");
  switch(G.st){
    case "draft": draftMove(G,head,arg,arg2); break;
    case "cmd":
      if(a==="Q-") G.queue.pop();
      else { G.queue.push(arg); if(G.queue.length===slotsAllowed(G)){ log(G,"Plan: "+G.queue.join(" → ")); beginPhase(G,0); } }
      break;
    case "nav_pick":
      if(a==="END"){ endPhase(G); break; }
      if(head==="PIVOT"){ const s=S(G); s.o=mod(s.o+(arg==="L"?-1:1),6); log(G,`Pivot in place to ${DIR_NAMES[s.o]}.`); G.st="done"; break; }
      doBoost(G,+arg,+arg2); break;
    case "nav_drift": doDrift(G); break;
    case "nav_heading": S(G).o=DIR_NAMES.indexOf(arg); log(G,`Heading locked: ${arg}.`); G.st="done"; break;
    case "done": endPhase(G); break;
    case "atk_acquire": case "atk_menu":
      if(a==="END"){ endPhase(G); break; }
      if(a==="TGT"){ const t=other(G,S(G)); G.target=t.pid; G.st="atk_menu"; log(G,`Target acquired: ${shipName(t)}.`,"ok"); break; }
      if(a==="RLD"){ const s=S(G); s.ammo=Math.max(s.ammo,has(s,"QM")?2:1,cls(s).ammo||1); s.f.reloaded=true; log(G,`Reloaded. Ammo ${s.ammo}.`); break; }
      if(a==="LOCK"){ doLock(G); break; }
      if(a==="FIRE"){ doFire(G); break; }
      break;
    case "atk_debuff": { const s=S(G); s.f.debuff=arg; s.f.targeted=true; log(G,`Aiming at enemy ${arg.toLowerCase()}.`); G.st="atk_menu"; break; }
    case "atk_dmg": doDamage(G); break;
    case "eng": {
      const s=S(G);
      if(a==="END"){ endPhase(G); break; }
      if(a==="REP"){ doRepair(G); break; }
      const k=SYS_KEYS[a.slice(1)]; s.sys[k]+=a[0]==="+"?1:-1; break; }
  }
  return G;
}
function draftMove(G,head,key,fac){
  const s=G.ships[actor(G)];
  if(head==="C"){
    const c=CLASSES[key]; s.cls=key; s.fac=fac; s.maxHp=s.hp=c.hull; s.baseEnergy=c.energy; s.parts=c.parts; s.ammo=c.ammo||R.START_AMMO;
    log(G,`P${s.pid} takes a ${c.name} under the ${FACTIONS[fac].name}.`,"p"+s.pid); return;
  }
  for(const k of key.split(",")){ s.crew.push({key:k,rest:0,stun:false}); if(k==="QM") s.parts++; }
  log(G,`P${s.pid} crew: ${s.crew.map(c=>CREW_BY[c.key].name).join(", ")}.`,"p"+s.pid);
  G.draft.idx++;
  if(G.draft.idx>=G.draft.order.length){
    for(const sh of G.ships){ const k=kindred(sh); if(k){ sh.maxHp+=k*KINDRED_HULL; sh.hp=sh.maxHp; log(G,`P${sh.pid} kindred crew: ${k} × +${KINDRED_HULL} hull.`,"p"+sh.pid); } }
    startTurn(G,0);
  }
}
function doBoost(G,speed,side){
  const s=S(G), opt=navOption(s,speed,side);
  G.dc=opt.dc; G.aim={q:opt.q,r:opt.r}; if(s.tailwind){ s.tailwind=false; log(G,"Tailwind: boost DC −4.","ok"); }
  let ok;
  if(s.autoBoost){ s.autoBoost=false; ok=true; G.roll={label:"BOOST",sides:20,auto:true,ok:true,vs:"DC "+opt.dc,pid:s.pid}; ev(G,{t:"roll",roll:{...G.roll}}); log(G,"Afterburn! Boost auto-succeeds.","ok"); }
  else ok=rollCheck(G,"BOOST",20,[[s.sys.bst,"BST"],[cls(s).bst,"hull class"],[hullPen(s),"hull"],[-s.dmg.BOOST,"dmg"],...crewMods(s,"BOOST",null,true)],opt.dc,"DC",s.pid);
  let dest;
  if(ok){ log(G,"Boost success.","ok"); dest={q:opt.q,r:opt.r}; tell(G,"boostOk",{p:cname(s)},s.fac); }
  else { log(G,"Boost failed! Overshooting +50%.","bad"); const [q,r]=hexRound(s.q+(opt.q-s.q)*1.5, s.r+(opt.r-s.r)*1.5); dest={q,r}; tell(G,"boostFail",{p:cname(s)},s.fac); }
  ev(G,{t:"move",pid:s.pid,from:{q:s.q,r:s.r},to:dest});
  s.q=dest.q; s.r=dest.r;
  const tt=terrain(s.q,s.r);
  if(isObstacle(s.q,s.r)){ log(G,`${shipName(s)} crashed into ${TERRAIN_NAMES[tt].toLowerCase()}!`,"bad"); tell(G,"crash",{p:cname(s)},s.fac); damage(G,s,has(s,"ECO")?1:R.CRASH_DMG); }
  const k=s.q+","+s.r;
  if(tt===4&&!G.looted.includes(k)){ const n=cls(s).salvage||1; G.looted.push(k); s.parts+=n; log(G,`${shipName(s)} salvages a wreck: +${n} spare part${n>1?"s":""}.`,"ok"); tell(G,"wreck",{p:cname(s)},s.fac); }
  const o=other(G,s);
  if(o.hp>0&&o.q===s.q&&o.r===s.r){ log(G,"Collision! Both ships rammed.","bad"); tell(G,"ram",{}); damage(G,s,R.CRASH_DMG); damage(G,o,R.CRASH_DMG); }
  if(checkWin(G)) return;
  G.st="nav_drift";
}
function doDrift(G){
  const s=S(G);
  const ok=rollCheck(G,"DRIFT",20,[[s.sys.dft,"DFT"],[cls(s).dft,"hull class"],[hullPen(s),"hull"],[-s.dmg.DRIFT,"dmg"],...crewMods(s,"DRIFT",null,true)],G.dc,"DC",s.pid);
  s.f.drift=ok;
  if(ok){ log(G,"Drift stable. Set your heading.","ok"); G.st="nav_heading"; tell(G,"driftOk",{p:cname(s)},s.fac); }
  else if(has(s,"WINDCAPT")){ log(G,"Drift failed, but SELA keeps the helm. Set your heading (no lock-on this turn).","bad"); tell(G,"driftFail",{p:cname(s)},s.fac); G.st="nav_heading"; }
  else { s.o=mod(s.o+(rnd(G,2)===1?-1:1),6); log(G,`Drift failed — spun out to ${DIR_NAMES[s.o]}.`,"bad"); tell(G,"driftFail",{p:cname(s)},s.fac); G.st="done"; }
}
function doLock(G){
  const s=S(G), t=tgt(G);
  const ok=rollCheck(G,"LOCK",20,[[s.sys.wpn,"WPN"],[-s.dmg.WEAPONS,"dmg"],...crewMods(s,"LOCK",t,true)],R.LOCK_DC,"DC",s.pid);
  if(ok){ s.f.locked=true; log(G,"Lock confirmed. Pick a system to cripple.","ok"); G.st="atk_debuff"; }
  else { s.f.targeted=true; log(G,"Lock failed.","bad"); G.st="atk_menu"; }
}
function doFire(G){
  const s=S(G), t=tgt(G), ai=arcInfo(s,t);
  const ac=R.BASE_AC+R.AC_DIST[ai.range-1];
  s.ammo--; s.f.shots++;
  // Twin guns (Dreadnought): one shot, two attack rolls; each hit does half damage.
  const rolls=cls(s).twin?2:1; let hits=0;
  for(let i=0;i<rolls;i++){
    const hit=rollCheck(G,rolls>1?`ATTACK ${i+1}/2`:"ATTACK",20,[[s.f.locked?R.LOCK_BONUS:0,"lock"],[s.sys.wpn,"WPN"],[cls(s).atk,"hull class"],[hullPen(s),"hull"],[-s.dmg.WEAPONS,"dmg"],...crewMods(s,"ATK",t,true)],ac,"AC",s.pid);
    ev(G,{t:"shot",from:s.pid,to:t.pid,hit});
    if(hit) hits++;
  }
  G.hits=hits;
  const ok=hits>0;
  if(ok){ log(G,hits>1?"Two hits! Roll damage.":"Hit! Roll damage.","ok"); G.st="atk_dmg"; }
  else { log(G,"Shot missed.","bad"); tell(G,"miss",{p:cname(s),t:cname(t)},s.fac); ev(G,{t:"miss",pid:t.pid}); s.f.locked=false; s.f.debuff=null; G.st="atk_menu"; }
}
function doDamage(G){
  const s=S(G), t=tgt(G), hits=G.hits||1;
  s.f.hit=true;
  tell(G,"hit",{p:cname(s),t:cname(t)},s.fac);
  for(let i=0;i<hits&&t.hp>0;i++){
    const v=rnd(G,6), mods=[[R.DMG_BONUS,"base"],[s.sys.wpn,"WPN"],[cls(s).dmg,"hull class"],[-s.dmg.WEAPONS,"dmg"],
      [has(s,"HARPOON")?1:0,"GRIT"],[s.fac==="MACHINE"?1:0,"Scrappers"],[t.brace?-3:0,"brace"]].filter(x=>x[0]!==0);
    const raw=Math.max(1,v+mods.reduce((a,x)=>a+x[0],0)), n=cls(s).half?Math.ceil(raw/2):raw;
    if(cls(s).half) mods.push([n-raw,"twin guns ½"]);
    G.roll={label:hits>1?`DAMAGE ${i+1}/${hits}`:"DAMAGE",sides:6,die:v,mods,total:n,dmg:true,pid:s.pid};
    ev(G,{t:"roll",roll:{...G.roll}});
    damage(G,t,n);
  }
  G.hits=0;
  if(t.hp>0&&s.f.debuff){
    if(s.f.debuff==="CREW") stunCrew(G,t,s);
    else { t.dmg[s.f.debuff]++; log(G,`Critical: ${shipName(t)} ${s.f.debuff.toLowerCase()} −1.`,"bad"); tell(G,"crit",{t:cname(t),s:s.f.debuff.toLowerCase()},t.fac); }
  }
  s.f.debuff=null; s.f.locked=false;
  if(checkWin(G)) return;
  G.st="atk_menu";
}
function doRepair(G){
  const s=S(G);
  const v=rnd(G,4), extra=(has(s,"MECHANIC")?1:0)+cls(s).rep, heal=Math.max(1,v+extra);
  s.parts--; s.hp=Math.min(s.maxHp,s.hp+heal);
  G.roll={label:"REPAIR",sides:4,die:v,mods:[[extra,"crew/class/faction"]].filter(x=>x[0]),total:heal,heal:true,pid:s.pid};
  ev(G,{t:"roll",roll:{...G.roll}});
  log(G,`Repaired ${heal} hull. Parts left: ${s.parts}.`,"ok"); tell(G,"repair",{p:cname(s)},s.fac); integrity(G,s);
}
function useOrder(G,i){
  const s=S(G), c=s.crew[i], d=CREW_BY[c.key];
  switch(c.key){
    case "CAPTAIN": G.queue.splice(G.qi+1,0,G.phase); G.repeated=true; log(G,`${G.phase} phase will repeat.`); break;
    case "ACE": s.autoBoost=true; break;
    case "DRIFTER": s.evasive=true; break;
    case "GUNNER": s.ammo++; s.f.shots=Math.max(0,s.f.shots-1); break;
    case "SPOTTER": s.f.locked=true; G.st="atk_debuff"; break;
    case "JAMMER": tgt(G).jamW=true; break;
    case "MECHANIC": for(const k in s.dmg) s.dmg[k]=Math.max(0,s.dmg[k]-1); break;
    case "TECH": s.surge=5; break;
    case "QM": s.parts+=2; break;
    case "IRONCAPT": stunCrew(G,other(G,s),s); break;
    case "HARPOON": { const t=other(G,s), r=rnd(G,6);
      if(r<=4){ const k=["SPEED","BOOST","DRIFT","WEAPONS"][r-1]; t.dmg[k]++; log(G,`Chain shot d6 ${r}: ${shipName(t)} ${k.toLowerCase()} −1.`,"bad"); tell(G,"crit",{t:cname(t),s:k.toLowerCase()},t.fac); }
      else if(!t.lostPhase){ const r2=rnd(G,6); t.lostPhase=r2<=3?"NAV":"ENG"; log(G,`Chain shot d6 ${r}: fire in the engines! d6 ${r2}: ${shipName(t)} loses ${t.lostPhase} next turn.`,"bad"); tell(G,"fire",{p:cname(s),t:cname(t),s:t.lostPhase==="NAV"?"drive":"power plant"},s.fac); }
      else { t.dmg.SPEED++; log(G,`Chain shot d6 ${r}: the engines already burn; ${shipName(t)} speed −1.`,"bad"); }
      break; }
    case "BULWARK": s.brace=true; break;
    case "ECO": other(G,s).storm=true; break;
    case "MEDIC": { const h=Math.min(3,s.maxHp-s.hp); s.hp+=h; log(G,`ANA patches ${h} hull.`,"ok"); integrity(G,s); break; }
    case "WINDCAPT": s.tailwind=true; break;
  }
  // counts down at the start of each of your turns: rest n+1 now = sits out your next n turns
  c.rest=(s.fac==="WIND"?1:R.REST)+1; c.used=G.turn;
  log(G,`Order: ${d.name} — ${d.order}. ${d.text}.`,"crew");
  tell(G,"order",{c:d.name,p:cname(s),o:d.order},s.fac);
  ev(G,{t:"order",pid:s.pid,text:d.order});
}

// ---------------- COMPUTER OPPONENT ----------------
// The computer follows a short rule card plus a few d6 rolls, so it can also be run
// on a real table with real dice. Its dice come from the seed and the turn number
// (not from the game's dice stream), so a replay always repeats its choices.
//
//  SETUP   Faction d6: 1–2 Scrappers, 3–4 Nomads, 5–6 Drifters.
//          Ship d6: 1 Skiff, 2 Hauler, 3 Dreadnought, 4 Construct,
//                   5–6 its faction's ship (Scrappers Dreadnought, Nomads Hauler, Drifters Skiff).
//                   A ship its faction won't sail (Scrappers: Construct, Drifters: Hauler) becomes its faction's ship.
//          Crew: its faction's list (AI_CREW below), captain first; a Hauler takes 4.
//  EACH TURN roll two d6:
//          Intent: ENGAGE on 2+ while hull is at least half, on 4+ when below half; otherwise ESCAPE.
//          Style:  1–3 EASY (always take the lowest DC), 4–6 RISKY (always take the highest DC).
//  PLAN    Engage: NAV → ATK → ENG.   Escape: ENG → NAV → ATK.
//  ORDERS  Whenever a crew order is possible, give it (first crew first).
//  NAV     Engage: a course ending 1–3 hexes from the enemy (none: the closest one).
//          Escape: the course ending farthest from the enemy.
//          Pick by Style (DC); ties: the straighter course, then the slower one.
//          After a stable drift, face the enemy (Escape: face away).
//  ATK     Target if in arc. Out of ammo: reload. Lock on if possible, then fire while possible.
//          Critical aim d6: 1–3 weapons, 4–5 speed, 6 crew.
//  ENG     Below half hull: repair while parts last.
//          Then power up: Engage WPN, BST, DFT.  Escape ENGINE, BST, DFT.
function aiD6(G,tag){ return 1+hashStr(G.seed+":"+G.turn+":"+tag)%6; }
function aiSetup(G){
  const s=G.ships[actor(G)];
  const f=aiD6(G,"faction"+s.pid), fac=f<=2?"MACHINE":f<=4?"HEART":"WIND";
  const own={MACHINE:"DREAD",HEART:"HAULER",WIND:"SKIFF"}[fac];
  let c=aiD6(G,"ship"+s.pid), shipCls=c===1?"SKIFF":c===2?"HAULER":c===3?"DREAD":c===4?"RELIC":own;
  if(!shipAllowed(shipCls,fac)) shipCls=own;                       // a ship the faction won't sail: take its own
  return {fac,cls:shipCls,rolls:[f,c]};
}
function aiPlan(G){
  const s=S(G), healthy=s.hp*2>=s.maxHp, intent=aiD6(G,"intent"), style=aiD6(G,"style");
  return {engage:intent>=(healthy?2:4), risky:style>=4, intent, style, healthy};
}
function aiDirToward(s,q,r){
  const x1=1.5*s.q, y1=Math.sqrt(3)/2*s.q+Math.sqrt(3)*s.r, x2=1.5*q, y2=Math.sqrt(3)/2*q+Math.sqrt(3)*r;
  return mod(Math.round(Math.atan2(x2-x1,-(y2-y1))*180/Math.PI/60),6);
}
function aiMove(G){
  const L=legal(G); if(!L.length) return null;
  if(G.st==="draft"){
    const s=G.ships[actor(G)], su=aiSetup(G);
    return s.cls?defaultCrewMove(s,s.fac):`C:${su.cls}:${su.fac}`;
  }
  const s=S(G), o=other(G,s), P=aiPlan(G);
  const ord=L.find(m=>m.startsWith("O:"));
  if(ord&&!["atk_debuff","atk_dmg","nav_drift"].includes(G.st)) return ord;
  const toward=aiDirToward(s,o.q,o.r), want=P.engage?toward:mod(toward+3,6);
  switch(G.st){
    case "cmd": { const plan=P.engage?["NAV","ATK","ENG"]:["ENG","NAV","ATK"]; return "Q:"+plan.find(p=>!G.queue.includes(p)&&p!==s.lostPhase); }
    case "nav_pick": {
      const opts=allNavOptions(s);
      if(!opts.length){ const d=mod(want-s.o,6); return d>=1&&d<=3?"PIVOT:R":"PIVOT:L"; }
      const dist=x=>hexDist(o.q-x.q,o.r-x.r);
      let pool;
      if(P.engage){ pool=opts.filter(x=>dist(x)>=1&&dist(x)<=3); if(!pool.length){ const m=Math.min(...opts.map(dist)); pool=opts.filter(x=>dist(x)===m); } }
      else { const m=Math.max(...opts.map(dist)); pool=opts.filter(x=>dist(x)===m); }
      pool.sort((a,b)=>(P.risky?b.dc-a.dc:a.dc-b.dc)||Math.abs(a.side)-Math.abs(b.side)||a.speed-b.speed);
      const c=pool[0]; return `B:${c.speed}:${c.side>0?"+":""}${c.side}`;
    }
    case "nav_drift": return "DRIFT";
    case "nav_heading": return "H:"+DIR_NAMES[want];
    case "done": return "END";
    case "atk_acquire": return L.includes("TGT")?"TGT":(s.ammo<=0&&L.includes("RLD"))?"RLD":"END";
    case "atk_menu":
      if(s.ammo<=0&&L.includes("RLD")) return "RLD";
      if(L.includes("LOCK")) return "LOCK";
      if(L.includes("FIRE")) return "FIRE";
      return "END";
    case "atk_debuff": { const r=aiD6(G,"crit"+G.moves.length); return "AIM:"+(r<=3?"WEAPONS":r<=5?"SPEED":"CREW"); }
    case "atk_dmg": return "DMG";
    case "eng":
      if(L.includes("REP")&&s.hp*2<s.maxHp) return "REP";
      for(const k of P.engage?["WPN","BST","DFT"]:["ENG","BST","DFT"]) if(L.includes("+"+k)) return "+"+k;
      return "END";
  }
  return L.includes("END")?"END":L[0];
}

// ---------------- RECORD / NOTATION ----------------
// Moves are grouped into "plies": consecutive moves by the same player.
function replay(seed,moves){ const G=newGame(seed); for(const m of moves) apply(G,m); G.ev=[]; return G; }
function plies(seed,moves){
  const G=newGame(seed), out=[]; let cur=null;
  for(const m of moves){
    const who=actor(G);
    if(!cur||cur.who!==who){ cur={who,moves:[]}; out.push(cur); }
    cur.moves.push(m); apply(G,m);
  }
  return out;
}
function plyText(p){ return p.moves.join(" ").replace(/Q:(\w+) Q:(\w+)(?: Q:(\w+))?/,(m,a,b,c)=>"Q:"+[a,b,c].filter(Boolean).join(",")); }
function stateHash(G){ return hashStr(JSON.stringify({s:G.ships,a:G.active,st:G.st,rng:G.rng,w:G.winner})); }

if(typeof module!=="undefined") module.exports={songOfWind,shipAllowed,FORBIDDEN,aiMove,aiPlan,aiSetup,isLegal,crewSlots,maxShots,defaultCrewMove,maxSpeed,FACTIONS,CREW_BY,kindred,rnd,S,navOption,arcInfo,arcHexes,energyCap,slotsAllowed,computeTerrain,R,DIR_NAMES,TERRAIN_NAMES,setPull,allNavOptions,newGame,apply,legal,actor,replay,plies,plyText,stateHash,terrain,setTerrainSeed,hexDist,CLASSES,CREW,isObstacle};
