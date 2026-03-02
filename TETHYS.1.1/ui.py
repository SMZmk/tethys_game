# ui.py
import pygame
import math
import settings
import mechanics

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
                lines = ["- Locking System", "- Roll + WPN vs DC 14"]
            elif gs.state == settings.STATE_COM_FIRE:
                lines = ["- Fire Main Battery", "- Roll + Lock + WPN"]
        elif gs.phase == settings.PHASE_ENG:
            lines = ["- Assign Energy:", "- 'SPEED 1', 'BST 1'", "- 'DFT 1', 'WPN 1'", "- Or 'REPAIR'", "- Press [C] to Finish"]

        for line in lines:
            self.screen.blit(self.font_micro.render(line, True, (200,200,200)), (px, py))
            py += 18
