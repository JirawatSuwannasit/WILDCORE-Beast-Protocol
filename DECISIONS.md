# DECISIONS

Running log of deviations from `docs/GDD.md`, and judgment calls made where a requirement was
ambiguous. One entry per decision, newest first.

## Investigation — pixel-crispness check (no code change)

- **Question:** whether the render pipeline correctly integer-scales a 320x180 native pixel-art
  canvas, or whether the softness visible in the placeholder UI is a scaling/filtering bug
  affecting all rendering.
- **Finding: render pipeline is correct; the softness is entirely category (a) - placeholder
  system text, not a scaling bug.** Confirmed every relevant setting in `src/config/gameConfig.ts`:
  `pixelArt: true`, `antialias: false`, `roundPixels: true`, `scale.mode: Phaser.Scale.FIT` +
  `zoom: Phaser.Scale.MAX_ZOOM` (integer-only zoom, already documented under "Integer-zoom scaling"
  above), plus `image-rendering: pixelated` on the canvas element in `index.html` as a CSS-layer
  backstop. `getRectTexture` (the placeholder-sprite generator) draws solid-fill rectangles via
  `Graphics.generateTexture`, which have no internal edges to anti-alias.
- **Verified visually, not just by reading config.** Headless Playwright screenshot at a 3x integer
  zoom (960x540 viewport, exact 16:9): the Title scene's placeholder rectangle and a tight crop on
  the Gym scene's player sprite both show pixel-perfect hard edges with zero blur. The "WILDCORE"
  and "TAP TO START" labels in the same screenshot are visibly anti-aliased - this is the same
  frame, same renderer, same zoom, so the difference is the content, not the pipeline.
- **Why text looks different even though it's drawn through the same crisp pipeline.** Every text
  string in the codebase (`grep` across `src/` - debug overlay, title, stage select, pause banner,
  touch button labels, target-dummy HP) goes through Phaser's standard `scene.add.text(...)` with
  `fontFamily: 'monospace'`. Phaser rasterizes `Text` game objects via the browser's native
  `CanvasRenderingContext2D.fillText` onto an offscreen texture first, then draws that texture like
  any sprite - so the anti-aliasing is baked into the source pixels of the text texture by the
  browser's font renderer, before the pixel-art pipeline ever touches it. `pixelArt`/`antialias`/
  `roundPixels` govern how existing texture pixels are *sampled and positioned*, not how a texture
  gets *rasterized* in the first place, so they can't and don't affect this. This exactly matches
  what the GDD already schedules: the placeholder system font is a stand-in until the M8 UI-kit
  pixel bitmap font (rasterized as fixed pixel glyphs, no font-engine anti-aliasing) replaces it.
- **No action taken.** No config or art changes - this was a confirm-only check per the request.

## Bugfix — Speedway gaps exceeding base-kit jump reach (GDD §2.5 pillar 1 / §2.2)

- **The violation, and how it was found.** A flat-ground jump has a hard physics ceiling: with
  `gravity=900`, `run.speed=90`, and a max-height jump (`maxHeightTiles=3.5` → launch velocity
  `-√(2·900·56) ≈ -317.5px/s`), full flight time to a level landing is `2·317.5/900 ≈ 0.706s`,
  giving a maximum level-ground jump reach of `90·0.706 ≈ 63.5px ≈ 3.97 tiles` - and a wall-kick
  (140px/s kick burst for 6 frames, then 90px/s) does only marginally better, `≈68.5px ≈ 4.28
  tiles`. Wrote a script to scan every column of `speedway.json`'s ground layer for the topmost
  solid tile, group runs of fully-empty columns into gaps, and compare each gap's required
  horizontal distance against these two ceilings (adjusted for elevation delta between the takeoff
  and landing edges). Found **7 gaps wider than either ceiling** - all a generator artifact from
  M2-REBUILD-2, not an intentional design choice (nothing in `DECISIONS.md` or the PR #11 writeup
  describes these as deliberate skill gates, and no speed-strip or other assist sits near any of
  them).
