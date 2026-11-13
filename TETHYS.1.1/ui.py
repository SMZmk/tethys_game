# ui.py
import pygame
import math
import settings
import mechanics
import crew as crewmod

STATION_COLORS = {"NAV": settings.COLOR_PHASE_NAV, "ATK": settings.COLOR_PHASE_COM,
                  "ENG": settings.COLOR_PHASE_ENG, "ANY": (230, 200, 60)}


def draw_portrait(screen, idx, x, y, scale=3, grey=False):
    pygame.draw.rect(screen, (16, 20, 32), (x - scale, y - scale, 14 * scale, 14 * scale))
    for px, py, col in crewmod.portrait_pixels(idx):
        if grey:
            g = sum(col) // 3 // 2
            col = (g, g, g)
        pygame.draw.rect(screen, col, (x + px * scale, y + py * scale, scale, scale))
    pygame.draw.rect(screen, (90, 110, 150), (x - scale, y - scale, 14 * scale, 14 * scale), 1)

class UIManager:
    def __init__(self, screen):
        self.screen = screen
        self.font = pygame.font.SysFont("Courier New", 18, bold=True)
        self.font_small = pygame.font.SysFont("Courier New", 14, bold=True)
        self.font_micro = pygame.font.SysFont("Arial", 11, bold=True)
        
        self.panel_height = 280
        self.panel_y = settings.HEIGHT - self.panel_height
        
        self.seg1_w = 340 
        self.seg2_w = 260 
        self.seg3_w = 240 
        self.seg4_w = settings.WIDTH - (self.seg1_w + self.seg2_w + self.seg3_w)

    def draw(self, gs, renderer_ref):
        pygame.draw.rect(self.screen, settings.COLOR_UI_BG, (0, self.panel_y, settings.WIDTH, self.panel_height))
        pygame.draw.line(self.screen, settings.COLOR_UI_BORDER, (0, self.panel_y), (settings.WIDTH, self.panel_y), 3)
        
        x_accum = 0
        for w in [self.seg1_w, self.seg2_w, self.seg3_w]:
            x_accum += w
            pygame.draw.line(self.screen, settings.COLOR_UI_BORDER, (x_accum, self.panel_y), (x_accum, settings.HEIGHT), 2)

        self._draw_terminal_segment(gs, 0, self.panel_y)
        self._draw_radar_segment(gs, renderer_ref, self.seg1_w, self.panel_y)
        self._draw_stats_segment(gs, self.seg1_w + self.seg2_w, self.panel_y)
        self._draw_guide_segment(gs, self.seg1_w + self.seg2_w + self.seg3_w, self.panel_y)
        self._draw_phase_indicator(gs)
        self._draw_crew_panel(gs)

    # --- CREW PANEL (top right of the battlefield) ---
    def _draw_crew_panel(self, gs):
        p = gs.player
        if not p or not p.crew: return
        w = 310; x = settings.WIDTH - w - 10; y = 10
        h = 30 + len(p.crew) * 52 + 22
        panel = pygame.Surface((w, h), pygame.SRCALPHA)
        panel.fill((5, 8, 15, 220))
        self.screen.blit(panel, (x, y))
        pygame.draw.rect(self.screen, p.color, (x, y, w, h), 2)
        self.screen.blit(self.font_small.render(f"P{p.pid} CREW  [USE n]", True, p.color), (x + 8, y + 6))
        cy = y + 28
        for i, c in enumerate(p.crew):
            draw_portrait(self.screen, c.d.sprite, x + 10, cy + 4, 3, grey=c.stunned)
            st_col = STATION_COLORS.get(c.d.station, (200, 200, 200))
            self.screen.blit(self.font_small.render(f"{i+1} {c.d.name}", True, (255, 255, 255)), (x + 54, cy))
            self.screen.blit(self.font_micro.render(c.d.station, True, st_col), (x + 140, cy + 2))
            status = c.status()
            s_col = settings.COLOR_TEXT_SUCCESS if status == "READY" else settings.COLOR_TEXT_ALERT
            lbl = self.font_micro.render(status, True, s_col)
            self.screen.blit(lbl, (x + w - lbl.get_width() - 8, cy + 2))
            self.screen.blit(self.font_micro.render(c.d.passive, True, (170, 200, 230)), (x + 54, cy + 17))
            self.screen.blit(self.font_micro.render(f"> {c.d.order}: {c.d.order_txt}", True, (230, 200, 120)), (x + 54, cy + 31))
            cy += 52
        flags = []
        if p.evasive: flags.append("EVASIVE")
        if p.jammed: flags.append("JAMMED")
        if p.surge: flags.append(f"SURGE +{p.surge}")
        if p.auto_boost: flags.append("AFTERBURN")
        self.screen.blit(self.font_micro.render("  ".join(flags) if flags else "", True, (255, 220, 80)), (x + 8, cy))

        # Opponents: compact crew status
        oy = y + h + 6
        for o in gs.players:
            if o is p or not o.crew: continue
            txt = f"P{o.pid}: " + " ".join(f"{c.d.name}{'*' if c.stunned else ''}" for c in o.crew)
            if o.evasive: txt += " [EVA]"
            if o.jammed: txt += " [JAM]"
            lbl = self.font_micro.render(txt, True, o.color)
            bg = pygame.Surface((w, 16), pygame.SRCALPHA); bg.fill((5, 8, 15, 200))
            self.screen.blit(bg, (x, oy)); self.screen.blit(lbl, (x + 8, oy + 2))
            oy += 18

    def draw_draft(self, gs):
        p = gs.drafting_player
        if not p: return
        title = self.font.render(f"CREW DRAFT - PLAYER {p.pid} PICKS  (TYPE NUMBER OR A)", True, p.color)
        self.screen.blit(title, (settings.WIDTH // 2 - title.get_width() // 2, 20))
        cols = 3; cw = 340; ch = 150; gx = (settings.WIDTH - cols * cw - (cols - 1) * 15) // 2
        for i, cd in enumerate(gs.draft_pool):
            cx = gx + (i % cols) * (cw + 15); cy = 60 + (i // cols) * (ch + 12)
            st_col = STATION_COLORS.get(cd.station, (200, 200, 200))
            pygame.draw.rect(self.screen, (12, 16, 28), (cx, cy, cw, ch))
            pygame.draw.rect(self.screen, st_col, (cx, cy, cw, ch), 2)
            draw_portrait(self.screen, cd.sprite, cx + 14, cy + 14, 5)
            self.screen.blit(self.font.render(f"[{i+1}] {cd.name}", True, (255, 255, 255)), (cx + 90, cy + 10))
            self.screen.blit(self.font_small.render(f"{cd.role} - {cd.station}", True, st_col), (cx + 90, cy + 34))
            self.screen.blit(self.font_micro.render("PASSIVE:", True, (120, 140, 170)), (cx + 90, cy + 58))
            self.screen.blit(self.font_micro.render(cd.passive, True, (170, 210, 240)), (cx + 90, cy + 72))
            self.screen.blit(self.font_micro.render(f"ORDER: {cd.order}", True, (230, 200, 120)), (cx + 14, cy + 96))
            self.screen.blit(self.font_micro.render(cd.order_txt, True, (230, 220, 180)), (cx + 14, cy + 112))
        # Picked so far
        by = settings.HEIGHT - 110
        for j, pl in enumerate(gs.players):
            names = ", ".join(c.d.name for c in pl.crew) or "-"
            self.screen.blit(self.font_small.render(f"P{pl.pid} CREW: {names}", True, pl.color), (40, by + j * 20))
        for k, line in enumerate(gs.console_lines[-2:]):
            self.screen.blit(self.font_micro.render(line, True, settings.COLOR_UI_TEXT), (40, by - 40 + k * 16))
        cursor = "_" if (pygame.time.get_ticks() // 500) % 2 == 0 else ""
        self.screen.blit(self.font.render(f"> {gs.input_buffer}{cursor}", True, (255, 255, 255)), (40, settings.HEIGHT - 30))

    def _draw_phase_indicator(self, gs):
        if not gs.phase_queue:
            phases = ["START", "CMD"]
            active_idx = 0 if gs.phase == settings.PHASE_START else 1
        else:
            phases = ["CMD"] + [settings.PHASE_NAMES[p] for p in gs.phase_queue]
            active_idx = gs.current_phase_idx + 1

        start_x = 20; y = 20; w = 80; h = 25
        
        for i, p_name in enumerate(phases):
            isActive = (i == active_idx)
            col = (100,100,100)
            if p_name == "NAV": col = settings.COLOR_PHASE_NAV
            elif p_name == "COM": col = settings.COLOR_PHASE_COM
            elif p_name == "ENG": col = settings.COLOR_PHASE_ENG
            
            rect = pygame.Rect(start_x + i*(w+5), y, w, h)
            if isActive:
                pygame.draw.rect(self.screen, col, rect)
                text_col = (0,0,0)
            else:
                pygame.draw.rect(self.screen, (20,20,20), rect)
                pygame.draw.rect(self.screen, col, rect, 1)
                text_col = col
            
            lbl = self.font_small.render(p_name, True, text_col)
            self.screen.blit(lbl, (rect.x + 5, rect.y + 5))

    def _draw_terminal_segment(self, gs, x, y):
        x_off = x + 20
        y_off = y + 20
        
        self.screen.blit(self.font_small.render("TERMINAL LINK >", True, settings.COLOR_UI_HEADER), (x_off, y_off))
        
        for i, line in enumerate(gs.console_lines):
            col = settings.COLOR_UI_TEXT
            if "!!" in line or "FAIL" in line or "CRITICAL" in line: col = settings.COLOR_TEXT_ALERT
            if "SUCCESS" in line or "STABLE" in line or "LOCKED" in line or "ACQUIRED" in line: col = settings.COLOR_TEXT_SUCCESS
            self.screen.blit(self.font_small.render(line, True, col), (x_off, y_off + 25 + i*18))
        
        cursor = "_" if (pygame.time.get_ticks() // 500) % 2 == 0 else ""
        inp_render = self.font.render(f"> {gs.input_buffer}{cursor}", True, (255, 255, 255))
        self.screen.blit(inp_render, (x_off, settings.HEIGHT - 30))

    def _draw_radar_segment(self, gs, renderer, x, y):
        cx = x + self.seg2_w // 2
        cy = y + self.panel_height // 2
        
        self.screen.blit(self.font_small.render("TACTICAL NAV", True, (100,150,200)), (x + 10, y + 10))

        if gs.phase == settings.PHASE_COM:
            bg_col = settings.COLOR_TAC_COM_BG; line_col = settings.COLOR_TAC_COM_LINES
        else:
            bg_col = settings.COLOR_TAC_BG; line_col = (0, 40, 80)

        pygame.draw.circle(self.screen, bg_col, (cx, cy), 100)
        pygame.draw.circle(self.screen, settings.COLOR_UI_BORDER, (cx, cy), 100, 2)
        for d in range(1, 4):
            pygame.draw.circle(self.screen, line_col, (cx, cy), int(d * settings.HEX_SIZE_HUD * 1.5), 1)

        # COMPASS
        directions = ["N", "NE", "SE", "S", "SW", "NW"]
        for i, txt in enumerate(directions):
            angle_deg = i * 60 - 90
            rad = math.radians(angle_deg)
            tx = cx + 115 * math.cos(rad)
            ty = cy + 115 * math.sin(rad)
            lbl = self.font_micro.render(txt, True, (150, 150, 150))
            self.screen.blit(lbl, (tx - lbl.get_width()//2, ty - lbl.get_height()//2))

        # Grid
        p = gs.player
        if not p: return 
        
        for q in range(-settings.MOVE_RADIUS, settings.MOVE_RADIUS + 1):
            for r in range(-settings.MOVE_RADIUS, settings.MOVE_RADIUS + 1):
                if mechanics.hex_distance(q, r) <= settings.MOVE_RADIUS:
                    raw_x, raw_y = mechanics.hex_to_pixel(q, r, cx, cy, settings.HEX_SIZE_HUD)
                    th_x, th_y = renderer._rotate_view(raw_x, raw_y, cx, cy)
                    
                    points = []
                    for i in range(6):
                        angle = math.radians(60 * i + 60)
                        points.append((th_x + settings.HEX_SIZE_HUD * math.cos(angle), th_y + settings.HEX_SIZE_HUD * math.sin(angle)))
                    
                    dist = mechanics.hex_distance(q, r)
                    col_fill = None
                    mod, possible = mechanics.get_angle_difficulty(p.orientation, q, r, p.q, p.r)
                    
                    if dist == 0: col_fill = (50, 80, 150)
                    elif mechanics.is_obstacle(p.q + q, p.r + r): col_fill = settings.COLOR_TAC_IMP
                    elif not possible: col_fill = (10, 15, 20)
                    else:
                        base_dist = dist + (p.sys_engine * settings.ENG_DIST_BONUS)
                        dc = int((settings.DC_BASE + int(base_dist) + mod) * (1.0 + p.sys_engine*settings.ENG_DC_MULT))
                        
                        if gs.phase == settings.PHASE_COM:
                            if dc <= 12: col_fill = (100, 30, 30)
                            elif dc <= 15: col_fill = (180, 50, 50)
                            else: col_fill = (255, 80, 80)
                        else:
                            if dc <= 12: col_fill = settings.COLOR_TAC_EASY
                            elif dc <= 15: col_fill = settings.COLOR_TAC_MED
                            else: col_fill = settings.COLOR_TAC_HARD

                    rel_e_q = gs.enemy.q - round(p.q)
                    rel_e_r = gs.enemy.r - round(p.r)
                    if q == rel_e_q and r == rel_e_r and gs.enemy.hp > 0:
                        col_fill = settings.COLOR_ENEMY

                    for other in gs.players:
                        if other.pid == p.pid: continue
                        rel_p_q = round(other.q) - round(p.q)
                        rel_p_r = round(other.r) - round(p.r)
                        if q == rel_p_q and r == rel_p_r:
                            col_fill = other.color

                    if col_fill:
                        pygame.draw.polygon(self.screen, col_fill, points)
                        pygame.draw.polygon(self.screen, (40,0,0) if gs.phase == settings.PHASE_COM else (0,20,40), points, 1)

                    if dist > 0:
                        side, _ = mechanics.get_relative_info(q, r, p.orientation)
                        txt = "X" if mechanics.is_obstacle(p.q+q, p.r+r) else f"{side:+d}"
                        self.screen.blit(self.font_micro.render(txt, True, (200,255,255)), (th_x-5, th_y-5))
                    
                    if q == rel_e_q and r == rel_e_r and p.target_locked and gs.enemy.hp > 0:
                         pygame.draw.polygon(self.screen, settings.COLOR_LOCK_MARKER, points, 2)

        mini_ship_angle = math.radians(p.orientation * 60 - 90)
        ms_poly = [mechanics.rotate_pt(x, y, mini_ship_angle, cx, cy) for x, y in [(10,0), (-6,-5), (-4,0), (-6,5)]]
        pygame.draw.polygon(self.screen, (255, 255, 255), ms_poly)

    def _draw_stats_segment(self, gs, x, y):
        p = gs.player
        if not p: return

        px = x + 20
        py = y + 20
        
        self.screen.blit(self.font_small.render("SHIP STATUS", True, settings.COLOR_UI_HEADER), (px, py))
        
        py += 30
        bar_w = 180; hp_pct = p.hp / p.max_hp
        pygame.draw.rect(self.screen, (50,0,0), (px, py, bar_w, 15))
        col_hp = settings.COLOR_HP_BAR if hp_pct > 0.3 else settings.COLOR_HP_LOW
        pygame.draw.rect(self.screen, col_hp, (px, py, bar_w*hp_pct, 15))
        pygame.draw.rect(self.screen, settings.COLOR_UI_BORDER, (px, py, bar_w, 15), 1)
        self.screen.blit(self.font_micro.render(f"HULL: {int(hp_pct*100)}%", True, (255,255,255)), (px+5, py+1))

        py += 25
        self.screen.blit(self.font_micro.render(f"AMMO:  {p.ammo}", True, (255,200,100)), (px, py))
        self.screen.blit(self.font_micro.render(f"PARTS: {p.spare_parts}", True, (200,200,200)), (px+100, py))
        
        py += 25
        # Use property current_energy_used and energy_cap
        col_pwr = (100,200,255) if p.current_energy_used < p.energy_cap else (255,50,50)
        self.screen.blit(self.font_small.render(f"ENERGY: {p.current_energy_used}/{p.energy_cap}", True, col_pwr), (px, py))
        
        py += 25
        # Updated Subsystem names
        self.screen.blit(self.font_micro.render(f"ENG: +{p.sys_engine}", True, (200,200,200)), (px, py))
        self.screen.blit(self.font_micro.render(f"BST: +{p.sys_boost}", True, (200,200,200)), (px+80, py))
        py += 15
        self.screen.blit(self.font_micro.render(f"DFT: +{p.sys_drift}", True, (200,200,200)), (px, py))
        self.screen.blit(self.font_micro.render(f"WPN: +{p.sys_weapon}", True, (200,200,200)), (px+80, py))

        py += 30
        # PENALTIES
        has_debuffs = any(v > 0 for v in p.debuffs.values())
        if has_debuffs:
            t = "SYSTEM DAMAGE: "
            for k, v in p.debuffs.items():
                if v > 0: t += f"{k[:3]} -{v} "
            self.screen.blit(self.font_micro.render(t, True, settings.COLOR_TEXT_ALERT), (px, py))
        else:
            if gs.phase == settings.PHASE_COM:
                status = "LOCKED" if p.target_locked else "SCANNING"
                if not p.drift_success: status = "DRIFT FAIL"
                col = settings.COLOR_TEXT_SUCCESS if p.target_locked else (150,150,150)
                self.screen.blit(self.font_small.render(f"FCS: {status}", True, col), (px, py))
            else:
                 self.screen.blit(self.font_micro.render("SYSTEMS NOMINAL", True, (100,150,100)), (px, py))

    def _draw_guide_segment(self, gs, x, y):
        px = x + 20
        py = y + 20
        
        phase_name = settings.PHASE_NAMES.get(gs.phase, "INIT")
        col_h = settings.COLOR_UI_HEADER
        if gs.phase == settings.PHASE_NAV: col_h = settings.COLOR_PHASE_NAV
        elif gs.phase == settings.PHASE_COM: col_h = settings.COLOR_PHASE_COM
        elif gs.phase == settings.PHASE_ENG: col_h = settings.COLOR_PHASE_ENG
        
        self.screen.blit(self.font_small.render(f"PROTOCOL: {phase_name}", True, col_h), (px, py))
        
        py += 30
        lines = []
        
        if gs.phase == settings.PHASE_CMD:
            lines = ["- Establish Sequence", "- Input: NAV, ATK, ENG", "- Example: 'NAV' [Enter]"]
        elif gs.phase == settings.PHASE_NAV:
            if gs.state == settings.STATE_NAV_SPEED:
                lines = ["- Input Speed (1-3)"]
            elif gs.state == settings.STATE_NAV_SIDE:
                lines = ["- Input Bow (-3 to +3)", "- Use Radar"]
            elif gs.state == settings.STATE_INPUT_BOOST:
                lines = ["- Engine Boost Roll", "- 1d20 + BST vs DC"]
            elif gs.state == settings.STATE_INPUT_DRIFT:
                lines = ["- Stabilize Drift", "- 1d20 + DFT vs DC"]
        elif gs.phase == settings.PHASE_COM:
            if gs.state == settings.STATE_COM_SELECT_DIST:
                lines = ["- TARGET ACQUISITION", "- Input Target Distance (1-3)", "- See Radar Rings"]
            elif gs.state == settings.STATE_COM_SELECT_SIDE:
                lines = ["- TARGET ACQUISITION", "- Input Target Bow (-3 to +3)", "- See Radar Numbers"]
            elif gs.state == settings.STATE_COM_MENU:
                lines = ["- [T]arget (Lock On)", "- [R]eload", "- [F]ire (Attack)"]
            elif gs.state == settings.STATE_COM_DIST:
                lines = ["- Locking System", f"- Roll + WPN vs DC {settings.TARGETING_DC}"]
            elif gs.state == settings.STATE_COM_TARGET_DEBUFF:
                lines = ["- Pick system to cripple:", "- SPD BST DFT WPN", "- STN = stun enemy crew"]
            elif gs.state == settings.STATE_COM_FIRE:
                lines = ["- Fire Main Battery", "- Roll + Lock + WPN"]
        elif gs.phase == settings.PHASE_ENG:
            lines = ["- Assign Energy:", "- 'SPEED 1', 'BST 1'", "- 'DFT 1', 'WPN 1'", "- Or 'REPAIR'", "- Press [X] to Finish"]

        # Crew orders available in this phase
        p = gs.player
        ph = {settings.PHASE_NAV: "NAV", settings.PHASE_COM: "ATK", settings.PHASE_ENG: "ENG"}.get(gs.phase)
        if p and ph:
            avail = [f"USE {i+1}: {c.d.order}" for i, c in enumerate(p.crew)
                     if c.ready and c.d.station in (ph, "ANY")]
            if avail: lines = lines + ["CREW ORDERS:"] + avail

        for line in lines:
            self.screen.blit(self.font_micro.render(line, True, (200,200,200)), (px, py))
            py += 18
