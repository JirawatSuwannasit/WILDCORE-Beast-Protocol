/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mapPath = 'src/data/stages/ember.json';
const approvedGroundHash = '9fbe38b3648c665765c39db6cbf1df324e161fe7b34649e1ac65a0060dd80ae0';
const loadVerifier = async () => {
  // @ts-expect-error verifier is a Node .mjs script exercised from Vitest.
  return import('../../scripts/verify-ember-encounters.mjs');
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
const runGenerator = (outputPath: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['scripts/generate-ember-map.mjs', '--output', outputPath],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Ember generator failed with code ${code}: ${stderr}`));
      }
    });
  });
const entities = (map: { layers: Array<{ name: string; objects?: unknown[] }> }) =>
  map.layers.find((layer) => layer.name === 'entities')?.objects ?? [];
const groundHash = (map: { layers: Array<{ name: string; data?: number[] }> }) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(map.layers.find((layer) => layer.name === 'ground')?.data ?? []))
    .digest('hex');

describe('Ember encounter verifier', () => {
  it('keeps approved ground tile data unchanged', () => {
    expect(groundHash(cloneMap())).toBe(approvedGroundHash);
  });

  it('generates deterministic enemy placement without touching the committed map', () => {
    const committedBefore = fs.readFileSync(mapPath, 'utf8');

    withTempMapOutput('ember-encounter-', (outputPath) => {
      execFileSync('node', ['scripts/generate-ember-map.mjs', '--output', outputPath], {
        stdio: 'pipe',
      });
      expect(fs.readFileSync(outputPath, 'utf8')).toBe(committedBefore);
    });

    expect(fs.readFileSync(mapPath, 'utf8')).toBe(committedBefore);
  });

  it('isolates concurrent map generations to separate output files', async () => {
    const committedBefore = fs.readFileSync(mapPath, 'utf8');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ember-concurrent-'));
    const firstOutput = path.join(tempDir, 'first.json');
    const secondOutput = path.join(tempDir, 'second.json');

    try {
      await Promise.all([runGenerator(firstOutput), runGenerator(secondOutput)]);

      expect(fs.readFileSync(firstOutput, 'utf8')).toBe(committedBefore);
      expect(fs.readFileSync(secondOutput, 'utf8')).toBe(committedBefore);
      expect(fs.readFileSync(firstOutput, 'utf8')).toBe(fs.readFileSync(secondOutput, 'utf8'));
      expect(fs.readFileSync(mapPath, 'utf8')).toBe(committedBefore);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails when enemy density is below target', async () => {
    const { verifyMap } = await loadVerifier();
    const map = cloneMap();
    const layerEntities = entities(map) as Array<{ type: string }>;
    map.layers.find((layer: { name: string }) => layer.name === 'entities').objects =
      layerEntities.filter((object) => object.type !== 'slagBlob' && object.type !== 'emberBat');
    expect(verifyMap(map).ok).toBe(false);
  });

  it('fails on duplicate consecutive screen signatures', async () => {
    const { verifyMap } = await loadVerifier();
    const map = cloneMap();
    entities(map).push({
      id: 9991,
      type: 'slagBlob',
      name: 'enc-test-duplicate',
      x: 4080,
      y: 1136,
      width: 16,
      height: 16,
      visible: true,
      properties: [],
    });
    expect(verifyMap(map).ok).toBe(false);
  });

  it('fails when a Slag Blob is inside solid terrain', async () => {
    const { verifyMap } = await loadVerifier();
    const map = cloneMap();
    entities(map).push({
      id: 9992,
      type: 'slagBlob',
      name: 'enc-test-solid-blob',
      x: 320,
      y: 1824,
      width: 16,
      height: 16,
      visible: true,
      properties: [],
    });
    expect(verifyMap(map).ok).toBe(false);
  });

  it('fails when an Ember Bat lacks movement clearance', async () => {
    const { verifyMap } = await loadVerifier();
    const map = cloneMap();
    entities(map).push({
      id: 9993,
      type: 'emberBat',
      name: 'enc-test-trapped-bat',
      x: 16,
      y: 16,
      width: 16,
      height: 16,
      visible: true,
      properties: [],
    });
    expect(verifyMap(map).ok).toBe(false);
  });

  it('fails when regular enemies enter the mid-boss arena', async () => {
    const { verifyMap } = await loadVerifier();
    const map = cloneMap();
    entities(map).push({
      id: 9994,
      type: 'emberBat',
      name: 'enc-test-midboss-bat',
      x: 3360,
      y: 1120,
      width: 16,
      height: 16,
      visible: true,
      properties: [],
    });
    expect(verifyMap(map).ok).toBe(false);
  });

  it('fails when more than two enemies attack in a normal room', async () => {
    const { verifyMap } = await loadVerifier();
    const map = cloneMap();
    entities(map).push({
      id: 9995,
      type: 'emberBat',
      name: 'enc-test-overcrowd',
      x: 2744,
      y: 976,
      width: 16,
      height: 16,
      visible: true,
      properties: [],
    });
    expect(verifyMap(map).ok).toBe(false);
  });
});
