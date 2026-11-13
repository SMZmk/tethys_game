# gamestate.py
import settings
import crew as crewmod

class Player:
    """Represents a single ship/player in the game."""
    def __init__(self, pid, q, r, color):
        self.pid = pid
        self.color = color
        
        self.q = float(q)
        self.r = float(r)
        self.orientation = 0
        
        self.max_hp = settings.MAX_HP
        self.hp = self.max_hp
        self.base_energy = settings.START_ENERGY
        self.spare_parts = settings.START_SPARE_PARTS
        self.ammo = settings.START_AMMO
        
        self.sys_engine = 0
        self.sys_boost = 0
        self.sys_drift = 0
        self.sys_weapon = 0
        
        self.debuffs = {"SPEED": 0, "BOOST": 0, "DRIFT": 0, "WEAPONS": 0}
        
        self.has_targeted = False
        self.has_reloaded = False
        self.has_fired = False
        self.drift_success = False
        self.target_locked = False
        self.selected_debuff = None

        # Crew state
        self.crew = []
        self.evasive = False     # enemy attacks -3 until our next turn
        self.jammed = False      # only 2 phases this turn
        self.surge = 0           # bonus to next roll
        self.auto_boost = False  # next boost auto-succeeds

    @property
    def energy_cap(self):
        pct = self.hp / self.max_hp
        if pct < settings.HP_THRESHOLD_FAIL: return 0
        if pct < settings.HP_THRESHOLD_CRIT: return 1
        return self.base_energy + crewmod.energy_bonus(self)

    @property
    def current_energy_used(self):
        return self.sys_engine + self.sys_boost + self.sys_drift + self.sys_weapon

    def take_damage(self, amount, log_func):
        """Applies damage safely. Returns True if dead."""
        self.hp -= amount
        if self.hp <= 0: 
            self.hp = 0
            log_func(f"!! CRITICAL: SHIP P{self.pid} HULL ZERO !!")
            return True
        log_func(f"!! HULL BREACH: -{amount} HP (REM: {self.hp}) !!")
        self.check_system_integrity(log_func)
        return False

    def check_system_integrity(self, log_func):
        cap = self.energy_cap
        if self.current_energy_used > cap:
            log_func(f"[ALERT] POWER FAILURE! CAP DROPPED TO {cap}")
            self.sys_engine = 0; self.sys_boost = 0
            self.sys_drift = 0; self.sys_weapon = 0
            if cap == 1: 
                self.sys_engine = 1 
                log_func("[SYSTEM] EMERGENCY POWER TO ENGINES")

class Enemy:
    def __init__(self, q, r, pid=99):
        self.pid = pid
        self.color = settings.COLOR_ENEMY
        self.q = q; self.r = r
        self.hp = settings.ENEMY_MAX_HP
        self.max_hp = settings.ENEMY_MAX_HP
        self.debuffs = {"SPEED": 0, "BOOST": 0, "DRIFT": 0, "WEAPONS": 0}
    
    def take_damage(self, amount, log_func):
        self.hp -= amount
        if self.hp <= 0: self.hp = 0; log_func("TARGET ELIMINATED.")
        return (self.hp == 0)

