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
import styles from "./GameViewport.module.css";
import { MiniMap } from "./MiniMap";
import { type TapTargetingConfig, type TapTargetingHandlers, useTapTargeting } from "./useTapTargeting";
import type {
  FlowerInteractionState,
  GameSessionState,
  HiveInteractionState,
  InteractionResult,
  RenderPerformanceSnapshot,
  SkillEffectState,
  WorldChunkState,
  WorldFlowerState,
  WorldHiveState,
  WorldLandmarkState,
  WorldPlayerState,
  WorldPropState,
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
const SKY_COLOR = "#1279e0";
const FOG_COLOR = "#2286c9";
const DEFAULT_CAMERA_FOV = 56;
const FOG_NEAR_RATIO = 0.54;
const FOG_FAR_PADDING = 3;
const VIEWPORT_CAMERA = {
  base: 18,
  initialPositionRatio: [1, 0.34, 1.08] as const,
  maxZoomDistance: 20,
  minZoomDistance: 7.5,
  sceneSpanRatio: 0.3,
} as const;
const CAMERA_ROTATE_SPEED = 0.82;
const CAMERA_ZOOM_SPEED = 0.9;
const BEE_TURN_RESPONSE = 18;
const KEYBOARD_MOVE_SEND_INTERVAL_MS = 100;
const KEYBOARD_MOVE_LOOKAHEAD_SECONDS = 0.18;
const KEYBOARD_MOVE_MIN_LOOKAHEAD_DISTANCE = 0.48;
const MOVEMENT_VECTOR_EPSILON = 0.0001;
// Important: the black rear piece is the stinger, not the head.
// The bee visually faces local -X, so movement yaw must treat local +X as the tail.
const BEE_IDLE_YAW = -Math.PI / 2;
const BEE_MOVEMENT_YAW_OFFSET = Math.PI / 2;
const DEFAULT_FLOWER_COLLECT_DURATION_MS = 1150;

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
const impulseTrailOrbGeometry = new SphereGeometry(0.12, 14, 14);
const impulseTrailRingGeometry = new RingGeometry(0.18, 0.3, 24);
const projectileBodyGeometry = new SphereGeometry(0.1, 12, 12);
const projectileTipGeometry = new ConeGeometry(0.08, 0.28, 16);

projectileTipGeometry.rotateZ(-Math.PI / 2);

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
  cameraPosition: readonly [number, number, number];
  groundInputSize: number;
  maxCameraDistance: number;
} {
  const resolveCameraPosition = (cameraDistance: number): readonly [number, number, number] => {
    const [xRatio, yRatio, zRatio] = VIEWPORT_CAMERA.initialPositionRatio;
    return [cameraDistance * xRatio, cameraDistance * yRatio, cameraDistance * zRatio] as const;
  };

  if (chunkSize <= 0 || renderDistance <= 0) {
    return {
      cameraDistance: VIEWPORT_CAMERA.base,
      cameraPosition: resolveCameraPosition(VIEWPORT_CAMERA.base),
      groundInputSize: 960,
      maxCameraDistance: VIEWPORT_CAMERA.maxZoomDistance,
    };
  }

  const chunkSpan = chunkSize * (renderDistance * 2 + 1);
  const sceneSpan = toSceneAxis(chunkSpan);
  const cameraDistance = Math.min(
    VIEWPORT_CAMERA.maxZoomDistance,
    Math.max(VIEWPORT_CAMERA.base, sceneSpan * VIEWPORT_CAMERA.sceneSpanRatio),
  );

  return {
    cameraDistance,
    cameraPosition: resolveCameraPosition(cameraDistance),
    groundInputSize: Math.max(960, sceneSpan * 3),
    maxCameraDistance: VIEWPORT_CAMERA.maxZoomDistance,
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

function resolveMoveDestination(player: WorldPlayerState & { targetX: number; targetY: number }) {
  return {
    x: player.destinationX ?? player.targetX,
    y: player.destinationY ?? player.targetY,
  };
}

function setMoveDestinationVector(target: Vector3, player: WorldPlayerState & { targetX: number; targetY: number }, sceneY: number) {
  const destination = resolveMoveDestination(player);
  target.set(toSceneAxis(destination.x), sceneY, toSceneAxis(destination.y));
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
    const lookTargetRef = hasInputPreviewTarget ? inputPreviewTarget : desiredTargetPositionRef.current;
    if (!hasInputPreviewTarget && hasMoveTarget(player)) {
      setMoveDestinationVector(lookTargetRef, player, currentPosition.y);
    }
    const lookTarget = hasInputPreviewTarget || hasMoveTarget(player) ? lookTargetRef : authoritativePositionRef.current;

    const lookDeltaX = lookTarget.x - currentPosition.x;
    const lookDeltaZ = lookTarget.z - currentPosition.z;
    const targetYaw = resolveTargetYaw(lookDeltaX, lookDeltaZ);

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
        <div className={[styles.beeNameplate, isLocal ? styles.beeNameplateLocal : ""].filter(Boolean).join(" ")}>
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
            <div className={styles.beeNameplate}>{player.username}</div>
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
      const destination = hasMoveTarget(player) ? resolveMoveDestination(player) : null;
      const desiredX = destination ? toSceneAxis(destination.x) : authoritativeX;
      const desiredZ = destination ? toSceneAxis(destination.y) : authoritativeZ;
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
      if (hasMoveTarget(player)) {
        setMoveDestinationVector(lookTarget, player, currentPosition.y);
      }
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

function DashTrailEffect({ effect, surfaceIndex }: { effect: SkillEffectState; surfaceIndex: WorldSurfaceIndex }) {
  const groupRef = useRef<Group>(null);
  const trailPoints = useMemo(
    () => Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const worldX = MathUtils.lerp(effect.fromX, effect.toX, ratio);
      const worldY = MathUtils.lerp(effect.fromY, effect.toY, ratio);

      return {
        position: [
          toSceneAxis(worldX),
          resolveBeeSceneHeight(surfaceIndex, worldX, worldY, 0, ratio) + 0.1 + ratio * 0.05,
          toSceneAxis(worldY),
        ] as const,
        scale: 0.65 + ratio * 0.7,
        opacity: 0.2 + ratio * 0.12,
      };
    }),
    [effect.fromX, effect.fromY, effect.toX, effect.toY, surfaceIndex],
  );
  const ringPosition = useMemo(
    () => [
      toSceneAxis(effect.toX),
      resolveTargetMarkerSceneY(surfaceIndex, effect.toX, effect.toY) + 0.05,
      toSceneAxis(effect.toY),
    ] as const,
    [effect.toX, effect.toY, surfaceIndex],
  );

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const lifeProgress = MathUtils.clamp((Date.now() - effect.startedAt) / Math.max(effect.durationMs, 1), 0, 1);
    groupRef.current.rotation.y = state.clock.elapsedTime * 2.4;
    groupRef.current.scale.setScalar(1 - lifeProgress * 0.1);
  });

  return (
    <group ref={groupRef} renderOrder={34}>
      {trailPoints.map((point, index) => (
        <mesh key={`${effect.id}:trail:${index}`} position={point.position} renderOrder={34} scale={point.scale}>
          <primitive attach="geometry" object={impulseTrailOrbGeometry} />
          <meshBasicMaterial color="#fde68a" opacity={point.opacity} transparent depthWrite={false} />
        </mesh>
      ))}

      <mesh position={ringPosition} renderOrder={35} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive attach="geometry" object={impulseTrailRingGeometry} />
        <meshBasicMaterial color="#facc15" opacity={0.88} transparent depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}

