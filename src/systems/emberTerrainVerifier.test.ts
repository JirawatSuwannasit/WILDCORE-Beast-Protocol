/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mapPath = 'src/data/stages/ember.json';
const loadVerifier = async () => {
  // @ts-expect-error verifier is a Node .mjs script exercised from Vitest.
  return import('../../scripts/verify-ember-terrain.mjs');
};
const cloneMap = () => JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const withTempMapOutput = (prefix: string, test: (outputPath: string) => void) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    test(path.join(tempDir, 'ember.json'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};
const ground = (map: { layers: Array<{ name: string; data?: number[] }> }) =>
  map.layers.find((layer) => layer.name === 'ground')?.data ?? [];
const setTile = (
  map: { width: number; layers: Array<{ name: string; data?: number[] }> },
  c: number,
  r: number,
  gid: number,
) => {
  ground(map)[r * map.width + c] = gid;
};

describe('Ember terrain verifier', () => {
  it('regenerates deterministically without touching the committed map', () => {
    const committedBefore = fs.readFileSync(mapPath, 'utf8');

    withTempMapOutput('ember-terrain-', (outputPath) => {
      execFileSync('node', ['scripts/generate-ember-map.mjs', '--output', outputPath], {
        stdio: 'pipe',
      });
      expect(fs.readFileSync(outputPath, 'utf8')).toBe(committedBefore);
    });

    expect(fs.readFileSync(mapPath, 'utf8')).toBe(committedBefore);
  });

  it('detects a pickup-independent solid blockage on the main route', async () => {
    const { verifyMap } = await loadVerifier();
    const map = cloneMap();
    for (let c = 1; c <= 4; c += 1) for (let r = 108; r <= 112; r += 1) setTile(map, c, r, 1);
    expect(verifyMap(map).ok).toBe(false);
  });

  it('fails when one branch is removed', async () => {
    const { verifyMap } = await loadVerifier();
    const map = cloneMap();
    for (let c = 240; c <= 360; c += 1) for (let r = 50; r <= 95; r += 1) setTile(map, c, r, 0);
    expect(verifyMap(map).ok).toBe(false);
  });

  it('fails when the multi-floor forge hall is flattened', async () => {
    const { verifyMap } = await loadVerifier();
    const map = cloneMap();
    for (let c = 560; c <= 639; c += 1) for (let r = 0; r <= 35; r += 1) setTile(map, c, r, 0);
    expect(verifyMap(map).ok).toBe(false);
  });

  it('fails when a mandatory gap exceeds the base-kit limit', async () => {
    const { verifyMap } = await loadVerifier();
    const map = cloneMap();
    for (let c = 20; c <= 31; c += 1) for (let r = 0; r <= 149; r += 1) setTile(map, c, r, 0);
    expect(verifyMap(map).ok).toBe(false);
  });

  it('keeps all player spawns and checkpoints in non-solid space', async () => {
    const { verifyMap } = await loadVerifier();
    const result = verifyMap(cloneMap());
    expect(result.metrics.reach.every((point: { open: boolean }) => point.open)).toBe(true);
  });
});
