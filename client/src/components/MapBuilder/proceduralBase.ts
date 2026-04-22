import { createNoise2D } from "simplex-noise";
import seedrandom from "seedrandom";

import type { LayoutStyle, MapStats, MapTile, ProceduralBaseState, TerrainProp, TerrainType } from "./types";

export const DEFAULT_MAP_BUILDER_SEED = "cara-de-abelha";
export const DEFAULT_MAP_BUILDER_SIZE = 50;
export const DEFAULT_MAP_BUILDER_LAYOUT_STYLE: LayoutStyle = "noise";

const DEFAULT_NOISE_SCALE = 0.09;
const DEFAULT_WATER_LEVEL = -0.3;
const DEFAULT_MOUNTAIN_LEVEL = 0.5;
const DEFAULT_FLORA_DENSITY = 0.36;

interface ProceduralSettings {
  seed: string;
  mapSize: number;
  layoutStyle: LayoutStyle;
  scale: number;
  waterLevel: number;
  mountainLevel: number;
  floraDensity: number;
}

interface BuildProceduralBaseOptions {
  seed?: string;
  size?: number;
  layoutStyle?: LayoutStyle;
}

function getDefaultProceduralSettings(): ProceduralSettings {
  return {
    seed: DEFAULT_MAP_BUILDER_SEED,
    mapSize: DEFAULT_MAP_BUILDER_SIZE,
    layoutStyle: DEFAULT_MAP_BUILDER_LAYOUT_STYLE,
    scale: DEFAULT_NOISE_SCALE,
    waterLevel: DEFAULT_WATER_LEVEL,
    mountainLevel: DEFAULT_MOUNTAIN_LEVEL,
    floraDensity: DEFAULT_FLORA_DENSITY,
  };
}

export function normalizeMapSize(size: number): number {
  if (!Number.isFinite(size)) {
    return DEFAULT_MAP_BUILDER_SIZE;
  }

  return Math.max(1, Math.round(size));
}

export function getGridOrigin(mapSize: number): number {
  return -Math.floor(mapSize / 2);
}

function buildTileKey(x: number, z: number): string {
  return `${x}:${z}`;
}

function createBaseMap(mapSize: number): MapTile[] {
  const tiles: MapTile[] = [];
  const origin = getGridOrigin(mapSize);
  const end = origin + mapSize - 1;

  for (let z = origin; z <= end; z += 1) {
    for (let x = origin; x <= end; x += 1) {
      tiles.push({ x, y: -0.5, z, type: "water", prop: null });
    }
  }

  return tiles;
}

function setTile(mapData: MapTile[], mapSize: number, nextTile: MapTile): void {
  const origin = getGridOrigin(mapSize);
  const index = (nextTile.z - origin) * mapSize + (nextTile.x - origin);
  if (index < 0 || index >= mapData.length) {
    return;
  }

  mapData[index] = nextTile;
}

function paintIsland(
  mapData: MapTile[],
  settings: ProceduralSettings,
  shapeNoise: ReturnType<typeof createNoise2D>,
  centerX: number,
  centerZ: number,
  radiusX: number,
  radiusZ: number,
  peakHeight: number,
): void {
  const origin = getGridOrigin(settings.mapSize);
  const end = origin + settings.mapSize - 1;

  for (let z = origin; z <= end; z += 1) {
    for (let x = origin; x <= end; x += 1) {
      const dx = (x - centerX) / radiusX;
      const dz = (z - centerZ) / radiusZ;
      const noiseOffset = shapeNoise(x * 0.11 + centerX, z * 0.11 + centerZ) * 0.18;
      const distance = dx * dx + dz * dz + noiseOffset;

      if (distance > 1.08) {
        continue;
      }

      let y = 0;
      let type: TerrainType = "grass";

      if (distance < 0.28 && peakHeight >= 2) {
        y = 2;
        type = "stone";
      } else if (distance < 0.52 && peakHeight >= 1) {
        y = 1;
        type = "stone";
      }

      setTile(mapData, settings.mapSize, { x, y, z, type, prop: null });
    }
  }
}

