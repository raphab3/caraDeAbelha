export type TerrainType = "water" | "grass" | "stone";

export type LayoutStyle = "noise" | "connected-islands";

export type TerrainProp = "flower" | "tree" | null;

export interface MapTile {
	x: number;
	y: number;
	z: number;
	type: TerrainType;
	prop: TerrainProp;
}

export interface MapGeneratorSettings {
	seed: string;
	mapSize: number;
	layoutStyle: LayoutStyle;
	scale: number;
	waterLevel: number;
	mountainLevel: number;
	floraDensity: number;
}

export interface MapStats {
	water: number;
	grass: number;
	stone: number;
	flora: number;
	flowers: number;
	trees: number;
}