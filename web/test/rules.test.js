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
// A new game where Player 1 has already chosen the setup (map, mode, storm).
// set = "MAP:MODE:WEATHER": Player 1 picks map and mode now; Player 2's weather is applied by drafted().
function fresh(seed, set = "WASTE:DUEL:CALM") { const [m, md, wx] = set.split(":"); const G = L.newGame(seed); L.apply(G, `SET:${m}:${md}`); G._wx = wx || "CALM"; return G; }
// Make the next d<sides> roll satisfy pred, by choosing the RNG state.
function force(G, sides, pred) {
  for (let r = 1; r < 100000; r++) {
    const probe = { rng: r };
    if (pred(L.rnd(probe, sides))) { G.rng = r; return; }
  }
  throw new Error("could not force roll");
}
const forceVal = (G, sides, v) => force(G, sides, x => x === v);
// Force a sequence of rolls, e.g. [[20,1],[6,3]] = natural 1, then a 3 on the mishap d6.
function forceSeq(G, seq) {
  for (let r = 1; r < 2000000; r++) { const p = { rng: r }; if (seq.every(([s, v]) => L.rnd(p, s) === v)) { G.rng = r; return; } }
  throw new Error("could not force sequence");
}
// Drafted game: P1 Skiff + RHO/ORO/KAEL... with chosen crews.
function drafted({ c1 = "SKIFF", c2 = "SKIFF", f1 = "WIND", f2 = "WIND", crew1 = ["ACE", "GUNNER", "MECHANIC"], crew2, seed = 42, set = "WASTE:DUEL:CALM" } = {}) {
  crew2 = crew2 || ["DRIFTER", "SPOTTER", "TECH", "QM"].slice(0, c2 === "HAULER" ? 4 : 3);
  if (c1 === "HAULER" && crew1.length < 4) crew1 = [...crew1, "QM"];
  const G = fresh(seed, set);
  L.apply(G, "C:" + c1 + ":" + f1); L.apply(G, "CREW:" + crew1.join(","));
  L.apply(G, "WX:" + G._wx); L.apply(G, "C:" + c2 + ":" + f2); L.apply(G, "CREW:" + crew2.join(","));
  return G;
}
// Put both ships in the open centre: P1 at (0,1) facing N, P2 at (0,-1) facing S (range 2, in each other's arc).
function face(G) {
  const [a, b] = G.ships;
  Object.assign(a, { q: 0, r: 1, o: 0 }); Object.assign(b, { q: 0, r: -1, o: 3 });
  return G;
}
const plan = (G, ...ph) => ph.forEach(p => L.apply(G, "Q:" + p));
// From the start of a NAV phase: boost straight ahead and hold the drift (forced dice).
function stableDrift(G, heading = "N") { force(G, 20, v => v >= 19); L.apply(G, "B:1:0"); force(G, 20, v => v >= 19); L.apply(G, "DRIFT"); L.apply(G, "H:" + heading); }
const sh = (G, i) => G.ships[i];

console.log("Tethys rules");

