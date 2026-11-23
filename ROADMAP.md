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

## Built in this round (done)
- **Critical rolls**: natural 20 = +3 to the next roll this turn; natural 1 = fail + mishap d6
  (1–2 turned around, 3–4 engine stall and a 2× overshoot on a boost, 5 disaster on deck, 6 lucky second chance).
- **Captains**: two per faction, faction-locked, one per crew. New: HESK, Forge-Master (Scrappers, defensive),
  TASSA, Caravan Mother (Nomads, defensive), KESTREL, Storm Rider (Drifters, offensive). No neutral crew.
- **Path rule** and **three maps**: Wastelands, Canyon, Labyrinth (same size). Player 1 picks.
- **Relic Race** (capture the flag) as a mode; exits 12 hexes behind each start; carrier −1 engine.
- **Storms** (optional): wind turns one step clockwise every two rounds.
- **Skiff buff**, keeping it small and fragile: +2 drift (easy to fly), 3 spare parts (easy to assemble),
  small target (+1 AC). It now wins 48–51% on every map (before 46–48%).

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
