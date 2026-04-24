import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { DoubleSide, MOUSE, type Mesh } from "three";

import { getMapBuilderCatalogItem } from "./catalog";
import { useMapBuilderStore } from "./useMapBuilderStore";
import { BaseTerrainRenderer } from "./BaseTerrainRenderer";
import { PlacedItemsRenderer } from "./PlacedItemsRenderer";
import {
  GROUND_HEIGHT,
  toSceneAxis,
  toTerrainSurfaceY,
  toWorldAxis,
} from "../GameViewport/worldSurface";
import type { PlacedItem } from "./types";

const SKY_COLOR = "#1279e0";
const FOG_COLOR = "#2286c9";
const CAMERA_BASE_DISTANCE = 18;
const CAMERA_MAX_DISTANCE = 48;
const CAMERA_MIN_DISTANCE = 8;
const CAMERA_ROTATE_SPEED = 0.82;
const CAMERA_ZOOM_SPEED = 0.9;

interface PaintStrokeState {
  active: boolean;
  lastCellKey: string | null;
  visitedCellKeys: Set<string>;
}

interface DragState {
  active: boolean;
  itemId: string | null;
  pointerId: number | null;
}

interface ClipboardItem {
  prefabId: string;
  rotationY: number;
  scale: number;
  tag?: string;
  zoneId?: string;
  meta: Record<string, unknown>;
}

function buildPlacedItemKey(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

function buildSurfaceKey(x: number, z: number): string {
  return `${x}:${z}`;
}

function resolveCameraDistance(size: number): number {
  return Math.min(CAMERA_MAX_DISTANCE, Math.max(CAMERA_BASE_DISTANCE, toSceneAxis(size) * 0.44));
}

function HoverMarker({ cell }: { cell: { x: number; y: number; z: number } }) {
  const meshRef = useRef<Mesh>(null);
  const sceneX = toSceneAxis(cell.x);
  const sceneZ = toSceneAxis(cell.z);

  useFrame((state) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.y = state.clock.elapsedTime * 1.5;
    meshRef.current.position.y = toTerrainSurfaceY(cell.y) + 0.22 + Math.sin(state.clock.elapsedTime * 3.2) * 0.04;
  });

  return (
    <mesh ref={meshRef} position={[sceneX, toTerrainSurfaceY(cell.y) + 0.22, sceneZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.16, 0.28, 32]} />
      <meshBasicMaterial color="#fde68a" depthWrite={false} opacity={0.9} side={DoubleSide} transparent />
    </mesh>
  );
}

