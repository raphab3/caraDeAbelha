import type { WorldChunkState } from "../../types/game";

export const WORLD_TO_SCENE_SCALE = 1.35;
export const GROUND_HEIGHT = -1.15;
export const TERRAIN_SURFACE_HEIGHT = GROUND_HEIGHT + 0.02;
export const TERRAIN_BLOCK_SCALE = WORLD_TO_SCENE_SCALE;
export const TERRAIN_BLOCK_CENTER_Y = TERRAIN_SURFACE_HEIGHT - TERRAIN_BLOCK_SCALE; // if origin is bottom

export const BEE_BASE_ALTITUDE = 0.48;
export const BEE_TERRAIN_CLEARANCE = 0.84;
export const TARGET_MARKER_CLEARANCE = 1.2;

type SurfaceKey = `${number}:${number}`;

export type WorldSurfaceIndex = Map<SurfaceKey, number>;

export function toSceneAxis(value: number): number {
	return value * WORLD_TO_SCENE_SCALE;
}

export function resolveTerrainElevation(value: number): number {
	if (value <= -0.5) {
		return value * 1.9;
	}

	// Keep authored elevations aligned to whole terrain blocks so cliffs stack cleanly.
	return value;
}

export function toWorldAxis(value: number): number {
	return value / WORLD_TO_SCENE_SCALE;
}

export function toTerrainBlockCenterY(elevation: number): number {
	return TERRAIN_BLOCK_CENTER_Y + resolveTerrainElevation(elevation) * WORLD_TO_SCENE_SCALE;
}

export function toTerrainSurfaceY(elevation: number): number {
	return TERRAIN_SURFACE_HEIGHT + resolveTerrainElevation(elevation) * WORLD_TO_SCENE_SCALE;
}

function buildSurfaceKey(worldX: number, worldZ: number): SurfaceKey {
	return `${Math.floor(worldX)}:${Math.floor(worldZ)}`;
}

export function buildWorldSurfaceIndex(chunks: WorldChunkState[]): WorldSurfaceIndex {
	const surfaceIndex: WorldSurfaceIndex = new Map();

	for (const chunk of chunks) {
		for (const tile of chunk.tiles) {
			surfaceIndex.set(buildSurfaceKey(tile.x - 0.5, tile.z - 0.5), tile.y);
		}
	}

	return surfaceIndex;
}

export function resolveWorldSurfaceElevation(
	surfaceIndex: WorldSurfaceIndex,
	worldX: number,
	worldZ: number,
): number {
	return surfaceIndex.get(buildSurfaceKey(worldX, worldZ)) ?? 0;
}

export function resolveSurfaceSceneY(surfaceIndex: WorldSurfaceIndex, worldX: number, worldZ: number): number {
	return toTerrainSurfaceY(resolveWorldSurfaceElevation(surfaceIndex, worldX, worldZ));
}

export function resolveBeeSceneHeight(
	surfaceIndex: WorldSurfaceIndex,
	worldX: number,
	worldZ: number,
	elapsedTime: number,
	drift: number,
): number {
	const hoverHeight = BEE_BASE_ALTITUDE + Math.sin((elapsedTime + drift) * 2.4) * 0.18;
	const terrainAwareHeight = resolveSurfaceSceneY(surfaceIndex, worldX, worldZ) + BEE_TERRAIN_CLEARANCE;

	return Math.max(hoverHeight, terrainAwareHeight);
}

export function resolveTargetMarkerSceneY(
	surfaceIndex: WorldSurfaceIndex,
	worldX: number,
	worldZ: number,
): number {
	return resolveSurfaceSceneY(surfaceIndex, worldX, worldZ) + TARGET_MARKER_CLEARANCE;
}