- **Fixes applied, before → after (all widths in tiles; `flat` = D=0, same-height landing):**

  | Location | Before | After | Fix |
  |---|---|---|---|
  | Intro rise (cols 40-49) | 12-tile **sheer vertical wall** (192px, no ledge) feeding into an 8-tile flat gap | 6-step staircase (2 tiles/step, matches the guaranteed *min* jump height exactly) + 3-tile flat gap | Re-tiled: added 5 intermediate step columns, narrowed the gap |
  | Tutorial gap (cols 107-114) | 8-tile flat | 3-tile flat | Filled 5 of 8 gap columns |
  | Escalation/fork lower-band gap (cols 176-185) | 10-tile flat, **inside the band `DECISIONS.md` already documents as "continuous ground"** | 0 (fully closed) | Filled all 10 columns - narrowing wouldn't have matched the band's own documented "continuous, safe route" identity |
  | Final-exam gap (cols 481-488) | 8-tile flat | 3-tile flat | Filled 5 of 8 gap columns |
  | Ascent shaft, all 3 climbing bands (cols 247-254 / 257-264 / 267-274) | 8-tile **wall-kick corridor** per band (68.5px max kick reach vs. 128px required - impossible even with the wall-kick that's supposed to be mandatory here) | 3-tile corridor per band | Filled the innermost 5 of 8 open columns per band, keeping the outer (already-shared, zigzag-connecting) wall untouched |

  All narrowed values land at 48px required vs. 63.5-68.5px available (~30-40% margin) - not
  pixel-perfect, no dash required (still locked). The two existing 4-tile *descending* gaps (cols
  60-63, cols 520-523 - landing 8 rows lower, which extends flight time) were re-checked and left
  alone: 64px required vs. ~89-94px available, already comfortably safe.
- **Verified against real physics/collision, not just the formula.** Headless Playwright against a
  live dev build: teleported the player to the approach side of each of the 4 non-shaft fixes and
  ran a real run+jump (hold right, tap jump) through actual Arcade collision - all 4 landed clean.
  For the shaft, teleported the player airborne against each band's (new) left wall and triggered a
  real `performWallKick` - confirmed each of the 3 narrowed bands is crossable with a single kick,
  landing on the correct band's wall. (A full bottom-to-top *chained* multi-kick climb, scripted via
  simulated key timing, didn't cleanly reproduce in the harness - not a geometry problem, since
  each individual band and the tile data between them checked out with no structural obstruction,
  but real chained-kick *timing* is a feel/skill question a keyboard-scripted harness can't stand in
  for. Same caveat PR #11 already flagged for this shaft: needs a real device playtest.)
- **Re-ran every pre-existing route-shape regression** (elevation-band collision, fork upper/lower
  hazard spacing, ascent-shaft camera lock, descent landing count, Legs Capsule pickup, checkpoint
  order/respawn, full boss sequence, ~18s real-input traversal smoke) after the tile edits - all
  still pass, zero console errors. Map dimensions, section boundaries, and checkpoint count are
  byte-identical to before (only tile GIDs inside existing columns changed - no columns added or
  removed, so §2.6's screen count and route shape are untouched).

## Debug tool — world-position/tile/screen/landmark readouts

- **Temporary debug aid - remove before v1.0.** The new `pos:`/`tile:`/`screen:`/`near:` lines in
  `DebugOverlay` are for stage authoring/QA only, not part of the player kit or GDD design - same
  category as the double-jump toggle above.
- **Gated behind `debugBuildEnabled`, same two-guard pattern as the double-jump toggle.** The
  lines are only pushed into the overlay's text array when `debugBuildEnabled` is true (local dev
  and the `--mode debug` CI build); the existing state/vel/grounded/etc. lines are unaffected and
  stay ungated. Verified headlessly against both a default `vite build` and `vite dev`: the four
  new lines are entirely absent from the production overlay text and present/correct in the dev
  one.
- **Reused existing constants instead of duplicating magic numbers.** `tile:` divides by the
  existing `TILE_SIZE` (`src/config/playerTuning.ts`); `screen:` divides by the existing
  `GAME_WIDTH` (`src/config/resolution.ts`, already 320px, exactly GDD §2.6's screen-width unit)
  rather than introducing a second 320 constant. `screen:` is reported 1-indexed (`screen: 1` at
  the stage's leftmost screen) to match how the route-shape docs/DECISIONS entries above already
  count screens.
- **`near:` sources landmarks from both Tiled object layers, not just checkpoints.** The prompt
  said "checkpoint/beat id" - `BaseStageScene` now builds one combined landmark list from the
  `checkpoints` layer (already loaded) and the `sections` layer (the beat-tagged layer used
  throughout `SpeedwayScene`/M2-REBUILD-2, e.g. `intro`, `escalation`, `midboss`), using each
  object's Tiled `name` as the id and its x-center as position, and just picks whichever is
  nearest by x - no separate "checkpoint vs. beat" precedence was needed since they already live
  on the same horizontal axis. `GymScene` (no checkpoints/beats) passes none; the `near:` line
  simply doesn't print when the landmark list is empty, rather than printing something empty or
  `N/A`.
- **No gameplay changes.** Everything here is additive to `DebugOverlay`'s text output and a new
  optional 4th constructor parameter (default `[]`) - no scene logic, physics, or existing overlay
  behavior changed. Confirmed via the full verification chain (typecheck/lint/format/test/build)
  plus a headless Playwright check of the actual `pos`/`tile`/`screen`/`near` values against known
  player coordinates in both build modes.

## M2-REBUILD-2 — Speedway Savanna re-authored for the route-shape (anti-corridor) rule

- **What a "screen" means on each axis, made explicit.** §2.6 defines a screen as "one native view, 320px" - but the native view is 320×180, and only the *horizontal* dimension is 320px. Vertically, one native view is 180px. Read literally, a vertical "screen" of ascent/descent is therefore ~11.25 tiles (rounded to 12 for clean tile math, 192px), not 20 tiles/320px - "vertical shafts count by height" only makes sense as a distinct, shorter unit from the horizontal one, since a shaft's job is to fill the *vertical* extent of a viewport, not the horizontal one. Adopted 20 tiles (320px) per horizontal screen and 12 tiles (192px) per vertical screen throughout. This also explains why 34 screens now total ~9,216px instead of the ~10,880px a purely-horizontal 34-screen stage would produce: 13 of the 34 are the shorter vertical kind by design, not a shortfall.
- **Screen budget stayed put; only the shape changed.** Kept the exact beat-to-screen allocation from M2-REBUILD (intro 3, tutorial 5, escalation 5, mid-boss 1, remix 6, setpiece 5, breather 2, final exam 5, pre-boss 2 = 34 screens) and the same §3b enemy/hazard roster and density targets - this pass only touched *where* those screens sit in 2D space, per the prompt's own scope ("this pass fixes the LAYOUT SHAPE only").
- **The route is authored as a per-screen direction sequence, verified mechanically, not eyeballed.** Every one of the 34 screens is tagged R/U/D up front; a generator script walks the sequence building tiles, and prints the axis-mix percentage, the longest same-direction run, and the direction-change count on every run - the same discipline as M2-REBUILD's hazard-debut-ordering check, because at this scale (94 rows × 606 columns, 6 kinds of special geometry) eyeballing the numbers is not credible. Final sequence: `RRUDRRURRRDRRRUUURRRDDDRDRRRURDRRR` - 38.2% vertical (target ≥35%), longest run 3 (target ≤3), 17 direction changes (target ≥4).
- **A real, code-derived elevation bug caught by hand-tracing wrong, then fixed by trusting the generator's own state instead of re-deriving it.** The first placement pass hand-computed "what row should this hazard sit at" independently of what the tile-builder actually did, and got it wrong (forgot that the intro beat's own trailing ascent already shifts the baseline before the tutorial beat even starts) - entities ended up floating over empty air. Fixed by having every screen the walk processes push a `{colStart, colEnd, row}` segment as it's built, and having all later entity/hazard placement code look up its row from that segment log instead of recomputing it from tuning constants. Added a placement-validation pass (every ground-anchored entity/checkpoint/pickup cross-checked against the actual tile data) that must pass before the generator writes the file - it caught not just that bug but several follow-on ones (an electric-fence debut landing 8 tiles from a spikes debut inside the fork span - a hazard-debut-ordering violation - and a camera-zone marker whose y went negative after the grid-normalizing row shift).
- **Mandatory ascent shaft:** the solar-pylon climb is exactly 3 consecutive U-tagged screens (36 tiles / 576px), reached right after the mid-boss arena (thematically, climbing the same pylon the twin drones circle) and opening onto a bridge-crossing plateau at the top. A `vertical camera zone` locks the camera's horizontal scroll to the shaft's center for the climb's duration (X-lerp set to 0, which is what makes `startFollow`'s own per-frame `scrollX += (target-scrollX)*lerpX` hold scrollX exactly still - no separate override system needed) and releases back to normal 2-axis follow on exit.
- **Controlled descent:** the boost-strip setpiece descends through 4 D-tagged screens with staged intermediate landings (2 per descent screen, offset left/right) rather than a single sheer drop, so every fall has a visible landing before the next one - satisfying "readable landings, no blind drops" without needing a bespoke slide/chute mechanic.
- **Branch & rejoin:** the turbine-tower fork opens with a short ascent (1 screen) into a 3-screen parallel span - an upper band of broken blade-platforms (patrol drone, pickup, precision jumps) and a lower band of continuous ground (the electric fence's debut) - and the upper band's floor simply stops 10 tiles before the span ends, so an upper-route player free-falls onto the lower band to rejoin; no separate "rejoin shaft" geometry was needed.
- **Multi-floor room:** the underpass breather is two full-width bands (obvious upper floor with drop-through gaps, continuous lower floor) converging at the same exit column. The Legs Capsule secret was moved off the old design's single wall-kick shaft in an otherwise ordinary breather stretch onto a short hidden alcove branching off the *lower* (less-obvious) floor specifically, matching the new rule's "secrets branch off the less obvious side" - a floor a casual player is more likely to have already dropped through and left behind than to backtrack into.
- **Boss room elevation moved.** The path's net elevation change over its whole length is +1 vertical screen (start baseline → one screen lower by the boss door - the ascent and descents don't cancel to exactly zero), so `BOSS_ROOM_FLOOR_Y`/`BOSS_ROOM_CAMERA_Y` in `SpeedwayScene.ts` needed updating again, same as the previous rebuild's lesson: these are read from the generated map's own object data, not hand-derived, specifically to avoid re-making that mistake.

### Route map (34 screens; `#` = path elevation, one column per screen)

```
-3 |                ####              |
-2 |               #    #             |
-1 |  #   ####    #      #            |
+0 |## ###    ####        ##    ##    |
+1 |                        ####  ####|
   +----------------------------------+
```

| Screens | Beat | Tags | Notes |
|---|---|---|---|
| 1-3 | Intro | RRU | Safe, sells the theme; ends on a small themed rise |
| 4-8 | Gimmick tutorial | DRRUR | Speed strip debuts harmless; ends at the turbine-tower fork entrance |
| 9-13 | Escalation | RRDRR | Fork's parallel span + rejoin; spikes debut, gimmick+enemies combine |
| 14 | Mid-boss arena | R | Twin patrol drones around the pylon → checkpoint |
| 15-20 | Remix | UUURRR | **Mandatory ascent shaft**: 3-screen solar-pylon climb, then bridges on the plateau |
| 21-25 | Setpiece | DDDRD | **Controlled descent**: boost-strip chase down through staged landings → checkpoint |
| 26-27 | Breather + secret | RR | **Multi-floor room**; Legs Capsule branches off the lower floor |
| 28-32 | Final exam | RURDR | Hardest combination of everything taught |
| 33-34 | Pre-boss corridor | RR | Energy pickups → checkpoint → boss room |

## Docs sync — GDD route-shape (anti-corridor) rule + PO Playbook added

- **`docs/GDD.md`** synced with the new §2.6 "Route shape (anti-corridor rule)" subsection and a per-stage "Route shape" bullet in §3.1–3.8 (branch-and-rejoin, a mandatory wall-kick ascent shaft, a controlled descent, and a multi-floor room per stage, ≥35% of path length vertical). Diffed byte-for-byte against the uploaded source to confirm this is the only change - nothing else in the GDD moved.
- **`docs/PO_PLAYBOOK.md`** added (new file - no playbook previously existed in the repo). Linked from `README.md` alongside the existing GDD/DECISIONS links.
- **Known gap, not addressed in this PR:** Speedway Savanna was fully built in M2/M2-REBUILD *before* this route-shape standard existed. It doesn't currently implement §2.6's anti-corridor rules or §3.1's new Route shape bullet (branch-and-rejoin at the turbine tower, a 3-screen pylon ascent, a boost-strip descent setpiece, a multi-floor underpass breather) - it's still the flat-with-one-small-shaft layout from before. This is a docs-only sync per what was asked; reworking Speedway's layout to match is a separate, explicit task, same as M2-REBUILD itself was.

## Debug tool — traversal double-jump toggle

- **Temporary debug aid - remove before v1.0.** `debugFlags.doubleJump` (`src/systems/debugFlags.ts`), toggleable from the F3/three-finger debug overlay, is a testing tool only and is not part of the player kit or GDD design.
- **How "dev/debug builds only" is actually enforced.** Nothing in the existing pipeline previously distinguished a "debug" web build from the default one - the CI job that builds the debug APK just ran the same `npm run build` as everything else, and Vite's own `import.meta.env.DEV` is only true under `vite dev`, never under any `vite build` output (debug APK included). Introduced a new `--mode debug` Vite build (`npm run build:debug` / `cap:sync:debug`) that only the CI's `android-debug-apk` job uses; `debugBuildEnabled = import.meta.env.DEV || import.meta.env.MODE === 'debug'` is then true for local dev and that one CI job, and false for the default `npm run build` used by both the Vercel preview and the future signed-release-AAB pipeline. The toggle button in `DebugOverlay` is only ever *constructed* when this is true, and `toggleDebugDoubleJump()` is independently a no-op when it's false - two separate guards, not one.
- **Implementation stays a strict sibling branch, not a modification, of the real jump logic.** `Player.fixedUpdate`'s existing `grounded → coyote → wall-kick` chain is untouched; the debug path is a fourth `else if` after all three, gated on `debugFlags.doubleJump` (default false) and a one-shot `debugExtraJumpUsed` flag that only ever recharges on landing. Verified headlessly against both a default `vite build` and a `--mode debug` build: the toggle button doesn't exist at all in the former; in the latter, pressing jump mid-air with the flag off changes nothing (velocity byte-identical before/after), and with it on grants exactly one extra jump that a second mid-air attempt can't repeat.

## M2-REBUILD — Speedway Savanna at full Mega Man X scale (GDD §2.6)

- **Screen budget and the beat-to-screen allocation.** GDD §2.6 asks for 28-36 screens (20 tiles/screen) across a fixed 9-beat structure with per-beat screen ranges. Picked the midpoint of every beat's range so the total lands comfortably inside the window rather than right at an edge: intro 3, gimmick tutorial 4, escalation 5, mid-boss 1, remix 5, setpiece 5, breather 3, final exam 5, pre-boss 2 = 33 path screens (10,560px), plus a separate 1-screen boss room appended after (not counted toward the 28-36 - the standard's own wording frames it as "path" leading up to the boss room, and the original M2 stage already treated the boss room as outside the countable traversal). 33 screens / 10,560px sits centrally in both the 28-36 and 9,000-11,500px ranges, leaving margin either direction for future tuning without a full re-layout.

