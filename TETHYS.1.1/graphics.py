# graphics.py
import pygame
import math
import random
import settings
import mechanics
from ui import UIManager

class Renderer:
    def __init__(self, screen):
        self.screen = screen
        self.global_rotation = math.radians(30)
        self.font_title = pygame.font.SysFont("Courier New", 60, bold=True)
        self.font_sub = pygame.font.SysFont("Courier New", 30, bold=True)
        
        self.particles = []
        self.game_view_h = settings.HEIGHT - 280
        self.wind_time = 0.0
        
        self.ui_manager = UIManager(screen)
        
        for _ in range(settings.PARTICLE_COUNT):
            self.particles.append(self._create_particle())

    def _create_particle(self):
        return {
            "x": random.randint(0, settings.WIDTH),
            "y": random.randint(0, settings.HEIGHT), 
            "speed": random.uniform(2.0, 5.0),
            "size": 1,
            "color": random.choice([settings.COLOR_DUST_1, settings.COLOR_DUST_2, settings.COLOR_DUST_3])
        }

    def _update_dust(self, is_moving):
        self.wind_time += 0.005
        base_gust = math.sin(self.wind_time) * 0.2        
        micro_gust = math.sin(self.wind_time * 5.0) * 0.05 
        wind_factor = 1.5 + base_gust + micro_gust
        
        dx_base = math.cos(math.radians(45))
        dy_base = math.sin(math.radians(45))
        
        current_speed_mod = (30.0 if is_moving else wind_factor)

        for p in self.particles:
            p["x"] += dx_base * p["speed"] * current_speed_mod
            p["y"] += dy_base * p["speed"] * current_speed_mod
            
            if p["x"] > settings.WIDTH: p["x"] = -10; p["y"] = random.randint(0, settings.HEIGHT)
            if p["y"] > settings.HEIGHT: p["y"] = -10; p["x"] = random.randint(0, settings.WIDTH)

    def _draw_dust(self):
        for p in self.particles:
            pygame.draw.circle(self.screen, p["color"], (int(p["x"]), int(p["y"])), p["size"])

    def _rotate_view(self, x, y, cx, cy):
        tx = x - cx
        ty = y - cy
        rx = tx * math.cos(self.global_rotation) - ty * math.sin(self.global_rotation)
        ry = tx * math.sin(self.global_rotation) + ty * math.cos(self.global_rotation)
        return rx + cx, ry + cy

    def draw_game(self, game_state):
        self.screen.fill(settings.COLOR_BG)
        
        is_moving = (game_state.state == settings.STATE_MOVING)
        self._update_dust(is_moving)
        
        if game_state.state == settings.STATE_MENU:
            self._draw_menu(game_state)
        elif game_state.state == settings.STATE_GAME_OVER:
            self._draw_game_over(game_state)
        else:
            self._draw_main_view(game_state)
            self._draw_dust()
            self.ui_manager.draw(game_state, self)
            
        pygame.display.flip()

    def _draw_menu(self, gs):
        self._draw_dust()
        cx, cy = settings.WIDTH // 2, settings.HEIGHT // 2
        title = self.font_title.render("THETIS: DESERT DRIFTER", True, settings.COLOR_PHASE_ENG)
        sub = self.font_sub.render("SAND & CHROMIUM", True, settings.COLOR_PHASE_NAV)
        self.screen.blit(title, (cx - title.get_width()//2, cy - 100))
        self.screen.blit(sub, (cx - sub.get_width()//2, cy - 40))
        
        pygame.draw.rect(self.screen, (20,20,30), (cx - 150, cy + 50, 300, 50))
        pygame.draw.rect(self.screen, settings.COLOR_UI_BORDER, (cx - 150, cy + 50, 300, 50), 2)
        
        prompt = self.ui_manager.font.render("PLAYERS [1-4]:", True, (200,200,200))
        inp = self.ui_manager.font.render(gs.input_buffer + "_", True, (255,255,255))
        self.screen.blit(prompt, (cx - 130, cy + 65))
        self.screen.blit(inp, (cx + 30, cy + 65))

    def _draw_game_over(self, gs):
        self._draw_dust()
        cx, cy = settings.WIDTH // 2, settings.HEIGHT // 2
        
        # Dark overlay
        overlay = pygame.Surface((settings.WIDTH, settings.HEIGHT))
        overlay.set_alpha(150)
        overlay.fill((0, 0, 0))
        self.screen.blit(overlay, (0,0))
        
        title = self.font_title.render("CRITICAL FAILURE", True, (255, 0, 0))
        sub = self.font_sub.render(f"PLAYER {gs.player.pid} SHIP LOST", True, (200, 200, 200))
        
        self.screen.blit(title, (cx - title.get_width()//2, cy - 50))
        self.screen.blit(sub, (cx - sub.get_width()//2, cy + 20))

    def _draw_ship_shape(self, cx, cy, orientation, color, is_active=False):
        angle_rad = math.radians(orientation * 60 - 90)
        
        pts_local = [(30, 0), (-18, -14), (-12, 0), (-18, 14)]
        final_poly = [mechanics.rotate_pt(x, y, angle_rad, cx, cy) for x, y in pts_local]
        
        thrust_poly = [mechanics.rotate_pt(x, y, angle_rad, cx, cy) for x, y in [(-12,0), (-22, -5), (-22, 5)]]
        
        pygame.draw.polygon(self.screen, settings.COLOR_THRUSTER, thrust_poly) 
        pygame.draw.polygon(self.screen, color, final_poly)
        pygame.draw.polygon(self.screen, settings.COLOR_SHIP_OUTLINE if not is_active else (255,255,255), final_poly, 2)
        
        cp = mechanics.rotate_pt(8, 0, angle_rad, cx, cy)
        pygame.draw.circle(self.screen, (0, 0, 0), (int(cp[0]), int(cp[1])), 4)

    def _draw_main_view(self, gs):
        if not gs.player: return 
        
        curr_q, curr_r = round(gs.player.q), round(gs.player.r)
        
        ship_px_raw, ship_py_raw = mechanics.hex_to_pixel(gs.player.q, gs.player.r, 0, 0, settings.HEX_SIZE_MAIN)
        curr_px_raw, curr_py_raw = mechanics.hex_to_pixel(curr_q, curr_r, 0, 0, settings.HEX_SIZE_MAIN)
        off_x = ship_px_raw - curr_px_raw; off_y = ship_py_raw - curr_py_raw
        
        cx, cy = settings.WIDTH // 2, (settings.HEIGHT - 280) // 2 

        draw_rad = settings.VIEW_RADIUS + 1
        for q in range(-draw_rad, draw_rad + 1):
            for r in range(-draw_rad, draw_rad + 1):
                if mechanics.hex_distance(q, r) <= draw_rad: 
                    raw_x, raw_y = mechanics.hex_to_pixel(q, r, cx, cy, settings.HEX_SIZE_MAIN)
                    raw_x -= off_x; raw_y -= off_y
                    dx, dy = self._rotate_view(raw_x, raw_y, cx, cy)
                    points = []
                    for i in range(6):
                        angle = math.radians(60 * i + 60)
                        points.append((dx + settings.HEX_SIZE_MAIN * math.cos(angle), dy + settings.HEX_SIZE_MAIN * math.sin(angle)))
                    world_q, world_r = curr_q + q, curr_r + r
                    
                    obs_type = mechanics.get_obstacle_type(world_q, world_r)
                    col, border_col = None, None
                    if obs_type > 0:
                        if obs_type == 1: col, border_col = settings.COLOR_OBS_1_A, settings.COLOR_OBS_1_B
                        elif obs_type == 2: col, border_col = settings.COLOR_OBS_2_A, settings.COLOR_OBS_2_B
                        elif obs_type == 3: col, border_col = settings.COLOR_OBS_3_A, settings.COLOR_OBS_3_B
                    else:
                        if (world_q + world_r) % 2 == 0: base_col = settings.COLOR_SAND_A
                        else: base_col = settings.COLOR_SAND_B
                        
                        dist = mechanics.hex_distance(q, r)
                        if dist > settings.MOVE_RADIUS + 2:
                            factor = min(1.0, (dist - (settings.MOVE_RADIUS+2)) / 5.0)
                            col = tuple(int(base_col[i] * (1-factor) + settings.COLOR_BG[i] * factor) for i in range(3))
                        else:
                            col = base_col
                        border_col = (100, 100, 120)
                        
                    pygame.draw.polygon(self.screen, col, points)
                    pygame.draw.polygon(self.screen, border_col, points, 1)

                    if len(gs.players) == 1 and gs.enemy.hp > 0:
                        rel_e_q = gs.enemy.q - curr_q
                        rel_e_r = gs.enemy.r - curr_r
                        if q == rel_e_q and r == rel_e_r:
                            self._draw_enemy(dx, dy)
                    
                    for p in gs.players:
                        if p == gs.player: continue 
                        rel_p_q = round(p.q) - curr_q
                        rel_p_r = round(p.r) - curr_r
                        if q == rel_p_q and r == rel_p_r:
                             self._draw_ship_shape(dx, dy, p.orientation, p.color, False)
                             
                    marker_states = [settings.STATE_INPUT_BOOST, settings.STATE_INPUT_DRIFT, settings.STATE_MOVING]
                    if gs.state in marker_states:
                        target_rel_q = gs.aim_q - curr_q
                        target_rel_r = gs.aim_r - curr_r
                        if q == target_rel_q and r == target_rel_r:
                             mc = settings.COLOR_TARGET_MARKER
                             l = 10
                             pygame.draw.line(self.screen, mc, (dx-l, dy-l), (dx+l, dy+l), 3)
                             pygame.draw.line(self.screen, mc, (dx+l, dy-l), (dx-l, dy+l), 3)

        self._draw_ship_shape(cx, cy, gs.player.orientation, gs.player.color, True)

    def _draw_enemy(self, x, y):
        col = settings.COLOR_ENEMY
        rot = pygame.time.get_ticks() / 500.0
        pts_local = [(0, -20), (15, 0), (0, 20), (-15, 0)]
        pts_world = []
        for lx, ly in pts_local:
            rx = lx * math.cos(rot) - ly * math.sin(rot)
            ry = lx * math.sin(rot) + ly * math.cos(rot)
            pts_world.append((x + rx, y + ry))
        pygame.draw.polygon(self.screen, col, pts_world)
        pygame.draw.polygon(self.screen, (50, 0, 0), pts_world, 2)
