# Tethys: Desert Drifter

A turn-based tactical duel of drift-ships on the dune sea of Tethys: d20 hex combat, crews with orders,
three factions, 16-bit pixel art. Best with two players.

**Play in your browser:** https://smzmk.github.io/tethys_game/

No install. Works on desktop and phone. You can play:
- **against the computer**,
- **two players on one device** (hot seat),
- **online with a friend** by sending move codes, like correspondence chess.

The browser game lives in `web/`. The original Pygame version is still in `TETHYS.1.1/` (see the end of this file).

---

## Your first game

1. **Battlefield.** Player 1 picks the map (Wastelands, Canyon, Labyrinth) and the mode (Duel or Relic Race).
   Player 2 picks the weather (calm or storm).
2. **Ship and faction.** Each player picks a hull and a faction: Scrappers, Nomads or Drifters.
3. **Crew.** Pick 3 crew members (the Hauler takes 4), at most one captain, and only a captain of your own faction.
   Every crew member of your own faction adds +1 hull.
4. **Fight.** Players take turns until one ship is lost (or, in the Relic Race, the relic leaves the map).

Setup picks can be undone: on one device any time during setup; online or against the computer until your turn is done.

## How a turn works

At the start of your turn you **plan the order of three phases**: NAV, ATK and ENG (for example ATK first to shoot
before you move). Then you play them in that order.

**NAV: move.**
- **Boost:** pick a course on the map (speed and turn). Roll d20 against its DC. Faster, sharper turns and more
  engine power mean a higher DC. On a failed roll you overshoot by 50%.
- **Drift:** after a boost, hold the drift with a second roll. A stable drift lets you choose a new heading and lock
  on this turn. A failed drift spins you one step.
- Courses can't cross rock. When rock blocks every course you may pivot in place.

**ATK: shoot.**
- You can target a ship in your **front arc, range 1–3**, with no rock in between.
- **Lock on** (needs a stable drift this turn): d20 vs DC 8. A lock gives +4 to hit and cripples a system of your
  choice (−1 to its rolls) or stuns a crew member if the shot hits.
- **Fire:** d20 vs armour class 10 (range 2: 12, range 3: 14). Damage is d6 + 4 + weapon power.
- One shot per turn, then reload (the ATK phase allows a reload).

**ENG: power and repair.**
- Spend your energy (3; Hauler 2, Construct 5) on ENGINE (longer courses, max 2), BOOST, DRIFT or WEAPONS (max 3 each).
- Spend a spare part to repair d4 hull.
- Below 40% hull your energy drops to 1; below 20% it drops to 0 and all your rolls get −1.

**Crew orders.** Each crew member has a passive (always on) and one order, usable in their station's phase.
After an order they rest for 2 of your turns (Drifters: 1). Usable orders appear as buttons under the map.
Some orders are **epic**: Scrappers' epics need a hit this turn, Nomads' a stable drift.

**Dice.** A **natural 20** gives +3 to your next roll this turn. A **natural 1** fails and causes a mishap (d6):
1–2 turned around, 3–4 engine stall (a boost overshoots 2×), 5 disaster on deck (1 damage, a crew member down,
a part lost), 6 lucky second chance.

Fights are meant to be short: hulls are 13–18 (+1 per kindred crew), a hit does about 9, so a ship goes down
after 2–3 hits once the guns are in range.

## Factions

| Faction | From the setting | Perk | Orders |
|---|---|---|---|
| Scrappers (Machine) | aggressive, ruthless; the ship is a living body | +1 damage on hits | epic orders only after a hit; won't sail the Construct |
| Nomads (Heart) | best when wind, crew and ship work as one | after a stable drift, +1 to all rolls | epic orders only after a stable drift |
| Drifters (Wind) | born to fly and fight | +1 to boost and drift rolls | every order rests only 1 turn; won't sail the Dreadnought |

The chronicle above the log tells the battle in each faction's voice: Scrappers grieve for their engine,
Nomads count heads after every hit, Drifters hum through their mouth-amps and trust the wind.

## Ships

