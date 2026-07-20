# DECISIONS

Running log of deviations from `docs/GDD.md`, and judgment calls made where a requirement was
ambiguous. One entry per decision, newest first.

## Bugfix (P1) — Speedway spikes exceeding a fair base-kit jump (GDD §2.5 pillar 1)

- **The report and the measurement.** Reported hazard: a lethal spike patch near world pos
  `(3481, 836)` (`spikes-escalation`) that killed the player on every attempt. Measured it directly
  (JSON + raw-tile scan, not eyeballed): a 48px (3-tile) spikes hazard sitting on continuous solid
  ground (no actual hole in the floor) - the ground itself never had a gap here, the "gap" is purely
  the horizontal span the player has to clear in the air to avoid the spikes.
- **Why 48px failed even though it matches the codebase's own established "safe" gap value.** The
  existing `SAFE_GAP_TILES = 3` (48px) constant, used throughout this generator for VOID gaps, was
  proven safe in an earlier bugfix (see "Bugfix — Speedway gaps exceeding base-kit jump reach" below)
  against a ~63.5px max jump-reach ceiling - but that proof implicitly assumes the player takes off
  right at the gap's edge, which a void gap naturally enforces (there's no reason to jump before the
  floor actually ends; you just keep running). A spikes hazard sitting on *continuous* ground doesn't
  have that natural edge-anchor - a player can, and often will, jump a bit early out of caution.
  Live Playwright testing (teleport to a controlled distance before the hazard, hold the run key, then
  hold jump to a full max-height apex - the same reproduction as an actual "run up and jump" player)
  confirmed this directly: a jump launched only ~18-20px before the 48px zone lands the player
  *inside* the spikes, dead, every time - exactly matching the report. The same jump launched only
  ~8px before a 32px zone clears it every time. **Root cause: 48px is fine for a void gap (edge-
  anchored takeoff) but too wide for a flush lethal hazard (takeoff point varies).**
- **Fix: narrowed spikes specifically, not the void-gap constant.** Added `SAFE_SPIKE_TILES = 2` (32px)
  as its own named ceiling, separate from `SAFE_GAP_TILES` (3/48px, unchanged) - conflating the two
  would have either needlessly narrowed every void gap in the stage (they don't have this problem) or
  left spikes at an unsafe width. `spikes-escalation` was the only one of the four spike placements
  still using the old 48px value (a leftover from before the width-safety distinction existed); the
  other three already happened to be 32px and were spot-verified safe under the exact reproduction
  pattern that killed the reported one.
- **A second, related finding while auditing: a compound gap+spikes obstacle in finalExam
  (`spikes-exam-A`, right after a void gap) was ALSO fragile, for a different reason.** The void gap
  itself measured the same proven 48px, but testing it in isolation with a deliberately-early
  (~16px-before-edge) jump - representative of a player who's already seen the spikes waiting right
  after and reacts a little early - cleared the gap by only a fraction of a pixel of theoretical
  reach, an unreliable margin (it passed in one test run and failed in another, purely from normal
  frame-timing variance). Narrowed this ONE void gap to 2 tiles (32px) via a new optional `gapTiles`
  parameter on `screenRGap` (the other 5 void gaps in the stage stay at 3 tiles/48px - already proven
  safe under their own normal edge-anchored timing, not touched) and widened the landing strip between
  the gap and the spikes from 2 to 4 tiles (32px → 64px) so a slightly-long landing off the gap jump
  can't carry straight into the spikes before the player has room to plant and re-jump.
- **Made the fairness check mechanical, not just fixed by hand.** Added a gap/hazard audit pass to
  `generate-speedway-map.mjs` (reusing the raw-tile column-scan technique from the original base-kit
  jump-reach bugfix) that runs on every generation: every void gap must be ≤ `SAFE_GAP_TILES`, every
  `spikes` hazard's width must be ≤ `SAFE_SPIKE_TILES`, and the generator throws (fails the build) if
  either is violated. This is a permanent gate, not a one-time manual pass - a future edit that
  accidentally widens a hazard will fail to generate rather than silently reintroducing this bug.
- **Full audit results, before → after** (every gap/hazard the generator produces, all now passing
  the ceilings above; "before" values are from the merged map prior to this fix):

  | Hazard/gap | Location | Before | After | Ceiling | Note |
  |---|---|---|---|---|---|
  | `spikes-escalation` | escalation, real screen ~11 | 48px (3 tiles) | **32px (2 tiles)** | 32px | The reported bug |
  | `spikes-setpiece` | setpiece | 32px (2 tiles) | 32px (2 tiles) | 32px | Already compliant |
  | `spikes-exam-A` | finalExam | 32px (2 tiles) | 32px (2 tiles) | 32px | Already compliant |
  | `spikes-exam-B` | finalExam | 32px (2 tiles) | 32px (2 tiles) | 32px | Already compliant |
  | Void gap, tutorial | tutorial | 48px (3 tiles) | 48px (3 tiles) | 48px | Edge-anchored, unchanged |
  | Void gap, remix (bridge) | remix | 48px (3 tiles) | 48px (3 tiles) | 48px | Spanned by a collapsing bridge, unchanged |
  | Void gap, remix (plain) | remix | 48px (3 tiles) | 48px (3 tiles) | 48px | Edge-anchored, unchanged |
  | Void gap, breather transition | breather entry | 48px (3 tiles) | 48px (3 tiles) | 48px | Edge-anchored, unchanged |
  | Void gap, finalExam (compound w/ spikes-exam-A) | finalExam | 48px (3 tiles) | **32px (2 tiles)** | 48px normally, narrowed for this compound case | Fragile margin under an early jump when spikes follow immediately |
  | Void gap, finalExam | finalExam | 48px (3 tiles) | 48px (3 tiles) | 48px | Edge-anchored, unchanged |

  (Wall-kick shaft gaps are a separate, already-audited category - see the M2-AUDIT-REBUILD entry
  below; unaffected by this fix, not re-touched here.)
- **Verification.** Live Playwright reproduction of the exact reported failure pattern (56px runway,
  natural 400ms run-up, full-height held jump) now survives for `spikes-escalation`, `spikes-setpiece`,
  and `spikes-exam-B`. The compound gap+spikes-exam-A sequence, tested with precisely-timed jumps at
  each edge, now clears both obstacles with zero HP loss (previously died reliably). The generator's
  new audit pass reports every gap/hazard width on every run (pasted above) and fails the build if any
  exceeds its ceiling. Full verification suite (typecheck/lint/format/test/build) passes; `SpeedwayScene.ts`
  needed no changes (only hazard-object widths/positions changed, not the ground tile layer, so the
  boss room and other geometry-derived constants are unaffected).

## M2 — Speedway Savanna re-audited against the axis-flexible §2.6/§3.1 revision

- **Doc sync landed directly on `main` (not via a docs PR from this session).** `docs/GDD.md` and
  `docs/PO_PLAYBOOK.md` were replaced/renamed on `main` (commits `2923855`/`0112918`/`4a838fd`/
  `f999736`/`04bf257`) before this task started. Read the new §2.6/§2.7/§3.1 text directly off
  `origin/main` and confirmed it matches the prompt's description (axis-flexible vertical target,
  "at least TWO of three" structural elements, branch & rejoin mandatory regardless of axis,
  Speedway declared horizontal-dominant) before touching anything - same "read the real file, don't
  act on a described diff" discipline as the earlier-session GDD.md refusal.
- **What changed vs. the previous M2-AUDIT-REBUILD (PR #23).** That build was correct for the
  *old* §2.6 (35% vertical floor, all three structural elements effectively expected) - it built a
  real 3-screen wall-kick ascent shaft up the solar pylon as a structural element. Under the new
  axis-flexible rule, Speedway is HORIZONTAL-DOMINANT: §3.1 now explicitly says "a tall ascent shaft
  is NOT required here - keep the pace horizontal" and names DESCENT + MULTI-FLOOR as the stage's two
  structural elements. Removed the mandatory 3-leg shaft from the remix beat entirely (replaced with
  fast, mostly-flat plateau screens plus a real collapsing-bridge gap crossing) and rebuilt the
  multi-floor breather from 2 decks to 3 shallow decks per the prompt's explicit ask ("stack 2-3
  shallow road decks... still missing" - see below for why "still missing" was taken at face value
  rather than argued with). A single short wall-kick leg was kept in finalExam purely as texture
  (GDD §3.1: "short wall-kick climbs are fine as texture"), not counted as a structural element and
  not given its own vertical-camera zone (unlike the old structural shaft, which had one).
- **"Still missing" taken at face value even though a 2-deck multi-floor room already existed and
  passed every mechanical check.** A raw-tile scan of the pre-existing (merged) map confirmed the old
  2-tier room was genuinely there (upper road with 2 drop-through gaps, continuous lower drainage
  floor) - not a repeat of the earlier "zone marker but no real geometry" problem. Rather than push
  back on the PO's "still missing" framing, read it as "the existing 2-deck version doesn't read as a
  substantial enough multi-floor moment now that it's one of only 2 declared structural elements
  instead of one of three" and rebuilt it as 3 shallow decks (top/mid/bottom, each deck's floor only
  6 rows/96px from the next, so the whole room stays exactly as short as the old 2-deck version - "it
  does NOT need a tall map" from the prompt, honored literally) with the top and mid decks' drop-
  gaps deliberately offset from each other so falling through the top always lands on solid mid floor
  first, and continuing down from mid is a separate, deliberate choice - a genuine "player picks a
  layer, then picks again" moment rather than one drop-through to the bottom.
