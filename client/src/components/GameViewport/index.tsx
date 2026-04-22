import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Suspense, type ElementRef, type MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
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
import { AtmosphereBackdrop } from "./AtmosphereBackdrop";
import { MiniMap } from "./MiniMap";
import { type TapTargetingConfig, type TapTargetingHandlers, useTapTargeting } from "./useTapTargeting";
import type {
  FlowerInteractionState,
  GameSessionState,
  HiveInteractionState,
  RenderPerformanceSnapshot,
  WorldChunkState,
  WorldFlowerState,
  WorldHiveState,
  WorldPlayerState,
} from "../../types/game";
import { usePlayerControls } from "../../hooks/usePlayerControls";
import {
  buildWorldSurfaceIndex,
  GROUND_HEIGHT,
  resolveBeeSceneHeight,
  resolveTargetMarkerSceneY,
  toSceneAxis,
  toWorldAxis,
  WORLD_TO_SCENE_SCALE,
  type WorldSurfaceIndex,
} from "./worldSurface";

const TARGET_REACHED_DISTANCE = 0.22;
const RENDER_CORRECTION_DISTANCE = WORLD_TO_SCENE_SCALE * 0.9;
const SKY_COLOR = "#eff8ff";
const FOG_COLOR = "#d8eaf4";
const DEFAULT_CAMERA_FOV = 56;
const MIN_CAMERA_DISTANCE = 7.5;
const MIN_MAX_CAMERA_DISTANCE = 30;
const MAX_CAMERA_DISTANCE_PADDING = 10;
const SCENE_EDGE_CAMERA_DISTANCE_RATIO = 0.44;
const FOG_NEAR_RATIO = 0.62;
const FOG_FAR_PADDING = 4;
const CAMERA_ROTATE_SPEED = 0.82;
const CAMERA_ZOOM_SPEED = 0.9;
const BEE_TURN_RESPONSE = 18;
const KEYBOARD_MOVE_SEND_INTERVAL_MS = 100;
const KEYBOARD_MOVE_LOOKAHEAD_SECONDS = 0.18;
const KEYBOARD_MOVE_MIN_LOOKAHEAD_DISTANCE = 0.48;
const LOCAL_PLAYER_ROTATION_STOP_DISTANCE = 0.14;
const MOVEMENT_VECTOR_EPSILON = 0.0001;
// Important: the black rear piece is the stinger, not the head.
// The bee visually faces local -X, so movement yaw must treat local +X as the tail.
const BEE_IDLE_YAW = -Math.PI / 2;
const BEE_MOVEMENT_YAW_OFFSET = Math.PI / 2;

const beeBodyGeometry = new SphereGeometry(0.62, 32, 32);
const beeStripeGeometry = new BoxGeometry(0.12, 0.9, 1.18);
const beeStingerGeometry = new ConeGeometry(0.18, 0.46, 20);
const beeWingGeometry = new SphereGeometry(0.26, 24, 24);
const localMarkerGeometry = new RingGeometry(0.78, 1.04, 40);
const moveTargetRingGeometry = new RingGeometry(0.22, 0.38, 36);
const moveTargetCoreGeometry = new CircleGeometry(0.1, 24);
const flowerTargetRingGeometry = new RingGeometry(0.3, 0.5, 42);
const flowerTargetCoreGeometry = new CircleGeometry(0.12, 24);
const disconnectedBeaconGeometry = new IcosahedronGeometry(0.38, 0);

beeStingerGeometry.rotateZ(-Math.PI / 2);

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
  depthTest: false,
  depthWrite: false,
  opacity: 0.95,
  side: DoubleSide,
  transparent: true,
});
const moveTargetCoreMaterial = new MeshBasicMaterial({
  color: "#ffcb4c",
  depthTest: false,
  depthWrite: false,
  opacity: 0.92,
  transparent: true,
});
const flowerTargetRingMaterial = new MeshBasicMaterial({
  color: "#f6ff94",
  depthTest: false,
  depthWrite: false,
  opacity: 0.84,
  side: DoubleSide,
  transparent: true,
});
const flowerTargetCoreMaterial = new MeshBasicMaterial({
  color: "#7df9cf",
  depthTest: false,
  depthWrite: false,
  opacity: 0.9,
  transparent: true,
});
const disconnectedBeaconMaterial = new MeshStandardMaterial({
  color: "#b24a32",
  emissive: "#ff6b3d",
  emissiveIntensity: 0.8,
});

const BEE_LEFT_STRIPE_OFFSET = new Vector3(-0.35, 0, 0);
const BEE_RIGHT_STRIPE_OFFSET = new Vector3(0.35, 0, 0);
const BEE_STINGER_OFFSET = new Vector3(0.84, 0, 0);
const BEE_LEFT_WING_OFFSET = new Vector3(-0.08, 0.44, -0.3);
const BEE_RIGHT_WING_OFFSET = new Vector3(-0.08, 0.44, 0.3);

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
  sceneY: number;
  sceneZ: number;
}

type LocalMovementSource = "idle" | "keyboard" | "pointer";