| Ship | Look | Hull | Energy | Parts | Trait |
|---|---|---|---|---|---|
| Skiff | small regatta catamaran with a wing sail | 13 | 3 | 3 | hard to hit (+1 AC), speed up to 4, +1 boost, +2 drift, repairs +2, wrecks give 2 parts |
| Hauler | huge Chinese junk, two smokestacks, a fluke at each side | 18 | 2 | 2 | room for 4 crew, −1 boost rolls |
| Dreadnought | war junk with ram, cannons and a smokestack | 17 | 3 | 1 | twin guns: each shot rolls to hit twice, each hit does half damage (+1 before halving); +1 attack |
| Construct | small old-world manta ray | 17 | 5 | 2 | 5 energy: power several systems at once; hard to hit (+1 AC) |

## Crew

18 crew, 6 per faction, with two captains per faction. Both players may take the same people.

| Faction | Crew | Station | Passive | Order |
|---|---|---|---|---|
| Scrappers | VOSS, Iron Captain | ATK | +1 attack rolls | **Epic** Knock Them Down!: stun a random enemy crew member |
| | HESK, Forge-Master (captain) | ENG | +1 spare part at the start; repairs +1 | **Epic** Forge: 1 part for a permanent +1 BOOST, DRIFT or WEAPONS, or +2 hull (each once) |
| | GRIT, Harpooner | ATK | +1 damage | **Epic** Chain Shot: d6 1 speed, 2 boost, 3 drift, 4 weapons −1; 5–6 fire in the engines (enemy loses NAV or ENG next turn) |
| | BRAKK, Engineer | ENG | repairs +1 | Field Fix: all system damage −1 |
| | IVO, Reactor Tech | ENG | +1 energy | Surge: next roll this turn +5 |
| | SAL, Scavenger | ENG | +1 part; reload gives 2 ammo | Salvage: +2 parts |
| Nomads | RHO, Captain | ANY | +1 to all rolls | **Epic** Battle Stations: repeat this phase |
| | TASSA, Caravan Mother (captain) | ANY | while your drift holds, your crew can't be stunned | **Epic** All Hands: your next order this turn ignores rest |
| | KAEL, Soldier | ATK | +1 attack rolls | **Epic** Double Tap: +1 ammo, fire again |
| | DOV, Bulwark | ATK | enemy attacks on you −1 | Brace: damage taken −3 until your next turn |
| | FENN, Ecologist | NAV | rock crashes and scree deal only 1 damage | **Epic** Sandstorm: enemy −2 to all rolls next turn |
| | ANA, Medic | ENG | stunned crew recover at your turn start | **Epic** Patch Up: heal 3 hull |
| Drifters | KESTREL, Storm Rider (captain) | NAV | ignores natural 1s (one reroll) and storm drag | Ram!: end the move on the enemy: they take 6, you take 1 |
| | SELA, Wind Captain | NAV | a failed drift still lets you set your heading; below half hull (Song of the Wind) engine power adds no DC and +2 to boost rolls | Tailwind: next boost DC −4 |
| | VEX, Ace Pilot | NAV | +2 boost rolls | Afterburn: next boost auto-succeeds |
| | ORO, Wayfinder | NAV | +2 drift rolls | Evasive: enemy attacks −3 |
| | NYX, Spotter | ATK | +3 lock rolls | Auto-Lock: lock with no roll |
| | ZED, Jammer | ATK | enemy locks on you −2 | Jam Weapons: enemy −2 to lock and attack next turn |

## Maps, terrain, modes and weather

| Map | Plays like |
|---|---|
| Wastelands | open flats in the middle, rock thickening outward, winding canyons leading back in |
| Canyon | one narrow gorge between the starts: fight or evade head-on at speed |
| Labyrinth | Swiss cheese: solid rock holed with caves of all sizes, linked by tight 1-hex tunnels and a few 3-hex passages |

| Terrain | Rule |
|---|---|
| Rock (grey slate, brown mesa) | blocks courses and shots; a failed boost bounces back off it for 3 damage |
| Scree (grey or brown rubble) | fly over it; ending a move on it deals 2 |
| Dunes (pale sand stripes) | fly over them; ending a move on one deals 1 |
| Old-world wreck | +1 spare part (Skiff: 2) the first time a ship lands on it |

