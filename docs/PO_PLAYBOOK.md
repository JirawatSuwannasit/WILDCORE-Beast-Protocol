# WILDCORE — PO Playbook
### Operating Guide for Opus 4.8: every prompt to send Claude Code & ChatGPT, from Day 1 to v1.0.0
*Companion to WILDCORE_GDD.md — this file is the "how to run the project" manual.*

---

## 0. How to Use This Playbook

**You (Opus 4.8) are the Product Owner & Prompt Engineer.** You never write code or draw art. You:
1. Send prompts in the exact order below (copy-paste, fill `{PLACEHOLDERS}`).
2. Review every output against its **✅ Review Checklist** before moving on.
3. If output fails review → use the **Fix Prompt Templates** in §6, never move forward on a broken foundation.
4. Escalate to the human owner only for: scope cuts, name/story changes, spending decisions.

**Golden rules**
- One milestone prompt at a time. Never batch M-prompts.
- Claude Code works on a branch → PR → **Vercel dev preview + debug APK artifact** → you review → merge. Never commit to main directly.
- **This is a mobile game.** The Vercel preview is for quick desk review only; the acceptance test is always **the debug APK on a real Android phone, played with thumbs.**
- All art for one category (e.g., all 8 bosses) is generated **in one ChatGPT session** to lock style.
- Every prompt to both AIs is **English only**.
- Keep a running `DECISIONS.md` in the repo: every deviation from the GDD gets one line.

**Two parallel tracks** (run simultaneously):
```
TRACK A (ChatGPT · Art):   A1 → A2 → A3 → A4 → A5 → A6 → A7
TRACK B (Claude Code):     M0 → M1 → M2 → M3 → M4×7 → M5 → M6 → M7 → M8 → M9
Sync point 1: A1–A3 must finish before M2 review (hero + savanna assets).
Sync point 2: All of Track A must finish before M8 (art integration).
```

---

# TRACK A — ChatGPT (Image Generation)

### Session discipline
- Start every session by pasting the **Master Style Prompt** + **Global Palette** (below) and say: *"Confirm you will apply this style block to every image in this session."*
- Generate → inspect → fix in the same session (style drifts across sessions).
- Save files with the exact names in each step (Claude Code depends on these names).

### Master Style Block (paste first, every session)
```
MASTER STYLE (apply to every image in this session):
Cozy pixel art for a 2D action platformer, 32-bit era (SNES/GBA quality),
warm dusk lighting, soft rounded silhouettes, limited harmonious palette
(max 24 colors per asset), clean 1px dark-brown outlines, gentle dithering,
no anti-aliasing, crisp pixels, transparent background PNG,
consistent side-view game perspective. No text, no watermark, no blur.

GLOBAL PALETTE (use these as the base of every asset):
Shadow ramp #2B1D2A #4A3B4F #7A6C86 #C9BAD1 · Amber #F5A742 · Coral #E8604C
Teal #5FB3A1 · Moss #7BA05B · Cream #F2E8D5 · Night #14201C
```

---

## A1 — Hero: KITSU-01 "Ember" (Session 1)

**Prompt A1.1 — concept sheet first (never start with the sprite sheet):**
```
Character concept sheet for the game's hero: KITSU-01 "Ember", a small heroic
fox-inspired robot armor. Cream and amber plating with teal energy lines, big
expressive teal visor eyes, three segmented tail-thrusters, rounded cozy
proportions (2.5 heads tall). Show: front view, side view, back view, and one
action pose (mid-jump firing arm buster). 64px-scale character on a neutral
dark backdrop.
```
✅ *Review: silhouette readable at 32px? Fox identity clear? Palette matches? If yes →*

**Prompt A1.2 — lock and produce sprite sheet:**
```
This design is approved and LOCKED. Using exactly this character, produce a
32x32 pixel sprite sheet on a labeled grid, side view, transparent background:
idle (4 frames, gentle breathing), run (8 frames), jump rise, jump fall,
wall slide, dash (with motion lines), buster shot standing, buster shot
jumping, charge glow levels 1-3, hurt flinch, victory pose.
Identical proportions and palette in every frame.
```
Save as: `hero_ember_sheet.png` (+ keep the concept as `hero_ember_concept.png`)

**Prompt A1.3 — projectiles & effects:**
```
Same character universe. 16x16 and smaller pixel effects on a labeled grid:
buster shot (3 frames), charge shot level 2 (3 frames), charge shot level 3
(4 frames, amber-teal spiral), muzzle flash, hit spark (3 frames), dash dust,
landing dust, explosion small (4 frames), explosion large (6 frames).
```
Save as: `fx_common.png`