class GameState:
    def __init__(self):
        self.players = []
        self.active_idx = 0
        self.enemy = Enemy(3, -1)
        self.active_target = None
        
        self.temp_val_a = 0
        self.temp_val_b = 0
        self.current_dc = 0
        self.target_q = 0.0; self.target_r = 0.0
        self.aim_q = 0.0; self.aim_r = 0.0
        
        self.phase = settings.PHASE_START
        self.state = settings.STATE_MENU
        self.phase_queue = [] 
        self.current_phase_idx = 0
        
        self.console_lines = []
        self.input_buffer = ""

        # Crew draft
        self.draft_pool = []
        self.draft_order = []
        self.draft_idx = 0
        self.phase_repeated = False
        self.winner = None
        self.start_count = 1

    @property
    def player(self):
        if not self.players: return None
        if self.active_idx >= len(self.players): self.active_idx = 0
        return self.players[self.active_idx]

    def log(self, text):
        prefix = ""
        if self.player and self.state != settings.STATE_MENU:
            prefix = f"[P{self.player.pid}] "
        self.console_lines.append(prefix + text)
        if len(self.console_lines) > 9: self.console_lines.pop(0)

    def init_players(self, count):
        self.players = []
        spawns = []
        if count == 1: spawns = [(0,0)]
        elif count == 2: spawns = [(0, -5), (0, 5)] 
        elif count == 3: spawns = [(0, -5), (5, 0), (-5, 5)] 
        else: spawns = [(0, -5), (5, -5), (0, 5), (-5, 0)] 

        colors = [(200,200,200), (100,200,255), (255,200,100), (100,255,100)]
        
        for i in range(count):
            q, r = spawns[i % len(spawns)]
            p = Player(i+1, q, r, colors[i % len(colors)])
            if r < -2: p.orientation = 3 
            elif r > 2: p.orientation = 0 
            elif q > 2: p.orientation = 4 
            elif q < -2: p.orientation = 1 
            self.players.append(p)
        self.active_idx = 0
        # The training dummy only exists in solo play
        if count > 1: self.enemy.hp = 0

    # --- CREW DRAFT ---
    def start_draft(self):
        self.draft_pool = list(crewmod.ROSTER)
        self.draft_order = crewmod.draft_order(len(self.players))
        self.draft_idx = 0
        self.active_idx = self.draft_order[0]
        self.state = settings.STATE_DRAFT
        self.phase = settings.PHASE_START

    @property
    def drafting_player(self):
        if self.draft_idx >= len(self.draft_order): return None
        return self.players[self.draft_order[self.draft_idx]]

    def draft_pick(self, pool_idx):
        """Returns True when the draft is complete."""
        p = self.drafting_player
        cdef = self.draft_pool.pop(pool_idx)
        crewmod.on_recruit(p, cdef)
        self.log(f"P{p.pid} RECRUITS {cdef.name} ({cdef.role})")
        self.draft_idx += 1
        if self.draft_idx >= len(self.draft_order):
            self.active_idx = 0
            return True
        self.active_idx = self.draft_order[self.draft_idx]
        return False

    def next_turn(self, increment=True):
        """Sets up the state for the next player."""
        if not self.players: return 
        
        if increment and self.player:
            crewmod.on_turn_end(self.player)

        if increment:
            self.active_idx = (self.active_idx + 1) % len(self.players)
        else:
            # If we don't increment, we just ensure the current index is valid
            # (used when the previous active player died and was removed)
            if self.active_idx >= len(self.players):
                self.active_idx = 0
        
        p = self.player
        if not p: return 
        
        # Reset Flags
        p.has_targeted = False; p.has_reloaded = False
        p.has_fired = False; p.drift_success = False
        p.target_locked = False; p.selected_debuff = None
        crewmod.on_turn_start(p)
        self.phase_repeated = False
        
        self.phase = settings.PHASE_CMD
        self.state = settings.STATE_CMD_INPUT
        self.phase_queue = []
        self.current_phase_idx = 0
        self.active_target = None
        
        self.log(f"--- TURN START: PLAYER {p.pid} ---")
        if p.jammed: self.log("!! COMMS JAMMED: ONLY 2 PHASES !!")
        p.check_system_integrity(self.log)

    @property
    def phases_allowed(self):
        p = self.player
        return 2 if (p and p.jammed) else 3

    def eliminate_dead_players(self):
        """Removes 0 HP players. Returns True if the ACTIVE player died."""
        if not self.players: return False
        
        current_pid = self.player.pid if self.player else -1
        survivors = []
        active_died = False
        
        for p in self.players:
            if p.hp > 0:
                survivors.append(p)
            else:
                self.log(f"PLAYER {p.pid} REMOVED FROM PLAY.")
                if p.pid == current_pid:
                    active_died = True
        
        self.players = survivors
        
        # Fix index if we removed someone before the current player
        if not active_died and survivors:
            # Re-find the active player to sync index
            for i, p in enumerate(self.players):
                if p.pid == current_pid:
                    self.active_idx = i
                    break
        
        return active_died
