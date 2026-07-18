import { describe, expect, it } from 'vitest';
import { CheckpointManager } from './checkpoint';

describe('CheckpointManager', () => {
  it('starts at the given spawn point with no checkpoint reached', () => {
    const cp = new CheckpointManager(10, 20);
    expect(cp.respawnPoint).toEqual({ x: 10, y: 20 });
    expect(cp.lastOrderReached).toBe(-1);
  });

  it('activates a checkpoint and updates the respawn point', () => {
    const cp = new CheckpointManager(0, 0);
    const activated = cp.tryActivate(0, 100, 50);
    expect(activated).toBe(true);
    expect(cp.respawnPoint).toEqual({ x: 100, y: 50 });
    expect(cp.lastOrderReached).toBe(0);
  });

  it('advances through checkpoints in increasing order', () => {
    const cp = new CheckpointManager(0, 0);
    cp.tryActivate(0, 100, 50);
    cp.tryActivate(1, 300, 50);
    expect(cp.respawnPoint).toEqual({ x: 300, y: 50 });
    expect(cp.lastOrderReached).toBe(1);
  });

  it('ignores re-touching an earlier checkpoint after a later one is reached', () => {
    const cp = new CheckpointManager(0, 0);
    cp.tryActivate(1, 300, 50);
    const activated = cp.tryActivate(0, 100, 50);
    expect(activated).toBe(false);
    expect(cp.respawnPoint).toEqual({ x: 300, y: 50 });
  });

  it('ignores re-touching the same checkpoint twice', () => {
    const cp = new CheckpointManager(0, 0);
    cp.tryActivate(0, 100, 50);
    const activated = cp.tryActivate(0, 100, 50);
    expect(activated).toBe(false);
  });
});
