import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { type ElementRef, type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, DoubleSide, MOUSE, MathUtils, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import type { Group, Mesh } from "three";

import { MiniMap } from "./MiniMap";
import type {
  GameSessionState,
  WorldChunkState,
  WorldFlowerState,
  WorldHiveState,
  WorldPlayerState,
} from "../../types/game";

const WORLD_TO_SCENE_SCALE = 1.35;
const TARGET_REACHED_DISTANCE = 0.22;
const BEE_HEIGHT = 0.48;
const RENDER_CORRECTION_DISTANCE = WORLD_TO_SCENE_SCALE * 0.9;
const SKY_COLOR = "#dff4ff";
const FOG_NEAR = 16;
const FOG_FAR = 42;
const GROUND_HEIGHT = -1.15;
const GROUND_SIZE = 260;
const GROUND_TILE_WORLD_SIZE = 2.5;
const CHUNK_OVERLAY_HEIGHT = GROUND_HEIGHT + 0.02;

const FLOWER_PETAL_OFFSETS: [number, number, number][] = [
  [0.18, 0.56, 0],
  [-0.18, 0.56, 0],
  [0, 0.56, 0.18],
  [0, 0.56, -0.18],
  [0, 0.7, 0],
];
const DEFAULT_CAMERA_POSITION = [5.8, 3.9, 6.6] as const;
const DEFAULT_CAMERA_FOV = 34;

interface MoveTargetMarkerState {
  sceneX: number;
  sceneZ: number;
}

function toSceneAxis(value: number): number {
  return value * WORLD_TO_SCENE_SCALE;
}

function toWorldAxis(value: number): number {
  return value / WORLD_TO_SCENE_SCALE;
}

function resolveAnchorScenePosition(
  trackedPositionRef: MutableRefObject<Vector3>,
  focusPlayer?: WorldPlayerState,
): { x: number; z: number } {
  const hasTrackedPosition = Number.isFinite(trackedPositionRef.current.x) && Number.isFinite(trackedPositionRef.current.z);
  if (hasTrackedPosition) {
    return {
      x: trackedPositionRef.current.x,
      z: trackedPositionRef.current.z,
    };
  }

  if (focusPlayer) {
    return {
      x: toSceneAxis(focusPlayer.x),
      z: toSceneAxis(focusPlayer.y),
    };
  }

  return { x: 0, z: 0 };
}

function createGroundTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("nao foi possivel criar a textura do chao");
  }

  context.fillStyle = "#86b454";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#7aa648";
  for (let stripe = 0; stripe < 12; stripe += 1) {
    context.fillRect(stripe * 16, 0, 8, canvas.height);
  }

  context.fillStyle = "rgba(255, 255, 255, 0.08)";
  for (let band = 0; band < 8; band += 1) {
    context.fillRect(0, band * 24, canvas.width, 4);
  }

  for (let patch = 0; patch < 72; patch += 1) {
    const x = (patch * 37) % canvas.width;
    const y = (patch * 53) % canvas.height;
    const radius = 2 + (patch % 4);

    context.fillStyle = patch % 3 === 0 ? "rgba(106, 142, 35, 0.26)" : "rgba(66, 115, 34, 0.22)";
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.repeat.set(
    GROUND_SIZE / (WORLD_TO_SCENE_SCALE * GROUND_TILE_WORLD_SIZE),
    GROUND_SIZE / (WORLD_TO_SCENE_SCALE * GROUND_TILE_WORLD_SIZE),
  );

  return texture;
}

function hasMoveTarget(player: WorldPlayerState): player is WorldPlayerState & { targetX: number; targetY: number } {
  return player.targetX !== undefined && player.targetY !== undefined;
}

function moveTowards(currentPosition: Vector3, targetPosition: Vector3, maxStep: number): number {
  const deltaX = targetPosition.x - currentPosition.x;
  const deltaZ = targetPosition.z - currentPosition.z;
  const distance = Math.hypot(deltaX, deltaZ);

  if (distance <= maxStep || distance <= 0.0001) {
    currentPosition.x = targetPosition.x;
    currentPosition.z = targetPosition.z;
    return 0;
  }

  const ratio = maxStep / distance;
  currentPosition.x += deltaX * ratio;
  currentPosition.z += deltaZ * ratio;
  return distance - maxStep;
}