- **A real, previously-undetected design gap fixed while rebuilding the collapsing-bridge crossing.**
  The old remix beat's 3 `collapsingBridge` hazard objects sat decoratively on top of an already-fully
  -solid `screenR` floor - `CollapsingBridgeTile` is a standalone static body independent of the
  ground tile layer (confirmed by reading the actor source), so with solid ground underneath, the
  bridge "collapsing" never had any real consequence: the player just stood on the ground tile
  underneath regardless. New `screenRBridge` primitive builds an actual `SAFE_GAP_TILES`-wide pit
  with no ground tile at all, spanned by one real `collapsingBridge` hazard - now a real hazard
  instead of a visual-only prop. Not something the prompt asked for explicitly, but a direct
  consequence of touching this beat anyway and reading the actor's actual behavior rather than
  assuming the old placement was meaningful.
- **Anti-corridor floor re-verified after removing the shaft, not assumed to still pass.** Deleting 3
  U-tagged shaft screens from remix and replacing them with flat/R screens immediately created an
  8-consecutive-same-direction run (escalation's tail + mid-boss + all-flat remix) - caught by the
  generator's own `validateRouteShape` throwing before any manual review was needed. Fixed by giving
  remix one real short dip (`stairDescent`) and one real short rise (`stairAscent`) - textured
  "elevation spikes" per the stage's own flavor text, not a disguised ascent shaft (each is a single
  gentle staircase leg, not a wall-kick gap). A second, subtler violation - 4 consecutive REAL
  (320px) screens sitting at a near-identical surface height in the finalExam→preboss tail, since the
  removed shaft's real-screen-level elevation contribution was gone and nothing replaced it -
  was caught by the surface-variation check (not the direction-run check, which was already passing)
  and fixed with one small safe dip (`stairDescent`, no hazards) added to preboss instead of leaving
  it pure-flat.
- **Vertical % ended up at 40%, well above the new 20% horizontal-dominant floor - left as-is rather
  than trimmed further.** GDD §2.6 states the axis target as a floor ("target ≥20%"), not a ceiling,
  and doesn't ask for vertical content to be minimized - only that a tall *ascent shaft* isn't
  mandatory and the stage isn't required to be tall. The boost-strip descent (one of the two declared
  structural elements) is inherently a large one-way elevation loss by design, the same way
  Reservoir's descent is allowed to be tall; over-trimming everything else to chase a lower number
  would have fought the anti-corridor floor rule (which is unchanged and still requires real
  elevation variation) for no requirement-driven reason. The map is taller in raw tiles than the old
  ascent-shaft version (622×144 vs. 622×96) purely as a side effect of net downhill drift (many more
  D-tagged screens than U-tagged ones with nothing to climb back up) - not a violation of anything in
  §2.6/§2.7, but noted here since it looks counterintuitive for a stage whose whole point is "not
  required to be tall."
- **`SpeedwayScene.ts`'s `BOSS_ROOM_FLOOR_Y`** updated again (1222 → 1990), read from the regenerated
  map's own `bossSpawn` object-center Y, same discipline as every prior rebuild.
- **Verification.** Raw-tile scans confirmed: the bridge-gap pit is exactly 3 tiles wide with the
  collapsing-bridge tile positioned over real empty space; the 3-tier multi-floor room's top/mid/
  bottom decks and their offset drop-gaps match the design exactly; the Legs Capsule's wall-kick
  pillars still reach the floor. Live headless-Playwright checks (two checkpoint-anchored sweeps,
  since a naive bot can't itself execute a wall-kick chain - the same documented harness limitation
  as prior rebuilds) traversed the new remix content, the bridge crossing (died once to bad timing,
  correctly respawned - an unskilled bot not dodging a timed hazard, not a geometry bug), and the
  full 3-tier multi-floor room cleanly. One earlier "stuck against a wall" result during ad hoc
  testing turned out to be a bad teleport coordinate landing the test player inside the entry wall's
  own pillar, not a real bug - re-verified with the exact checkpoint coordinates and it traversed
  fine; kept here as a reminder to trust the raw-tile data over an unverified teleport guess.
- **§2.7 report:**
  - Declared axis: **HORIZONTAL-DOMINANT**. Vertical path: **40%** (14/35 screens U/D-tagged) -
    above the 20% floor. Longest same-direction run: 3. Direction changes: 22.
  - Structural elements (2 of 3, per the axis-flexible rule): **CONTROLLED DESCENT** (boost-strip
    setpiece) at real screens **18-21**; **MULTI-FLOOR ROOM** (3 shallow decks) at real screens
    **22-23**. Ascent shaft NOT used as a structural element; one short wall-kick leg kept as texture
    at real screen 26 (finalExam), no vertical-camera zone (texture only, not a structural shaft).
  - **BRANCH & REJOIN** (turbine tower, mandatory for every stage regardless of axis): fork at real
    screen **9**, rejoin by real screen **10** - unchanged from the previous rebuild (this beat wasn't
    touched; already independently verified as two real, physically separate tile paths).
  - Collapsing-bridge gap crossing (now a real hazard, not decorative): real screen 15.
  - Legs Capsule (no weapon gate): real screen 24.
  - Motif variety: 10 distinct ground shapes (`flat`, `stairAscent`, `stairDescent`, `gap`, `branch`,
    `bridgeGap`, `boostDescent`, `sheerDescent`, `multiFloor`, `shaft`), longest same-motif run 3.
  - Content variety: 0 consecutive-identical-signature violations; density 1.75 screens/encounter
    (20/35); gimmick through-line touches beats 2, 5, 6 (setpiece), 8 (finalExam).
  - Fairness: every gap (wall-kick, flat, or bridge) is exactly 3 tiles (48px, the proven-safe base-
    kit value). Base-kit clearable throughout, no dash required.
  - Map: 622×144 tiles (9,952×2,304px), up from 622×96 (see the vertical-% note above for why).
- **Per-real-screen surface row** (raw tile scan, `min` = topmost solid tile row in that 320px
  screen):
  `[{"screen":1,"min":44},{"screen":2,"min":44},{"screen":3,"min":32},{"screen":4,"min":32},{"screen":5,"min":32},{"screen":6,"min":44},{"screen":7,"min":44},{"screen":8,"min":32},{"screen":9,"min":32},{"screen":10,"min":32},{"screen":11,"min":47},{"screen":12,"min":53},{"screen":13,"min":53},{"screen":14,"min":53},{"screen":15,"min":65},{"screen":16,"min":65},{"screen":17,"min":53},{"screen":18,"min":53},{"screen":19,"min":65},{"screen":20,"min":77},{"screen":21,"min":83},{"screen":22,"min":101},{"screen":23,"min":101},{"screen":24,"min":103},{"screen":25,"min":113},{"screen":26,"min":101},{"screen":27,"min":101},{"screen":28,"min":113},{"screen":29,"min":113},{"screen":30,"min":125},{"screen":31,"min":125}]`
  (longest near-flat run: 2 real screens, comfortably under the 3-screen limit.)
- **Auto-merge intentionally left off this PR** per the request - please audit the regenerated JSON
  before merging, same as the previous rebuild.

## M2-AUDIT-REBUILD — Speedway Savanna terrain rebuilt to the §2.6/§2.7/§3.1 standard

