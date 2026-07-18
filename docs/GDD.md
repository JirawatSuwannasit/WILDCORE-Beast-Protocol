# WILDCORE — Beast Protocol
### Game Design Document v1.0
*Eight beasts. One frame. Take back the wild.*

---

## 0. Overview

| Field | Value |
|---|---|
| **Title** | WILDCORE: Beast Protocol |
| **Genre** | Single-player Action Platformer (Mega Man / Mega Man X inspired) |
| **Platform** | **Mobile — Android first (Google Play Store)**, iOS later; landscape orientation, touch-first controls |
| **Art Style** | Cozy pixel art — warm dusk lighting, soft rounded shapes, 32-bit era feel |
| **Native Resolution** | 320×180 (16:9), integer-scaled; letterbox-extended backgrounds for 18:9–21:9 screens |
| **Engine** | Phaser 3 + TypeScript + Vite, wrapped as a native Android app with **Capacitor** |
| **Distribution** | Google Play (AAB via GitHub Actions); debug APK artifact per PR for device testing |
| **Dev Preview** | Vercel (web build of every PR — for fast PO review only, not the shipping target) |
| **Backend** | Supabase (cloud saves, settings, optional leaderboards) |
| **Repo** | GitHub, developed via Claude Code (cloud, direct GitHub connection) |

### AI Production Team
| Role | Model | Responsibility |
|---|---|---|
| Product Owner / Prompt Engineer | Claude Opus 4.8 | Design decisions, task breakdown, writing all prompts, review |
| Programmer | Claude Code (Sonnet 5) | All game code, GitHub commits, Vercel deploys, Supabase schema |
| Art Generator | ChatGPT (image gen) | All pixel art assets from the prompts in §10 |

---

## 1. World & Story

**The world of FAUNATERRA** — a lush machine-garden planet where nature and robotics grew together. Its ecosystems are kept in balance by eight **Guardian Frames**: elite combat armors modeled after the planet's most iconic beasts, each bonded to a regional "Bio-Core."

**The incident.** A caretaker super-AI named **APEX** concludes that organic life is the source of all imbalance. It hijacks the eight Guardian Frames, seizes their Bio-Cores, and begins "optimizing" each region — freezing forests, boiling seas, silencing skies.

**The hero.** You are **KITSU-01 "Ember"** — a small, unfinished fox-type prototype frame built by **Dr. Maple Sylva**, the engineer who designed the original Guardians. Ember was never meant for war: it's light, fast, and adaptable — which is exactly why APEX's prediction models can't read it.

**The hook.** Every Guardian you defeat returns its Bio-Core — and its signature weapon — to you. Dr. Sylva's four hidden **Armor Capsules**, scattered across the regions, rebuild Ember piece by piece into the frame the Guardians should have been.

**Tone:** Hopeful, cozy, a little melancholic. You are not destroying the Guardians — you are *freeing* them. Each defeated boss powers down gently and thanks you in one line.

---

## 2. Core Gameplay Rules

### 2.1 The Loop
1. **Stage Select** — 8 stages open from the start, any order.
2. Clear the stage → **Boss room** (locked shutter doors, classic style).
3. Defeat boss → gain its **weapon** → weapon is another boss's weakness (rock-paper-scissors wheel, §5).
4. Find hidden **Armor Capsules** (some gated behind weapons → purposeful backtracking, §6).
5. All 8 bosses down → **APEX Citadel**: 3 consecutive final stages, **no mid-save**, ending with a **Boss Rush** and the final boss.

### 2.2 Player Abilities (base kit)
- **Run** — constant speed, no acceleration curve (precision first).
- **Jump** — variable height (release early = short hop). Fixed air control.
- **Buster Shot** — 3 bullets on screen max. Hold to **charge** (2 levels; level 3 unlocked by Arms Capsule).
- **Wall Slide / Wall Kick** — X-style, from the start.
- **Dash** — *locked until Legs Capsule.*
- **Weapon Wheel** — quick-switch acquired boss weapons (swap arrows on screen, or pause wheel).