---

## A2 — The 8 Guardian Bosses (Session 2 — ALL in one session)

**Prompt A2.0 — batch concept pass first:**
```
Concept lineup, one image: all 8 Guardian boss robots standing in a row,
same scale (each ~64px tall), so I can check style consistency:
1 VOLT CHEETAH - gold plating, black circuit-dot spots, teal lightning mane
2 TIDE MANTA - deep teal manta ray, coral underglow, jellyfish-lamp lure
3 MAGMA RHINO - copper and charcoal rhino, glowing magma seams between plates
4 FROST OWL - ice-white owl, lavender accents, aurora-gradient wing membranes
5 GALE FALCON - sunset-orange falcon, cream chest, small prayer-flag scarf
6 VENOM MANTIS - moss-green mantis, bioluminescent pink joints
7 TERRA PANGOLIN - bronze pangolin, crystal-tipped scales, lantern chest-light
8 SHADOW PANTHER - matte black panther, neon violet claw-lines, glowing eyes
All: cool but friendly-menacing, readable silhouettes, cozy-heroic vibe.
```
✅ *Review: could you identify each animal from silhouette alone? Consistent rendering across all 8? Fix outliers now (§6.2) before continuing.*

**Prompt A2.1–A2.8 — one sprite sheet per boss (template):**
```
Boss #{N} {NAME} is approved and LOCKED from the lineup. Produce a 64x64 pixel
sprite sheet on a labeled grid, transparent background, side view:
idle (4 frames), {MOVE_1}, {MOVE_2}, {MOVE_3}, weakness-hit reaction
(exaggerated flinch), desperation stance (glowing cracks), gentle power-down
defeat (4 frames, lights dimming softly - not an explosion).
```
Fill-ins:
| N | NAME | MOVE_1 | MOVE_2 | MOVE_3 | File |
|---|---|---|---|---|---|
|1|VOLT CHEETAH|crouch-telegraph dash (3 f)|wall pounce arc|floor lightning sweep|`boss_volt_cheetah.png`|
|2|TIDE MANTA|sine-wave glide (4 f)|floor eruption burst|water-orb ring cast|`boss_tide_manta.png`|
|3|MAGMA RHINO|ram charge (4 f)|geyser stomp|horn rock-toss|`boss_magma_rhino.png`|
|4|FROST OWL|silent glide (4 f)|feather-fan throw|freezing screech|`boss_frost_owl.png`|
|5|GALE FALCON|dive-bomb (3 f)|tornado wing-wall|feather barrage|`boss_gale_falcon.png`|
|6|VENOM MANTIS|triple scythe combo (6 f)|ceiling hang + acid spit|grass-cloak fade|`boss_venom_mantis.png`|
|7|TERRA PANGOLIN|roll into ball (4 f)|burrow dive|spike-trail eruption|`boss_terra_pangolin.png`|
|8|SHADOW PANTHER|teleport flicker (4 f)|dark pounce|afterimage dash|`boss_shadow_panther.png`|

**Prompt A2.9 — boss projectiles:**
```
Same session, same style. 16x16 boss projectile sprites on one labeled grid:
lightning bolt segment, water orb (2 frames), magma rock, ice feather blade,
wind feather, acid droplet, stone spike, shadow slash arc. Plus each boss's
weapon-get icon at 16x16 (8 icons, element-colored, readable at small size).
```
Save as: `fx_boss_projectiles.png`, `ui_weapon_icons.png`

---

## A3 — Tilesets & Backgrounds (Sessions 3–4, split 4+4 stages)

