# Ember Foundry Terrain Report (FIX-4.2A)

## Pass/Fail
- PASS: screen count 28-36
- PASS: vertical dominant >=35%
- PASS: direction changes >=4
- PASS: same-direction run <=3
- PASS: near-zero variation run <=3
- PASS: mandatory gap <=3.5 tiles
- PASS: forge chimney ascent >=2 screens
- PASS: lava chase ascent 4-6 screens
- PASS: controlled descent >=2 screens
- PASS: multi-floor hall >=2 screens
- PASS: branch has two tile paths
- PASS: spawn/checkpoint/boss-door non-solid
- PASS: no duplicate motif run >3

## Measured Values
- Traversal screens: 34
- Vertical path: 60.6%
- Dominant-direction changes: 21
- Longest same-direction run: 3
- Longest near-zero vertical-variation run: 1
- Maximum mandatory gap: 1 tiles (cols 0-0)
- Ascent shafts: 2-5, 7-9, 11-12, 15-16, 18-21, 22-24, 28-29, 31-32
- Controlled descents: 6-7, 9-10, 16-17, 24-26, 32-33
- Multi-floor ranges: 3-10, 12-34
- Fork node: (240, 76); rejoin node: (360, 76)
- Branch proof: upper nodes 139 on screens 13, 14, 15, 16, 17, 18, 19; lower nodes 64 on screens 13, 14, 15, 16

## Per-Screen Surface Table
| Screen | Surface row | Vertical variation | Direction from previous |
|---:|---:|---:|:---|
| 1 | 112 | 41 | START |
| 2 | 112 | 41 | R |
| 3 | 96 | 59 | U |
| 4 | 88 | 67 | U |
| 5 | 80 | 75 | U |
| 6 | 72 | 83 | R |
| 7 | 80 | 11 | D |
| 8 | 76 | 11 | U |
| 9 | 72 | 11 | U |
| 10 | 76 | 11 | D |
| 11 | 76 | 0 | R |
| 12 | 72 | 8 | U |
| 13 | 72 | 8 | R |
| 14 | 72 | 8 | R |
| 15 | 72 | 8 | R |
| 16 | 72 | 8 | U |
| 17 | 76 | 8 | D |
| 18 | 76 | 11 | R |
| 19 | 57 | 14 | U |
| 20 | 40 | 12 | U |
| 21 | 33 | 14 | U |
| 22 | 16 | 12 | R |
| 23 | 9 | 14 | U |
| 24 | 4 | 12 | U |
| 25 | 33 | 15 | D |
| 26 | 45 | 15 | D |
| 27 | 45 | 15 | R |
| 28 | 45 | 15 | R |
| 29 | 16 | 16 | U |
| 30 | 16 | 16 | R |
| 31 | 16 | 16 | R |
| 32 | 8 | 16 | U |
| 33 | 28 | 5 | D |
| 34 | 28 | 5 | R |

## ASCII Route Map
```text
START -> village -> forge chimney UP -> crusher rails -> fork
                 upper catwalk fast/risky ----\
                  lower pipe slow/safe ------- rejoin -> mid-boss -> remix
                         -> rising-lava shaft UP -> lavafall DESCENT
                         -> multi-floor forge hall -> pre-boss -> boss door
```

## Branch Diagram
```text
Fork (240,76)
  upper: narrow elevated catwalk tiles, screens 13, 14, 15, 16, 17, 18, 19
  lower: wider pipe-corridor tiles, screens 13, 14, 15, 16
Rejoin (360,76)
```

## Multi-Floor Screen Evidence
| Screen | Columns with >=3 solid bands | Playable layers |
|---:|---:|---:|
| 29 | 19 | 3 |
| 30 | 19 | 3 |
| 31 | 19 | 3 |
| 32 | 19 | 3 |

## Spawn / Checkpoint / Boss Door Space
- PASS: playerSpawn playerSpawn at (2, 110) is open.
- PASS: bossDoor bossDoor at (684, 22) is open.
- PASS: checkpoint checkpoint-start at (2, 110) is open.
- PASS: checkpoint checkpoint-post-midboss at (225, 70) is open.
- PASS: checkpoint checkpoint-post-lava at (470, 14) is open.
- PASS: checkpoint checkpoint-preboss at (640, 26) is open.

## Out of Scope for FIX-4.2A
Enemy density, collectible reachability, off-screen projectiles, and Magma Rhino AI are not reviewed in this terrain-only fix.
