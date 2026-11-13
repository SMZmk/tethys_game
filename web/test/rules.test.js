// Rules tests for web/logic.js.  Run:  node web/test/rules.test.js
"use strict";
const assert = require("assert");
const L = require("../logic.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok   " + name); }
  catch (e) { failed++; console.log("  FAIL " + name + "\n       " + (e.stack || e).toString().split("\n").slice(0, 3).join("\n       ")); }
}

// ---------- helpers ----------
// Make the next d<sides> roll satisfy pred, by choosing the RNG state.
function force(G, sides, pred) {
  for (let r = 1; r < 100000; r++) {
    const probe = { rng: r };
    if (pred(L.rnd(probe, sides))) { G.rng = r; return; }
  }
  throw new Error("could not force roll");
}
const forceVal = (G, sides, v) => force(G, sides, x => x === v);
// Drafted game: P1 Skiff + RHO/ORO/KAEL... with chosen crews.
function drafted({ c1 = "SKIFF", c2 = "SKIFF", f1 = "WIND", f2 = "WIND", crew1 = ["ACE", "GUNNER", "MECHANIC"], crew2, seed = 42 } = {}) {
  crew2 = crew2 || ["DRIFTER", "SPOTTER", "TECH", "QM"].slice(0, c2 === "HAULER" ? 4 : 3);
  if (c1 === "HAULER" && crew1.length < 4) crew1 = [...crew1, "QM"];
  const G = L.newGame(seed);
  L.apply(G, "C:" + c1 + ":" + f1); L.apply(G, "CREW:" + crew1.join(","));
  L.apply(G, "C:" + c2 + ":" + f2); L.apply(G, "CREW:" + crew2.join(","));
  return G;
}
// Put both ships in the open centre: P1 at (0,1) facing N, P2 at (0,-1) facing S (range 2, in each other's arc).
function face(G) {
  const [a, b] = G.ships;
  Object.assign(a, { q: 0, r: 1, o: 0 }); Object.assign(b, { q: 0, r: -1, o: 3 });
  return G;
}
const plan = (G, ...ph) => ph.forEach(p => L.apply(G, "Q:" + p));
const sh = (G, i) => G.ships[i];

console.log("Tethys rules");

// ---------- setup & draft ----------
test("draft: class pick sets hull, energy and parts", () => {
  const G = L.newGame(7);
  L.apply(G, "C:HAULER:HEART");
  const s = sh(G, 0), c = L.CLASSES.HAULER;
  assert.strictEqual(s.maxHp, c.hull); assert.strictEqual(s.hp, c.hull);
  assert.strictEqual(s.baseEnergy, c.energy); assert.strictEqual(s.parts, c.parts);
});
test("draft: each player picks ship and whole crew in one turn, P1 then P2", () => {
  const G = L.newGame(7);
  L.apply(G, "C:SKIFF:WIND"); assert.strictEqual(L.actor(G), 0);
  L.apply(G, "CREW:ACE,DRIFTER,SPOTTER"); assert.strictEqual(L.actor(G), 1);
  L.apply(G, "C:DREAD:HEART"); L.apply(G, "CREW:ACE,GUNNER,CAPTAIN");            // crew may overlap
  assert.strictEqual(G.st, "cmd"); assert.strictEqual(G.active, 0); assert.strictEqual(G.turn, 1);
  assert.deepStrictEqual(G.ships[1].crew.map(c => c.key), ["ACE", "GUNNER", "CAPTAIN"]);
});
test("draft: crew must fill every slot, no duplicates, known names", () => {
  const G = L.newGame(7); L.apply(G, "C:SKIFF:WIND");
  for (const bad of ["CREW:ACE,DRIFTER", "CREW:ACE,ACE,SPOTTER", "CREW:ACE,DRIFTER,NOBODY", "CREW:ACE,DRIFTER,SPOTTER,QM"])
    assert.throws(() => L.apply(G, bad), /Illegal/, bad);
});
test("hauler: room for 4 crew", () => {
  const G = L.newGame(7); L.apply(G, "C:HAULER:HEART");
  assert.throws(() => L.apply(G, "CREW:CAPTAIN,GUNNER,MEDIC"), /Illegal/);
  L.apply(G, "CREW:CAPTAIN,GUNNER,MEDIC,BULWARK"); assert.strictEqual(G.ships[0].crew.length, 4);
});
test("draft: Quartermaster brings one extra spare part", () => {
  const G = drafted({ crew1: ["QM", "ACE", "GUNNER"] });
  assert.strictEqual(sh(G, 0).parts, L.CLASSES.SKIFF.parts + 1);
});