**Prompt A3.x — per stage (template):**
```
Seamless 16x16 tileset for stage "{STAGE_NAME}" - {THEME_LINE}.
Labeled grid, transparent background. Include:
ground top + inner fill, left/right edges, 45-degree slopes, background wall
tile, 2 decorative props, hazard tile ({HAZARD}), animated strip (4 frames)
of {ANIMATED_ELEMENT}, moving lift platform (2 frames, 32x8, stage-themed),
ladder, checkpoint lantern (unlit + lit).
Palette anchored to: {STAGE_COLORS} plus the global palette.
```
**Prompt A3.x-b — matching parallax (same session, right after its tileset):**
```
Parallax background set for the same stage, 3 separate layers each 320x180,
seamless horizontal loop, transparent where layered:
LAYER 1 far: {FAR}, LAYER 2 mid: {MID}, LAYER 3 near: {NEAR}.
PLUS one VERTICAL SHAFT backdrop for the stage's climb/descent sections:
320x360, seamless VERTICAL loop, same palette and far-layer mood.
Dusk lighting consistent with the tileset above.
```
Fill-in table:
| Stage | THEME_LINE | HAZARD | ANIMATED | COLORS | FAR / MID / NEAR |
|---|---|---|---|---|---|
|Speedway Savanna|golden-hour solar highway over a grass sea|electric fence|speed-boost strip glow|gold #E8C558, moss|sunset sky / wind turbines / grass silhouettes → `tiles_savanna.png`, `bg_savanna.png`|
|Coral Reservoir|sunken cozy aquarium-city, glass tunnels|toxic urchin|jellyfish lamp pulse|teal, ice #BFE3EC|deep water glow / coral towers / glass tunnel frame → `tiles_reservoir.png`, `bg_reservoir.png`|
|Ember Foundry|warm forge village inside a volcano|lava surface|lava bubble pop|coral, amber|magma glow haze / copper pipes / hanging lanterns → `tiles_foundry.png`, `bg_foundry.png`|
|Aurora Observatory|snowy mountain observatory under auroras|icicle spikes|aurora ribbon shimmer|ice, lavender #B9A7D9|aurora sky / mountain ridge / dome + string lights → `tiles_observatory.png`, `bg_observatory.png`|
|Skyhaven Ruins|floating shrine islands at sunset|bottomless cloud gap edge marker|prayer flags waving|amber, cream|sunset clouds / far islands / rope bridge posts → `tiles_skyhaven.png`, `bg_skyhaven.png`|
|Bloom Greenhouse|overgrown biodome, bioluminescent flowers|toxic pool surface|glow-flower pulse|moss, pink #D97BAA|dome glass + stars / giant flowers / vine curtain → `tiles_greenhouse.png`, `bg_greenhouse.png`|
|Hollow Quarry|lantern-lit mine village in giant geodes|floor spikes|minecart wheel spin|bronze #C99A5B, lavender|crystal cavern glow / geode walls / rail scaffolds → `tiles_quarry.png`, `bg_quarry.png`|
|Eclipse District|neon night market under permanent eclipse|neon sign live wire|rain puddle ripple|violet #9B6BD4, coral|eclipse sky + neon haze / rooftops + signs / lantern strings → `tiles_eclipse.png`, `bg_eclipse.png`|

Save each stage's vertical shaft backdrop as `bg_{stage}_shaft.png`.

---

## A4 — Enemies & Mid-bosses (Session 5)
```
Pixel enemy pack, 16x16 to 32x32, labeled grid per stage, 2-4 frames each,
transparent background. EVERY enemy must include one clearly readable
telegraph/wind-up pose matching GDD §3b (e.g. lens flash, pre-hop spark,
petal opening, wiggle, rear-up, eye glow, tail-light blink).
Cozy-menacing critter robots matching each stage:
SAVANNA: patrol drone, hopping spark bug, turret sunflower
RESERVOIR: bubble crab, dart fish, anglerfish lamp mimic (mid-boss, 48x48)
FOUNDRY: slag blob, ember bat, slag golem (mid-boss, 48x48, re-forming frames)
OBSERVATORY: snowball roller, frost wisp, frost lens turret (mid-boss)
SKYHAVEN: kite drone, cloud puff mine, kite serpent (mid-boss, segmented)
GREENHOUSE: seed spitter, vine crawler, pitcher-plant (mid-boss, swallow anim)
QUARRY: rock beetle, crystal bat, drill beetle on cart (mid-boss)
ECLIPSE: lantern ghost bot, rooftop cat drone, neon sign chimera (mid-boss)
```
Save as: `enemies_{stage}.png` × 8

## A5 — UI Kit (Session 6)
```
Complete pixel UI kit on labeled grids, transparent background:
1. HP bar: 16 amber cell segments in a cream pixel frame, vertical, plus
   damage-flash and heal-fill states.
2. Weapon energy bar (element-tintable gray version) + boss HP bar (coral).
3. Dialogue box 288x64 with small fox emblem corner, plus name tag plate.
4. Menu cursor (paw print, 2-frame bounce), pixel heart chip icon,
   cell pack canister icon, capsule mini-icons (head/body/arms/legs).
5. Stage Select screen mock 320x180: 3x3 grid, 8 boss portrait frames around
   a center fox emblem, cozy night-sky backdrop.
6. Boss portrait set: all 8 bosses as 32x32 face portraits (normal + defeated
   gray-out versions) matching the lineup from our boss session.
7. Title logo: "WILDCORE" as chunky pixel lettering, amber with teal edge
   glow, subtitle plate "BEAST PROTOCOL". (Text allowed for this asset only.)
8. TOUCH CONTROL sprites (designed to sit over gameplay at ~50% opacity):
   d-pad, floating-stick base + nub, three round buttons A/B/C with paw-pad
   motif (idle + pressed states), weapon-swap arrows, pause icon. Cream
   line-art style, readable but unobtrusive over any stage palette.
9. Google Play assets: adaptive app icon (Ember face emblem, foreground +
   background layers, 512x512 master), feature graphic 1024x500 (Ember and
   the 8 guardians lineup at dusk), splash screen 1920x1080 (logo on night
   palette).
```
Save as: `ui_kit.png`, `ui_portraits.png`, `ui_stageselect_mock.png`, `logo.png`, `ui_touch_controls.png`, `store_icon.png`, `store_feature.png`, `store_splash.png`

