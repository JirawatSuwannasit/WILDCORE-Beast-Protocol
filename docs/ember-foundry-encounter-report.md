# Ember Foundry Encounter Report (FIX-4.2B)

## Pass/Fail
- PASS: approved ground tile layer unchanged
- PASS: regular enemy setups 17-22
- PASS: beat encounter distribution
- PASS: density around 1 per 1.5-2 screens
- PASS: longest enemy-free run <=5
- PASS: no >2 simultaneous regular attackers
- PASS: no consecutive duplicate enemy+hazard signatures
- PASS: no repeated formation >2
- PASS: enemies not in solid terrain
- PASS: Slag Blob ground support
- PASS: Ember Bat movement clearance
- PASS: no overlap with spawn/checkpoints/boss/fork/rejoin
- PASS: Slag Golem arena isolated
- PASS: boss room boundary clear
- PASS: signature gimmick continuity

## Summary Metrics
- Terrain-lock ground SHA-256: 9fbe38b3648c665765c39db6cbf1df324e161fe7b34649e1ac65a0060dd80ae0
- Total regular enemies: 20 (slagBlob: 10, emberBat: 10)
- Total encounters: 18
- Encounter density: 0.53 encounters/screen
- Longest enemy-free run: 5 screens
- Screens with >2 attackers: none
- Consecutive duplicate signatures: none

## Enemy + Hazard Signature Per Screen
| Screen | Enemy count | Signature |
|---:|---:|:---|
| 1 | 0 | none|none |
| 2 | 1 | slagBlob1|none |
| 3 | 0 | none|none |
| 4 | 0 | none|heatVent |
| 5 | 1 | emberBat1|none |
| 6 | 0 | none|none |
| 7 | 1 | slagBlob1|none |
| 8 | 1 | emberBat1|pistonCrusher |
| 9 | 2 | emberBat1+slagBlob1|heatVent |
| 10 | 1 | slagBlob1|none |
| 11 | 0 | none|none |
| 12 | 1 | emberBat1|none |
| 13 | 1 | slagBlob1|pistonCrusher |
| 14 | 1 | emberBat1|none |
| 15 | 0 | none|none |
| 16 | 1 | slagBlob1|none |
| 17 | 1 | emberBat1|none |
| 18 | 0 | none|none |
| 19 | 0 | none|lavaChaseTrigger |
| 20 | 1 | emberBat1|none |
| 21 | 0 | none|risingLavaZone |
| 22 | 1 | emberBat1|none |
| 23 | 0 | none|none |
| 24 | 0 | none|none |
| 25 | 0 | none|none |
| 26 | 0 | none|heatVent |
| 27 | 0 | none|none |
| 28 | 1 | slagBlob1|none |
| 29 | 2 | emberBat1+slagBlob1|none |
| 30 | 1 | slagBlob1|none |
| 31 | 1 | emberBat1|pistonCrusher |
| 32 | 0 | none|none |
| 33 | 0 | none|none |
| 34 | 1 | slagBlob1|none |

## Encounters by Beat
### Beat 1 — Intro strip
- enc-b1-blob-intro (screen 2): slagBlob — tests none movement/timing while keeping <=2 attackers.

### Beat 2 — Heat-vent tutorial
- enc-b2-bat-vent (screen 5): emberBat — tests none movement/timing while keeping <=2 attackers.
- enc-b2-blob-rail (screen 7): slagBlob — tests none movement/timing while keeping <=2 attackers.
- enc-b2-bat-high (screen 8): emberBat — tests pistonCrusher movement/timing while keeping <=2 attackers.

### Beat 3 — Escalation
- enc-b3-blob-vent (screen 9): slagBlob — tests heatVent movement/timing while keeping <=2 attackers.
- enc-b3-bat-vent (screen 9): emberBat — tests heatVent movement/timing while keeping <=2 attackers.
- enc-b3-blob-crusher (screen 10): slagBlob — tests none movement/timing while keeping <=2 attackers.
- enc-b3-bat-safe (screen 12): emberBat — tests none movement/timing while keeping <=2 attackers.

### Beat 4 — Mid-boss
- No regular-enemy encounter by design.

### Beat 5 — Second gimmick/remix
- enc-b5-upper-catwalk (screen 13): slagBlob+emberBat — tests pistonCrusher movement/timing while keeping <=2 attackers.
- enc-b5-lower-blob (screen 16): slagBlob — tests none movement/timing while keeping <=2 attackers.
- enc-b5-rejoin-bat (screen 17): emberBat — tests none movement/timing while keeping <=2 attackers.

### Beat 6 — Rising-lava setpiece
- enc-b6-bat-lava (screen 20): emberBat+emberBat — tests none movement/timing while keeping <=2 attackers.

### Beat 7 — Breather and secret
- enc-b7-optional-secret (screen 28): slagBlob — tests none movement/timing while keeping <=2 attackers.

### Beat 8 — Final exam
- enc-b8-blob-floor (screen 29): slagBlob — tests none movement/timing while keeping <=2 attackers.
- enc-b8-bat-layer (screen 29): emberBat — tests none movement/timing while keeping <=2 attackers.
- enc-b8-blob-piston (screen 30): slagBlob — tests none movement/timing while keeping <=2 attackers.
- enc-b8-bat-piston (screen 31): emberBat — tests pistonCrusher movement/timing while keeping <=2 attackers.

### Beat 9 — Pre-boss corridor
- enc-b9-simple-preboss (screen 34): slagBlob — tests none movement/timing while keeping <=2 attackers.

## Beat 8 Difficulty Difference
Beat 3 teaches vent + enemy reads on simpler lanes; Beat 8 is harder because the player must choose forge-hall floor layers while reading enemies and piston/route timing without unavoidable cross-floor fire.

## Remaining Out of Scope
Collectible reachability, off-screen projectile behavior, and Magma Rhino AI are not reviewed in FIX-4.2B.
