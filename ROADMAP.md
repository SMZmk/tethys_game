# Tethys Roadmap

Design notes for the browser game (`web/`). "Done" items are in the game; the rest is planned.

## Faction identity (done)

| | Scrappers (Machine) | Nomads (Heart) | Drifters (Wind) |
|---|---|---|---|
| Lore | Aggressive and ruthless. The ship is the living body; mercy is for the weak. | In the middle. At their best when the wind is right and crew and ship work as one. | Flying and fighting is what they are born to. |
| Perk | +1 damage on hits | After a stable drift: +1 to all rolls that turn | +1 to boost and drift rolls |
| Epic orders | Only in a turn where you **hit** the enemy | Only in a turn with a **stable drift** | None: every order can be used after **one turn** of rest |
| Normal rest | 2 turns | 2 turns | 1 turn |
| Won't sail | Construct (relic) | — | Dreadnought (war junk) |

Epic orders (no lock-on needed for the Scrapper ones):
- Scrappers: **VOSS, Knock Them Down!** (after a hit, stun a random enemy crew member) and **GRIT, Chain Shot**
  (after a hit, d6: 1 speed, 2 boost, 3 drift, 4 weapons −1; 5–6 *fire in the engines*: the enemy loses NAV or ENG
  on its next turn, d6 1–3 NAV, 4–6 ENG).
- Nomads: **RHO, Battle Stations** (repeat this phase), **FENN, Sandstorm** (enemy −2 to all rolls next turn), **ANA, Patch Up** (heal 3), **KAEL, Double Tap** (fire again).
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

## Built in this round (done)
- **Critical rolls**: natural 20 = +3 to the next roll this turn; natural 1 = fail + mishap d6
  (1–2 turned around, 3–4 engine stall and a 2× overshoot on a boost, 5 disaster on deck, 6 lucky second chance).
- **Captains**: two per faction, faction-locked, one per crew. New: HESK, Forge-Master (Scrappers, defensive),
  TASSA, Caravan Mother (Nomads, defensive), KESTREL, Storm Rider (Drifters, offensive). No neutral crew.
- **Path rule** and **three maps**: Wastelands, Canyon, Labyrinth (same size). Player 1 picks the map and mode;
  Player 2 picks the weather (the computer: d6 5–6 storm).
- **Relic Race** (capture the flag) as a mode; exits 12 hexes behind each start; carrier −1 engine.
- **Storms** (optional): wind turns one step clockwise every two rounds.
- **Skiff buff**, keeping it small and fragile: +2 drift (easy to fly), 3 spare parts (easy to assemble),
  small target (+1 AC). It now wins 48–51% on every map (before 46–48%).

- **Computer and cliffs**: it never turns its bow straight into rock after a drift, and when boxed in it keeps
  pivoting one way until a course opens (before: left, right, left… back into the cliff, in 152 of 900 games).

- **Terrain you can fly over**: rock (grey slate, brown mesa) blocks courses (a failed boost bounces back off it,
  3 damage); scree patches can be flown over, but ending a move on them deals 2; dunes run in light stripes
  across the map (about 5 hexes apart, angle set by the seed) and deal 1 when you end a move on them.
  The computer lands where it hurts least.
- **Rock blocks shots** (line of sight); scree and dunes don't. The firing arc shows only visible hexes.
- **Blowing sand follows the weather**: calm = a few slow grains; storm = dense streaks downwind and a dusty haze.
- **Chronicle updated**: lines for each map and the weather, the storm turning, rock hiding the enemy, scree and
  dunes, natural 20s, lucky second chances, KESTREL's ram, and the Relic Race per faction. Every crew member,
  all six captains included, now speaks their order in their own voice.
- **Labyrinth rebuilt as Swiss cheese**: caves of 1–3 hex radius linked by 1-hex tunnels and some 3-hex passages
  (was a narrow mesh of alleys). Starts, centre and exits are always linked by wide passages.

- **KAEL nerf** (a reported Scrapper Hauler build: VOSS, GRIT, KAEL, NYX): played well, Double Tap is a second
  attack roll every few turns, and KAEL crews won 60% (KAEL + GRIT on Scrappers 65%). Double Tap is now an epic
  order (only in a turn with a stable drift) and KAEL's passive is +1 attack (was +2): KAEL 54%, the combo 57%.
  The computer now also saves Double Tap until after its first shot.

- **Computer orders audit**: it no longer wastes orders. Before, it gave every order the moment it could:
  IVO's Surge in the last phase (expired unused), KESTREL's Ram! without steering into you, TASSA's All Hands with
  nobody resting, RHO's Battle Stations on a repeat NAV instead of a second shot, HESK forging boost first, ANA
  healing 1 hull, DOV bracing far from the enemy. Crew win rates against each other now 46–57%.

- **Layout**: the command panel sits right under the map (the chronicle moved below it). On desktop the map
  shrinks to fit the screen height so map and commands are visible together, and the crew column scrolls on its own.

- **Hauler**: hull 18 (was 14) and 2 energy (was 3). Drifters now sail the Hauler but not the Dreadnought.
  1,500 random-build games: Hauler 49% (was 48%), Drifters on a Hauler 50%, factions 49–51%.

- **Four ships, four play styles** (movement and firing arcs per ship):
  - Skiff, the runner: unchanged (speed 4, +1 AC).
  - Hauler, the tank: 22 hull, −1 AC; straight courses fly 2 hexes further for free; turns at most 2 steps, +1 DC each.
  - Dreadnought, the gun platform: broadside arc (2 steps per range either side, about 270°); lost its +1 attack.
  - Construct, the glass cannon: 13 hull; hovers (slides sideways, turns up to 4 steps, wide turns cost no DC);
    fires all round at range 1–2; keeps 5 energy.
  2,000 random-build games: Skiff 48%, Hauler 50%, Dreadnought 52%, Construct 50%; factions 49–51%.

Balance after this round (bot games, random builds, 1,500 per setting): ships 44–55%, factions 47–54%.
Captains: SELA is the strongest (about 55–63%); TASSA and HESK are slightly below average (about 44–50%).
Simple buffs for TASSA and HESK were tested and made no measurable difference, so the agreed designs were kept.

## Planned next

### Multiplayer: 1v2, 1v3, 2v2, free-for-all (4)
Not built yet: the game assumes exactly two ships in its targeting, the computer, the screens, online codes and the
win check, so this is a large overhaul. The agreed design stays:
- **Turn order:** teams alternate (A1, B1, A2, B2); free-for-all goes P1 → P4.
- **Targeting:** any enemy in your arc. Support orders can help allies.
- **Friendly fire:** off; ramming an ally still damages both ships.
- **Winning:** last team (or ship) standing; Relic Race works per team.
- **Uneven fights (1v2, 1v3):** no extra hull for the single player; balance measured with bots first.
- **Online:** every player posts their move code in a group chat; each code holds the whole game.
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