function SkillEffectsLayer({ skillEffects, surfaceIndex }: { skillEffects: SkillEffectState[]; surfaceIndex: WorldSurfaceIndex }) {
  if (skillEffects.length === 0) {
    return null;
  }

  return (
    <group>
      {skillEffects.map((effect) => {
        if (effect.kind === "dash") {
          return <DashTrailEffect key={effect.id} effect={effect} surfaceIndex={surfaceIndex} />;
        }

        if (effect.kind === "projectile") {
          return <ProjectileSkillEffect key={effect.id} effect={effect} surfaceIndex={surfaceIndex} />;
        }

        if (effect.kind === "ground-area" || effect.kind === "support-area") {
          return <AreaSkillEffect key={effect.id} effect={effect} surfaceIndex={surfaceIndex} />;
        }

        return null;
      })}
    </group>
  );
}

function AreaSkillEffect({ effect, surfaceIndex }: { effect: SkillEffectState; surfaceIndex: WorldSurfaceIndex }) {
  const groupRef = useRef<Group>(null);
  const isSupport = effect.kind === "support-area";
  const radiusScene = Math.max(toSceneAxis(effect.radius), 0.55);
  const position = useMemo(
    () => [
      toSceneAxis(effect.toX),
      resolveTargetMarkerSceneY(surfaceIndex, effect.toX, effect.toY) + 0.03,
      toSceneAxis(effect.toY),
    ] as const,
    [effect.toX, effect.toY, surfaceIndex],
  );
  const ringScale = radiusScene * 2.15;
  const coreScale = radiusScene * 7.8;
  const pulseScale = radiusScene * 2.65;
  const ringColor = isSupport ? "#7df9cf" : "#f59e0b";
  const fillColor = isSupport ? "#86efac" : "#fcd34d";

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const progress = MathUtils.clamp((Date.now() - effect.startedAt) / Math.max(effect.durationMs, 1), 0, 1);
    const pulse = 1 + Math.sin(state.clock.elapsedTime * (isSupport ? 2 : 3.2)) * 0.06;
    groupRef.current.rotation.y = state.clock.elapsedTime * (isSupport ? 0.8 : -1.1);
    groupRef.current.scale.setScalar(1 - progress * 0.04 + (pulse - 1));
  });

  return (
    <group ref={groupRef} position={position} renderOrder={33}>
      <mesh renderOrder={33} rotation={[-Math.PI / 2, 0, 0]} scale={coreScale}>
        <primitive attach="geometry" object={moveTargetCoreGeometry} />
        <meshBasicMaterial color={fillColor} transparent opacity={isSupport ? 0.16 : 0.14} depthWrite={false} />
      </mesh>

      <mesh renderOrder={34} rotation={[-Math.PI / 2, 0, 0]} scale={ringScale}>
        <primitive attach="geometry" object={flowerTargetRingGeometry} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.82} depthWrite={false} side={DoubleSide} />
      </mesh>

      <mesh renderOrder={32} rotation={[-Math.PI / 2, 0, 0]} scale={pulseScale}>
        <primitive attach="geometry" object={impulseTrailRingGeometry} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.18} depthWrite={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}

