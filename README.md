
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

## Browser Demo

`web/index.html` is a self-contained browser version of the 2-player game (same rules, including the crew),
with a pixel-art map and buttons instead of typed commands. Open it in any browser, or serve it with GitHub Pages.
No install needed.

The source is `web/tethys.body.html`; run `web/build.sh` to regenerate `index.html` after editing it.
