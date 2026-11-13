// Browser tests (needs Playwright + Chromium).  Run:  node web/test/browser.e2e.js [screenshot-dir]
// 1. heading preview: choose, preview, confirm   2. online game by move codes, both screens in sync
// 3. wrong/old codes are refused                 4. phone width has no sideways scroll
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const URL = "file://" + path.resolve(__dirname, "../index.html");
const SHOTS = process.argv[2] || null;
const assert = require("assert");
const BOT=`window.botMove=function(){
  const ls=legal(G); const s=G.ships[actor(G)]; const o=G.ships.find(x=>x!==s);
  const has=x=>ls.find(m=>m===x||m.startsWith(x));
  if(G.st==='draft') return ls[Math.floor(Math.random()*ls.length)];
  if(G.st==='cmd') return ls.find(m=>m==='Q:'+['NAV','ATK','ENG'].find(p=>!G.queue.includes(p)));
  const ord=ls.filter(m=>m.startsWith('O:')); if(ord.length&&Math.random()<0.3) return ord[0];
  if(G.st==='nav_pick'){ const opts=allNavOptions(s); if(!opts.length) return has('PIVOT')||'END';
    let best=null,bv=1e9; for(const op of opts){ const v=Math.abs(hexDist(o.q-op.q,o.r-op.r)-2)*3+op.dc*0.6+Math.random()*2; if(v<bv){bv=v;best=op;} }
    return 'B:'+best.speed+':'+(best.side>0?'+':'')+best.side; }
  if(G.st==='nav_heading'){ let bi=0,bv=1e9; const D=[[0,-1],[1,-1],[1,0],[0,1],[-1,1],[-1,0]]; D.forEach((d,i)=>{ const v=hexDist(o.q-(s.q+d[0]*3),o.r-(s.r+d[1]*3)); if(v<bv){bv=v;bi=i;} }); return 'H:'+DIR_NAMES[bi]; }
  for(const x of ['DMG','DRIFT','TGT','LOCK','FIRE']){ const m=has(x); if(m) return m; }
  if(G.st==='atk_debuff') return ls[Math.floor(Math.random()*ls.length)];
  if(G.st==='eng'){ if(s.hp<s.maxHp*0.6&&ls.includes('REP')) return 'REP'; const p=ls.filter(m=>m[0]==='+'); if(p.length&&Math.random()<0.7) return p[Math.floor(Math.random()*p.length)]; return 'END'; }
  return has('END')||ls[0];
};`;
(async () => {
  const b = await chromium.launch(), errors = [];
  const mk = async (vp = { width: 1280, height: 900 }) => {
    const c = await b.newContext({ viewport: vp, reducedMotion: "reduce" }); const p = await c.newPage();
    p.on("pageerror", e => errors.push(String(e)));
    p.on("console", m => { if (m.type() === "error" && !/fonts|ERR_/.test(m.text())) errors.push(m.text()); });
    await p.goto(URL); await p.evaluate(BOT); return p; };
  const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + ".png") }); };

  // ---- 1. heading preview ----
  {
    const p = await mk();
    await p.click("#btn-local");
    for (let i = 0; i < 9; i++) await p.evaluate(async () => { await act(botMove()); });
    await p.click("#btn-begin");
    await p.evaluate(async () => { await act("Q:NAV"); await act("Q:ATK"); await act("Q:ENG"); });
    // drive into the heading step: retry boost/drift until a drift is stable
    for (let tries = 0; tries < 40; tries++) {
      const st = await p.evaluate(() => G.st);
      if (st === "nav_heading") break;
      if (st === "nav_pick") await p.evaluate(async () => { await act(legal(G).find(m => m.startsWith("B:"))); });
      else if (st === "nav_drift") await p.evaluate(async () => { await act("DRIFT"); });
      else if (st === "done") await p.evaluate(async () => { G.queue.splice(G.qi + 1, 0, "NAV"); await act("END"); }); // test-only: retry NAV
      else if (st === "over") break;
    }
    assert.strictEqual(await p.evaluate(() => G.st), "nav_heading", "reached heading step");
    const o0 = await p.evaluate(() => S(G).o);
    const pick = (o0 + 2) % 6, name = await p.evaluate(i => DIR_NAMES[i], pick);
    await p.click("#ui-heading-" + name);
    assert.strictEqual(await p.evaluate(() => S(G).o), o0, "preview does not change the ship yet");
    assert.strictEqual(await p.evaluate(() => UI.heading), pick, "preview selected");
    assert.ok((await p.textContent("#console")).includes("Confirm heading " + name), "confirm button names the heading");
    await shot(p, "heading-preview");
    // tap the map: hex straight "south-ish" of the ship sets the preview toward it
    await p.evaluate(() => { const s = S(G); onHexClick(s.q + DIRS[3][0] * 2, s.r + DIRS[3][1] * 2); });
    assert.strictEqual(await p.evaluate(() => UI.heading), 3, "map tap faces the tapped hex");
    await p.click("#m-H-S");
    assert.strictEqual(await p.evaluate(() => S(G).o), 3); assert.strictEqual(await p.evaluate(() => G.st), "done");
    assert.strictEqual(await p.evaluate(() => UI.heading), null, "preview cleared after confirm");
    console.log("ok   heading: choose, preview, map tap, confirm");
    await p.context().close();
  }

  // ---- 2. online game ----
  {
    const A = await mk(), B = await mk();
    await A.click("#btn-online");
    const playMine = async p => { for (let n = 0; n < 400; n++) {
      const st = await p.evaluate(() => ({ mine: myTurn(), over: G.st === "over" })); if (st.over || !st.mine) return;
      await p.evaluate(async () => { await act(botMove()); }); } };
    let cur = A, nxt = B, first = true, handoffs = 0;
    while (handoffs < (+process.env.HANDOFFS || 60)) {
      await playMine(cur);
      const text = await cur.evaluate(() => UI.shareText); assert.ok(text.includes("TETHYS"), "share text has a code");
      if (first) { await nxt.fill("#join-code", text); await nxt.click("#btn-join"); first = false; }
      else { await nxt.fill("#reply-code", text); await nxt.click("#btn-reply"); }
      await nxt.waitForFunction(() => !UI.busy && (myTurn() || G.st === "over"), null, { timeout: 60000 });
      assert.strictEqual(await cur.evaluate(() => stateHash(G)), await nxt.evaluate(() => stateHash(G)), "both screens agree after hand-off " + handoffs);
      handoffs++;
      if (handoffs === 10) await shot(nxt, "online-turn");
      if (await nxt.evaluate(() => G.st === "over")) break;
      [cur, nxt] = [nxt, cur];
    }
    assert.notStrictEqual(await A.evaluate(() => MODE.seat), await B.evaluate(() => MODE.seat), "players hold different seats");
    console.log(`ok   online: ${handoffs} hand-offs, screens identical after each`);

    // ---- 3. bad codes ----
    const msgs = await A.evaluate(async () => {
      const out = []; await importCode("hello"); out.push(UI.msg);
      await importCode(await encodeGame(G.seed, G.moves.slice(0, 5))); out.push(UI.msg);
      await importCode(await encodeGame(G.seed + 1, ["C:NOPE"])); out.push(UI.msg);
      return out; });
    assert.ok(/No move code/.test(msgs[0])); assert.ok(/older than your game/.test(msgs[1])); assert.ok(/illegal move/.test(msgs[2]));
    console.log("ok   codes: garbage, old and invalid codes are refused with a message");
  }

  // ---- 4. phone ----
  {
    const m = await mk({ width: 390, height: 844 });
    await m.click("#btn-local");
    for (let i = 0; i < 9; i++) await m.evaluate(async () => { await act(botMove()); });
    await m.click("#btn-begin");
    const w = await m.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(w <= 390, "no sideways scroll, width " + w);
    await shot(m, "phone");
    console.log("ok   phone: no sideways scroll");
  }

  assert.deepStrictEqual(errors, [], "no page errors");
  console.log("ok   no JavaScript errors");
  await b.close();
})().catch(e => { console.error("FAIL", e.message); process.exit(1); });
