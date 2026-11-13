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

Crew rules: at most **one captain** per crew (VOSS, RHO or SELA).

Other changes made with this:
- **ZED, Jam Weapons** affects only the enemy's weapons: −2 to their lock and attack rolls on their next turn (it no longer removes a phase).
- Dreadnought: hull 17; twin guns roll to hit twice per shot, each hit half damage: steadier, fewer clean misses.
- Online play: the map stays visible while you wait for your opponent.

Why: the "Nomad sustain" build (RHO, FENN, ANA, DOV) won 77% against random builds. With epic orders tied
to a stable drift it wins 60–61%, in line with good builds of the other factions (48–63%).
Computer against computer, the factions win 44–56% against each other (before 40–62%).

## Maps (planned)

Different maps should reward different builds without changing the crew. A map would be a named set of
terrain settings (rock density, canyons, wrecks) plus an optional objective, stored in the game code so
online play and replays keep working.

| Map | Terrain | Rewards |
|---|---|---|
| Canyon run | Narrow corridors, dense rock, crashes common | Maneuverability: Skiff (speed 4), Drifters, SELA, VEX, ORO, FENN |
| Salt flats | Wide open, no cover, early contact | Damage output: Dreadnought, Scrappers, VOSS, GRIT, KAEL |
| Wreck field | Many old-world wrecks, few rocks | Scavenging and sustain: SAL, Skiff (2 parts per wreck), repairs |
| Relic race | An objective hex: reach the relic and get away | Speed and escaping; ties in with Europa and the Immortals |

## Other ideas (planned)

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