- **Hazard-debut ordering, made mechanical rather than eyeballed.** §2.6's "never two hazard types introduced in the same room" is a real constraint with four hazard types (speed strip, spikes, electric fence, collapsing bridge) now spread across a much bigger map, easy to violate by accident once density goes up. Handled it by giving each type exactly one dedicated debut screen with no other *new* hazard type within one screen-width (320px) of it, in this order: speed strip (gimmick tutorial, beat 2) → spikes (escalation, beat 3) → electric fence (escalation, beat 3, a separate screen from spikes) → collapsing bridge (remix, beat 5). Every later beat is free to recombine already-taught types, which is exactly what "escalation," "setpiece," and "final exam" are supposed to do. Verified this mechanically in the generator (and again in headless testing) rather than trusting it by inspection - at 50 hazard placements across 10,560px, eyeballing it reliably would not have been credible.

- **Pickups are stubbed collectibles, not a wired economy.** §2.6 asks for 8-12 pickups/stage as a density requirement, but the actual Heart Chip / Cell Pack / weapon-energy systems don't exist until M5/M6 per the GDD's own milestone roadmap, and this prompt explicitly scoped the rebuild to "only the stage layout scales up." Added `EnergyPickupStub` (visual circle + overlap zone, collect-on-touch, no HP/energy effect) - same treatment the Legs Capsule already got in the original M2 pass - so the *content* requirement is met without building a system a later milestone is supposed to own. 10 are placed, spread across every beat that calls for them explicitly (pre-boss corridor) or implicitly (breather).

