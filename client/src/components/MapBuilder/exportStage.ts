import { getGridOrigin, normalizeMapSize } from "./proceduralBase";
import type { MapInfo, PlacedItem, ProceduralBaseState, WorldBounds, WorldMobConfigExport, WorldPrefabPlacementExport, WorldStageExport } from "./types";

const DEFAULT_STAGE_NAME = "Novo Stage";
const DEFAULT_STAGE_AUDIO = "assets/rpg-adventure.mp3";
const DEFAULT_EDGE_BEHAVIOR_TYPE = "outlands_return_corridor";

interface ExportStageInput {
  mapInfo: MapInfo;
  proceduralBase: ProceduralBaseState;
  placedItems: PlacedItem[];
}

function slugifyStageName(name: string): string {
  const normalizedName = name.trim() || DEFAULT_STAGE_NAME;

  return (
    normalizedName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "novo-stage"
  );
}

function expandBounds(bounds: WorldBounds, padding: number): WorldBounds {
  return {
    x1: bounds.x1 - padding,
    x2: bounds.x2 + padding,
    z1: bounds.z1 - padding,
    z2: bounds.z2 + padding,
  };
}

function buildPlayableBounds(size: number): WorldBounds {
  const normalizedSize = normalizeMapSize(size);
  const origin = getGridOrigin(normalizedSize);
  const end = origin + normalizedSize - 1;

  return {
    x1: origin - 0.5,
    x2: end + 0.5,
    z1: origin - 0.5,
    z2: end + 0.5,
  };
}

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toWorldPrefabPlacement(item: PlacedItem): WorldPrefabPlacementExport {
  return {
    id: item.id,
    prefabId: item.prefabId,
    x: item.x,
    y: item.y,
    z: item.z,
    scale: item.scale,
    yaw: degToRad(item.rotationY),
    zoneId: item.zoneId,
    tag: item.tag,
  };
}

function normalizeMobConfig(config: WorldMobConfigExport): WorldMobConfigExport {
  const meleeCount = Math.max(0, Math.round(config.meleeCount));
  const rangedCount = Math.max(0, Math.round(config.rangedCount));
  const minLevel = Math.max(1, Math.round(config.minLevel));
  const maxLevel = Math.max(minLevel, Math.round(config.maxLevel));

  return {
    meleeCount,
    rangedCount,
    moveRadius: Math.max(1, Number(config.moveRadius) || 4.5),
    pursuitLevel: Math.max(1, Math.min(5, Math.round(config.pursuitLevel))),
    minLevel,
    maxLevel,
  };
}

export function buildStageExport({ mapInfo, proceduralBase, placedItems }: ExportStageInput): WorldStageExport {
  const displayName = mapInfo.name.trim() || DEFAULT_STAGE_NAME;
  const stageSlug = slugifyStageName(displayName);
  const playableBounds = buildPlayableBounds(mapInfo.size);
  const outlandsPadding = Math.max(24, Math.ceil(normalizeMapSize(mapInfo.size) * 0.5));

  return {
    stageId: `stage:${stageSlug}`,
    displayName,
    audio: {
      bgm: DEFAULT_STAGE_AUDIO,
    },
    edgeBehavior: {
      type: DEFAULT_EDGE_BEHAVIOR_TYPE,
      playableBounds,
      outlandsBounds: expandBounds(playableBounds, outlandsPadding),
    },
    mobs: normalizeMobConfig(mapInfo.mobConfig),
    tiles: proceduralBase.tiles,
    props: placedItems.map(toWorldPrefabPlacement),
    zones: [],
    transitions: [],
    landmarks: [],
  };
}

export function buildStageExportFileName(mapInfo: MapInfo): string {
  return `stage-${slugifyStageName(mapInfo.name)}.json`;
}

export function downloadStageExport(payload: WorldStageExport, fileName: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = window.URL.createObjectURL(blob);
  const downloadAnchor = document.createElement("a");

  downloadAnchor.href = objectUrl;
  downloadAnchor.download = fileName;
  downloadAnchor.click();
  window.URL.revokeObjectURL(objectUrl);
}