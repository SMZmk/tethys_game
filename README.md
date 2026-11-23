
---

# Tethys: Desert Drifter

**Play in your browser:** https://smzmk.github.io/tethys_game/

Tethys: Desert Drifter is a turn-based, tactical vehicular combat game built in Pygame. You pilot a drift-ship on a procedural hex grid, managing power subsystems, hull integrity, and facing orientation through terminal-based commands and d20-style skill checks.

## How to Start

1. **Install Python 3** on your system.
2. **Install Pygame** via pip:
```bash
pip install pygame

```


3. **Clone the repository** and navigate to the game folder:
```bash
git clone https://github.com/SMZmk/tethys_game.git
cd tethys_game/TETHYS.1.1

```


4. **Launch the game**:
```bash
python main.py

```



## How to Play

The game uses a hotseat multiplayer format (1-4 players, best with 2) and is controlled by typing commands into the **Terminal Link** at the bottom left of the screen.

### Basic Controls

* Type commands and press `Enter` to submit them to the terminal.
* Press `X` to confirm your actions or advance to the next phase.
* Press `C` to cancel or reset your current phase.

### Crew Draft

Before the battle every ship drafts a crew (3 each with 1-2 players, 2 each with 3-4 players).
Picks snake (P1, P2, P2, P1, P1, P2). Type the card number, or `A` for a random pick.

### The Turn Sequence

At the start of your turn, you must program a sequence of three phases in the Command (CMD) interface. Type a combination of the following commands (e.g., `NAV`, `ATK`, `ENG`) to lock in your turn:

* **NAV (Navigation):** Input your desired speed (1-3) and turn trajectory (-3 to +3). You will perform d20 rolls to successfully boost and stabilize your drift on the hex grid.
* **ATK (Combat):** Use your radar to input a target's distance and direction. Choose to target (lock on), reload, or fire main weapons using d20 rolls against the enemy's Armor Class.
* **ENG (Engineering):** Allocate energy to your ship's subsystems to gain stat bonuses (e.g., type `SPEED 1` or `WPN 1`), or type `REPAIR` to spend spare parts to fix your hull.

### Crew (Python version)

Each crew member has a **station** (the phase where their order works), a **passive** that is always on,
and one **order**. Type `USE 1`, `USE 2` or `USE 3` during a phase to give an order.
After an order the crew member **rests for 2 turns**.

| # | Crew | Station | Passive | Order |
|---|------|---------|---------|-------|
| 1 | RHO, Captain | ANY | +1 to all rolls | **Battle Stations**: repeat the current phase once |
| 2 | VEX, Ace Pilot | NAV | +2 boost rolls | **Afterburn**: next boost auto-succeeds |
| 3 | ORO, Navigator | NAV | +2 drift rolls | **Evasive**: enemy attacks -3 until your next turn |
| 4 | KAEL, Gunner | ATK | +2 attack rolls | **Double Tap**: +1 ammo, fire again |
| 5 | NYX, Spotter | ATK | +3 lock rolls | **Auto-Lock**: instant lock on the acquired target |
| 6 | ZED, Jammer | ATK | Enemy locks on you -2 | **Jam Comms**: target plans only 2 phases next turn |
| 7 | BRAKK, Mechanic | ENG | Repair heals +2 | **Field Fix**: all system damage -1 |
| 8 | IVO, Reactor Tech | ENG | +1 energy cap | **Surge**: next roll this turn +5 |
| 9 | SAL, Quartermaster | ENG | +1 spare part, reload gives 2 ammo | **Salvage**: +2 spare parts |

**Hitting crew:** after a successful lock-on you can aim at `STN` instead of a system.
If the shot hits, a random enemy crew member is **stunned**: no passive and no orders until the end of their ship's next turn.

The last ship flying wins.

## Browser Game

`web/index.html` is a self-contained browser version: play against the computer, two players on one device, or online: same d20 hex combat and crew,
plus ship classes, a storyteller, and **online play by move codes**. Open it in any browser or serve it with
GitHub Pages; no install needed.