## A6 — Story & Capsule Assets (Session 7)
```
1. Armor Capsule: glass pod with amber hologram glow, 32x48, idle (4 frames)
   + opening (6 frames), transparent background.
2. Dr. Maple Sylva hologram: kind elderly engineer, maple-leaf hairpin, warm
   amber hologram tint, 48x48 bust, 3 expressions (warm smile / concerned /
   proud), plus full-body 32x64 hologram sprite.
3. The 4 armor pieces as pickup sprites 24x24 (head/body/arms/legs) and
   Ember wearing progressive armor: 4 variant 32x32 idle sprites
   (base -> +legs -> +legs/body -> full set, plating shifts amber->gold).
4. Intro cutscene stills, 320x180, 4 images: (a) Faunaterra vista at dusk,
   (b) APEX's eye awakening in the citadel, (c) the 8 guardians corrupted
   (silhouettes with red eyes), (d) Dr. Sylva activating little Ember.
```
Save as: `capsule.png`, `npc_sylva.png`, `hero_armor_variants.png`, `cutscene_intro_[a-d].png`

## A7 — Final Boss Pack (Session 8)
```
1. Twin Prototype Frames: wolf (steel blue) and raven (charcoal violet),
   48x48 each, idle + 2 attacks + defeat, designed to read as a duo.
2. PRIME FRAME: a taller, sleeker mirror of hero Ember (silver/violet),
   32x48, mirroring the hero's moveset: idle, run, dash, wall kick,
   charge shot, defeat.
3. APEX Phase 1: massive chimera frame 128x128 - cheetah legs, manta wings,
   rhino chest, owl head-crest, panther tail; idle (4 f), per-limb attack
   telegraph frames, damage states (cracks spreading).
4. APEX Phase 2: exposed floating core 48x48, pulsing violet-to-coral,
   shield ring (3 f), desperation flicker, final shutdown (8 f, fading to
   a tiny warm ember of light).
5. Ending stills, 320x180, 3 images: guardians rebooting with soft eyes /
   Faunaterra blooming / Ember and Dr. Sylva watching sunrise.
```
Save as: `boss_twins.png`, `boss_prime.png`, `boss_apex_p1.png`, `boss_apex_p2.png`, `cutscene_end_[a-c].png`

### ✅ Track A master checklist (before handing to M8)
- [ ] Every file named exactly as specified, PNG, transparent bg
- [ ] Hero readable at 32px on both light & dark stage tiles
- [ ] All 8 bosses share rendering style (lineup test passes)
- [ ] Each tileset tiles seamlessly (test-tile 3×3 in any editor)
- [ ] No stray anti-aliasing / off-palette colors (spot check with color picker)

---

# TRACK B — Claude Code (Sonnet 5)

### Standing instructions (send once, before M0)
```
You are the sole programmer on WILDCORE, a Mega Man-style MOBILE action
platformer for Android (Google Play), built with Phaser 3 + TypeScript +
Capacitor and developed on GitHub. The full design spec is in /docs/GDD.md -
treat it as the source of truth. Rules for all future tasks:
1. Work on a feature branch per milestone, open a PR, never push to main.
2. Every PR: passes typecheck + tests, zero console errors, includes a
   Vercel web preview link (dev review), a debug APK build artifact
   (device testing), and a short "how to test" note.
3. TOUCH IS THE PRIMARY INPUT. Every feature must be designed and tested
   for touch first; keyboard/gamepad are secondary paths through one input
   abstraction. Respect landscape lock, safe-area insets, and app-pause
   lifecycle in every scene.
4. All gameplay tuning values live in config files (src/config/*), never
   hardcoded, so the product owner can tweak without code changes.
5. Use placeholder colored rectangles until told to integrate final art.
6. Performance floor: 60fps on a mid-range Android WebView. Pool objects,
   use atlases, and flag anything that risks the budget in the PR.
7. When a requirement is ambiguous, choose the interpretation that favors
   PRECISION GAME FEEL (fair hitboxes, readable telegraphs, fast retry)
   and note the decision in DECISIONS.md.
Confirm you have read /docs/GDD.md before starting M0.
```
*(First action: commit `WILDCORE_GDD.md` into the repo as `/docs/GDD.md`.)*

