import type Phaser from 'phaser';

export interface PauseActions {
  pause: () => void;
  resume: () => void;
}

export interface PauseController {
  handleVisibilityChange(hidden: boolean): void;
  handleNativeStateChange(isActive: boolean): void;
}

/**
 * Pure pause/resume orchestration, decoupled from Phaser/Capacitor so it
 * can be unit tested directly. `backgroundedByNative` is the source of
 * truth once the native App plugin has reported a state: a stray
 * `visibilitychange` (a known Android WebView quirk - it doesn't always
 * fire in step with the Activity's real foreground/background state)
 * must not resume the game while the OS still has it backgrounded.
 */
export function createPauseController(actions: PauseActions): PauseController {
  let backgroundedByNative = false;

  return {
    handleVisibilityChange(hidden) {
      if (hidden) {
        actions.pause();
      } else if (!backgroundedByNative) {
        actions.resume();
      }
    },
    handleNativeStateChange(isActive) {
      backgroundedByNative = !isActive;
      if (isActive) {
        actions.resume();
      } else {
        actions.pause();
      }
    },
  };
}

/**
 * Auto-pause the game loop and audio when the app is backgrounded
 * (home button, app switch, incoming call) or the tab is hidden.
 *
 * Two overlapping signals are wired on purpose:
 * - `document.visibilitychange` covers the Vercel web preview and acts
 *   as a fallback inside the Android WebView.
 * - Capacitor's `App` plugin `appStateChange` is the reliable native
 *   signal for backgrounding/incoming calls on Android, per GDD §11.1.
 */
export function setupAppLifecycle(game: Phaser.Game): void {
  const pauseGame = (): void => {
    if (!game.isPaused) game.pause();
    game.sound.pauseAll();
  };

  const resumeGame = (): void => {
    if (game.isPaused) game.resume();
    game.sound.resumeAll();
  };

  const controller = createPauseController({ pause: pauseGame, resume: resumeGame });

  document.addEventListener('visibilitychange', () => {
    controller.handleVisibilityChange(document.hidden);
  });

  void wireCapacitorAppLifecycle((isActive) => {
    controller.handleNativeStateChange(isActive);
  });
}

async function wireCapacitorAppLifecycle(
  onStateChange: (isActive: boolean) => void,
): Promise<void> {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return;

  const { App } = await import('@capacitor/app');
  await App.addListener('appStateChange', ({ isActive }) => {
    onStateChange(isActive);
  });
}
