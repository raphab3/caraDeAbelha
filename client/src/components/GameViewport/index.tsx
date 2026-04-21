import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Suspense, type ElementRef, type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  BoxGeometry,
  CircleGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  MOUSE,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import type { Group, Mesh } from "three";

import { InstancedWorldField } from "./InstancedWorldField";
import { MiniMap } from "./MiniMap";
import type {
  GameSessionState,
  RenderPerformanceSnapshot,
  WorldChunkState,
  WorldPlayerState,
} from "../../types/game";

const WORLD_TO_SCENE_SCALE = 1.35;
const TARGET_REACHED_DISTANCE = 0.22;
const BEE_HEIGHT = 0.48;
const RENDER_CORRECTION_DISTANCE = WORLD_TO_SCENE_SCALE * 0.9;
const SKY_COLOR = "#dff4ff";
const FOG_COLOR = "#cddfb1";
const FOG_NEAR = 34;
const FOG_FAR = 92;
const GROUND_HEIGHT = -1.15;
const GROUND_INPUT_SIZE = 520;
const DEFAULT_CAMERA_POSITION = [14, 10.5, 15.5] as const;
const DEFAULT_CAMERA_FOV = 50;

const beeBodyGeometry = new SphereGeometry(0.62, 32, 32);
const beeStripeGeometry = new BoxGeometry(0.12, 0.9, 1.18);
const beeHeadGeometry = new SphereGeometry(0.28, 24, 24);
const beeWingGeometry = new SphereGeometry(0.26, 24, 24);
const localMarkerGeometry = new RingGeometry(0.78, 1.04, 40);
const moveTargetRingGeometry = new RingGeometry(0.22, 0.38, 36);
const moveTargetCoreGeometry = new CircleGeometry(0.1, 24);
const disconnectedBeaconGeometry = new IcosahedronGeometry(0.38, 0);

const localMarkerMaterial = new MeshBasicMaterial({
  color: "#fff1a8",
  opacity: 0.92,
  side: DoubleSide,
  transparent: true,
});
const beeStripeMaterial = new MeshStandardMaterial({ color: "#23150d", roughness: 0.84 });
const beeWingMaterial = new MeshStandardMaterial({
  color: "#d9f3ff",
  opacity: 0.74,
  roughness: 0.18,
  transparent: true,
});
const moveTargetRingMaterial = new MeshBasicMaterial({
  color: "#fff7bb",
  opacity: 0.95,
  side: DoubleSide,
  transparent: true,
});
const moveTargetCoreMaterial = new MeshBasicMaterial({
  color: "#ffcb4c",
  opacity: 0.92,
  transparent: true,
});
const disconnectedBeaconMaterial = new MeshStandardMaterial({
  color: "#b24a32",
  emissive: "#ff6b3d",
  emissiveIntensity: 0.8,
});

const beeBodyMaterialCache = new Map<string, MeshStandardMaterial>();

function getBeeBodyMaterial(accentColor: string, isLocal: boolean): MeshStandardMaterial {
  const cacheKey = `${accentColor}:${isLocal ? "local" : "remote"}`;
  const cached = beeBodyMaterialCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const material = new MeshStandardMaterial({
    color: accentColor,
    emissive: isLocal ? "#ffd15c" : "#000000",
    emissiveIntensity: isLocal ? 0.38 : 0,
    metalness: 0.05,
    roughness: 0.72,
  });

  beeBodyMaterialCache.set(cacheKey, material);
  return material;
}

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

