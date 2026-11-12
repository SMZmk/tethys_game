# crew.py
"""
CREW SYSTEM
-----------
Every ship drafts a small crew before the battle. Each crew member has:

  * a STATION  - the phase in which their ORDER can be given (NAV, ATK, ENG or ANY)
  * a PASSIVE  - always-on bonus for your ship (or penalty for enemies)
  * an ORDER   - an active ability. After use the crew member RESTS for 2 turns.

Crew can be STUNNED by an enemy critical hit (debuff target "STN").
A stunned crew member gives no passive and cannot take orders until
the end of their ship's next turn.

Type `USE 1` / `USE 2` / `USE 3` during a phase to give an order.
"""
import random
import settings

STATION_ANY = "ANY"
REST_TURNS = 2


class CrewDef:
    def __init__(self, key, name, role, station, passive, order, order_txt, sprite):
        self.key = key
        self.name = name
        self.role = role
        self.station = station
        self.passive = passive        # short rules text
        self.order = order            # order name
        self.order_txt = order_txt    # short rules text
        self.sprite = sprite          # palette index for portrait


# Kept deliberately short: one passive, one order each.
ROSTER = [
    CrewDef("CAPTAIN", "RHO", "CAPTAIN", STATION_ANY,
            "+1 TO ALL ROLLS", "BATTLE STATIONS", "REPEAT THIS PHASE", 0),
    CrewDef("ACE", "VEX", "ACE PILOT", "NAV",
            "+2 BOOST ROLLS", "AFTERBURN", "NEXT BOOST AUTO-SUCCEEDS", 1),
    CrewDef("DRIFTER", "ORO", "NAVIGATOR", "NAV",
            "+2 DRIFT ROLLS", "EVASIVE", "ENEMY ATK -3 UNTIL YOUR TURN", 2),
    CrewDef("GUNNER", "KAEL", "GUNNER", "ATK",
            "+2 ATTACK ROLLS", "DOUBLE TAP", "+1 AMMO, FIRE AGAIN", 3),
    CrewDef("SPOTTER", "NYX", "SPOTTER", "ATK",
            "+3 LOCK ROLLS", "AUTO-LOCK", "INSTANT LOCK, NO ROLL", 4),
    CrewDef("JAMMER", "ZED", "JAMMER", "ATK",
            "ENEMY LOCKS ON YOU -2", "JAM COMMS", "TARGET GETS 2 PHASES NEXT TURN", 5),
    CrewDef("MECHANIC", "BRAKK", "MECHANIC", "ENG",
            "REPAIR +2 HP", "FIELD FIX", "ALL SYSTEM DAMAGE -1", 6),
    CrewDef("TECH", "IVO", "REACTOR TECH", "ENG",
            "+1 ENERGY CAP", "SURGE", "NEXT ROLL THIS TURN +5", 7),
    CrewDef("QM", "SAL", "QUARTERMASTER", "ENG",
            "+1 PART, RELOAD = 2 AMMO", "SALVAGE", "+2 SPARE PARTS", 8),
]
ROSTER_BY_KEY = {c.key: c for c in ROSTER}


class CrewMember:
    def __init__(self, cdef):
        self.d = cdef
        self.rest = 0          # turns until order is ready again
        self.stunned = False   # cleared at end of owner's turn

    @property
    def key(self): return self.d.key

    @property
    def ready(self): return self.rest == 0 and not self.stunned

    def status(self):
        if self.stunned: return "STUNNED"
        if self.rest > 0: return f"REST {self.rest}"
        return "READY"


# ---------------------------------------------------------------
# DRAFT
# ---------------------------------------------------------------
def crew_size(n_players):
    return 3 if n_players <= 2 else 2


def draft_order(n_players):
    """Snake draft: 1-2, 2-1, 1-2 ... (indices into players list)."""
    order = []
    fwd = list(range(n_players))
    for rnd in range(crew_size(n_players)):
        order += fwd if rnd % 2 == 0 else list(reversed(fwd))
    return order


def on_recruit(p, cdef):
    p.crew.append(CrewMember(cdef))
    if cdef.key == "QM":
        p.spare_parts += 1


# ---------------------------------------------------------------
# PASSIVES
# ---------------------------------------------------------------
def has(p, key):
    """True if ship p has an active (not stunned) crew member `key`."""
    for c in getattr(p, "crew", []):
        if c.key == key and not c.stunned:
            return True
    return False


