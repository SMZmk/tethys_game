# main.py
import pygame
import random
import settings
import mechanics
import traceback
from graphics import Renderer
from gamestate import GameState, Player, Enemy

# --- CONTROLLER LOGIC ---

def reset_current_phase(gs):
    """C Button: Resets the current phase to its beginning."""
    if not gs.phase_queue: return
    current_p = gs.phase_queue[gs.current_phase_idx]
    gs.log(">>> ACTION CANCELLED. RESETTING PHASE.")
    start_phase(gs, current_p)

def advance_phase(gs):
    """X Button: Confirms and moves to next phase."""
    if not gs.phase_queue: return
    gs.current_phase_idx += 1
    if gs.current_phase_idx < len(gs.phase_queue):
        start_phase(gs, gs.phase_queue[gs.current_phase_idx])
    else:
        gs.next_turn()
        gs.log("ENTER PHASE 1: [NAV, ATK, ENG]")

def check_deaths(gs):
    """Checks for 0 HP ships and removes them."""
    active_died = gs.eliminate_dead_players()
    
    if len(gs.players) == 0:
        gs.state = settings.STATE_GAME_OVER
        gs.log("FATAL: ALL SHIPS DESTROYED.")
        return
    
    if active_died:
        gs.log("ACTIVE SHIP DESTROYED. COMMAND TRANSFER.")
        # We pass increment=False because the next player 'slid' into our index
        gs.next_turn(increment=False)

def start_phase(gs, phase_id):
    gs.phase = phase_id
    if phase_id == settings.PHASE_NAV:
        gs.state = settings.STATE_NAV_SPEED
        gs.log("--- NAV PHASE ---")
        gs.log("ENTER SPEED (1-3)")
    elif phase_id == settings.PHASE_COM:
        gs.state = settings.STATE_COM_SELECT_DIST
        gs.active_target = None 
        gs.log("--- COMBAT PHASE ---")
        gs.log("ACQUIRE TARGET (1-3) OR [R]ELOAD")
    elif phase_id == settings.PHASE_ENG:
        gs.state = settings.STATE_ENG_ACTION
        gs.log("--- ENGINEERING ---")
        gs.log("ADJUST POWER OR [REPAIR]")

# --- PHASE HANDLERS ---

def handle_menu(gs, cmd):
    try:
        val = int(cmd)
    except ValueError:
        gs.input_buffer = ""
        return

    if 1 <= val <= 4:
        try:
            gs.init_players(val)
            gs.phase = settings.PHASE_CMD
            gs.state = settings.STATE_CMD_INPUT
            gs.log("SYSTEMS ONLINE.")
            gs.log(f"PLAYER 1 START.")
            gs.log("ENTER PHASE 1: [NAV, ATK, ENG]")
        except Exception:
            print("!!! ERROR STARTING GAME !!!")
            traceback.print_exc()
    else:
        gs.input_buffer = ""

def handle_command(gs, cmd):
    if cmd in settings.PHASE_MAP:
        sel = settings.PHASE_MAP[cmd]
        if sel in gs.phase_queue:
            gs.log("PHASE ALREADY ASSIGNED!")
        else:
            gs.phase_queue.append(sel)
            if len(gs.phase_queue) == 3:
                gs.log("SEQUENCE LOCKED. EXECUTING...")
                gs.current_phase_idx = 0
                start_phase(gs, gs.phase_queue[0])
            else:
                gs.log(f"PHASE {len(gs.phase_queue)} SET. NEXT?")
    else:
        gs.log("INVALID. USE: NAV, ATK, ENG")