interface RemoteBeeInstance {
  player: WorldPlayerState;
  currentPosition: Vector3;
  authoritativePosition: Vector3;
  desiredTargetPosition: Vector3;
  rotationY: number;
  drift: number;
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
  const beeBodyMaterial = useMemo(() => getBeeBodyMaterial(accentColor, isLocal), [accentColor, isLocal]);

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
          <primitive attach="geometry" object={localMarkerGeometry} />
          <primitive attach="material" object={localMarkerMaterial} />
        </mesh>
      ) : null}

      <mesh castShadow geometry={beeBodyGeometry} material={beeBodyMaterial} />

      <mesh castShadow geometry={beeStripeGeometry} material={beeStripeMaterial} position={[-0.35, 0, 0]} />

      <mesh castShadow geometry={beeStripeGeometry} material={beeStripeMaterial} position={[0, 0, 0]} />

      <mesh castShadow geometry={beeStripeGeometry} material={beeStripeMaterial} position={[0.35, 0, 0]} />

      <mesh castShadow geometry={beeHeadGeometry} material={beeStripeMaterial} position={[0.7, 0, 0]} />

      <mesh
        ref={leftWingRef}
        geometry={beeWingGeometry}
        material={beeWingMaterial}
        position={[-0.08, 0.44, -0.3]}
        rotation={[0.2, 0, 0.15]}
      />

      <mesh
        ref={rightWingRef}
        geometry={beeWingGeometry}
        material={beeWingMaterial}
        position={[-0.08, 0.44, 0.3]}
        rotation={[-0.2, 0, -0.15]}
      />

      <Html center distanceFactor={8} position={[0, 1.42, 0]} sprite transform>
        <div className={`bee-nameplate${isLocal ? " bee-nameplate--local" : ""}`}>
          {player.username}
        </div>
      </Html>
    </group>
  );
}