interface BeeActorProps {
  player: WorldPlayerState;
  drift: number;
  accentColor: string;
  isLocal: boolean;
  trackedPositionRef?: MutableRefObject<Vector3>;
}

function BeeActor({ player, drift, accentColor, isLocal, trackedPositionRef }: BeeActorProps) {
  const groupRef = useRef<Group>(null);
  const leftWingRef = useRef<Mesh>(null);
  const rightWingRef = useRef<Mesh>(null);
  const authoritativePositionRef = useRef(new Vector3());
  const desiredTargetPositionRef = useRef(new Vector3());
  const initialPosition = useMemo(
    () => [toSceneAxis(player.x), BEE_HEIGHT, toSceneAxis(player.y)] as const,
    [player.id],
  );

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.position.set(toSceneAxis(player.x), BEE_HEIGHT, toSceneAxis(player.y));
    trackedPositionRef?.current.copy(groupRef.current.position);
  }, [player.id, trackedPositionRef]);

  useFrame((state, delta) => {
    if (!groupRef.current || !leftWingRef.current || !rightWingRef.current) {
      return;
    }

    const time = state.clock.elapsedTime + drift;
    const hoverHeight = BEE_HEIGHT + Math.sin(time * 2.4) * 0.18;
    const currentPosition = groupRef.current.position;
    const movementStep = Math.max(player.speed, 0.001) * WORLD_TO_SCENE_SCALE * delta;

    authoritativePositionRef.current.set(toSceneAxis(player.x), currentPosition.y, toSceneAxis(player.y));

    if (hasMoveTarget(player)) {
      desiredTargetPositionRef.current.set(
        toSceneAxis(player.targetX),
        currentPosition.y,
        toSceneAxis(player.targetY),
      );

      if (currentPosition.distanceTo(authoritativePositionRef.current) > RENDER_CORRECTION_DISTANCE) {
        currentPosition.copy(authoritativePositionRef.current);
      }

      moveTowards(currentPosition, desiredTargetPositionRef.current, movementStep);
    } else {
      const correctionDistance = currentPosition.distanceTo(authoritativePositionRef.current);
      moveTowards(
        currentPosition,
        authoritativePositionRef.current,
        Math.max(movementStep, correctionDistance * 0.24),
      );
    }

    currentPosition.y = MathUtils.lerp(currentPosition.y, hoverHeight, 0.18);

    const lookTarget = hasMoveTarget(player)
      ? desiredTargetPositionRef.current
      : authoritativePositionRef.current;
    const lookDeltaX = lookTarget.x - currentPosition.x;
    const lookDeltaZ = lookTarget.z - currentPosition.z;

    if (Math.abs(lookDeltaX) > 0.001 || Math.abs(lookDeltaZ) > 0.001) {
      groupRef.current.rotation.y = Math.atan2(lookDeltaX, lookDeltaZ);
    }

    trackedPositionRef?.current.copy(groupRef.current.position);
    leftWingRef.current.rotation.z = Math.sin(time * 18) * 0.3;
    rightWingRef.current.rotation.z = -Math.sin(time * 18) * 0.3;
  });

  return (
    <group ref={groupRef} position={initialPosition}>
      {isLocal ? (
        <mesh position={[0, -0.56, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.78, 1.04, 40]} />
          <meshBasicMaterial color="#fff1a8" opacity={0.92} side={DoubleSide} transparent />
        </mesh>
      ) : null}

      <mesh castShadow>
        <sphereGeometry args={[0.62, 32, 32]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={isLocal ? "#ffd15c" : "#000000"}
          emissiveIntensity={isLocal ? 0.38 : 0}
          metalness={0.05}
          roughness={0.72}
        />
      </mesh>

      <mesh castShadow position={[-0.35, 0, 0]}>
        <boxGeometry args={[0.12, 0.9, 1.18]} />
        <meshStandardMaterial color="#23150d" roughness={0.84} />
      </mesh>

      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.12, 0.9, 1.18]} />
        <meshStandardMaterial color="#23150d" roughness={0.84} />
      </mesh>

      <mesh castShadow position={[0.35, 0, 0]}>
        <boxGeometry args={[0.12, 0.9, 1.18]} />
        <meshStandardMaterial color="#23150d" roughness={0.84} />
      </mesh>

      <mesh castShadow position={[0.7, 0, 0]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color="#23150d" roughness={0.84} />
      </mesh>

      <mesh
        ref={leftWingRef}
        position={[-0.08, 0.44, -0.3]}
        rotation={[0.2, 0, 0.15]}
      >
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshStandardMaterial
          color="#d9f3ff"
          transparent
          opacity={0.74}
          roughness={0.18}
        />
      </mesh>

      <mesh
        ref={rightWingRef}
        position={[-0.08, 0.44, 0.3]}
        rotation={[-0.2, 0, -0.15]}
      >
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshStandardMaterial
          color="#d9f3ff"
          transparent
          opacity={0.74}
          roughness={0.18}
        />
      </mesh>

      <Html center distanceFactor={8} position={[0, 1.42, 0]} sprite transform>
        <div className={`bee-nameplate${isLocal ? " bee-nameplate--local" : ""}`}>
          {player.username}
        </div>
      </Html>
    </group>
  );
}

