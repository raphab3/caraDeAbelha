import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import {
	BoxGeometry,
	type BufferGeometry,
	type Material,
	Group,
	InstancedMesh,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
} from "three";

import type { WorldChunkState } from "../../types/game";
import {
	TERRAIN_BLOCK_SCALE,
	toSceneAxis,
	toTerrainBlockCenterY,
	toTerrainSurfaceY,
} from "./worldSurface";
import type { TapTargetingHandlers } from "./useTapTargeting";

const TERRAIN_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/block-grass.glb";
const FLOWERS_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/flowers.glb";
const HIVE_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/barrel.glb";
const TREE_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/tree-pine-small.glb";
const WATER_LAYER_THICKNESS = TERRAIN_BLOCK_SCALE * 0.18;
const FLOWER_DETAIL_DISTANCE = 16;
const TREE_DETAIL_DISTANCE = 24;
const HIVE_DETAIL_DISTANCE = 28;

interface DetailFocus {
	x: number;
	y: number;
}

interface InstanceConfig {
	position: [number, number, number];
	rotation?: [number, number, number];
	scale?: number | [number, number, number];
}

interface WorldFieldBuild {
	grassTerrainInstances: InstanceConfig[];
	stoneTerrainInstances: InstanceConfig[];
	waterTerrainInstances: InstanceConfig[];
	flowerModelInstances: InstanceConfig[];
	treeModelInstances: InstanceConfig[];
	hiveModelInstances: InstanceConfig[];
}

interface InstancedModelMeshSource {
	geometry: BufferGeometry;
	material: Material;
}

function isWithinDetailRange(
	detailFocus: DetailFocus | undefined,
	worldX: number,
	worldY: number,
	maxDistance: number,
): boolean {
	if (!detailFocus) {
		return true;
	}

	return Math.hypot(worldX - detailFocus.x, worldY - detailFocus.y) <= maxDistance;
}

function buildWorldField(chunks: WorldChunkState[], detailFocus?: DetailFocus): WorldFieldBuild {
	const grassTerrainInstances: InstanceConfig[] = [];
	const stoneTerrainInstances: InstanceConfig[] = [];
	const waterTerrainInstances: InstanceConfig[] = [];
	const flowerModelInstances: InstanceConfig[] = [];
	const treeModelInstances: InstanceConfig[] = [];
	const hiveModelInstances: InstanceConfig[] = [];

	for (const chunk of chunks) {
		for (const tile of chunk.tiles) {
			const baseX = toSceneAxis(tile.x);
			const baseZ = toSceneAxis(tile.z);
			const terrainCenterY = toTerrainBlockCenterY(tile.y);

			if (tile.type === "grass") {
				grassTerrainInstances.push({
					position: [baseX, terrainCenterY, baseZ],
					scale: TERRAIN_BLOCK_SCALE,
				});
				continue;
			}

			if (tile.type === "stone") {
				stoneTerrainInstances.push({
					position: [baseX, terrainCenterY, baseZ],
					scale: [TERRAIN_BLOCK_SCALE, TERRAIN_BLOCK_SCALE, TERRAIN_BLOCK_SCALE],
				});
				continue;
			}

			waterTerrainInstances.push({
				position: [baseX, toTerrainSurfaceY(tile.y) - WATER_LAYER_THICKNESS * 0.5, baseZ],
				scale: [TERRAIN_BLOCK_SCALE, WATER_LAYER_THICKNESS, TERRAIN_BLOCK_SCALE],
			});
		}

		for (const flower of chunk.flowers) {
			if (!isWithinDetailRange(detailFocus, flower.x, flower.y, FLOWER_DETAIL_DISTANCE)) {
				continue;
			}

			const baseX = toSceneAxis(flower.x);
			const baseZ = toSceneAxis(flower.y);

			flowerModelInstances.push({
				position: [baseX, toTerrainSurfaceY(flower.groundY ?? 0) + 0.02, baseZ],
				rotation: [0, (baseX + baseZ) * 0.05, 0],
				scale: 0.36 * flower.scale,
			});
		}

		for (const tree of chunk.trees) {
			if (!isWithinDetailRange(detailFocus, tree.x, tree.y, TREE_DETAIL_DISTANCE)) {
				continue;
			}

			const baseX = toSceneAxis(tree.x);
			const baseZ = toSceneAxis(tree.y);

			treeModelInstances.push({
				position: [baseX, toTerrainSurfaceY(tree.groundY ?? 0) + 0.1, baseZ],
				rotation: [0, (baseX - baseZ) * 0.03, 0],
				scale: 0.54 * tree.scale,
			});
		}

		for (const hive of chunk.hives) {
			if (!isWithinDetailRange(detailFocus, hive.x, hive.y, HIVE_DETAIL_DISTANCE)) {
				continue;
			}

			const baseX = toSceneAxis(hive.x);
			const baseZ = toSceneAxis(hive.y);

			hiveModelInstances.push({
				position: [baseX, toTerrainSurfaceY(hive.groundY ?? 0) + 0.04, baseZ],
				rotation: [0, (baseX - baseZ) * 0.03, 0],
				scale: 0.78 * hive.scale,
			});
		}
	}

	return {
		grassTerrainInstances,
		stoneTerrainInstances,
		waterTerrainInstances,
		flowerModelInstances,
		treeModelInstances,
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
	onPointerCancel,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}: {
	instances: InstanceConfig[];
	material: Material;
	geometry: BufferGeometry;
	castShadow?: boolean;
	receiveShadow?: boolean;
	onPointerCancel?: (event: ThreeEvent<PointerEvent>) => void;
	onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
	onPointerMove?: (event: ThreeEvent<PointerEvent>) => void;
	onPointerUp?: (event: ThreeEvent<PointerEvent>) => void;
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
			onPointerCancel={onPointerCancel}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			receiveShadow={receiveShadow}
			frustumCulled={false}
		/>
	);
}