function RemoteBeeNameplates({ players }: { players: WorldPlayerState[] }) {
  return (
    <group>
      {players.map((player) => (
        <group key={`${player.id}:label`} position={[toSceneAxis(player.x), 1.9, toSceneAxis(player.y)]}>
          <Html center distanceFactor={8} sprite transform>
            <div className="bee-nameplate">{player.username}</div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function RemoteBeesInstanced({ players }: { players: WorldPlayerState[] }) {
  const bodyRef = useRef<InstancedMesh>(null);
  const stripeLeftRef = useRef<InstancedMesh>(null);
  const stripeCenterRef = useRef<InstancedMesh>(null);
  const stripeRightRef = useRef<InstancedMesh>(null);
  const headRef = useRef<InstancedMesh>(null);
  const leftWingRef = useRef<InstancedMesh>(null);
  const rightWingRef = useRef<InstancedMesh>(null);
  const bodyDummy = useMemo(() => new Object3D(), []);
  const stripeLeftDummy = useMemo(() => new Object3D(), []);
  const stripeCenterDummy = useMemo(() => new Object3D(), []);
  const stripeRightDummy = useMemo(() => new Object3D(), []);
  const headDummy = useMemo(() => new Object3D(), []);
  const leftWingDummy = useMemo(() => new Object3D(), []);
  const rightWingDummy = useMemo(() => new Object3D(), []);
  const instancesRef = useRef<RemoteBeeInstance[]>([]);
  const remoteBodyMaterial = useMemo(() => getBeeBodyMaterial("#ffd86f", false), []);

  useEffect(() => {
    const previousById = new Map(instancesRef.current.map((instance) => [instance.player.id, instance]));

    instancesRef.current = players.map((player, index) => {
      const previous = previousById.get(player.id);
      const authoritativeX = toSceneAxis(player.x);
      const authoritativeZ = toSceneAxis(player.y);
      const desiredX = hasMoveTarget(player) ? toSceneAxis(player.targetX) : authoritativeX;
      const desiredZ = hasMoveTarget(player) ? toSceneAxis(player.targetY) : authoritativeZ;

      if (previous) {
        previous.player = player;
        previous.authoritativePosition.set(authoritativeX, BEE_HEIGHT, authoritativeZ);
        previous.desiredTargetPosition.set(desiredX, BEE_HEIGHT, desiredZ);
        return previous;
      }

      return {
        player,
        currentPosition: new Vector3(authoritativeX, BEE_HEIGHT, authoritativeZ),
        authoritativePosition: new Vector3(authoritativeX, BEE_HEIGHT, authoritativeZ),
        desiredTargetPosition: new Vector3(desiredX, BEE_HEIGHT, desiredZ),
        rotationY: 0,
        drift: index * 0.9,
      };
    });
  }, [players]);

  useFrame((state, delta) => {
    const instances = instancesRef.current;
    const bodyMesh = bodyRef.current;
    const stripeLeftMesh = stripeLeftRef.current;
    const stripeCenterMesh = stripeCenterRef.current;
    const stripeRightMesh = stripeRightRef.current;
    const headMesh = headRef.current;
    const leftWingMesh = leftWingRef.current;
    const rightWingMesh = rightWingRef.current;

    if (
      !bodyMesh ||
      !stripeLeftMesh ||
      !stripeCenterMesh ||
      !stripeRightMesh ||
      !headMesh ||
      !leftWingMesh ||
      !rightWingMesh
    ) {
      return;
    }

    bodyMesh.count = instances.length;
    stripeLeftMesh.count = instances.length;
    stripeCenterMesh.count = instances.length;
    stripeRightMesh.count = instances.length;
    headMesh.count = instances.length;
    leftWingMesh.count = instances.length;
    rightWingMesh.count = instances.length;

    for (let index = 0; index < instances.length; index += 1) {
      const instance = instances[index];
      const { player, currentPosition, authoritativePosition, desiredTargetPosition } = instance;
      const time = state.clock.elapsedTime + instance.drift;
      const hoverHeight = BEE_HEIGHT + Math.sin(time * 2.4) * 0.18;
      const movementStep = Math.max(player.speed, 0.001) * WORLD_TO_SCENE_SCALE * delta;

      authoritativePosition.set(toSceneAxis(player.x), currentPosition.y, toSceneAxis(player.y));

      if (hasMoveTarget(player)) {
        desiredTargetPosition.set(toSceneAxis(player.targetX), currentPosition.y, toSceneAxis(player.targetY));

        if (currentPosition.distanceTo(authoritativePosition) > RENDER_CORRECTION_DISTANCE) {
          currentPosition.copy(authoritativePosition);
        }

        moveTowards(currentPosition, desiredTargetPosition, movementStep);
      } else {
        const correctionDistance = currentPosition.distanceTo(authoritativePosition);
        moveTowards(
          currentPosition,
          authoritativePosition,
          Math.max(movementStep, correctionDistance * 0.24),
        );
      }

      currentPosition.y = MathUtils.lerp(currentPosition.y, hoverHeight, 0.18);

      const lookTarget = hasMoveTarget(player) ? desiredTargetPosition : authoritativePosition;
      const lookDeltaX = lookTarget.x - currentPosition.x;
      const lookDeltaZ = lookTarget.z - currentPosition.z;

      if (Math.abs(lookDeltaX) > 0.001 || Math.abs(lookDeltaZ) > 0.001) {
        instance.rotationY = Math.atan2(lookDeltaX, lookDeltaZ);
      }

      bodyDummy.position.copy(currentPosition);
      bodyDummy.rotation.set(0, instance.rotationY, 0);
      bodyDummy.scale.set(1, 1, 1);
      bodyDummy.updateMatrix();
      bodyMesh.setMatrixAt(index, bodyDummy.matrix);

      stripeLeftDummy.position.set(currentPosition.x - 0.35, currentPosition.y, currentPosition.z);
      stripeLeftDummy.rotation.set(0, instance.rotationY, 0);
      stripeLeftDummy.scale.set(1, 1, 1);
      stripeLeftDummy.updateMatrix();
      stripeLeftMesh.setMatrixAt(index, stripeLeftDummy.matrix);

      stripeCenterDummy.position.copy(currentPosition);
      stripeCenterDummy.rotation.set(0, instance.rotationY, 0);
      stripeCenterDummy.scale.set(1, 1, 1);
      stripeCenterDummy.updateMatrix();
      stripeCenterMesh.setMatrixAt(index, stripeCenterDummy.matrix);

      stripeRightDummy.position.set(currentPosition.x + 0.35, currentPosition.y, currentPosition.z);
      stripeRightDummy.rotation.set(0, instance.rotationY, 0);
      stripeRightDummy.scale.set(1, 1, 1);
      stripeRightDummy.updateMatrix();
      stripeRightMesh.setMatrixAt(index, stripeRightDummy.matrix);

      headDummy.position.set(currentPosition.x + 0.7, currentPosition.y, currentPosition.z);
      headDummy.rotation.set(0, instance.rotationY, 0);
      headDummy.scale.set(1, 1, 1);
      headDummy.updateMatrix();
      headMesh.setMatrixAt(index, headDummy.matrix);

      leftWingDummy.position.set(currentPosition.x - 0.08, currentPosition.y + 0.44, currentPosition.z - 0.3);
      leftWingDummy.rotation.set(0.2, instance.rotationY, 0.15 + Math.sin(time * 18) * 0.3);
      leftWingDummy.scale.set(1, 1, 1);
      leftWingDummy.updateMatrix();
      leftWingMesh.setMatrixAt(index, leftWingDummy.matrix);

      rightWingDummy.position.set(currentPosition.x - 0.08, currentPosition.y + 0.44, currentPosition.z + 0.3);
      rightWingDummy.rotation.set(-0.2, instance.rotationY, -0.15 - Math.sin(time * 18) * 0.3);
      rightWingDummy.scale.set(1, 1, 1);
      rightWingDummy.updateMatrix();
      rightWingMesh.setMatrixAt(index, rightWingDummy.matrix);
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    stripeLeftMesh.instanceMatrix.needsUpdate = true;
    stripeCenterMesh.instanceMatrix.needsUpdate = true;
    stripeRightMesh.instanceMatrix.needsUpdate = true;
    headMesh.instanceMatrix.needsUpdate = true;
    leftWingMesh.instanceMatrix.needsUpdate = true;
    rightWingMesh.instanceMatrix.needsUpdate = true;
  });

  if (players.length === 0) {
    return null;
  }

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[beeBodyGeometry, remoteBodyMaterial, players.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={stripeLeftRef} args={[beeStripeGeometry, beeStripeMaterial, players.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={stripeCenterRef} args={[beeStripeGeometry, beeStripeMaterial, players.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={stripeRightRef} args={[beeStripeGeometry, beeStripeMaterial, players.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={headRef} args={[beeHeadGeometry, beeStripeMaterial, players.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={leftWingRef} args={[beeWingGeometry, beeWingMaterial, players.length]} frustumCulled={false} />
      <instancedMesh ref={rightWingRef} args={[beeWingGeometry, beeWingMaterial, players.length]} frustumCulled={false} />
      <RemoteBeeNameplates players={players} />
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
        <primitive attach="geometry" object={moveTargetRingGeometry} />
        <primitive attach="material" object={moveTargetRingMaterial} />
      </mesh>

      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive attach="geometry" object={moveTargetCoreGeometry} />
        <primitive attach="material" object={moveTargetCoreMaterial} />
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
      maxDistance={78}
      maxPolarAngle={Math.PI / 2.1}
      minDistance={6}
      minPolarAngle={0.45}
      zoomSpeed={1.35}
      mouseButtons={{
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.ROTATE,
      }}
      target={[0, 0.42, 0]}
    />
  );
}

function RendererMetricsReporter({ onChange }: { onChange: (snapshot: RenderPerformanceSnapshot) => void }) {
  const { gl } = useThree();
  const lastSnapshotRef = useRef<RenderPerformanceSnapshot | null>(null);

  useEffect(() => {
    let animationFrameId = 0;
    let lastSampleAt = performance.now();
    let frameCount = 0;

    const sample = (now: number) => {
      frameCount += 1;

      const elapsed = now - lastSampleAt;
      if (elapsed >= 500) {
        const nextSnapshot: RenderPerformanceSnapshot = {
          fps: Math.round((frameCount * 1000) / elapsed),
          drawCalls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
        };

        const previousSnapshot = lastSnapshotRef.current;
        if (
          !previousSnapshot ||
          previousSnapshot.fps !== nextSnapshot.fps ||
          previousSnapshot.drawCalls !== nextSnapshot.drawCalls ||
          previousSnapshot.triangles !== nextSnapshot.triangles ||
          previousSnapshot.geometries !== nextSnapshot.geometries ||
          previousSnapshot.textures !== nextSnapshot.textures
        ) {
          lastSnapshotRef.current = nextSnapshot;
          onChange(nextSnapshot);
        }

        frameCount = 0;
        lastSampleAt = now;
      }

      animationFrameId = window.requestAnimationFrame(sample);
    };

    animationFrameId = window.requestAnimationFrame(sample);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [gl, onChange]);

  return null;
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
      <planeGeometry args={[GROUND_INPUT_SIZE, GROUND_INPUT_SIZE]} />
      <meshBasicMaterial opacity={0} side={DoubleSide} transparent />
    </mesh>
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
  const remotePlayers = useMemo(
    () => players.filter((player) => player.id !== localPlayerId),
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
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />
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
      <Suspense fallback={null}>
        <InstancedWorldField
          chunkSize={chunkSize}
          chunks={chunks}
          onTerrainPointerDown={handleGroundPointerDown}
        />
      </Suspense>

      {moveTargetMarker ? <MoveTargetMarker target={moveTargetMarker} /> : null}

      {localPlayer ? (
        <BeeActor
          accentColor="#f8c537"
          drift={0}
          isLocal
          player={localPlayer}
          trackedPositionRef={localPlayerPositionRef}
        />
      ) : null}

      <RemoteBeesInstanced players={remotePlayers} />

      {connectionState === "disconnected" ? (
        <mesh
          geometry={disconnectedBeaconGeometry}
          material={disconnectedBeaconMaterial}
          position={[localPlayer ? toSceneAxis(localPlayer.x) : 0, 2.1, localPlayer ? toSceneAxis(localPlayer.y) : 0]}
        />
      ) : null}
    </group>
  );
}

interface GameViewportProps {
  players: WorldPlayerState[];
  chunks: WorldChunkState[];
  chunkSize: number;
  renderDistance: number;
  connectionState: GameSessionState["connectionState"];
  localPlayerId?: string;
  onPerformanceChange: (snapshot: RenderPerformanceSnapshot) => void;
  onMoveToTarget: (x: number, z: number) => void;
}

function toChunkCoord(worldPos: number, chunkSize: number): number {
  return Math.floor(worldPos / chunkSize);
}

export function GameViewport({
  players,
  chunks,
  chunkSize,
  renderDistance,
  connectionState,
  localPlayerId,
  onPerformanceChange,
  onMoveToTarget,
}: GameViewportProps) {
  const localPlayer = useMemo(
    () => players.find((player) => player.id === localPlayerId),
    [localPlayerId, players],
  );
  const localPlayerPositionRef = useRef(new Vector3(Number.NaN, Number.NaN, Number.NaN));

  // Jogadores visíveis no 3D — mesma lógica de chunk do servidor
  const nearbyPlayers = useMemo(() => {
    if (!localPlayer || chunkSize <= 0) return players;
    const centerChunkX = toChunkCoord(localPlayer.x, chunkSize);
    const centerChunkY = toChunkCoord(localPlayer.y, chunkSize);
    return players.filter((player) => {
      const px = toChunkCoord(player.x, chunkSize);
      const py = toChunkCoord(player.y, chunkSize);
      return Math.abs(centerChunkX - px) <= renderDistance && Math.abs(centerChunkY - py) <= renderDistance;
    });
  }, [players, localPlayer, chunkSize, renderDistance]);

  return (
    <div className="viewport-canvas-shell">
      <Canvas
        camera={{ position: DEFAULT_CAMERA_POSITION, fov: DEFAULT_CAMERA_FOV }}
        dpr={[1, 1.6]}
        shadows
        gl={{ antialias: true }}
      >
        <color attach="background" args={[SKY_COLOR]} />
        <RendererMetricsReporter onChange={onPerformanceChange} />
        <CameraRig focusPlayer={localPlayer} trackedPositionRef={localPlayerPositionRef} />
        <HiveCore
          chunks={chunks}
          chunkSize={chunkSize}
          connectionState={connectionState}
          localPlayerId={localPlayerId}
          localPlayerPositionRef={localPlayerPositionRef}
          onMoveToTarget={onMoveToTarget}
          players={nearbyPlayers}
        />
      </Canvas>

      <MiniMap
        localPlayerId={localPlayerId}
        players={players}
        onPlayerClick={onMoveToTarget}
      />
    </div>
  );
}