function SceneContent({
  cameraDistance,
  hoveredCell,
  isPanning,
  interactionPlaneSize,
  mapSize,
  onHoverCell,
  onItemPointerDown,
  onPaintCell,
  onPointerEnd,
  onPointerStart,
  placedItems,
  selectedItemId,
  tileElevationByCell,
  tiles,
}: {
  cameraDistance: number;
  hoveredCell: { x: number; y: number; z: number } | null;
  isPanning: boolean;
  interactionPlaneSize: number;
  mapSize: number;
  onHoverCell: (pointX: number, pointZ: number) => void;
  onItemPointerDown: (event: ThreeEvent<PointerEvent>, itemId: string) => void;
  onPaintCell: (pointX: number, pointZ: number) => void;
  onPointerEnd: (eventTarget: EventTarget | null, pointerId: number) => void;
  onPointerStart: (eventTarget: EventTarget | null, pointerId: number, pointX: number, pointZ: number) => void;
  placedItems: PlacedItem[];
  selectedItemId: string | null;
  tileElevationByCell: Map<string, number>;
  tiles: ReturnType<typeof useMapBuilderStore.getState>["proceduralBase"]["tiles"];
}) {
  return (
    <>
      <color attach="background" args={[SKY_COLOR]} />
      <fog attach="fog" args={[FOG_COLOR, Math.max(14, cameraDistance * 0.9), cameraDistance + 16]} />
      <ambientLight intensity={0.92} />
      <hemisphereLight color="#eef8ff" groundColor="#7fa38e" intensity={0.72} />
      <directionalLight castShadow color="#fffef7" intensity={1.42} position={[16, 22, 10]} shadow-mapSize-height={2048} shadow-mapSize-width={2048} />

      <BaseTerrainRenderer tiles={tiles} />

      <gridHelper
        args={[toSceneAxis(mapSize), mapSize, "#ffffff", "#ffffff"]}
        position={[0, GROUND_HEIGHT + 0.03, 0]}
      />

      <mesh
        onPointerCancel={(event) => onPointerEnd(event.target, event.pointerId)}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }
          event.stopPropagation();
          onPointerStart(event.target, event.pointerId, event.point.x, event.point.z);
        }}
        onPointerMove={(event) => {
          if ((event.buttons & 1) !== 1) {
            onHoverCell(event.point.x, event.point.z);
            return;
          }
          event.stopPropagation();
          onHoverCell(event.point.x, event.point.z);
          onPaintCell(event.point.x, event.point.z);
        }}
        onPointerOut={() => onHoverCell(Number.NaN, Number.NaN)}
        onPointerOver={(event) => {
          onHoverCell(event.point.x, event.point.z);
          onPaintCell(event.point.x, event.point.z);
        }}
        onPointerUp={(event) => {
          if (event.button !== 0) {
            return;
          }
          onPointerEnd(event.target, event.pointerId);
        }}
        position={[0, GROUND_HEIGHT, 0]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[interactionPlaneSize, interactionPlaneSize]} />
        <meshBasicMaterial opacity={0} side={DoubleSide} transparent />
      </mesh>

      <PlacedItemsRenderer
        currentTool={useMapBuilderStore.getState().editorState.currentTool}
        items={placedItems}
        onItemPointerDown={onItemPointerDown}
        selectedItemId={selectedItemId}
        tileElevationByCell={tileElevationByCell}
      />
      {hoveredCell ? <HoverMarker cell={hoveredCell} /> : null}

      <OrbitControls
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        makeDefault
        maxDistance={CAMERA_MAX_DISTANCE}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={CAMERA_MIN_DISTANCE}
        minPolarAngle={0.32}
        mouseButtons={{
          LEFT: isPanning ? MOUSE.PAN : MOUSE.ROTATE,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: isPanning ? MOUSE.ROTATE : MOUSE.PAN,
        }}
        rotateSpeed={CAMERA_ROTATE_SPEED}
        target={[0, toTerrainSurfaceY(0), 0]}
        zoomSpeed={CAMERA_ZOOM_SPEED}
      />
    </>
  );
}

