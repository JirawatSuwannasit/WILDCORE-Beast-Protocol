/**
 * Runtime mirror of the native immersive-fullscreen setup in
 * MainActivity.java. The native edge-to-edge + hide-system-bars call
 * already does the real work at launch; this covers the WebView-visible
 * status bar chrome and re-hides it if the OS ever reveals it after a
 * Capacitor plugin (e.g. a permission dialog) temporarily restores it.
 */
export async function setupImmersiveStatusBar(): Promise<void> {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return;

  const { StatusBar } = await import('@capacitor/status-bar');
  await StatusBar.setOverlaysWebView({ overlay: true });
  await StatusBar.hide();
}
