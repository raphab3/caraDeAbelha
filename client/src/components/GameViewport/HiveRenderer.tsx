import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import React from "react";
import {
	type BufferGeometry,
	type Material,
	Group,
	InstancedMesh,
	Mesh,
	Object3D,
} from "three";

import type { WorldHiveState } from "../../types/game";
import { toSceneAxis, toTerrainSurfaceY } from "./worldSurface";

const HIVE_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/barrel.glb";

interface InstanceConfig {
	position: [number, number, number];
	rotation?: [number, number, number];
	scale?: number | [number, number, number];
}

interface InstancedModelMeshSource {
	geometry: BufferGeometry;
	material: Material;
}

/**
 * HiveRenderer: Renders world hives using instancing.
 * Receives hives array and click callback from parent component.
 */
export function HiveRenderer({
	hives,
	onHiveClick,
}: {
	hives: WorldHiveState[];
	onHiveClick?: (event: ThreeEvent<PointerEvent>, hiveId: string, index: number) => void;
}) {
	const hiveModel = useGLTF(HIVE_MODEL_PATH);
	const meshRefsMap = useRef<Map<number, InstancedMesh>>(new Map());

	// Extract geometry and material from loaded model
	const hiveMeshSources = useMemo(() => collectInstancedModelMeshes(hiveModel.scene), [hiveModel.scene]);

	// Build instance configurations from hive states
	const hiveInstances = useMemo(() => buildHiveInstances(hives), [hives]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			meshRefsMap.current.forEach((mesh) => {
				if (mesh.geometry) {
					mesh.geometry.dispose();
				}
				if (Array.isArray(mesh.material)) {
					mesh.material.forEach((m) => m.dispose());
				} else if (mesh.material) {
					mesh.material.dispose();
				}
			});
			meshRefsMap.current.clear();
		};
	}, []);

	// Update instance matrices whenever hives change
	useEffect(() => {
		const dummy = new Object3D();

		meshRefsMap.current.forEach((mesh) => {
			mesh.count = hiveInstances.length;

			for (let idx = 0; idx < hiveInstances.length; idx += 1) {
				const instance = hiveInstances[idx];
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
				mesh.setMatrixAt(idx, dummy.matrix);
			}

			mesh.instanceMatrix.needsUpdate = true;
		});
	}, [hiveInstances]);

	const handlePointerClick = (event: ThreeEvent<PointerEvent>, meshIndex: number) => {
		event.stopPropagation();
		if (hives[meshIndex] && onHiveClick) {
			onHiveClick(event, hives[meshIndex].id, meshIndex);
		}
	};

	if (hiveInstances.length === 0 || hiveMeshSources.length === 0) {
		return null;
	}

			{hiveMeshSources.map((source, sourceIndex) => (
				<InstancedHiveLayer
					key={`hive-model:${sourceIndex}`}
					ref={(mesh: InstancedMesh | null) => {
						if (mesh) {
							meshRefsMap.current.set(sourceIndex, mesh);
						}
					}}
					geometry={source.geometry}
					material={source.material}
					instanceCount={hiveInstances.length}
					onPointerDown={(event: ThreeEvent<PointerEvent>) => {
						if (event.instanceId !== undefined) {
							handlePointerClick(event, event.instanceId);
						}
					}}
				/>
			))}
}

/**
 * InstancedHiveLayer: Individual layer of hive instances
 */
const InstancedHiveLayer = React.forwardRef<
	InstancedMesh,
	{
		geometry: BufferGeometry;
		material: Material;
		instanceCount: number;
		onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
	}
>(({ geometry, material, instanceCount, onPointerDown }, ref) => {
	return (
		<instancedMesh
			ref={ref}
			args={[geometry, material, instanceCount]}
			castShadow
			receiveShadow
			onPointerDown={onPointerDown}
			frustumCulled={false}
		/>
	);
});

/**
 * Helper: Build instance configurations from hive states
 */
function buildHiveInstances(hives: WorldHiveState[]): InstanceConfig[] {
	return hives.map((hive) => ({
		position: [toSceneAxis(hive.x), toTerrainSurfaceY(hive.groundY ?? 0) + 0.04, toSceneAxis(hive.y)],
		rotation: [0, (toSceneAxis(hive.x) - toSceneAxis(hive.y)) * 0.03, 0],
		scale: 0.78 * hive.scale,
	}));
}

/**
 * Helper: Collect mesh geometry and material from loaded GLTF model
 */
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

useGLTF.preload(HIVE_MODEL_PATH);
