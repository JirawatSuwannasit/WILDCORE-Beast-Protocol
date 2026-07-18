import { describe, expect, it, vi } from 'vitest';
import { createPauseController } from './lifecycle';

describe('createPauseController', () => {
  it('pauses when the tab/webview is hidden', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    const controller = createPauseController({ pause, resume });

    controller.handleVisibilityChange(true);

    expect(pause).toHaveBeenCalledOnce();
    expect(resume).not.toHaveBeenCalled();
  });

  it('resumes when the tab/webview becomes visible again', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    const controller = createPauseController({ pause, resume });

    controller.handleVisibilityChange(true);
    controller.handleVisibilityChange(false);

    expect(resume).toHaveBeenCalledOnce();
  });

  it('pauses on a native appStateChange to background', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    const controller = createPauseController({ pause, resume });

    controller.handleNativeStateChange(false);

    expect(pause).toHaveBeenCalledOnce();
    expect(resume).not.toHaveBeenCalled();
  });

  it('resumes on a native appStateChange back to foreground', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    const controller = createPauseController({ pause, resume });

    controller.handleNativeStateChange(false);
    controller.handleNativeStateChange(true);

    expect(resume).toHaveBeenCalledOnce();
  });

  it('does not resume from a stray visibilitychange while natively backgrounded', () => {
    // Regression for the P1 "pause does not work" report: Android WebViews
    // don't always fire visibilitychange in step with the real Activity
    // state, so a late/spurious "visible" event must not undo a real
    // native background signal.
    const pause = vi.fn();
    const resume = vi.fn();
    const controller = createPauseController({ pause, resume });

    controller.handleNativeStateChange(false); // real backgrounding (e.g. incoming call)
    controller.handleVisibilityChange(false); // stray "visible" from the WebView

    expect(resume).not.toHaveBeenCalled();
  });

  it('resumes once the native signal actually returns to foreground after a stray visibilitychange', () => {
    const pause = vi.fn();
    const resume = vi.fn();
    const controller = createPauseController({ pause, resume });

    controller.handleNativeStateChange(false);
    controller.handleVisibilityChange(false);
    controller.handleNativeStateChange(true);

    expect(resume).toHaveBeenCalledOnce();
  });
});