function paintBridge(
  mapData: MapTile[],
  settings: ProceduralSettings,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  width: number,
): void {
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toZ - fromZ));

  for (let step = 0; step <= steps; step += 1) {
    const progress = steps === 0 ? 0 : step / steps;
    const bridgeX = Math.round(fromX + (toX - fromX) * progress);
    const bridgeZ = Math.round(fromZ + (toZ - fromZ) * progress);

    for (let offsetX = -width; offsetX <= width; offsetX += 1) {
      for (let offsetZ = -width; offsetZ <= width; offsetZ += 1) {
        if (Math.abs(offsetX) + Math.abs(offsetZ) > width + 1) {
          continue;
        }

        setTile(mapData, settings.mapSize, {
          x: bridgeX + offsetX,
          y: 0,
          z: bridgeZ + offsetZ,
          type: "grass",
          prop: null,
        });
      }
    }
  }
}

function decorateConnectedIslands(mapData: MapTile[], settings: ProceduralSettings, baseSeed: string): MapTile[] {
  const floraPlacementNoise = createNoise2D(seedrandom(`${baseSeed}:connected-flora`));
  const floraVariantNoise = createNoise2D(seedrandom(`${baseSeed}:connected-variant`));

  return mapData.map((tile) => {
    if (tile.type !== "grass") {
      return tile;
    }

    const floraChance = (floraPlacementNoise(tile.x * 0.21, tile.z * 0.21) + 1) / 2;
    if (floraChance < 1 - settings.floraDensity) {
      return tile;
    }

    const floraVariant = floraVariantNoise(tile.x * 0.33 + 140, tile.z * 0.33 - 140);
    return { ...tile, prop: floraVariant > 0.12 ? "tree" : "flower" };
  });
}

function buildConnectedIslandsMapData(settings: ProceduralSettings): MapTile[] {
  const baseSeed = settings.seed.trim() || DEFAULT_MAP_BUILDER_SEED;
  const shapeNoise = createNoise2D(seedrandom(`${baseSeed}:macro-shapes`));
  const mapData = createBaseMap(settings.mapSize);
  const sizeFactor = settings.mapSize / 50;
  const islands = [
    { x: Math.round(-15 * sizeFactor), z: Math.round(8 * sizeFactor), radiusX: Math.round(8 * sizeFactor), radiusZ: Math.round(6 * sizeFactor), peakHeight: 1 },
    { x: Math.round(-4 * sizeFactor), z: Math.round(1 * sizeFactor), radiusX: Math.round(7 * sizeFactor), radiusZ: Math.round(5 * sizeFactor), peakHeight: 2 },
    { x: Math.round(10 * sizeFactor), z: Math.round(5 * sizeFactor), radiusX: Math.round(8 * sizeFactor), radiusZ: Math.round(6 * sizeFactor), peakHeight: 1 },
    { x: Math.round(18 * sizeFactor), z: Math.round(-7 * sizeFactor), radiusX: Math.round(6 * sizeFactor), radiusZ: Math.round(5 * sizeFactor), peakHeight: 2 },
    { x: Math.round(-10 * sizeFactor), z: Math.round(-14 * sizeFactor), radiusX: Math.round(6 * sizeFactor), radiusZ: Math.round(4 * sizeFactor), peakHeight: 1 },
  ] as const;
  const links = [
    [0, 1],
    [1, 2],
    [2, 3],
    [1, 4],
  ] as const;

  for (const island of islands) {
    paintIsland(mapData, settings, shapeNoise, island.x, island.z, island.radiusX, island.radiusZ, island.peakHeight);
  }

  for (const [fromIndex, toIndex] of links) {
    const from = islands[fromIndex];
    const to = islands[toIndex];
    paintBridge(mapData, settings, from.x, from.z, to.x, to.z, 1);
  }

  return decorateConnectedIslands(mapData, settings, baseSeed);
}

function polishMapData(mapData: MapTile[]): MapTile[] {
  const tileIndex = new Map(mapData.map((tile) => [buildTileKey(tile.x, tile.z), tile] as const));
  const neighborOffsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],           [1, 0],
    [-1, 1],  [0, 1],  [1, 1],
  ] as const;

  return mapData.map((tile) => {
    let sameTypeNeighbors = 0;
    let waterNeighbors = 0;
    let stoneNeighbors = 0;

    for (const [offsetX, offsetZ] of neighborOffsets) {
      const neighbor = tileIndex.get(buildTileKey(tile.x + offsetX, tile.z + offsetZ));
      if (!neighbor) {
        continue;
      }

      if (neighbor.type === tile.type) {
        sameTypeNeighbors += 1;
      }

      if (neighbor.type === "water") {
        waterNeighbors += 1;
      }

      if (neighbor.type === "stone") {
        stoneNeighbors += 1;
      }
    }

    if (tile.type === "stone" && tile.y > 0 && sameTypeNeighbors <= 1) {
      return { ...tile, type: "grass", y: 0, prop: null };
    }

    if (tile.type === "grass" && waterNeighbors >= 6) {
      return { ...tile, type: "water", y: -0.5, prop: null };
    }

    if (tile.type === "water" && stoneNeighbors >= 5) {
      return { ...tile, type: "stone", y: 1, prop: null };
    }

    if (tile.type !== "grass" && tile.prop !== null) {
      return { ...tile, prop: null };
    }

    return tile;
  });
}

