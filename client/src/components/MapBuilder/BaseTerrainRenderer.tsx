import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  type BufferGeometry,
  Group,
  InstancedMesh,
  type Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from "three";

import {
  TERRAIN_BLOCK_SCALE,
  toSceneAxis,
  toTerrainBlockCenterY,
  toTerrainSurfaceY,
} from "../GameViewport/worldSurface";
import type { MapTile } from "./types";

const TERRAIN_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/block-grass.glb";
const WATER_LAYER_THICKNESS = TERRAIN_BLOCK_SCALE * 0.42;

interface InstanceConfig {
  position: [number, number, number];
  scale?: number | [number, number, number];
}

interface InstancedModelMeshSource {
  geometry: BufferGeometry;
  material: Material;
}

interface TerrainBuild {
  grassInstances: InstanceConfig[];
  elevatedInstances: InstanceConfig[];
  waterInstances: InstanceConfig[];
}

function buildTerrainInstances(tiles: MapTile[]): TerrainBuild {
  const grassInstances: InstanceConfig[] = [];
  const elevatedInstances: InstanceConfig[] = [];
  const waterInstances: InstanceConfig[] = [];

  for (const tile of tiles) {
    const baseX = toSceneAxis(tile.x);
    const baseZ = toSceneAxis(tile.z);
    const terrainCenterY = toTerrainBlockCenterY(tile.y);

    if (tile.type === "grass") {
      grassInstances.push({
        position: [baseX, terrainCenterY, baseZ],
        scale: TERRAIN_BLOCK_SCALE,
      });
      continue;
    }

    if (tile.type === "stone") {
      const stackedLevels = Math.max(0, Math.ceil(tile.y - 0.001));

      for (let level = 0; level < stackedLevels; level += 1) {
        elevatedInstances.push({
          position: [baseX, toTerrainBlockCenterY(level), baseZ],
          scale: TERRAIN_BLOCK_SCALE,
        });
      }

      elevatedInstances.push({
        position: [baseX, terrainCenterY, baseZ],
        scale: TERRAIN_BLOCK_SCALE,
      });
      continue;
    }

    waterInstances.push({
      position: [baseX, toTerrainSurfaceY(tile.y) - WATER_LAYER_THICKNESS * 0.5, baseZ],
      scale: [TERRAIN_BLOCK_SCALE, WATER_LAYER_THICKNESS, TERRAIN_BLOCK_SCALE],
    });
  }

  return {
    grassInstances,
    elevatedInstances,
    waterInstances,
  };
}

function collectInstancedModelMeshes(root: Group): InstancedModelMeshSource[] {
  const meshes: InstancedModelMeshSource[] = [];

  root.traverse((child) => {
    if (!(child instanceof Mesh) || Array.isArray(child.material)) {
      return;
    }

    meshes.push({
      geometry: child.geometry,
      material: child.material,
    });
  });

  return meshes;
}

function InstancedLayer({ instances, geometry, material }: { instances: InstanceConfig[]; geometry: BufferGeometry; material: Material }) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }

    mesh.count = instances.length;

    for (let index = 0; index < instances.length; index += 1) {
      const instance = instances[index];
      dummy.position.set(...instance.position);
      dummy.rotation.set(0, 0, 0);

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

  return <instancedMesh ref={meshRef} args={[geometry, material, instances.length]} castShadow receiveShadow frustumCulled={false} />;
}

export function BaseTerrainRenderer({ tiles }: { tiles: MapTile[] }) {
  const gltf = useGLTF(TERRAIN_MODEL_PATH);
  const meshSources = useMemo(() => collectInstancedModelMeshes(gltf.scene), [gltf.scene]);
  const terrainBuild = useMemo(() => buildTerrainInstances(tiles), [tiles]);
  const waterGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const waterMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#3b82f6", transparent: true, opacity: 0.74, roughness: 0.38 }),
    [],
  );

  return (
    <group>
      {meshSources.map((source, index) => (
        <group key={`terrain:${index}`}>
          <InstancedLayer geometry={source.geometry} instances={terrainBuild.grassInstances} material={source.material} />
          <InstancedLayer geometry={source.geometry} instances={terrainBuild.elevatedInstances} material={source.material} />
        </group>
      ))}

      <InstancedLayer geometry={waterGeometry} instances={terrainBuild.waterInstances} material={waterMaterial} />
    </group>
  );
}

useGLTF.preload(TERRAIN_MODEL_PATH);