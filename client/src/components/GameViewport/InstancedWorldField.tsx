import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
} from "three";

import type { WorldChunkState } from "../../types/game";

const WORLD_TO_SCENE_SCALE = 1.35;
const GROUND_HEIGHT = -1.15;
const CHUNK_OVERLAY_HEIGHT = GROUND_HEIGHT + 0.02;

const FLOWER_PETAL_OFFSETS: [number, number, number][] = [
  [0.18, 0.56, 0],
  [-0.18, 0.56, 0],
  [0, 0.56, 0.18],
  [0, 0.56, -0.18],
  [0, 0.7, 0],
];

const chunkOverlayGeometry = new PlaneGeometry(1, 1);
const flowerStemGeometry = new CylinderGeometry(0.03, 0.04, 0.52, 10);
const flowerPetalGeometry = new SphereGeometry(0.11, 14, 14);
const flowerCoreGeometry = new SphereGeometry(0.13, 18, 18);
const hiveBodyGeometry = new CylinderGeometry(0.34, 0.48, 0.92, 10);
const hiveEntranceGeometry = new CylinderGeometry(0.08, 0.08, 0.12, 18);
const hiveGlowGeometry = new IcosahedronGeometry(0.18, 0);

const standardMaterialCache = new Map<string, MeshStandardMaterial>();
const basicMaterialCache = new Map<string, MeshBasicMaterial>();