Ramming the other ship costs both ships 3 hull.

- **Duel:** last ship flying wins.
- **Relic Race** (capture the flag): the relic lies in the middle. End a move on it to take it (the carrier gets
  −1 engine). Then an exit opens behind each start. Bring the relic to your own exit to win, or sink the other ship.
- **Storm** (optional): the wind turns one step clockwise every two rounds. Into the wind DC +2; with the wind
  DC −1 and you are dragged 1 hex downwind; shots without a lock −2. Haulers ignore drag but turn worse;
  KESTREL ignores drag. The blowing sand on the map shows the wind.

## Playing a friend online

1. Click **Start online game**. You are Player 1: pick the map and mode, then your ship and crew.
2. The game shows a short message with a move code (`TETHYS-…`). Send it to your friend (chat, mail, anything).
3. Your friend clicks **Load code** on the title screen and pastes it. Their game replays your moves; now it is their turn.
4. They send their code back, you paste it under **Load their move**, and so on.

Every code holds the whole game (a shared random seed plus every move), so the dice come out the same on both
screens and any code resyncs a game. The game also autosaves in the browser. Codes trust both players
(someone could peek at upcoming rolls by reloading), so play with friends.

### Move notation

The game record (under the map) lists every move:

| Move | Meaning |
|---|---|
| `SET:CANYON:RELIC` | Player 1 picks the map (WASTE, CANYON, LABYRINTH) and mode (DUEL, RELIC) |
| `WX:STORM` | Player 2 picks the weather (CALM, STORM) |
| `C:SKIFF:WIND` | ship (SKIFF, HAULER, DREAD, RELIC = Construct) and faction (MACHINE, HEART, WIND) |
| `CREW:CAPTAIN,GUNNER,MEDIC` | the whole crew at once |
| `Q:NAV,ATK,ENG` | the phase plan |
| `B:2:+1` | boost at speed 2, turn +1 |
| `DRIFT`, `H:NE` | drift roll; after a stable drift, the new heading |
| `PIVOT:L` / `PIVOT:R` | turn in place (only when rock blocks every course) |
| `TGT`, `RLD`, `LOCK`, `AIM:WEAPONS`, `FIRE`, `DMG` | combat |
| `+WPN`, `-ENG`, `REP` | engineering: power a system up or down, repair |
| `O:2` | order from crew member 2 (`O:1:WPN`: HESK forges weapons) |
| `END` | end the phase |

## Playing against the computer

Click **Play vs computer**. The computer follows a short rule card and rolls d6s (shown in the log), so it could
also be run on a real table with real dice. The full card is in the game under "How the computer plays".

| Step | Rule |
|---|---|
| Weather | As Player 2 it picks the weather first: d6 1–4 calm, 5–6 storm. |
| Setup | Faction d6: 1–2 Scrappers, 3–4 Nomads, 5–6 Drifters. Ship d6: 1 Skiff, 2 Hauler, 3 Dreadnought, 4 Construct, 5–6 its faction's ship (Scrappers Dreadnought, Nomads Hauler, Drifters Skiff); a ship its faction won't sail becomes its faction's ship. Crew: a fixed list per faction. |
| Intent (d6 each turn) | Engage on 2+ while its hull is at least half, on 4+ when below half; otherwise escape. |
| Style (d6 each turn) | 1–3 easy: always the lowest DC. 4–6 risky: always the highest DC. |
| Plan | Engage: NAV → ATK → ENG. Escape: ENG → NAV → ATK. |
| NAV | Engage: a course ending 1–3 hexes from you, preferring a clear line of sight, then face you. Escape: the course ending farthest away, then face away. Relic Race: fly for the relic, then for its exit. |
| Terrain | Never faces straight into rock. Boxed in, it pivots toward the side with fewer rocks and keeps turning that way. Lands where it hurts least: sand, then dunes, then scree. |
| ATK | Target you if in arc, reload when empty, lock on, fire as often as allowed. Critical aim d6: 1–3 weapons, 4–5 speed, 6 crew. |
| ENG | Below half hull: repair while parts last. Then power WPN, BST, DFT (escaping: ENGINE, BST, DFT). |
| Orders | As soon as they are useful: KAEL's Double Tap after the first shot; RHO's Battle Stations repeats ATK after a shot (escaping: NAV); IVO's Surge only with a roll still to come; TASSA's All Hands only when a resting crew member could act; KESTREL's Ram! only with a course onto you (then it rams); VEX and SELA only when a course is open; ANA at 3+ missing hull; DOV's Brace when you are within 6 hexes; HESK forges weapons, then hull. Everything else at once. |

