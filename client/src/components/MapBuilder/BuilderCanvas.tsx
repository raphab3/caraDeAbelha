import { OrbitControls } from "@react-three/drei";
import { Clone, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ElementRef, type RefObject } from "react";
import { DoubleSide, MOUSE, Vector3, type Group } from "three";

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
import { resolveModelGroundOffsetY } from "../GameViewport/modelAnchoring";
import type { MapBuilderCatalogItem, PlacedItem } from "./types";

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
  origin: Record<string, Pick<PlacedItem, "x" | "z">>;
}

interface ClipboardItem {
  prefabId: string;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
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

function normalizeAssetPath(assetPath: string): string {
  return assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function resolveCameraDistance(size: number): number {
  return Math.min(CAMERA_MAX_DISTANCE, Math.max(CAMERA_BASE_DISTANCE, toSceneAxis(size) * 0.44));
}

function HoverMarker({ cell, mode }: { cell: { x: number; y: number; z: number }; mode: "paint" | "delete" | "select" }) {
  const markerRef = useRef<Group>(null);
  const sceneX = toSceneAxis(cell.x);
  const sceneZ = toSceneAxis(cell.z);
  const color = mode === "delete" ? "#fb7185" : mode === "select" ? "#60a5fa" : "#facc15";

  useFrame((state) => {
    if (!markerRef.current) {
      return;
    }

    markerRef.current.rotation.z = state.clock.elapsedTime * 1.5;
    markerRef.current.position.y = toTerrainSurfaceY(cell.y) + 0.12 + Math.sin(state.clock.elapsedTime * 3.2) * 0.04;
  });

  return (
    <group ref={markerRef} position={[sceneX, toTerrainSurfaceY(cell.y) + 0.12, sceneZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <planeGeometry args={[0.92, 0.92]} />
        <meshBasicMaterial color={color} depthWrite={false} opacity={0.12} side={DoubleSide} transparent />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <ringGeometry args={[0.1, 0.18, 28]} />
        <meshBasicMaterial color={color} depthWrite={false} opacity={0.92} side={DoubleSide} transparent />
      </mesh>
    </group>
  );
}

function PlacementPreview({
  catalogItem,
  cell,
  rotationY,
  tileElevationByCell,
}: {
  catalogItem: MapBuilderCatalogItem;
  cell: { x: number; y: number; z: number };
  rotationY: number;
  tileElevationByCell: Map<string, number>;
}) {
  const gltf = useGLTF(normalizeAssetPath(catalogItem.assetPath));
  const groundOffsetY = useMemo(() => resolveModelGroundOffsetY(gltf.scene), [gltf.scene]);
  const sceneY =
    catalogItem.category === "terrain"
      ? toTerrainSurfaceY(tileElevationByCell.get(buildSurfaceKey(cell.x, cell.z)) ?? 0)
      : toTerrainSurfaceY(cell.y);

  return (
    <group
      position={[
        toSceneAxis(cell.x),
        sceneY + groundOffsetY * catalogItem.defaultScale,
        toSceneAxis(cell.z),
      ]}
      rotation={[0, (rotationY * Math.PI) / 180, 0]}
      scale={[catalogItem.defaultScale, catalogItem.defaultScale, catalogItem.defaultScale]}
    >
      <Clone object={gltf.scene} />
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.58, 0.74, 44]} />
        <meshBasicMaterial color="#22d3ee" depthWrite={false} opacity={0.82} transparent />
      </mesh>
      <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#38bdf8" depthWrite={false} opacity={0.18} side={DoubleSide} transparent />
      </mesh>
    </group>
  );
}

type OrbitControlsHandle = ElementRef<typeof OrbitControls>;

function KeyboardCameraNavigator({ controlsRef, mapSize }: { controlsRef: RefObject<OrbitControlsHandle | null>; mapSize: number }) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isNavigationKey = ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key);
      if (!isNavigationKey || isEditableTarget(event.target)) {
        return;
      }

      const controls = controlsRef.current;
      if (!controls) {
        return;
      }

      event.preventDefault();
      const step = Math.max(1, toSceneAxis(mapSize) / 14);
      const forward = new Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      const right = new Vector3().crossVectors(forward, camera.up).normalize();
      const direction = new Vector3();

      if (key === "arrowup" || key === "w") {
        direction.add(forward);
      }
      if (key === "arrowdown" || key === "s") {
        direction.sub(forward);
      }
      if (key === "arrowright" || key === "d") {
        direction.add(right);
      }
      if (key === "arrowleft" || key === "a") {
        direction.sub(right);
      }

      if (direction.lengthSq() === 0) {
        return;
      }

      direction.normalize().multiplyScalar(step);

      controls.target.x += direction.x;
      controls.target.z += direction.z;
      camera.position.x += direction.x;
      camera.position.z += direction.z;
      controls.update();
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [camera, controlsRef, mapSize]);

  return null;
}