function ProjectileSkillEffect({ effect, surfaceIndex }: { effect: SkillEffectState; surfaceIndex: WorldSurfaceIndex }) {
  const groupRef = useRef<Group>(null);
  const directionYaw = useMemo(
    () => Math.atan2(effect.directionX, effect.directionY) + BEE_MOVEMENT_YAW_OFFSET,
    [effect.directionX, effect.directionY],
  );

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const progress = MathUtils.clamp((Date.now() - effect.startedAt) / Math.max(effect.durationMs, 1), 0, 1);
    const worldX = MathUtils.lerp(effect.fromX, effect.toX, progress);
    const worldY = MathUtils.lerp(effect.fromY, effect.toY, progress);
    const sceneY = resolveBeeSceneHeight(surfaceIndex, worldX, worldY, state.clock.elapsedTime, 0) + 0.28;

    groupRef.current.position.set(toSceneAxis(worldX), sceneY, toSceneAxis(worldY));
    groupRef.current.rotation.set(0, directionYaw, 0);
    groupRef.current.scale.setScalar(1 - progress * 0.06);
  });

  return (
    <group ref={groupRef} renderOrder={36}>
      <mesh renderOrder={36}>
        <primitive attach="geometry" object={projectileBodyGeometry} />
        <meshBasicMaterial color="#fef08a" transparent opacity={0.92} depthWrite={false} />
      </mesh>

      <mesh position={[0.18, 0, 0]} renderOrder={37}>
        <primitive attach="geometry" object={projectileTipGeometry} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.95} depthWrite={false} />
      </mesh>

      <mesh scale={1.8} renderOrder={35} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive attach="geometry" object={impulseTrailRingGeometry} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.18} depthWrite={false} side={DoubleSide} />
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
      minDistance={VIEWPORT_CAMERA.minZoomDistance}
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
  props: WorldPropState[];
  landmarks: WorldLandmarkState[];
  chunkSize: number;
  connectionState: GameSessionState["connectionState"];
  flowerInteraction?: FlowerInteractionState;
  flowerCollectDurationMs?: number;
  hiveInteraction?: HiveInteractionState;
  fogFar: number;
  fogNear: number;
  groundInputSize: number;
  localPlayerId?: string;
  localPlayerPositionRef: MutableRefObject<Vector3>;
  onMoveToTarget: (x: number, z: number) => void;
  onFlowerClick?: (flower: WorldFlowerState) => void;
  onHiveClick?: (hive: WorldHiveState) => void;
  skillEffects: SkillEffectState[];
  tapTargetingConfig?: Partial<TapTargetingConfig>;
}