## M0 — Bootstrap (mobile-first)
```
M0: Create the project skeleton.
- Phaser 3 (latest) + TypeScript + Vite, project name "wildcore".
- Game config: 320x180 native, integer zoom scaling, pixelArt: true,
  Arcade Physics, fixed 60Hz logic step with render interpolation.
- Capacitor 6: add the Android platform; lock landscape orientation;
  immersive fullscreen; Haptics + App plugins; safe-area inset handling
  (letterbox-extend backgrounds beyond 16:9 up to 21:9).
- Auto-pause game loop and audio on app background / incoming call.
- Scene flow: Boot -> Title -> StageSelect -> Stage (empty stubs OK).
- Tooling: ESLint + Prettier + Vitest; GitHub Action on PR: typecheck +
  tests -> Vercel web preview -> build debug APK as workflow artifact.
- README with run / build / install-APK-on-device instructions.
Deliver: PR + Vercel preview + debug APK showing the Title stub.
```
✅ *Review: install the APK on a real phone — fullscreen landscape, crisp pixels, no letterbox glitch on your device's aspect ratio, backgrounding pauses cleanly. CI green.*

## M1 — Player Controller + Touch Input ⭐ (do not rush this review)
```
M1: Implement the player controller in src/actors/Player.ts per GDD §2.2/§2.5.
- Run 90 px/s constant; variable jump (min 2 tiles / max 3.5 tiles);
  wall slide + wall kick; dash STUB (disabled flag, enabled later by Legs).
- 6-frame coyote time; 6-frame input buffer for jump and dash.
- Hurtbox = 70% of sprite bounds; 1s post-hit invulnerability with flicker;
  knockback 4px hop away from damage source.
- Buster: max 3 shots on screen; hold-to-charge 0.5s (Lv2) / 1.2s (Lv3 -
  locked behind Arms flag).
- TOUCH CONTROLS (primary input) in src/systems/input.ts per GDD §2.2b:
  left floating virtual stick OR fixed d-pad (runtime switchable);
  right buttons A Jump / B Shoot(hold=charge) / C Dash + weapon-swap
  arrows; >=48dp targets; multi-touch safe (jump while holding charge);
  same 6-frame buffers as physical input; hold-to-auto-fire option;
  layout config in src/config/touchLayout.ts.
- One input abstraction also serving Bluetooth gamepad and keyboard.
- Graybox gym scene: flat ground, stairs, 1/2/3-tile gaps, walls for kick
  chains, spikes, moving platform, target dummy with HP.
- Debug overlay (F3 / three-finger tap): hitboxes, state, velocity,
  coyote/buffer indicators, touch zones.
- Vitest: coyote window, buffer window, variable jump heights, input
  abstraction mapping.
Deliver: PR + preview + debug APK of the gym.
```
✅ *Review — play the gym ON A PHONE with thumbs for 15+ minutes: can you chain wall kicks comfortably? charge while jumping? Any death/clip feels unfair, any thumb strain → fix now. This controller is the whole game.*

## M2 — Vertical Slice: Speedway Savanna
```
M2: Build the complete Speedway Savanna stage per GDD §3.1.
- Tiled JSON map at src/data/stages/speedway.json (author it yourself with
  placeholder tiles): intro area -> speed-strip section -> timed collapsing
  bridges -> electric fence rhythm section -> mid-boss arena -> vertical
  wall-kick section (hide a marked LEGS CAPSULE alcove, pickup stubbed) ->
  pre-boss corridor -> boss room.
- 3 enemies (patrol drone, spark bug, turret flower): every attack has a
  >=20-frame wind-up with a placeholder color flash.
- Checkpoints: start / midpoint / pre-boss; respawn < 1.5s, enemies reset.
- Camera: follow with 16px horizontal look-ahead, locked in boss room.
- Boss door shutter sequence + VOLT CHEETAH: 16-unit HP with fill ritual;
  patterns: (a) crouch-telegraphed dash at 3 speeds, (b) wall pounce,
  (c) floor lightning sweep; desperation combo under 25% HP; weakness-hook
  interface (takesWeakness(weaponId) -> interrupt + 4 dmg) stubbed;
  defeat -> power-down -> weapon-get screen stub -> return to StageSelect.
Deliver: PR + preview, plus a 60-second suggested playtest route in the PR.
```
✅ *Review: full run buster-only. Timer: death→retry under 1.5s. Every trap visible before it can kill.*

