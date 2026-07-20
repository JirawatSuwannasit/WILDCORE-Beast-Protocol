import { describe, expect, it } from 'vitest';
import { InputManager, NEUTRAL_INPUT, type InputSnapshot, type InputSource } from './input';

function fakeSource(snapshot: Partial<InputSnapshot>): InputSource {
  const merged: InputSnapshot = { ...NEUTRAL_INPUT, ...snapshot };
  return { sample: () => merged };
}

describe('InputManager', () => {
  it('returns neutral when there are no sources', () => {
    const manager = new InputManager([]);
    expect(manager.sample()).toEqual(NEUTRAL_INPUT);
  });

  it('passes through a single source unchanged', () => {
    const manager = new InputManager([fakeSource({ moveX: 1, jumpHeld: true })]);
    expect(manager.sample()).toEqual({ ...NEUTRAL_INPUT, moveX: 1, jumpHeld: true });
  });

  it('ORs boolean actions across sources (gamepad plugged in alongside touch)', () => {
    const touch = fakeSource({ shootHeld: true });
    const gamepad = fakeSource({ jumpHeld: true });
    const manager = new InputManager([touch, gamepad]);
    expect(manager.sample()).toEqual({
      ...NEUTRAL_INPUT,
      jumpHeld: true,
      shootHeld: true,
    });
  });

  it('takes moveX from whichever source is pressing a direction', () => {
    const keyboard = fakeSource({ moveX: 0 });
    const touch = fakeSource({ moveX: -1 });
    const manager = new InputManager([keyboard, touch]);
    expect(manager.sample().moveX).toBe(-1);
  });

  it('cancels opposing moveX directions from different sources to neutral', () => {
    const keyboard = fakeSource({ moveX: 1 });
    const touch = fakeSource({ moveX: -1 });
    const manager = new InputManager([keyboard, touch]);
    expect(manager.sample().moveX).toBe(0);
  });

  it('takes moveY from whichever source is pressing a direction (touch is always neutral)', () => {
    const keyboard = fakeSource({ moveY: 1 });
    const touch = fakeSource({ moveY: 0 });
    const manager = new InputManager([keyboard, touch]);
    expect(manager.sample().moveY).toBe(1);
  });

  it('cancels opposing moveY directions from different sources to neutral', () => {
    const keyboard = fakeSource({ moveY: -1 });
    const gamepad = fakeSource({ moveY: 1 });
    const manager = new InputManager([keyboard, gamepad]);
    expect(manager.sample().moveY).toBe(0);
  });

  it('reflects live changes each call (sources are re-sampled, not cached)', () => {
    let held = false;
    const source: InputSource = { sample: () => ({ ...NEUTRAL_INPUT, dashHeld: held }) };
    const manager = new InputManager([source]);

    expect(manager.sample().dashHeld).toBe(false);
    held = true;
    expect(manager.sample().dashHeld).toBe(true);
  });
});
