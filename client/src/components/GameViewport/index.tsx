import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { type ElementRef, type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import { DoubleSide, MOUSE, MathUtils, Vector3 } from "three";
import type { Group, Mesh } from "three";

import type { GameSessionState, WorldPlayerState } from "../../types/game";

const WORLD_TO_SCENE_SCALE = 1.35;
const WORLD_LIMIT = 6;
const TARGET_REACHED_DISTANCE = 0.22;
const BEE_HEIGHT = 0.48;
const RENDER_CORRECTION_DISTANCE = WORLD_TO_SCENE_SCALE * 0.9;
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
  return MathUtils.clamp(value / WORLD_TO_SCENE_SCALE, -WORLD_LIMIT, WORLD_LIMIT);
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
    const hasTrackedPosition = Number.isFinite(trackedPositionRef.current.x) && Number.isFinite(trackedPositionRef.current.z);
    const nextX = hasTrackedPosition ? trackedPositionRef.current.x : focusPlayer ? toSceneAxis(focusPlayer.x) : 0;
    const nextZ = hasTrackedPosition ? trackedPositionRef.current.z : focusPlayer ? toSceneAxis(focusPlayer.y) : 0;
    const desiredTarget = new Vector3(nextX, 0.42, nextZ);

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

interface HiveCoreProps {
  players: WorldPlayerState[];
  connectionState: GameSessionState["connectionState"];
  localPlayerId?: string;
  localPlayerPositionRef: MutableRefObject<Vector3>;
  onMoveToTarget: (x: number, z: number) => void;
}

function HiveCore({ players, connectionState, localPlayerId, localPlayerPositionRef, onMoveToTarget }: HiveCoreProps) {
  const hiveRef = useRef<Group>(null);
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

  useFrame((state) => {
    if (!hiveRef.current) {
      return;
    }

    hiveRef.current.rotation.y =
      Math.sin(state.clock.elapsedTime * 0.25) * 0.25;

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
      <fog attach="fog" args={["#f9d36d", 10, 26]} />
      <ambientLight intensity={1.1} />
      <directionalLight
        castShadow
        intensity={2.2}
        position={[5, 8, 4]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight
        intensity={24}
        color="#ffbf45"
        distance={12}
        position={[0, 1.6, 0]}
      />

      <mesh
        receiveShadow
        onPointerDown={handleGroundPointerDown}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.15, 0]}
      >
        <circleGeometry args={[10, 64]} />
        <meshStandardMaterial color="#5b742d" roughness={0.98} />
      </mesh>

      <group ref={hiveRef} position={[0, -0.15, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[1.55, 2.1, 2.6, 6]} />
          <meshStandardMaterial color="#b9821c" roughness={0.86} />
        </mesh>

        <mesh castShadow position={[0, 0.1, 1.56]}>
          <cylinderGeometry args={[0.3, 0.3, 0.35, 24]} />
          <meshStandardMaterial color="#26170d" roughness={0.92} />
        </mesh>

        <mesh position={[0, 1.7, 0]}>
          <icosahedronGeometry args={[0.48, 0]} />
          <meshStandardMaterial
            color="#ffd36a"
            emissive="#ffae00"
            emissiveIntensity={0.8}
          />
        </mesh>
      </group>

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
        <mesh position={[0, 2.1, 0]}>
          <icosahedronGeometry args={[0.38, 0]} />
          <meshStandardMaterial
            color="#b24a32"
            emissive="#ff6b3d"
            emissiveIntensity={0.8}
          />
        </mesh>
      ) : null}

      <gridHelper
        args={[18, 18, "#7e601f", "#cfa33f"]}
        position={[0, -1.14, 0]}
      />
    </group>
  );
}

interface GameViewportProps {
  players: WorldPlayerState[];
  connectionState: GameSessionState["connectionState"];
  localPlayerId?: string;
  onMoveToTarget: (x: number, z: number) => void;
}

export function GameViewport({ players, connectionState, localPlayerId, onMoveToTarget }: GameViewportProps) {
  const localPlayer = useMemo(
    () => players.find((player) => player.id === localPlayerId),
    [localPlayerId, players],
  );
  const localPlayerPositionRef = useRef(new Vector3(Number.NaN, Number.NaN, Number.NaN));

  return (
    <Canvas
      camera={{ position: DEFAULT_CAMERA_POSITION, fov: DEFAULT_CAMERA_FOV }}
      dpr={[1, 1.6]}
      shadows
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#f7cd4a"]} />
      <CameraRig focusPlayer={localPlayer} trackedPositionRef={localPlayerPositionRef} />
      <HiveCore
        connectionState={connectionState}
        localPlayerId={localPlayerId}
        localPlayerPositionRef={localPlayerPositionRef}
        onMoveToTarget={onMoveToTarget}
        players={players}
      />
    </Canvas>
  );
}