export function BuilderCanvas() {
  const mapInfo = useMapBuilderStore((state) => state.mapInfo);
  const proceduralBase = useMapBuilderStore((state) => state.proceduralBase);
  const placedItems = useMapBuilderStore((state) => state.placedItems);
  const editorState = useMapBuilderStore((state) => state.editorState);
  const placeItem = useMapBuilderStore((state) => state.placeItem);
  const paintTerrainAt = useMapBuilderStore((state) => state.paintTerrainAt);
  const removeItem = useMapBuilderStore((state) => state.removeItem);
  const updateItem = useMapBuilderStore((state) => state.updateItem);
  const setHoveredCell = useMapBuilderStore((state) => state.setHoveredCell);
  const setIsPainting = useMapBuilderStore((state) => state.setIsPainting);
  const setSelectedItemId = useMapBuilderStore((state) => state.setSelectedItemId);

  const cameraDistance = useMemo(() => resolveCameraDistance(mapInfo.size), [mapInfo.size]);
  const interactionPlaneSize = useMemo(() => Math.max(toSceneAxis(mapInfo.size + 4), 120), [mapInfo.size]);
  const occupiedKeys = useMemo(
    () => new Set(placedItems.map((item) => buildPlacedItemKey(item.x, item.y, item.z))),
    [placedItems],
  );
  const tileElevationByCell = useMemo(
    () => new Map(proceduralBase.tiles.map((tile) => [buildSurfaceKey(tile.x, tile.z), tile.y] as const)),
    [proceduralBase.tiles],
  );
  const paintStrokeRef = useRef<PaintStrokeState>({ active: false, lastCellKey: null, visitedCellKeys: new Set() });
  const dragStateRef = useRef<DragState>({ active: false, itemId: null, pointerId: null });
  const clipboardRef = useRef<ClipboardItem | null>(null);
  const [isSpacePanning, setIsSpacePanning] = useState(false);

  const updateHoveredCell = (sceneX: number, sceneZ: number) => {
    if (!Number.isFinite(sceneX) || !Number.isFinite(sceneZ)) {
      setHoveredCell(null);
      return;
    }

    setHoveredCell({
      x: Math.round(toWorldAxis(sceneX)),
      y: mapInfo.defaultY,
      z: Math.round(toWorldAxis(sceneZ)),
    });
  };

  const tryPaintCell = (sceneX: number, sceneZ: number) => {
    if (isSpacePanning) {
      return;
    }
    if (dragStateRef.current.active) {
      return;
    }
    if (!paintStrokeRef.current.active || editorState.currentTool !== "paint" || !editorState.selectedAssetType) {
      return;
    }

    const x = Math.round(toWorldAxis(sceneX));
    const z = Math.round(toWorldAxis(sceneZ));
    const y = mapInfo.defaultY;
    const cellKey = buildPlacedItemKey(x, y, z);

    if (paintStrokeRef.current.lastCellKey === cellKey || paintStrokeRef.current.visitedCellKeys.has(cellKey)) {
      return;
    }

    paintStrokeRef.current.lastCellKey = cellKey;
    paintStrokeRef.current.visitedCellKeys.add(cellKey);

    const selectedAsset = getMapBuilderCatalogItem(editorState.selectedAssetType);
    if (selectedAsset?.category === "terrain") {
      paintTerrainAt({ x, z, prefabId: selectedAsset.prefabId, mode: "paint" });
      return;
    }

    if (!occupiedKeys.has(cellKey)) {
      placeItem({
        prefabId: editorState.selectedAssetType,
        x,
        y,
        z,
        meta: {},
      });
    }
  };

  const moveDraggedItem = (sceneX: number, sceneZ: number) => {
    if (!dragStateRef.current.active || !dragStateRef.current.itemId) {
      return;
    }

    const draggedItem = placedItems.find((item) => item.id === dragStateRef.current.itemId);
    if (!draggedItem) {
      return;
    }

    const x = Math.round(toWorldAxis(sceneX));
    const z = Math.round(toWorldAxis(sceneZ));
    const cellKey = buildPlacedItemKey(x, draggedItem.y, z);
    const hasCollision = placedItems.some(
      (item) => item.id !== draggedItem.id && buildPlacedItemKey(item.x, item.y, item.z) === cellKey,
    );
    if (hasCollision) {
      return;
    }

    updateItem(draggedItem.id, { x, z });
  };

  const tryDeleteCell = (sceneX: number, sceneZ: number) => {
    if (isSpacePanning || editorState.currentTool !== "delete" || !editorState.selectedAssetType) {
      return;
    }

    const selectedAsset = getMapBuilderCatalogItem(editorState.selectedAssetType);
    if (selectedAsset?.category !== "terrain") {
      return;
    }

    const x = Math.round(toWorldAxis(sceneX));
    const z = Math.round(toWorldAxis(sceneZ));
    const cellKey = `${x}:${z}:delete`;
    if (paintStrokeRef.current.lastCellKey === cellKey || paintStrokeRef.current.visitedCellKeys.has(cellKey)) {
      return;
    }

    paintStrokeRef.current.lastCellKey = cellKey;
    paintStrokeRef.current.visitedCellKeys.add(cellKey);
    paintTerrainAt({ x, z, prefabId: selectedAsset.prefabId, mode: "delete" });
  };

  const handleStrokeCell = (sceneX: number, sceneZ: number) => {
    tryPaintCell(sceneX, sceneZ);
    tryDeleteCell(sceneX, sceneZ);
  };

  const handlePointerStart = (eventTarget: EventTarget | null, pointerId: number, sceneX: number, sceneZ: number) => {
    const isPaintTool = (editorState.currentTool === "paint" || editorState.currentTool === "delete") && !isSpacePanning;

    paintStrokeRef.current.active = isPaintTool;
    paintStrokeRef.current.lastCellKey = null;
    paintStrokeRef.current.visitedCellKeys.clear();
    setIsPainting(isPaintTool);

    const pointerTarget = eventTarget as Element & {
      setPointerCapture?: (nextPointerId: number) => void;
    };
    if (isPaintTool) {
      pointerTarget.setPointerCapture?.(pointerId);
    }

    updateHoveredCell(sceneX, sceneZ);
    if (editorState.currentTool === "select") {
      setSelectedItemId(null);
    }
    if (!isSpacePanning) {
      handleStrokeCell(sceneX, sceneZ);
    }
    moveDraggedItem(sceneX, sceneZ);
  };

  const handlePointerEnd = (eventTarget: EventTarget | null, pointerId: number) => {
    paintStrokeRef.current.active = false;
    paintStrokeRef.current.lastCellKey = null;
    paintStrokeRef.current.visitedCellKeys.clear();
    setIsPainting(false);

    const pointerTarget = eventTarget as Element & {
      releasePointerCapture?: (nextPointerId: number) => void;
    };
    pointerTarget.releasePointerCapture?.(pointerId);
    dragStateRef.current.active = false;
    dragStateRef.current.itemId = null;
    dragStateRef.current.pointerId = null;
  };

  const handleItemPointerDown = (event: ThreeEvent<PointerEvent>, itemId: string) => {
    if (event.button !== 0) {
      return;
    }

    if (editorState.currentTool === "delete") {
      const selectedAsset = editorState.selectedAssetType ? getMapBuilderCatalogItem(editorState.selectedAssetType) : null;
      if (selectedAsset?.category === "terrain") {
        const targetItem = placedItems.find((item) => item.id === itemId);
        if (targetItem) {
          paintTerrainAt({ x: targetItem.x, z: targetItem.z, prefabId: selectedAsset.prefabId, mode: "delete" });
        }
      } else {
        removeItem(itemId);
      }
      return;
    }

    setSelectedItemId(itemId);
    if (editorState.currentTool !== "select") {
      return;
    }

    dragStateRef.current.active = true;
    dragStateRef.current.itemId = itemId;
    dragStateRef.current.pointerId = event.pointerId;

    const pointerTarget = event.target as Element & {
      setPointerCapture?: (nextPointerId: number) => void;
    };
    pointerTarget.setPointerCapture?.(event.pointerId);
  };

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setIsSpacePanning(true);
      }
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      const selectedItem = placedItems.find((item) => item.id === editorState.selectedItemId);
      if ((event.key === "c" || event.key === "C") && selectedItem) {
        event.preventDefault();
        clipboardRef.current = {
          prefabId: selectedItem.prefabId,
          rotationY: selectedItem.rotationY,
          scale: selectedItem.scale,
          tag: selectedItem.tag,
          zoneId: selectedItem.zoneId,
          meta: selectedItem.meta,
        };
      }

      if (event.key === "v" || event.key === "V") {
        const copy = clipboardRef.current;
        if (!copy) {
          return;
        }
        event.preventDefault();

        const fallbackX = selectedItem ? selectedItem.x + 1 : 0;
        const fallbackY = selectedItem ? selectedItem.y : mapInfo.defaultY;
        const fallbackZ = selectedItem ? selectedItem.z + 1 : 0;

        placeItem({
          prefabId: copy.prefabId,
          rotationY: copy.rotationY,
          scale: copy.scale,
          tag: copy.tag,
          zoneId: copy.zoneId,
          meta: copy.meta,
          x: editorState.hoveredCell?.x ?? fallbackX,
          y: editorState.hoveredCell?.y ?? fallbackY,
          z: editorState.hoveredCell?.z ?? fallbackZ,
        });
      }
    };
    const handleKeyboardUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setIsSpacePanning(false);
      }
    };
    const handleWindowBlur = () => {
      setIsSpacePanning(false);
    };

    window.addEventListener("keydown", handleKeyboard);
    window.addEventListener("keyup", handleKeyboardUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyboard);
      window.removeEventListener("keyup", handleKeyboardUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [editorState.hoveredCell, editorState.selectedAssetType, editorState.selectedItemId, mapInfo.defaultY, paintTerrainAt, placeItem, placedItems]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return (
    <div className={`relative h-full min-h-[72vh] overflow-hidden lg:min-h-[calc(100vh-3.5rem)] ${isSpacePanning ? "cursor-grab" : "cursor-default"}`}>
      <Canvas
        camera={{ position: [cameraDistance, cameraDistance * 0.52, cameraDistance], fov: 52 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true }}
        shadows
      >
        <SceneContent
          cameraDistance={cameraDistance}
          hoveredCell={editorState.hoveredCell}
          isPanning={isSpacePanning}
          interactionPlaneSize={interactionPlaneSize}
          mapSize={mapInfo.size}
          onHoverCell={updateHoveredCell}
          onItemPointerDown={handleItemPointerDown}
          onPaintCell={handleStrokeCell}
          onPointerEnd={handlePointerEnd}
          onPointerStart={handlePointerStart}
          placedItems={placedItems}
          selectedItemId={editorState.selectedItemId}
          tileElevationByCell={tileElevationByCell}
          tiles={proceduralBase.tiles}
        />
      </Canvas>
    </div>
  );
}