function MoveTargetMarker({ target }: { target: MoveTargetMarkerState }) {
  const markerRef = useRef<Group>(null);

  useFrame((state) => {
    if (!markerRef.current) {
      return;
    }

    markerRef.current.rotation.y = state.clock.elapsedTime * 1.8;
    markerRef.current.position.y = -1.02 + Math.sin(state.clock.elapsedTime * 3.4) * 0.04;
  });

  return (
    <group ref={markerRef} position={[target.sceneX, -1.02, target.sceneZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.38, 36]} />
        <meshBasicMaterial color="#fff7bb" opacity={0.95} side={DoubleSide} transparent />
      </mesh>

      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 24]} />
        <meshBasicMaterial color="#ffcb4c" opacity={0.92} transparent />
      </mesh>
    </group>
  );
}

function CameraRig({
  focusPlayer,
  trackedPositionRef,
}: {
  focusPlayer?: WorldPlayerState;
  trackedPositionRef: MutableRefObject<Vector3>;
}) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null);
  const smoothedTargetRef = useRef(new Vector3(0, 0.45, 0));
  const { gl } = useThree();

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    gl.domElement.addEventListener("contextmenu", handleContextMenu);

    return () => {
      gl.domElement.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const anchor = resolveAnchorScenePosition(trackedPositionRef, focusPlayer);
    const desiredTarget = new Vector3(anchor.x, 0.42, anchor.z);

    smoothedTargetRef.current.lerp(desiredTarget, 1 - Math.exp(-delta * 6));
    controlsRef.current?.target.copy(smoothedTargetRef.current);
    controlsRef.current?.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      dampingFactor={0.08}
      enableDamping
      enablePan={false}
      makeDefault
      maxDistance={18}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={3.4}
      minPolarAngle={0.45}
      mouseButtons={{
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.ROTATE,
      }}
      target={[0, 0.42, 0]}
    />
  );
}

function InfiniteGround({
  focusPlayer,
  trackedPositionRef,
  onPointerDown,
}: {
  focusPlayer?: WorldPlayerState;
  trackedPositionRef: MutableRefObject<Vector3>;
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const groundRef = useRef<Mesh>(null);
  const groundTexture = useMemo(() => createGroundTexture(), []);

  useEffect(() => () => groundTexture.dispose(), [groundTexture]);

  useFrame(() => {
    if (!groundRef.current) {
      return;
    }

    const anchor = resolveAnchorScenePosition(trackedPositionRef, focusPlayer);
    groundRef.current.position.x = anchor.x;
    groundRef.current.position.z = anchor.z;
  });

  return (
    <mesh
      ref={groundRef}
      receiveShadow
      onPointerDown={onPointerDown}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, GROUND_HEIGHT, 0]}
    >
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial color="#95c45a" map={groundTexture} roughness={0.98} />
    </mesh>
  );
}

