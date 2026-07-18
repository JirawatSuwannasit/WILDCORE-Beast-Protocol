/** Minimal Tiled JSON typings - just the subset this project reads. */
export interface TiledProperty {
  name: string;
  type: string;
  value: string | number | boolean;
}

export interface TiledObject {
  id: number;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  properties?: TiledProperty[];
}

export interface TiledObjectLayer {
  type: 'objectgroup';
  name: string;
  objects: TiledObject[];
}

export interface TiledTileLayer {
  type: 'tilelayer';
  name: string;
  width: number;
  height: number;
  data: number[];
}

export type TiledLayer = TiledObjectLayer | TiledTileLayer;

export interface TiledTileset {
  firstgid: number;
  name: string;
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets?: TiledTileset[];
}

export function getObjectProperty<T extends string | number | boolean>(
  object: TiledObject,
  name: string,
  fallback: T,
): T {
  const prop = object.properties?.find((p) => p.name === name);
  return prop ? (prop.value as T) : fallback;
}

export function getObjectLayer(map: TiledMap, name: string): TiledObject[] {
  const layer = map.layers.find(
    (l): l is TiledObjectLayer => l.type === 'objectgroup' && l.name === name,
  );
  return layer?.objects ?? [];
}

/** Tiled rectangle objects are top-left anchored (x,y is the top-left corner); convert to a center point. */
export function objectCenter(object: TiledObject): { x: number; y: number } {
  return { x: object.x + object.width / 2, y: object.y + object.height / 2 };
}