def handle_nav(gs, cmd):
    p = gs.player
    if gs.state == settings.STATE_NAV_SPEED:
        try:
            val = int(cmd)
            if 1 <= val <= 3:
                gs.temp_val_a = val - 1 
                gs.log(f"SPEED {val}. ENTER TURN (-3 TO +3)")
                gs.state = settings.STATE_NAV_SIDE
            else: gs.log("!! 1-3 !!")
        except: gs.log("!! NUMBER !!")

    elif gs.state == settings.STATE_NAV_SIDE:
        try:
            side = int(cmd)
            if abs(side) <= 3:
                gs.temp_val_b = side 
                
                eng_pen = p.debuffs["SPEED"]
                eff_engine = max(0, p.sys_engine - eng_pen)
                
                base_dist = gs.temp_val_a + 1
                eng_bonus = eff_engine * settings.ENG_DIST_BONUS
                total_dist = base_dist + eng_bonus
                
                rel_q, rel_r = mechanics.nav_to_coords(p.orientation, side, total_dist-1)
                mod, possible = mechanics.get_angle_difficulty(p.orientation, rel_q, rel_r, p.q, p.r)
                
                if not possible:
                    gs.log("!! ANGLE TOO STEEP !! RE-ENTER SPEED")
                    gs.state = settings.STATE_NAV_SPEED
                else:
                    base_dc = settings.DC_BASE + int(total_dist) + mod
                    eng_fac = 1.0 + (eff_engine * settings.ENG_DC_MULT)
                    gs.current_dc = int(base_dc * eng_fac)
                    
                    gs.target_q = p.q + rel_q
                    gs.target_r = p.r + rel_r
                    gs.aim_q = gs.target_q; gs.aim_r = gs.target_r
                    
                    log_str = f"CALC DC: {gs.current_dc}"
                    if eng_pen > 0: log_str += f" (ENG PENALTY -{eng_pen})"
                    gs.log(log_str + ". BOOST ROLL [1-20/A]")
                    gs.state = settings.STATE_INPUT_BOOST
            else: gs.log("!! -3 TO +3 !!")
        except: gs.log("!! NUMBER !!")

    elif gs.state == settings.STATE_INPUT_BOOST:
        try:
            roll = random.randint(1,20) if cmd=="A" else int(cmd)
            h_pen = mechanics.get_hull_penalty(p.hp, p.max_hp)
            d_pen = p.debuffs["BOOST"]
            total = roll + p.sys_boost + h_pen - d_pen
            
            log_str = f"BOOST: {roll} +{p.sys_boost}sys"
            if h_pen != 0: log_str += f" {h_pen}hull"
            if d_pen > 0:  log_str += f" -{d_pen}pen"
            log_str += f" = {total} (DC {gs.current_dc})"
            gs.log(log_str)
            
            if total >= gs.current_dc:
                gs.log("SUCCESS. INITIATING MANEUVER.")
                gs.state = settings.STATE_MOVING
            else:
                gs.log("FAIL! OVERSHOOTING +50%")
                vec_q = gs.target_q - p.q
                vec_r = gs.target_r - p.r
                dest_q = p.q + (vec_q * 1.5)
                dest_r = p.r + (vec_r * 1.5)
                gs.target_q, gs.target_r = mechanics.hex_round(dest_q, dest_r)
                gs.state = settings.STATE_MOVING
        except: gs.log("!! NUMBER/A !!")

    elif gs.state == settings.STATE_INPUT_DRIFT:
        try:
            roll = random.randint(1,20) if cmd=="A" else int(cmd)
            h_pen = mechanics.get_hull_penalty(p.hp, p.max_hp)
            d_pen = p.debuffs["DRIFT"]
            total = roll + p.sys_drift + h_pen - d_pen
            
            log_str = f"DRIFT: {roll} +{p.sys_drift}sys"
            if h_pen != 0: log_str += f" {h_pen}hull"
            if d_pen > 0:  log_str += f" -{d_pen}pen"
            log_str += f" = {total} (DC {gs.current_dc})"
            gs.log(log_str)
            
            p.drift_success = (total >= gs.current_dc)
            if p.drift_success:
                gs.log("DRIFT STABLE. SET ORIENTATION [N, NE...]")
                gs.state = settings.STATE_SELECT_ROT
            else:
                gs.log("DRIFT FAIL. SPINNING OUT.")
                p.orientation = (p.orientation + random.choice([-1, 1])) % 6
                gs.state = settings.STATE_IDLE
                gs.log("PRESS [X] TO CONFIRM/END PHASE")
        except: gs.log("!! NUMBER/A !!")

    elif gs.state == settings.STATE_SELECT_ROT:
        if cmd in mechanics.INPUT_DIR_MAP:
            p.orientation = mechanics.INPUT_DIR_MAP[cmd]
            gs.log("HEADING LOCKED.")
            gs.state = settings.STATE_IDLE
            gs.log("PRESS [X] TO CONFIRM/END PHASE")
        else: gs.log("!! N, NE, SE, S, SW, NW !!")