interface InstanceConfig {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

interface WorldFieldBuild {
  overlayByColor: Map<string, InstanceConfig[]>;
  flowerStemInstances: InstanceConfig[];
  flowerPetalsByColor: Map<string, InstanceConfig[]>;
  flowerCoresByColor: Map<string, InstanceConfig[]>;
  hiveBodiesByColor: Map<string, InstanceConfig[]>;
  hiveEntrances: InstanceConfig[];
  hiveGlowsByColor: Map<string, InstanceConfig[]>;
}

function toSceneAxis(value: number): number {
  return value * WORLD_TO_SCENE_SCALE;
}

function getStandardMaterial(
  key: string,
  color: string,
  options?: Partial<Pick<MeshStandardMaterial, "emissiveIntensity" | "roughness" | "metalness">> & { emissive?: string },
): MeshStandardMaterial {
  const cacheKey = [key, color, options?.emissive ?? "", options?.emissiveIntensity ?? 0, options?.roughness ?? "", options?.metalness ?? ""].join(":");
  const cached = standardMaterialCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const material = new MeshStandardMaterial({
    color,
    emissive: options?.emissive,
    emissiveIntensity: options?.emissiveIntensity,
    roughness: options?.roughness,
    metalness: options?.metalness,
  });

  standardMaterialCache.set(cacheKey, material);
  return material;
}

function getBasicMaterial(key: string, color: string, opacity: number): MeshBasicMaterial {
  const cacheKey = [key, color, opacity].join(":");
  const cached = basicMaterialCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const material = new MeshBasicMaterial({ color, opacity, transparent: opacity < 1 });
  basicMaterialCache.set(cacheKey, material);
  return material;
}

function pushGroupedInstance(group: Map<string, InstanceConfig[]>, color: string, instance: InstanceConfig): void {
  const bucket = group.get(color);
  if (bucket) {
    bucket.push(instance);
    return;
  }

  group.set(color, [instance]);
}

function buildWorldField(chunks: WorldChunkState[], chunkSize: number): WorldFieldBuild {
  const overlayByColor = new Map<string, InstanceConfig[]>();
  const flowerStemInstances: InstanceConfig[] = [];
  const flowerPetalsByColor = new Map<string, InstanceConfig[]>();
  const flowerCoresByColor = new Map<string, InstanceConfig[]>();
  const hiveBodiesByColor = new Map<string, InstanceConfig[]>();
  const hiveEntrances: InstanceConfig[] = [];
  const hiveGlowsByColor = new Map<string, InstanceConfig[]>();
  const chunkSceneSize = toSceneAxis(chunkSize) - 0.12;

  for (const chunk of chunks) {
    const overlayColor = Math.abs(chunk.x + chunk.y) % 2 === 0 ? "#88b44d" : "#7eaa45";
    pushGroupedInstance(overlayByColor, overlayColor, {
      position: [
        toSceneAxis((chunk.x + 0.5) * chunkSize),
        CHUNK_OVERLAY_HEIGHT,
        toSceneAxis((chunk.y + 0.5) * chunkSize),
      ],
      rotation: [-Math.PI / 2, 0, 0],
      scale: [chunkSceneSize, chunkSceneSize, 1],
    });

    for (const flower of chunk.flowers) {
      const baseX = toSceneAxis(flower.x);
      const baseZ = toSceneAxis(flower.y);

      flowerStemInstances.push({
        position: [baseX, GROUND_HEIGHT + 0.26 * flower.scale + 0.02, baseZ],
        scale: flower.scale,
      });

      for (const [offsetX, offsetY, offsetZ] of FLOWER_PETAL_OFFSETS) {
        pushGroupedInstance(flowerPetalsByColor, flower.petalColor, {
          position: [
            baseX + offsetX * flower.scale,
            GROUND_HEIGHT + 0.02 + offsetY * flower.scale,
            baseZ + offsetZ * flower.scale,
          ],
          scale: flower.scale,
        });
      }

      pushGroupedInstance(flowerCoresByColor, flower.coreColor, {
        position: [baseX, GROUND_HEIGHT + 0.02 + 0.58 * flower.scale, baseZ],
        scale: flower.scale,
      });
    }

    for (const hive of chunk.hives) {
      const baseX = toSceneAxis(hive.x);
      const baseZ = toSceneAxis(hive.y);

      pushGroupedInstance(hiveBodiesByColor, hive.toneColor, {
        position: [baseX, GROUND_HEIGHT + 0.12, baseZ],
        scale: hive.scale,
      });

      hiveEntrances.push({
        position: [baseX, GROUND_HEIGHT + 0.16, baseZ + 0.34 * hive.scale],
        rotation: [Math.PI / 2, 0, 0],
        scale: hive.scale,
      });

      pushGroupedInstance(hiveGlowsByColor, hive.glowColor, {
        position: [baseX, GROUND_HEIGHT + 0.12 + 0.72 * hive.scale, baseZ],
        scale: hive.scale,
      });
    }
  }

  return {
    overlayByColor,
    flowerStemInstances,
    flowerPetalsByColor,
    flowerCoresByColor,
    hiveBodiesByColor,
    hiveEntrances,
    hiveGlowsByColor,
  };
}

function InstancedLayer({
  instances,
  material,
  geometry,
  castShadow = false,
  receiveShadow = false,
}: {
  instances: InstanceConfig[];
  material: MeshBasicMaterial | MeshStandardMaterial;
  geometry: PlaneGeometry | CylinderGeometry | SphereGeometry | IcosahedronGeometry;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    mesh.count = instances.length;

    for (let index = 0; index < instances.length; index += 1) {
      const instance = instances[index];
      dummy.position.set(...instance.position);

      if (instance.rotation) {
        dummy.rotation.set(...instance.rotation);
      } else {
        dummy.rotation.set(0, 0, 0);
      }

      if (typeof instance.scale === "number") {
        dummy.scale.setScalar(instance.scale);
      } else if (instance.scale) {
        dummy.scale.set(...instance.scale);
      } else {
        dummy.scale.set(1, 1, 1);
      }

      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, [dummy, instances]);

  if (instances.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, instances.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      frustumCulled={false}
    />
  );
}

export function InstancedWorldField({ chunks, chunkSize }: { chunks: WorldChunkState[]; chunkSize: number }) {
  const worldField = useMemo(() => buildWorldField(chunks, chunkSize), [chunkSize, chunks]);
  const stemMaterial = useMemo(() => getStandardMaterial("flower-stem", "#648a34", { roughness: 0.92 }), []);
  const hiveEntranceMaterial = useMemo(() => getStandardMaterial("hive-entrance", "#2f1b10", { roughness: 0.92 }), []);

  if (chunkSize <= 0) {
    return null;
  }

  return (
    <group>
      {[...worldField.overlayByColor.entries()].map(([color, instances]) => (
        <InstancedLayer
          key={`overlay:${color}`}
          geometry={chunkOverlayGeometry}
          instances={instances}
          material={getBasicMaterial("chunk-overlay", color, 0.18)}
        />
      ))}

      <InstancedLayer
        castShadow
        geometry={flowerStemGeometry}
        instances={worldField.flowerStemInstances}
        material={stemMaterial}
      />

      {[...worldField.flowerPetalsByColor.entries()].map(([color, instances]) => (
        <InstancedLayer
          key={`flower-petal:${color}`}
          castShadow
          geometry={flowerPetalGeometry}
          instances={instances}
          material={getStandardMaterial(`flower-petal:${color}`, color, { roughness: 0.74 })}
        />
      ))}

      {[...worldField.flowerCoresByColor.entries()].map(([color, instances]) => (
        <InstancedLayer
          key={`flower-core:${color}`}
          castShadow
          geometry={flowerCoreGeometry}
          instances={instances}
          material={getStandardMaterial(`flower-core:${color}`, color, { roughness: 0.6 })}
        />
      ))}

      {[...worldField.hiveBodiesByColor.entries()].map(([color, instances]) => (
        <InstancedLayer
          key={`hive-body:${color}`}
          castShadow
          receiveShadow
          geometry={hiveBodyGeometry}
          instances={instances}
          material={getStandardMaterial(`hive-body:${color}`, color, { roughness: 0.84 })}
        />
      ))}

      <InstancedLayer
        castShadow
        geometry={hiveEntranceGeometry}
        instances={worldField.hiveEntrances}
        material={hiveEntranceMaterial}
      />

      {[...worldField.hiveGlowsByColor.entries()].map(([color, instances]) => (
        <InstancedLayer
          key={`hive-glow:${color}`}
          geometry={hiveGlowGeometry}
          instances={instances}
          material={getStandardMaterial(`hive-glow:${color}`, color, {
            emissive: new Color(color).getStyle(),
            emissiveIntensity: 0.72,
          })}
        />
      ))}
    </group>
  );
}