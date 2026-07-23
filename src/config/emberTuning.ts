import { playerTuning } from '@/config/playerTuning';

export const heatVentTuning = {
  liftVelocityY: -185,
  slowfallVelocityY: 45,
  pulseFrames: 48,
} as const;
export const pistonCrusherTuning = {
  cycleFrames: 120,
  closedFrames: 36,
  openFrames: 84,
  damage: 4,
} as const;
export const risingLavaTuning = {
  riseSpeedPxPerSec: 52,
  runSpeedCapPxPerSec: playerTuning.run.speed,
} as const;

export const slagBlobTuning = {
  hp: 2,
  telegraphFrames: 24,
  cooldownFrames: 90,
  arcSpeed: 90,
  arcDamage: 2,
  flameFrames: 45,
} as const;
export const emberBatTuning = {
  hp: 1,
  eyeTelegraphFrames: 20,
  cooldownFrames: 90,
  swoopFrames: 70,
  damage: 2,
} as const;
export const slagGolemTuning = {
  maxHp: 8,
  reformFrames: 75,
  slamTelegraphFrames: 28,
  rockDamage: 2,
} as const;
export const magmaRhinoTuning = {
  maxHp: 16,
  fillRitualMs: 1500,
  desperationHpFraction: 0.25,
  weaknessDamage: 4,
  contactDamage: 3,
  ramTelegraphFrames: 30,
  ramSpeed: 170,
  stunFrames: 42,
  geyserTelegraphFrames: 24,
  hornTelegraphFrames: 26,
} as const;