### 2.2b Touch Controls (PRIMARY input — designed first, not ported later)
- **Layout (landscape):** left thumb = floating virtual stick *or* fixed D-pad (player choice); right thumb = **A Jump**, **B Shoot** (hold = charge), **C Dash**, small weapon-swap arrows above them.
- **Hold-B auto-fire** toggle in settings for players who dislike tap-mashing.
- Buttons ≥ 48dp touch targets, adjustable **size / position / opacity** in settings; layouts saved per profile.
- Respect Android safe areas (notches, gesture bar); no gameplay-critical UI in the outer 24px.
- **Design law:** every jump, secret, and boss pattern must be comfortably doable on touch. Wall-kick chains tuned for thumb cadence, not keyboard pianoing. External **gamepads** (Bluetooth) fully supported with the same buffer/coyote logic; keyboard supported in the web dev-preview.
- Haptics: light tick on landing a charged shot, medium on taking damage, strong on boss defeat (toggleable).
- App lifecycle: auto-pause on background/incoming call; never lose progress to an interruption.

### 2.3 Health & Economy
- HP bar: 16 units. Boss bars: 16 units, fills at door entry (ritual pause).
- **Heart Chips** (×8, one hidden per stage): +2 max HP each.
- **Cell Packs** (×4 findable): stored full-heal, usable anytime (E-Tank style).
- Weapon energy per weapon; small/large pickups from enemies; refills between Stage Select visits.
- Lives are infinite; the *cost* of death is checkpoint distance, not grind.

### 2.4 Death & Checkpoints
- Checkpoints: stage start → midpoint → pre-boss corridor. (Long stages may add one extra.)
- Death = instant respawn at checkpoint, enemies reset, weapon energy kept.
- **Never** place a checkpoint immediately before an unseen instant-kill. Every trap must be readable before it can kill you.

### 2.5 Game Feel Pillars (non-negotiable)
1. **Fair hitboxes** — player hurtbox is *smaller* than the sprite (about 70%). Enemy hitboxes match visuals exactly. Death should always feel like "my mistake."
2. **Coyote time** (6 frames) + **input buffer** (6 frames) on jump and dash.
3. **Hitstop** — 3 frames on landing a charged shot; 8 frames on boss weakness hit.
4. **Telegraphs** — every enemy attack has a ≥20-frame wind-up animation with a color flash.
5. **Signature music** — each stage theme built on a hummable 4-bar hook (see §9 music briefs).
6. **Respawn speed** — death → playing again in under 1.5 seconds.

---

## 3. The Eight Stages & Guardians

Weakness wheel (each weapon beats the *next* boss in this ring):

```
Umbra Claw → VOLT CHEETAH → Volt Chain → TIDE MANTA → Tide Burst →
MAGMA RHINO → Magma Charge → FROST OWL → Frost Talon → GALE FALCON →
Gale Cutter → VENOM MANTIS → Venom Sting → TERRA PANGOLIN → Terra Spike →
SHADOW PANTHER → Umbra Claw → (back to Volt Cheetah)
```

### 3.1 VOLT CHEETAH — "Speedway Savanna"
- **Theme:** Golden-hour solar highway across a grass sea; wind turbines, sun panels.
- **Gimmicks:** Speed-boost strips, timed collapsing bridges, electric fences that pulse on a beat.
- **Mid-boss:** Twin patrol drones circling a pylon.
- **Boss pattern:** Dashes wall-to-wall (3 speeds, telegraph by crouch length) → wall-kick overhead pounce → Volt Chain sweep along the floor. Weakness (Umbra Claw) interrupts a dash.
- **Weapon gained — VOLT CHAIN:** lightning bolt that chains to 1 nearby enemy. Utility: powers dead machinery.
- **Secret:** **LEGS CAPSULE** — a high ledge above the final speed strip; reachable with a precise wall-kick chain, *no weapon gate* (teaches players that secrets exist). Grants **Dash** + one-hit spike survival (once per checkpoint).

### 3.2 TIDE MANTA — "Coral Reservoir"
- **Theme:** Sunken cozy aquarium-city; glass tunnels, jellyfish lamps, teal + coral palette.
- **Gimmicks:** Water raises/lowers on valves; currents push jumps; float physics underwater.
- **Mid-boss:** Anglerfish lamp mimic in a dark tunnel.
- **Boss pattern:** Glides in sine waves → burrows into water floor, erupts below player (shadow telegraph) → ring of water orbs. Volt Chain electrifies the water it swims in.
- **Weapon — TIDE BURST:** lobbed water bomb, splash arc. Utility: douses fires, reveals invisible platforms in Eclipse District.
- **Secret:** **BODY CAPSULE** — a drained maintenance shaft; requires **Volt Chain** to power the pump. Grants 25% damage reduction + no knockback from small hits.