def handle_combat(gs, cmd):
    p = gs.player
    if gs.state == settings.STATE_COM_SELECT_DIST:
        if cmd == "R":
            if p.has_reloaded: gs.log("ALREADY RELOADED.")
            else:
                p.ammo = 1
                p.has_reloaded = True
                gs.log("RELOAD COMPLETE. PRESS [X] TO END.")
            return

        try:
            d = int(cmd)
            if 1 <= d <= 3:
                gs.temp_val_a = d - 1
                gs.log(f"RANGE {d}. ENTER BOW (-3 TO +3)")
                gs.state = settings.STATE_COM_SELECT_SIDE
            else: gs.log("!! 1-3 !!")
        except: gs.log("!! NUMBER !!")

    elif gs.state == settings.STATE_COM_SELECT_SIDE:
        try:
            s = int(cmd)
            if abs(s) <= 3:
                rel_q, rel_r = mechanics.nav_to_coords(p.orientation, s, gs.temp_val_a)
                tq = round(p.q) + rel_q
                tr = round(p.r) + rel_r
                
                found = None
                if tq == gs.enemy.q and tr == gs.enemy.r and gs.enemy.hp > 0:
                    found = gs.enemy
                else:
                    for other in gs.players:
                        if other != p and round(other.q) == tq and round(other.r) == tr:
                            found = other; break
                if found:
                    gs.active_target = found
                    name = "ENEMY" if found == gs.enemy else f"PLAYER {found.pid}"
                    gs.log(f"LOCKED ON: {name}")
                    gs.log("ACTIONS: [T]ARGET, [R]ELOAD, [F]IRE")
                    gs.state = settings.STATE_COM_MENU
                else:
                    gs.log("NO TARGET FOUND. RETRY OR [X]")
                    gs.state = settings.STATE_COM_SELECT_DIST
            else: gs.log("!! -3 TO +3 !!")
        except: gs.log("!! NUMBER !!")

    elif gs.state == settings.STATE_COM_MENU:
        if cmd.startswith("T"):
            if p.has_targeted or p.has_reloaded: gs.log("ACTION SPENT.")
            elif not p.drift_success: gs.log("DRIFT UNSTABLE: CANNOT LOCK")
            else:
                gs.log("LOCKING... ROLL [1-20/A]")
                gs.state = settings.STATE_COM_DIST
        elif cmd.startswith("R"):
            if p.has_targeted or p.has_reloaded: gs.log("ACTION SPENT.")
            else:
                p.ammo = 1
                p.has_reloaded = True
                gs.log("RELOAD COMPLETE.")
        elif cmd.startswith("F"):
            if p.has_fired: gs.log("BATTERY DRAINED.")
            elif p.ammo <= 0: gs.log("NO AMMO.")
            else:
                gs.log("FIRING MAIN GUN. ROLL [1-20/A]")
                gs.state = settings.STATE_COM_FIRE

    elif gs.state == settings.STATE_COM_DIST:
        try:
            roll = random.randint(1,20) if cmd=="A" else int(cmd)
            d_pen = p.debuffs["WEAPONS"]
            total = roll + p.sys_weapon - d_pen
            log_str = f"LOCK: {roll} +{p.sys_weapon}sys"
            if d_pen > 0: log_str += f" -{d_pen}pen"
            log_str += f" = {total} (DC {settings.TARGETING_DC})"
            gs.log(log_str)
            if total >= settings.TARGETING_DC:
                p.target_locked = True
                gs.log("LOCK CONFIRMED. SELECT DEBUFF:")
                gs.log("SPD, BST, DFT, WPN")
                gs.state = settings.STATE_COM_TARGET_DEBUFF
            else:
                gs.log("LOCK FAILED.")
                p.has_targeted = True
                gs.state = settings.STATE_COM_MENU
        except: gs.log("!! NUMBER/A !!")

    elif gs.state == settings.STATE_COM_TARGET_DEBUFF:
        valid = {"SPD":"SPEED", "BST":"BOOST", "DFT":"DRIFT", "WPN":"WEAPONS"}
        k = cmd[:3]
        if k in valid:
            p.selected_debuff = valid[k]
            p.has_targeted = True
            gs.log(f"AIMING SYSTEM: {p.selected_debuff}")
            gs.log("[F]IRE OR [C]ANCEL")
            gs.state = settings.STATE_COM_MENU
        else: gs.log("!! SPD / BST / DFT / WPN !!")

    elif gs.state == settings.STATE_COM_FIRE:
        try:
            roll = random.randint(1,20) if cmd=="A" else int(cmd)
            ac = settings.ENEMY_BASE_AC
            d = mechanics.hex_distance(gs.active_target.q - p.q, gs.active_target.r - p.r)
            if 0 < d <= 3: ac += settings.AC_DIST_BONUS[int(d)-1]
            bonus = (4 if p.target_locked else 0) + p.sys_weapon
            h_pen = mechanics.get_hull_penalty(p.hp, p.max_hp)
            d_pen = p.debuffs["WEAPONS"]
            total = roll + bonus + h_pen - d_pen
            
            log_str = f"ATK: {roll} +{bonus}bon"
            if h_pen != 0: log_str += f" {h_pen}hull"
            if d_pen > 0:  log_str += f" -{d_pen}pen"
            log_str += f" = {total} (AC {ac})"
            gs.log(log_str)
            p.ammo -= 1; p.has_fired = True
            
            if total >= ac:
                gs.log("HIT! ROLL DAMAGE [1-6/A]")
                gs.state = settings.STATE_COM_DMG
            else:
                gs.log("SHOT MISSED.")
                p.target_locked = False
                p.selected_debuff = None
                gs.state = settings.STATE_COM_MENU
        except: gs.log("!! NUMBER/A !!")
        
    elif gs.state == settings.STATE_COM_DMG:
        try:
            base = random.randint(1,6)
            dmg_pen = p.debuffs["WEAPONS"]
            total = base + settings.PLAYER_DMG_BONUS + p.sys_weapon - dmg_pen
            if cmd != "A": total = int(cmd) 
            
            if gs.active_target:
                # Use take_damage method to prevent negative hp
                dead = gs.active_target.take_damage(total, gs.log)
                
                log_msg = f"DMG: {base}+{settings.PLAYER_DMG_BONUS}base+{p.sys_weapon}wpn"
                if dmg_pen > 0: log_msg += f"-{dmg_pen}pen"
                log_msg += f" = {total}"
                gs.log(log_msg)
                
                if p.selected_debuff:
                    gs.active_target.debuffs[p.selected_debuff] += 1
                    name = "ENEMY" if isinstance(gs.active_target, Enemy) else f"P{gs.active_target.pid}"
                    gs.log(f"CRITICAL HIT: {name} {p.selected_debuff} DOWN")
                    p.selected_debuff = None
                
                # Check Death immediately
                check_deaths(gs)
            
            p.target_locked = False
            gs.state = settings.STATE_COM_MENU
        except Exception as e: 
            gs.log("!! ERROR IN DAMAGE CALC !!")
            print(e)