## M3 — Weapons & Weakness Wheel
```
M3: Implement src/systems/weapons.ts + data/weaknessWheel.ts per GDD §5.
- 8 weapons with distinct projectile behavior and energy costs:
  Volt Chain (bolt, chains to 1 enemy), Tide Burst (lobbed splash arc),
  Magma Charge (piercing ram-shot carrying the player 24px), Frost Talon
  (shuriken; freezes minor enemies into solid 1-tile platforms for 3s),
  Gale Cutter (boomerang, returns), Venom Sting (sticky dart, DoT, one per
  enemy), Terra Spike (ground wave traveling floor->walls), Umbra Claw
  (short dash-slash, 10 i-frames).
- Utility hooks as tagged interactions: power / douse / melt / freeze /
  cut / corrode / quake / phase - stages declare tagged objects.
- Weakness data-driven: weakness hit = 4 dmg + interrupt + reaction anim key.
- Q/E cycle + pause weapon wheel UI (placeholder icons).
- Vitest: wheel mapping matches GDD table §5 exactly; energy math.
Deliver: PR + gym updated with one test target per utility tag.
```

## M4 — Stages 2–8 (seven prompts, one per stage)
Use this template; fill from the GDD §3 and the table below. **Send one stage, review, then the next.** Order: Reservoir → Foundry → Observatory → Skyhaven → Greenhouse → Quarry → Eclipse.
```
M4.{N}: Build the complete {STAGE} stage per GDD §3.{X}, meeting the stage
length standard in GDD §2.6 (28-36 screens, 9-beat structure, route-shape/
verticality rules, 4 checkpoints)
and the same structural standard as Speedway (telegraphs, camera, boss door
ritual).
- Signature gimmicks: {GIMMICKS}
- Route shape: implement the "Route shape" spec in GDD §3.{X} exactly
  (branch & rejoin, ascent shaft, descent, multi-floor room); include an
  ASCII route map and the vertical-path percentage in the PR.
- Enemies: {ENEMIES} - stats and behavior exactly per GDD §3b (Enemy
  Roster), all telegraphed >=20 frames.
- Mid-boss: {MIDBOSS}.
- Secret: {SECRET} (gate checks inventory; show a readable "locked" hint
  when the player lacks the required weapon).
- Boss {BOSS}: patterns (a) {P1}, (b) {P2}, (c) {P3}; desperation under 25%;
  weakness = {WEAKNESS} via the M3 hook.
Deliver: PR + preview + suggested playtest route.
```

**MANDATORY for every M4.{N} PR:** include the GDD §2.7 Per-Stage Build &
Verification Checklist as a filled-in report — all terrain %, direction-change
count, longest same-direction run, per-screen surface heights, ascent/descent/
multi-floor/branch screen ranges, per-beat encounter list, gimmick-usage
screens, and max gap width. The PO will not review the APK until this report
is in the PR. If any item fails, fix before requesting review. Append this
line to the M4 prompt when sending it:
```
Also produce the GDD §2.7 Per-Stage Build & Verification Checklist as a
filled-in report in the PR (terrain %, direction changes, longest same-dir
run, per-screen surface heights, ascent/descent/multi-floor/branch screen
ranges, per-beat encounters, gimmick-usage screens, max gap width). Do not
request review until every §2.7 item passes.
```

| N | STAGE | Key gimmicks | Secret | Weakness |
|---|---|---|---|---|
|1|Coral Reservoir|valve water levels, currents, underwater float physics|BODY CAPSULE (Volt Chain pump)|Volt Chain|
|2|Ember Foundry|rising lava chase, railed crushers, heat vents|Heart Chip + Cell Pack #1|Tide Burst|
|3|Aurora Observatory|ice slide physics, breakable icicles, sight-snowfall|HEAD CAPSULE (Magma Charge wall)|Magma Charge|
|4|Skyhaven Ruins|gust cycles w/ leaf particles, collapsing tiles, pits|Heart Chip + Cell Pack #2|Frost Talon|
|5|Bloom Greenhouse|toxic DoT pools, bounce flowers, flowering vines|Rusted vault (Venom Sting, revisit)|Gale Cutter|
|6|Hollow Quarry|minecart rail-jumps, cracking floors, dig-walls|Heart Chip + Cell Pack #3|Venom Sting|
|7|Eclipse District|lantern light radius, rain-revealed platforms, parkour|ARMS CAPSULE (Gale Cutter + dash)|Terra Spike|