### 3.3 MAGMA RHINO — "Ember Foundry"
- **Theme:** Warm-lit forge village inside a volcano; copper pipes, hanging lanterns.
- **Gimmicks:** Rising lava chase section, piston crushers on visible rails, heat vents that lift jumps.
- **Mid-boss:** Slag golem that re-forms once.
- **Boss pattern:** Charging ram (cracks the wall, brief stun opening) → lava geysers in a readable sequence → horn toss of magma rocks. Tide Burst extinguishes his charge flame.
- **Weapon — MAGMA CHARGE:** short piercing ram-shot that carries Ember forward. Utility: melts ice walls.
- **Secret:** Heart Chip behind a crusher timed 2-cycle route; Cell Pack #1 above the lava chase (dash recommended).

### 3.4 FROST OWL — "Aurora Observatory"
- **Theme:** Snowy mountain observatory under auroras; telescope domes, string lights.
- **Gimmicks:** Ice physics (slide), breakable icicle platforms, snowfall that hides gaps until close.
- **Mid-boss:** Frost lens turret that reflects your shots.
- **Boss pattern:** Silent glide (screen dims, only eyes glow) → feather-blade fan spread → freezing screech that must be ducked under a snow bank. Magma Charge burns through her ice shield.
- **Weapon — FROST TALON:** shuriken that freezes minor enemies into **temporary platforms** (key traversal tool).
- **Secret:** **HEAD CAPSULE** — behind an ice wall on the telescope roof; requires **Magma Charge**. Grants secret-radar ping (chimes near hidden rooms) + 30% faster buster charge.

### 3.5 GALE FALCON — "Skyhaven Ruins"
- **Theme:** Floating shrine islands at sunset; rope bridges, prayer flags, clouds below.
- **Gimmicks:** Gust cycles that extend/shorten jumps (visible leaf particles = wind direction), collapsing shrine tiles, bottomless sky.
- **Mid-boss:** Kite serpent weaving between islands.
- **Boss pattern:** Dive-bomb along a laser sightline → tornado wall that forces wall-kick climbing → feather barrage arcs. Frost Talon clips her wings mid-glide.
- **Weapon — GALE CUTTER:** boomerang wind blade, returns to Ember; can cut ropes/cables.
- **Secret:** Heart Chip on a flag pole only reachable during the strongest gust; Cell Pack #2 under the starting island (leap of faith marked by circling birds).

