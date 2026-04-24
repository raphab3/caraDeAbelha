import { create } from "zustand";

import { getMapBuilderCatalogItem } from "./catalog";
import {
  buildProceduralBase,
  countMapStats,
  DEFAULT_MAP_BUILDER_LAYOUT_STYLE,
  DEFAULT_MAP_BUILDER_SEED,
  DEFAULT_MAP_BUILDER_SIZE,
  isWithinMapBounds,
  normalizeMapSize,
} from "./proceduralBase";
import type {
  HoveredGridCell,
  MapBuilderState,
  MapTile,
  MapBuilderTool,
  PlaceItemInput,
  PlacedItem,
} from "./types";

const DEFAULT_MAP_NAME = "Novo Stage";
const DEFAULT_TOOL: MapBuilderTool = "paint";

function buildPlacedItemKey(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

function normalizeCoordinate(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value);
}

function normalizeRotationY(rotationY: number | undefined): number {
  if (!Number.isFinite(rotationY)) {
    return 0;
  }

  return rotationY ?? 0;
}

function normalizeScale(scale: number | undefined, fallback: number): number {
  if (!Number.isFinite(scale) || scale === undefined || scale <= 0) {
    return fallback;
  }

  return scale;
}

function createPlacedItemId(prefabId: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `placed:${prefabId.replaceAll("/", ":")}:${crypto.randomUUID()}`;
  }

  return `placed:${prefabId.replaceAll("/", ":")}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function trimItemsOutsideBounds(items: PlacedItem[], size: number): PlacedItem[] {
  return items.filter((item) => isWithinMapBounds(item.x, item.z, size));
}

function findPlacedItemIndex(items: PlacedItem[], x: number, y: number, z: number): number {
  const key = buildPlacedItemKey(x, y, z);
  return items.findIndex((item) => buildPlacedItemKey(item.x, item.y, item.z) === key);
}

function normalizePlacedItemInput(item: PlaceItemInput): PlacedItem | null {
  const catalogItem = getMapBuilderCatalogItem(item.prefabId);
  if (!catalogItem) {
    return null;
  }

  return {
    id: item.id?.trim() || createPlacedItemId(item.prefabId),
    prefabId: item.prefabId,
    x: normalizeCoordinate(item.x),
    y: normalizeCoordinate(item.y),
    z: normalizeCoordinate(item.z),
    rotationY: normalizeRotationY(item.rotationY),
    scale: normalizeScale(item.scale, catalogItem.defaultScale),
    meta: item.meta ?? {},
    tag: item.tag ?? catalogItem.defaultTag,
    zoneId: item.zoneId?.trim() || undefined,
  };
}

function normalizeHoveredCell(cell: HoveredGridCell | null): HoveredGridCell | null {
  if (!cell) {
    return null;
  }

  return {
    x: normalizeCoordinate(cell.x),
    y: normalizeCoordinate(cell.y),
    z: normalizeCoordinate(cell.z),
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function clampTerrainHeight(height: number): number {
  return Math.max(-0.5, Math.min(6, Math.round(height * 2) / 2));
}

function resolveTerrainTileType(y: number): "water" | "grass" | "stone" {
  if (y <= -0.5) {
    return "water";
  }

  if (y >= 1) {
    return "stone";
  }

  return "grass";
}

const initialProceduralBase = buildProceduralBase({
  seed: DEFAULT_MAP_BUILDER_SEED,
  size: DEFAULT_MAP_BUILDER_SIZE,
  layoutStyle: DEFAULT_MAP_BUILDER_LAYOUT_STYLE,
});

export const useMapBuilderStore = create<MapBuilderState>()((set, get) => ({
  mapInfo: {
    name: DEFAULT_MAP_NAME,
    size: DEFAULT_MAP_BUILDER_SIZE,
    defaultY: 0,
  },
  proceduralBase: initialProceduralBase,
  placedItems: [],
  editorState: {
    selectedAssetType: null,
    isPainting: false,
    currentTool: DEFAULT_TOOL,
    selectedItemId: null,
    hoveredCell: null,
  },
  setMapName: (name) => {
    set((state) => ({
      mapInfo: {
        ...state.mapInfo,
        name,
      },
    }));
  },
  setMapSize: (size) => {
    set((state) => {
      const nextSize = normalizeMapSize(size);
      const nextProceduralBase = buildProceduralBase({
        seed: state.proceduralBase.seed,
        size: nextSize,
        layoutStyle: state.proceduralBase.layoutStyle,
      });
      const nextPlacedItems = trimItemsOutsideBounds(state.placedItems, nextSize);
      const selectedItemStillExists = nextPlacedItems.some((item) => item.id === state.editorState.selectedItemId);

      return {
        mapInfo: {
          ...state.mapInfo,
          size: nextSize,
        },
        proceduralBase: nextProceduralBase,
        placedItems: nextPlacedItems,
        editorState: {
          ...state.editorState,
          hoveredCell: null,
          selectedItemId: selectedItemStillExists ? state.editorState.selectedItemId : null,
        },
      };
    });
  },
  setDefaultY: (nextY) => {
    set((state) => ({
      mapInfo: {
        ...state.mapInfo,
        defaultY: normalizeCoordinate(nextY),
      },
    }));
  },
  setProceduralSeed: (seed) => {
    set((state) => ({
      proceduralBase: {
        ...state.proceduralBase,
        seed: seed.trim() || DEFAULT_MAP_BUILDER_SEED,
      },
    }));
  },
  setSelectedAssetType: (prefabId) => {
    set((state) => ({
      editorState: {
        ...state.editorState,
        selectedAssetType: prefabId && getMapBuilderCatalogItem(prefabId) ? prefabId : null,
      },
    }));
  },
  setCurrentTool: (tool) => {
    set((state) => ({
      editorState: {
        ...state.editorState,
        currentTool: tool,
      },
    }));
  },
  setIsPainting: (isPainting) => {
    set((state) => ({
      editorState: {
        ...state.editorState,
        isPainting,
      },
    }));
  },
  setHoveredCell: (cell) => {
    set((state) => ({
      editorState: {
        ...state.editorState,
        hoveredCell: normalizeHoveredCell(cell),
      },
    }));
  },
  setSelectedItemId: (itemId) => {
    set((state) => ({
      editorState: {
        ...state.editorState,
        selectedItemId: itemId,
      },
    }));
  },
  paintTerrainAt: ({ x, z, prefabId, mode = "paint" }) => {
    set((state) => {
      if (!isWithinMapBounds(x, z, state.mapInfo.size)) {
        return state;
      }

      const normalizedX = normalizeCoordinate(x);
      const normalizedZ = normalizeCoordinate(z);
      const nextTiles: MapTile[] = state.proceduralBase.tiles.map((tile) => {
        if (tile.x !== normalizedX || tile.z !== normalizedZ) {
          return tile;
        }

        if (mode === "delete") {
          const loweredY = clampTerrainHeight(tile.y - 1);
          return {
            ...tile,
            y: loweredY,
            type: resolveTerrainTileType(loweredY),
            prop: null,
          };
        }

        if (prefabId === "terrain/slope-wide") {
          const flattenedY = clampTerrainHeight(Math.max(0, tile.y));
          return {
            ...tile,
            y: flattenedY,
            type: "grass" as const,
            prop: null,
          };
        }

        if (prefabId === "terrain/overhang-edge") {
          const raisedY = clampTerrainHeight(Math.max(1, tile.y));
          return {
            ...tile,
            y: raisedY,
            type: "stone" as const,
            prop: null,
          };
        }

        const raisedY = clampTerrainHeight(Math.max(0, tile.y) + 1);
        return {
          ...tile,
          y: raisedY,
          type: "stone" as const,
          prop: null,
        };
      });

      return {
        proceduralBase: {
          ...state.proceduralBase,
          tiles: nextTiles,
          stats: countMapStats(nextTiles),
        },
        placedItems: state.placedItems.filter(
          (item) => !(item.tag === "terrain" && item.x === normalizedX && item.z === normalizedZ),
        ),
      };
    });
  },
  placeItem: (item) => {
    const normalizedItem = normalizePlacedItemInput(item);
    if (!normalizedItem) {
      return;
    }

    set((state) => {
      if (!isWithinMapBounds(normalizedItem.x, normalizedItem.z, state.mapInfo.size)) {
        return state;
      }

      const occupiedIndex = findPlacedItemIndex(state.placedItems, normalizedItem.x, normalizedItem.y, normalizedItem.z);
      if (occupiedIndex >= 0) {
        return state;
      }

      return {
        placedItems: [...state.placedItems, normalizedItem],
      };
    });
  },
  removeItem: (id) => {
    set((state) => ({
      placedItems: state.placedItems.filter((item) => item.id !== id),
      editorState: {
        ...state.editorState,
        selectedItemId: state.editorState.selectedItemId === id ? null : state.editorState.selectedItemId,
      },
    }));
  },
  updateItem: (id, data) => {
    set((state) => {
      const itemIndex = state.placedItems.findIndex((item) => item.id === id);
      if (itemIndex < 0) {
        return state;
      }

      const currentItem = state.placedItems[itemIndex];
      const nextPrefabId = data.prefabId ?? currentItem.prefabId;
      const catalogItem = getMapBuilderCatalogItem(nextPrefabId);
      if (!catalogItem) {
        return state;
      }

      const nextItem: PlacedItem = {
        ...currentItem,
        ...data,
        prefabId: nextPrefabId,
        x: normalizeCoordinate(data.x ?? currentItem.x),
        y: normalizeCoordinate(data.y ?? currentItem.y),
        z: normalizeCoordinate(data.z ?? currentItem.z),
        rotationY: normalizeRotationY(data.rotationY ?? currentItem.rotationY),
        scale: normalizeScale(data.scale ?? currentItem.scale, catalogItem.defaultScale),
        meta: data.meta ?? currentItem.meta,
        tag: data.tag === undefined ? currentItem.tag ?? catalogItem.defaultTag : normalizeOptionalText(data.tag),
        zoneId: data.zoneId === undefined ? currentItem.zoneId : normalizeOptionalText(data.zoneId),
      };

      if (!isWithinMapBounds(nextItem.x, nextItem.z, state.mapInfo.size)) {
        return state;
      }

      const collidingItem = state.placedItems.find(
        (item) =>
          item.id !== id &&
          buildPlacedItemKey(item.x, item.y, item.z) === buildPlacedItemKey(nextItem.x, nextItem.y, nextItem.z),
      );
      if (collidingItem) {
        return state;
      }

      const nextPlacedItems = [...state.placedItems];
      nextPlacedItems[itemIndex] = nextItem;

      return {
        placedItems: nextPlacedItems,
      };
    });
  },
  clearMap: () => {
    set((state) => ({
      placedItems: [],
      editorState: {
        ...state.editorState,
        selectedItemId: null,
      },
    }));
  },
  generateProceduralBase: (seed) => {
    const currentState = get();
    const nextSeed = seed?.trim() || currentState.proceduralBase.seed;

    set(() => ({
      proceduralBase: buildProceduralBase({
        seed: nextSeed,
        size: currentState.mapInfo.size,
        layoutStyle: currentState.proceduralBase.layoutStyle,
      }),
    }));
  },
}));
