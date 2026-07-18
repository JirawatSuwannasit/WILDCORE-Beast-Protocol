import { describe, expect, it } from 'vitest';
import { EdgeDetector } from './edgeDetector';

describe('EdgeDetector', () => {
  it('reports justPressed on the first held frame, then not on subsequent held frames', () => {
    const detector = new EdgeDetector();
    expect(detector.update(true)).toEqual({ held: true, justPressed: true, justReleased: false });
    expect(detector.update(true)).toEqual({ held: true, justPressed: false, justReleased: false });
  });

  it('reports justReleased on the first non-held frame after being held', () => {
    const detector = new EdgeDetector();
    detector.update(true);
    expect(detector.update(false)).toEqual({
      held: false,
      justPressed: false,
      justReleased: true,
    });
    expect(detector.update(false)).toEqual({
      held: false,
      justPressed: false,
      justReleased: false,
    });
  });

  it('reports neither edge while never pressed', () => {
    const detector = new EdgeDetector();
    expect(detector.update(false)).toEqual({
      held: false,
      justPressed: false,
      justReleased: false,
    });
  });

  it('re-triggers justPressed on a subsequent tap', () => {
    const detector = new EdgeDetector();
    detector.update(true);
    detector.update(false);
    expect(detector.update(true).justPressed).toBe(true);
  });
});
