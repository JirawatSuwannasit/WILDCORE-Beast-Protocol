/**
 * Placeholder-art palette (GDD §10.2, rule #5: colored rectangles only
 * until final art is integrated in M8). Kept in config, not hardcoded in
 * scenes, so the look can be swapped without touching scene code.
 */
export const THEME = {
  background: 0x14201c, // Night
  panel: 0x2b1d2a, // Shadow ramp base
  accentAmber: 0xf5a742,
  accentCoral: 0xe8604c,
  accentTeal: 0x5fb3a1,
  textCream: '#f2e8d5',
  textCreamHex: 0xf2e8d5,
  moss: 0x7ba05b,
} as const;