function resolveViewportScale(chunkSize: number, renderDistance: number): {
  cameraDistance: number;
  groundInputSize: number;
  maxCameraDistance: number;
} {
  if (chunkSize <= 0 || renderDistance <= 0) {
    return {
      cameraDistance: 18,
      groundInputSize: 960,
      maxCameraDistance: MIN_MAX_CAMERA_DISTANCE,
    };
  }

  const chunkSpan = chunkSize * (renderDistance * 2 + 1);
  const sceneSpan = toSceneAxis(chunkSpan);
  const cameraDistance = Math.max(18, sceneSpan * 0.3);

  return {
    cameraDistance,
    groundInputSize: Math.max(960, sceneSpan * 3),
    maxCameraDistance: Math.max(
      MIN_MAX_CAMERA_DISTANCE,
      Math.max(cameraDistance + MAX_CAMERA_DISTANCE_PADDING, sceneSpan * SCENE_EDGE_CAMERA_DISTANCE_RATIO),
    ),
  };
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

function resolveFogDistances(maxCameraDistance: number): { near: number; far: number } {
  return {
    near: Math.max(14, maxCameraDistance * FOG_NEAR_RATIO),
    far: maxCameraDistance + FOG_FAR_PADDING,
  };
}

function resolveTargetYaw(deltaX: number, deltaZ: number): number | null {
  if (Math.abs(deltaX) <= 0.001 && Math.abs(deltaZ) <= 0.001) {
    return null;
  }

  return Math.atan2(deltaX, deltaZ) + BEE_MOVEMENT_YAW_OFFSET;
}

function smoothYawRotation(currentYaw: number, targetYaw: number, delta: number): number {
  const shortestArc = Math.atan2(Math.sin(targetYaw - currentYaw), Math.cos(targetYaw - currentYaw));
  return currentYaw + shortestArc * (1 - Math.exp(-delta * BEE_TURN_RESPONSE));
}

function applyBeePartTransform(
  dummy: Object3D,
  anchorPosition: Vector3,
  localOffset: Vector3,
  rotationY: number,
  rotationX = 0,
  rotationZ = 0,
): void {
  const sinYaw = Math.sin(rotationY);
  const cosYaw = Math.cos(rotationY);

  dummy.position.set(
    anchorPosition.x + localOffset.x * cosYaw + localOffset.z * sinYaw,
    anchorPosition.y + localOffset.y,
    anchorPosition.z - localOffset.x * sinYaw + localOffset.z * cosYaw,
  );
  dummy.rotation.set(rotationX, rotationY, rotationZ);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
}

interface BeeActorProps {
  player: WorldPlayerState;
  drift: number;
  accentColor: string;
  isLocal: boolean;
  localMovementSourceRef?: MutableRefObject<LocalMovementSource>;
  inputPreviewTargetRef?: MutableRefObject<Vector3 | null>;
  surfaceIndex: WorldSurfaceIndex;
  trackedPositionRef?: MutableRefObject<Vector3>;
  isCollecting?: boolean;
}

interface RemoteBeeInstance {
  player: WorldPlayerState;
  currentPosition: Vector3;
  authoritativePosition: Vector3;
  desiredTargetPosition: Vector3;
  rotationY: number;
  drift: number;
}

function BeeActor({
  player,
  drift,
  accentColor,
  isLocal,
  localMovementSourceRef,
  inputPreviewTargetRef,
  surfaceIndex,
  trackedPositionRef,
  isCollecting = false,
}: BeeActorProps) {
  const groupRef = useRef<Group>(null);
  const leftWingRef = useRef<Mesh>(null);
  const rightWingRef = useRef<Mesh>(null);
  const authoritativePositionRef = useRef(new Vector3());
  const desiredTargetPositionRef = useRef(new Vector3());
  const initialPosition = useMemo(
    () => [toSceneAxis(player.x), resolveBeeSceneHeight(surfaceIndex, player.x, player.y, 0, drift), toSceneAxis(player.y)] as const,
    [drift, player.id, player.x, player.y, surfaceIndex],
  );
  const beeBodyMaterial = useMemo(() => getBeeBodyMaterial(accentColor, isLocal), [accentColor, isLocal]);

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.position.set(
      toSceneAxis(player.x),
      resolveBeeSceneHeight(surfaceIndex, player.x, player.y, 0, drift),
      toSceneAxis(player.y),
    );
    trackedPositionRef?.current.copy(groupRef.current.position);
  }, [drift, player.id, player.x, player.y, surfaceIndex, trackedPositionRef]);

  useFrame((state, delta) => {
    if (!groupRef.current || !leftWingRef.current || !rightWingRef.current) {
      return;
    }

    const elapsedTime = state.clock.elapsedTime;
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

    const nextFlightHeight = resolveBeeSceneHeight(
      surfaceIndex,
      toWorldAxis(currentPosition.x),
      toWorldAxis(currentPosition.z),
      elapsedTime,
      drift,
    );
    currentPosition.y =
      currentPosition.y < nextFlightHeight
        ? nextFlightHeight
        : MathUtils.lerp(currentPosition.y, nextFlightHeight, 0.18);

    groupRef.current.scale.setScalar(isCollecting ? 1 + Math.sin((elapsedTime + drift) * 10) * 0.035 : 1);

    const inputPreviewTarget = inputPreviewTargetRef?.current ?? null;
    const hasInputPreviewTarget = inputPreviewTarget !== null;
    const localMovementSource = localMovementSourceRef?.current ?? "idle";
    const lookTarget = hasInputPreviewTarget
      ? inputPreviewTarget
      : isLocal && localMovementSource !== "pointer"
        ? null
      : hasMoveTarget(player)
        ? desiredTargetPositionRef.current
        : authoritativePositionRef.current;
    if (lookTarget === null) {
      trackedPositionRef?.current.copy(groupRef.current.position);
      leftWingRef.current.rotation.z = Math.sin((elapsedTime + drift) * 18) * 0.3;
      rightWingRef.current.rotation.z = -Math.sin((elapsedTime + drift) * 18) * 0.3;
      return;
    }

    const lookDeltaX = lookTarget.x - currentPosition.x;
    const lookDeltaZ = lookTarget.z - currentPosition.z;
    const shouldFreezeLocalYaw =
      isLocal &&
      !hasInputPreviewTarget &&
      (!hasMoveTarget(player) || currentPosition.distanceTo(desiredTargetPositionRef.current) <= LOCAL_PLAYER_ROTATION_STOP_DISTANCE);
    const targetYaw = shouldFreezeLocalYaw ? null : resolveTargetYaw(lookDeltaX, lookDeltaZ);

    if (targetYaw !== null) {
      groupRef.current.rotation.y = smoothYawRotation(groupRef.current.rotation.y, targetYaw, delta);
    }

    trackedPositionRef?.current.copy(groupRef.current.position);
    leftWingRef.current.rotation.z = Math.sin((elapsedTime + drift) * 18) * 0.3;
    rightWingRef.current.rotation.z = -Math.sin((elapsedTime + drift) * 18) * 0.3;
  });

  return (
    <group ref={groupRef} position={initialPosition} rotation={[0, BEE_IDLE_YAW, 0]}>
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

      <mesh castShadow geometry={beeStingerGeometry} material={beeStripeMaterial} position={[0.84, 0, 0]} />

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

function RemoteBeeNameplates({ players, surfaceIndex }: { players: WorldPlayerState[]; surfaceIndex: WorldSurfaceIndex }) {
  return (
    <group>
      {players.map((player, index) => (
        <group
          key={`${player.id}:label`}
          position={[
            toSceneAxis(player.x),
            resolveBeeSceneHeight(surfaceIndex, player.x, player.y, 0, index * 0.9) + 1.42,
            toSceneAxis(player.y),
          ]}
        >
          <Html center distanceFactor={8} sprite transform>
            <div className="bee-nameplate">{player.username}</div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function RemoteBeesInstanced({ players, surfaceIndex }: { players: WorldPlayerState[]; surfaceIndex: WorldSurfaceIndex }) {
  const bodyRef = useRef<InstancedMesh>(null);
  const stripeLeftRef = useRef<InstancedMesh>(null);
  const stripeCenterRef = useRef<InstancedMesh>(null);
  const stripeRightRef = useRef<InstancedMesh>(null);
  const stingerRef = useRef<InstancedMesh>(null);
  const leftWingRef = useRef<InstancedMesh>(null);
  const rightWingRef = useRef<InstancedMesh>(null);
  const bodyDummy = useMemo(() => new Object3D(), []);
  const stripeLeftDummy = useMemo(() => new Object3D(), []);
  const stripeCenterDummy = useMemo(() => new Object3D(), []);
  const stripeRightDummy = useMemo(() => new Object3D(), []);
  const stingerDummy = useMemo(() => new Object3D(), []);
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
      const initialYaw = resolveTargetYaw(desiredX - authoritativeX, desiredZ - authoritativeZ) ?? BEE_IDLE_YAW;
      const initialHeight = resolveBeeSceneHeight(surfaceIndex, player.x, player.y, 0, index * 0.9);

      if (previous) {
        previous.player = player;
        previous.authoritativePosition.set(authoritativeX, initialHeight, authoritativeZ);
        previous.desiredTargetPosition.set(desiredX, initialHeight, desiredZ);
        return previous;
      }

      return {
        player,
        currentPosition: new Vector3(authoritativeX, initialHeight, authoritativeZ),
        authoritativePosition: new Vector3(authoritativeX, initialHeight, authoritativeZ),
        desiredTargetPosition: new Vector3(desiredX, initialHeight, desiredZ),
        rotationY: initialYaw,
        drift: index * 0.9,
      };
    });
  }, [players, surfaceIndex]);

  useFrame((state, delta) => {
    const instances = instancesRef.current;
    const bodyMesh = bodyRef.current;
    const stripeLeftMesh = stripeLeftRef.current;
    const stripeCenterMesh = stripeCenterRef.current;
    const stripeRightMesh = stripeRightRef.current;
    const stingerMesh = stingerRef.current;
    const leftWingMesh = leftWingRef.current;
    const rightWingMesh = rightWingRef.current;

    if (
      !bodyMesh ||
      !stripeLeftMesh ||
      !stripeCenterMesh ||
      !stripeRightMesh ||
      !stingerMesh ||
      !leftWingMesh ||
      !rightWingMesh
    ) {
      return;
    }

    bodyMesh.count = instances.length;
    stripeLeftMesh.count = instances.length;
    stripeCenterMesh.count = instances.length;
    stripeRightMesh.count = instances.length;
    stingerMesh.count = instances.length;
    leftWingMesh.count = instances.length;
    rightWingMesh.count = instances.length;

    for (let index = 0; index < instances.length; index += 1) {
      const instance = instances[index];
      const { player, currentPosition, authoritativePosition, desiredTargetPosition } = instance;
      const time = state.clock.elapsedTime + instance.drift;
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

      const nextFlightHeight = resolveBeeSceneHeight(
        surfaceIndex,
        toWorldAxis(currentPosition.x),
        toWorldAxis(currentPosition.z),
        state.clock.elapsedTime,
        instance.drift,
      );
      currentPosition.y =
        currentPosition.y < nextFlightHeight
          ? nextFlightHeight
          : MathUtils.lerp(currentPosition.y, nextFlightHeight, 0.18);

      const lookTarget = hasMoveTarget(player) ? desiredTargetPosition : authoritativePosition;
      const lookDeltaX = lookTarget.x - currentPosition.x;
      const lookDeltaZ = lookTarget.z - currentPosition.z;
      const targetYaw = resolveTargetYaw(lookDeltaX, lookDeltaZ);

      if (targetYaw !== null) {
        instance.rotationY = smoothYawRotation(instance.rotationY, targetYaw, delta);
      }

      bodyDummy.position.copy(currentPosition);
      bodyDummy.rotation.set(0, instance.rotationY, 0);
      bodyDummy.scale.set(1, 1, 1);
      bodyDummy.updateMatrix();
      bodyMesh.setMatrixAt(index, bodyDummy.matrix);

      applyBeePartTransform(stripeLeftDummy, currentPosition, BEE_LEFT_STRIPE_OFFSET, instance.rotationY);
      stripeLeftMesh.setMatrixAt(index, stripeLeftDummy.matrix);

      stripeCenterDummy.position.copy(currentPosition);
      stripeCenterDummy.rotation.set(0, instance.rotationY, 0);
      stripeCenterDummy.scale.set(1, 1, 1);
      stripeCenterDummy.updateMatrix();
      stripeCenterMesh.setMatrixAt(index, stripeCenterDummy.matrix);

      applyBeePartTransform(stripeRightDummy, currentPosition, BEE_RIGHT_STRIPE_OFFSET, instance.rotationY);
      stripeRightMesh.setMatrixAt(index, stripeRightDummy.matrix);

      applyBeePartTransform(stingerDummy, currentPosition, BEE_STINGER_OFFSET, instance.rotationY);
      stingerMesh.setMatrixAt(index, stingerDummy.matrix);

      applyBeePartTransform(
        leftWingDummy,
        currentPosition,
        BEE_LEFT_WING_OFFSET,
        instance.rotationY,
        0.2,
        0.15 + Math.sin(time * 18) * 0.3,
      );
      leftWingMesh.setMatrixAt(index, leftWingDummy.matrix);

      applyBeePartTransform(
        rightWingDummy,
        currentPosition,
        BEE_RIGHT_WING_OFFSET,
        instance.rotationY,
        -0.2,
        -0.15 - Math.sin(time * 18) * 0.3,
      );
      rightWingMesh.setMatrixAt(index, rightWingDummy.matrix);
    }

    bodyMesh.instanceMatrix.needsUpdate = true;
    stripeLeftMesh.instanceMatrix.needsUpdate = true;
    stripeCenterMesh.instanceMatrix.needsUpdate = true;
    stripeRightMesh.instanceMatrix.needsUpdate = true;
    stingerMesh.instanceMatrix.needsUpdate = true;
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
      <instancedMesh ref={stingerRef} args={[beeStingerGeometry, beeStripeMaterial, players.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={leftWingRef} args={[beeWingGeometry, beeWingMaterial, players.length]} frustumCulled={false} />
      <instancedMesh ref={rightWingRef} args={[beeWingGeometry, beeWingMaterial, players.length]} frustumCulled={false} />
      <RemoteBeeNameplates players={players} surfaceIndex={surfaceIndex} />
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
    markerRef.current.position.y = target.sceneY + Math.sin(state.clock.elapsedTime * 3.4) * 0.08;
  });

  return (
    <group ref={markerRef} position={[target.sceneX, target.sceneY, target.sceneZ]} renderOrder={30}>
      <mesh renderOrder={30} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive attach="geometry" object={moveTargetRingGeometry} />
        <primitive attach="material" object={moveTargetRingMaterial} />
      </mesh>

      <mesh position={[0, 0.04, 0]} renderOrder={31} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive attach="geometry" object={moveTargetCoreGeometry} />
        <primitive attach="material" object={moveTargetCoreMaterial} />
      </mesh>
    </group>
  );
}

function FlowerTargetMarker({
  flower,
  surfaceIndex,
}: {
  flower: FlowerInteractionState;
  surfaceIndex: WorldSurfaceIndex;
}) {
  const markerRef = useRef<Group>(null);
  const sceneX = toSceneAxis(flower.flowerX);
  const sceneZ = toSceneAxis(flower.flowerY);
  const sceneY = resolveTargetMarkerSceneY(surfaceIndex, flower.flowerX, flower.flowerY);

  useFrame((state) => {
    if (!markerRef.current) {
      return;
    }

    const pulse = flower.phase === "collecting" ? 1.15 : 1;
    markerRef.current.rotation.y = state.clock.elapsedTime * (flower.phase === "collecting" ? 2.6 : 1.5);
    markerRef.current.position.y = sceneY + 0.04 + Math.sin(state.clock.elapsedTime * (flower.phase === "collecting" ? 4.8 : 3.2)) * 0.06;
    markerRef.current.scale.setScalar(pulse + Math.sin(state.clock.elapsedTime * 5) * 0.04);
  });

  return (
    <group ref={markerRef} position={[sceneX, sceneY, sceneZ]} renderOrder={32}>
      <mesh renderOrder={32} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive attach="geometry" object={flowerTargetRingGeometry} />
        <primitive attach="material" object={flowerTargetRingMaterial} />
      </mesh>

      <mesh position={[0, 0.03, 0]} renderOrder={33} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive attach="geometry" object={flowerTargetCoreGeometry} />
        <primitive attach="material" object={flowerTargetCoreMaterial} />
      </mesh>
    </group>
  );
}

function HiveTargetMarker({
  hive,
  surfaceIndex,
}: {
  hive: HiveInteractionState;
  surfaceIndex: WorldSurfaceIndex;
}) {
  const markerRef = useRef<Group>(null);
  const sceneX = toSceneAxis(hive.hiveX);
  const sceneZ = toSceneAxis(hive.hiveY);
  const sceneY = resolveTargetMarkerSceneY(surfaceIndex, hive.hiveX, hive.hiveY);

  useFrame((state) => {
    if (!markerRef.current) {
      return;
    }

    markerRef.current.rotation.y = state.clock.elapsedTime * 1.35;
    markerRef.current.position.y = sceneY + 0.05 + Math.sin(state.clock.elapsedTime * 2.7) * 0.05;
  });

  return (
    <group ref={markerRef} position={[sceneX, sceneY, sceneZ]} renderOrder={31}>
      <mesh renderOrder={31} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive attach="geometry" object={flowerTargetRingGeometry} />
        <meshBasicMaterial color="#ffe59f" depthTest={false} depthWrite={false} opacity={0.82} side={DoubleSide} transparent />
      </mesh>
    </group>
  );
}

function collectVisibleHives(chunks: WorldChunkState[]): WorldHiveState[] {
  const hives: WorldHiveState[] = [];

  for (const chunk of chunks) {
    for (const hive of chunk.hives) {
      hives.push(hive);
    }
  }

  return hives;
}

function LocalPlayerMovementController({
  connectionState,
  inputPreviewTargetRef,
  localPlayer,
  localMovementSourceRef,
  onMoveToTarget,
  trackedPositionRef,
}: {
  connectionState: GameSessionState["connectionState"];
  inputPreviewTargetRef: MutableRefObject<Vector3 | null>;
  localPlayer?: WorldPlayerState;
  localMovementSourceRef: MutableRefObject<LocalMovementSource>;
  onMoveToTarget: (x: number, z: number) => void;
  trackedPositionRef: MutableRefObject<Vector3>;
}) {
  const { camera } = useThree();
  const { backward, forward, left, right } = usePlayerControls();
  const frontVector = useMemo(() => new Vector3(), []);
  const sideVector = useMemo(() => new Vector3(), []);
  const movementVector = useMemo(() => new Vector3(), []);
  const upVector = useMemo(() => new Vector3(0, 1, 0), []);
  const lastTargetRef = useRef(new Vector3(Number.NaN, 0, Number.NaN));
  const lastSentAtRef = useRef(Number.NEGATIVE_INFINITY);
  const wasMovingRef = useRef(false);

  useEffect(() => {
    if (connectionState === "connected" && localPlayer) {
      return;
    }

    inputPreviewTargetRef.current = null;
    localMovementSourceRef.current = "idle";
    lastSentAtRef.current = Number.NEGATIVE_INFINITY;
    lastTargetRef.current.set(Number.NaN, 0, Number.NaN);
    wasMovingRef.current = false;
  }, [connectionState, inputPreviewTargetRef, localMovementSourceRef, localPlayer]);

  useFrame((state) => {
    if (connectionState !== "connected" || !localPlayer) {
      return;
    }

    const zIntent = Number(forward) - Number(backward);
    const xIntent = Number(right) - Number(left);
    const anchorSceneX = Number.isFinite(trackedPositionRef.current.x)
      ? trackedPositionRef.current.x
      : toSceneAxis(localPlayer.x);
    const anchorSceneZ = Number.isFinite(trackedPositionRef.current.z)
      ? trackedPositionRef.current.z
      : toSceneAxis(localPlayer.y);
    const anchorWorldX = toWorldAxis(anchorSceneX);
    const anchorWorldZ = toWorldAxis(anchorSceneZ);
    const nowMs = state.clock.elapsedTime * 1000;

    if (xIntent === 0 && zIntent === 0) {
      if (localMovementSourceRef.current === "keyboard") {
        inputPreviewTargetRef.current = null;
        localMovementSourceRef.current = "idle";
      }

      if (wasMovingRef.current) {
        onMoveToTarget(anchorWorldX, anchorWorldZ);
        lastSentAtRef.current = nowMs;
        lastTargetRef.current.set(anchorWorldX, 0, anchorWorldZ);
      }

      wasMovingRef.current = false;
      return;
    }

    camera.getWorldDirection(frontVector);
    frontVector.y = 0;

    if (frontVector.lengthSq() <= MOVEMENT_VECTOR_EPSILON) {
      frontVector.set(0, 0, -1);
    } else {
      frontVector.normalize();
    }

    sideVector.copy(frontVector).cross(upVector).normalize();
    movementVector.set(0, 0, 0);
    movementVector.addScaledVector(frontVector, zIntent);
    movementVector.addScaledVector(sideVector, xIntent);

    if (movementVector.lengthSq() <= MOVEMENT_VECTOR_EPSILON) {
      return;
    }

    movementVector.normalize();
    localMovementSourceRef.current = "keyboard";

    const previewDistance = Math.max(
      localPlayer.speed * KEYBOARD_MOVE_LOOKAHEAD_SECONDS,
      KEYBOARD_MOVE_MIN_LOOKAHEAD_DISTANCE,
    );
    inputPreviewTargetRef.current = new Vector3(
      anchorSceneX + movementVector.x * toSceneAxis(previewDistance),
      0,
      anchorSceneZ + movementVector.z * toSceneAxis(previewDistance),
    );

    const shouldSendTarget =
      !wasMovingRef.current ||
      nowMs - lastSentAtRef.current >= KEYBOARD_MOVE_SEND_INTERVAL_MS;

    if (!shouldSendTarget) {
      wasMovingRef.current = true;
      return;
    }

    const targetWorldX = anchorWorldX + movementVector.x * previewDistance;
    const targetWorldZ = anchorWorldZ + movementVector.z * previewDistance;

    if (
      Math.abs(lastTargetRef.current.x - targetWorldX) <= MOVEMENT_VECTOR_EPSILON &&
      Math.abs(lastTargetRef.current.z - targetWorldZ) <= MOVEMENT_VECTOR_EPSILON
    ) {
      wasMovingRef.current = true;
      return;
    }

    onMoveToTarget(targetWorldX, targetWorldZ);
    lastSentAtRef.current = nowMs;
    lastTargetRef.current.set(targetWorldX, 0, targetWorldZ);
    wasMovingRef.current = true;
  });

  return null;
}

function CameraRig({
  focusPlayer,
  trackedPositionRef,
  maxCameraDistance,
}: {
  focusPlayer?: WorldPlayerState;
  trackedPositionRef: MutableRefObject<Vector3>;
  maxCameraDistance: number;
}) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null);
  const smoothedTargetRef = useRef(new Vector3(0, 0.45, 0));
  const cameraFollowDeltaRef = useRef(new Vector3());
  const { camera, gl } = useThree();

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
    const desiredTarget = cameraFollowDeltaRef.current.set(anchor.x, 0.42, anchor.z);
    const controls = controlsRef.current;

    smoothedTargetRef.current.lerp(desiredTarget, 1 - Math.exp(-delta * 6));

    if (!controls) {
      return;
    }

    cameraFollowDeltaRef.current.subVectors(smoothedTargetRef.current, controls.target);
    camera.position.add(cameraFollowDeltaRef.current);
    controls.target.copy(smoothedTargetRef.current);
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      dampingFactor={0.08}
      enableDamping
      enablePan={false}
      keyEvents={false}
      makeDefault
      maxDistance={maxCameraDistance}
      maxPolarAngle={Math.PI / 2.2}
      minDistance={MIN_CAMERA_DISTANCE}
      minPolarAngle={0.32}
      rotateSpeed={CAMERA_ROTATE_SPEED}
      zoomSpeed={CAMERA_ZOOM_SPEED}
      zoomToCursor={false}
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
  pointerHandlers,
  size,
  trackedPositionRef,
}: {
  focusPlayer?: WorldPlayerState;
  pointerHandlers: TapTargetingHandlers;
  size: number;
  trackedPositionRef: MutableRefObject<Vector3>;
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
      onPointerCancel={pointerHandlers.onPointerCancel}
      onPointerDown={pointerHandlers.onPointerDown}
      onPointerMove={pointerHandlers.onPointerMove}
      onPointerUp={pointerHandlers.onPointerUp}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, GROUND_HEIGHT, 0]}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial opacity={0} side={DoubleSide} transparent />
    </mesh>
  );
}

