# mechanics.py
import math
import settings

# 6 Directions
DIR_VECTORS = [(0, -1), (1, -1), (1, 0), (0, 1), (-1, 1), (-1, 0)]
INPUT_DIR_MAP = {"N": 0, "NO": 1, "NE": 1, "SO": 2, "SE": 2, "S": 3, "SW": 4, "NW": 5}

def hex_to_pixel(q, r, center_x, center_y, size):
    x = size * (math.sqrt(3) * q + math.sqrt(3)/2 * r)
    y = size * (3/2 * r)
    return (x + center_x, y + center_y)

def hex_neighbor(q, r, direction):
    dq, dr = DIR_VECTORS[direction % 6]
    return q + dq, r + dr

def hex_distance(q, r):
    return (abs(q) + abs(q + r) + abs(r)) / 2

def hex_round(q, r):
    x = q
    z = r
    y = -x - z
    rx = round(x)
    ry = round(y)
    rz = round(z)
    x_diff = abs(rx - x)
    y_diff = abs(ry - y)
    z_diff = abs(rz - z)
    if x_diff > y_diff and x_diff > z_diff: rx = -ry - rz
    elif y_diff > z_diff: ry = -rx - rz
    else: rz = -rx - ry
    return int(rx), int(rz)

# --- CRITICAL MISSING FUNCTION RESTORED ---
def get_hull_penalty(current_hp, max_hp):
    """Calculates penalty based on hull damage thresholds."""
    if max_hp <= 0: return 0
    pct = current_hp / max_hp
    if pct < settings.HP_THRESHOLD_FAIL: # < 20%
        return -1
    return 0
# ------------------------------------------

# --- WORLD GEN ---
def get_noise_val(q, r, scale, seed_offset):
    sq = q / scale
    sr = r / scale
    dot = sq * 12.9898 + sr * 78.233 + seed_offset
    val = math.sin(dot) * 43758.5453
    return abs(val - int(val))

def get_obstacle_type(q, r):
    if q == 0 and r == 0: return 0 
    noise_base = get_noise_val(q, r, settings.WORLD_SCALE, 0.123) 
    noise_detail = get_noise_val(q, r, 1.5, 9.876)                
    combined = noise_base * 0.7 + noise_detail * 0.3
    if combined > settings.WORLD_THRESHOLD:
        biome_noise = get_noise_val(q, r, 15.0, 42.1337)
        if biome_noise < 0.33: return 1 
        elif biome_noise < 0.66: return 2 
        else: return 3 
    return 0

def is_obstacle(q, r):
    return get_obstacle_type(q, r) > 0

# --- NAVIGATION MATH ---

def get_angle_difficulty(current_dir, target_q, target_r, ship_abs_q, ship_abs_r):
    abs_target_q = ship_abs_q + target_q
    abs_target_r = ship_abs_r + target_r
    
    if is_obstacle(abs_target_q, abs_target_r): return 0, False 
    
    side, speed = get_relative_info(target_q, target_r, current_dir)
    
    if side is None: return 0, True 
    
    abs_side = abs(side)
    dist = speed + 1
    
    if dist == 0: return 0, True

    deviation = abs_side / dist 
    
    if deviation < 0.5: return 0, True    
    if deviation <= 1.0: return settings.DC_MOD_EASY, True 
    if deviation <= 1.5: return settings.DC_MOD_HARD, True 
    return 0, False 

def rotate_pt(px, py, angle, center_x, center_y):
    nx = px * math.cos(angle) - py * math.sin(angle)
    ny = px * math.sin(angle) + py * math.cos(angle)
    return nx + center_x, ny + center_y

def get_ring_coords_list(radius):
    if radius == 0: return [(0,0)]
    q = DIR_VECTORS[4][0] * radius
    r = DIR_VECTORS[4][1] * radius
    results = []
    for i in range(6):
        for _ in range(radius):
            results.append((q, r))
            q, r = hex_neighbor(q, r, i)
    return results

def nav_to_coords(ship_dir, side, speed):
    dist = speed + 1
    ring = get_ring_coords_list(dist)
    front_q = DIR_VECTORS[ship_dir][0] * dist
    front_r = DIR_VECTORS[ship_dir][1] * dist
    try: start_idx = ring.index((front_q, front_r))
    except ValueError: return 0, 0
    target_idx = (start_idx + side) % len(ring)
    return ring[target_idx]

def get_relative_info(q, r, ship_dir):
    dist = int(hex_distance(q, r))
    if dist == 0: return 0, -1
    speed = dist - 1
    ring = get_ring_coords_list(dist)
    front_q = DIR_VECTORS[ship_dir][0] * dist
    front_r = DIR_VECTORS[ship_dir][1] * dist
    if (q, r) not in ring: return None, None
    try:
        start_idx = ring.index((front_q, front_r))
        target_idx = ring.index((q, r))
    except ValueError: return None, None
    diff = target_idx - start_idx
    ring_len = len(ring)
    if diff > ring_len / 2: diff -= ring_len
    elif diff < -ring_len / 2: diff += ring_len
    return diff, speed
