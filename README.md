# WILDCORE: Beast Protocol

Mega Man-style mobile action platformer for Android. Phaser 3 + TypeScript + Vite, wrapped as a
native Android app with Capacitor 6.

Design spec: [`docs/GDD.md`](docs/GDD.md). Project operating guide (how milestones are run):
[`docs/PO_PLAYBOOK.md`](docs/PO_PLAYBOOK.md). Deviations from the spec are logged in
[`DECISIONS.md`](DECISIONS.md).

## Prerequisites

- Node.js 22+
- For Android builds: JDK 17+, Android SDK (`ANDROID_HOME` set), an Android device or emulator

## Run (web dev preview)

```bash
npm install
npm run dev
```

Open the printed local URL. The dev preview is for fast desk review only — touch controls and
final acceptance testing always happen on a real Android device via the debug APK below.

## Build

```bash
npm run build      # typecheck + production web build -> dist/
npm run typecheck  # type-check only, no emit
npm run lint       # ESLint
npm run format     # Prettier --write
npm run test       # Vitest
```

## Install the debug APK on a device

Every PR's CI run attaches a `wildcore-debug-apk` workflow artifact (Actions tab → the PR's CI
run → Artifacts). To build and install it locally instead:

```bash
npm run cap:sync          # builds dist/ and copies it into android/
cd android
./gradlew assembleDebug   # outputs app/build/outputs/apk/debug/app-debug.apk
```

Then, with the device connected over USB (USB debugging enabled) and `adb` on your `PATH`:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or drag the APK onto an emulator window, or open the `android/` folder in Android Studio and hit
Run.


## Contributing

This repo uses a zero-dependency Git pre-commit hook in `.githooks/pre-commit`. `npm install` / `npm ci` runs `npm run hooks:install`, which points Git at `.githooks` with `git config core.hooksPath .githooks`. The hook formats staged `*.ts`, `*.tsx`, `*.js`, `*.json`, and `*.md` files with the already-installed local Prettier via `npx --no-install prettier --write`, then re-stages them. If Prettier is unavailable, the hook prints a warning and exits successfully so commits are never blocked by a missing tool.

## Project structure

```
src/
├─ main.ts, config/        # Phaser game config, tuning values, touch layout
├─ scenes/                 # Boot -> Title -> StageSelect -> Gym (test room; Stage lands in M2)
├─ actors/                 # Player, projectiles, target dummy, moving platform
├─ systems/                # input (+ inputSources/), physics helpers, lifecycle, debug overlay
└─ data/                   # stage/boss JSON, weakness wheel (from M2 onward)
android/                   # Capacitor Android project (generated; do not hand-edit build/ output)
capacitor.config.ts
```

## Notes for the current milestone (M1)

- The Player controller (`src/actors/Player.ts`) is playable in the **Gym** scene: Title -> tap ->
  Stage Select -> tap -> Gym. Run, variable-height jump, wall-slide/wall-kick, coyote time + input
  buffer, hurtbox/knockback/invulnerability, and the buster (hold-to-charge, pooled projectiles)
  are all live. Dash is present but inert (a config flag away from being enabled in M6).
- Touch is the primary input (`src/systems/inputSources/`): a floating stick or fixed D-pad (left
  thumb) plus Jump/Shoot/Dash buttons and weapon-swap arrows (right thumb), all >=48dp regardless
  of device zoom. The same input abstraction also serves a keyboard (dev preview: arrows/AD move,
  Z/Space jump, X shoot, C/Shift dash, Q/E swap) and a Bluetooth gamepad.
- Debug overlay: press **F3** (or tap with three fingers at once) to show hitboxes, current state,
  velocity, and coyote/buffer indicators.
- All player feel tuning lives in `src/config/playerTuning.ts`; all touch layout lives in
  `src/config/touchLayout.ts` — the PO can retune either without touching code.
- See `DECISIONS.md` for the physics/render-interpolation architecture and a couple of real bugs
  found and fixed while building the Gym (a soft-locking wall-kick shaft, a projectile despawn bug
  that made the buster do nothing once the camera scrolled).
