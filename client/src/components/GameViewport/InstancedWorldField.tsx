import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import {
	type BufferGeometry,
	type Material,
	Group,
	InstancedMesh,
	Mesh,
	Object3D,
} from "three";

import type { WorldChunkState } from "../../types/game";

const WORLD_TO_SCENE_SCALE = 1.35;
const GROUND_HEIGHT = -1.15;
const TERRAIN_SURFACE_HEIGHT = GROUND_HEIGHT + 0.02;
const TERRAIN_BLOCK_SCALE = WORLD_TO_SCENE_SCALE;
const TERRAIN_BLOCK_CENTER_Y = TERRAIN_SURFACE_HEIGHT - TERRAIN_BLOCK_SCALE * 0.5;

const TERRAIN_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/block-grass.glb";
const FLOWERS_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/flowers.glb";
const HIVE_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/barrel.glb";

interface InstanceConfig {
	position: [number, number, number];
	rotation?: [number, number, number];
	scale?: number | [number, number, number];
}

interface WorldFieldBuild {
	terrainModelInstances: InstanceConfig[];
	flowerModelInstances: InstanceConfig[];
	hiveModelInstances: InstanceConfig[];
}

interface InstancedModelMeshSource {
	geometry: BufferGeometry;
	material: Material;
}

function toSceneAxis(value: number): number {
	return value * WORLD_TO_SCENE_SCALE;
}

function buildWorldField(chunks: WorldChunkState[], chunkSize: number): WorldFieldBuild {
	const terrainModelInstances: InstanceConfig[] = [];
	const flowerModelInstances: InstanceConfig[] = [];
	const hiveModelInstances: InstanceConfig[] = [];

	for (const chunk of chunks) {
		const chunkOriginX = chunk.x * chunkSize;
		const chunkOriginY = chunk.y * chunkSize;

		for (let cellX = 0; cellX < chunkSize; cellX += 1) {
			for (let cellY = 0; cellY < chunkSize; cellY += 1) {
				terrainModelInstances.push({
					position: [
						toSceneAxis(chunkOriginX + cellX + 0.5),
						TERRAIN_BLOCK_CENTER_Y,
						toSceneAxis(chunkOriginY + cellY + 0.5),
					],
					scale: TERRAIN_BLOCK_SCALE,
				});
			}
		}

		for (const flower of chunk.flowers) {
			const baseX = toSceneAxis(flower.x);
			const baseZ = toSceneAxis(flower.y);

			flowerModelInstances.push({
				position: [baseX, TERRAIN_SURFACE_HEIGHT + 0.02, baseZ],
				rotation: [0, (baseX + baseZ) * 0.05, 0],
				scale: 0.36 * flower.scale,
			});
		}

		for (const hive of chunk.hives) {
			const baseX = toSceneAxis(hive.x);
			const baseZ = toSceneAxis(hive.y);

			hiveModelInstances.push({
				position: [baseX, TERRAIN_SURFACE_HEIGHT + 0.04, baseZ],
				rotation: [0, (baseX - baseZ) * 0.03, 0],
				scale: 0.78 * hive.scale,
			});
		}
	}

	return {
		terrainModelInstances,
		flowerModelInstances,
		hiveModelInstances,
	};
}

function collectInstancedModelMeshes(root: Group): InstancedModelMeshSource[] {
	const meshes: InstancedModelMeshSource[] = [];

	root.traverse((child) => {
		if (!(child instanceof Mesh)) {
			return;
		}

		if (Array.isArray(child.material)) {
			return;
		}

		meshes.push({
			geometry: child.geometry,
			material: child.material,
		});
	});

	return meshes;
}

function InstancedLayer({
	instances,
	material,
	geometry,
	castShadow = false,
	receiveShadow = false,
	onPointerDown,
}: {
	instances: InstanceConfig[];
	material: Material;
	geometry: BufferGeometry;
	castShadow?: boolean;
	receiveShadow?: boolean;
	onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
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
			onPointerDown={onPointerDown}
			receiveShadow={receiveShadow}
			frustumCulled={false}
		/>
	);
}

export function InstancedWorldField({
	chunks,
	chunkSize,
	onTerrainPointerDown,
}: {
	chunks: WorldChunkState[];
	chunkSize: number;
	onTerrainPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}) {
	const worldField = useMemo(() => buildWorldField(chunks, chunkSize), [chunkSize, chunks]);
	const terrainModel = useGLTF(TERRAIN_MODEL_PATH);
	const flowersModel = useGLTF(FLOWERS_MODEL_PATH);
	const hiveModel = useGLTF(HIVE_MODEL_PATH);
	const terrainMeshSources = useMemo(
		() => collectInstancedModelMeshes(terrainModel.scene),
		[terrainModel.scene],
	);
	const flowerMeshSources = useMemo(
		() => collectInstancedModelMeshes(flowersModel.scene),
		[flowersModel.scene],
	);
	const hiveMeshSources = useMemo(
		() => collectInstancedModelMeshes(hiveModel.scene),
		[hiveModel.scene],
	);

	if (chunkSize <= 0) {
		return null;
	}

	return (
		<group>
			{terrainMeshSources.map((source, index) => (
				<InstancedLayer
					key={`terrain-model:${index}`}
					castShadow
					receiveShadow
					geometry={source.geometry}
					instances={worldField.terrainModelInstances}
					material={source.material}
					onPointerDown={onTerrainPointerDown}
				/>
			))}

			{flowerMeshSources.map((source, index) => (
				<InstancedLayer
					key={`flower-model:${index}`}
					castShadow
					geometry={source.geometry}
					instances={worldField.flowerModelInstances}
					material={source.material}
				/>
			))}

			{hiveMeshSources.map((source, index) => (
				<InstancedLayer
					key={`hive-model:${index}`}
					castShadow
					receiveShadow
					geometry={source.geometry}
					instances={worldField.hiveModelInstances}
					material={source.material}
				/>
			))}
		</group>
	);
}

useGLTF.preload(TERRAIN_MODEL_PATH);
useGLTF.preload(FLOWERS_MODEL_PATH);
useGLTF.preload(HIVE_MODEL_PATH);