function SceneContent({
  cameraDistance,
  hoveredCell,
  interactionPlaneSize,
  mapSize,
  currentTool,
  onHoverCell,
  onItemPointerDown,
  onItemPointerMove,
  onItemPointerOut,
  onItemPointerOver,
  onPaintCell,
  onPointerEnd,
  onPointerStart,
  placedItems,
  previewAsset,
  previewRotationY,
  selectedItemIds,
  tileElevationByCell,
  tiles,
}: {
  cameraDistance: number;
  hoveredCell: { x: number; y: number; z: number } | null;
  interactionPlaneSize: number;
  mapSize: number;
  currentTool: "paint" | "delete" | "select";
  onHoverCell: (pointX: number, pointZ: number) => void;
  onItemPointerDown: (event: ThreeEvent<PointerEvent>, itemId: string) => void;
  onItemPointerMove: (event: ThreeEvent<PointerEvent>, itemId: string) => void;
  onItemPointerOut: () => void;
  onItemPointerOver: (itemId: string) => void;
  onPaintCell: (pointX: number, pointZ: number) => void;
  onPointerEnd: (eventTarget: EventTarget | null, pointerId: number) => void;
  onPointerStart: (eventTarget: EventTarget | null, pointerId: number, pointX: number, pointZ: number) => void;
  placedItems: PlacedItem[];
  previewAsset: MapBuilderCatalogItem | null;
  previewRotationY: number;
  selectedItemIds: string[];
  tileElevationByCell: Map<string, number>;
  tiles: ReturnType<typeof useMapBuilderStore.getState>["proceduralBase"]["tiles"];
}) {
  const controlsRef = useRef<OrbitControlsHandle | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

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
        currentTool={currentTool}
        hoveredItemId={hoveredItemId}
        items={placedItems}
        onItemPointerDown={onItemPointerDown}
        onItemPointerMove={onItemPointerMove}
        onItemPointerOut={() => {
          setHoveredItemId(null);
          onItemPointerOut();
        }}
        onItemPointerOver={(itemId) => {
          setHoveredItemId(itemId);
          onItemPointerOver(itemId);
        }}
        selectedItemIds={selectedItemIds}
        tileElevationByCell={tileElevationByCell}
      />
      {hoveredCell ? <HoverMarker cell={hoveredCell} mode={currentTool} /> : null}
      {hoveredCell && previewAsset ? (
        <PlacementPreview
          catalogItem={previewAsset}
          cell={hoveredCell}
          rotationY={previewRotationY}
          tileElevationByCell={tileElevationByCell}
        />
      ) : null}

      <OrbitControls
        ref={controlsRef}
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        makeDefault
        maxDistance={CAMERA_MAX_DISTANCE}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={CAMERA_MIN_DISTANCE}
        minPolarAngle={0.32}
        mouseButtons={{
          LEFT: undefined,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.ROTATE,
        }}
        rotateSpeed={CAMERA_ROTATE_SPEED}
        target={[0, toTerrainSurfaceY(0), 0]}
        zoomSpeed={CAMERA_ZOOM_SPEED}
      />
      <KeyboardCameraNavigator controlsRef={controlsRef} mapSize={mapSize} />
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
  const removeSelectedItems = useMapBuilderStore((state) => state.removeSelectedItems);
  const moveSelectedItems = useMapBuilderStore((state) => state.moveSelectedItems);
  const placeItems = useMapBuilderStore((state) => state.placeItems);
  const setHoveredCell = useMapBuilderStore((state) => state.setHoveredCell);
  const setIsPainting = useMapBuilderStore((state) => state.setIsPainting);
  const setSelectedItemId = useMapBuilderStore((state) => state.setSelectedItemId);
  const setSelectedItemIds = useMapBuilderStore((state) => state.setSelectedItemIds);
  const clearSelection = useMapBuilderStore((state) => state.clearSelection);
  const setCurrentTool = useMapBuilderStore((state) => state.setCurrentTool);
  const rotatePlacement = useMapBuilderStore((state) => state.rotatePlacement);

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
  const selectedAsset = editorState.selectedAssetType ? getMapBuilderCatalogItem(editorState.selectedAssetType) ?? null : null;
  const paintStrokeRef = useRef<PaintStrokeState>({ active: false, lastCellKey: null, visitedCellKeys: new Set() });
  const dragStateRef = useRef<DragState>({ active: false, itemId: null, pointerId: null, origin: {} });
  const clipboardRef = useRef<ClipboardItem[]>([]);

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
      if (selectedAsset.prefabId === "terrain/slope-wide") {
        placeItem({
          prefabId: selectedAsset.prefabId,
          x,
          y,
          z,
          rotationY: editorState.placementRotationY,
          meta: { role: "walkable-ramp" },
          tag: "terrain",
        });
      }
      return;
    }

    if (!occupiedKeys.has(cellKey)) {
      placeItem({
        prefabId: editorState.selectedAssetType,
        x,
        y,
        z,
        rotationY: editorState.placementRotationY,
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
    moveSelectedItems({ anchorItemId: draggedItem.id, x, z, origin: dragStateRef.current.origin });
  };

  const tryDeleteCell = (sceneX: number, sceneZ: number) => {
    if (editorState.currentTool !== "delete" || !editorState.selectedAssetType) {
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
    const isPaintTool = editorState.currentTool === "paint" || editorState.currentTool === "delete";

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
      clearSelection();
    }
    handleStrokeCell(sceneX, sceneZ);
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
    dragStateRef.current.origin = {};
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

    if (editorState.currentTool === "select") {
      if (!editorState.selectedItemIds.includes(itemId)) {
        setSelectedItemIds([...editorState.selectedItemIds, itemId]);
      }
    } else {
      setSelectedItemId(itemId);
    }

    if (editorState.currentTool !== "select") {
      return;
    }

    dragStateRef.current.active = true;
    dragStateRef.current.itemId = itemId;
    dragStateRef.current.pointerId = event.pointerId;
    const selectedIds = new Set(
      editorState.selectedItemIds.includes(itemId) ? editorState.selectedItemIds : [...editorState.selectedItemIds, itemId],
    );
    dragStateRef.current.origin = Object.fromEntries(
      placedItems.filter((item) => selectedIds.has(item.id)).map((item) => [item.id, { x: item.x, z: item.z }]),
    );

    const pointerTarget = event.target as Element & {
      setPointerCapture?: (nextPointerId: number) => void;
    };
    pointerTarget.setPointerCapture?.(event.pointerId);
  };

  const handleItemPointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragStateRef.current.active) {
      return;
    }

    moveDraggedItem(event.point.x, event.point.z);
  };

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        setCurrentTool("select");
        return;
      }
      if (
        !(event.ctrlKey || event.metaKey || event.altKey) &&
        (event.key === "r" || event.key === "R" || event.key === "e" || event.key === "E")
      ) {
        event.preventDefault();
        rotatePlacement(90);
        return;
      }
      if (!(event.ctrlKey || event.metaKey || event.altKey) && (event.key === "q" || event.key === "Q")) {
        event.preventDefault();
        rotatePlacement(-90);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (editorState.selectedItemIds.length > 0) {
          event.preventDefault();
          removeSelectedItems();
        }
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      const selectedItems = placedItems.filter((item) => editorState.selectedItemIds.includes(item.id));
      if ((event.key === "c" || event.key === "C") && selectedItems.length > 0) {
        event.preventDefault();
        const anchorX = Math.min(...selectedItems.map((item) => item.x));
        const anchorY = Math.min(...selectedItems.map((item) => item.y));
        const anchorZ = Math.min(...selectedItems.map((item) => item.z));
        clipboardRef.current = selectedItems.map((item) => ({
          prefabId: item.prefabId,
          offsetX: item.x - anchorX,
          offsetY: item.y - anchorY,
          offsetZ: item.z - anchorZ,
          rotationY: item.rotationY,
          scale: item.scale,
          tag: item.tag,
          zoneId: item.zoneId,
          meta: { ...item.meta },
        }));
      }

      if (event.key === "v" || event.key === "V") {
        const copy = clipboardRef.current;
        if (copy.length === 0) {
          return;
        }
        event.preventDefault();

        const fallbackItem = selectedItems[0];
        const pasteX = editorState.hoveredCell?.x ?? (fallbackItem ? fallbackItem.x + 1 : 0);
        const pasteY = editorState.hoveredCell?.y ?? (fallbackItem ? fallbackItem.y : mapInfo.defaultY);
        const pasteZ = editorState.hoveredCell?.z ?? (fallbackItem ? fallbackItem.z + 1 : 0);

        placeItems(
          copy.map((item) => ({
            prefabId: item.prefabId,
            rotationY: item.rotationY,
            scale: item.scale,
            tag: item.tag,
            zoneId: item.zoneId,
            meta: item.meta,
            x: pasteX + item.offsetX,
            y: pasteY + item.offsetY,
            z: pasteZ + item.offsetZ,
          })),
        );
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, [
    editorState.hoveredCell,
    editorState.selectedItemIds,
    mapInfo.defaultY,
    placeItems,
    placedItems,
    removeSelectedItems,
    rotatePlacement,
    setCurrentTool,
  ]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return (
    <div className="relative h-full min-h-[72vh] overflow-hidden lg:min-h-[calc(100vh-3.5rem)]">
      <Canvas
        camera={{ position: [cameraDistance, cameraDistance * 0.52, cameraDistance], fov: 52 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true }}
        shadows
      >
        <SceneContent
          cameraDistance={cameraDistance}
          currentTool={editorState.currentTool}
          hoveredCell={editorState.hoveredCell}
          interactionPlaneSize={interactionPlaneSize}
          mapSize={mapInfo.size}
          onHoverCell={updateHoveredCell}
          onItemPointerDown={handleItemPointerDown}
          onItemPointerMove={handleItemPointerMove}
          onItemPointerOut={() => undefined}
          onItemPointerOver={() => undefined}
          onPaintCell={handleStrokeCell}
          onPointerEnd={handlePointerEnd}
          onPointerStart={handlePointerStart}
          placedItems={placedItems}
          previewAsset={editorState.currentTool === "paint" ? selectedAsset : null}
          previewRotationY={editorState.placementRotationY}
          selectedItemIds={editorState.selectedItemIds}
          tileElevationByCell={tileElevationByCell}
          tiles={proceduralBase.tiles}
        />
      </Canvas>
    </div>
  );
}