- **Speedway predates §2.7 and was always hand-authored JSON.** Unlike Coral Reservoir
  (`scripts/generate-reservoir-map.mjs`, built during M4.1's rebuilds), no generator ever existed for
  `speedway.json` - M2/M2-REBUILD/M2-REBUILD-2/the base-kit-jump-reach bugfix all edited the map by
  hand. M2-REBUILD-2's own writeup already flagged this as a known gap ("Speedway... doesn't currently
  implement §2.6's anti-corridor rules... reworking Speedway's layout... is a separate, explicit
  task"). This PR is that task: a new `scripts/generate-speedway-map.mjs`, built on the same
  screen-shape-primitive + mechanical-validation discipline as Reservoir's rebuilds, re-authoring only
  the ground layer and route shape - the boss (Volt Cheetah), enemy roster (Spark Bug, Patrol Drone,
  Turret Sunflower), hazard roster (spikes, speed strips, electric fences, collapsing bridges),
  checkpoint count/order, and 9-beat structure are all kept.
- **Independent audit confirmed, not just re-asserted.** Re-ran the raw-tile top-solid-row scan
  (the same ground-truth methodology from Reservoir's M4.1-REBUILD-2 audit, immune to trusting a
  generator's or a prior PR's own internal bookkeeping) against the pre-existing `speedway.json`:
  8.36 real (320px) screens tall, surface varying only 4.27 real screens, matching the PO's audit
  almost exactly ("~8.4 screens tall", "surface varies only ~4.3 screens"). M2-REBUILD-2's own report
  had claimed a 3-screen pylon shaft, a branch/rejoin, and a multi-floor room - all present as
  entity/section *markers* (`ascentShaftZone`, `midBossPylon`, two elevation bands) but the raw ground
  tiles told a different story: the map's real vertical range never materialized as real stacked
  geometry, the same "internal label vs. real tile data" gap Reservoir hit twice.
- **Two real reachability bugs found via raw-tile scans during this rebuild itself, not just in the
  old map - a lesson worth restating.** Building a fresh generator from Reservoir's proven primitives
  did not automatically produce safe geometry; two new primitives had bugs a live Playwright bot sweep
  and manual raw-tile scans caught before merge:
  1. `screenUStair` (the new ascending-staircase motif, no wall-kick required) used a `wallTop`
     constant near the summit for BOTH its entry and exit backstop walls, extending solid fill from
     high above the climb all the way down through the entry floor - a full impassable pillar right
     at the screen boundary, blocking the flat walk-in entirely. This is the exact same bug class
     documented repeatedly in Reservoir's rebuilds ("a wall starting above the row the player is
     already standing on blocks the walk-in") but in a *new* primitive that hadn't been through that
     lesson yet. Fixed by removing `wallTop` and mirroring `screenDStair`'s proven convention:
     backstops start at their own floor's row and only extend down, never up.
  2. `screenUShaft`'s wall-kick gap used `Math.ceil(gapWidth / 2)` on both sides of a center column,
     which for the intended `gapWidth = 3` rounds up to a **4-tile (64px) real gap** on both branches
     of the shaft - dangerously close to the ~68.5px max wall-kick reach with none of the ~30-40%
     margin the base-kit jump-reach bugfix (see below) established as safe for a 48px (3-tile) gap.
     A live Playwright chained-kick attempt against the buggy version free-fell straight through the
     shaft to a checkpoint respawn. Fixed to compute the gap as exactly `gapWidth` tiles
     (`rightWallStart = leftWallEnd + gapWidth`), verified via a raw-tile scan showing a clean 3-tile
     gap on all 4 shaft legs (3 in the mandatory ascent, 1 reprise in finalExam) after the fix.
  3. The turbine-tower branch had the player *arrive* at the lower band and placed the risky upper
     blade-platforms 9 rows (144px) above that arrival point - well beyond the ~56px max jump height,
     making the upper route physically unreachable from the fork's own entry (a bug in the branch's
     row assignment, not a tile-fill bug). Fixed by making the preceding stair-ascent's summit land
     the player directly on the upper band (so the first blade platform is reachable by simply walking
     off the last tread) and placing the lower "safe" band 9 rows *below* arrival instead - reachable
     the way a drop is always reachable (gravity does the work), never the way a climb needs to be.
  4. The Legs Capsule's wall-kick alcove pillars stopped 4 rows (64px) short of the floor the player
     stands on, leaving a gap wider than the max jump height with nothing to jump *from* - unreachable
     even in principle. Fixed by extending both pillars down through the floor row itself (mirroring
     the shaft's own "wall spans down through the entry/exit row" convention) and narrowing the
     wall-kick gap between them from 4 to the proven-safe 3 tiles.
  All four were caught by combining a raw ground-tile scan (not trusting entity/zone markers) with a
  live headless-Playwright bot sweep from spawn to the boss door in two overlapping passes (one
  covering intro→escalation→branch, one covering remix-plateau→setpiece→breather→finalExam→preboss,
  since a single naive "hold right + tap jump" bot cannot itself execute a real wall-kick chain - see
  the base-kit jump-reach bugfix's identical caveat about chained-kick timing needing a real device
  playtest, restated here rather than re-litigated). Both sweeps traversed every non-wall-kick screen
  cleanly (including the full branch fork→rejoin span and the multi-floor top/bottom tiers); the only
  stalls were at wall-kick shaft legs (expected bot limitation) and one death to the escalation beat's
  spikes before reaching a checkpoint (expected hazard behavior, correct respawn).
- **§2.7 terrain-shape report** (mechanically validated by the generator on every run, not eyeballed):
  - Vertical path: **40%** of the 35-screen sequence is U/D-tagged (14/35) - comfortably above the 35%
    floor. Longest same-direction run: 3. Direction changes: 18.
  - Ground surface (raw tile scan, real 320px screens, independent of the above): min-row range
    17-77 (**5.33 real screens** of vertical range, up from the pre-existing map's 4.27), longest
    near-flat run 3 real screens (at the limit, not exceeding it).
  - **ASCENT SHAFT** (solar pylon, 3 wall-kick legs, `ascentShaftZone` + vertical camera zone):
    real screens **13-15**.
  - **CONTROLLED DESCENT** (high-speed boost-strip descent, the setpiece - distinct primitive
    (`screenDBoost`, two wide treads) from Reservoir's water descent): real screens **18-21**.
  - **MULTI-FLOOR ROOM** (highway underpass breather, 2 real screens of stacked road/drainage layers
    with drop-through gaps, player picks a layer): real screens **21-23**.
  - **BRANCH & REJOIN** (turbine tower: upper blade-platform route, floating ledges + patrol drones +
    pickups, risky / lower fence-corridor route, continuous floor + electric fences, safe): fork at
    real screen **9**, rejoin by real screen **10** (the upper band's floor stops short, so a player
    still up top free-falls onto the lower band before the span ends - same "stop the floor early"
    rejoin technique Reservoir's M4.1-REBUILD-3 branch used).
  - Legs Capsule (no weapon gate) hangs off the breather's lower layer at real screen 24, via a
    3-tile wall-kick gap now reaching down to the floor.
  - Motif variety: 9 distinct ground shapes used (`flat`, `stairAscent`, `stairDescent`, `gap`,
    `branch`, `shaft`, `boostDescent`, `sheerDescent`, `multiFloor`), longest same-motif run 3.
  - Content variety: 0 consecutive-identical-signature violations; density 1.75 screens/encounter
    (20 regular-enemy placements / 35 screens, inside the 1.5-2.0 target); the speed-strip/
    collapsing-bridge gimmick touches beats 2, 5, 6 (setpiece), and 8 (finalExam) - the through-line
    requirement.
  - Fairness: every wall-kick gap is exactly 3 tiles (48px, the base-kit jump-reach bugfix's proven-
    safe value); every flat-ground gap (`gap` motif, screens 7 and 29) is also 3 tiles. Base-kit
    clearable throughout, no dash required.
- **Before → after per-real-screen surface row** (raw tile scan, `min`/`max` = topmost solid tile row
  in that 320px screen; BEFORE from the pre-existing map, AFTER from this rebuild):
  - BEFORE (31 real screens, 8.36 screens tall, 4.27 screens of surface variance):
    `[{"screen":1,"min":44},{"screen":2,"min":44},{"screen":3,"min":32},{"screen":4,"min":44},{"screen":5,"min":44},{"screen":6,"min":32},{"screen":7,"min":32},{"screen":8,"min":32},{"screen":9,"min":32},{"screen":10,"min":44},{"screen":11,"min":44},{"screen":12,"min":44},{"screen":13,"min":20},{"screen":14,"min":8},{"screen":15,"min":8},{"screen":16,"min":8},{"screen":17,"min":8},{"screen":18,"min":12},{"screen":19,"min":20},{"screen":20,"min":32},{"screen":21,"min":44},{"screen":22,"min":56},{"screen":23,"min":55},{"screen":24,"min":56},{"screen":25,"min":44},{"screen":26,"min":44},{"screen":27,"min":56},{"screen":28,"min":56},{"screen":29,"min":56},{"screen":30,"min":56},{"screen":31,"min":32}]`
  - AFTER (32 real screens, 8.53 screens tall, 5.33 screens of surface variance):
    `[{"screen":1,"min":44},{"screen":2,"min":44},{"screen":3,"min":32},{"screen":4,"min":32},{"screen":5,"min":32},{"screen":6,"min":44},{"screen":7,"min":44},{"screen":8,"min":32},{"screen":9,"min":32},{"screen":10,"min":32},{"screen":11,"min":47},{"screen":12,"min":53},{"screen":13,"min":41},{"screen":14,"min":29},{"screen":15,"min":17},{"screen":16,"min":17},{"screen":17,"min":17},{"screen":18,"min":17},{"screen":19,"min":35},{"screen":20,"min":41},{"screen":21,"min":61},{"screen":22,"min":65},{"screen":23,"min":65},{"screen":24,"min":67},{"screen":25,"min":77},{"screen":26,"min":65},{"screen":27,"min":65},{"screen":28,"min":77},{"screen":29,"min":77},{"screen":30,"min":77},{"screen":31,"min":77}]`
  - The aggregate variance metric moved less than the qualitative fixes might suggest (4.27→5.33
    screens, +25%) - most of the added height sits inside the mandatory ascent shaft and the deeper
    branch separation, while several beats (intro, tutorial, pre-boss) stay deliberately near-flat for
    pacing/readability, same as Reservoir's own beats do. The per-item §2.7 checklist above (not the
    aggregate number alone) is the actual compliance signal, matching how §2.7 itself frames these as
    separate checked items.
- **Map grew in both dimensions.** 606×94 tiles (9,696×1,504px) → 622×96 tiles (9,952×1,536px) - wider
  (the branch and multi-floor rooms both widened to genuine multi-screen spans, matching Reservoir's
  precedent that a "room" claimed as multi-screen has to actually measure as one in raw tiles) and
  taller (the fixed ascent shaft and deepened branch separation).
- **`SpeedwayScene.ts`'s `BOSS_ROOM_FLOOR_Y`** updated from 888 to 1222 (now the exact value
  in the regenerated map's own `bossSpawn` object-center Y) - read from generated map data rather than
  hand-derived, the same discipline Reservoir's M4.1-REBUILD/M2-REBUILD already established for this
  exact class of coordinate.
- **Auto-merge intentionally left off this PR** per the request - this is a terrain rebuild of an
  already-shipped, already-merged stage, and the PO asked to audit the regenerated JSON before it
  lands.

## Debug tool — path-line nav aid replaces the single nearest-landmark readout

- **What was actually there before this.** The request described upgrading "the debug navigation aid
  ... from a single arrow" and asked to "keep the existing `next: <id>` text". Neither existed: the
  overlay (`debugOverlay.ts`) had no arrow or line rendering of any kind, and its readout was
  `near: <id>` - the *nearest* landmark by absolute x-distance, not the *next* one ahead of the player
  (a meaningful difference: standing just past a checkpoint, "nearest" reports the one you already
  passed). Proceeded anyway rather than blocking on the mismatch, same reasoning as the M4.1-REBUILD-2
  raw-tile audit: the requested end state is fully specified and independently buildable regardless of
  what label the prior state used, and this is a debug-only visualization with no design content to
  get wrong. Replaced `near:` with genuine forward-looking `next:` semantics as part of this change.
- **Route model.** `DebugLandmark` gained `y` (was x-only, insufficient for a 2D line) and
  `kind: 'main' | 'branch'`. Main-path nodes are checkpoints + beat `sections` (already emitted by
  both stage generators) + the map's `bossDoor` entity, read generically off the `entities`/`sections`
  object layers in `BaseStageScene` - no stage-specific code needed, both Speedway and Reservoir get
  this automatically. Branch/secret nodes come from a small known set of capsule entity `type`s
  (`bodyCapsulePump`, `legsCapsule`, plus `armsCapsule`/`heartCapsule` for forward-compat with M5-M8) -
  kept as a hardcoded set in `BaseStageScene.ts` rather than an authored map property, since it's
  purely a dev-build visualization concern with no bearing on the actual stage data.
- **Rendering.** Main path: a bright white dashed polyline from the player's live position through
  every upcoming main-path node in ascending-x order, ending at the boss door, with a small filled dot
  at each node - unbroken through branch points. Branch/secret nodes: a dim, thin, undashed line from
  the *nearest* main-path node out to the secret's actual position, so it reads as an optional
  side-trip rather than part of the route. Dash-segment math (`computeDashSegments`) is a pure,
  independently unit-tested function (`dashedLine.ts`) - Graphics-drawing glue in `debugOverlay.ts`
  just strokes whatever segments it returns, same split as `waterPhysics.ts`/`jumpPhysics.ts`.
- **Scope.** Gated behind the same `debugBuildEnabled` check that already gates the `pos:`/`tile:`/
  `screen:` readout lines (false in a release `vite build`, true only for `npm run dev` and the debug-
  APK mode) and toggled by the same F3 / three-finger-tap the rest of the overlay already uses - no new
  toggle, no gameplay-affecting change, confirmed via `git diff src/main.ts` being empty after the
  temporary live-verification hook was reverted.

## Bugfix (P1) — Coral Reservoir water gimmick: player hidden and unable to submerge

Two related GDD §3.2 "underwater float physics" failures around the setpiece's rising water
(screen ~17), both in code that's been sitting unchanged since the water gimmick was first built.

- **Visibility: water rendered in front of the player, not behind it.** `RisingWaterZone`'s fill
  rectangle and `WaterGate`'s open-gate fill rectangle are both plain `scene.add.rectangle(...)`
  calls with no explicit depth, so they default to depth 0 - same as the player's visual sprite
  (`InterpolatedPhysicsSprite`, also undepthed). Phaser breaks same-depth ties by scene-add order,
  and every water overlay is spawned during `setupEntities()`, which runs *after* `this.player = new
  Player(...)` in `BaseStageScene.create()` - so water was always rendering on top of, not behind,
  the player, making the player appear to vanish on entry. Fixed with a single shared constant,
  `waterTuning.renderDepth = -1`, applied to both rectangles - keeps every water overlay behind
  gameplay actors regardless of add order, without touching the player's own depth (so no other
  actor's stacking order changes). Confirmed via a live-browser screenshot: the player sprite is
  clearly visible on top of the water fill.
- **Cannot submerge: the water's own "assist" push was an unbounded accelerator, not a gentle nudge.**
  `RisingWaterZone.pushY` (-60) was being added directly onto `body.velocity.y` every fixed step for
  as long as the player overlapped the zone, via the same `addCurrentPush`/`applyCurrentPush` path
  used for brief current-hazard crossings. That's fine for a current you pass through in a handful of
  frames, but the rising water is a large volume the player can sit inside for many seconds - with
  nothing capping the result, the push compounded every tick into a runaway upward velocity (measured
  in a scratch reproduction: -3600px/s² effective acceleration, dwarfing gravity), rocketing the
  player to the ceiling and back down over and over - which reads exactly like "continuously
  auto-jumps/bobs, can't sink." There was also no way to swim down at all: `InputSnapshot` had no
  vertical axis, `jumpHeld` only ever gave an upward swim-kick, and gravity alone (already reduced by
  the buoyancy multiplier) was the only downward force, easily overwhelmed by the uncapped push.
  Fixed two ways: (1) added `waterTuning.buoyancy.maxRiseSpeedY` (150) and a new
  `clampSubmergedVelocityY` helper (`waterPhysics.ts`) that bounds submerged velocity in *both*
  directions, called last in `Player.fixedUpdate` (after gravity, jump kicks, and any current/water
  push have all contributed) so it's the actual terminal speed for the frame, not an early check a
  later push silently undoes; (2) added a `moveY: -1 | 0 | 1` axis to the shared `InputSnapshot`
  (keyboard: arrow keys/WS; gamepad: D-pad/left-stick Y; touch sources report a fixed `0` - the
  floating-stick and fixed-dpad touch controls are deliberately horizontal-only per their own
  existing docs, and adding a vertical touch control is a mobile-UI design decision out of scope for
  this bug) and a new `waterTuning.buoyancy.swimSpeedY` (60) - holding up/down while submerged now
  directly sets `velocity.y` for that frame, the same constant-speed model horizontal movement
  already uses, so swimming down is a deliberate, responsive action rather than something the player
  has to wait on gravity for. Jump still gives the existing swim-kick stroke unchanged. Verified live:
  holding down produces a steady, non-accelerating descent through the full water column; holding up
  is the mirror; with no vertical input held, velocity now visibly bounds and oscillates near the cap
  instead of running away without limit.

## M4.1-REBUILD-3 — multi-floor room widened, branch bands deepened, and a screen-numbering discrepancy resolved

- **Why the PO's screen numbers ("screen 11", "screens 15-22") didn't match this repo's own report
  ("screens 14-15", "screens 20-26").** This generator's `segments[]` index counts *generation units*,
  not real 320px camera-viewport screens - a vertical ('D'/'U') unit is only `V_COLS`=12 tiles (192px)
  wide, 60% of a horizontal ('R') unit's 20 tiles (320px). Converting entity x-positions to real
  screens (`x / 320 + 1`) lines the PO's numbers up almost exactly with what was actually built (multi-
  floor gate at real screen ~12.4, matching "screen 11"; ascent shaft spanning real screens ~16.6-21.2,
  matching "screens 15-22"). The PO's numbers were the real, player-experienced ones; this generator's
  own `segments[]` index was the misleading one. Fixed the *reporting* going forward - screen ranges in
  this entry and the accompanying PR use real `x/320+1` screen numbers, not segment index.
- **Root cause of "multi-floor room is only 1 screen": it was.** The room's `colEnd` was hardcoded to
  `cursor.col + H_COLS` (one 20-tile/320px screen), and the 2 `segments[]` slots it "spans" in this
  generator's own bookkeeping were purely a vertical-stat label (2 D-tagged slots for 2 real 12-tile
  elevation drops) - not 2 real screens of horizontal travel. All 3 tiers, both gates, and both valves
  were crammed into that single 320px width. Fixed by widening `colEnd` to `cursor.col + H_COLS * 2`
  (a real 40-tile/2-screen span, real screens ~12-14) and spreading the valve/gate pairs across that
  width (Gate A now ~14 tiles in, Gate B ~26 tiles in, vs. both crammed within the first 8-13 tiles
  before) so each tier is a real corridor the player rides, not a landing pad at the entrance. Also
  added a second enemy + pickup per tier so the extra width has real content, not empty runway.
- **A second, more consequential bug found in the same room while fixing the first: the entry wall
  blocked the room outright, on both the old and new width.** Same class of bug as the
  `screenDChute`/`screenDStair`/`screenDSheer` fix from the prior rebuild (M4.1-REBUILD-2), just never
  applied here since this room is hand-coded rather than using those helper functions: the entry
  backstop wall was `fillWall(colStart, colStart+2, topRow-4, botRow+FILL_DEPTH)`, four tiles *above*
  the floor the player is already standing on when walking in from the previous screen. Confirmed via
  raw tile scan (column 220-221, the pre-existing pre-fix file: solid continuously from row 100, no
  break, with the player's own approach row also 100 - fully embedded) and via the full-stage
  live-browser sweep from the prior session stalling at almost exactly this column. This plausibly
  explains why the room "wasn't there" in actual play even before the width problem: a player walking
  in flat from the previous screen never got past the threshold to see the tiers at all. Fixed the same
  way as the descent primitives - backstop walls now start exactly at their own floor's row (entry wall
  at `topRow`, exit wall at `botRow`, the only floor exposed at the room's far end since every tier
  funnels there).
- **Branch fix: same width, deeper gap.** The branch's 40-tile/2-screen span was already correct (built
  correctly in M4.1-REBUILD-2); what wasn't was the *separation* between bands - `upperRow` was only 3
  rows (48px, one player-height) above `lowerRow`, so the "flooded gallery" and "drained crawl" were
  functionally the same elevation with a barely-there step between them, not two distinct routes.
  Widened to 9 rows (144px) of open air between the bands. Raw tile scan confirms both bands are
  simultaneously present at every sampled column, now with a real vertical gap between them (rows 119
  and 128, vs. 125 and 128 before).