function FlowerDecoration({ flower }: { flower: WorldFlowerState }) {
  return (
    <group position={[toSceneAxis(flower.x), GROUND_HEIGHT + 0.02, toSceneAxis(flower.y)]} scale={flower.scale}>
      <mesh castShadow position={[0, 0.24, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.52, 10]} />
        <meshStandardMaterial color="#648a34" roughness={0.92} />
      </mesh>

      {FLOWER_PETAL_OFFSETS.map((offset, index) => (
        <mesh key={`${flower.id}:petal:${index}`} castShadow position={offset}>
          <sphereGeometry args={[0.11, 14, 14]} />
          <meshStandardMaterial color={flower.petalColor} roughness={0.74} />
        </mesh>
      ))}

      <mesh castShadow position={[0, 0.58, 0]}>
        <sphereGeometry args={[0.13, 18, 18]} />
        <meshStandardMaterial color={flower.coreColor} roughness={0.6} />
      </mesh>
    </group>
  );
}

function HiveDecoration({ hive }: { hive: WorldHiveState }) {
  return (
    <group position={[toSceneAxis(hive.x), GROUND_HEIGHT + 0.12, toSceneAxis(hive.y)]} scale={hive.scale}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.48, 0.92, 10]} />
        <meshStandardMaterial color={hive.toneColor} roughness={0.84} />
      </mesh>

      <mesh castShadow position={[0, 0.04, 0.34]}>
        <cylinderGeometry args={[0.08, 0.08, 0.12, 18]} />
        <meshStandardMaterial color="#2f1b10" roughness={0.92} />
      </mesh>

      <mesh position={[0, 0.72, 0]}>
        <icosahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color={hive.glowColor} emissive={hive.glowColor} emissiveIntensity={0.72} />
      </mesh>
    </group>
  );
}

function ChunkField({ chunks, chunkSize }: { chunks: WorldChunkState[]; chunkSize: number }) {
  if (chunkSize <= 0) {
    return null;
  }

  const chunkSceneSize = toSceneAxis(chunkSize);

  return (
    <group>
      {chunks.map((chunk) => {
        const chunkCenterX = toSceneAxis((chunk.x + 0.5) * chunkSize);
        const chunkCenterZ = toSceneAxis((chunk.y + 0.5) * chunkSize);
        const overlayColor = Math.abs(chunk.x+chunk.y) % 2 === 0 ? "#88b44d" : "#7eaa45";

        return (
          <group key={chunk.key}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[chunkCenterX, CHUNK_OVERLAY_HEIGHT, chunkCenterZ]}>
              <planeGeometry args={[chunkSceneSize - 0.12, chunkSceneSize - 0.12]} />
              <meshBasicMaterial color={overlayColor} opacity={0.18} transparent />
            </mesh>

            {chunk.flowers.map((flower) => (
              <FlowerDecoration key={flower.id} flower={flower} />
            ))}

            {chunk.hives.map((hive) => (
              <HiveDecoration key={hive.id} hive={hive} />
            ))}
          </group>
        );
      })}
    </group>
  );
}

interface HiveCoreProps {
  players: WorldPlayerState[];
  chunks: WorldChunkState[];
  chunkSize: number;
  connectionState: GameSessionState["connectionState"];
  localPlayerId?: string;
  localPlayerPositionRef: MutableRefObject<Vector3>;
  onMoveToTarget: (x: number, z: number) => void;
}

