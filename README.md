
---

# Tethys: Desert Drifter

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

### Crew

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

## Browser Game (online play)

`web/index.html` is a self-contained browser version for 2 players: same d20 hex combat and crew,
plus ship classes, a storyteller, and **online play by move codes**. Open it in any browser or serve it with
GitHub Pages; no install needed.

### Playing a friend online
1. Click **Start online game**. You are Player 1: pick your ship and first crew member.
2. The game shows a short message with a move code, like
   `Tethys · move 1 · P1: C:SKIFF R:CAPTAIN` followed by `TETHYS-…`. Send it to your friend (chat, mail, anything).
3. Your friend clicks **Load code** on the title screen and pastes it. Their game replays your moves, then it is their turn.
4. They send their code back, you paste it under **Load their move**, and so on, like correspondence chess.

Every code holds the whole game (a shared random seed plus every move), so dice rolls come out the same
on both screens and any code resyncs a game. The game also autosaves in the browser.
Codes trust both players: someone could peek at upcoming rolls by reloading, so play with friends.

### Move notation
| Move | Meaning |
|---|---|
| `C:SKIFF` | choose ship class (SKIFF, HAULER, DREAD, RELIC) |
| `R:CAPTAIN` | recruit a crew member |
| `Q:NAV,ATK,ENG` | plan the phase order |
| `B:2:+1` | boost at speed 2, turn +1 (rolls d20) |
| `DRIFT`, `H:NE` | drift roll; after a stable drift, preview a heading and confirm it |
| `PIVOT:L` / `PIVOT:R` | turn in place (only when rocks block every course) |
| `TGT`, `RLD`, `LOCK`, `AIM:WEAPONS`, `FIRE`, `DMG` | combat |
| `+WPN`, `-ENG`, `REP` | engineering: power up/down a system, repair |
| `O:2` | give an order to crew member 2 |
| `END` | end the phase |

### Ship classes
| Ship | Role | Hull | Energy | Parts | Trait |
|---|---|---|---|---|---|
| Skiff | Runner | 22 | 3 | 2 | +1 boost and drift rolls |
| Hauler | Fortress | 28 | 3 | 3 | repairs +1, −1 boost rolls |
| Dreadnought | Ripper | 26 | 3 | 1 | +1 attack, +1 damage |
| Construct | Relic | 26 | 5 | 2 | repairs −1 |

### The arena
The two ships start in open flats in the middle. Rock gets denser the further out you drift, but winding
canyons lead back toward the centre, and old-world wrecks (+1 spare part) lie in the flats.
You can leave, but the desert makes coming back the easy way.

### Tests
- `node web/test/rules.test.js`: 35 rules tests (draft, movement, drift and heading, combat, every crew order, terrain, replay). No dependencies.
- `node web/test/browser.e2e.js`: browser tests with Playwright: heading preview, a full online game between two browser profiles, bad codes, phone width.

### Source
`web/page.html` (styles), `web/logic.js` (rules, no DOM, runs in Node too) and `web/ui.js` (screen and online codes).
Run `web/build.sh` to rebuild `index.html`.
