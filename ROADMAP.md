# Tethys Roadmap

Design notes for the browser game (`web/`). "Done" items are in the game; the rest is planned.

## Faction identity (done)

| | Scrappers (Machine) | Nomads (Heart) | Drifters (Wind) |
|---|---|---|---|
| Lore | Aggressive and ruthless. The ship is the living body; mercy is for the weak. | In the middle. At their best when the wind is right and crew and ship work as one. | Flying and fighting is what they are born to. |
| Perk | +1 damage on hits | After a stable drift: +1 to all rolls that turn | +1 to boost and drift rolls |
| Epic orders | Only in a turn where you **hit** the enemy | Only in a turn with a **stable drift** | None: every order can be used after **one turn** of rest |
| Normal rest | 2 turns | 2 turns | 1 turn |
| Won't sail | Construct (relic) | — | Hauler (fortress) |

Epic orders (no lock-on needed for the Scrapper ones):
- Scrappers: **VOSS, Knock Them Down!** (after a hit, stun a random enemy crew member) and **GRIT, Chain Shot**
  (after a hit, d6: 1 speed, 2 boost, 3 drift, 4 weapons −1; 5–6 *fire in the engines*: the enemy loses NAV or ENG
  on its next turn, d6 1–3 NAV, 4–6 ENG).
- Nomads: **RHO, Battle Stations** (repeat this phase), **FENN, Sandstorm** (enemy −2 to all rolls next turn), **ANA, Patch Up** (heal 3).
- Drifters: **SELA, Song of the Wind** is a *passive* epic: below half hull, engine power no longer raises the DC
  and boost rolls get +2. Lore: a wounded Drifter shakes off pursuers, especially in difficult terrain.
  SELA also keeps her first passive: a failed drift still lets her ship set its heading.

Crew rules: at most **one captain** per crew (VOSS, RHO or SELA).

Other changes made with this:
- **ZED, Jam Weapons** affects only the enemy's weapons: −2 to their lock and attack rolls on their next turn (it no longer removes a phase).
- Dreadnought: hull 17; twin guns roll to hit twice per shot, each hit half damage: steadier, fewer clean misses.
- Online play: the map stays visible while you wait for your opponent.

Why: the "Nomad sustain" build (RHO, FENN, ANA, DOV) won 77% against random builds. With epic orders tied
to a stable drift it wins 60–61%, in line with good builds of the other factions (48–63%).
Computer against computer, the factions win 44–56% against each other (before 40–62%).

## Faction looks (done)
- Nomads: wastelanders. Leather jackets, sunglasses, cowboy hats, bandanas.
- Scrappers: helmets, smoke, painted faces, piercings.
- Drifters: bedouin-like wraps and scarves. They don't whistle: mouth amplifiers make deep, subwoofer-like bass
  that travels against the wind. The story text uses this.

## Ship looks (done)
- Skiff: small regatta catamaran with a wing sail. Hauler: big Chinese junk with sails and two smokestacks.
  Dreadnought: war junk with sails and a smokestack. Construct: small manta ray. All hover over the dune sea
  (shadow, glow) on ski-like flukes: one under the middle, two at the sides for the Hauler.
- Heading is always visible: a bow arrow in the player's colour. Large side views on the ship choice.
- Colours: desert browns and oranges with small contrasts. Scrappers rust, Nomads colourful, Drifters sand and beige.

## Planned next (decided, not built yet)

Build order: **1 crits → 2 captains → 3 path rule and maps → 4 Relic Race mode → 5 storms → 6 multiplayer.**
Each step gets rules tests and a bot balance check before it ships.

### 1. Critical rolls (natural 20 / natural 1)
- **Natural 20** on any d20 check: **+3 to your next roll this turn** (momentum).
- **Natural 1** on any d20 check: the check fails and the ship suffers a **mishap**, roll a d6:

| d6 | Mishap |
|---|---|
| 1–2 | **Turned around:** the ship swings to present its stern to the enemy (faces directly away from the nearest enemy). |
| 3–4 | **Engine stall:** engine power drops to 1. On a boost roll the ship also overshoots **2×** (instead of 1.5×). |
| 5 | **Disaster on deck:** 1 hull damage, a random crew member is stunned, and 1 spare part is lost. |
| 6 | **Lucky second chance:** roll the failed check again. |

- A natural 1 on a boost always overshoots 2×, whatever the mishap.
- KESTREL (Drifter captain, below) ignores natural 1s: she rerolls once.

### 2. Captains: two per faction, faction-locked
- A crew may have only **one captain**, and only a captain of the ship's own faction.
- Each faction has an **offensive** and a **defensive** captain. Triggers stay as they are:
  Scrappers after a hit, Nomads after a stable drift, Drifters need no trigger.
- No neutral crew (they would repeat what the faction crews already do).