export function InstancedWorldField({
	chunks,
	chunkSize,
	detailFocus,
	terrainPointerHandlers,
}: {
	chunks: WorldChunkState[];
	chunkSize: number;
	detailFocus?: DetailFocus;
	terrainPointerHandlers?: TapTargetingHandlers;
}) {
	const worldField = useMemo(
		() => buildWorldField(chunks, detailFocus),
		[chunks, detailFocus?.x, detailFocus?.y],
	);
	const terrainModel = useGLTF(TERRAIN_MODEL_PATH);
	const flowersModel = useGLTF(FLOWERS_MODEL_PATH);
	const hiveModel = useGLTF(HIVE_MODEL_PATH);
	const treeModel = useGLTF(TREE_MODEL_PATH);
	const terrainBoxGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
	const stoneMaterial = useMemo(
		() => new MeshStandardMaterial({ color: "#7c8797", roughness: 0.94, metalness: 0.06 }),
		[],
	);
	const waterMaterial = useMemo(
		() =>
			new MeshBasicMaterial({
				color: "#76d5ff",
				transparent: true,
				opacity: 0.88,
			}),
		[],
	);
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
	const treeMeshSources = useMemo(
		() => collectInstancedModelMeshes(treeModel.scene),
		[treeModel.scene],
	);

	useEffect(() => {
		return () => {
			terrainBoxGeometry.dispose();
			stoneMaterial.dispose();
			waterMaterial.dispose();
		};
	}, [stoneMaterial, terrainBoxGeometry, waterMaterial]);

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
					instances={worldField.grassTerrainInstances}
					material={source.material}
					onPointerCancel={terrainPointerHandlers?.onPointerCancel}
					onPointerDown={terrainPointerHandlers?.onPointerDown}
					onPointerMove={terrainPointerHandlers?.onPointerMove}
					onPointerUp={terrainPointerHandlers?.onPointerUp}
				/>
			))}

			<InstancedLayer
				castShadow
				receiveShadow
				geometry={terrainBoxGeometry}
				instances={worldField.stoneTerrainInstances}
				material={stoneMaterial}
				onPointerCancel={terrainPointerHandlers?.onPointerCancel}
				onPointerDown={terrainPointerHandlers?.onPointerDown}
				onPointerMove={terrainPointerHandlers?.onPointerMove}
				onPointerUp={terrainPointerHandlers?.onPointerUp}
			/>

			<InstancedLayer
				receiveShadow
				geometry={terrainBoxGeometry}
				instances={worldField.waterTerrainInstances}
				material={waterMaterial}
				onPointerCancel={terrainPointerHandlers?.onPointerCancel}
				onPointerDown={terrainPointerHandlers?.onPointerDown}
				onPointerMove={terrainPointerHandlers?.onPointerMove}
				onPointerUp={terrainPointerHandlers?.onPointerUp}
			/>

			{flowerMeshSources.map((source, index) => (
				<InstancedLayer
					key={`flower-model:${index}`}
					castShadow
					geometry={source.geometry}
					instances={worldField.flowerModelInstances}
					material={source.material}
				/>
			))}

			{treeMeshSources.map((source, index) => (
				<InstancedLayer
					key={`tree-model:${index}`}
					castShadow
					receiveShadow
					geometry={source.geometry}
					instances={worldField.treeModelInstances}
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
useGLTF.preload(TREE_MODEL_PATH);