import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
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

import type { FlowerInteractionState, MapZone, PlayerProgressState, WorldChunkState, WorldFlowerState, WorldHiveState } from "../../types/game";
import {
	TERRAIN_BLOCK_SCALE,
	toSceneAxis,
	toTerrainBlockCenterY,
	toTerrainSurfaceY,
} from "./worldSurface";
import type { TapTargetingHandlers } from "./useTapTargeting";
import { FlowerRenderer } from "./FlowerRenderer";
import { HiveRenderer } from "./HiveRenderer";
import { ZoneGateRenderer } from "./ZoneGateRenderer";

const TERRAIN_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/block-grass.glb";
const TREE_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/tree-pine-small.glb";
const WATER_LAYER_THICKNESS = TERRAIN_BLOCK_SCALE * 0.18;

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
	treeModelInstances: InstanceConfig[];
}

interface InstancedModelMeshSource {
	geometry: BufferGeometry;
	material: Material;
}

function buildWorldField(chunks: WorldChunkState[]): WorldFieldBuild {
	const grassTerrainInstances: InstanceConfig[] = [];
	const stoneTerrainInstances: InstanceConfig[] = [];
	const waterTerrainInstances: InstanceConfig[] = [];
	const treeModelInstances: InstanceConfig[] = [];

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

		for (const tree of chunk.trees) {
			const baseX = toSceneAxis(tree.x);
			const baseZ = toSceneAxis(tree.y);

			treeModelInstances.push({
				position: [baseX, toTerrainSurfaceY(tree.groundY ?? 0) + 0.1, baseZ],
				rotation: [0, (baseX - baseZ) * 0.03, 0],
				scale: 0.54 * tree.scale,
			});
		}
	}

	return {
		grassTerrainInstances,
		stoneTerrainInstances,
		waterTerrainInstances,
		treeModelInstances,
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

	useLayoutEffect(() => {
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
		// frustumCulled={false} is set on all InstancedLayer meshes, so bounding sphere
		// computation is not needed for culling and would be expensive on large tile counts.
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
	onFlowerClick,
	onHiveClick,
	selectedFlowerId,
	flowerInteraction,
	flowerCollectDurationMs,
	selectedHiveId,
	zones,
	playerProgress,
}: {
	chunks: WorldChunkState[];
	chunkSize: number;
	detailFocus?: DetailFocus;
	terrainPointerHandlers?: TapTargetingHandlers;
	onFlowerClick?: (flower: WorldFlowerState) => void;
	onHiveClick?: (hive: WorldHiveState) => void;
	selectedFlowerId?: string;
	flowerInteraction?: FlowerInteractionState;
	flowerCollectDurationMs?: number;
	selectedHiveId?: string;
	zones?: MapZone[];
	playerProgress?: PlayerProgressState;
}) {
	// Terrain and trees are static map features — only rebuild when visible chunks change,
	// not on every player position update. detailFocus is intentionally excluded.
	const worldField = useMemo(
		() => buildWorldField(chunks),
		[chunks],
	);
	const terrainModel = useGLTF(TERRAIN_MODEL_PATH);
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
	const treeMeshSources = useMemo(
		() => collectInstancedModelMeshes(treeModel.scene),
		[treeModel.scene],
	);

	// Extract flowers from chunks sorted by proximity to the detail focus.
	// Capped to 200 nearest flowers to keep per-mesh draw calls manageable.
	const MAX_VISIBLE_FLOWERS = 200;
	const visibleFlowers = useMemo(() => {
		const flowers: WorldFlowerState[] = [];

		for (const chunk of chunks) {
			for (const flower of chunk.flowers || []) {
				flowers.push(flower);
			}
		}
		if (flowers.length <= MAX_VISIBLE_FLOWERS || !detailFocus) {
			return flowers;
		}
		const fx = detailFocus.x;
		const fy = detailFocus.y;
		return flowers
			.sort((a, b) => {
				const da = (a.x - fx) ** 2 + (a.y - fy) ** 2;
				const db = (b.x - fx) ** 2 + (b.y - fy) ** 2;
				return da - db;
			})
			.slice(0, MAX_VISIBLE_FLOWERS);
	}, [chunks, detailFocus]);

	const visibleHives = useMemo(() => {
		const hives: WorldHiveState[] = [];
		for (const chunk of chunks) {
			for (const hive of chunk.hives || []) {
				hives.push(hive);
			}
		}
		return hives;
	}, [chunks]);

	// Stable callbacks so FlowerVisual/HiveVisual memo stays effective across ticks.
	const handleFlowerClick = useCallback(
		(_event: ThreeEvent<PointerEvent>, flowerId: string, _index: number) => {
			const flower = visibleFlowers.find((item) => item.id === flowerId);
			if (!flower) {
				return;
			}
			onFlowerClick?.(flower);
		},
		[onFlowerClick, visibleFlowers],
	);
	const handleHiveClick = useCallback(
		(_event: ThreeEvent<PointerEvent>, hiveId: string, _index: number) => {
			const hive = visibleHives.find((item) => item.id === hiveId);
			if (!hive) {
				return;
			}
			onHiveClick?.(hive);
		},
		[onHiveClick, visibleHives],
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
			{/* Terrain layers: grass, stone, water */}
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

			{/* Entity renderers: flowers and hives */}
			<FlowerRenderer
				collectDurationMs={flowerCollectDurationMs}
				flowerInteraction={flowerInteraction}
				flowers={visibleFlowers}
				onFlowerClick={handleFlowerClick}
				selectedFlowerId={selectedFlowerId}
			/>

			{/* Trees: decorative entities without interaction */}
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

			{/* Hive renderer */}
			<HiveRenderer
				hives={visibleHives}
				onHiveClick={handleHiveClick}
				selectedHiveId={selectedHiveId}
			/>

			{/* Zone gate renderer: gates for locked zones */}
			<ZoneGateRenderer
				zones={zones}
				playerProgress={playerProgress}
				detailFocus={detailFocus}
			/>
		</group>
	);
}

useGLTF.preload(TERRAIN_MODEL_PATH);
useGLTF.preload(TREE_MODEL_PATH);