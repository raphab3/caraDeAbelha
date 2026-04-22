import { Clone, useGLTF } from "@react-three/drei";

import { MAP_BUILDER_CATALOG, getMapBuilderCatalogItem } from "./catalog";
import {
  toSceneAxis,
  toTerrainSurfaceY,
} from "../GameViewport/worldSurface";
import type { PlacedItem } from "./types";

interface PlacedItemsRendererProps {
  currentTool: "paint" | "delete" | "select";
  items: PlacedItem[];
  onItemPointerDown: (itemId: string) => void;
  selectedItemId: string | null;
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
    <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.38, 0.58, 40]} />
      <meshBasicMaterial color="#fde68a" depthWrite={false} opacity={0.95} transparent />
    </mesh>
  );
}

function PlacedItemInstance({
  currentTool,
  isSelected,
  item,
  onItemPointerDown,
  tileElevationByCell,
}: {
  currentTool: "paint" | "delete" | "select";
  isSelected: boolean;
  item: PlacedItem;
  onItemPointerDown: (itemId: string) => void;
  tileElevationByCell: Map<string, number>;
}) {
  const catalogItem = getMapBuilderCatalogItem(item.prefabId);
  const gltf = useGLTF(normalizeAssetPath(catalogItem?.assetPath ?? ""));

  if (!catalogItem) {
    return null;
  }

  return (
    <group
      onPointerDown={(event) => {
        event.stopPropagation();
        onItemPointerDown(item.id);
      }}
      position={[toSceneAxis(item.x), resolvePlacedItemSceneY(item, tileElevationByCell), toSceneAxis(item.z)]}
      rotation={[0, (item.rotationY * Math.PI) / 180, 0]}
      scale={[item.scale, item.scale, item.scale]}
    >
      <Clone object={gltf.scene} />
      {isSelected ? <SelectionHalo /> : null}
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
  items,
  onItemPointerDown,
  selectedItemId,
  tileElevationByCell,
}: PlacedItemsRendererProps) {
  return (
    <group>
      {items.map((item) => (
        <PlacedItemInstance
          key={item.id}
          currentTool={currentTool}
          isSelected={selectedItemId === item.id}
          item={item}
          onItemPointerDown={onItemPointerDown}
          tileElevationByCell={tileElevationByCell}
        />
      ))}
    </group>
  );
}

for (const catalogItem of MAP_BUILDER_CATALOG) {
  useGLTF.preload(normalizeAssetPath(catalogItem.assetPath));
}