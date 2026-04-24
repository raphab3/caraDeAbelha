import type { LayoutStyle, MapStats, MapTile, TerrainProp, TerrainType } from "../MapGenerator/types";

export type { LayoutStyle, MapStats, MapTile, TerrainProp, TerrainType };

export type MapBuilderTool = "paint" | "delete" | "select";

export type MapBuilderPrefabCategory = "terrain" | "nature" | "setdressing" | "landmark" | "border";

export type MapBuilderColliderType = "solid" | "soft" | "none" | "trigger";

export interface MapInfo {
  name: string;
  size: number;
  defaultY: number;
}

export interface HoveredGridCell {
  x: number;
  y: number;
  z: number;
}

export interface PlacedItem {
  id: string;
  prefabId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
  meta: Record<string, unknown>;
  tag?: string;
  zoneId?: string;
}

export interface ProceduralBaseState {
  seed: string;
  layoutStyle: LayoutStyle;
  tiles: MapTile[];
  stats: MapStats;
}

export interface EditorState {
  selectedAssetType: string | null;
  isPainting: boolean;
  currentTool: MapBuilderTool;
  placementRotationY: number;
  selectedItemId: string | null;
  selectedItemIds: string[];
  hoveredCell: HoveredGridCell | null;
}

export interface MapBuilderCatalogItem {
  prefabId: string;
  label: string;
  assetPath: string;
  category: MapBuilderPrefabCategory;
  colliderType: MapBuilderColliderType;
  defaultScale: number;
  defaultTag?: string;
}

export interface WorldBounds {
  x1: number;
  x2: number;
  z1: number;
  z2: number;
}

export interface WorldStageAudio {
  bgm: string;
}

export interface WorldEdgeBehavior {
  type: string;
  playableBounds: WorldBounds;
  outlandsBounds: WorldBounds;
}

export interface WorldZoneExport {
  id: string;
  name: string;
  x1: number;
  x2: number;
  z1: number;
  z2: number;
}

export interface WorldTransitionExport {
  fromZone: string;
  toZone: string;
  x: number;
  z: number;
  type: string;
}

export interface WorldLandmarkExport {
  id: string;
  displayName: string;
  x: number;
  y: number;
  z: number;
  zoneId?: string;
  tag?: string;
}

export interface WorldPrefabPlacementExport {
  id: string;
  prefabId: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
  zoneId?: string;
  tag?: string;
}

export interface WorldStageExport {
  stageId: string;
  displayName: string;
  audio: WorldStageAudio;
  edgeBehavior: WorldEdgeBehavior;
  tiles: MapTile[];
  props: WorldPrefabPlacementExport[];
  zones: WorldZoneExport[];
  transitions: WorldTransitionExport[];
  landmarks: WorldLandmarkExport[];
}

export interface PlaceItemInput {
  id?: string;
  prefabId: string;
  x: number;
  y: number;
  z: number;
  rotationY?: number;
  scale?: number;
  meta?: Record<string, unknown>;
  tag?: string;
  zoneId?: string;
}

export type UpdatePlacedItemInput = Partial<Omit<PlacedItem, "id">>;

export interface MapBuilderState {
  mapInfo: MapInfo;
  proceduralBase: ProceduralBaseState;
  placedItems: PlacedItem[];
  editorState: EditorState;
  setMapName: (name: string) => void;
  setMapSize: (size: number) => void;
  setDefaultY: (nextY: number) => void;
  setProceduralSeed: (seed: string) => void;
  setSelectedAssetType: (prefabId: string | null) => void;
  setCurrentTool: (tool: MapBuilderTool) => void;
  setPlacementRotationY: (rotationY: number) => void;
  rotatePlacement: (deltaDegrees: number) => void;
  setIsPainting: (isPainting: boolean) => void;
  setHoveredCell: (cell: HoveredGridCell | null) => void;
  setSelectedItemId: (itemId: string | null) => void;
  setSelectedItemIds: (itemIds: string[]) => void;
  toggleSelectedItemId: (itemId: string) => void;
  clearSelection: () => void;
  paintTerrainAt: (input: { x: number; z: number; prefabId: string; mode?: "paint" | "delete" }) => void;
  placeItem: (item: PlaceItemInput) => void;
  placeItems: (items: PlaceItemInput[]) => PlacedItem[];
  removeItem: (id: string) => void;
  removeSelectedItems: () => void;
  updateItem: (id: string, data: UpdatePlacedItemInput) => void;
  moveSelectedItems: (input: { anchorItemId: string; x: number; z: number; origin: Record<string, Pick<PlacedItem, "x" | "z">> }) => void;
  clearMap: () => void;
  generateProceduralBase: (seed?: string) => void;
}