- **Enemy density tuned by iteration against a live count, not estimated up front.** First pass landed at 16 regular-enemy placements over 33 screens (2.06 screens/encounter - just outside the 1.5-2.0 target). Added 3 more (a second Patrol Drone in the gimmick-tutorial beat, a second Turret Sunflower at the tail of escalation, a second Spark Bug in the final exam) to reach 19/33 = 1.74. The generator prints this ratio on every run specifically so it can be checked, not assumed - the same instinct that caught the pickup/bridge-gap collision below.

- **Bug caught by the generator's own validation, before it ever reached the game: a pickup placed inside a bridge gap.** The final-exam beat's last collapsing-bridge run and its pickup marker were laid out independently and ended up overlapping - the pickup would have sat over empty air with no ground tile under it. Added an explicit post-generation check (every checkpoint/pickup/ground-based-enemy x-column cross-referenced against the set of gap columns) that fails the generator run if anything lands over a gap; it caught this one immediately and the fix was a one-line reposition. Kept the check in the generator rather than relying on visual inspection, since at this scale (50+ hazard/entity placements) that's no longer a reliable way to catch it.

- **Two real coordinate bugs surfaced by growing the map, both in `SpeedwayScene.ts`'s boss-room camera lock and mid-fight respawn.** The map's total height grew from 12 tiles (192px) to 20 tiles (320px) to fit a genuine vertical wall-kick shaft (§2.6's "mixing horizontal + vertical"), pushing the ground line down from y=160 to y=256. `onBossRoomEntered()` was locking the camera to `map.heightInPixels / 2` - correct by coincidence on the old, short map (96 ≈ near the ground band) but on the new map that's y=160, nowhere near the new ground line at 256: the locked boss-room camera would have framed mostly empty air above the fight, with the actual ground-level action clipped off the bottom of a 180px-tall viewport. Replaced with a constant anchored to the ground line instead of the map's total height. Caught this by reasoning through the geometry before it was ever run, not by symptom-chasing after a playtest - but verified it anyway: the headless boss-fight test checks that the boss's y-position actually falls within the locked camera's visible band, not just that the fight completes. Same root cause meant `BOSS_ROOM_FLOOR_Y` (used to reposition the player just inside the door on a mid-fight death, per the original M2 decision) was also still the old map's marker convention (128) instead of the new one (224) - fixed alongside it.

- **The wall-kick shaft is now a real vertical beat, not a token gesture.** The original M2 stage's shaft climbed about 8 tiles (128px); this one climbs 12 (192px) - genuinely tall relative to the 180px-tall native viewport, so the camera has to actually scroll vertically to follow it, not just nudge. Same non-negotiable from M1 still applies: the shaft's walls stop short of the ground row, so the main path underneath is unobstructed for anyone who skips the detour (verified directly - `groundLayer` still reports solid ground under the shaft's column span).

- **Blind-clear / deathless-run time is a design-time estimate, not a measured human run** (no way to have someone blind-run it in this sandbox). Math: 10,560px path, ~1,150px of it under the 1.6x speed-strip multiplier, gives roughly 110-115s of pure movement at a dead sprint. Layering in the mid-boss, 19 regular enemy encounters (not all need to be fought - many are dodgeable), the collapsing-bridge sections' inherent pacing, and the Volt Cheetah fight itself puts a practiced deathless run at roughly **2.5-4 minutes** and a blind first clear at roughly **4-6 minutes**, tracking the GDD §2.6 target (2.5-3.5 / 4-6) closely enough to trust without further tuning passes - a real device playtest should confirm rather than the other direction.

## M2 — Speedway Savanna Stage

- **P0-class bug found and fixed: ground collision silently did nothing.** `groundLayer.setCollisionByExclusion([0])` excludes tile *index* 0 from collision - but Phaser's Tiled-JSON parser represents an empty (Tiled GID 0) cell internally as tile index **-1**, not 0. Excluding `[0]` therefore excluded nothing that actually existed in the layer, and (worse) left every empty cell marked collidable too, alongside the real ground tiles. With the whole grid uniformly "solid," `CalculateFacesWithin` found zero tiles with an "interesting" (boundary) face anywhere - Arcade's tile-collision routine skips tiles without one as an optimization - so the player fell straight through the entire map on every frame, repeatedly triggering the pit-fall respawn. Caught via a headless Playwright session that exposed a temporary `window.__debugGame` hook and polled `player.body.blocked.down` frame-by-frame after scene load: it never once went true. Root-caused by walking Phaser's own `GetTileAt`/`CalculateFacesWithin` source and confirming live (`layer.data[9][1].index === -1`) that empty cells are index -1, not 0. Fixed by excluding `[-1]` instead. Would not have reproduced against M1's `GymScene`, which builds its ground from `physics.add.staticImage` blocks, not a Tiled tile layer - the first tilemap-backed stage was needed to expose it.

- **Second bug from the same investigation: no enemy ever collided with the ground layer.** `BaseStageScene` only ever added `physics.add.collider(this.player, this.groundLayer)` - gravity-bearing enemies (Spark Bug, Volt Cheetah) had no ground collider of their own and fell forever the instant they spawned, never landing, never able to trigger their `body.blocked.down`-gated behavior (Spark Bug's hop timer only counts down while grounded). Flying/rooted enemies (Patrol Drone, Turret Sunflower) disable their own gravity and were unaffected. Fixed with one additional `physics.add.collider(this.enemies, this.groundLayer)` after entity setup - a no-op for the gravity-less enemies, load-bearing for the other two.

- **Player HP was never restored on respawn - a latent M1 bug this milestone's hazards finally exercise.** `Player.respawnAt()` reset position/invuln/hitstun but left `hp` untouched, so a player who died via damage (rather than a pit-fall reset, which happens to hand back full context anyway in Gym) would respawn already dead, instantly re-triggering respawn in a loop. GymScene never surfaced this because nothing in it could actually reduce the player to 0 HP through normal play. Speedway's lethal spikes and enemy contact can, so this had to be fixed here: `respawnAt()` now resets `hp` to the max (Mega-Man convention: a death/pit-fall respawn is a full reset, not merely a teleport).

- **Electric fence damage was overlap-per-frame with dead code guarding it.** The original wiring registered one shared overlap across all fences and gated the damage amount on `fence.hazardZone.body ? damage : 0` - a body-existence check that is always true and says nothing about whether the *specific* fence the player is touching is actually active. Rewired to one `physics.add.overlap` per fence (mirroring the per-bridge collider pattern already used), passing the specific fence into the handler so `fence.isActive` gates correctly. Repeated overlap firing every physics frame while in contact is not a double-damage bug in practice - `Player.takeDamage`'s own invulnerability window (60f) already no-ops re-entrant hits - but the old code would have applied the *wrong* fence's active-state to whichever fence happened to be evaluated, in a multi-fence scene.

- **Checkpoint respawn point was being constructed twice, redundantly.** The scaffold built a temporary `CheckpointManager` inside `setupCheckpoints()` (seeded 0,0, then reseeded again if it found the order-0 object while looping), then immediately discarded and rebuilt it in `create()` from the player-spawn object. Consolidated to a single construction in `create()`, computed once from `playerSpawn` (falling back to the order-0 checkpoint object, then a hardcoded default) before `setupCheckpoints()` ever runs; that method now only wires the touch-zone overlaps.

- **Enemy roster reuse for the mid-boss, per GDD §3.1's explicit intent.** "Twin patrol drones circling a pylon" is the same Patrol Drone enemy type, not a bespoke mid-boss class - `PatrolDrone` takes an optional `orbit: {centerX, centerY, angleOffsetRad}` and switches from velocity-driven back-and-forth patrol to a kinematic `body.reset()`-per-frame circular path around that center. The two orbit drones share one pylon-center lookup (found once, by scanning the entities layer for the `pylon` object) and a 180°-offset starting angle, so they stay perpetually diametrically opposite - verified in isolation (positions always exactly `2 * orbitRadius` apart, every frame).

- **Weakness-hook damage is a hard interrupt; buster damage is not.** `Enemy.takeDamage()` (used by all buster hits) reduces HP and flashes, nothing more - it must not interrupt Volt Cheetah's current pattern, since GDD §4 only promises an interrupt on the (future) weapon weakness hit. `VoltCheetah.takesWeakness(weaponId)` is a separate entry point: fixed 4 damage via the same `takeDamage`, then forces `bossFsmState = 'stunned'` and zeroes velocity/hides the sweep hazard regardless of what pattern was mid-flight. `weaponId` is unused today (no real weapon system exists until a later milestone) but the signature is real and callable now, matching the ask to have the interface "stubbed."

- **Ambiguous GDD case: what happens if the player dies mid-boss-fight, behind the sealed door?** Not specified. The base `respawnPlayer()` sends the player back to the last checkpoint (`checkpoint-preboss`, which sits *outside* the boss room) - fine everywhere else in the stage, but inside a permanently-sealed boss room this would strand the player behind a shutter that never reopens. Resolved in favor of precision game feel, Mega-Man convention: `SpeedwayScene` overrides `respawnPlayer()` to run the base reset (position, all enemies including the boss, HP) and then, only if the boss encounter is already underway, re-lands the player just inside the door instead. The boss itself resets to full HP on this respawn too (a mid-fight death costs the whole attempt, not just a checkpoint crawl-back) - consistent with every other death in the stage.

- **"Weapon-get screen" implemented as an in-scene overlay, not a new registered Scene.** GDD asks for "power-down -> weapon-get screen stub -> return to StageSelect." A full `Phaser.Scene` for a placeholder screen felt like premature structure for content that doesn't exist yet (no weapon system, no weapon-wheel UI until a later milestone) - a full-screen overlay (`rectangle` + `text`, `setScrollFactor(0)`, a few seconds' hold) inside `SpeedwayScene` delivers the same beat (freeze gameplay via a `stageComplete` flag gating `fixedUpdate`, show the stub, then `scene.start('StageSelect')`) with far less surface area to redo once the real weapon-get flow is designed.

- **Stage Select now offers two destinations instead of "tap anywhere -> Gym."** With a real stage to route to, the single full-screen tap target from M0/M1 no longer made sense - replaced with two labeled buttons ("SPEEDWAY SAVANNA" / "PLAYER GYM (practice)") so the Gym stays reachable as a controller practice space rather than being orphaned by the new stage.

## M1 — Player Controller + Touch Input

- **Touch cluster repositioning (post-merge tuning, real-device feedback).** The original layout
  anchored the right button cluster (A/B/C + weapon-swap) and the fixed-D-pad mode a small fixed
  dp offset from the screen edges (e.g. Jump at 44dp from the right, 40dp from the bottom) - on a
  real phone this landed in the physical corner, causing thumb strain. Reworked both clusters to
  anchor from a percentage of the play area's width/height instead of fixed dp
  (`touchLayout.leftCluster` / `rightCluster`, ~13.5% in from the side edge, ~32.5% up from the
  bottom - within the requested 12-15%/30-35% range), computed against the actual rendered canvas
  width (`this.scale.width`, which already varies 320-420px with device aspect per the M0
  extend-background fix) rather than the narrower fixed-320px gameplay-critical frame - a thumb
  reaches based on where the physical screen edges are, not an abstract inner frame. The
  within-cluster arrangement (A/B/C triangle spacing, weapon-swap arrow positions, button
  diameters) is unchanged - each button is still a fixed dp offset, just now measured from the
  cluster's new percentage-anchored reference point instead of from the raw screen edge, so
  relative ergonomics inside a cluster are preserved while the cluster as a whole moved inward.
  Verified visually at 16:9, the S25's 19.5:9, and 21:9 - both clusters land at a consistent,
  comfortable inset at every ratio instead of drifting toward the corner as the canvas widens.
  Safe-area-inset handling needed no new code: `index.html`'s `env(safe-area-inset-*)` padding on
  the `#app` container (M0) already keeps the entire canvas off the notch/gesture bar before any
  in-game coordinate is computed, so nothing rendered inside the canvas - these clusters included
  - can ever land under a notch or the gesture bar.

- **Two parallel fixed-step clocks, on purpose.** Arcade Physics already runs its own internal
  fixed-60Hz accumulator when `physics.arcade.fps: 60` is set (confirmed by reading
  `node_modules/phaser/src/physics/arcade/World.js` - it's the same "accumulate delta, step while
  >= frame time" pattern as `FixedTimestepAccumulator`). Rather than fight Phaser to route physics
  through my own accumulator, `Player.fixedUpdate` (driven by `BaseScene`'s accumulator, per M0)
  sets velocity/state each fixed step and lets Arcade's own stepping integrate position. Because
  both accumulators consume the exact same per-frame `delta` and use the same threshold, they step
  the same number of times per render frame - no drift between the two. The one real cost: physics
  steps in Phaser's `UPDATE` phase, before `BaseScene.update()` (my `fixedUpdate`) runs, so a
  velocity change decided this step is only applied on the *next* physics step - a constant ~1
  fixed-frame (16.7ms) of extra input latency, deemed acceptable (well under human reaction-time
  thresholds) versus the risk of hand-rolling manual Arcade World stepping.

- **P1-class bug found while wiring render interpolation for the player: `InterpolatedPhysicsSprite`.**
  The naive plan (write `renderAlpha`-interpolated positions straight onto the physics sprite each
  render frame, like M0's non-physics "pacer" demo) is unsound for a real Arcade body:
  `Body.preUpdate()` calls `updateFromGameObject()` **every render frame, unconditionally** - it
  re-reads the GameObject's x/y as the new authoritative simulation position, before deciding
  whether a step happens. Writing an interpolated (non-integer-step) position to the physics
  sprite would get read back in as real simulation state on the very next frame, corrupting
  position tracking. Fixed with `src/actors/InterpolatedPhysicsSprite.ts`: the physics-driving
  sprite (`Player`, `MovingPlatform`) stays invisible and only drives collision; a separate
  plain `visual` sprite (no body, so no feedback path) is what's actually rendered, positioned via
  `PositionInterpolator` each frame. `TargetDummy` doesn't need this - it never moves.

- **Gravity / tile size / derived jump velocities.** The GDD gives jump height in tiles (min 2,
  max 3.5) but not a tile size or gravity value. Set `TILE_SIZE = 16` (matches the GDD's own 16x16
  tileset spec, §10.5) and `gravity = 900px/s²` (chosen for a ~21-frame rise to apex on a max
  jump - a snappy, Mega-Man-scaled arc). `computeJumpVelocities()` derives the launch/cut
  velocities from those so the *tunable* surface for the PO stays the height-in-tiles values in
  `playerTuning.ts`, not raw velocities.

- **Wall-kick shaft found to be a soft-lock, not an optional test feature - fixed.** As first
  built, the wall-kick shaft's walls ran floor-to-ceiling directly across the main ground path,
  with no way around at ground level and no way past without successfully chaining wall-kicks to
  the top. Caught this by scripting a bot to just walk right through the gym without climbing it -
  it got stuck. A real player who can't execute the kick chain would be stuck too, which fails the
  "fast retry" pillar hard. Repositioned the shaft above the stairs' top platform (walls stop at
  the stairs' height, not `GROUND_TOP`) so it's now a genuine optional detour: the main ground path
  is unobstructed underneath for anyone who skips it, and it's still fully climbable/testable via
  wall-kicks for anyone who takes it.

- **Buster projectile despawn bug found and fixed.** Projectiles originally deactivated when
  `this.x` (world position) exceeded `scene.scale.width` (the ~320-420px logical *viewport*
  width) - correct for a single-screen scene, wrong for the Gym's ~1400px scrollable level: once
  the camera scrolled past the first screen, every shot fired anywhere in the level was instantly
  treated as "off-screen" and despawned, so the buster appeared to do nothing against the target
  dummy. Found via a direct-state Playwright check (shots showed `active:false` immediately after
  firing, far from the pool being exhausted). Fixed with a flight-time-based despawn
  (`playerTuning.buster.maxFlightMs`) instead of a position/viewport check - correct regardless of
  world size, and the more standard pattern for pooled projectiles anyway.

- **Knockback and hitstun numbers.** "4px hop away from damage source" is implemented as a literal
  4px instant repositioning (via `body.reset`, not a velocity impulse - guarantees an exact,
  deterministic 4px regardless of frame rate) plus a small upward velocity so it visually reads as
  a hop. Added a `hitstunFrames` (10) lockout during which the player can't act, distinct from the
  GDD's boss-weakness *hitstop* (freeze-frame, an M8 polish-pass item per the M8 prompt, not built
  here) - hitstun is "you got hit and briefly can't cancel it," which the GDD's knockback line
  implies but doesn't name a duration for.

- **Manual pause vs. physics.** `BaseScene`'s manual-pause flag (M0) only ever skipped
  `fixedUpdate`; it never needed to touch Arcade's own stepping. Confirmed still correct with real
  physics bodies in the mix - Arcade World simply doesn't get new velocity commands while paused
  and nothing drifts, since nothing this scene mutates positions outside `fixedUpdate`.

- **48dp touch targets on a variable-zoom canvas.** "dp" (density-independent px) is equivalent to
  CSS px, but our logical canvas is scaled to the screen by an integer zoom that's computed per
  device (M0). A touch button authored as a fixed *logical* px size could measure well under 48
  CSS px on a high-density/low-zoom device. `src/systems/touchScale.ts` converts
  `dp -> logical px` via `scene.scale.displayScale.x` (logical-px-per-CSS-px) at construction
  time, so buttons are guaranteed >=48 CSS px on any device regardless of the zoom Phaser picked.

- **Hold-B auto-fire, literally.** Read the GDD's "Hold-B auto-fire toggle... for players who
  dislike tap-mashing" (§2.2b) as: holding Shoot repeatedly fires uncharged shots at a fixed
  interval instead of charging - an alternate firing mode traded off against the charge mechanic,
  not an addition to it. Wired as `touchLayout.autoFire.enabledDefault` (off by default, matching
  hold-to-charge as the primary/expected behavior); a real settings-menu toggle is M5 scope.

- **Floating stick vs. fixed D-pad: both fully built, switched at build time.** The GDD asks for
  "player choice" but there's no settings menu yet to offer that choice at runtime (M5). Both
  `FloatingStick` and `FixedDpad` are complete, functional implementations behind
  `touchLayout.stickMode`; wiring an in-game toggle is pure plumbing once M5's settings UI exists,
  not a redesign.

- **Debug overlay's "touch zones" requirement.** Not drawn as a separate overlay layer - the
  on-screen buttons/stick are already rendered as translucent shapes at their exact interactive
  bounds at all times (not just in debug mode), so they already are their own zone visualization.
  Adding a redundant outline layer under F3 would just duplicate what's already always visible.

- **Scene rename: `Stage` -> `Gym`.** M0's `StageScene` (a bouncing-rectangle demo of the
  fixed-timestep/interpolation wiring) is deleted; its sole purpose is now demonstrated for real by
  the Player controller in the new `GymScene`. `StageSelectScene` now routes to `Gym`. `Stage` is
  reserved for M2's real first level (Speedway Savanna) so the naming doesn't collide later.

- **Real device / environment limits on what could be verified here.** No Android SDK in this
  sandbox (same limitation as M0/M0-fix) - couldn't build or install the actual debug APK; CI will
  produce it. Extensively playtested the web build headlessly (movement, variable jump height,
  coyote/buffer, wall-slide, wall-kick, all three gap sizes, stairs, spikes, the moving platform
  and its fall-through/respawn safety net, buster charging and damage against the target dummy,
  the floating stick via mouse-drag, and manual pause) with zero console errors throughout.
  Genuine **true multi-touch (3+ simultaneous physical touches, and the three-finger debug-toggle
  gesture) could not be exercised** in this headless environment - Chromium's synthetic
  `TouchEvent` dispatch didn't register with Phaser's input plugin in testing here, and
  Playwright's touchscreen API is single-point. The multi-touch *architecture* (per-pointer-id
  tracking in `TouchButton`/`FloatingStick`, `activePointers: 4` in the game config, the merge
  logic in `InputManager`) is verified by code review and unit tests, and single-pointer
  interaction (buttons, drag) is confirmed working end-to-end, but simultaneous multi-finger input
  and the three-finger gesture specifically need a real-device pass.

## M0 — Project Bootstrap

- **P1 fix: letterbox-extended backgrounds, for real this time.** The original M0 PR deferred
  this (see the superseded entry below) reasoning that stub scenes had no background art to
  extend. Real-device QA on a Samsung S25 (~19.5:9) showed that reasoning doesn't hold even for
  a solid-color stub background: a fixed 320px-wide logical canvas pillarboxed on both sides
  instead of the color filling the screen. Fixed by making the logical canvas width
  device-aspect-dependent: `computeRenderWidth()` in `src/config/resolution.ts` now returns
  `clamp(deviceAspect * 180, 320, 420)` instead of a hardcoded `320`, computed at boot from
  `window.innerWidth/innerHeight` and kept in sync afterward via `src/systems/responsiveScale.ts`
  (`game.scale.setGameSize`) for foldables/split-screen/dev-window-resize. Gameplay-critical
  content still centers within the inner 320px "safe zone" (`BaseScene#safeZoneX`) so hazards and
  UI stay reachable regardless of how much extra width a given device shows — only background
  elements (the ground panel, camera background color) span the full dynamic width. Verified with
  `computeRenderWidth` unit tests (16:9, S25's 19.5:9, exact 21:9, wider-than-21:9 clamp,
  narrower-than-16:9) and a headless-browser check at the S25's exact aspect ratio showing 0px of
  pillarbox.

- **P1 fix: manual pause, and why it's a separate code path from the background auto-pause.**
  Added a corner pause button (`BaseScene`, top-right of the safe zone) so pause is directly
  testable without backgrounding the app (there is no way to observe whether an invisible,
  backgrounded app actually paused). Discovered while implementing this that a naive
  "call `game.pause()` on tap" would have been a real bug: a full engine pause halts Phaser's own
  input dispatch, so the pause button itself would become untappable and the game would be stuck
  paused with no way to resume from a tap. Manual pause is instead a scene-level flag that only
  skips `BaseScene`'s `fixedUpdate` stepping, leaving Phaser's input/render loop running so the
  button stays responsive. The app-background auto-pause path (`src/systems/lifecycle.ts`) is
  unaffected and still uses a full `game.pause()` — correct there, since nothing is visible to
  tap while backgrounded anyway. Also extracted the pause/resume decision logic into a pure,
  now-unit-tested `createPauseController` (previously this had zero test coverage), including a
  regression test for a known Android WebView quirk: `visibilitychange` doesn't always fire in
  step with the real Activity state, so a stray "visible" event must not resume the game while
  the native App plugin still reports the app backgrounded.

- ~~**Letterbox-extended backgrounds deferred**~~ — superseded above; kept for history. The GDD
  (§0) asks for stage backgrounds to extend into the letterbox space on wider-than-16:9 screens
  instead of showing black bars. Original reasoning: there was no background art yet (M0 is
  colored-rectangle stubs), so there was "nothing to extend" — wrong, a solid-color background is
  still a background, and it still needs to fill the screen.

- **Android application ID**: chose `com.wildcore.beastprotocol` (not specified in the GDD).
  This is baked into the Android project's package structure now; changing it later means
  regenerating the `android/` platform. Flag before Play Store submission if a different ID is
  wanted.

- **Integer-zoom scaling**: implemented with Phaser's built-in `Scale.FIT` + `Scale.MAX_ZOOM`,
  which pixel-perfectly integer-scales the logical canvas and centers it. The logical canvas
  width itself is device-aspect-dependent (see the background-extend fix above) rather than a
  fixed 320 — so on 16:9 it's exactly 320 with no pillarbox, and up to 21:9 it grows to match the
  device with no pillarbox either; only beyond 21:9 does the FIT/MAX_ZOOM letterbox math add real
  bars, per the GDD's supported range. Verified at 16:9, 19.5:9, and 21:9 — crisp pixels, no
  stretching, no glitches at any tested ratio.

- **Fixed 60Hz logic step**: implemented as an accumulator (`src/systems/fixedTimestep.ts`)
  driving a `fixedUpdate(dtMs)` hook on `BaseScene`, rather than relying on Phaser's variable
  per-frame `update`. This guarantees deterministic simulation independent of display refresh
  rate (important for 90Hz/120Hz Android panels) and exposes a `renderAlpha` so sprite positions
  can be interpolated between fixed steps instead of visibly stepping. `StageScene`'s placeholder
  "pacer" rectangle exercises this now so M1's Player controller has a proven pattern to build on.

- **Immersive fullscreen implementation**: Capacitor's core `StatusBar` plugin only hides the
  status bar, not the Android navigation bar. Implemented true immersive-sticky mode natively in
  `MainActivity.java` via `WindowInsetsControllerCompat` (edge-to-edge + hide both system bars,
  re-applied on window focus regain so a swipe-to-reveal doesn't stick), with the JS-side
  `StatusBar` plugin call in `src/systems/statusBar.ts` as a second pass for the WebView chrome.

- **Landscape lock**: done via `android:screenOrientation="sensorLandscape"` in
  `AndroidManifest.xml` (holds before the WebView/JS even loads) rather than a JS-only lock. Kept
  a best-effort Web Screen Orientation API call in `src/systems/orientation.ts` for the web
  preview, which silently no-ops outside a fullscreen gesture (expected browser limitation, not a
  bug).

- **Capacitor CLI dev-dependency vulnerability**: `npm audit` flags a high-severity `tar` advisory
  transitively via `@capacitor/cli@6.x`'s dependency chain. The fix requires bumping to
  `@capacitor/cli@8.x`, a breaking major version change that contradicts the GDD's explicit
  "Capacitor 6" pin. `@capacitor/cli` is a build-time-only dev dependency (not shipped in the app
  bundle), so risk is limited to the local/CI build environment. Staying on 6.x for now; revisit
  if the PO wants to move off the pinned major.

- **Vercel preview requires PO-side setup**: the `vercel-preview` CI job is gated on repo
  variables `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` and secret `VERCEL_TOKEN` being present — it
  skips cleanly (not a red CI run) until those are configured. Someone with repo admin access
  needs to link the Vercel project and add those three values under Settings → Secrets and
  variables → Actions before the first real preview link appears on a PR.

- **Bundle size**: the production JS bundle is ~1.2MB minified (~320KB gzip), almost entirely
  Phaser itself. Not a problem yet, but flagging per rule #6 (performance floor) — if load time on
  a mid-range Android WebView becomes an issue, code-splitting Phaser out of the initial chunk is
  the first lever to pull, before cutting content.
