import fs from 'node:fs';

const mapPath = process.argv[2] ?? 'src/data/stages/foundry.json';
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const groundLayer = map.layers.find(
  (layer) => layer.type === 'tilelayer' && layer.name === 'ground',
);
const routeMarkers =
  map.layers.find((layer) => layer.type === 'objectgroup' && layer.name === 'routeMarkers')
    ?.objects ?? [];

if (!groundLayer) throw new Error('ground tile layer missing');

const landingRow = 240;
const landingCols = Array.from({ length: 15 }, (_, index) => 271 + index);
const tileAt = (col, row) => groundLayer.data[row * map.width + col] ?? 0;
const center = (object) => ({
  x: object.x + object.width / 2,
  y: object.y + object.height / 2,
  col: (object.x + object.width / 2) / map.tilewidth,
  row: (object.y + object.height / 2) / map.tileheight,
});

const routeBefore = routeMarkers.find((object) => object.name === 'foundry-route-13');
const routeAfter = routeMarkers.find((object) => object.name === 'foundry-route-14');

console.log(`landing row: ${landingRow}`);
console.log(`columns: ${landingCols[0]}-${landingCols.at(-1)}`);
console.log(
  `top tile GIDs: ${landingCols.map((col) => `${col}:${tileAt(col, landingRow)}`).join(' ')}`,
);
console.log(
  `support row ${landingRow + 1}: ${landingCols.map((col) => `${col}:${tileAt(col, landingRow + 1)}`).join(' ')}`,
);
console.log(
  `support row ${landingRow + 10}: ${landingCols.map((col) => `${col}:${tileAt(col, landingRow + 10)}`).join(' ')}`,
);
console.log(
  `route before landing: ${routeBefore?.name ?? 'missing'} ${JSON.stringify(routeBefore ? center(routeBefore) : null)}`,
);
console.log(
  `route after landing: ${routeAfter?.name ?? 'missing'} ${JSON.stringify(routeAfter ? center(routeAfter) : null)}`,
);