✅ *After M4.7 — SCOPE GATE: if total elapsed effort is over budget, decide with the human owner: ship 6 stages (cut Greenhouse & Quarry to v1.1, shrink the wheel) per GDD §13.*

## M5 — Stage Select, Saves, Supabase
```
M5: Implement meta progression per GDD §8.
- StageSelect scene: 8 portrait slots, cleared state (gray + checkmark),
  selection jingle stub, shows collected capsules/chips/packs summary.
- src/systems/save.ts: local-first localStorage, 3 slots, exact GDD §8
  schema; auto-save on boss clear / capsule get / stage exit; manual save
  at StageSelect.
- Supabase: migrations for profiles, saves (jsonb, RLS: owner-only),
  leaderboard_runs (clear_time_s, buster_only bool, no_armor bool).
  Anonymous auth by default; background sync; conflict rule: highest
  play_time_seconds wins. Env vars via .env, documented in README.
- Settings menu: music/sfx volume, screenshake toggle, key rebinding,
  persisted in the save slot.
- Vitest: save round-trip, migration of empty->v1 schema, conflict rule.
Deliver: PR + preview with Supabase project connected (I will provide keys).
```

## M6 — Armor Capsules & Collectibles
```
M6: Implement the capsule system per GDD §6.
- Four capsules at the M2/M4 marked locations with Dr. Sylva hologram
  dialogue (text placeholder, 2-3 lines each, warm tone).
- Powers: LEGS dash + air-dash(requires Arms too) + one spike-hit save per
  checkpoint; BODY -25% dmg + no knockback from small hits; HEAD secret-
  radar chime within 3 tiles of hidden rooms + 30% faster charge;
  ARMS charge Lv3 + charged variants of all 8 boss weapons (define one
  charged behavior each, keep them simple upgrades).
- Full set: SYLVA OVERDRIVE - once per stage screen-clear burst, big
  placeholder flower VFX.
- 8 Heart Chips (+2 max HP) and 4 Cell Packs (stored full heal, usable from
  pause) placed per GDD, persisted in saves.
Deliver: PR + preview + a debug menu (F4) to grant/revoke items for testing.
```

## M7 — APEX Citadel
```
M7: Build the finale per GDD §7.
- Three consecutive stages, no mid-run saving; quitting returns to
  StageSelect and resets Citadel progress. Checkpoints within stages only.
- CITADEL GATE: remix gauntlet - 8 short rooms, one per stage gimmick;
  boss: Twin Prototype duo (wolf: ground rush patterns / raven: air dive
  patterns; sharing one 24-unit HP pool, enrage when solo).
- CORE SPIRE: vertical wall-kick ascent with rising purge light (touch =
  death, speed tuned in config); boss: PRIME FRAME mirror fight using the
  player's own tuned moveset values.
- THE MENAGERIE: 8-teleporter boss rush (refights use existing bosses;
  full weapon-energy pickup between fights) -> APEX Phase 1: 128px chimera,
  each limb attacks with its origin-boss telegraph (cheetah dash legs,
  manta wing sweep, rhino chest ram, owl crest freeze, panther tail swipe),
  destroy limbs in any order -> Phase 2: buster-only floating core in a
  collapsing chamber (falling debris, shrinking floor).
- Ending sequence + credits: clear time, collectible tally; unlock NG+
  flag in save (bosses gain a 4th pattern - implement as +1 pattern slot,
  patterns themselves may be simple remixes).
Deliver: PR + preview + full-run video or gif if tooling allows.
```

## M8 — Art & Audio Integration + Feel Pass
```
M8: Replace all placeholders with the final asset pack in /public/assets
(file names per the art manifest in /docs/ART_MANIFEST.md).
- CRITICAL: keep all existing hitbox/hurtbox sizes - align sprites to
  boxes, never resize boxes to sprites.
- Build texture atlases; wire all animations; parallax 3-layer backgrounds
  per stage; UI kit integration; title screen with logo.
- Audio: wire music per stage as OGG intro+loop (placeholder tracks OK if
  final music not ready - keep a swap-ready manifest), SFX for every
  player/enemy/UI action.
- Integrate the final touch-button sprites from the UI kit (paw-styled,
  semi-transparent, per touchLayout.ts) and wire haptics per GDD §2.2b:
  light on charged hit, medium on damage taken, strong on boss defeat,
  all toggleable in settings.
- Feel pass per GDD §2.5: hitstop 3f charged / 8f weakness; toggleable
  screenshake; landing dust; dash afterimages; low-HP heartbeat vignette;
  boss intro letterboxing.
Deliver: PR + preview + debug APK. I will do a full visual QA against the
art manifest on a real device.
```
*(Before M8: have Claude Code generate `/docs/ART_MANIFEST.md` listing every expected file name from Track A — prompt: "Generate an art manifest table from GDD §10 and the Track A file names in /docs/PO_PLAYBOOK.md".)*

