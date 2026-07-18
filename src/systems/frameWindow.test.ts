import { describe, expect, it } from 'vitest';
import { FrameWindow } from './frameWindow';

describe('FrameWindow (coyote time / input buffer)', () => {
  it('is inactive before being armed', () => {
    const window = new FrameWindow();
    expect(window.isActive).toBe(false);
  });

  it('stays active for exactly the armed number of frames', () => {
    const window = new FrameWindow();
    window.arm(6);

    for (let i = 0; i < 6; i += 1) {
      expect(window.isActive).toBe(true);
      window.tick();
    }

    expect(window.isActive).toBe(false);
  });

  it('does not go active again after expiring without being re-armed', () => {
    const window = new FrameWindow();
    window.arm(6);
    for (let i = 0; i < 10; i += 1) window.tick();
    expect(window.isActive).toBe(false);
  });

  it('consume() immediately expires the window', () => {
    const window = new FrameWindow();
    window.arm(6);
    window.tick();
    window.consume();
    expect(window.isActive).toBe(false);
  });

  it('re-arming resets the countdown', () => {
    const window = new FrameWindow();
    window.arm(6);
    window.tick();
    window.tick();
    window.tick();
    window.arm(6); // e.g. landing again while coyote was still counting down
    for (let i = 0; i < 6; i += 1) {
      expect(window.isActive).toBe(true);
      window.tick();
    }
    expect(window.isActive).toBe(false);
  });

  it('never goes negative on repeated ticks with nothing armed', () => {
    const window = new FrameWindow();
    for (let i = 0; i < 20; i += 1) window.tick();
    expect(window.isActive).toBe(false);
  });
});
