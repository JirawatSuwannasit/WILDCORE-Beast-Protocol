import type Phaser from 'phaser';

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
  let backgroundedByNative = false;

  const pauseGame = (): void => {
    if (!game.isPaused) game.pause();
    game.sound.pauseAll();
  };

  const resumeGame = (): void => {
    if (backgroundedByNative) return;
    if (game.isPaused) game.resume();
    game.sound.resumeAll();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseGame();
    } else {
      resumeGame();
    }
  });

  void wireCapacitorAppLifecycle((isActive) => {
    backgroundedByNative = !isActive;
    if (isActive) {
      resumeGame();
    } else {
      pauseGame();
    }
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