def roll_mods(p, kind, target=None, consume=True):
    """Crew modifiers for a d20 roll.
    kind: 'BOOST', 'DRIFT', 'LOCK', 'ATK'
    Returns (total_bonus, label_string)."""
    mods = []
    if has(p, "CAPTAIN"): mods.append((1, "cpt"))
    if kind == "BOOST" and has(p, "ACE"): mods.append((2, "ace"))
    if kind == "DRIFT" and has(p, "DRIFTER"): mods.append((2, "nav"))
    if kind == "ATK" and has(p, "GUNNER"): mods.append((2, "gun"))
    if kind == "LOCK" and has(p, "SPOTTER"): mods.append((3, "spot"))
    if getattr(p, "surge", 0) > 0:
        mods.append((p.surge, "surge"))
        if consume: p.surge = 0
    if target is not None:
        if kind == "LOCK" and has(target, "JAMMER"): mods.append((-2, "jam"))
        if kind == "ATK" and getattr(target, "evasive", False): mods.append((-3, "evade"))
    total = sum(v for v, _ in mods)
    label = "".join(f" {v:+d}{n}" for v, n in mods)
    return total, label


def repair_bonus(p):
    return 2 if has(p, "MECHANIC") else 0


def energy_bonus(p):
    return 1 if has(p, "TECH") else 0


def reload_amount(p):
    return 2 if has(p, "QM") else 1


# ---------------------------------------------------------------
# ORDERS
# ---------------------------------------------------------------
def use_order(gs, slot):
    """Executes the order of crew member in `slot` (1-based)."""
    p = gs.player
    if not p.crew or not (1 <= slot <= len(p.crew)):
        gs.log("!! NO SUCH CREW SLOT !!")
        return
    c = p.crew[slot - 1]
    phase_name = settings.PHASE_NAMES.get(gs.phase, "")
    if phase_name == "COM": phase_name = "ATK"

    if c.stunned: gs.log(f"!! {c.d.name} IS STUNNED !!"); return
    if c.rest > 0: gs.log(f"!! {c.d.name} RESTING ({c.rest}) !!"); return
    if c.d.station != STATION_ANY and c.d.station != phase_name:
        gs.log(f"!! {c.d.name} ONLY IN {c.d.station} PHASE !!")
        return

    ok = _ORDERS[c.key](gs, p)
    if ok:
        c.rest = REST_TURNS
        gs.log(f"ORDER: {c.d.name} - {c.d.order}")


def _need_target(gs):
    if gs.active_target is None or gs.active_target is gs.enemy and gs.enemy.hp <= 0:
        gs.log("!! ACQUIRE A TARGET FIRST !!")
        return False
    return True


def _o_captain(gs, p):
    if getattr(gs, "phase_repeated", False):
        gs.log("!! ALREADY REPEATED A PHASE !!"); return False
    gs.phase_queue.insert(gs.current_phase_idx + 1, gs.phase)
    gs.phase_repeated = True
    gs.log("THIS PHASE WILL REPEAT AFTER [X].")
    return True


def _o_ace(gs, p):
    if gs.state not in (settings.STATE_NAV_SPEED, settings.STATE_NAV_SIDE, settings.STATE_INPUT_BOOST):
        gs.log("!! USE BEFORE THE BOOST ROLL !!"); return False
    p.auto_boost = True
    gs.log("AFTERBURNER PRIMED.")
    return True


def _o_drifter(gs, p):
    p.evasive = True
    gs.log("EVASIVE PATTERN: ENEMY ATK -3.")
    return True


def _o_gunner(gs, p):
    p.ammo += 1
    p.has_fired = False
    gs.log(f"DOUBLE TAP: AMMO {p.ammo}, FIRE READY.")
    return True


def _o_spotter(gs, p):
    if gs.state != settings.STATE_COM_MENU or not _need_target(gs): return False
    if p.has_targeted: gs.log("!! TARGETING ALREADY SPENT !!"); return False
    p.target_locked = True
    gs.log("LOCK CONFIRMED. SELECT DEBUFF:")
    gs.log("SPD, BST, DFT, WPN, STN(CREW)")
    gs.state = settings.STATE_COM_TARGET_DEBUFF
    return True


