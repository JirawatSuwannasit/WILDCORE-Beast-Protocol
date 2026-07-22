# M4.2 Ember Foundry — GDD §2.7 Build & Verification Report

## Terrain shape (anti-corridor)
- [x] **Dominant axis:** vertical-dominant ascent / climb, matching GDD §3.3 Ember Foundry. It differs from Coral Reservoir's vertical descent by netting upward, using heat vents and a rising-lava chase as ascent pressure, and retaining a controlled lava-fall descent only as a counter-beat.
- [x] **Vertical path target:** 18 vertical legs / 35 total legs = **51.43%**, passing the vertical-dominant target of ≥35%.
- [x] **Beat-to-beat macro leg-direction list measured from Tiled section centers:** `RIGHT, UP, RIGHT, LEFT, UP, RIGHT, DOWN, RIGHT, RIGHT`. This replaces the rejected `[RIGHT x9]` corridor shape with a folded switchback spine.
- [x] **Macro direction changes:** **7**, passing the ≥4 requirement.
- [x] **Longest same-direction macro run:** **2 beats**, passing the no-run-of->3 requirement.
- [x] **Screen-level traversal list:** `R, R, D, R, U, U, R, R, U, R, D, R, R, U, U, R, R, R, D, U, U, U, R, U, U, R, D, R, D, D, R, U, R, D, R` with **23** direction changes and longest same-direction screen run **3**.
- [x] **Ground surface is not a monotonic slope:** the route uses stepped floors, dips, shafts, lavafall drops, and climbs. Real 20-tile screen analysis reports **longest near-flat run = 2 real screens**, passing the no-more-than-3 requirement.

### Per-screen surface heights
Rows are raw generator tile rows before final Tiled row-margin offset; lower row numbers are higher elevation.

| Screen | Dir | Motif | Row enter | Row exit |
|---:|:---:|---|---:|---:|
| 1 | R | flat | 260 | 260 |
| 2 | R | flat | 260 | 260 |
| 3 | D | dip | 260 | 266 |
| 4 | R | flat | 266 | 266 |
| 5 | U | ventShaft | 266 | 254 |
| 6 | U | shaft | 254 | 242 |
| 7 | R | flat | 242 | 242 |
| 8 | R | flat | 242 | 242 |
| 9 | U | ventShaft | 242 | 230 |
| 10 | R | crusherDoorway | 230 | 230 |
| 11 | D | dip | 230 | 236 |
| 12 | R | flat | 236 | 236 |
| 13 | R | arena | 236 | 236 |
| 14 | U | multiFloor | 236 | 224 |
| 15 | U | multiFloor | 224 | 212 |
| 16 | R | flat | 212 | 212 |
| 17 | R | branch | 212 | 212 |
| 18 | R | branch | 212 | 212 |
| 19 | D | sheer | 212 | 224 |
| 20 | U | lavaChase | 224 | 212 |
| 21 | U | lavaChase | 212 | 200 |
| 22 | U | lavaChase | 200 | 188 |
| 23 | R | lavaChaseLedge | 188 | 188 |
| 24 | U | lavaChase | 188 | 176 |
| 25 | U | lavaChase | 176 | 164 |
| 26 | R | flat | 164 | 164 |
| 27 | D | dip | 164 | 168 |
| 28 | R | flat | 168 | 168 |
| 29 | D | lavafallDescent | 168 | 180 |
| 30 | D | lavafallDescent | 180 | 192 |
| 31 | R | flat | 192 | 192 |
| 32 | U | ventShaft | 192 | 180 |
| 33 | R | crusherDoorway | 180 | 180 |
| 34 | D | dip | 180 | 184 |
| 35 | R | flat | 184 | 184 |

- [x] **Structural elements present:** heat-vent / wall-kick ascent shaft on screens **5-6**, rising-lava forced ascent setpiece on screens **20-25**, controlled lava-fall descent on screens **29-30**, multi-floor forge hall on screens **14-15**.
- [x] **Branch & rejoin:** screens **17-18**; upper catwalk/crusher route is faster and riskier with pickups/Heart Chip, lower pipe corridor is safer and slower, rejoining before the sheer drop.
- [x] **Rising lava placement:** `risingLava-chase` is inside the setpiece section box: setpiece `x=3056 y=2368 w=320 h=1600`; rising lava `x=3056 y=2688 w=320 h=960`.
- [x] **Controlled descent marker:** `controlledDescent-lavafall` explicitly marks screens **29-30** with steerable descent, half-screen landing visibility, no blind hazard landing, and `slowfallPushY=-90` heat-vent behavior.

## Content variety (anti-formula)
- [x] **No consecutive identical enemy+hazard signatures:** 0 violations.
- [x] **Encounter density:** 19 regular enemy encounters / 35 screens = **1.84 screens per encounter**, within the 1.5-2.0 target. Encounters per beat: beat 1 = 1, beat 2 = 1, beat 3 = 4, beat 4 = 0, beat 5 = 5, beat 6 = 2, beat 7 = 2, beat 8 = 4, beat 9 = 0.
- [x] **Signature gimmick through-line:** heat vents appear on screens **5, 9, 14, 15, 20, 21, 24, 29, 30, 32** and cover beats **2, 3, 5, 6, 8**.
- [x] **Beat 5 second gimmick/variation:** multi-floor forge hall with piston layers plus branch/rejoin, not a repeat of the beat-2 heat-vent tutorial.
- [x] **Final exam hardest combination:** screens 29-33 combine controlled lava-fall descent, heat-vent slowfall/climb, crusher timing, slagBlob, and emberBat pressure; escalation only combines early vent/crusher lessons with lighter enemy pressure.
- [x] **No two hazard types introduced in the same room:** crusher debut is isolated from lava and the rising lava setpiece is introduced later in its own section.

## Fairness
- [x] **Base-kit traversal:** maximum audited void gap is **3 tiles / 48 px**, within the no-dash base kit. Full-column empty-run audit: cols 148-151 is 3 tiles.
- [x] **Gated secrets:** Ember Foundry keeps non-required pickups/secrets on readable side routes; no main-path progression requires a boss weapon or dash.
- [x] **Playable boundaries:** generator placement validation passes for objects, crusher doorways, void gaps, and boss-room entry reachability; solid route blockers are generated from the same validated primitives.


## Machine-checkable evidence
- [x] `src/data/stages/foundry-verification.json` records dominant axis, ordered route screens, movement directions, per-screen surface rows/variation, branch/fork/rejoin, structural ranges, beat assignments, signatures, gimmicks, gap widths, and checkpoint assignments.
- [x] `src/data/stages/stageVerifier.ts` calculates and fails on the GDD §2.7 metrics, and `src/data/stages/foundryVerification.test.ts` runs it in Vitest.
- [x] Hazards are intentionally verified from the `entities` layer and verification metadata; the empty `hazards` layer is documented in `DECISIONS.md` as reserved for future non-entity tile hazards.

## PO real-device test route (not claimed as completed by Codex)
1. On an Android debug APK, start Ember Foundry from stage select with default touch controls.
2. Reach the screen-17 fork once through the upper crusher catwalk and once through the lower pipe route; confirm neither route requires dash and both rejoin at screen 19.
3. In the multi-floor forge hall, intentionally choose lower, middle, and upper layers before rejoining at screen 16.
4. In the lava-fall descent on screens 29-30, commit to the drop only after the landing is visible, steer through the heat-vent slowfall, and confirm there is no blind landing onto lava, crusher, or enemy.
5. Continue through finalExam and confirm the pre-boss checkpoint triggers before Magma Rhino.