| Faction | Offensive captain | Defensive captain |
|---|---|---|
| Scrappers | **VOSS, Iron Captain** (as now): +1 attack; epic *Knock Them Down!* stuns a random enemy crew member after a hit. | **New: HESK, Forge-Master.** Passive: +1 spare part at the start, repairs +1. Epic *Forge* (ENG, after a hit): spend 1 spare part for a permanent +1 BOOST, DRIFT or WEAPONS, or +2 hull. Each stat once; never engine. |
| Nomads | **RHO, Captain** (as now): +1 to all rolls; epic *Battle Stations* repeats this phase. The versatile tempo captain. | **New: TASSA, Caravan Mother.** Passive: while the ship holds a stable drift, its crew can't be stunned. Epic *All Hands* (after a stable drift): one other crew member may give their order right away, even while resting. |
| Drifters | **New: KESTREL, Storm Rider.** Passive: ignores natural 1s (one reroll) and storm drag. Order *Ram!*: if the ship ends its move on the enemy's hex this turn, the enemy takes 6 damage and the ship 1 (instead of 3 each). | **SELA, Wind Captain** (as now, the player's favourite): a failed drift still sets the heading; Song of the Wind; Tailwind. The evasive captain. |

To measure: TASSA's *All Hands* together with strong orders such as Sandstorm; HESK's permanent upgrades in short fights.

### 3. Path rule and three maps
- **Path rule (all maps):** a move must have a clear path. If a rock lies on the way, the ship crashes into the
  first rock and stops there. (Today only the target hex is checked, so ships could jump over walls.)
- **Player 1 picks the map.** All maps keep about the same size. The map is part of the move code, so online
  play and replays keep working. The computer picks with a d6 when it is Player 1.

| Map | Terrain | Plays like |
|---|---|---|
| **Wastelands** | What we have now: open flats in the middle, rock thickening outward, canyons leading back in. | All-round. |
| **Canyon** | One wide gorge between the spawns; open for a few hexes, then quickly mountains. | Ships meet head-on at full speed: fight or evade. |
| **Labyrinth** | Medium-sized network of narrow alleys, all connected. | Quick, agile ships (Skiff, Drifters) have the edge. |

Earlier map ideas kept for later: salt flats (wide open, firepower decides), wreck field (many wrecks, sustain decides).

### 4. Game mode: Relic Race (capture the flag)
Player 1 picks the mode together with the map: **Duel** (as now) or **Relic Race**.
- The **relic** lies in the middle of the map. Any ship can pick it up by ending its move on its hex.
- Once it is picked up, an **exit point** appears for every team, on opposite sides of the map.
- The carrier gets **−1 engine power** (counted like a point of speed damage), so it can't easily fly away.
- The game ends when the relic reaches an exit point (that team wins) **or** only one ship remains.

### 5. Storms (optional setting)
- The wind blows from one of the six directions and **turns one step clockwise every two rounds**, so players can plan for it.
- Boosting **into** the wind: DC +2. **With** the wind: DC −1, then **drag** pushes the ship 1 hex downwind.
- Attacks **without a lock**: −2 (perfect drifts pay off).
- Ship differences: the **Hauler** ignores drag but turns worse (+1 DC on any turn); the Skiff takes full drag;
  **KESTREL** ignores drag.

### 6. Multiplayer: 1v2, 1v3, 2v2, free-for-all (4)
- **Turn order:** teams alternate (A1, B1, A2, B2) so no side moves twice in a row; free-for-all goes P1 → P4.
- **Targeting:** choose any enemy in your arc. Support orders can help allies (e.g. ANA heals an ally nearby).
- **Friendly fire:** off; ramming an ally still damages both ships.
- **Winning:** last team (or ship) standing.
- **Uneven fights (1v2, 1v3):** no extra hull for the single player; balance will be measured with bots first.
- **Map size:** stays the same; spawns spread around the open flats.
- **Online:** every player posts their move code in a group chat; each code holds the whole game, so everyone
  stays in sync. The computer can fill any empty seat.
- Build in three steps: rules and screens for N ships and teams (one device + computer players) → online
  with more than 2 players → balance for uneven matchups.

## Other ideas (later)

- **Send a turn as a link**: the move code inside a link (`…/web/#TETHYS-…`) so a friend opens it directly;
  optionally "save turn as file". Open question: how a player opening their own link on another device
  keeps their seat.
- **Ship abilities from the setting**: Ghost Run (Skiff), Beacon (Hauler), Martial Law (Dreadnought), Overload (Construct).
- **Resources from the setting**: water (crew and hydrogen engines), Vision (morale, navigation).
- **Campaign**: the opening arc (the raid on the bazaar, stranded, the road, the relic and the Immortals).
- **Python version**: still has the first crew system; bring it in line with the browser rules or retire it.

## Balance notes

Measured with bots (computer's rule card on both sides, random builds), see `web/test/` and the README.
- Fights: once in range, a ship goes down after a median of 2.5 exchanges of fire.
- Random builds: factions 49–52%, ships 46–53%, every crew member 45–57%; moving first gives no advantage.
- Strongest single crew members: SAL, FENN, ANA (sustain). Weakest: ZED, GRIT, NYX.
