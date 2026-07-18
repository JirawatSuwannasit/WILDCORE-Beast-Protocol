/**
 * Landscape lock. The authoritative lock is the Android manifest
 * (`android:screenOrientation="sensorLandscape"` on MainActivity, see
 * android/app/src/main/AndroidManifest.xml) so it holds even before the
 * WebView finishes loading. This is a best-effort mirror for the web
 * preview, where the Screen Orientation Lock API only works inside a
 * user-initiated fullscreen session and silently no-ops otherwise.
 */
export function requestLandscapeLock(): void {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (orientation: string) => Promise<void>;
  };

  orientation.lock?.('landscape').catch(() => {
    // Expected outside a fullscreen gesture (e.g. desktop dev preview).
  });
}
