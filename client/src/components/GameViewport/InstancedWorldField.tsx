import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import {
	type BufferGeometry,
	type Material,
	Group,
	InstancedMesh,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	PlaneGeometry,
} from "three";

import type { WorldChunkState } from "../../types/game";

const WORLD_TO_SCENE_SCALE = 1.35;
const GROUND_HEIGHT = -1.15;
const CHUNK_OVERLAY_HEIGHT = GROUND_HEIGHT + 0.02;

const chunkOverlayGeometry = new PlaneGeometry(1, 1);
const basicMaterialCache = new Map<string, MeshBasicMaterial>();

const FLOWERS_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/flowers.glb";
const HIVE_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/barrel.glb";

interface InstanceConfig {
	position: [number, number, number];
	rotation?: [number, number, number];
	scale?: number | [number, number, number];
}

interface WorldFieldBuild {
	overlayByColor: Map<string, InstanceConfig[]>;
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
	const flowerModelInstances: InstanceConfig[] = [];
	const hiveModelInstances: InstanceConfig[] = [];
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

			flowerModelInstances.push({
				position: [baseX, GROUND_HEIGHT + 0.02, baseZ],
				rotation: [0, (baseX + baseZ) * 0.05, 0],
				scale: 0.36 * flower.scale,
			});
		}

		for (const hive of chunk.hives) {
			const baseX = toSceneAxis(hive.x);
			const baseZ = toSceneAxis(hive.y);

			hiveModelInstances.push({
				position: [baseX, GROUND_HEIGHT + 0.04, baseZ],
				rotation: [0, (baseX - baseZ) * 0.03, 0],
				scale: 0.78 * hive.scale,
			});
		}
	}

	return {
		overlayByColor,
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
}: {
	instances: InstanceConfig[];
	material: Material;
	geometry: BufferGeometry;
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
	const flowersModel = useGLTF(FLOWERS_MODEL_PATH);
	const hiveModel = useGLTF(HIVE_MODEL_PATH);
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
			{[...worldField.overlayByColor.entries()].map(([color, instances]) => (
				<InstancedLayer
					key={`overlay:${color}`}
					geometry={chunkOverlayGeometry}
					instances={instances}
					material={getBasicMaterial("chunk-overlay", color, 0.18)}
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

useGLTF.preload(FLOWERS_MODEL_PATH);
useGLTF.preload(HIVE_MODEL_PATH);