### Playing a friend online
1. Click **Start online game**. You are Player 1: pick the map and mode, then your ship and crew. (Player 2 picks the weather.)
2. The game shows a short message with a move code, like
   `Tethys · move 1 · P1: SET:CANYON:DUEL C:SKIFF:WIND CREW:WINDCAPT,ACE,DRIFTER` followed by `TETHYS-…`. Send it to your friend (chat, mail, anything).
3. Your friend clicks **Load code** on the title screen and pastes it. Their game replays your moves, then it is their turn.
4. They send their code back, you paste it under **Load their move**, and so on, like correspondence chess.

Every code holds the whole game (a shared random seed plus every move), so dice rolls come out the same
on both screens and any code resyncs a game. The game also autosaves in the browser.
Codes trust both players: someone could peek at upcoming rolls by reloading, so play with friends.

### Move notation
| Move | Meaning |
|---|---|
| `SET:CANYON:RELIC` | Player 1 picks the map (WASTE, CANYON, LABYRINTH) and mode (DUEL, RELIC) |
| `WX:STORM` | Player 2 picks the weather (CALM, STORM) before choosing a ship |
| `C:SKIFF:WIND` | choose ship class (SKIFF, HAULER, DREAD, RELIC) and faction (MACHINE, HEART, WIND) |
| `CREW:CAPTAIN,GUNNER,MEDIC` | choose the whole crew at once (3 names, Hauler 4) |
| `Q:NAV,ATK,ENG` | plan the phase order |
| `B:2:+1` | boost at speed 2, turn +1 (rolls d20) |
| `DRIFT`, `H:NE` | drift roll; after a stable drift, preview a heading and confirm it |
| `PIVOT:L` / `PIVOT:R` | turn in place (only when rocks block every course) |
| `TGT`, `RLD`, `LOCK`, `AIM:WEAPONS`, `FIRE`, `DMG` | combat |
| `+WPN`, `-ENG`, `REP` | engineering: power up/down a system, repair |
| `O:2` | give an order to crew member 2 (`O:1:WPN`: HESK's Forge with the chosen stat) |
| `END` | end the phase |

### Factions
Every ship sails under a faction and every crew member belongs to one. Each crew member who shares
your ship's faction adds **+1 hull** (kindred), so the draft is also about denying your opponent their faction.
The story text changes with your faction: Scrappers fire scrap-iron arrows and grieve for their engine,
Nomads count heads after every hit, Drifters trust the wind.

| Faction | From the setting | Perk | Orders |
|---|---|---|---|
| Scrappers | Followers of the Machine: aggressive, ruthless | +1 damage on hits | epic orders only after a hit; won't sail the Construct |
| Nomads | Followers of the Heart: best when wind, crew and ship work as one | after a stable drift, +1 to all rolls | epic orders only after a stable drift |
| Drifters | Followers of the Wind: born to fly and fight | +1 to boost and drift rolls | every order rests only 1 turn (others 2); won't sail the Hauler |

See `ROADMAP.md` for the design behind this and what is planned next.

### Ship classes
| Ship | Look | Hull | Energy | Parts | Trait |
|---|---|---|---|---|---|
| Skiff | small regatta catamaran with a wing sail, hulls like skis | 13 | 3 | 3 | small target (+1 AC), speed up to 4, +1 boost, +2 drift, repairs +2, wrecks give 2 parts |
| Hauler | huge Chinese junk: battened sails, two smokestacks, a fluke at each side | 14 | 3 | 2 | room for 4 crew, −1 boost rolls |
| Dreadnought | war junk: ram, bow gun, side cannons, smokestack, one fluke | 17 | 3 | 1 | twin guns: every shot rolls to hit twice, each hit half damage (+1 before halving); +1 attack |
| Construct | small old-world manta ray with orbiting shards, one fluke | 15 | 5 | 2 | 5 energy |

All ships hover over the dune sea. On the map each ship has a hover shadow and an arrow in the player's colour
ahead of its bow, so you can always see its heading. Sails take the faction's colours: rust for Scrappers,
patchwork for Nomads, sand for Drifters. The ship choice shows a large side view of each hull.

### Crew (browser version)
Each faction has its own look: Nomads are wastelanders in leather jackets, sunglasses, cowboy hats and bandanas;
Scrappers wear helmets and face paint, have piercings and smoke; Drifters wear bedouin-like wraps and scarves, with
mouth amplifiers that send a deep bass against the wind.

18 crew, 6 per faction, including two captains per faction (one offensive, one defensive). Each player picks ship,
faction and the whole crew in one turn (3 crew, Hauler 4; at most one captain, and only of your own faction);
both players may take the same people. Click cards to select, then confirm; you can undo (on one device any
time during setup, online or against the computer until your turn is done). After an order a crew member sits out
your next 2 turns.

| Faction | Crew | Station | Passive | Order |
|---|---|---|---|---|
| Scrappers | VOSS, Iron Captain (offensive) | ATK | +1 attack rolls | **Epic** Knock Them Down!: after a hit, stun a random enemy crew member (no lock) |
| | HESK, Forge-Master (defensive captain) | ENG | +1 spare part at the start; repairs +1 | **Epic** Forge: spend 1 part for a permanent +1 BOOST, DRIFT or WEAPONS, or +2 hull (each once) |
| | GRIT, Harpooner | ATK | +1 damage | **Epic** Chain Shot: after a hit (no lock), d6: 1 speed, 2 boost, 3 drift, 4 weapons −1; 5–6 fire in the engines (enemy loses NAV or ENG next turn) |
| | BRAKK, Engineer | ENG | repairs +1 | Field Fix: all system damage −1 |
| | IVO, Reactor Tech | ENG | +1 energy cap | Surge: next roll +5 |
| | SAL, Scavenger | ENG | +1 part, reload gives 2 ammo | Salvage: +2 parts |
| Nomads | RHO, Captain (offensive) | ANY | +1 to all rolls | **Epic** Battle Stations: repeat this phase |
| | TASSA, Caravan Mother (defensive captain) | ANY | while your drift holds, your crew can't be stunned | **Epic** All Hands: your next order this turn ignores rest |
| | KAEL, Soldier | ATK | +2 attack rolls | Double Tap: +1 ammo, fire again |
| | DOV, Bulwark | ATK | enemy attacks on you −1 | Brace: damage taken −3 until your next turn |
| | FENN, Ecologist | NAV | rock crashes deal 1, not 3 | **Epic** Sandstorm: enemy −2 to all rolls next turn |
| | ANA, Medic | ENG | stunned crew recover at your turn start | **Epic** Patch Up: heal 3 hull |
| Drifters | KESTREL, Storm Rider (offensive captain) | NAV | ignores natural 1s (one reroll) and storm drag | Ram!: end the move on the enemy's hex: they take 6, you take 1 |
| | SELA, Wind Captain (defensive) | NAV | a failed drift still lets you set heading; **Epic** Song of the Wind: below half hull, engine power adds no DC and +2 to boost rolls | Tailwind: next boost DC −4 |
| | VEX, Ace Pilot | NAV | +2 boost rolls | Afterburn: next boost auto-succeeds |
| | ORO, Wayfinder | NAV | +2 drift rolls | Evasive: enemy attacks −3 |
| | NYX, Spotter | ATK | +3 lock rolls | Auto-Lock: lock with no roll |
| | ZED, Jammer | ATK | enemy locks on you −2 | Jam Weapons: enemy −2 to lock and attack next turn |

### Fight length
Once the guns are in range a fight is meant to be short: a hit does d6+4 (about 8), ships have 15 hull (Skiff 13)
(+1 per kindred crew), base armour class is 10 (+2/+4 at range 2/3), so a ship goes down after 2–3 hits.
In 2,000 bot games a fight lasted a median of 2.5 exchanges of fire. Rocks and rams deal 3, repairs heal d4.

### Dice
- **Natural 20** on a d20 check: +3 to your next roll this turn.
- **Natural 1**: the roll fails and a mishap follows (d6): 1–2 turned around (stern to the enemy), 3–4 engine
  stall (engine power drops to 1; a boost also overshoots 2×), 5 disaster on deck (1 damage, a crew member down,
  a spare part lost), 6 lucky second chance (roll again).

### Maps, modes and weather
Player 1 picks the map and mode before choosing a ship; Player 2 picks the weather before choosing theirs. Courses must have a clear path; a failed boost stops in front of
the first rock it hits and crashes.

| Map | Plays like |
|---|---|
| Wastelands | open flats in the middle, rock thickening outward, canyons leading back in |
| Canyon | one narrow gorge between the starts: fight or evade head-on at speed |
| Labyrinth | a network of alleys; agile ships have the edge |

- **Duel**: last ship flying wins.
- **Relic Race** (capture the flag): the relic lies in the middle. End a move on it to take it (the carrier gets
  −1 engine). Once it is taken, an exit opens behind each team's start; bring the relic to your own exit to win,
  or sink the other ship.
- **Storm** (optional): the wind turns one step clockwise every two rounds. Into the wind DC +2; with the wind
  DC −1 and the ship is dragged 1 hex downwind; shots without a lock −2. Haulers ignore drag but turn worse;
  KESTREL ignores drag.

Balance (bot games with random builds on every map and mode, 1,500 per setting): ships 44–55%, factions 47–54%.
The computer plays every map and mode the same way, so these numbers say more about the rules than about skill.

### Playing against the computer
Click **Play vs computer**. The computer follows a short rule card and rolls d6s, so it could also be
run on a real table with real dice. Its rolls are shown in the log.

| Step | Rule |
|---|---|
| Weather | As Player 2 it picks the weather first: d6 1–4 calm, 5–6 storm. |
| Setup | Faction d6: 1–2 Scrappers, 3–4 Nomads, 5–6 Drifters. Ship d6: 1 Skiff, 2 Hauler, 3 Dreadnought, 4 Construct, 5–6 its faction's ship (Scrappers Dreadnought, Nomads Hauler, Drifters Skiff); a ship its faction won't sail becomes its faction's ship. Crew: a fixed list per faction. |
| Intent (d6 each turn) | Engage on 2+ while its hull is at least half, on 4+ when below half; otherwise escape. |
| Style (d6 each turn) | 1–3 easy: always the lowest DC. 4–6 risky: always the highest DC. |
| Plan | Engage: NAV → ATK → ENG. Escape: ENG → NAV → ATK. |
| Orders | Gives every crew order as soon as it can. |
| Relic Race | While the relic is free it flies for it; carrying it, it flies for its own exit. |
| NAV | Engage: a course ending 1–3 hexes from you, then face you. Escape: the course ending farthest away, then face away. |
| ATK | Target you if in arc, reload when empty, lock on, fire as often as allowed. Critical aim d6: 1–3 weapons, 4–5 speed, 6 crew. |
| ENG | Below half hull: repair while parts last. Then power WPN, BST, DFT (escaping: ENGINE, BST, DFT). |

The computer beats a player making random moves 83% of the time. Against itself, its three factions win 44–56%.

### The arena
The two ships start in open flats in the middle. Rock gets denser the further out you drift, but winding
canyons lead back toward the centre, and old-world wrecks (+1 spare part) lie in the flats.
You can leave, but the desert makes coming back the easy way.

### Tests
- `node web/test/rules.test.js`: 81 rules tests (setup, maps, Relic Race, storms, natural 20s and 1s, captains, factions, Hauler and Dreadnought, the computer's rule card, movement, drift and heading, combat, every crew order, terrain, replay). No dependencies.
- `node web/test/browser.e2e.js`: browser tests with Playwright: heading preview, a full online game between two browser profiles, bad codes, a full game against the computer, the map staying visible while you wait online, phone width.

### Source
`web/page.html` (styles), `web/logic.js` (rules, no DOM, runs in Node too) and `web/ui.js` (screen and online codes).
Run `web/build.sh` to rebuild `index.html`.