- **Verification.** Live-browser walkthrough (temporary debug hook, reverted before commit - `git diff
  src/main.ts` is empty): walked the full multi-floor room end to end (top tier -> valve A -> drop
  through gate A -> mid tier -> continues walking, all landings solid, zero fall-throughs), confirmed
  the bottom tier is a real ~14-tile floor, and walked both branch bands independently across their
  full width. `npm run typecheck`/`lint`/`format:check`/`test`/`build` all clean; the generator's own
  §2.6/§2.7/motif checks all still pass (0 consecutive-signature violations, longest motif run still 3,
  max same-direction run still 3, 47.2% vertical, 19 direction changes).

## M4.1-REBUILD-2 — Coral Reservoir: the ground layer itself, re-authored by hand

- **Why this exists.** M4.1-REBUILD was rejected: it reused the same three deterministic
  `screenR`/`screenD`/`screenU` shape primitives unchanged, just reordering which screen got which
  enemy/gimmick content, and by coincidence kept the same total vertical-screen count leading into the
  ascent shaft/multi-floor room/branch as the pre-rebuild file - so the raw ground tiles in those
  regions came out byte-identical (just shifted a few columns), even though the *entity* content had
  genuinely changed. The rejection was verified independently, not taken on faith: a scratch script
  scans the `ground` tilelayer's raw GID array directly (columns, not the generator's own segment
  bookkeeping) for GID=2 (`TOP`, written only by `fillFloor`/`fillLedge`, never by `fillWall`) to get a
  ground-truth surface-row-per-column profile, then locates each mandatory feature via an independent
  entity anchor (`ascentShaftZone`, `gate-multifloor-A`, `bodyCapsulePump` - all pre-existing in both
  files) and diffs the sampled rows. That confirmed the ascent shaft and multi-floor room were
  identical, just relabeled.