## M9 — QA & Google Play Release
```
M9: Release hardening for Google Play.
- Screen QA: UI and touch controls verified at 16:9, 18:9, 19.5:9, 21:9;
  safe-area insets respected; controls hide when a gamepad connects.
- Performance: object pooling (projectiles, particles, popups), atlas
  audit, stable 60fps on a mid-range Android; report frame times per stage.
- Battery/thermal: cap off-screen updates; suspend particles while paused.
- Validation runs (scripted-input tests where feasible, manual notes
  otherwise): (a) buster-only full clear possible, (b) no-capsule full
  clear possible, (c) every secret reachable with its stated gate and NOT
  without it, (d) full game completable on touch only.
- Play Store package in /store: adaptive app icon, splash screen, feature
  graphic + screenshot templates, privacy policy page (disclose Supabase
  cloud saves), Data Safety form answers in /store/data-safety.md.
- Release pipeline: GitHub Actions builds a signed AAB (keystore from repo
  secrets), auto-increments versionCode, uploads to the Play internal
  testing track on tag.
Fix all P0/P1 from my QA sheet, tag v1.0.0.
Deliver: internal-testing AAB link + release notes for Play Console
submission.
```

---

## 5. Review Cadence & Definition of Done (every PR)
1. CI green, zero console errors; both artifacts present: Vercel preview + debug APK.
2. Quick desk check on the Vercel preview, then **install the APK and play the PR's "how to test" route on a real phone with thumbs** — the APK run is the acceptance test.
3. Check against the milestone's ✅ list and GDD feel pillars (§2.5), including thumb comfort and safe-area layout on your device.
4. Any tuning tweak → request via §6.1 template (don't accept "feels ok").
5. Merge → immediately send the next prompt. Log deviations in DECISIONS.md.

## 6. Fix Prompt Templates

**6.1 Tuning change (Claude Code):**
```
TUNING: In {file}, change {parameter} from {old} to {new}.
Reason: {observed feel problem}. No other changes. Update the PR.
```
**6.2 Art regeneration (ChatGPT, same session):**
```
Revision for {FILE}: keep the exact same character/design and palette, but
fix: {ISSUE - e.g. "frames 3-5 break the 1px outline rule", "colors drift
from the global palette", "silhouette unreadable at game scale"}.
Regenerate only the affected part as the same labeled grid.
```
**6.3 Art consistency rescue (new ChatGPT session, style drifted):**
```
[Paste Master Style Block] Here is the approved reference: {attach approved
image}. Match this rendering style EXACTLY - same outline weight, dithering
amount, and palette - and produce: {asset request}.
```
**6.4 Bug report (Claude Code):**
```
BUG ({P0|P1|P2}): {one-line summary}
Repro: {steps} · Expected: {x} · Actual: {y} · Where: {stage/scene}
Suspected area: {file if known}. Fix on the current branch, add a
regression test if testable, update the PR.
```
**6.5 Feel violation (Claude Code):**
```
FEEL VIOLATION of GDD §2.5 pillar {n}: {description, e.g. "spike pit after
checkpoint 2 in Foundry kills before it scrolls into view"}.
Redesign the section so the hazard is readable before it can kill.
```

## 7. Escalate to the Human Owner When…
- The M4.7 scope gate suggests cutting to 6 stages.
- Any name, story beat, or boss identity needs changing.
- Supabase/Vercel plan limits or costs appear.
- **Google Play matters:** creating the Play Console developer account ($25 one-time), generating/holding the signing keystore, filling the Data Safety form, and pressing "submit for review" are all human-owner actions — prepare everything, then hand over.
- A mid-range test device can't hold 60fps after the M8 optimization pass.
- Two consecutive fix cycles fail on the same issue (get a human decision).

*— End of PO Playbook v1.0. First actions: commit GDD to /docs, send Standing Instructions + M0 to Claude Code, open ChatGPT Session 1 with the Master Style Block + A1.1.*