function HiveCore({
  players,
  chunks,
  chunkSize,
  connectionState,
  localPlayerId,
  localPlayerPositionRef,
  onMoveToTarget,
}: HiveCoreProps) {
  const [moveTargetMarker, setMoveTargetMarker] = useState<MoveTargetMarkerState | null>(null);
  const localPlayer = useMemo(
    () => players.find((player) => player.id === localPlayerId),
    [localPlayerId, players],
  );

  useEffect(() => {
    if (connectionState !== "connected" || !localPlayerId) {
      setMoveTargetMarker(null);
      localPlayerPositionRef.current.set(Number.NaN, Number.NaN, Number.NaN);
    }
  }, [connectionState, localPlayerId, localPlayerPositionRef]);

  useEffect(() => {
    if (!localPlayer) {
      return;
    }

    if (hasMoveTarget(localPlayer)) {
      setMoveTargetMarker({
        sceneX: toSceneAxis(localPlayer.targetX),
        sceneZ: toSceneAxis(localPlayer.targetY),
      });
      return;
    }

    setMoveTargetMarker(null);
  }, [localPlayer]);

  useFrame(() => {
    if (!moveTargetMarker || !Number.isFinite(localPlayerPositionRef.current.x)) {
      return;
    }

    const distanceToTarget = Math.hypot(
      localPlayerPositionRef.current.x - moveTargetMarker.sceneX,
      localPlayerPositionRef.current.z - moveTargetMarker.sceneZ,
    );

    if (distanceToTarget < TARGET_REACHED_DISTANCE) {
      setMoveTargetMarker(null);
    }
  });

  const handleGroundPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0 || connectionState !== "connected" || !localPlayerId) {
      return;
    }

    event.stopPropagation();

    const worldX = toWorldAxis(event.point.x);
    const worldZ = toWorldAxis(event.point.z);

    setMoveTargetMarker({
      sceneX: toSceneAxis(worldX),
      sceneZ: toSceneAxis(worldZ),
    });

    onMoveToTarget(worldX, worldZ);
  };

  return (
    <group>
      <fog attach="fog" args={[SKY_COLOR, FOG_NEAR, FOG_FAR]} />
      <ambientLight intensity={1} />
      <hemisphereLight color="#fff8d4" groundColor="#6b9035" intensity={0.64} />
      <directionalLight
        castShadow
        intensity={1.85}
        position={[10, 14, 8]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-bottom={-18}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-bias={-0.00015}
      />
      <InfiniteGround
        focusPlayer={localPlayer}
        onPointerDown={handleGroundPointerDown}
        trackedPositionRef={localPlayerPositionRef}
      />
      <ChunkField chunkSize={chunkSize} chunks={chunks} />

      {moveTargetMarker ? <MoveTargetMarker target={moveTargetMarker} /> : null}

      {players.map((player, index) => (
        <BeeActor
          key={player.id}
          accentColor={player.id === localPlayerId ? "#f8c537" : "#ffd86f"}
          player={player}
          drift={index * 0.9}
          isLocal={player.id === localPlayerId}
          trackedPositionRef={player.id === localPlayerId ? localPlayerPositionRef : undefined}
        />
      ))}

      {connectionState === "disconnected" ? (
        <mesh position={[localPlayer ? toSceneAxis(localPlayer.x) : 0, 2.1, localPlayer ? toSceneAxis(localPlayer.y) : 0]}>
          <icosahedronGeometry args={[0.38, 0]} />
          <meshStandardMaterial
            color="#b24a32"
            emissive="#ff6b3d"
            emissiveIntensity={0.8}
          />
        </mesh>
      ) : null}
    </group>
  );
}

interface GameViewportProps {
  players: WorldPlayerState[];
  chunks: WorldChunkState[];
  chunkSize: number;
  connectionState: GameSessionState["connectionState"];
  localPlayerId?: string;
  onMoveToTarget: (x: number, z: number) => void;
}

export function GameViewport({
  players,
  chunks,
  chunkSize,
  connectionState,
  localPlayerId,
  onMoveToTarget,
}: GameViewportProps) {
  const localPlayer = useMemo(
    () => players.find((player) => player.id === localPlayerId),
    [localPlayerId, players],
  );
  const localPlayerPositionRef = useRef(new Vector3(Number.NaN, Number.NaN, Number.NaN));

  return (
    <div className="viewport-canvas-shell">
      <Canvas
        camera={{ position: DEFAULT_CAMERA_POSITION, fov: DEFAULT_CAMERA_FOV }}
        dpr={[1, 1.6]}
        shadows
        gl={{ antialias: true }}
      >
        <color attach="background" args={[SKY_COLOR]} />
        <CameraRig focusPlayer={localPlayer} trackedPositionRef={localPlayerPositionRef} />
        <HiveCore
          chunks={chunks}
          chunkSize={chunkSize}
          connectionState={connectionState}
          localPlayerId={localPlayerId}
          localPlayerPositionRef={localPlayerPositionRef}
          onMoveToTarget={onMoveToTarget}
          players={players}
        />
      </Canvas>

      <MiniMap
        chunkSize={chunkSize}
        chunks={chunks}
        localPlayerId={localPlayerId}
        players={players}
      />
    </div>
  );
}