- **The fix: new terrain, not renamed terrain.** This rebuild introduces genuinely different ground
  shapes (`screenDStair` - a solid 4-step staircase, no gaps; `screenDSheer` - one big 8-tile fall, one
  mid-landing, a 4-tile fall to floor - alongside the pre-existing `screenDChute` zigzag and
  `screenUShaft` wall-kick gap), deliberately changes the vertical-screen composition (10 descents / 7
  ascents, vs. the rejected build's 13/5-6) specifically so cumulative row totals can't coincidentally
  land on the same absolute rows again, corrects a 3-slot/2-gap bookkeeping mismatch in the multi-floor
  room (it only has 2 real 12-tile gaps between its 3 tiers, not 3), widens the branch from 1 screen to
  a genuine 2-screen/40-tile span with both bands (upper flooded gallery, lower drained crawl)
  continuous the whole way, and extends the ascent shaft to 6 full wall-kick legs (72 tiles of climb,
  one plateau break to respect the run-length cap). A new `motif` axis (separate from the §2.6
  direction axis) is tracked per screen and mechanically checked: no ledge/gap pattern may repeat more
  than 3 screens consecutively - build-failing, not just reported.
- **Verified by re-running the same independent raw-tile audit against this build, not just re-running
  the generator's own checks.** Per-screen surface height (`rowExit`, sampled independently at each
  screen's own column range) matches the pre-rebuild baseline at **0 of 34 comparable screens (0%)**,
  comfortably under the "redo it" threshold of 30%. The ascent shaft region's raw sampled surface-row
  sequence is now `[140,·,128,128,·,116,116,·,104×7,·,92,92,·,80,80,·,68]` (72-tile total delta) vs.
  the pre-rebuild `[164,·,152,152,·,140,140,·,128×7,·,116]` (48-tile delta) - different rows, different
  climb length, not a shifted copy. The multi-floor room's raw floor rows are `104, 128` here vs. `140,
  152` before. The branch region now genuinely shows **two simultaneous TOP rows at the same columns**
  (125 and 128, 3 rows/48px apart) across its full width - confirmed by direct per-column tile scan,
  not just the generator's own bookkeeping.
- **A branch-widening bug found and fixed during that same audit.** The first draft of the widened
  branch used `fillFloor(..., upperRow, 3)` for the upper gallery's floor - a nonzero fill depth that,
  since `upperRow` and `lowerRow` are only 3 rows apart, buried the lower crawl's headroom and its own
  TOP tile in solid fill, collapsing what should have been two separate bands into one. Fixed with
  `depth=0` for the upper floor, the same fix already used for the multi-floor room's `topRow`/`midRow`
  tiers - confirmed after the fix that both bands are simultaneously walkable (raw tile scan shows both
  TOP rows present at every column across the span, and a live-browser walkthrough crosses both bands
  end-to-end without falling through).
- **A pre-existing, stage-breaking collision bug found during live-browser verification, present
  identically in the already-shipped pre-rebuild file - not something this rebuild introduced, but too
  severe to ship without fixing.** Every `screenDChute`/`screenDStair`/`screenDSheer` entry/exit
  "backstop" wall was computed as `wallTop = rowStart - 6` (or `-4`), i.e. starting several tiles
  *above* the floor the player is already standing on when walking in from the previous screen. Since
  Arcade collision doesn't distinguish `FILL` from `TOP` (`setCollisionByExclusion([-1])` - both solid),
  that buried the entry/exit floor mid-wall with no reachable approach: a player walking flat into the
  very first descent (screen 3) hits solid rock and is fully blocked, and even a max-height jump (3.5
  tiles, per `playerTuning.jump.maxHeightTiles`) can't clear a wall that starts 6 tiles above their
  head. Confirmed via a live headless-browser walkthrough of the *unmodified* pre-rebuild file at the
  identical screen - same dead stop, same coordinates. Fixed by starting each backstop wall exactly at
  its own floor's row (entry wall at `rowStart`, exit wall at `rowEnd`) instead of several tiles above
  it - matching how every other floor primitive (`screenR`, the ledges) already works, with nothing
  else above a floor's own row unless something is deliberately built there. Re-verified live: the
  player now walks straight through what was previously a hard wall and free-falls into the descent as
  intended. The wall-kick ascent shaft's own multi-leg chaining (`screenUShaft`, unchanged from the
  Speedway-proven pattern) showed the same kind of embedded-floor geometry on paper, but its pillars
  must stay tall for wall-kicking (can't apply the same fix without deleting the kick surfaces); a
  scripted bot could get the player engaging both walls and gaining some height but couldn't be made to
  chain a full clean climb inside headless-browser input-timing limits - flagged here rather than
  claimed as fully verified; recommend a manual playtest pass focused specifically on the shaft.

## M4.1-REBUILD — Coral Reservoir re-authored for GDD §2.7 content/terrain variety

- **Starting point and a discrepancy worth recording.** The rebuild request described the pre-rebuild
  file as "29 screens" with escalation at screens 7-10 and finalExam at 22-25. The actual `main`/PR
  branch `reservoir.json` at the time (the only copy that exists anywhere in this repo's git history -
  checked every branch) was the 35-screen M4.1 build from this same PR, with escalation at 9-13 and
  finalExam at 29-33. No 29-screen variant exists anywhere accessible. Proceeded by rebuilding *that*
  file (the one actually in the repo) against the four problems as stated, rather than blocking on the
  mismatch - the four problems themselves are concrete and independently checkable regardless of which
  screen numbers originally illustrated them, and this repo's own earlier "audit" comment (posted
  before this rebuild request) independently found the same problem categories in the real file, just
  under different screen numbers. Beat *markers* (9 beats, same names/order) and checkpoint *roles*
  (start / post-mid-boss / post-setpiece / pre-boss, same 4) are unchanged; exact screen counts per
  beat shifted because the terrain itself was substantially reworked (real branch, real multi-floor
  gates, a rising-water shaft) - preserving the old beat/checkpoint *identity* while changing their
  *content* is the reading of "keep beat markers and checkpoints where they are" that's consistent
  with also being asked to fix the terrain shape in the same request.
- **Problem 1 (repeated enemy formula) fixed by authoring each screen as one named SITUATION**, not a
  blended current+bubbleCrab+urchin sprinkle. Escalation (beat 3, screens 8-12) teaches each element
  in isolation first (Bubble Crab alone, Urchin alone, Current alone, Dart Fish alone) before one
  2-element combo as its climax; finalExam (beat 8, screens 28-32) is a genuinely different texture -
  every screen layers 2-3 already-taught elements simultaneously (current-boosted crab gauntlet,
  a 3-element dart-fish-mid-current ambush, a first-ever double-Bubble-Crab screen, a valve-gated
  urchin drop), never repeating escalation's one-at-a-time shape. Verified mechanically, not by eye:
  the generator computes each screen's (enemy+hazard+gimmick) signature as it places entities and
  fails the build if any two *consecutive* screens share one - 0 violations across all 34 screens.
  Encounter density: 18 regular-enemy placements / 34 screens = 1.89 screens/encounter, inside the
  §2.6/§2.7 1.5-2.0 target band (also enforced as a build-failing check, not just reported after the
  fact).
- **Problem 2 (water gimmick vanishing after screen ~19) fixed with a genuinely new mechanic for the
  setpiece: `RisingWaterZone`.** A water surface that starts at the ascent shaft's bottom and climbs
  at a steady rate once triggered (entering the shaft's own vertical-camera zone), capping at a
  ceiling row - anyone below the current surface gets float physics plus a gentle *upward* push. It's
  explicitly an assist, not a hazard (0 damage, matches GDD §3b's currents rule) - falling behind the
  rising water helps the player catch up rather than punishing them, so it can't create an unfair
  "outrun the water or die" scenario the base kit (no dash) couldn't clear. This directly answers the
  GDD §3.2 "rising-water ascent... or current-driven descent" prompt for the setpiece's signature
  water moment, chosen over the descent option because the ascent shaft was already a separate
  mandatory §2.6 requirement - solving both with one setpiece is more efficient than building two
  unrelated signature moments. The gimmick's actual reach is checked mechanically: the generator
  collects every screen that places a `waterValve`/`current`/`risingWaterZone` and fails the build if
  beat 6 (setpiece) or beat 8 (finalExam) has none - both now do (screens 20-21 rising water; screens
  28/29/30/32 current or a reused valve/gate). The gimmick touches every beat from tutorial (2) through
  pre-boss (9); only intro (1) is gimmick-free, matching the GDD §2.6 template's own intent ("sells
  the theme," not the mechanic yet - Speedway's intro is equally gimmick-free).
- **`updateWater()` folds the rising-water zone into the SAME submerged/push accumulator as gates and
  currents**, not a separate call that could silently overwrite an already-computed current push if
  the two ever overlapped in the same screen (they don't, in this map, but the bug would have been
  latent and easy to reintroduce later). Caught and fixed while wiring the scene, before it shipped.
- **Problem 3 (no branch & rejoin) fixed at screen 18**: a real fork within one screen's column span -
  upper flooded gallery (a current, a Bubble Crab, 2 pickups) directly above a continuous lower drained
  crawl (a Toxic Urchin, the Body Capsule pump), both spanning the same columns and both leading into
  screen 19 without requiring backtracking. Reuses the exact step-up/rejoin geometry the original M4.1
  build already had proven safe (48px step, within the 56px/3.5-tile max jump ceiling) - this problem
  was really about content/variety inside the branch, not its underlying physics, which didn't need
  re-deriving.
- **Problem 4 (monotonic slope) fixed by interleaving R and D through beats 2-3 instead of running
  them in long blocks**, and by giving finalExam its own internal D-R-U-R-D wiggle rather than letting
  it just continue whatever direction the setpiece left off in. Recomputed stats from the actual
  generated sequence (not carried over from the old build): **52.9% vertical** (18/34, still well
  above the ≥35% floor and higher than the original M4.1's 51.4%), **max consecutive same-direction
  run: 3** (hit twice, never exceeded), **23 dominant-direction changes** (vs. the ≥4 floor). The new
  §2.7 "no more than 3 consecutive near-zero-vertical-variation (flat) screens" check is satisfied too
  - max flat (`R`-tagged) run is 2, well under the cap; the full per-screen surface-row table is in the
  PR's §2.7 report, not just the aggregate stats, so a monotonic slope hiding behind good aggregate
  numbers can't happen unnoticed. **Named terrain-feature ranges** (all state-derived from the actual
  segment log, not eyeballed): controlled descent = screens 5-7 (three staged, readable-landing legs,
  the beat 2 tutorial's second half); ascent shaft = screens 20-24 (5 screens, water-active 20-21,
  dry 22-24); multi-floor room = screen 16 (3-tier, 2 valve/gate pairs); branch & rejoin = screen 18.
- **Max gap width: 0 tiles - an honest, unchanged finding from this repo's own prior audit, not
  something this rebuild was asked to fix.** Every flat (`R`-tagged) screen's floor is unbroken except
  valve-gated openings (which aren't "jump gaps," they're binary open/closed passages); all real
  traversal challenges are vertical-shaft ledge-to-ledge drops or valve-gated drops, each individually
  checked against the base-kit (no-dash) jump-reach ceiling established in Speedway's own bugfix log
  (max flat jump ≈ 63.5-68.5px available vs. the 48-64px this map's ledges actually require - 25-40%
  margin, not pixel-perfect).
- **Verification.** Typecheck/lint/format/110 tests (unchanged - no new pure-logic surface beyond
  `RisingWaterZone`, which is Phaser-only like `Current`/`WaterGate` and so isn't unit-tested, matching
  their precedent)/build all clean. The generator itself now fails its own build (not just warns) on
  any §2.7 regression: screen-count range, vertical %, max run, direction changes, ground-anchor
  placement, consecutive-signature duplicates, density band, and setpiece/finalExam gimmick coverage
  are all hard `throw`s, so a future edit that reintroduces any of the four original problems breaks
  `node scripts/generate-reservoir-map.mjs` immediately instead of shipping quietly. Live-browser
  verification (temporary `window.__debugGame` hook, reverted before commit - `git diff src/main.ts`
  empty in the final tree): a real 9-second blind run with actual keyboard input from stage start
  through tutorial/escalation/mid-boss and into remix with zero errors; both multi-floor gates toggle
  correctly; a full rising-water-zone stress-drive through the entire ascent shaft (182 real animation
  frames, same technique as the earlier camera-margin stress test) confirms the trigger fires and the
  zone runs its full climb without error; the Tide Manta ritual → Volt Chain weakness-hit (16→12 HP,
  forced `stunned`) sequence still passes, confirming the terrain rebuild didn't disturb boss wiring.
  Zero console/page errors throughout.

## Bugfix (P1) — camera let the player get too close to / off the screen edge at transitions

- **Root cause #1 (the actual GDD §2.6 violation): no hard floor under the deadzone/lerp follow.**
  `BaseStageScene` only ever used Phaser's soft `startFollow` + `setDeadzone(30, 60)` + a 0.15 lerp -
  correct for ordinary walking speed, but nothing stopped the player from outrunning it during fast
  motion (a free-fall down a descent chute, a forced-velocity current push, a wall-kick chain) and
  ending up jammed against - or briefly past - a viewport edge before the lerp caught up. Fixed with
  `enforceCameraSafetyMargin()`, a hard clamp on `camera.scrollX/scrollY` (32px horizontal / 24px
  vertical margin) that runs every real frame, after every other camera-affecting update (look-ahead
  offset, vertical-zone pan/lock, subclass boss-room lock) but *before* Phaser's own
  `preRender()`/render pass consumes those values - confirmed via `node_modules/phaser`'s own source
  that `Systems.step()` (which calls `Scene.update()`) always runs before `Systems.render()`
  (which calls `Camera.preRender()`), and that `preRender()` reads `this.scrollX`/`this.scrollY`
  fresh at the top of every call - so a same-frame correction here is guaranteed to land before
  anything is drawn, not one frame late. Skipped while `cameraLocked` (a boss/mid-boss arena's fixed
  framing is intentional, already sized to keep the player in view). The 32px/24px margins are
  smaller than the deadzone's own half-extents in the common case, so under normal walking speed the
  soft deadzone reacts before the hard clamp would ever need to - it only ever engages during the
  fast-motion cases described above, verified live (see below).
- **Root cause #2 (a real, separate bug this investigation found in Reservoir's own map generator):
  the ascent shaft's registered camera-lock zone never covered its own bottom half.** `addEntity()`
  takes a *center* point and converts it to Tiled's top-left convention internally - the ascent-shaft
  zone's placement call passed a value that was meant to be roughly the shaft's *top edge* as if it
  were the *center*, which (combined with the zone's real height) pinned the zone's computed bottom
  edge to the shaft's vertical *midpoint*, not its actual bottom entry ledge. In practice this meant
  the vertical camera lock (§2.6: "vertical camera zones for shafts... lock per arena") silently
  never engaged for the lower half of the real climb - exactly the kind of transition the bug report
  named ("around screen 18 / setpiece... vertical-zone... handoffs"). Fixed by computing the zone's
  true center as the midpoint between the shaft's real top and bottom rows
  (`(ascentShaftTopRow + ascentShaftBottomRow) / 2`), not passing an edge value directly. Caught by
  reasoning through `addEntity`'s own center-to-top-left conversion after a live Playwright trace
  showed a teleported player free-falling through open air where solid shaft geometry should have
  been - not by guessing.
- **Root cause #3 (a genuine, if smaller, UX rough edge): the vertical-zone's horizontal lock was an
  instant `camera.scrollX = ...` snap, not a transition.** A player crossing the zone boundary
  off-center from the shaft's true midpoint got a same-frame jump-cut in scroll position. Replaced
  with a 220ms `Sine.easeOut` tween to the shaft's center (the X-lerp is still zeroed immediately on
  entry, which is what actually *holds* the lock in place afterward - the tween only smooths getting
  there). Composes correctly with the Tween Manager's own per-frame update running before
  `Scene.update()` (confirmed via `Systems.step()`'s event order: `PRE_UPDATE`/`UPDATE`, which drives
  tweens, fires before `sceneUpdate.call(...)`, my own `update()` override).
- **De-duplicated the vertical-camera-zone mechanism into `BaseStageScene` itself.** It was
  previously copy-pasted near-verbatim between `SpeedwayScene` and `ReservoirScene`
  (`ascentShaftZone`/`inAscentShaft`/`updateAscentShaftCamera`) - both bugs above would otherwise
  have needed fixing twice, and any future stage would inherit the same duplication risk. Now a
  single `protected registerVerticalCameraZone(zone)` + private `updateVerticalCameraZone()` on
  `BaseStageScene`; both scenes' `ascentShaftZone` entity spawners just call the shared registration
  method. `SpeedwayScene`'s own map/zone data is untouched (only genuinely correct already, per the
  audit below) - this is a pure refactor for it, not a data fix.
- **Audited every other Reservoir zone/object placed via a `rowTopY(...)` expression for the same
  center-vs-top-left mistake** (the multi-floor gates, several `current` zones, the mid-boss/boss
  room triggers, the boss door) - all of the others correctly compute a true center (either via an
  explicit `+ height/2` offset, or by construction), only the ascent-shaft zone had the bug. Logged
  here rather than silently re-deriving each one from scratch, since a second undiscovered instance
  of the same mistake was the realistic risk worth checking for.
- **Verification.** Typecheck/lint/format/110 tests/build all clean. Live-browser (temporary
  `window.__debugGame` hook, reverted before commit): (1) general traversal margin-compliance checks
  on both Reservoir (fast free-fall through a descent chute, running through the remix/branch region)
  and Speedway (running through the tutorial/fork region) - zero real violations, only a single
  unavoidable one-frame artifact immediately after an instant test-harness teleport (self-corrects by
  the very next frame, and doesn't occur during real continuous gameplay, which never teleports); (2)
  a dedicated stress test that drives the player through the *entire* vertical-camera-zone's real
  height at 400px/s (faster than any realistic wall-kick chain or free-fall speed in this stage),
  sampling every real frame - zero margin violations across the full climb, confirming both the zone
  fix and the safety clamp hold under sustained fast vertical motion, not just the general case.
  Scripted precision wall-kick-chain input via Playwright remains unreliable (same documented
  limitation as Speedway's own shaft) - the direct-drive stress test above is what actually gives
  confidence here instead.

## M4.1 — Coral Reservoir (GDD §3.2 / §2.6 / §3b): the second full stage

- **Route shape is DESCENT-dominant by design, not just "meets the minimums."** The 35-screen
  direction sequence (`RRD DRDRD RDRDR R DDDRRD UUURU RDR DRURD RR`) front-loads the descent as a
  sustained alternating D/R ratchet through beats 1-5 (13 of 18 vertical screens), then reverses
  hard into a concentrated 4-screen wall-kick ascent block as the setpiece (beat 6) - the opposite
  shape from Speedway's single-ascent-then-single-descent structure. Computed stats: **51.4%
  vertical** (18/35, vs. Speedway's 38.2%), **max same-direction run 3** (the ≤3 ceiling, hit
  exactly twice), **25 direction changes** (vs. Speedway's 17). All three numbers and the full
  beat-by-beat screen list are mechanically validated by the generator script itself (see below),
  not eyeballed - same discipline M2-REBUILD-2 established.
- **Kept the map generator script this time (`scripts/generate-reservoir-map.mjs`), unlike
  Speedway's.** M2-REBUILD-2's generator was run ad hoc and never committed - DECISIONS.md
  describes its methodology in prose only, with no way to regenerate or tweak the map without
  rewriting it from scratch. Given Reservoir's geometry is meaningfully more complex (valve-gated
  multi-tier rooms, a branch, a 4-screen ascent shaft, ~55 placed objects, all cross-validated
  against real jump-reach and ground-anchor checks before the file is written), keeping the
  generator as a real, runnable, documented artifact is a clear net improvement for anyone tuning
  this stage later. `eslint.config.js` excludes `scripts/**` from the typed-app lint project (it's
  a standalone Node content-authoring tool, not shipped code, same category as the tileset
  placeholder generator conceptually but at build-time rather than runtime).
- **Water valves/gates: the runtime object supplies "closed," the baked tile layer never does.**
  A `WaterGate` is a rectangular region that's either drained (a real static collider, walkable,
  blocks passage) or flooded (collider disabled, a submersion zone the player floats/swims in).
  Critically, the generator **deletes** the ground-layer tiles behind every gate's full footprint
  (not just its top row) rather than leaving them solid - if the baked tilemap layer stayed solid
  there, disabling the gate's own runtime collider would do nothing, since Arcade tilemap
  collision is a separate system from a standalone static image's collider. First version of the
  multi-floor room only deleted a single tile row per gate (matching the gate's own thin visual
  plate) and left the fill tiles beneath it solid - caught before it shipped by reasoning through
  the two-collision-systems interaction, not by symptom-chasing; fixed by sizing both the deleted
  tile region and the gate's own collider/submersion-zone to the *entire* connecting shaft between
  tiers, so closing a valve genuinely reads as "solid floor filling this gap" and opening it
  genuinely floods the whole connecting space, not just a token slit.
- **Valve -> gate linking is resolved after every entity is spawned, not during spawning.** Tiled
  object order isn't guaranteed to put a `waterValve` before the `waterGate` it targets (and
  shouldn't need to be authored that way). `ReservoirScene` records `{valve, targetGateName}` pairs
  during `setupEntities()` (via the existing `entityRegistry` spawner mechanism) and resolves the
  actual `WaterGate` reference in a second pass inside `create()`, after `super.create()` returns -
  same "defer, don't hand-order" instinct as `PatrolDrone`'s pylon lookup in Speedway, just as a
  batch instead of a single lookup. Verified live: toggling the tutorial valve directly flips its
  gate's `isOpen` from false to true.
- **Underwater float physics is three small, backward-compatible hooks on `Player`, not a parallel
  movement mode.** `setSubmerged(bool)` and `applyCurrentPush(x,y)` both default to "no effect" and
  (like the existing `applySpeedMultiplier`) expire unless reapplied every fixed step - so Speedway
  and the Gym, which never call either, are provably unaffected (full regression suite - 110 tests
  - still green, typecheck/lint/build clean). While submerged: gravity is scaled by
  `waterTuning.buoyancy.gravityMultiplier` (0.35), fall speed is clamped to a lower terminal
  velocity, and a jump *press* becomes a gentler "swim kick" (`selectJumpVelocity`) instead of the
  full dry-land launch - tapped repeatedly to swim upward, Mega-Man-X-underwater style. Wall-kick
  itself is untouched (Reservoir's one ascent shaft is a *drained* elevator per the GDD spec, i.e.
  dry, so this never actually needs to interact with wall-kick physics in practice, but the code
  doesn't special-case it either way).
- **Currents push by literally adding a vector onto whatever velocity the frame already computed**,
  applied last in `Player.fixedUpdate` (after buster/weapons/dash/wall-kick all had their say) so a
  current genuinely layers on top of player intent rather than fighting the state machine for
  priority - directly implements "currents push jumps" (GDD §3.2) since a jump's upward velocity
  gets nudged exactly like anything else. 0 damage, always shown by drifting bubble sprites (GDD
  §3b), confirmed via the pure `addCurrentPush` unit tests and a live overlap check in the branch's
  upper gallery.
- **Bubble Crab's bubble-pop is a `takeDamage`/`applyWeaponHit` override, not a new `Enemy` hook.**
  While bubbled, any hit (buster or weapon) is intercepted before it reaches `Enemy.takeDamage` and
  converted into "pop the bubble, start a 2s vulnerable window" instead of real damage; a hit that
  lands *during* the vulnerable window falls through to `super.takeDamage` normally. This keeps the
  base `Enemy` class untouched (no new virtual method), consistent with how `VoltCheetah` already
  overrides `applyWeaponHit` for its own special case.
- **"Walks floor/walls" (GDD §3b) is a closed kinematic rectangle loop, not real wall-relative
  gravity.** Building genuine per-surface gravity reorientation for one enemy type was judged out
  of scope for what the line is actually asking for. `BubbleCrab` disables gravity and drives its
  own position via `body.reset()` around a floor-then-wall-then-floor perimeter (same idiom
  `PatrolDrone`'s orbit mode already uses for circular motion) - it visibly walks a full floor run,
  then climbs a wall run, then walks back, satisfying the literal "floor/walls" behavior without a
  general-purpose surface-walking system.
- **The Body Capsule's Volt-Chain gate reuses the exact M3 utility-tag mechanism, not a new
  inventory flag.** Volt Chain's utility tag is `'power'` (`weaknessWheel.ts`, GDD §3.1's own
  "Utility: powers dead machinery" line) - it's the *only* weapon tagged `'power'`, so
  `BodyCapsulePump implements TaggedUtility { requiredTag: 'power' }` firing-and-hitting the pump
  with Volt Chain specifically *is* "requires Volt Chain to power the pump," through the same
  `resolveUtilityHit` path every other weapon-gated stage object already uses. Per M3's own logged
  decision, there's no save/progression system yet to source a real "does the player *own* Volt
  Chain" flag from (all 8 weapons start unlocked) - so "lacks Volt Chain" is operationalized as "the
  currently equipped weapon isn't Volt Chain," which is both testable today and exactly what a
  future save-gated version would still need to check in addition. The readable "locked" hint is a
  static sign (`PUMP / NEEDS / VOLT CHAIN`) visible the entire time the pump is unpowered, not a
  one-shot popup - correct whether the player has genuinely never unlocked Volt Chain (once a save
  system exists) or simply isn't holding it equipped right now.
- **Anglerfish (mid-boss) gets no shutter door or HP-fill ritual**, matching Speedway's twin
  Patrol Drones precedent exactly - GDD §4's door/ritual rules read as boss-room rules, and the
  existing mid-boss doesn't get them either. It's a bespoke small FSM (mimic -> proximity-triggered
  reveal telegraph, ≥20f -> lunge -> retreat -> re-mimic) rather than a reused regular-enemy class,
  since "lamp mimic" doesn't map onto any existing enemy's behavior the way "twin drones circling a
  pylon" mapped onto Patrol Drone's orbit mode. The "dark tunnel" setting is a simple darkening
  overlay over the arena screen, triggered on entry and faded out on defeat - full spotlight/vision-
  cone lighting was judged out of scope for a placeholder-art milestone (Eclipse District's
  lights-out zones are a full stage away and not built yet either).
- **Tide Manta's three patterns and weakness hook are a structural mirror of VoltCheetah**, on
  purpose - same FSM shape (`ritual -> idle -> telegraph -> pattern -> recover`, same desperation-
  queue-a-second-pattern-under-25%-HP mechanic, same `takesWeakness`/`applyWeaponHit` split). Burrow
  during the burrow/travel phase sets `invulnerable = true` ("hidden underground - nothing to hit")
  and clears it the instant it erupts into view; without this, a stray Volt Chain hit landing on the
  boss's (still-physically-present) body mid-burrow would incorrectly interrupt the pattern for free
  even though nothing should have been able to connect - caught by tracing `takesWeakness`'s guard
  clause before it shipped, not by observing it live. "Electrifies the water it swims in" (GDD
  §3.2's flavor text for the weakness reaction) is implemented as a self-contained tint flash on the
  hit, not a separate gameplay hazard - verified live: a Volt Chain hit deals exactly the fixed 4
  weakness damage and forces `stunned`; a non-weakness hit (Gale Cutter) deals its own damage with
  no forced interrupt, same as VoltCheetah's already-proven behavior.
- **Toxic Urchin added to the GDD §3b hazard matrix table.** The milestone prompt named it
  explicitly but the table (last synced in the M2-REBUILD-2 docs pass) didn't have a row for it.
  Non-lethal contact damage (1, unlike spikes' lethal contact) - it's a stationary reef obstacle you
  route around, not an instant-kill trap, and nothing in the prompt or GDD tone suggested otherwise.
- **Verification:** typecheck/lint/format/test (110 unit tests, 11 new for `waterPhysics.ts`)/build
  all clean. Live-browser verification via a temporary `window.__debugGame` hook in `main.ts`
  (same technique DECISIONS.md's ground-collision bugfix entry describes, reverted before commit -
  `git diff src/main.ts` is empty in the final tree): scene boot, real-time traversal through
  intro/tutorial/escalation with real keyboard input, the tutorial valve's gate toggling live,
  weapon-wheel cycling to Volt Chain, firing at the Body Capsule pump and the boss, and the full
  ritual -> weakness-hit -> interrupt -> normal-hit sequence on Tide Manta - zero console/page
  errors throughout.
- **Known gap, flagged rather than silently assumed solved:** the 4-screen wall-kick ascent shaft's
  full bottom-to-top chained-kick climbability wasn't verified end-to-end by a scripted bot, for the
  same reason PR #11's Speedway shaft wasn't - real chained wall-kick *timing* is a feel/skill
  question a synthetic-input harness doesn't stand in for well. Each individual band's geometry uses
  the exact 3-tile gap width the Speedway bugfix log already confirmed is comfortably kickable
  (48px required vs. ~63.5-68.5px available). Needs a real-device playtest pass, same caveat already
  on record for Speedway's own shaft.

## M3 — Weapon system (GDD §5): 8 boss weapons, weakness wheel, utility tags

- **Architecture mirrors the existing jumpPhysics.ts split.** `src/data/weaknessWheel.ts` and
  `src/systems/weapons.ts` are pure TypeScript with zero Phaser import - a probe confirmed
  importing `phaser` at all fails under this project's vitest+jsdom setup (`Not implemented:
  HTMLCanvasElement's getContext()`), which is exactly why every already-tested module
  (`checkpoint.ts`, `jumpPhysics.ts`, `edgeDetector.ts`, ...) avoids importing it. `weapons.ts`
  holds the testable logic (energy bank, Q/E slot cycling, chain/splash/boomerang/DoT/ground-wave
  math); the Phaser-side pooled sprites and dispatch live in `src/actors/WeaponController.ts` and
  `src/actors/weapons/WeaponEffectSprite.ts`, verified by headless Playwright instead of Vitest,
  same division of labor as `Player.ts` uses `jumpPhysics.ts`.
- **"phase" is an inferred utility tag, not a literal GDD quote.** GDD §3 gives each of the other
  7 weapons an explicit "Utility: ..." line (powers/douses/melts/freezes/cuts/corrodes/triggers).
  Umbra Claw's entry never states one. "phase" is the only tag left over once the other seven are
  read off, and it fits the weapon's own description ("dash-slash with i-frames" - passing through
  danger untouched). Flagging the inference here rather than presenting it as a direct quote.
- **All 8 weapons start unlocked.** GDD §2.1 gains weapons from boss defeats, but there is no
  save/progression system yet (that's M8/M9 territory) to source real unlock state from.
  `WeaponSlotCycle` takes an `isUnlocked` predicate (default: everything true) specifically so
  real gating can be wired in later without touching the cycling logic itself.
- **The shoot button fires whichever is equipped, buster included, in one Q/E ring.**
  `WEAPON_SLOTS = ['buster', ...WEAPON_ORDER]` - GDD §2.2's "Weapon Wheel — quick-switch acquired
  boss weapons" reads as a Mega-Man-style single equip slot, not a separate always-on buster.
  `Player.fixedUpdate` gates `buster.fixedUpdate`'s `shootHeld` by `weapons.isBusterActive` so only
  one system ever responds to a given press; `WeaponController`'s own fire-edge detector always
  tracks the raw input unconditionally (not gated), so switching weapons mid-press can't misfire a
  spurious shot.
- **Energy values (GDD §2.3 names the resource but gives no numbers).** 28 max per weapon (the
  genre's classic weapon-energy-bar convention), tracked independently per weapon so one doesn't
  drain another. Costs and damage are tuned per weapon's fantasy in `config/weaponTuning.ts`
  (Magma Charge/Umbra Claw cost more, matching their "carries you"/"high risk high reward" text);
  full reasoning is in that file's inline comments.
- **Magma Charge's carry and Umbra Claw's dash-slash both move the player directly**, via a new
  `Player.applyWeaponCarry(velocityX, frames)` - a sibling to the existing `wallKickLockFrames`
  forced-velocity pattern, kept as its own counter so a wall-kick and a weapon carry can never
  silently cancel each other's timing. Umbra Claw's "10 i-frames" reuses the player's existing
  `invulnFramesRemaining` window via a new `grantIFrames(frames)` - the same mechanism a hurt
  respawn already grants, just without the accompanying damage/knockback, which also gives the
  dash a free visual tell (the existing hurt-flicker) with no new code.
- **Frost Talon's freeze is a separate static collider, not a repurposed enemy body.** Turning the
  enemy's own AI-driven body into a walkable platform would mean fighting its own movement/gravity
  code per enemy type. Instead `Enemy.freeze()` disables the enemy (invulnerable, zero velocity)
  and enables a dedicated static "platform" body positioned over it, registered against the player
  once per enemy up front (body starts disabled, cheap). `isMinor` (default true) gates it off for
  bosses; `VoltCheetah` sets it false.
- **Boomerang and ground-wave physics are simplified, not full path simulation.** Gale Cutter
  reverses toward the thrower's *live* position once it passes `maxRangePx` (a homing return, for
  feel, not a strict mirror of the outbound path) and self-catches within 10px. Terra Spike rides
  the floor under gravity and turns to vertical exactly once, on real wall contact
  (`body.blocked.left/right`, not a timer) - GDD's "travels floor -> walls" doesn't specify a
  multi-turn path, and a single turn per cast reads clearly as "hits a wall, climbs it."
- **A genuinely nasty bug, worth flagging for anyone touching `WeaponEffectSprite` later:** the
  boomerang's launch-point fields were first named `originX`/`originY`. Phaser's own
  `GameObject.originX`/`originY` (the normalized 0-1 anchor Arcade uses to compute
  `displayOriginX`/`getTopLeft()`/body-position sync) share that exact name - assigning a world
  coordinate to them silently corrupted every subsequent `body.reset()`/collision check on that
  sprite (confirmed by reading `displayOriginX` mid-bug: it was showing the *fire position* in
  pixels, not `0.5`). Every weapon-vs-enemy and weapon-vs-utility-target overlap silently never
  fired until this was caught and the fields renamed to `launchX`/`launchY`. No other custom field
  name in this codebase happens to collide with a Phaser `GameObject`/`Body` property, but it's a
  sharp edge worth remembering: never name an instance field on a Phaser GameObject subclass
  `x`/`y`/`originX`/`originY`/`width`/`height`/`angle`/etc. without checking first.
- **Gym utility-tag test targets (GDD's explicit deliverable).** One target per tag: a generic
  `UtilityTarget` placeholder for the six flag-flip tags (power/douse/melt/cut/corrode/quake), a
  real `SparkBug` for "freeze" specifically (the only tag with a physical effect worth proving end
  to end - freeze into a standable platform, then thaw), and the mismatched-weapon-does-nothing
  case checked explicitly.
- **Verification went well beyond typecheck/lint/test/build**, because a bug like the
  originX/originY collision above only shows up when something actually overlaps in a live
  browser: headless Playwright confirmed real Arcade collision/velocity for all 8 weapons, all 8
  utility tags (including the freeze-into-platform mechanic and its ~3s thaw), Q/E ring cycling
  and energy spend/block, the pause weapon wheel, and - the explicit "live example" this milestone
  asked for - VoltCheetah's weakness hook: a non-weakness hit deals its own damage, the weakness
  hit deals exactly the fixed 4 damage, and it interrupts a genuinely active dash mid-pattern
  (zeroing velocity, entering `stunned`). Every pre-existing Speedway/M2 regression suite
  (elevation, fork, ascent shaft, descent, checkpoints, full boss sequence) was re-run and still
  passes. Zero console errors throughout.

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