def _o_jammer(gs, p):
    if not _need_target(gs): return False
    t = gs.active_target
    if not hasattr(t, "crew"): gs.log("!! TARGET HAS NO COMMS !!"); return False
    t.jammed = True
    gs.log(f"P{t.pid} COMMS JAMMED: 2 PHASES NEXT TURN.")
    return True


def _o_mechanic(gs, p):
    if not any(v > 0 for v in p.debuffs.values()):
        gs.log("!! NO SYSTEM DAMAGE !!"); return False
    for k in p.debuffs:
        p.debuffs[k] = max(0, p.debuffs[k] - 1)
    gs.log("FIELD FIX: SYSTEM DAMAGE -1.")
    return True


def _o_tech(gs, p):
    p.surge = 5
    gs.log("SURGE: NEXT ROLL +5.")
    return True


def _o_qm(gs, p):
    p.spare_parts += 2
    gs.log(f"SALVAGE: PARTS {p.spare_parts}.")
    return True


_ORDERS = {
    "CAPTAIN": _o_captain, "ACE": _o_ace, "DRIFTER": _o_drifter,
    "GUNNER": _o_gunner, "SPOTTER": _o_spotter, "JAMMER": _o_jammer,
    "MECHANIC": _o_mechanic, "TECH": _o_tech, "QM": _o_qm,
}


# ---------------------------------------------------------------
# CRITICAL HIT ON CREW
# ---------------------------------------------------------------
def stun_random(target, log):
    pool = [c for c in getattr(target, "crew", []) if not c.stunned]
    if not pool:
        log("NO CREW TO STUN.")
        return
    c = random.choice(pool)
    c.stunned = True
    log(f"CREW HIT: P{target.pid} {c.d.name} STUNNED!")


# ---------------------------------------------------------------
# TURN HOOKS
# ---------------------------------------------------------------
def on_turn_start(p):
    p.evasive = False
    for c in p.crew:
        if c.rest > 0: c.rest -= 1


def on_turn_end(p):
    p.jammed = False
    p.surge = 0
    p.auto_boost = False
    for c in p.crew:
        c.stunned = False


# ---------------------------------------------------------------
# 16-BIT PORTRAITS (12x12, palette-indexed)
# ---------------------------------------------------------------
# . = transparent, s = skin, h = hair/helmet, u = uniform, e = eye, a = accent
PORTRAIT = [
    "...hhhhhh...",
    "..hhhhhhhh..",
    ".hhhsssshhh.",
    ".hhssssssh..",
    "..sesssesa..",
    "..ssssssss..",
    "...ssaass...",
    "....ssss....",
    "..uuuaauuu..",
    ".uuuuaauuuu.",
    "uuuauuuuauuu",
    "uuuuuuuuuuuu",
]
PALETTES = [
    # skin,           hair,           uniform,        accent
    ((224, 176, 136), (232, 232, 240), (40, 56, 120), (248, 200, 40)),   # captain
    ((240, 192, 152), (200, 64, 32), (24, 112, 168), (120, 232, 248)),   # ace
    ((176, 120, 80), (24, 24, 32), (32, 136, 120), (160, 248, 200)),     # drifter
    ((208, 152, 112), (88, 56, 32), (144, 40, 40), (248, 120, 40)),      # gunner
    ((240, 208, 176), (120, 80, 200), (64, 48, 96), (248, 64, 160)),     # spotter
    ((152, 104, 72), (40, 200, 72), (32, 40, 48), (64, 248, 96)),        # jammer
    ((200, 144, 104), (232, 120, 0), (120, 88, 40), (248, 200, 80)),     # mechanic
    ((232, 184, 152), (40, 160, 232), (56, 64, 72), (120, 232, 248)),    # tech
    ((184, 136, 96), (136, 136, 136), (88, 104, 56), (232, 216, 120)),   # qm
]


def portrait_pixels(idx):
    """Yields (x, y, rgb) for each opaque pixel of portrait `idx`."""
    skin, hair, uni, acc = PALETTES[idx % len(PALETTES)]
    cmap = {"s": skin, "h": hair, "u": uni, "a": acc, "e": (16, 16, 24)}
    for y, row in enumerate(PORTRAIT):
        for x, ch in enumerate(row):
            if ch in cmap:
                yield x, y, cmap[ch]