interface HiveCoreProps {
  players: WorldPlayerState[];
  chunks: WorldChunkState[];
  chunkSize: number;
  connectionState: GameSessionState["connectionState"];
  flowerInteraction?: FlowerInteractionState;
  hiveInteraction?: HiveInteractionState;
  fogFar: number;
  fogNear: number;
  groundInputSize: number;
  localPlayerId?: string;
  localPlayerPositionRef: MutableRefObject<Vector3>;
  onMoveToTarget: (x: number, z: number) => void;
  onFlowerClick?: (flower: WorldFlowerState) => void;
  onHiveClick?: (hive: WorldHiveState) => void;
  tapTargetingConfig?: Partial<TapTargetingConfig>;
}

function HiveCore({
  players,
  chunks,
  chunkSize,
  connectionState,
  flowerInteraction,
  hiveInteraction,
  fogFar,
  fogNear,
  groundInputSize,
  localPlayerId,
  localPlayerPositionRef,
  onMoveToTarget,
  onFlowerClick,
  onHiveClick,
  tapTargetingConfig,
}: HiveCoreProps) {
  const [moveTargetMarker, setMoveTargetMarker] = useState<MoveTargetMarkerState | null>(null);
  const surfaceIndex = useMemo(() => buildWorldSurfaceIndex(chunks), [chunks]);
  const localMovementSourceRef = useRef<LocalMovementSource>("idle");
  const localInputPreviewTargetRef = useRef<Vector3 | null>(null);
  const canvasWidth = useThree((state) => state.size.width);
  const localPlayer = useMemo(
    () => players.find((player) => player.id === localPlayerId),
    [localPlayerId, players],
  );
  const remotePlayers = useMemo(
    () => players.filter((player) => player.id !== localPlayerId),
    [localPlayerId, players],
  );
  const detailFocus = useMemo(
    () => (localPlayer ? { x: localPlayer.x, y: localPlayer.y } : undefined),
    [localPlayer],
  );

  const handleTargetTap = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (connectionState !== "connected" || !localPlayerId) {
        return;
      }

      const worldX = toWorldAxis(event.point.x);
      const worldZ = toWorldAxis(event.point.z);

      setMoveTargetMarker({
        sceneX: toSceneAxis(worldX),
        sceneY: resolveTargetMarkerSceneY(surfaceIndex, worldX, worldZ),
        sceneZ: toSceneAxis(worldZ),
      });

      localInputPreviewTargetRef.current = new Vector3(
        toSceneAxis(worldX),
        0,
        toSceneAxis(worldZ),
      );
      localMovementSourceRef.current = "pointer";
      onMoveToTarget(worldX, worldZ);
    },
    [connectionState, localPlayerId, onMoveToTarget, surfaceIndex],
  );

  const { pointerHandlers, resetPendingTap } = useTapTargeting({
    canvasWidth,
    config: tapTargetingConfig,
    onTap: handleTargetTap,
  });

  useEffect(() => {
    if (connectionState !== "connected" || !localPlayerId) {
      setMoveTargetMarker(null);
      localInputPreviewTargetRef.current = null;
      localMovementSourceRef.current = "idle";
      localPlayerPositionRef.current.set(Number.NaN, Number.NaN, Number.NaN);
      resetPendingTap();
    }
  }, [connectionState, localPlayerId, localPlayerPositionRef, resetPendingTap]);

  useEffect(() => {
    if (!localPlayer) {
      localMovementSourceRef.current = "idle";
      return;
    }

    if (hasMoveTarget(localPlayer)) {
      setMoveTargetMarker({
        sceneX: toSceneAxis(localPlayer.targetX),
        sceneY: resolveTargetMarkerSceneY(surfaceIndex, localPlayer.targetX, localPlayer.targetY),
        sceneZ: toSceneAxis(localPlayer.targetY),
      });
      if (localMovementSourceRef.current === "pointer") {
        localInputPreviewTargetRef.current = new Vector3(
          toSceneAxis(localPlayer.targetX),
          0,
          toSceneAxis(localPlayer.targetY),
        );
      }
      return;
    }

    if (localMovementSourceRef.current === "pointer") {
      localInputPreviewTargetRef.current = null;
      localMovementSourceRef.current = "idle";
    }
    setMoveTargetMarker(null);
  }, [localPlayer, surfaceIndex]);

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

  return (
    <group>
      <AtmosphereBackdrop />
      <fog attach="fog" args={[FOG_COLOR, fogNear, fogFar]} />
      <ambientLight intensity={0.96} />
      <hemisphereLight color="#eef8ff" groundColor="#7fa38e" intensity={0.78} />
      <directionalLight
        castShadow
        color="#fffef7"
        intensity={1.48}
        position={[16, 22, 10]}
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
        pointerHandlers={pointerHandlers}
        size={groundInputSize}
        trackedPositionRef={localPlayerPositionRef}
      />
      <Suspense fallback={null}>
        <InstancedWorldField
          chunkSize={chunkSize}
          chunks={chunks}
          detailFocus={detailFocus}
          terrainPointerHandlers={pointerHandlers}
          onFlowerClick={onFlowerClick}
          selectedFlowerId={flowerInteraction?.flowerId}
          selectedHiveId={hiveInteraction?.hiveId}
          onHiveClick={onHiveClick}
        />
      </Suspense>

      {moveTargetMarker ? <MoveTargetMarker target={moveTargetMarker} /> : null}
      {flowerInteraction ? <FlowerTargetMarker flower={flowerInteraction} surfaceIndex={surfaceIndex} /> : null}
      {hiveInteraction ? <HiveTargetMarker hive={hiveInteraction} surfaceIndex={surfaceIndex} /> : null}

      <LocalPlayerMovementController
        connectionState={connectionState}
        inputPreviewTargetRef={localInputPreviewTargetRef}
        localPlayer={localPlayer}
        localMovementSourceRef={localMovementSourceRef}
        onMoveToTarget={onMoveToTarget}
        trackedPositionRef={localPlayerPositionRef}
      />

      {localPlayer ? (
        <BeeActor
          accentColor="#f8c537"
          drift={0}
          isCollecting={flowerInteraction?.phase === "collecting"}
          isLocal
          localMovementSourceRef={localMovementSourceRef}
          inputPreviewTargetRef={localInputPreviewTargetRef}
          player={localPlayer}
          surfaceIndex={surfaceIndex}
          trackedPositionRef={localPlayerPositionRef}
        />
      ) : null}

      <RemoteBeesInstanced players={remotePlayers} surfaceIndex={surfaceIndex} />

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
  flowerInteraction?: FlowerInteractionState;
  hiveInteraction?: HiveInteractionState;
  localPlayerId?: string;
  onPerformanceChange: (snapshot: RenderPerformanceSnapshot) => void;
  onMoveToTarget: (x: number, z: number) => void;
  onClearTargets?: () => void;
  onRespawn: () => void;
  onFlowerClick?: (flower: WorldFlowerState) => void;
  onHiveClick?: (hive: WorldHiveState) => void;
  tapTargetingConfig?: Partial<TapTargetingConfig>;
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
  flowerInteraction,
  hiveInteraction,
  localPlayerId,
  onPerformanceChange,
  onMoveToTarget,
  onClearTargets,
  onRespawn,
  onFlowerClick,
  onHiveClick,
  tapTargetingConfig,
}: GameViewportProps) {
  const [isMiniMapVisible, setIsMiniMapVisible] = useState(true);
  const localPlayer = useMemo(
    () => players.find((player) => player.id === localPlayerId),
    [localPlayerId, players],
  );
  const localPlayerPositionRef = useRef(new Vector3(Number.NaN, Number.NaN, Number.NaN));
  const viewportScale = useMemo(
    () => resolveViewportScale(chunkSize, renderDistance),
    [chunkSize, renderDistance],
  );
  const fogDistances = useMemo(
    () => resolveFogDistances(viewportScale.maxCameraDistance),
    [viewportScale.maxCameraDistance],
  );
  const defaultCameraPosition = useMemo(
    () => [viewportScale.cameraDistance, viewportScale.cameraDistance * 0.34, viewportScale.cameraDistance * 1.08] as const,
    [viewportScale.cameraDistance],
  );

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
  const visibleHives = useMemo(() => collectVisibleHives(chunks), [chunks]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key.toLowerCase() !== "m") {
        return;
      }

      event.preventDefault();
      setIsMiniMapVisible((current) => !current);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="viewport-canvas-shell">
      <Canvas
        camera={{ position: defaultCameraPosition, fov: DEFAULT_CAMERA_FOV }}
        dpr={[1, 1.6]}
        shadows
        gl={{ antialias: true }}
      >
        <color attach="background" args={[SKY_COLOR]} />
        <RendererMetricsReporter onChange={onPerformanceChange} />
        <CameraRig
          focusPlayer={localPlayer}
          maxCameraDistance={viewportScale.maxCameraDistance}
          trackedPositionRef={localPlayerPositionRef}
        />
        <HiveCore
          chunks={chunks}
          chunkSize={chunkSize}
          connectionState={connectionState}
          flowerInteraction={flowerInteraction}
          hiveInteraction={hiveInteraction}
          fogFar={fogDistances.far}
          fogNear={fogDistances.near}
          groundInputSize={viewportScale.groundInputSize}
          localPlayerId={localPlayerId}
          localPlayerPositionRef={localPlayerPositionRef}
          onMoveToTarget={onMoveToTarget}
          onFlowerClick={onFlowerClick}
          onHiveClick={onHiveClick}
          tapTargetingConfig={tapTargetingConfig}
          players={nearbyPlayers}
        />
      </Canvas>

      {isMiniMapVisible ? (
        <MiniMap
          flowerInteraction={flowerInteraction}
          hiveInteraction={hiveInteraction}
          hives={visibleHives}
          localPlayerId={localPlayerId}
          onClearTargets={onClearTargets}
          onCollectorClick={onHiveClick}
          players={players}
          onPlayerClick={onMoveToTarget}
          onRespawn={onRespawn}
        />
      ) : (
        <button
          aria-keyshortcuts="M"
          aria-label="Abrir minimapa"
          className="absolute bottom-4 left-4 z-10 min-h-11 rounded-full border border-slate-700/70 bg-slate-950/78 px-4 py-2 text-sm font-bold uppercase tracking-[0.22em] text-cyan-100 shadow-[0_12px_32px_rgba(15,23,42,0.42)] backdrop-blur-md transition hover:border-cyan-300/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          onClick={() => {
            setIsMiniMapVisible(true);
          }}
          type="button"
        >
          Mapa · M
        </button>
      )}
    </div>
  );
}