// ---------- planning ----------
test("plan: three phases in chosen order, Undo removes the last", () => {
  const G = drafted();
  L.apply(G, "Q:ENG"); L.apply(G, "Q-"); assert.deepStrictEqual(G.queue, []);
  plan(G, "ATK", "NAV", "ENG");
  assert.deepStrictEqual(G.queue, ["ATK", "NAV", "ENG"]); assert.strictEqual(G.phase, "ATK");
});
test("plan: a phase cannot be picked twice", () => {
  const G = drafted(); L.apply(G, "Q:NAV");
  assert.throws(() => L.apply(G, "Q:NAV"), /Illegal/);
});

// ---------- navigation ----------
test("nav: boost success moves exactly to the chosen hex", () => {
  const G = face(drafted()); plan(G, "NAV", "ATK", "ENG");
  const s = sh(G, 0), opt = L.navOption(s, 1, -1);
  force(G, 20, v => v >= 19);
  L.apply(G, "B:1:-1");
  assert.deepStrictEqual([s.q, s.r], [opt.q, opt.r]); assert.strictEqual(G.st, "nav_drift");
});
test("nav: boost failure overshoots by 50%", () => {
  const G = face(drafted({ crew1: ["GUNNER", "MECHANIC", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  const s = sh(G, 0); s.q = 0; s.r = 2; G.ships[1].q = 5;           // clear the path
  const opt = L.navOption(s, 2, 0);
  forceVal(G, 20, 1);
  L.apply(G, "B:2:0");
  const want = [Math.round(0 + (opt.q - 0) * 1.5), Math.round(2 + (opt.r - 2) * 1.5)];
  assert.deepStrictEqual([s.q, s.r], want);
});
test("nav: stable drift lets you choose and confirm any heading", () => {
  const G = face(drafted()); plan(G, "NAV", "ATK", "ENG");
  force(G, 20, v => v >= 19); L.apply(G, "B:1:0");
  force(G, 20, v => v >= 19); L.apply(G, "DRIFT");
  assert.strictEqual(G.st, "nav_heading");
  assert.deepStrictEqual(L.legal(G).filter(m => m.startsWith("H:")).length, 6);
  L.apply(G, "H:SW");
  assert.strictEqual(sh(G, 0).o, 4); assert.strictEqual(G.st, "done"); assert.ok(sh(G, 0).f.drift);
});
test("nav: failed drift spins one step and blocks lock-on", () => {
  const G = face(drafted({ crew1: ["GUNNER", "MECHANIC", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  force(G, 20, v => v >= 19); L.apply(G, "B:1:0");
  forceVal(G, 20, 1); L.apply(G, "DRIFT");
  assert.ok([1, 5].includes(sh(G, 0).o)); assert.strictEqual(G.st, "done"); assert.ok(!sh(G, 0).f.drift);
  L.apply(G, "END"); L.apply(G, "TGT");
  assert.ok(!L.legal(G).includes("LOCK"));
});
test("nav: ramming the other ship costs both 3 hull", () => {
  const G = face(drafted()); plan(G, "NAV", "ATK", "ENG");
  const [a, b] = G.ships, opt = L.navOption(a, 1, 0);
  b.q = opt.q; b.r = opt.r;
  const ha = a.hp, hb = b.hp;
  force(G, 20, v => v >= 19); L.apply(G, "B:1:0");
  assert.strictEqual(a.hp, ha - L.R.CRASH_DMG); assert.strictEqual(b.hp, hb - L.R.CRASH_DMG); assert.strictEqual(L.R.CRASH_DMG, 3);
});
test("nav: pivot is offered only when rocks block every course", () => {
  const G = face(drafted()); plan(G, "NAV", "ATK", "ENG");
  assert.ok(!L.legal(G).some(m => m.startsWith("PIVOT")));
  // find a spot whose every course is blocked
  L.setTerrainSeed(G.seed);
  const s = sh(G, 0); let found = false;
  for (let q = -40; q <= 40 && !found; q++) for (let r = -40; r <= 40 && !found; r++) for (let o = 0; o < 6 && !found; o++) {
    if (L.isObstacle(q, r)) continue;
    Object.assign(s, { q, r, o });
    if (!L.allNavOptions(s).length) found = true;
  }
  assert.ok(found, "no boxed-in spot found");
  assert.ok(L.legal(G).includes("PIVOT:L")); const o = s.o;
  L.apply(G, "PIVOT:R"); assert.strictEqual(s.o, (o + 1) % 6); assert.strictEqual(G.st, "done");
});
test("nav: a wreck gives +1 spare part, only once", () => {
  const G = face(drafted({ c1: "DREAD" })); plan(G, "NAV", "ATK", "ENG");
  L.setTerrainSeed(G.seed);
  const s = sh(G, 0); let spot = null;
  for (let q = -9; q <= 9 && !spot; q++) for (let r = -9; r <= 9 && !spot; r++) if (L.terrain(q, r) === 4) spot = [q, r];
  assert.ok(spot, "no wreck on this map");
  // stand one hex south of it facing north, so speed 1 straight lands on it
  Object.assign(s, { q: spot[0], r: spot[1] + 1, o: 0 }); G.ships[1].q = 30;
  const parts = s.parts;
  force(G, 20, v => v >= 19); L.apply(G, "B:1:0");
  assert.deepStrictEqual([s.q, s.r], spot); assert.strictEqual(s.parts, parts + 1);
  assert.ok(G.looted.includes(spot.join(",")));
});

// ---------- combat ----------
function toAttack(opts) {
  const G = face(drafted(opts)); plan(G, "NAV", "ATK", "ENG");
  force(G, 20, v => v >= 19); L.apply(G, "B:1:0");      // to (0,0)
  force(G, 20, v => v >= 19); L.apply(G, "DRIFT"); L.apply(G, "H:N"); L.apply(G, "END");
  return G;
}
test("combat: target, lock, cripple weapons, hit for d6+4", () => {
  const G = toAttack(), t = sh(G, 1), hp = t.hp;
  L.apply(G, "TGT");
  force(G, 20, v => v >= 19); L.apply(G, "LOCK");
  assert.strictEqual(G.st, "atk_debuff");
  L.apply(G, "AIM:WEAPONS");
  force(G, 20, v => v >= 19); L.apply(G, "FIRE");
  assert.strictEqual(G.st, "atk_dmg");
  forceVal(G, 6, 3); L.apply(G, "DMG");
  assert.strictEqual(t.hp, hp - (3 + 4)); assert.strictEqual(t.dmg.WEAPONS, 1);
});
test("combat: a miss wastes the lock and the aimed critical", () => {
  const G = toAttack(), s = sh(G, 0);
  L.apply(G, "TGT"); force(G, 20, v => v >= 19); L.apply(G, "LOCK"); L.apply(G, "AIM:DRIFT");
  forceVal(G, 20, 1); L.apply(G, "FIRE");
  assert.ok(!s.f.locked); assert.strictEqual(s.f.debuff, null); assert.strictEqual(sh(G, 1).dmg.DRIFT, 0);
  assert.ok(!L.legal(G).includes("FIRE"));                    // one shot per phase
});
test("combat: no ammo, no shot; reload restores it", () => {
  const G = toAttack(), s = sh(G, 0); s.ammo = 0;
  L.apply(G, "TGT"); assert.ok(!L.legal(G).includes("FIRE"));
  L.apply(G, "RLD"); assert.strictEqual(s.ammo, 1); assert.ok(L.legal(G).includes("FIRE"));
});
test("combat: target outside the front arc cannot be acquired", () => {
  const G = toAttack(); Object.assign(sh(G, 1), { q: 0, r: 3 });   // behind P1
  assert.ok(!L.legal(G).includes("TGT"));
});
test("combat: stun hits a crew member until the end of their next turn", () => {
  const G = toAttack(), t = sh(G, 1);
  L.apply(G, "TGT"); force(G, 20, v => v >= 19); L.apply(G, "LOCK"); L.apply(G, "AIM:CREW");
  force(G, 20, v => v >= 19); L.apply(G, "FIRE"); L.apply(G, "DMG");
  assert.strictEqual(t.crew.filter(c => c.stun).length, 1);
  L.apply(G, "END"); L.apply(G, "END");                         // P1 ends ATK and ENG -> P2's turn
  assert.strictEqual(G.active, 1); assert.strictEqual(t.crew.filter(c => c.stun).length, 1);
  plan(G, "NAV", "ATK", "ENG"); L.apply(G, "END"); L.apply(G, "END"); L.apply(G, "END");
  assert.strictEqual(t.crew.filter(c => c.stun).length, 0);
});
test("combat: last hull point lost ends the game", () => {
  const G = toAttack(), t = sh(G, 1); t.hp = 2;
  L.apply(G, "TGT"); force(G, 20, v => v >= 19); L.apply(G, "FIRE"); L.apply(G, "DMG");
  assert.strictEqual(G.st, "over"); assert.strictEqual(G.winner, 1); assert.deepStrictEqual(L.legal(G), []);
});

// ---------- energy ----------
test("energy: cap drops to 1 under 40% hull and 0 under 20%", () => {
  const G = drafted(), s = sh(G, 0);
  s.hp = Math.floor(s.maxHp * 0.39); assert.strictEqual(L.energyCap(s), 1);
  s.hp = Math.floor(s.maxHp * 0.19); assert.strictEqual(L.energyCap(s), 0);
});
test("energy: allocation capped; engine max 2", () => {
  const G = face(drafted()); plan(G, "ENG", "NAV", "ATK");
  L.apply(G, "+ENG"); L.apply(G, "+ENG"); assert.ok(!L.legal(G).includes("+ENG"));
  L.apply(G, "+WPN"); assert.ok(!L.legal(G).includes("+BST"));    // 3/3 used
});

// ---------- crew orders ----------
test("crew: Battle Stations repeats the current phase", () => {
  const G = face(drafted({ crew1: ["CAPTAIN", "GUNNER", "TECH"] })); plan(G, "ATK", "NAV", "ENG");
  L.apply(G, "O:1"); assert.deepStrictEqual(G.queue, ["ATK", "ATK", "NAV", "ENG"]);
  assert.strictEqual(sh(G, 0).crew[0].rest, 3); assert.ok(!L.legal(G).includes("O:1"));
});
test("crew: Afterburn makes the next boost succeed without a roll", () => {
  const G = face(drafted({ crew1: ["ACE", "GUNNER", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  L.apply(G, "O:1"); forceVal(G, 20, 1); L.apply(G, "B:1:0");
  assert.ok(G.roll.auto); assert.deepStrictEqual([sh(G, 0).q, sh(G, 0).r], [0, 0]);
});
test("crew: Evasive gives enemy attacks −3", () => {
  const G = toAttack(), t = sh(G, 1); t.evasive = true;
  L.apply(G, "TGT"); forceVal(G, 20, 10); L.apply(G, "FIRE");
  assert.ok(G.roll.mods.some(m => m[0] === -3 && m[1] === "evasive"));
});
test("crew: Double Tap reloads and allows a second shot", () => {
  const G = toAttack();                                         // P1 has GUNNER in slot 2
  L.apply(G, "TGT"); forceVal(G, 20, 1); L.apply(G, "FIRE");
  assert.ok(!L.legal(G).includes("FIRE")); L.apply(G, "O:2"); assert.ok(L.legal(G).includes("FIRE"));
});
test("crew: Auto-Lock locks without a roll", () => {
  const G = toAttack({ crew1: ["SPOTTER", "GUNNER", "TECH"] }), rng = G.rng;
  L.apply(G, "TGT"); L.apply(G, "O:1");
  assert.strictEqual(G.st, "atk_debuff"); assert.strictEqual(G.rng, rng);
});
test("crew: Jam Comms limits the target to 2 phases next turn", () => {
  const G = toAttack({ crew1: ["JAMMER", "GUNNER", "TECH"] });
  L.apply(G, "TGT"); L.apply(G, "O:1"); L.apply(G, "END"); L.apply(G, "END");
  assert.strictEqual(G.active, 1); assert.strictEqual(L.slotsAllowed(G), 2);
  plan(G, "NAV", "ATK"); assert.strictEqual(G.phase, "NAV");
  L.apply(G, "END"); L.apply(G, "END"); assert.strictEqual(G.active, 0);
  assert.ok(!sh(G, 1).jammed);
});
test("crew: Field Fix repairs one point of every system damage", () => {
  const G = face(drafted()); const s = sh(G, 0); s.dmg = { SPEED: 2, BOOST: 1, DRIFT: 0, WEAPONS: 1 };
  plan(G, "ENG", "NAV", "ATK"); L.apply(G, "O:3");
  assert.deepStrictEqual(s.dmg, { SPEED: 1, BOOST: 0, DRIFT: 0, WEAPONS: 0 });
});
test("crew: Surge adds +5 to the next roll only", () => {
  const G = face(drafted({ crew1: ["TECH", "GUNNER", "MECHANIC"] })); plan(G, "ENG", "NAV", "ATK");
  L.apply(G, "O:1"); L.apply(G, "END");
  force(G, 20, v => v >= 19); L.apply(G, "B:1:0");
  assert.ok(G.roll.mods.some(m => m[0] === 5)); assert.strictEqual(sh(G, 0).surge, 0);
});
test("crew: Salvage adds 2 spare parts; orders sit out 2 turns", () => {
  const G = face(drafted({ crew1: ["QM", "GUNNER", "MECHANIC"] })); const s = sh(G, 0), p = s.parts;
  plan(G, "ENG", "NAV", "ATK"); L.apply(G, "O:1"); assert.strictEqual(s.parts, p + 2);
  ["END", "END", "END"].forEach(m => L.apply(G, m));             // end P1 turn
  plan(G, "NAV", "ATK", "ENG"); ["END", "END", "END"].forEach(m => L.apply(G, m));
  assert.strictEqual(s.crew[0].rest, 2);                         // sits out this turn and the next
  assert.ok(!L.legal(G).includes("O:1"));
});
test("crew: orders only in their station's phase", () => {
  const G = face(drafted({ crew1: ["QM", "GUNNER", "MECHANIC"] })); plan(G, "NAV", "ATK", "ENG");
  assert.ok(!L.legal(G).includes("O:1"));                        // QM is ENG
});


// ---------- factions ----------
test("faction: kindred crew add +1 hull each", () => {
  const G = drafted({ f1: "WIND", crew1: ["ACE", "DRIFTER", "MECHANIC"] });
  assert.strictEqual(L.kindred(sh(G, 0)), 2);
  assert.strictEqual(sh(G, 0).maxHp, L.CLASSES.SKIFF.hull + 2); assert.strictEqual(sh(G, 0).hp, sh(G, 0).maxHp);
});
test("faction: every crew member and ship belongs to a faction", () => {
  assert.strictEqual(L.CREW.length, 15);
  for (const c of L.CREW) assert.ok(L.FACTIONS[c.f], c.key);
  for (const f in L.FACTIONS) assert.strictEqual(L.CREW.filter(c => c.f === f).length, 5, f);
  assert.strictEqual(L.CREW.filter(c => /Captain/.test(c.role)).length, 3);
});
test("faction: Drifters get +1 to boost and drift", () => {
  const G = face(drafted({ f1: "WIND", crew1: ["GUNNER", "MECHANIC", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  forceVal(G, 20, 10); L.apply(G, "B:1:0");
  assert.ok(G.roll.mods.some(m => m[1] === "Drifters" && m[0] === 1));
});
test("faction: Scrappers deal +1 damage", () => {
  const G = toAttack({ f1: "MACHINE", crew1: ["GUNNER", "ACE", "TECH"] }), t = sh(G, 1), hp = t.hp;
  L.apply(G, "TGT"); force(G, 20, v => v >= 19); L.apply(G, "FIRE"); forceVal(G, 6, 2); L.apply(G, "DMG");
  assert.strictEqual(t.hp, hp - (2 + 4 + 1));
});
test("faction: Nomad orders rest only 1 turn", () => {
  const G = face(drafted({ f1: "HEART", crew1: ["QM", "GUNNER", "TECH"] })); plan(G, "ENG", "NAV", "ATK");
  L.apply(G, "O:1"); assert.strictEqual(sh(G, 0).crew[0].rest, 2);
  ["END", "END", "END"].forEach(m => L.apply(G, m)); plan(G, "NAV", "ATK", "ENG"); ["END", "END", "END"].forEach(m => L.apply(G, m));
  assert.strictEqual(sh(G, 0).crew[0].rest, 1);                  // sits out exactly one turn
  plan(G, "NAV", "ATK", "ENG"); ["END", "END", "END"].forEach(m => L.apply(G, m)); plan(G, "NAV", "ATK", "ENG"); ["END", "END", "END"].forEach(m => L.apply(G, m));
  assert.strictEqual(sh(G, 0).crew[0].rest, 0);
});
test("faction: the story speaks in the ship's voice", () => {
  const G = toAttack({ f1: "MACHINE" });
  L.apply(G, "TGT"); force(G, 20, v => v >= 19); L.apply(G, "FIRE"); L.apply(G, "DMG");
  assert.ok(/Scrap-iron arrows|rivet guns/.test(G.story.join(" ")), G.story[0]);
});

// ---------- new crew ----------
test("crew: VOSS +1 attack; Scrap Fury adds +4 to the next hit", () => {
  const G = toAttack({ crew1: ["IRONCAPT", "GUNNER", "TECH"] }), t = sh(G, 1), hp = t.hp;
  L.apply(G, "TGT"); L.apply(G, "O:1");
  forceVal(G, 20, 15); L.apply(G, "FIRE"); assert.ok(G.roll.mods.some(m => m[1] === "VOSS"));
  forceVal(G, 6, 2); L.apply(G, "DMG"); assert.strictEqual(t.hp, hp - (2 + 4 + 4));
});
test("crew: GRIT +1 damage; Chain Shot cripples a random system", () => {
  const G = toAttack({ crew1: ["HARPOON", "GUNNER", "TECH"] }), t = sh(G, 1), hp = t.hp;
  L.apply(G, "TGT"); L.apply(G, "O:1"); force(G, 20, v => v >= 19); L.apply(G, "FIRE");
  forceVal(G, 6, 2); L.apply(G, "DMG");
  assert.strictEqual(t.hp, hp - (2 + 4 + 1));
  assert.strictEqual(Object.values(t.dmg).reduce((a, b) => a + b, 0), 1);
});
test("crew: DOV −1 to enemy attacks; Brace −3 damage taken", () => {
  const G = toAttack({ crew2: ["BULWARK", "SPOTTER", "QM"] }), t = sh(G, 1), hp = t.hp; t.brace = true;
  L.apply(G, "TGT"); force(G, 20, v => v >= 19); L.apply(G, "FIRE");
  assert.ok(G.roll.mods.some(m => m[1] === "DOV" && m[0] === -1));
  forceVal(G, 6, 4); L.apply(G, "DMG"); assert.strictEqual(t.hp, hp - (4 + 4 - 3));
});
test("crew: FENN softens crashes; Sandstorm −2 to all enemy rolls next turn", () => {
  const G = face(drafted({ crew1: ["ECO", "GUNNER", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  L.apply(G, "O:1"); assert.ok(sh(G, 1).storm);
  ["END", "END", "END"].forEach(m => L.apply(G, m));
  plan(G, "NAV", "ATK", "ENG"); forceVal(G, 20, 10); L.apply(G, L.legal(G).find(m => m.startsWith("B:")));
  assert.ok(G.roll.mods.some(m => m[1] === "sandstorm" && m[0] === -2));
});
test("crew: ANA Patch Up heals 3; stunned crew recover at turn start", () => {
  const G = face(drafted({ crew1: ["MEDIC", "GUNNER", "TECH"] })); const s = sh(G, 0); s.hp -= 10;
  plan(G, "ENG", "NAV", "ATK"); const hp = s.hp; L.apply(G, "O:1"); assert.strictEqual(s.hp, hp + 3);
  ["END", "END", "END"].forEach(m => L.apply(G, m));
  s.crew[1].stun = true;                                        // stunned during P2's turn
  plan(G, "NAV", "ATK", "ENG"); ["END", "END", "END"].forEach(m => L.apply(G, m));
  assert.ok(!s.crew[1].stun);
});
test("crew: SELA Tailwind lowers boost DC by 4; failed drift still sets heading", () => {
  const G = face(drafted({ crew1: ["WINDCAPT", "GUNNER", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  const dc = L.navOption(sh(G, 0), 1, 0).dc; L.apply(G, "O:1");
  assert.strictEqual(L.navOption(sh(G, 0), 1, 0).dc, dc - 4);
  force(G, 20, v => v >= 19); L.apply(G, "B:1:0"); forceVal(G, 20, 1); L.apply(G, "DRIFT");
  assert.strictEqual(G.st, "nav_heading"); assert.ok(!sh(G, 0).f.drift);
});

// ---------- dreadnought ----------
test("dreadnought: twin guns fire twice, each hit half damage (+1 before halving)", () => {
  const G = toAttack({ c1: "DREAD", crew1: ["SPOTTER", "ACE", "TECH"] }), t = sh(G, 1), s = sh(G, 0);
  assert.strictEqual(s.ammo, 2); assert.strictEqual(L.maxShots(s), 2);
  L.apply(G, "TGT"); const hp = t.hp;
  force(G, 20, v => v >= 19); L.apply(G, "FIRE"); forceVal(G, 6, 5); L.apply(G, "DMG");
  assert.strictEqual(t.hp, hp - Math.ceil((5 + 4 + 1) / 2));
  assert.ok(L.legal(G).includes("FIRE"));
  force(G, 20, v => v >= 19); L.apply(G, "FIRE"); forceVal(G, 6, 5); L.apply(G, "DMG");
  assert.strictEqual(t.hp, hp - 10); assert.ok(!L.legal(G).includes("FIRE"));
});
test("dreadnought: reload gives 2 ammo", () => {
  const G = face(drafted({ c1: "DREAD" })); const s = sh(G, 0); s.ammo = 0;
  plan(G, "ATK", "NAV", "ENG"); L.apply(G, "RLD"); assert.strictEqual(s.ammo, 2);
});

// ---------- computer opponent ----------
test("computer: plays whole games with legal moves only", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const G = L.newGame(seed * 101);
    for (let n = 0; n < 30000 && G.st !== "over" && G.turn < 200; n++) L.apply(G, L.aiMove(G));
    assert.strictEqual(G.st, "over", "seed " + seed);
    assert.strictEqual(L.stateHash(L.replay(G.seed, G.moves)), L.stateHash(G));
  }
});
test("computer: setup follows the d6 rule card", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const G = L.newGame(seed), su = L.aiSetup(G), [f, c] = su.rolls;
    assert.strictEqual(su.fac, f <= 2 ? "MACHINE" : f <= 4 ? "HEART" : "WIND");
    const own = { MACHINE: "DREAD", HEART: "HAULER", WIND: "SKIFF" }[su.fac];
    assert.strictEqual(su.cls, ["SKIFF", "HAULER", "DREAD", "RELIC", own, own][c - 1]);
  }
});
test("computer: engages on 2+ when healthy, on 4+ when hurt; style 4+ is risky", () => {
  const G = face(drafted());
  for (let t = 0; t < 30; t++) {
    G.turn = t; const s = sh(G, 0);
    s.hp = s.maxHp; let p = L.aiPlan(G); assert.strictEqual(p.engage, p.intent >= 2); assert.strictEqual(p.risky, p.style >= 4);
    s.hp = 1; p = L.aiPlan(G); assert.strictEqual(p.engage, p.intent >= 4);
  }
});

// ---------- skiff ----------
test("skiff: less hull, but speed 4, repairs +2 and double salvage", () => {
  assert.ok(L.CLASSES.SKIFF.hull < L.CLASSES.HAULER.hull);
  const G = face(drafted({ c1: "SKIFF", c2: "HAULER", crew1: ["GUNNER", "ACE", "TECH"] }));
  assert.strictEqual(L.maxSpeed(sh(G, 0)), 4); assert.strictEqual(L.maxSpeed(sh(G, 1)), 3);
  plan(G, "ENG", "NAV", "ATK"); const s = sh(G, 0); s.hp = 4;
  forceVal(G, 4, 1); L.apply(G, "REP"); assert.strictEqual(s.hp, 4 + 1 + 2);       // d4 + Skiff 2
});
test("skiff: an old-world wreck gives the Skiff 2 parts", () => {
  const G = face(drafted({ c1: "SKIFF" })); plan(G, "NAV", "ATK", "ENG");
  L.setTerrainSeed(G.seed); const s = sh(G, 0); let spot = null;
  for (let q = -9; q <= 9 && !spot; q++) for (let r = -9; r <= 9 && !spot; r++) if (L.terrain(q, r) === 4) spot = [q, r];
  Object.assign(s, { q: spot[0], r: spot[1] + 1, o: 0 }); G.ships[1].q = 30;
  const parts = s.parts; force(G, 20, v => v >= 19); L.apply(G, "B:1:0");
  assert.strictEqual(s.parts, parts + 2);
});

// ---------- fight length ----------
test("fight length: every ship goes down to 2-3 average hits", () => {
  const avgHit = 3.5 + L.R.DMG_BONUS, maxHit = 6 + L.R.DMG_BONUS + 1;   // d6 + 4 (+1 Dreadnought)
  for (const [k, c] of Object.entries(L.CLASSES)) {
    const toughest = c.hull + 3;                                          // three kindred crew
    assert.ok(toughest / avgHit <= 3, `${k}: ${toughest} hull needs ${(toughest / avgHit).toFixed(1)} average hits`);
    assert.ok(c.hull > maxHit, `${k}: one max hit (${maxHit}) must not kill a fresh ship`);
  }
});

// ---------- terrain ----------
test("terrain: centre and spawn hexes are always open", () => {
  for (let seed = 1; seed < 40; seed++) {
    L.setTerrainSeed(seed);
    for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (L.hexDist(q, r) <= 2) assert.ok(!L.isObstacle(q, r));
    for (const [q, r] of [[0, 5], [0, -5]]) assert.ok(!L.isObstacle(q, r));
  }
});
test("terrain: rock gets denser further from the centre", () => {
  L.setTerrainSeed(99);
  const dens = (a, b) => { let n = 0, k = 0; for (let q = -b; q <= b; q++) for (let r = -b; r <= b; r++) { const d = L.hexDist(q, r); if (d >= a && d <= b) { k++; if (L.isObstacle(q, r)) n++; } } return n / k; };
  const inner = dens(3, 8), outer = dens(18, 24);
  assert.ok(outer > inner * 1.8, `inner ${inner.toFixed(2)} outer ${outer.toFixed(2)}`);
});

// ---------- determinism & notation ----------
test("replay: seed + move list reproduces whole games exactly", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const G = L.newGame(seed); let x = seed;
    const rand = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let n = 0; n < 3000 && G.st !== "over"; n++) { const ls = L.legal(G); L.apply(G, ls[Math.floor(rand() * ls.length)]); }
    assert.strictEqual(L.stateHash(L.replay(seed, G.moves)), L.stateHash(G), "seed " + seed);
  }
});
test("notation: plies group consecutive moves by the same player", () => {
  const G = drafted(); plan(G, "NAV", "ATK", "ENG");
  const ps = L.plies(G.seed, G.moves);
  assert.deepStrictEqual(ps.map(p => p.who), [0, 1, 0]);             // P1 ship+crew, P2 ship+crew, P1 plan
  assert.strictEqual(L.plyText(ps[2]), "Q:NAV,ATK,ENG");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
