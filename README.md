# WILDCORE: Beast Protocol

Mega Man-style mobile action platformer for Android. Phaser 3 + TypeScript + Vite, wrapped as a
native Android app with Capacitor 6.

Design spec: [`docs/GDD.md`](docs/GDD.md). Deviations from the spec are logged in
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

## Project structure

```
src/
├─ main.ts, config/        # Phaser game config, tuning values, touch layout
├─ scenes/                 # Boot -> Title -> StageSelect -> Stage
├─ actors/                 # Player, enemies, bosses, projectiles
├─ systems/                # input, checkpoint, save, weapons, capsules, audio, vfx, lifecycle
└─ data/                   # stage/boss JSON, weakness wheel
android/                   # Capacitor Android project (generated; do not hand-edit build/ output)
capacitor.config.ts
```

## Notes for the current milestone (M0)

- Landscape orientation is locked natively (`AndroidManifest.xml`); immersive fullscreen and
  safe-area insets are handled in `MainActivity.java` + `src/systems/statusBar.ts`.
- The app auto-pauses the game loop and audio when backgrounded (`src/systems/lifecycle.ts`),
  including on incoming calls, via the Capacitor `App` plugin.
- Scenes are placeholder colored rectangles per the GDD's "no final art until told" rule.
