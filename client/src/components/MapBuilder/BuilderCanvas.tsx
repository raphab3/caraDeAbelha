import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { DoubleSide, MOUSE, type Mesh } from "three";

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

interface BuilderCanvasProps {
  isFullscreen: boolean;
  isFullscreenSupported: boolean;
  onToggleFullscreen: () => Promise<void>;
}

interface PaintStrokeState {
  active: boolean;
  lastCellKey: string | null;
  visitedCellKeys: Set<string>;
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
  interactionPlaneSize,
  mapSize,
  maxTileElevation,
  occupiedKeys,
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
  interactionPlaneSize: number;
  mapSize: number;
  maxTileElevation: number;
  occupiedKeys: Set<string>;
  onHoverCell: (pointX: number, pointZ: number) => void;
  onItemPointerDown: (itemId: string) => void;
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
          event.stopPropagation();
          onPointerStart(event.target, event.pointerId, event.point.x, event.point.z);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          onHoverCell(event.point.x, event.point.z);
          onPaintCell(event.point.x, event.point.z);
        }}
        onPointerOut={() => onHoverCell(Number.NaN, Number.NaN)}
        onPointerOver={(event) => {
          event.stopPropagation();
          onHoverCell(event.point.x, event.point.z);
          onPaintCell(event.point.x, event.point.z);
        }}
        onPointerUp={(event) => onPointerEnd(event.target, event.pointerId)}
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

      <Html fullscreen>
        <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-slate-950/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-100">
            grid {mapSize}x{mapSize}
          </span>
          <span className="rounded-full border border-white/10 bg-slate-950/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-100">
            altura max {maxTileElevation}
          </span>
          <span className="rounded-full border border-white/10 bg-slate-950/78 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-100">
            ocupacao {occupiedKeys.size}
          </span>
        </div>
      </Html>

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
          LEFT: MOUSE.ROTATE,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.PAN,
        }}
        rotateSpeed={CAMERA_ROTATE_SPEED}
        target={[0, toTerrainSurfaceY(0), 0]}
        zoomSpeed={CAMERA_ZOOM_SPEED}
      />
    </>
  );
}

export function BuilderCanvas({ isFullscreen, isFullscreenSupported, onToggleFullscreen }: BuilderCanvasProps) {
  const mapInfo = useMapBuilderStore((state) => state.mapInfo);
  const proceduralBase = useMapBuilderStore((state) => state.proceduralBase);
  const placedItems = useMapBuilderStore((state) => state.placedItems);
  const editorState = useMapBuilderStore((state) => state.editorState);
  const placeItem = useMapBuilderStore((state) => state.placeItem);
  const removeItem = useMapBuilderStore((state) => state.removeItem);
  const setHoveredCell = useMapBuilderStore((state) => state.setHoveredCell);
  const setIsPainting = useMapBuilderStore((state) => state.setIsPainting);
  const setSelectedItemId = useMapBuilderStore((state) => state.setSelectedItemId);

  const cameraDistance = useMemo(() => resolveCameraDistance(mapInfo.size), [mapInfo.size]);
  const interactionPlaneSize = useMemo(() => Math.max(toSceneAxis(mapInfo.size + 4), 120), [mapInfo.size]);
  const occupiedKeys = useMemo(
    () => new Set(placedItems.map((item) => buildPlacedItemKey(item.x, item.y, item.z))),
    [placedItems],
  );
  const maxTileElevation = useMemo(
    () => proceduralBase.tiles.reduce((max, tile) => Math.max(max, tile.y), 0),
    [proceduralBase.tiles],
  );
  const tileElevationByCell = useMemo(
    () => new Map(proceduralBase.tiles.map((tile) => [buildSurfaceKey(tile.x, tile.z), tile.y] as const)),
    [proceduralBase.tiles],
  );
  const paintStrokeRef = useRef<PaintStrokeState>({ active: false, lastCellKey: null, visitedCellKeys: new Set() });

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

    if (occupiedKeys.has(cellKey)) {
      return;
    }

    placeItem({
      prefabId: editorState.selectedAssetType,
      x,
      y,
      z,
      meta: {},
    });
  };

  const handlePointerStart = (eventTarget: EventTarget | null, pointerId: number, sceneX: number, sceneZ: number) => {
    const isPaintTool = editorState.currentTool === "paint";

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
    tryPaintCell(sceneX, sceneZ);
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
  };

  const handleItemPointerDown = (itemId: string) => {
    if (editorState.currentTool === "delete") {
      removeItem(itemId);
      return;
    }

    if (editorState.currentTool === "select") {
      setSelectedItemId(itemId);
    }
  };

  return (
    <div className="relative h-full min-h-[52vh] overflow-hidden lg:min-h-[60vh]">
      <Canvas
        camera={{ position: [cameraDistance, cameraDistance * 0.52, cameraDistance], fov: 52 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true }}
        shadows
      >
        <SceneContent
          cameraDistance={cameraDistance}
          hoveredCell={editorState.hoveredCell}
          interactionPlaneSize={interactionPlaneSize}
          mapSize={mapInfo.size}
          maxTileElevation={maxTileElevation}
          occupiedKeys={occupiedKeys}
          onHoverCell={updateHoveredCell}
          onItemPointerDown={handleItemPointerDown}
          onPaintCell={tryPaintCell}
          onPointerEnd={handlePointerEnd}
          onPointerStart={handlePointerStart}
          placedItems={placedItems}
          selectedItemId={editorState.selectedItemId}
          tileElevationByCell={tileElevationByCell}
          tiles={proceduralBase.tiles}
        />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-xl rounded-[24px] border border-white/10 bg-slate-950/78 px-4 py-3 text-sm leading-6 text-slate-200 shadow-[0_18px_40px_rgba(2,6,23,0.3)] backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Edicao do mapa</p>
          <p className="mt-1">
            Clique e arraste para pintar no grid.
          </p>
        </div>

        <div className="pointer-events-auto flex flex-wrap gap-2">
          {isFullscreenSupported ? (
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/78 px-4 text-sm font-semibold text-white transition-colors hover:border-amber-200/30 hover:bg-slate-900"
              onClick={() => {
                void onToggleFullscreen();
              }}
              type="button"
            >
              {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}