## Balance

Measured with the computer's rule card on both sides and random builds, on every map:
- Ships win 49–52%, factions 49–51%, every crew member 46–57% (2,000 games).
- The computer beats a player making random moves 92% of the time.
- Strongest: RHO (Battle Stations gives a second shot) and the KAEL + GRIT combo on Scrappers, both about 57%.

See `ROADMAP.md` for the design notes behind each change and what is planned next.

## For developers

- `web/page.html` (styles), `web/logic.js` (rules; no DOM, runs in Node too), `web/ui.js` (screen and online codes).
- `web/build.sh` builds `web/index.html` (the standalone page) and `web/tethys.body.html`.
- The root `index.html` redirects to `web/`, so the GitHub Pages address opens the game.
- `node web/test/rules.test.js`: 96 rules tests (setup, maps, terrain, line of sight, Relic Race, storms,
  natural 20s and 1s, every crew order, factions, ship classes, the computer's rule card, replay). No dependencies.
- `node web/test/browser.e2e.js`: browser tests with Playwright: heading preview, a full online game between two
  browser profiles, bad codes, a full game against the computer, the map staying visible while you wait online,
  phone width, no JavaScript errors.

---

## The original Python version (`TETHYS.1.1/`)

The first version of the game, built in Pygame and controlled by typing commands into a terminal on screen.
It has its own, older rules and crew (no factions, ship classes, maps or computer opponent).

```bash
pip install pygame
git clone https://github.com/SMZmk/tethys_game.git
cd tethys_game/TETHYS.1.1
python main.py
```

Hot seat for 1–4 players (best with 2). Type commands into the **Terminal Link** at the bottom left and press
`Enter`; press `X` to confirm or advance, `C` to cancel the current phase.

- **Crew draft:** 3 crew each with 1–2 players, 2 each with 3–4 players. Picks snake (P1, P2, P2, P1, P1, P2).
  Type the card number, or `A` for a random pick.
- **Turn:** program three phases (`NAV`, `ATK`, `ENG`). NAV: speed 1–3 and turn −3 to +3, then d20 boost and
  drift rolls. ATK: enter the target's distance and direction, then target, reload or fire (d20 vs armour class).
  ENG: power systems (`SPEED 1`, `WPN 1`) or `REPAIR` with spare parts.
- **Crew:** `USE 1`, `USE 2` or `USE 3` gives an order; the crew member then rests for 2 turns. After a lock-on
  you can aim at `STN` to stun a random enemy crew member.

| # | Crew | Station | Passive | Order |
|---|------|---------|---------|-------|
| 1 | RHO, Captain | ANY | +1 to all rolls | **Battle Stations**: repeat the current phase once |
| 2 | VEX, Ace Pilot | NAV | +2 boost rolls | **Afterburn**: next boost auto-succeeds |
| 3 | ORO, Navigator | NAV | +2 drift rolls | **Evasive**: enemy attacks −3 until your next turn |
| 4 | KAEL, Gunner | ATK | +2 attack rolls | **Double Tap**: +1 ammo, fire again |
| 5 | NYX, Spotter | ATK | +3 lock rolls | **Auto-Lock**: instant lock on the acquired target |
| 6 | ZED, Jammer | ATK | Enemy locks on you −2 | **Jam Comms**: target plans only 2 phases next turn |
| 7 | BRAKK, Mechanic | ENG | Repair heals +2 | **Field Fix**: all system damage −1 |
| 8 | IVO, Reactor Tech | ENG | +1 energy cap | **Surge**: next roll this turn +5 |
| 9 | SAL, Quartermaster | ENG | +1 spare part, reload gives 2 ammo | **Salvage**: +2 spare parts |