def handle_eng(gs, cmd):
    p = gs.player
    parts = cmd.split()
    if cmd == "REPAIR":
        if p.spare_parts > 0:
            heal = random.randint(1,4) + 1
            p.hp = min(p.max_hp, p.hp + heal)
            p.spare_parts -= 1
            gs.log(f"REPAIRED {heal} HP. PARTS: {p.spare_parts}")
            p.check_system_integrity(gs.log)
        else: gs.log("NO SPARE PARTS.")
    elif len(parts) == 2:
        sys_map = {
            "SPEED": "sys_engine", "SPD": "sys_engine", "ENG": "sys_engine",
            "BOOST": "sys_boost", "BST": "sys_boost",
            "DRIFT": "sys_drift", "DFT": "sys_drift",
            "WEAPON": "sys_weapon", "WPN": "sys_weapon"
        }
        if parts[0] in sys_map:
            attr = sys_map[parts[0]]
            try:
                val = int(parts[1])
                curr = getattr(p, attr)
                if val == 1:
                    if p.current_energy_used < p.energy_cap:
                        if attr == "sys_engine" and curr >= 2: gs.log("ENGINE MAXED.")
                        else:
                            setattr(p, attr, curr + 1)
                            gs.log(f"{parts[0]} INCREASED.")
                    else: gs.log(f"INSUFFICIENT ENERGY (CAP {p.energy_cap})")
                elif val == -1:
                    if curr > 0:
                        setattr(p, attr, curr - 1)
                        gs.log(f"{parts[0]} DECREASED.")
            except: pass
        else: gs.log("UNKNOWN SYSTEM.")
    else: gs.log("USE: [SYS] +1/-1 OR 'REPAIR'")