function HiveCore({
  players,
  chunks,
  props,
  landmarks,
  chunkSize,
  connectionState,
  flowerInteraction,
  flowerCollectDurationMs,
  hiveInteraction,
  fogFar,
  fogNear,
  groundInputSize,
  localPlayerId,
  localPlayerPositionRef,
  onMoveToTarget,
  onFlowerClick,
  onHiveClick,
  skillEffects,
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
      const destination = resolveMoveDestination(localPlayer);
      setMoveTargetMarker({
        sceneX: toSceneAxis(destination.x),
        sceneY: resolveTargetMarkerSceneY(surfaceIndex, destination.x, destination.y),
        sceneZ: toSceneAxis(destination.y),
      });
      if (localMovementSourceRef.current === "pointer") {
        localInputPreviewTargetRef.current = new Vector3(
          toSceneAxis(destination.x),
          0,
          toSceneAxis(destination.y),
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
          flowerCollectDurationMs={flowerCollectDurationMs}
          flowerInteraction={flowerInteraction}
          landmarks={landmarks}
          props={props}
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
          inputPreviewTargetRef={localInputPreviewTargetRef}
          player={localPlayer}
          surfaceIndex={surfaceIndex}
          trackedPositionRef={localPlayerPositionRef}
        />
      ) : null}

      <RemoteBeesInstanced players={remotePlayers} surfaceIndex={surfaceIndex} />
  <SkillEffectsLayer skillEffects={skillEffects} surfaceIndex={surfaceIndex} />

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
  props: WorldPropState[];
  landmarks: WorldLandmarkState[];
  chunkSize: number;
  renderDistance: number;
  connectionState: GameSessionState["connectionState"];
  flowerInteraction?: FlowerInteractionState;
  hiveInteraction?: HiveInteractionState;
  lastInteraction?: InteractionResult;
  localPlayerId?: string;
  onPerformanceChange: (snapshot: RenderPerformanceSnapshot) => void;
  onMoveToTarget: (x: number, z: number) => void;
  onClearTargets?: () => void;
  onRespawn: () => void;
  onFlowerClick?: (flower: WorldFlowerState) => void;
  onHiveClick?: (hive: WorldHiveState) => void;
  skillEffects: SkillEffectState[];
  tapTargetingConfig?: Partial<TapTargetingConfig>;
}

function toChunkCoord(worldPos: number, chunkSize: number): number {
  return Math.floor(worldPos / chunkSize);
}

function resolveFlowerCollectDurationMs(lastInteraction: InteractionResult | undefined): number {
  if (!lastInteraction || lastInteraction.action !== "collect_flower") {
    return DEFAULT_FLOWER_COLLECT_DURATION_MS;
  }

  const levelMatch = lastInteraction.reason.match(/nivel\s+(\d+)/i);
  const level = Number(levelMatch?.[1]);
  if (!Number.isFinite(level)) {
    return DEFAULT_FLOWER_COLLECT_DURATION_MS;
  }

  return 700 + level * 450;
}

export function GameViewport({
  players,
  chunks,
  props,
  landmarks,
  chunkSize,
  renderDistance,
  connectionState,
  flowerInteraction,
  hiveInteraction,
  lastInteraction,
  localPlayerId,
  onPerformanceChange,
  onMoveToTarget,
  onClearTargets,
  onRespawn,
  onFlowerClick,
  onHiveClick,
  skillEffects,
  tapTargetingConfig,
}: GameViewportProps) {
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
  const flowerCollectDurationMs = useMemo(
    () => resolveFlowerCollectDurationMs(lastInteraction),
    [lastInteraction],
  );

  return (
    <div className={styles.canvasShell}>
      <Canvas
        camera={{ position: viewportScale.cameraPosition, fov: DEFAULT_CAMERA_FOV }}
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
          flowerCollectDurationMs={flowerCollectDurationMs}
          hiveInteraction={hiveInteraction}
          fogFar={fogDistances.far}
          fogNear={fogDistances.near}
          groundInputSize={viewportScale.groundInputSize}
          landmarks={landmarks}
          localPlayerId={localPlayerId}
          localPlayerPositionRef={localPlayerPositionRef}
          onMoveToTarget={onMoveToTarget}
          onFlowerClick={onFlowerClick}
          onHiveClick={onHiveClick}
          props={props}
          skillEffects={skillEffects}
          tapTargetingConfig={tapTargetingConfig}
          players={nearbyPlayers}
        />
      </Canvas>

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
    </div>
  );
}