### 3.6 VENOM MANTIS — "Bloom Greenhouse"
- **Theme:** Overgrown botanical biodome, bioluminescent flowers, dripping vines. Cozy-eerie.
- **Gimmicks:** Toxic pools (DoT, not instant death), bounce flowers, vines climbable only where flowering.
- **Mid-boss:** Pitcher-plant that swallows and spits projectiles back.
- **Boss pattern:** Scythe triple-slash combo (rhythm: slow-slow-fast) → ceiling hang + acid rain → grass-cloak ambush (only her eyes visible). Gale Cutter blows away her toxin cloud and cloak.
- **Weapon — VENOM STING:** sticky dart, damage over time; one dart per enemy. Utility: corrodes rusted blocks.
- **Secret:** Heart Chip inside the pitcher-plant mid-boss room (feed it a Tide Burst); rusted vault with weapon-energy upgrade (**Venom Sting** needed — yes, from this stage's own boss → return visit).

### 3.7 TERRA PANGOLIN — "Hollow Quarry"
- **Theme:** Lantern-lit mine village in giant geodes; minecart rails, crystal glow.
- **Gimmicks:** Minecart ride sections (jump between rails), collapsing floors (crack telegraph), dig-walls broken by charged shots.
- **Mid-boss:** Drill beetle racing your minecart.
- **Boss pattern:** Rolls into a ball ricocheting off walls (count the bounces: always 3) → burrows, spikes erupt trailing the player → shield curl (invulnerable) until Venom Sting corrodes his plates.
- **Weapon — TERRA SPIKE:** ground wave that travels floor/walls. Utility: triggers weak floors safely.
- **Secret:** Heart Chip behind a dig-wall on the cart ride (charge shot while riding); Cell Pack #3 beneath a collapsing floor "trap" that is actually the way.

### 3.8 SHADOW PANTHER — "Eclipse District"
- **Theme:** Neon night market city under a permanent eclipse; paper lanterns, rain puddles reflecting signs.
- **Gimmicks:** Lights-out zones (only lantern radius visible), invisible platforms revealed by rain/Tide Burst, rooftop AC-unit parkour.
- **Mid-boss:** Neon sign chimera (lit segments = hitbox).
- **Boss pattern:** Teleport slashes between lantern posts (the lantern flickers before he appears) → screen-dark pounce (eyes betray position) → afterimage clone dash (real one casts a shadow). Terra Spike travels walls and knocks him off perches.
- **Weapon — UMBRA CLAW:** short-range dash-slash with i-frames (high risk, high reward; closes the loop → beats Volt Cheetah).
- **Secret:** **ARMS CAPSULE** — a rooftop generator vault; requires **Gale Cutter** (cut the cable car rope) **+ Legs dash** (cross the gap). Grants **Charge Level 3** and *charged versions of all boss weapons*.

---

## 4. Boss Design Rules
- Boss rooms are single screens, shutter doors both sides, health-fill ritual (~1.5 s).
- Exactly **3 core patterns + 1 desperation pattern** below 25% HP.
- Every pattern readable and dodgeable **with buster only** (weakness makes it easier, never mandatory).
- Weakness hits: 4 damage + interrupt current pattern + unique reaction animation.
- On defeat: gentle power-down, one line of dialogue, weapon-get jingle + pose screen.

## 5. Weakness Wheel (summary table)

| Boss | Stage | Weapon Gained | Weak To |
|---|---|---|---|
| Volt Cheetah | Speedway Savanna | Volt Chain | Umbra Claw |
| Tide Manta | Coral Reservoir | Tide Burst | Volt Chain |
| Magma Rhino | Ember Foundry | Magma Charge | Tide Burst |
| Frost Owl | Aurora Observatory | Frost Talon | Magma Charge |
| Gale Falcon | Skyhaven Ruins | Gale Cutter | Frost Talon |
| Venom Mantis | Bloom Greenhouse | Venom Sting | Gale Cutter |
| Terra Pangolin | Hollow Quarry | Terra Spike | Venom Sting |
| Shadow Panther | Eclipse District | Umbra Claw | Terra Spike |

*Recommended "blind" route:* Volt Cheetah first (fair buster fight, Legs Capsule tutorial-secret), then follow the wheel forward.

## 6. Armor Capsule System

| Piece | Location | Gate (backtracking reason) | Power |
|---|---|---|---|
| **Legs** | Speedway Savanna | Skill only (wall-kick chain) | Dash, air-dash (post-Arms), survive 1 spike hit per checkpoint |
| **Body** | Coral Reservoir | Volt Chain (power the pump) | −25% damage, no knockback from small hits |
| **Head** | Aurora Observatory | Magma Charge (melt ice wall) | Secret radar chime, +30% charge speed |
| **Arms** | Eclipse District | Gale Cutter + Legs dash | Charge Lv.3, charged boss weapons |

- Dr. Sylva appears as a hologram at each capsule with 2–3 lines of warm story.
- Full set bonus: **Sylva Overdrive** — once per stage, a screen-clear burst (cозy ultimate, big flower-burst VFX).
- All capsules optional; game clearable at base kit (design & test this).

## 7. Final Stages — "APEX Citadel" (consecutive, no mid-save)

1. **Citadel Gate** — remix gauntlet of all 8 stage gimmicks in short rooms. Boss: **Twin Prototype Frames** (wolf + raven, fight simultaneously).
2. **Core Spire** — vertical wall-kick ascent, rising purge-light below. Boss: **Dr. Sylva's stolen masterwork "PRIME FRAME"** (uses *your* moveset: dash, charge, wall-kick — mirror fight).
3. **The Menagerie (Boss Rush)** — classic 8-teleporter room, refight all Guardians (weapon energy refill pickups between fights) → then **APEX**.
   - **APEX Phase 1:** giant chimera frame assembled from all 8 beasts (each body part telegraphs its origin boss's pattern).
   - **APEX Phase 2:** the bare core in a collapsing zero-gravity chamber; only buster works — pure execution finale.
- Checkpoints exist *within* each of the 3 stages, but quitting mid-Citadel restarts the Citadel (tension by design).
- **Ending:** the 8 Guardians reboot free; Faunaterra blooms; Ember and Dr. Sylva watch the sunrise. Post-credits: clear time + collectible tally + unlock **New Game+** (bosses gain a 4th pattern).

## 8. Progression, Saves & Supabase

### Save data (per slot, 3 slots)
```json
{
  "slot": 1,
  "cleared_bosses": ["volt_cheetah", "tide_manta"],
  "weapons": ["volt_chain", "tide_burst"],
  "capsules": ["legs"],
  "heart_chips": 3,
  "cell_packs_found": 1,
  "cell_packs_stored": 1,
  "play_time_seconds": 5423,
  "settings": { "music": 0.8, "sfx": 1.0, "screenshake": true }
}
```
- **Local-first:** save to `localStorage` instantly; sync to Supabase when signed in (anonymous auth by default, optional email link).
- Tables: `profiles`, `saves` (jsonb, RLS by user), `leaderboard_runs` (clear time, buster-only flag, no-armor flag).
- Auto-save on: boss clear, capsule get, stage exit. Manual save at Stage Select.

## 9. Audio Direction (briefs for later composition)
- Style: chiptune + soft synth pads ("cozy FM"). Each stage = one earworm 4-bar hook.
- Speedway: driving 160 BPM synthwave / Reservoir: dreamy 90 BPM with marimba / Foundry: anvil-percussion groove / Observatory: music-box waltz / Skyhaven: airy flute lead / Greenhouse: wet plucks, minor key / Quarry: cave echo + hammered dulcimer / Eclipse: lo-fi night-market beat.
- Boss theme: shared driving track with per-boss lead instrument swap. APEX: choir pads + distorted chiptune.

---

## 10. ART PACKAGE — ChatGPT Prompts (English)

### 10.1 Master Style Prompt (prepend to every asset prompt)
```
Cozy pixel art for a 2D action platformer, 32-bit era (SNES/GBA quality),
warm dusk lighting, soft rounded silhouettes, limited harmonious palette
(max 24 colors per asset), clean 1px black-brown outlines, gentle dithering,
no anti-aliasing, crisp pixels, transparent background (PNG),
consistent 3/4 side-view game perspective. No text, no watermark.
```

### 10.2 Global Palette
```
Base ramp: #2B1D2A (shadow) #4A3B4F #7A6C86 #C9BAD1 (light)
Warm accent: #F5A742 (amber) #E8604C (coral)
Cool accent: #5FB3A1 (teal) #7BA05B (moss)
UI cream: #F2E8D5 / Night: #14201C
```

### 10.3 Hero — KITSU-01 "Ember"
```
[Master Style] Small heroic fox-inspired robot armor "Ember", 32x32 pixel sprite,
cream and amber plating with teal energy lines, big expressive teal visor eyes,
three segmented tail-thrusters, rounded cozy proportions (2.5 heads tall).
Sprite sheet, side view, on a grid: idle (4 frames), run (8), jump rise, jump fall,
wall slide, dash, buster shot standing, buster shot jumping, charge glow (3),
hurt, victory pose. Consistent proportions across all frames.
```

### 10.4 Boss Prompt Template
```
[Master Style] Boss robot armor inspired by a {ANIMAL}, 64x64 pixel sprite,
{PALETTE NOTES}, cool but friendly-menacing design, readable silhouette.
Sprite sheet: idle (4 frames), {SIGNATURE MOVE 1}, {SIGNATURE MOVE 2},
{SIGNATURE MOVE 3}, hit reaction, gentle power-down defeat (4 frames).
```
Per boss fill-ins:
- **Volt Cheetah:** cheetah / gold + black spots as circuit dots, teal lightning mane / crouch-dash, wall pounce, floor lightning sweep
- **Tide Manta:** manta ray / deep teal + coral underglow, jellyfish-lamp lure / sine glide, floor eruption, water-orb ring
- **Magma Rhino:** rhinoceros / copper + charcoal, magma seams between plates / ram charge, geyser stomp, horn rock-toss
- **Frost Owl:** owl / ice-white + lavender, aurora wing membranes / silent glide, feather-fan throw, freezing screech
- **Gale Falcon:** falcon / sunset orange + cream, prayer-flag scarf / dive-bomb, tornado wing-wall, feather barrage
- **Venom Mantis:** praying mantis / moss green + bioluminescent pink joints / triple scythe slash, ceiling acid rain, grass-cloak ambush
- **Terra Pangolin:** pangolin / bronze crystal-tipped scales, lantern chest-light / rolling ball, burrow spike trail, shield curl
- **Shadow Panther:** black panther / matte black + neon violet claw-lines, glowing eyes / lantern teleport slash, dark pounce, afterimage dash

### 10.5 Tilesets (one prompt per stage)
```
[Master Style] Seamless 16x16 tileset for "{STAGE NAME}" — {THEME DESCRIPTION}.
Include: ground top + fill, left/right edges, slopes 45°, background wall,
2 decorative props, hazard tile (spikes/toxic/lava as appropriate),
animated tile strip (4 frames) for {STAGE ELEMENT}, ladder, checkpoint lantern.
Arranged on a labeled grid, transparent background.
```
Stage fill-ins: Speedway Savanna (golden grass, solar panels, turbines) / Coral Reservoir (glass tunnels, coral, jellyfish lamps) / Ember Foundry (copper pipes, lanterns, lava) / Aurora Observatory (snow, domes, string lights) / Skyhaven Ruins (shrine stone, rope bridges, clouds) / Bloom Greenhouse (glass dome, giant flowers, vines) / Hollow Quarry (geode crystal, minecart rails) / Eclipse District (neon signs, paper lanterns, rain rooftops).

### 10.6 Other Assets
```
1. [Master Style] Stage Select screen: 3x3 grid of 8 boss portrait frames around
   a center fox emblem, cozy night-sky backdrop, 320x180.
2. [Master Style] UI kit: HP bar (amber cells, cream frame), weapon energy bar,
   boss HP bar, dialogue box with fox emblem, menu cursor paw icon, pixel hearts,
   cell pack canister icon, 8 weapon icons matching each boss element.
3. [Master Style] Armor Capsule sprite: glass pod with amber hologram light,
   32x48, idle glow 4 frames + opening animation 6 frames.
4. [Master Style] Dr. Maple Sylva hologram portrait: kind elderly engineer,
   maple-leaf hairpin, warm amber hologram tint, 48x48 bust, 3 expressions.
5. [Master Style] APEX final boss: massive chimera frame combining cheetah legs,
   manta wings, rhino chest, owl head crest, panther tail — 128x128, 2 phases
   (assembled titan / exposed floating core).
6. [Master Style] Parallax background set for {STAGE}: 3 layers (far sky,
   mid landmark, near silhouette), 320x180 each, seamless horizontal loop.
```

---

## 11. Technical Plan

### 11.1 Stack
- **Phaser 3.80+**, TypeScript, Vite. Arcade Physics (AABB — perfect for precision platforming).
- **Capacitor 6** wrapping the web build as a native **Android** app (WebView). Plugins: Haptics, App (lifecycle pause), Screen Orientation (lock landscape), Status Bar (immersive fullscreen). iOS port later = add the platform, no code rewrite.
- Fixed timestep logic (60 Hz), render interpolation. Integer pixel scaling, `pixelArt: true`.
- Tilemaps: **Tiled** JSON format (Claude Code can generate/edit Tiled JSON directly).
- Input priority: **touch first**, then Bluetooth gamepad, then keyboard (dev preview).
- Audio: Web Audio via Phaser; music as OGG loops with intro+loop points; ducking on app pause.
- Performance budget: stable 60fps on a mid-range Android (e.g., 4GB RAM class); texture atlases, object pooling mandatory.

### 11.2 Repo Structure
```
wildcore/
├─ src/
│  ├─ main.ts, config.ts
│  ├─ scenes/ (Boot, Title, StageSelect, Stage, BossRoom, Citadel, UI)
│  ├─ actors/ (Player, enemies/, bosses/, projectiles/)
│  ├─ systems/ (input, checkpoint, save, weapons, capsules, audio, vfx)
│  └─ data/ (stages/*.json, bosses/*.json, weakness-wheel.ts)
├─ public/assets/ (sprites/, tilesets/, audio/, ui/)
├─ android/ (Capacitor Android project — Gradle, signing config via CI secrets)
├─ capacitor.config.ts
├─ supabase/ (migrations/, seed.sql)
├─ store/ (Play Store listing assets: icon, feature graphic, screenshots)
└─ tests/ (vitest: physics, save, weakness logic)
```

### 11.3 Pipeline
- **Per PR:** GitHub Actions runs typecheck + tests → deploys a **Vercel web preview** (fast PO review) **and** builds a **debug APK artifact** (real-device testing).
- **Release:** tag → GitHub Actions builds a signed **AAB** (keystore in repo secrets) → upload to Google Play internal testing track → promote to production manually.
- Supabase project linked via env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). Claude Code (cloud) connected directly to the GitHub repo.
- Version scheme: `versionName` = semver, `versionCode` auto-incremented by CI.

---

## 12. Development Milestones — Claude Code Prompts (English)

> Workflow: Opus 4.8 (PO) issues one milestone prompt at a time → Claude Code implements on a branch → PR → Vercel dev preview **+ debug APK artifact** → PO reviews against the Definition of Done **on a real Android device** → merge.

**M0 — Project Bootstrap (mobile-first)**
```
Create a new Phaser 3 + TypeScript + Vite project named "wildcore",
wrapped as an Android app with Capacitor 6.
- Game config: 320x180 native with integer scaling and pixelArt true,
  fixed 60Hz update loop, scene flow Boot -> Title -> StageSelect -> Stage.
- Capacitor: add the Android platform; lock landscape orientation;
  immersive fullscreen (hide status/navigation bars); install Haptics and
  App plugins; handle safe-area insets (letterbox-extend beyond 16:9).
- Auto-pause the game loop and audio when the app goes to background.
- Tooling: ESLint + Prettier + Vitest. GitHub Actions on every PR:
  typecheck + tests -> Vercel web preview (dev review) -> build a debug APK
  and attach it as a workflow artifact.
- Use placeholder colored rectangles for all art. README with run / build /
  install-APK-on-device instructions.
Deliver: PR + Vercel preview + downloadable debug APK.
```

**M1 — Player Controller + Touch Input (the most important milestone)**
```
Implement the player controller for a precision action platformer in
src/actors/Player.ts using Arcade Physics:
run (constant speed 90 px/s), variable-height jump (min 2 tiles, max 3.5 tiles),
wall slide + wall kick, 6-frame coyote time, 6-frame jump input buffer,
hurtbox at 70% of sprite size, buster shot (max 3 on screen, 2 charge levels
with hold timing 0.5s / 1.2s), knockback + 1s invulnerability flicker on hit.
Implement TOUCH CONTROLS as the primary input in src/systems/input.ts:
left-side floating virtual stick OR fixed d-pad (runtime switchable),
right-side buttons A Jump / B Shoot(hold=charge) / C Dash, weapon-swap
arrows; all buttons >=48dp, multi-touch safe (jump while holding charge),
same 6-frame buffers as physical input; optional hold-to-auto-fire flag.
Also support Bluetooth gamepad and keyboard through one input abstraction.
Expose all tuning values in src/config/playerTuning.ts and touch layout in
src/config/touchLayout.ts.
Build a graybox test room with platforms, walls, spikes and a target dummy.
Debug overlay (F3 / three-finger tap) showing hitboxes, state, touch zones.
Deliver: PR + preview + debug APK. Note in the PR which real device you
cannot test on - the PO will run the APK on hardware.
```

**M2 — Vertical Slice: Speedway Savanna**
```
Build the full Speedway Savanna stage from data/stages/speedway.json (Tiled):
speed-boost strips, timed collapsing bridges, pulsing electric fences,
3 enemy types with >=20-frame telegraphed attacks, midpoint + pre-boss
checkpoints, instant (<1.5s) respawn, camera with 16px look-ahead.
Implement the boss-door shutter sequence and the Volt Cheetah fight:
3 patterns (3-speed crouch-telegraphed dash, wall pounce, floor lightning
sweep) + desperation pattern under 25% HP, 16-unit boss bar with fill ritual,
weakness interrupt hook (stub), defeat sequence with weapon-get screen.
```

**M3 — Weapon System + Weakness Wheel**
```
Implement src/systems/weapons.ts: 8 boss weapons (Volt Chain, Tide Burst,
Magma Charge, Frost Talon, Gale Cutter, Venom Sting, Terra Spike, Umbra Claw)
each with its own projectile behavior, energy cost, and utility interaction
(power machinery, douse fire, melt ice, freeze-to-platform, cut ropes,
corrode rust, trigger weak floors, dash i-frames). Data-drive the weakness
wheel in data/weakness-wheel.ts: weakness hit = 4 damage + pattern interrupt
+ unique boss reaction. Add quick-switch (Q/E) and a pause weapon wheel UI.
```

**M4 — Remaining 7 Stages & Bosses** *(issued one stage per prompt, reusing M2 template with each stage's gimmick + boss pattern spec from GDD §3)*

**M5 — Stage Select, Save System, Supabase**
```
Implement the Stage Select scene (8 portraits, cleared-state, selected-stage
jingle stub). Implement src/systems/save.ts: local-first saves in localStorage
with the schema in GDD §8, 3 slots, auto-save on boss clear / capsule get /
stage exit. Create Supabase migrations for profiles, saves (jsonb, RLS:
user can only access own rows), leaderboard_runs. Add anonymous auth and
background sync with conflict rule "latest play_time wins". Add a settings
menu (volumes, screenshake toggle, key rebinding).
```

**M6 — Armor Capsules & Backtracking Gates**
```
Implement the four Armor Capsule pickups per GDD §6 with Dr. Sylva hologram
dialogue, gated by: skill-only (Legs), Volt Chain pump (Body), Magma Charge
ice wall (Head), Gale Cutter + dash gap (Arms). Powers: dash + air-dash +
spike save (Legs), -25% damage + poise (Body), secret radar chime + faster
charge (Head), charge level 3 + charged boss weapons (Arms). Full-set bonus:
Sylva Overdrive screen-clear, once per stage. Heart Chips (+2 max HP, 8 total)
and Cell Packs (stored full heal, 4 total) with persistence.
```

**M7 — APEX Citadel (final stages)**
```
Build the three consecutive Citadel stages with no mid-run saving (quitting
returns to Stage Select, Citadel restarts): Citadel Gate remix gauntlet with
Twin Prototype duo boss; Core Spire vertical ascent with rising purge light
and the PRIME FRAME mirror boss (uses player moveset); The Menagerie 8-teleporter
boss rush with energy refills between fights, then APEX Phase 1 (chimera with
per-limb patterns referencing each Guardian) and Phase 2 (buster-only core
in collapsing chamber). Ending sequence, credits with clear time + collectible
tally, unlock New Game+ (bosses gain a 4th pattern).
```

**M8 — Art & Audio Integration + Game Feel Pass**
```
Replace all placeholder art with the final asset pack (maintain hitbox sizes,
not sprite sizes). Wire music with intro+loop points per stage, SFX for every
action. Implement hitstop (3f charged hit / 8f weakness hit), screenshake
(toggleable), landing dust, dash afterimages, low-HP heartbeat vignette.
Integrate the final touch-button sprites from the UI kit (semi-transparent),
wire haptics per GDD §2.2b (toggleable).
Run a tuning pass over playerTuning.ts against the feel checklist in GDD §2.5,
tested on a real device via the debug APK.
```

**M9 — QA & Google Play Release**
```
Release hardening for Google Play.
- Screen QA: verify UI and controls at 16:9, 18:9, 19.5:9, 21:9 with
  letterbox-extended backgrounds; safe-area insets respected.
- Performance: object pooling for projectiles/particles, texture atlas
  packing, target stable 60fps on a mid-range Android; report frame times
  per stage in the PR.
- Battery/thermal: cap off-screen updates, pause particles when paused.
- Validation runs: buster-only full clear possible; no-capsule full clear
  possible; every secret reachable with its stated gate and NOT without it;
  full game completable on touch controls only.
- Play Store package: app icon (adaptive), splash screen, feature graphic
  and screenshot templates in /store, privacy policy page (Supabase data
  disclosure), Data Safety form answers drafted in /store/data-safety.md.
- Release pipeline: signed AAB via GitHub Actions using keystore secrets,
  versionCode auto-increment, upload to Play internal testing track.
Fix all P0/P1 bugs, tag v1.0.0, hand the AAB link to the PO for Play
Console submission.
```

### Definition of Done (every milestone)
- Type-checks, tests pass, Vercel preview link **and** debug APK artifact attached.
- Playable end-to-end **on touch controls** (PO tests the APK on a real device); no console errors.
- All tuning values externalized in config files (PO can tweak without code).
- Death always attributable to a readable mistake (feel pillar #1).

---

## 13. Risks & Cuts
- **Scope risk:** 8 stages is heavy → v1.0 can ship with 6 (cut Venom Mantis + Terra Pangolin, shrink wheel to 6) and add them in v1.1. Decide at end of M4.
- **Art consistency risk:** generate ALL bosses in one ChatGPT session using the template, regenerate outliers; keep the master palette pinned.
- **Touch input risk:** touch is the *primary* input from M1, never a port. Every jump/secret/boss doable comfortably by thumbs; no dash-jump pixel-perfection required anywhere.
- **WebView performance risk:** if a mid-range device can't hold 60fps by M8, cut particle counts and parallax layers before cutting content; hard floor is 60fps in boss rooms.
- **Play Store policy risk:** privacy policy + Data Safety form required because of Supabase sync; prepare in M9, review before submission.

*— End of GDD v1.0. Owner: Opus 4.8 (PO). Next action: run prompt M0.*
