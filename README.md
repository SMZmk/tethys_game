
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

The game uses a hotseat multiplayer format (1-4 players) and is controlled by typing commands into the **Terminal Link** at the bottom left of the screen.

### Basic Controls

* Type commands and press `Enter` to submit them to the terminal.
* Press `X` to confirm your actions or advance to the next phase.
* Press `C` to cancel or reset your current phase.

### The Turn Sequence

At the start of your turn, you must program a sequence of three phases in the Command (CMD) interface. Type a combination of the following commands (e.g., `NAV`, `ATK`, `ENG`) to lock in your turn:

* **NAV (Navigation):** Input your desired speed (1-3) and turn trajectory (-3 to +3). You will perform d20 rolls to successfully boost and stabilize your drift on the hex grid.
* **ATK (Combat):** Use your radar to input a target's distance and direction. Choose to target (lock on), reload, or fire main weapons using d20 rolls against the enemy's Armor Class.
* **ENG (Engineering):** Allocate energy to your ship's subsystems to gain stat bonuses (e.g., type `SPEED 1` or `WPN 1`), or type `REPAIR` to spend spare parts to fix your hull.

---

Would you like me to also write a quick `requirements.txt` file that you can add to the repository alongside this README?