function buildNoiseMapData(settings: ProceduralSettings): MapTile[] {
  const baseSeed = settings.seed.trim() || DEFAULT_MAP_BUILDER_SEED;
  const terrainNoise = createNoise2D(seedrandom(baseSeed));
  const floraPlacementNoise = createNoise2D(seedrandom(`${baseSeed}:flora:placement`));
  const floraVariantNoise = createNoise2D(seedrandom(`${baseSeed}:flora:variant`));
  const mapData: MapTile[] = [];
  const origin = getGridOrigin(settings.mapSize);
  const end = origin + settings.mapSize - 1;

  for (let z = origin; z <= end; z += 1) {
    for (let x = origin; x <= end; x += 1) {
      const elevation = terrainNoise(x * settings.scale, z * settings.scale);
      let type: TerrainType = "grass";
      let y = 0;
      let prop: TerrainProp = null;

      if (elevation < settings.waterLevel) {
        type = "water";
        y = -0.5;
      } else if (elevation > settings.mountainLevel) {
        type = "stone";
        y = 1;
      } else {
        const floraChance =
          (floraPlacementNoise(x * settings.scale * 1.85 + 320, z * settings.scale * 1.85 - 320) + 1) / 2;

        if (floraChance >= 1 - settings.floraDensity) {
          const floraVariant = floraVariantNoise(
            x * settings.scale * 2.4 - 760,
            z * settings.scale * 2.4 + 760,
          );

          prop = floraVariant > 0.16 ? "tree" : "flower";
        }
      }

      mapData.push({ x, y, z, type, prop });
    }
  }

  return polishMapData(mapData);
}

export function buildProceduralMapTiles(options: BuildProceduralBaseOptions = {}): MapTile[] {
  const defaults = getDefaultProceduralSettings();
  const settings: ProceduralSettings = {
    ...defaults,
    seed: options.seed?.trim() || defaults.seed,
    mapSize: normalizeMapSize(options.size ?? defaults.mapSize),
    layoutStyle: options.layoutStyle ?? defaults.layoutStyle,
  };

  if (settings.layoutStyle === "connected-islands") {
    return buildConnectedIslandsMapData(settings);
  }

  return buildNoiseMapData(settings);
}

export function countMapStats(mapData: MapTile[]): MapStats {
  return mapData.reduce<MapStats>(
    (accumulator, tile) => {
      accumulator[tile.type] += 1;

      if (tile.prop === "flower") {
        accumulator.flowers += 1;
        accumulator.flora += 1;
      }

      if (tile.prop === "tree") {
        accumulator.trees += 1;
        accumulator.flora += 1;
      }

      return accumulator;
    },
    { water: 0, grass: 0, stone: 0, flora: 0, flowers: 0, trees: 0 },
  );
}

export function buildProceduralBase(options: BuildProceduralBaseOptions = {}): ProceduralBaseState {
  const seed = options.seed?.trim() || DEFAULT_MAP_BUILDER_SEED;
  const size = normalizeMapSize(options.size ?? DEFAULT_MAP_BUILDER_SIZE);
  const layoutStyle = options.layoutStyle ?? DEFAULT_MAP_BUILDER_LAYOUT_STYLE;
  const tiles = buildProceduralMapTiles({ seed, size, layoutStyle });

  return {
    seed,
    layoutStyle,
    tiles,
    stats: countMapStats(tiles),
  };
}

export function isWithinMapBounds(x: number, z: number, size: number): boolean {
  const normalizedSize = normalizeMapSize(size);
  const origin = getGridOrigin(normalizedSize);
  const end = origin + normalizedSize - 1;
  return x >= origin && x <= end && z >= origin && z <= end;
}