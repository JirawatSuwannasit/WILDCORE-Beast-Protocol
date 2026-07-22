import { describe, expect, it } from 'vitest';
import { applyLavafallSlowfall } from './foundryMechanics';

describe('applyLavafallSlowfall', () => {
  it('caps downward fall speed for the lava-fall controlled descent', () => {
    expect(applyLavafallSlowfall(260, 130)).toBe(130);
  });

  it('does not convert falling into an upward heat-vent launch', () => {
    expect(applyLavafallSlowfall(80, 130)).toBe(80);
    expect(applyLavafallSlowfall(-120, 130)).toBe(-120);
  });
});