# --- MAIN LOOP ---

def main():
    pygame.init()
    screen = pygame.display.set_mode((settings.WIDTH, settings.HEIGHT))
    pygame.display.set_caption("Thetis: Desert Drifter v4.6 (Permadeath)")
    clock = pygame.time.Clock()
    
    gs = GameState()
    renderer = Renderer(screen)
    running = True

    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT: running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_F4:
                    if gs.enemy.hp > 0: gs.enemy.hp=0; gs.log("DEBUG: KILL TARGET")
                    else: gs.enemy.hp=32; gs.log("DEBUG: SPAWN TARGET")

                if event.key == pygame.K_RETURN:
                    cmd = gs.input_buffer.upper().strip()
                    if cmd and gs.state != settings.STATE_MENU: gs.log(f"> {cmd}")
                    
                    if gs.state == settings.STATE_GAME_OVER:
                        pass # Lock input
                    elif gs.state == settings.STATE_MENU: handle_menu(gs, cmd)
                    elif gs.phase == settings.PHASE_CMD: handle_command(gs, cmd)
                    elif gs.phase == settings.PHASE_NAV: handle_nav(gs, cmd)
                    elif gs.phase == settings.PHASE_COM: handle_combat(gs, cmd)
                    elif gs.phase == settings.PHASE_ENG: handle_eng(gs, cmd)
                    gs.input_buffer = ""

                elif event.key == pygame.K_c:
                    if gs.state == settings.STATE_MENU: gs.input_buffer += "C"
                    else: reset_current_phase(gs)
                
                elif event.key == pygame.K_x:
                    if gs.state == settings.STATE_MENU: gs.input_buffer += "X"
                    else: advance_phase(gs)

                elif event.key == pygame.K_BACKSPACE: 
                    gs.input_buffer = gs.input_buffer[:-1]
                else: 
                    gs.input_buffer += event.unicode.upper()

        if gs.state == settings.STATE_MOVING:
            p = gs.player
            if not p: # Handle case where moving player died immediately
                gs.state = settings.STATE_IDLE
                continue

            dq = gs.target_q - p.q
            dr = gs.target_r - p.r
            if abs(dq) < 0.1 and abs(dr) < 0.1:
                p.q = gs.target_q; p.r = gs.target_r
                
                # Check Obstacles
                if mechanics.is_obstacle(p.q, p.r):
                    p.take_damage(5, gs.log)
                
                # Check Collision (Ramming)
                for other in gs.players:
                    if other.pid != p.pid:
                        if round(other.q) == round(p.q) and round(other.r) == round(p.r):
                            gs.log(f"CRITICAL: COLLISION P{p.pid} <-> P{other.pid}!")
                            p.take_damage(5, gs.log)
                            other.take_damage(5, gs.log)

                # Check Deaths BEFORE moving state change
                check_deaths(gs)
                
                # If active player died in collision, state will have changed
                if gs.player and gs.player.pid == p.pid:
                    if gs.phase == settings.PHASE_NAV:
                        gs.state = settings.STATE_INPUT_DRIFT
                        gs.log(f"DRIFT CHECK (DC {gs.current_dc}) [A]")
                    else:
                        gs.state = settings.STATE_IDLE
                        gs.log("MOVE COMPLETE. [X] TO END.")
            else:
                msp = settings.SPEED * (1.0 + p.sys_engine * 0.5)
                p.q += dq * msp
                p.r += dr * msp

        renderer.draw_game(gs)
        clock.tick(60)

    pygame.quit()

if __name__ == "__main__":
    main()
