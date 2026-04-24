import { Clone, useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";

import { MAP_BUILDER_CATALOG, getMapBuilderCatalogItem } from "./catalog";
import {
  toSceneAxis,
  toTerrainSurfaceY,
} from "../GameViewport/worldSurface";
import { resolveModelGroundOffsetY } from "../GameViewport/modelAnchoring";
import type { PlacedItem } from "./types";

interface PlacedItemsRendererProps {
  currentTool: "paint" | "delete" | "select";
  hoveredItemId: string | null;
  items: PlacedItem[];
  onItemPointerDown: (event: ThreeEvent<PointerEvent>, itemId: string) => void;
  onItemPointerMove: (event: ThreeEvent<PointerEvent>, itemId: string) => void;
  onItemPointerOut: () => void;
  onItemPointerOver: (itemId: string) => void;
  selectedItemIds: string[];
  tileElevationByCell: Map<string, number>;
}

function buildSurfaceKey(x: number, z: number): string {
  return `${x}:${z}`;
}

function normalizeAssetPath(assetPath: string): string {
  return assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
}

function resolvePlacedItemSceneY(item: PlacedItem, tileElevationByCell: Map<string, number>): number {
  if (item.tag === "terrain") {
    return toTerrainSurfaceY(tileElevationByCell.get(buildSurfaceKey(item.x, item.z)) ?? 0);
  }

  return toTerrainSurfaceY(item.y);
}

function SelectionHalo() {
  return (
    <group position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.42, 0.62, 44]} />
        <meshBasicMaterial color="#38bdf8" depthWrite={false} opacity={0.96} transparent />
      </mesh>
      <mesh>
        <planeGeometry args={[0.92, 0.92]} />
        <meshBasicMaterial color="#1d4ed8" depthWrite={false} opacity={0.14} transparent />
      </mesh>
    </group>
  );
}

function HoverHalo() {
  return (
    <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.34, 0.48, 32]} />
      <meshBasicMaterial color="#f8fafc" depthWrite={false} opacity={0.62} transparent />
    </mesh>
  );
}

function PlacedItemInstance({
  currentTool,
  isHovered,
  isSelected,
  item,
  onItemPointerDown,
  onItemPointerMove,
  onItemPointerOut,
  onItemPointerOver,
  tileElevationByCell,
}: {
  currentTool: "paint" | "delete" | "select";
  isHovered: boolean;
  isSelected: boolean;
  item: PlacedItem;
  onItemPointerDown: (event: ThreeEvent<PointerEvent>, itemId: string) => void;
  onItemPointerMove: (event: ThreeEvent<PointerEvent>, itemId: string) => void;
  onItemPointerOut: () => void;
  onItemPointerOver: (itemId: string) => void;
  tileElevationByCell: Map<string, number>;
}) {
  const catalogItem = getMapBuilderCatalogItem(item.prefabId);
  const gltf = useGLTF(normalizeAssetPath(catalogItem?.assetPath ?? ""));
  const groundOffsetY = useMemo(() => resolveModelGroundOffsetY(gltf.scene), [gltf.scene]);

  if (!catalogItem) {
    return null;
  }

  return (
    <group
      onPointerDown={(event) => {
        event.stopPropagation();
        onItemPointerDown(event, item.id);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        onItemPointerMove(event, item.id);
      }}
      onPointerOut={() => onItemPointerOut()}
      onPointerOver={(event) => {
        event.stopPropagation();
        onItemPointerOver(item.id);
      }}
      position={[
        toSceneAxis(item.x),
        resolvePlacedItemSceneY(item, tileElevationByCell) + groundOffsetY * item.scale,
        toSceneAxis(item.z),
      ]}
      rotation={[0, (item.rotationY * Math.PI) / 180, 0]}
      scale={[item.scale, item.scale, item.scale]}
    >
      <Clone object={gltf.scene} />
      {isSelected ? <SelectionHalo /> : null}
      {isHovered && !isSelected && currentTool !== "delete" ? <HoverHalo /> : null}
      {currentTool === "delete" ? (
        <mesh position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.28, 24]} />
          <meshBasicMaterial color="#fb7185" depthWrite={false} opacity={0.9} transparent />
        </mesh>
      ) : null}
    </group>
  );
}

export function PlacedItemsRenderer({
  currentTool,
  hoveredItemId,
  items,
  onItemPointerDown,
  onItemPointerMove,
  onItemPointerOut,
  onItemPointerOver,
  selectedItemIds,
  tileElevationByCell,
}: PlacedItemsRendererProps) {
  const selectedIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  return (
    <group>
      {items.map((item) => (
        <PlacedItemInstance
          key={item.id}
          currentTool={currentTool}
          isHovered={hoveredItemId === item.id}
          isSelected={selectedIdSet.has(item.id)}
          item={item}
          onItemPointerDown={onItemPointerDown}
          onItemPointerMove={onItemPointerMove}
          onItemPointerOut={onItemPointerOut}
          onItemPointerOver={onItemPointerOver}
          tileElevationByCell={tileElevationByCell}
        />
      ))}
    </group>
  );
}

for (const catalogItem of MAP_BUILDER_CATALOG) {
  useGLTF.preload(normalizeAssetPath(catalogItem.assetPath));
}