// ---------- setup & draft ----------
test("draft: class pick sets hull, energy and parts", () => {
  const G = fresh(7);
  L.apply(G, "C:HAULER:HEART");
  const s = sh(G, 0), c = L.CLASSES.HAULER;
  assert.strictEqual(s.maxHp, c.hull); assert.strictEqual(s.hp, c.hull);
  assert.strictEqual(s.baseEnergy, c.energy); assert.strictEqual(s.parts, c.parts);
});
test("draft: each player picks ship and whole crew in one turn, P1 then P2", () => {
  const G = fresh(7);
  L.apply(G, "C:SKIFF:WIND"); assert.strictEqual(L.actor(G), 0);
  L.apply(G, "CREW:ACE,DRIFTER,SPOTTER"); assert.strictEqual(L.actor(G), 1);
  L.apply(G, "WX:CALM"); L.apply(G, "C:DREAD:HEART"); L.apply(G, "CREW:ACE,GUNNER,CAPTAIN");            // crew may overlap
  assert.strictEqual(G.st, "cmd"); assert.strictEqual(G.active, 0); assert.strictEqual(G.turn, 1);
  assert.deepStrictEqual(G.ships[1].crew.map(c => c.key), ["ACE", "GUNNER", "CAPTAIN"]);
});
test("draft: crew must fill every slot, no duplicates, known names", () => {
  const G = fresh(7); L.apply(G, "C:SKIFF:WIND");
  for (const bad of ["CREW:ACE,DRIFTER", "CREW:ACE,ACE,SPOTTER", "CREW:ACE,DRIFTER,NOBODY", "CREW:ACE,DRIFTER,SPOTTER,QM"])
    assert.throws(() => L.apply(G, bad), /Illegal/, bad);
});
test("draft: only one captain per crew", () => {
  const G = fresh(7); L.apply(G, "C:SKIFF:WIND");
  assert.throws(() => L.apply(G, "CREW:WINDCAPT,CAPTAIN,ACE"), /Illegal/);
  L.apply(G, "CREW:WINDCAPT,ACE,DRIFTER");
});
test("hauler: room for 4 crew", () => {
  const G = fresh(7); L.apply(G, "C:HAULER:HEART");
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
  forceVal(G, 20, 2);
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
  forceVal(G, 20, 2); L.apply(G, "DRIFT");
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
// find a spot (P1 at q,r,o; P2 far away) where `want(option, line)` holds for some course
const hexRoundOk = (s, o, w) => { const f = 1.5, x = s.q + (o.q - s.q) * f, y = s.r + (o.r - s.r) * f; return Number.isInteger(x) && Number.isInteger(y); };
function findCourse(G, want) {
  const s = sh(G, 0); Object.assign(G.ships[1], { q: 30, r: -30 });
  for (let q = -14; q <= 14; q++) for (let r = -14; r <= 14; r++) for (let o = 0; o < 6; o++) {
    if (L.terrain(q, r) !== 0) continue; Object.assign(s, { q, r, o });
    for (const op of L.allNavOptions(s)) if (want(op, L.hexLine(q, r, op.q, op.r))) return op;
  }
  return null;
}
test("rock: scree can be flown over without damage", () => {
  const G = drafted(); plan(G, "NAV", "ATK", "ENG"); const s = sh(G, 0);
  const op = findCourse(G, (o, line) => L.terrain(o.q, o.r) === 0 && line.some(([q, r]) => L.isScree(q, r)));
  assert.ok(op); const hp = s.hp;
  force(G, 20, v => v >= 19); L.apply(G, `B:${op.speed}:${op.side > 0 ? "+" : ""}${op.side}`);
  assert.deepStrictEqual([s.q, s.r], [op.q, op.r]); assert.strictEqual(s.hp, hp);
});
test("rock: ending a move on scree deals 2 damage (FENN: 1)", () => {
  for (const [crew, dmg] of [[["GUNNER", "MECHANIC", "TECH"], 2], [["ECO", "MECHANIC", "TECH"], 1]]) {
    const G = drafted({ f1: "HEART", crew1: crew }); plan(G, "NAV", "ATK", "ENG"); const s = sh(G, 0);
    const op = findCourse(G, o => L.isScree(o.q, o.r)); assert.ok(op); const hp = s.hp;
    force(G, 20, v => v >= 19); L.apply(G, `B:${op.speed}:${op.side > 0 ? "+" : ""}${op.side}`);
    assert.deepStrictEqual([s.q, s.r], [op.q, op.r]); assert.strictEqual(s.hp, hp - dmg); assert.strictEqual(L.R.SCREE_DMG, 2);
  }
});
test("rock: ending a move on dunes deals 1 damage; dunes run in stripes on every map", () => {
  const G = drafted(); plan(G, "NAV", "ATK", "ENG"); const s = sh(G, 0);
  const op = findCourse(G, o => L.isDune(o.q, o.r)); assert.ok(op); const hp = s.hp;
  force(G, 20, v => v >= 19); L.apply(G, `B:${op.speed}:${op.side > 0 ? "+" : ""}${op.side}`);
  assert.strictEqual(s.hp, hp - 1);
  for (const map of ["WASTE", "LABYRINTH"]) { L.setTerrain(977, map); let n = 0, k = 0;
    for (let q = -12; q <= 12; q++) for (let r = -12; r <= 12; r++) if (L.hexDist(q, r) <= 12) { k++; if (L.isDune(q, r)) n++; }
    assert.ok(n / k > 0.04 && n / k < 0.15, `${map}: dunes ${(n / k).toFixed(2)}`); }
  L.setTerrain(1, "WASTE");
});
test("rock: no shooting through rock; scree and dunes don't block", () => {
  const G = face(drafted()); const [a, b] = G.ships; let blocked = 0, open = 0;
  for (let q = -10; q <= 10; q++) for (let r = -10; r <= 10; r++) for (let o = 0; o < 6; o++) {
    if (L.terrain(q, r) !== 0) continue; const D = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]][o];
    const tq = q + D[0] * 2, tr = r + D[1] * 2, mq = q + D[0], mr = r + D[1];        // target 2 straight ahead
    if (L.isObstacle(tq, tr)) continue; Object.assign(a, { q, r, o }); Object.assign(b, { q: tq, r: tr });
    if (L.isObstacle(mq, mr)) { assert.strictEqual(L.arcInfo(a, b), null, `rock at ${mq},${mr}`); blocked++; }
    else { assert.ok(L.arcInfo(a, b)); if (L.terrain(mq, mr) !== 0) open++; }
  }
  assert.ok(blocked > 5 && open > 5, `blocked ${blocked}, over scree/dunes ${open}`);
  // the combat menu follows: no TGT while rock is in the way
  face(G); plan(G, "ATK", "NAV", "ENG"); assert.ok(L.legal(G).includes("TGT"));
});
test("rock: rock blocks courses; a failed boost bounces back off it (3 damage)", () => {
  const G = drafted(); plan(G, "NAV", "ATK", "ENG"); const s = sh(G, 0);
  // a course that is clear, but whose 50% overshoot runs into black rock
  const op = findCourse(G, (o, line) => { const w = [Math.round(s.q + (o.q - s.q) * 1.5), Math.round(s.r + (o.r - s.r) * 1.5)];
    const l2 = L.hexLine(s.q, s.r, w[0], w[1]), i = l2.findIndex(([q, r]) => L.isObstacle(q, r));
    return i > 0 && hexRoundOk(s, o, w) && !l2.slice(0, i).some(([q, r]) => L.terrain(q, r) >= 2); });
  assert.ok(op); const hp = s.hp, w = [Math.round(s.q + (op.q - s.q) * 1.5), Math.round(s.r + (op.r - s.r) * 1.5)];
  const l2 = L.hexLine(s.q, s.r, w[0], w[1]), stop = l2[l2.findIndex(([q, r]) => L.isObstacle(q, r)) - 1];
  forceVal(G, 20, 2); L.apply(G, `B:${op.speed}:${op.side > 0 ? "+" : ""}${op.side}`);
  assert.deepStrictEqual([s.q, s.r], stop); assert.strictEqual(s.hp, hp - 3);
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
  const G = face(drafted({ c1: "DREAD", f1: "HEART" })); plan(G, "NAV", "ATK", "ENG");
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
test("crew: KAEL's Double Tap is epic (needs a stable drift); passive +1 attack", () => {
  const G = toAttack({ f1: "HEART", crew1: ["GUNNER", "MECHANIC", "TECH"] }), s = sh(G, 0);   // drifted
  L.apply(G, "TGT"); forceVal(G, 20, 2); L.apply(G, "FIRE"); assert.strictEqual(s.ammo, 0);
  assert.ok(L.legal(G).includes("O:1")); L.apply(G, "O:1"); assert.ok(L.legal(G).includes("FIRE"));
  assert.strictEqual(L.CREW_BY.GUNNER.epic, "DRIFT"); assert.strictEqual(L.CREW_BY.GUNNER.passive, "+1 attack rolls");
  const H = face(drafted({ f1: "HEART", crew1: ["GUNNER", "MECHANIC", "TECH"] })); plan(H, "ATK", "NAV", "ENG");  // no drift yet
  L.apply(H, "TGT"); forceVal(H, 20, 2); L.apply(H, "FIRE"); assert.ok(!L.legal(H).includes("O:1"));
});
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
  forceVal(G, 20, 2); L.apply(G, "FIRE");
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
test("crew: Battle Stations (Nomad epic) needs a stable drift, then repeats the phase", () => {
  const G = face(drafted({ f1: "HEART", crew1: ["CAPTAIN", "GUNNER", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  assert.ok(!L.legal(G).includes("O:1"));                                    // no drift yet
  stableDrift(G); L.apply(G, "O:1"); assert.deepStrictEqual(G.queue, ["NAV", "NAV", "ATK", "ENG"]);
  assert.strictEqual(sh(G, 0).crew[0].rest, 3); assert.ok(!L.legal(G).includes("O:1"));
});
test("crew: Afterburn makes the next boost succeed without a roll", () => {
  const G = face(drafted({ crew1: ["ACE", "GUNNER", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  L.apply(G, "O:1"); forceVal(G, 20, 2); L.apply(G, "B:1:0");
  assert.ok(G.roll.auto); assert.deepStrictEqual([sh(G, 0).q, sh(G, 0).r], [0, 0]);
});
test("crew: Evasive gives enemy attacks −3", () => {
  const G = toAttack(), t = sh(G, 1); t.evasive = true;
  L.apply(G, "TGT"); forceVal(G, 20, 10); L.apply(G, "FIRE");
  assert.ok(G.roll.mods.some(m => m[0] === -3 && m[1] === "evasive"));
});
test("crew: Double Tap reloads and allows a second shot", () => {
  const G = toAttack();                                         // P1 has GUNNER in slot 2
  L.apply(G, "TGT"); forceVal(G, 20, 2); L.apply(G, "FIRE");
  assert.ok(!L.legal(G).includes("FIRE")); L.apply(G, "O:2"); assert.ok(L.legal(G).includes("FIRE"));
});
test("crew: Auto-Lock locks without a roll", () => {
  const G = toAttack({ crew1: ["SPOTTER", "GUNNER", "TECH"] }), rng = G.rng;
  L.apply(G, "TGT"); L.apply(G, "O:1");
  assert.strictEqual(G.st, "atk_debuff"); assert.strictEqual(G.rng, rng);
});
test("crew: Jam Weapons gives the enemy −2 to lock and attack on their next turn", () => {
  const G = toAttack({ crew1: ["JAMMER", "GUNNER", "TECH"] }); const t = sh(G, 1);
  L.apply(G, "TGT"); L.apply(G, "O:1"); assert.ok(t.jamW);
  L.apply(G, "END"); L.apply(G, "END");
  assert.strictEqual(G.active, 1); assert.strictEqual(L.slotsAllowed(G), 3);                // phases untouched
  plan(G, "ATK", "NAV", "ENG"); L.apply(G, "TGT"); forceVal(G, 20, 10); L.apply(G, "FIRE");
  assert.ok(G.roll.mods.some(m => m[1] === "jammed" && m[0] === -2));
  L.apply(G, "END"); L.apply(G, "END"); L.apply(G, "END"); assert.ok(!t.jamW);
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
  const G = face(drafted({ f1: "MACHINE", crew1: ["QM", "GUNNER", "MECHANIC"] })); const s = sh(G, 0), p = s.parts;
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
  assert.strictEqual(L.CREW.length, 18);
  for (const c of L.CREW) assert.ok(L.FACTIONS[c.f], c.key);
  for (const f in L.FACTIONS) assert.strictEqual(L.CREW.filter(c => c.f === f).length, 6, f);
  for (const f in L.FACTIONS) assert.strictEqual(L.CREW.filter(c => c.f === f && c.capt).length, 2, f + " captains");
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
test("faction: Drifter orders rest only 1 turn", () => {
  const G = face(drafted({ f1: "WIND", crew1: ["QM", "GUNNER", "TECH"] })); plan(G, "ENG", "NAV", "ATK");
  L.apply(G, "O:1"); assert.strictEqual(sh(G, 0).crew[0].rest, 2);
  ["END", "END", "END"].forEach(m => L.apply(G, m)); plan(G, "NAV", "ATK", "ENG"); ["END", "END", "END"].forEach(m => L.apply(G, m));
  assert.strictEqual(sh(G, 0).crew[0].rest, 1);
  plan(G, "NAV", "ATK", "ENG"); ["END", "END", "END"].forEach(m => L.apply(G, m)); plan(G, "NAV", "ATK", "ENG"); ["END", "END", "END"].forEach(m => L.apply(G, m));
  assert.strictEqual(sh(G, 0).crew[0].rest, 0);
});
test("faction: Nomads get +1 to all rolls after a stable drift", () => {
  const G = face(drafted({ f1: "HEART", crew1: ["GUNNER", "ACE", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  stableDrift(G); L.apply(G, "END"); L.apply(G, "TGT"); forceVal(G, 20, 10); L.apply(G, "FIRE");
  assert.ok(G.roll.mods.some(m => m[1] === "Nomads" && m[0] === 1));
});
test("faction: Scrappers won't sail the Construct, Drifters won't sail the Dreadnought", () => {
  const G = fresh(3);
  assert.ok(!L.legal(G).includes("C:RELIC:MACHINE")); assert.ok(!L.legal(G).includes("C:DREAD:WIND")); assert.ok(L.legal(G).includes("C:HAULER:WIND"));
  assert.ok(L.legal(G).includes("C:RELIC:HEART")); assert.ok(L.legal(G).includes("C:HAULER:HEART"));
  assert.throws(() => L.apply(G, "C:RELIC:MACHINE"), /Illegal/);
});
test("faction: the story speaks in the ship's voice", () => {
  const G = toAttack({ f1: "MACHINE" });
  L.apply(G, "TGT"); force(G, 20, v => v >= 19); L.apply(G, "FIRE"); L.apply(G, "DMG");
  assert.ok(/Scrap-iron arrows|rivet guns/.test(G.story.join(" ")), G.story[0]);
});

// ---------- new crew ----------
test("crew: VOSS Knock Them Down! (Scrapper epic) stuns an enemy crew member after a hit, no lock", () => {
  const G = toAttack({ f1: "MACHINE", crew1: ["IRONCAPT", "GUNNER", "TECH"] }), t = sh(G, 1);
  L.apply(G, "TGT"); assert.ok(!L.legal(G).includes("O:1"));                  // no hit yet
  force(G, 20, v => v >= 19); L.apply(G, "FIRE"); assert.ok(G.roll.mods.some(m => m[1] === "VOSS"));
  L.apply(G, "DMG"); assert.ok(!sh(G, 0).f.locked); assert.ok(L.legal(G).includes("O:1"));
  L.apply(G, "O:1"); assert.strictEqual(t.crew.filter(c => c.stun).length, 1);
});
test("crew: GRIT Chain Shot (Scrapper epic) after a hit, no lock: d6 1-4 cripples a system", () => {
  const G = toAttack({ f1: "MACHINE", crew1: ["HARPOON", "GUNNER", "TECH"] }), t = sh(G, 1), hp = t.hp;
  L.apply(G, "TGT"); assert.ok(!L.legal(G).includes("O:1"));
  force(G, 20, v => v >= 19); L.apply(G, "FIRE"); forceVal(G, 6, 2); L.apply(G, "DMG");
  assert.strictEqual(t.hp, hp - (2 + 4 + 1 + 1));                              // + GRIT + Scrappers
  forceVal(G, 6, 4); L.apply(G, "O:1"); assert.strictEqual(t.dmg.WEAPONS, 1);
});
test("crew: GRIT Chain Shot d6 5-6: fire in the engines, enemy loses NAV or ENG", () => {
  const G = toAttack({ f1: "MACHINE", crew1: ["HARPOON", "GUNNER", "TECH"] }), t = sh(G, 1);
  L.apply(G, "TGT"); force(G, 20, v => v >= 19); L.apply(G, "FIRE"); L.apply(G, "DMG");
  // first d6 must be 5-6, second decides NAV (1-3) or ENG (4-6)
  for (let r = 1; r < 100000; r++) { const p = { rng: r }; if (L.rnd(p, 6) >= 5 && L.rnd(p, 6) <= 3) { G.rng = r; break; } }
  L.apply(G, "O:1"); assert.strictEqual(t.lostPhase, "NAV");
  L.apply(G, "END"); L.apply(G, "END");
  assert.strictEqual(L.slotsAllowed(G), 2); assert.ok(!L.legal(G).includes("Q:NAV"));
});
test("crew: DOV −1 to enemy attacks; Brace −3 damage taken", () => {
  const G = toAttack({ crew2: ["BULWARK", "SPOTTER", "QM"] }), t = sh(G, 1), hp = t.hp; t.brace = true;
  L.apply(G, "TGT"); force(G, 20, v => v >= 19); L.apply(G, "FIRE");
  assert.ok(G.roll.mods.some(m => m[1] === "DOV" && m[0] === -1));
  forceVal(G, 6, 4); L.apply(G, "DMG"); assert.strictEqual(t.hp, hp - (4 + 4 - 3));
});
test("crew: FENN Sandstorm (Nomad epic) needs a stable drift; enemy −2 to all rolls next turn", () => {
  const G = face(drafted({ f1: "HEART", crew1: ["ECO", "GUNNER", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  assert.ok(!L.legal(G).includes("O:1")); stableDrift(G);
  L.apply(G, "O:1"); assert.ok(sh(G, 1).storm);
  ["END", "END", "END"].forEach(m => L.apply(G, m));
  plan(G, "NAV", "ATK", "ENG"); forceVal(G, 20, 10); L.apply(G, L.legal(G).find(m => m.startsWith("B:")));
  assert.ok(G.roll.mods.some(m => m[1] === "sandstorm" && m[0] === -2));
});
test("crew: ANA Patch Up (Nomad epic) heals 3 after a stable drift; stunned crew recover", () => {
  const G = face(drafted({ f1: "HEART", crew1: ["MEDIC", "GUNNER", "TECH"] })); const s = sh(G, 0); s.hp -= 10;
  plan(G, "NAV", "ENG", "ATK"); stableDrift(G); L.apply(G, "END");
  const hp = s.hp; L.apply(G, "O:1"); assert.strictEqual(s.hp, hp + 3);
  L.apply(G, "END"); L.apply(G, "END");
  s.crew[1].stun = true;
  plan(G, "NAV", "ATK", "ENG"); ["END", "END", "END"].forEach(m => L.apply(G, m));
  assert.ok(!s.crew[1].stun);
});
test("crew: SELA keeps the helm: a failed drift still lets you set the heading (no lock)", () => {
  const G = face(drafted({ crew1: ["WINDCAPT", "GUNNER", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  force(G, 20, v => v >= 19); L.apply(G, "B:1:0"); forceVal(G, 20, 2); L.apply(G, "DRIFT");
  assert.strictEqual(G.st, "nav_heading"); assert.ok(!sh(G, 0).f.drift);
});
test("crew: SELA Tailwind lowers boost DC by 4", () => {
  const G = face(drafted({ crew1: ["WINDCAPT", "GUNNER", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  const dc = L.navOption(sh(G, 0), 1, 0).dc; L.apply(G, "O:1");
  assert.strictEqual(L.navOption(sh(G, 0), 1, 0).dc, dc - 4);
});
test("crew: SELA Song of the Wind (passive epic) below half hull: engine adds no DC, +2 boost", () => {
  const G = face(drafted({ crew1: ["WINDCAPT", "GUNNER", "TECH"] })); const s = sh(G, 0);
  s.sys.eng = 2; const hard = L.navOption(s, 1, 0).dc;
  s.hp = Math.floor(s.maxHp / 2) - 1; assert.ok(L.songOfWind(s));
  const easy = L.navOption(s, 1, 0).dc; assert.ok(easy < hard, `${easy} < ${hard}`);
  assert.strictEqual(easy, 8 + 1 + 2 * 2);                                    // DC base + distance, no engine multiplier
  plan(G, "NAV", "ATK", "ENG"); forceVal(G, 20, 10); L.apply(G, "B:1:0");
  assert.ok(G.roll.mods.some(m => m[1] === "Song of the Wind" && m[0] === 2));
});
test("dreadnought: one shot rolls to hit twice, each hit half damage (+1 before halving)", () => {
  const G = toAttack({ c1: "DREAD", f1: "HEART", crew1: ["SPOTTER", "ACE", "TECH"] }), t = sh(G, 1), s = sh(G, 0);
  assert.strictEqual(s.ammo, 1);
  L.apply(G, "TGT"); const hp = t.hp;
  force(G, 20, v => v >= 19); L.apply(G, "FIRE");
  assert.strictEqual(s.ammo, 0); assert.ok(!L.legal(G).includes("FIRE"));          // one shot per phase
  const hits = G.hits; assert.ok(hits >= 1 && hits <= 2);
  L.apply(G, "DMG"); const dealt = hp - t.hp;
  assert.ok(dealt >= hits * Math.ceil((1 + 4 + 1) / 2) && dealt <= hits * Math.ceil((6 + 4 + 1) / 2), "dealt " + dealt);
});
test("dreadnought: two attack rolls make a clean miss rarer", () => {
  let missOne = 0, missTwin = 0;
  for (let seed = 1; seed <= 300; seed++) {
    for (const c of ["SKIFF", "DREAD"]) {
      const G = toAttack({ c1: c, f1: "HEART", seed }); G.rng = (seed * 2654435761) >>> 0;   // fresh dice per game
      L.apply(G, "TGT"); L.apply(G, "FIRE");
      if (G.st !== "atk_dmg") { if (c === "DREAD") missTwin++; else missOne++; }
    }
  }
  assert.ok(missTwin < missOne * 0.7, `twin misses ${missTwin} vs single ${missOne}`);
});
test("computer: plays whole games with legal moves only", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const G = L.newGame(seed * 101);
    for (let n = 0; n < 30000 && G.st !== "over" && G.turn < 200; n++) L.apply(G, L.aiMove(G));
    assert.strictEqual(G.st, "over", "seed " + seed);
    assert.strictEqual(L.stateHash(L.replay(G.seed, G.moves)), L.stateHash(G));
  }
});
test("computer: setup follows the d6 rule card", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const G = L.newGame(seed), su = L.aiSetup(G), [f, c] = su.rolls;
    assert.strictEqual(su.fac, f <= 2 ? "MACHINE" : f <= 4 ? "HEART" : "WIND");
    const own = { MACHINE: "DREAD", HEART: "HAULER", WIND: "SKIFF" }[su.fac];
    let want = ["SKIFF", "HAULER", "DREAD", "RELIC", own, own][c - 1];
    if (!L.shipAllowed(want, su.fac)) want = own;
    assert.strictEqual(su.cls, want);
  }
});
test("computer: when boxed in it keeps turning the same way (no left-right flip-flop)", () => {
  const G = face(drafted()); plan(G, "NAV", "ATK", "ENG"); L.setTerrain(G.seed, "WASTE");
  const s = sh(G, 0); let found = false;
  for (let q = -40; q <= 40 && !found; q++) for (let r = -40; r <= 40 && !found; r++) for (let o = 0; o < 6 && !found; o++) {
    if (L.isObstacle(q, r)) continue; Object.assign(s, { q, r, o }); if (!L.allNavOptions(s).length) found = true; }
  assert.ok(found);
  let first = L.aiMove(G); while (first.startsWith("O:")) { L.apply(G, first); G.st = "nav_pick"; first = L.aiMove(G); }
  assert.ok(first.startsWith("PIVOT"), first); L.apply(G, first);
  s.o = (s.o + (first === "PIVOT:L" ? 1 : -1) + 6) % 6; G.st = "nav_pick";     // back where it was, still boxed in
  assert.strictEqual(L.aiMove(G), first);
});
test("computer: after a drift it does not face straight into rock", () => {
  const G = face(drafted()); const s = sh(G, 0); let checked = 0;
  for (let seed = 1; seed <= 20; seed++) { L.setTerrain(seed * 31, "CANYON");
    for (let q = -6; q <= 6; q++) for (let r = -12; r <= 12; r++) {
      if (L.isObstacle(q, r)) continue; Object.assign(s, { q, r }); G.st = "nav_heading";
      const d = ["N", "NE", "SE", "S", "SW", "NW"].indexOf(L.aiMove(G).slice(2)), D = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]][d];
      const anyOpen = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]].some(([a, b]) => !L.isObstacle(q + a, r + b) && !L.isObstacle(q + 2 * a, r + 2 * b));
      if (anyOpen) { assert.ok(!L.isObstacle(q + D[0], r + D[1]), `faces rock at ${q},${r}`); checked++; }
    } }
  L.setTerrain(1, "WASTE"); assert.ok(checked > 100);
});
test("computer: IVO's Surge only with a NAV or ATK phase still to come", () => {
  const G = face(drafted({ f1: "MACHINE", c1: "DREAD", crew1: ["TECH", "MECHANIC", "QM"] })); const s = sh(G, 0);
  plan(G, "NAV", "ATK", "ENG"); L.apply(G, "END"); L.apply(G, "END");          // skip NAV and ATK: ENG is last
  assert.strictEqual(G.phase, "ENG"); assert.ok(L.legal(G).includes("O:1")); assert.notStrictEqual(L.aiMove(G), "O:1");
  const H = face(drafted({ f1: "MACHINE", c1: "DREAD", crew1: ["TECH", "MECHANIC", "QM"] }));
  plan(H, "ENG", "NAV", "ATK"); assert.strictEqual(L.aiMove(H), "O:1");
});
test("computer: KESTREL's Ram! only with a course onto the enemy, and then it rams", () => {
  const G = face(drafted({ crew1: ["STORMCAPT", "MECHANIC", "TECH"] })); const [s, o] = G.ships; plan(G, "NAV", "ATK", "ENG");
  Object.assign(o, { q: 6, r: -6 }); assert.ok(L.legal(G).includes("O:1")); assert.ok(!L.aiMove(G).startsWith("O:"));
  const op = L.allNavOptions(s)[0]; Object.assign(o, { q: op.q, r: op.r });
  assert.strictEqual(L.aiMove(G), "O:1"); L.apply(G, "O:1");
  const m = L.aiMove(G); assert.ok(m.startsWith("B:")); const hp = o.hp; force(G, 20, v => v >= 19); L.apply(G, m);
  assert.strictEqual(o.hp, hp - 6);
});
test("computer: TASSA's All Hands only when a resting crew member could act", () => {
  const G = face(drafted({ f1: "HEART", crew1: ["ELDER", "MECHANIC", "QM"] })); const s = sh(G, 0);
  plan(G, "NAV", "ATK", "ENG"); s.f.drift = true;
  assert.ok(L.legal(G).includes("O:1")); assert.notStrictEqual(L.aiMove(G), "O:1");     // nobody resting
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
  const G = face(drafted({ c1: "SKIFF", c2: "HAULER", f2: "HEART", crew1: ["GUNNER", "ACE", "TECH"] }));
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
// ---------- ship handling ----------
test("ships: the Hauler flies 2 hexes further on straights, turns at most 2 steps (+1 DC each), −1 AC", () => {
  const G = face(drafted({ c1: "HAULER", f1: "HEART" })); const s = sh(G, 0), k = { ...s, cls: "SKIFF" };
  const h1 = L.navOption(s, 1, 0), k1 = L.navOption({ ...s, cls: "DREAD" }, 1, 0);
  assert.strictEqual(L.hexDist(h1.q - s.q, h1.r - s.r), 3); assert.strictEqual(L.hexDist(k1.q - s.q, k1.r - s.r), 1);
  assert.strictEqual(h1.dc, k1.dc);                                                  // the extra 2 hexes are free
  assert.ok(!L.allNavOptions(s).some(o => Math.abs(o.side) > 2));
  const h2 = L.navOption(s, 3, 2), d2 = L.navOption({ ...s, cls: "DREAD" }, 3, 2);
  assert.ok(h2 && d2); assert.strictEqual(h2.dc, d2.dc + 2);
  assert.strictEqual(L.CLASSES.HAULER.ac, -1); assert.strictEqual(L.CLASSES.HAULER.hull, 22);
});
test("ships: the Construct hovers: wide turns cost no DC, it may slide sideways and turn up to 4 steps", () => {
  const G = face(drafted({ c1: "RELIC", f1: "HEART" })); const s = sh(G, 0), d = { ...s, cls: "DREAD" };
  const c = L.navOption(s, 1, 1), n = L.navOption(d, 1, 1);
  assert.ok(c && n); assert.strictEqual(c.dc, n.dc - 1);                              // 60° turn over 1 hex: no extra DC
  assert.ok(L.navOption(s, 1, 2) && !L.navOption(d, 1, 2));                           // 120° slide over 1 hex
  assert.ok(L.allNavOptions(s).some(o => Math.abs(o.side) === 4) && !L.allNavOptions(d).some(o => Math.abs(o.side) === 4));
});
test("ships: firing arcs: Construct all round at range 1-2, Dreadnought broadsides, others front ±3", () => {
  const G = face(drafted()); const s = sh(G, 0);                                     // facing N
  const behind2 = [0, 2], side3 = [3, -1];                                             // straight behind at range 2; abeam at range 3
  for (const [cls, b2, s3] of [["SKIFF", false, false], ["RELIC", true, false], ["DREAD", false, true], ["HAULER", false, false]]) {
    const x = { ...s, cls };
    assert.strictEqual(L.inArc(x, ...behind2), b2, `${cls} behind at range 2`);
    assert.strictEqual(L.inArc(x, ...side3), s3, `${cls} abeam at range 3`);
  }
  assert.ok(L.arcHexes({ ...s, cls: "DREAD" }).length > L.arcHexes(s).length);
});
test("fight length: every ship goes down to 2-3 average hits (the Hauler, a tank, to 4)", () => {
  const avgHit = 3.5 + L.R.DMG_BONUS, maxHit = 6 + L.R.DMG_BONUS + 1;   // d6 + 4 (+1 Dreadnought)
  for (const [k, c] of Object.entries(L.CLASSES)) {
    const toughest = c.hull + (c.crew || 3), most = k === "HAULER" ? 4 : 3;   // all crew kindred
    assert.ok(toughest / avgHit <= most, `${k}: ${toughest} hull needs ${(toughest / avgHit).toFixed(1)} average hits`);
    assert.ok(c.hull > maxHit, `${k}: one max hit (${maxHit}) must not kill a fresh ship`);
  }
});


// ---------- setup ----------
test("setup: Player 1 picks map and mode, Player 2 picks the weather", () => {
  const G = L.newGame(11);
  assert.ok(L.legal(G).every(m => /^SET:\w+:(DUEL|RELIC)$/.test(m)));
  L.apply(G, "SET:CANYON:RELIC"); assert.strictEqual(G.cfg.storm, null);
  L.apply(G, "C:SKIFF:WIND"); L.apply(G, "CREW:SELA,ACE,DRIFTER".replace("SELA", "WINDCAPT"));
  assert.strictEqual(L.actor(G), 1); assert.deepStrictEqual(L.legal(G), ["WX:CALM", "WX:STORM"]);
  assert.throws(() => L.apply(G, "C:DREAD:HEART"), /Illegal/);                   // weather first
  L.apply(G, "WX:STORM"); assert.strictEqual(G.cfg.storm, true);
  assert.ok(L.legal(G).some(m => m.startsWith("C:")));
});
test("setup: the computer as Player 2 picks the weather by d6 (5-6 storm)", () => {
  let storms = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const G = L.newGame(seed); L.apply(G, "SET:WASTE:DUEL"); L.apply(G, "C:SKIFF:WIND"); L.apply(G, "CREW:WINDCAPT,ACE,DRIFTER");
    const m = L.aiMove(G); assert.ok(m === "WX:CALM" || m === "WX:STORM"); if (m === "WX:STORM") storms++;
  }
  assert.ok(storms > 5 && storms < 35, "storms " + storms);
});

// ---------- critical rolls ----------
test("crit: a natural 20 gives +3 to the next roll this turn", () => {
  const G = face(drafted()); plan(G, "NAV", "ATK", "ENG");
  forceVal(G, 20, 20); L.apply(G, "B:1:0"); assert.strictEqual(sh(G, 0).momentum, 3);
  forceVal(G, 20, 10); L.apply(G, "DRIFT");
  assert.ok(G.roll.mods.some(m => m[1] === "natural 20" && m[0] === 3)); assert.strictEqual(sh(G, 0).momentum, 0);
});
test("crit: a natural 1 always fails, even with big bonuses", () => {
  const G = face(drafted()); const s = sh(G, 0); s.surge = 30; plan(G, "NAV", "ATK", "ENG");
  forceSeq(G, [[20, 1], [6, 6], [20, 1]]); L.apply(G, "B:1:0");                  // 1, lucky second chance, 1 again
  assert.ok(!G.roll.ok);
});
test("crit: natural 1 on a boost overshoots 2x; mishap 3-4 stalls the engine", () => {
  const G = face(drafted({ crew1: ["GUNNER", "MECHANIC", "TECH"] })); const s = sh(G, 0);
  Object.assign(s, { q: 0, r: 2 }); G.ships[1].q = 5; s.sys.eng = 2;
  plan(G, "NAV", "ATK", "ENG"); const opt = L.navOption(s, 1, 0);
  forceSeq(G, [[20, 1], [6, 3]]); L.apply(G, "B:1:0");
  assert.strictEqual(s.sys.eng, 1);
  const want = [Math.round(0 + opt.q * 2), Math.round(2 + (opt.r - 2) * 2)], line = L.hexLine(0, 2, want[0], want[1]);
  const free = line.findIndex(([q, r]) => L.isObstacle(q, r)); const stop = free < 0 ? want : (free === 0 ? [0, 2] : line[free - 1]);
  assert.deepStrictEqual([s.q, s.r], stop);
});
test("crit: mishap 1-2 turns the stern to the enemy", () => {
  const G = toAttack(); L.apply(G, "TGT"); const s = sh(G, 0);
  forceSeq(G, [[20, 1], [6, 1]]); L.apply(G, "FIRE");
  assert.strictEqual(s.o, 3);                                            // enemy is north, so the stern faces it
});
test("crit: mishap 5 is 1 damage, a crew member down and a lost part", () => {
  const G = toAttack(); L.apply(G, "TGT"); const s = sh(G, 0), hp = s.hp, parts = s.parts;
  forceSeq(G, [[20, 1], [6, 5]]); L.apply(G, "FIRE");
  assert.strictEqual(s.hp, hp - 1); assert.strictEqual(s.parts, parts - 1); assert.strictEqual(s.crew.filter(c => c.stun).length, 1);
});
test("crit: mishap 6 is a lucky second chance", () => {
  const G = toAttack(); L.apply(G, "TGT");
  forceSeq(G, [[20, 1], [6, 6], [20, 19]]); L.apply(G, "FIRE");
  assert.strictEqual(G.st, "atk_dmg");
});
test("crit: KESTREL rerolls a natural 1", () => {
  const G = toAttack({ crew1: ["STORMCAPT", "GUNNER", "TECH"] }); L.apply(G, "TGT");
  forceSeq(G, [[20, 1], [20, 19]]); L.apply(G, "FIRE");
  assert.strictEqual(G.st, "atk_dmg");
});

// ---------- captains ----------
test("captains: only your own faction's captain, and only one", () => {
  const G = fresh(7); L.apply(G, "C:SKIFF:WIND");
  assert.throws(() => L.apply(G, "CREW:CAPTAIN,ACE,DRIFTER"), /Illegal/);     // Nomad captain on a Drifter ship
  assert.throws(() => L.apply(G, "CREW:WINDCAPT,STORMCAPT,ACE"), /Illegal/);  // two captains
  L.apply(G, "CREW:STORMCAPT,ACE,DRIFTER");
});
test("captains: HESK forges a permanent upgrade after a hit (1 part, each stat once)", () => {
  const G = toAttack({ c1: "DREAD", f1: "MACHINE", crew1: ["FORGE", "GUNNER", "TECH"] }); const s = sh(G, 0);
  assert.strictEqual(s.parts, L.CLASSES.DREAD.parts + 1);                    // HESK brings a part
  L.apply(G, "TGT"); force(G, 20, v => v >= 19); L.apply(G, "FIRE"); L.apply(G, "DMG"); L.apply(G, "END");
  assert.ok(L.legal(G).includes("O:1:WPN")); const parts = s.parts;
  L.apply(G, "O:1:WPN"); assert.strictEqual(s.upg.wpn, 1); assert.strictEqual(s.parts, parts - 1);
  assert.ok(!L.legal(G).some(m => m.startsWith("O:1")));                     // resting now
});
test("captains: TASSA keeps the crew standing while her drift holds; All Hands ignores rest once", () => {
  const G = face(drafted({ f1: "HEART", crew1: ["ELDER", "GUNNER", "MEDIC"] })); const s = sh(G, 0);
  plan(G, "NAV", "ATK", "ENG"); stableDrift(G);
  s.crew[1].rest = 2;                                                       // KAEL resting
  L.apply(G, "O:1"); assert.ok(s.allHands);
  L.apply(G, "END"); L.apply(G, "TGT"); assert.ok(L.legal(G).includes("O:2"));  // KAEL despite rest
  L.apply(G, "O:2"); assert.ok(!s.allHands);
  L.apply(G, "END"); L.apply(G, "END");                                     // enemy turn: try to stun
  plan(G, "ATK", "NAV", "ENG"); L.apply(G, "TGT"); L.apply(G, "O:2");        // P2's NYX: auto-lock
  L.apply(G, "AIM:CREW"); force(G, 20, v => v >= 19); L.apply(G, "FIRE"); L.apply(G, "DMG");
  assert.strictEqual(s.crew.filter(c => c.stun).length, 0);
});
test("captains: KESTREL rams: enemy takes 6, she takes 1", () => {
  const G = face(drafted({ crew1: ["STORMCAPT", "GUNNER", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  const [a, b] = G.ships, opt = L.navOption(a, 1, 0); b.q = opt.q; b.r = opt.r;
  const ha = a.hp, hb = b.hp; L.apply(G, "O:1");
  force(G, 20, v => v >= 3 && v <= 19); L.apply(G, "B:1:0");
  assert.strictEqual(b.hp, hb - 6); assert.strictEqual(a.hp, ha - 1);
});

// ---------- path rule ----------
test("path: courses through rock are not offered", () => {
  const G = face(drafted()); const s = sh(G, 0);
  for (const o of L.allNavOptions(s)) assert.ok(L.pathClear(s.q, s.r, o.q, o.r));
  L.setTerrain(G.seed, "LABYRINTH");
  let checked = 0;
  for (let q = -10; q <= 10; q++) for (let r = -10; r <= 10; r++) {
    if (L.isObstacle(q, r)) continue; Object.assign(s, { q, r, o: (q + r + 60) % 6 });
    for (const o of L.allNavOptions(s)) { assert.ok(L.pathClear(q, r, o.q, o.r)); checked++; }
  }
  L.setTerrain(G.seed, "WASTE"); assert.ok(checked > 100);
});

// ---------- maps ----------
test("maps: every map keeps starts, centre and exits connected", () => {
  const D = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]];
  for (const map of Object.keys(L.MAPS)) for (let seed = 1; seed <= 15; seed++) {
    L.setTerrain(seed * 977, map);
    const seen = new Set(["0,5"]), queue = [[0, 5]];
    while (queue.length) { const [a, b] = queue.shift(); for (const [dq, dr] of D) { const k = (a + dq) + "," + (b + dr);
      if (!seen.has(k) && L.hexDist(a + dq, b + dr) <= 18 && !L.isObstacle(a + dq, b + dr)) { seen.add(k); queue.push([a + dq, b + dr]); } } }
    for (const k of ["0,0", "0,-5", "0,12", "0,-12"]) assert.ok(seen.has(k), `${map} seed ${seed}: ${k}`);
  }
  L.setTerrain(1, "WASTE");
});
test("maps: the labyrinth is Swiss cheese: caves of several sizes, tunnels 1 and 3 hexes wide", () => {
  for (const seed of [977, 4242, 31337]) {
    L.setTerrain(seed, "LABYRINTH"); let narrow = 0, wide = 0;
    for (let q = -13; q <= 13; q++) for (let r = -13; r <= 13; r++) {
      if (L.hexDist(q, r) > 13 || L.isObstacle(q, r)) continue;
      // a 1-wide spot: rock on both sides along some axis
      const D = [[0, -1], [1, -1], [1, 0]], free = D.filter(([a, b]) => !L.isObstacle(q + a, r + b) && !L.isObstacle(q - a, r - b)).length;
      if (free === 1 && D.some(([a, b]) => L.isObstacle(q + a, r + b) && L.isObstacle(q - a, r - b))) narrow++;
      if (D.every(([a, b]) => !L.isObstacle(q + a, r + b) && !L.isObstacle(q - a, r - b))) wide++;
    }
    assert.ok(narrow >= 8 && wide >= 30, `seed ${seed}: narrow ${narrow}, wide ${wide}`);
  }
  L.setTerrain(1, "WASTE");
});
test("maps: the canyon is narrow, the labyrinth in between", () => {
  const open = map => { L.setTerrain(4242, map); let o = 0, n = 0; for (let q = -12; q <= 12; q++) for (let r = -12; r <= 12; r++) if (L.hexDist(q, r) <= 12) { n++; if (!L.isObstacle(q, r)) o++; } return o / n; };
  const w = open("WASTE"), c = open("CANYON"), l = open("LABYRINTH"); L.setTerrain(1, "WASTE");
  assert.ok(c < 0.4 && l < w && l > c, `waste ${w.toFixed(2)} canyon ${c.toFixed(2)} labyrinth ${l.toFixed(2)}`);
});

// ---------- Relic Race ----------
test("relic: pick it up at the centre (−1 engine), bring it to your own exit to win", () => {
  const G = face(drafted({ set: "WASTE:RELIC:CALM" })); const s = sh(G, 0);
  assert.deepStrictEqual([G.relic.q, G.relic.r], [0, 0]); assert.strictEqual(G.exits, null);
  plan(G, "NAV", "ATK", "ENG"); force(G, 20, v => v >= 3 && v <= 19); L.apply(G, "B:1:0");   // (0,1) -> (0,0)
  assert.strictEqual(G.relic.carrier, 1); assert.ok(s.relic); assert.ok(G.exits);
  s.sys.eng = 1; assert.strictEqual(require("../logic.js").navOption(s, 1, 0).dc, 8 + 1);    // engine 1 - relic 1 = no bonus
  // teleport next to the exit and fly in
  Object.assign(s, { q: 0, r: 11, o: 3 }); s.sys.eng = 0; G.st = "nav_pick";
  force(G, 20, v => v >= 3 && v <= 19); L.apply(G, "B:1:0");
  assert.strictEqual(G.st, "over"); assert.strictEqual(G.winner, 1);
});

// ---------- storms ----------
test("storm: wind turns one step clockwise every two rounds", () => {
  const G = face(drafted({ set: "WASTE:DUEL:STORM" })), w0 = G.windStart, seen = [];
  for (let i = 0; i < 8; i++) { seen.push(L.windNow(G)); L.apply(G, "Q:NAV"); L.apply(G, "Q:ATK"); L.apply(G, "Q:ENG"); ["END", "END", "END"].forEach(m => L.apply(G, m)); }
  assert.deepStrictEqual(seen, [0, 0, 0, 0, 1, 1, 1, 1].map(k => (w0 + k) % 6));  // turns 1..8 = rounds 1..4
});
test("storm: into the wind DC +2, with the wind DC −1 plus drag; Hauler turns are harder", () => {
  const G = face(drafted({ set: "WASTE:DUEL:STORM" })); const s = sh(G, 0);
  s.windFrom = 0;                                                            // wind from the north, ship faces north
  const calm = Object.assign({}, s, { windFrom: null });
  assert.strictEqual(L.navOption(s, 1, 0).dc, L.navOption(calm, 1, 0).dc + 2);
  s.o = 3; calm.o = 3; assert.strictEqual(L.navOption(s, 1, 0).dc, L.navOption(calm, 1, 0).dc - 1);
  const h = Object.assign({}, s, { cls: "HAULER", o: 1 }), hc = Object.assign({}, h, { windFrom: null });
  assert.strictEqual(L.navOption(h, 1, 1).dc, L.navOption(hc, 1, 1).dc + 1);
});
test("storm: shots without a lock get −2", () => {
  const G = toAttack(); G.cfg.storm = true; G.windStart = 0;               // storm rises once the ships are in position
  L.apply(G, "TGT"); forceVal(G, 20, 10); L.apply(G, "FIRE");
  assert.ok(G.roll.mods.some(m => m[1] === "storm" && m[0] === -2));
});

// ---------- skiff ----------
test("skiff: small target (+1 AC), easy to fly (+2 drift), easy to patch (3 parts)", () => {
  const c = L.CLASSES.SKIFF; assert.strictEqual(c.ac, 1); assert.strictEqual(c.dft, 2); assert.strictEqual(c.parts, 3);
  const G = face(drafted({ c1: "DREAD", f1: "HEART", c2: "SKIFF", crew1: ["SPOTTER", "ACE", "TECH"] })); plan(G, "NAV", "ATK", "ENG");
  stableDrift(G); L.apply(G, "END"); L.apply(G, "TGT"); forceVal(G, 20, 10); L.apply(G, "FIRE");
  assert.ok(/AC 11/.test(G.roll.vs), G.roll.vs);                             // AC 10 + range 1 (+0) + small (+1)
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
    const G = fresh(seed); let x = seed;
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
