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

import type { WorldFlowerState } from "../../types/game";
import { toSceneAxis, toTerrainSurfaceY } from "./worldSurface";

const FLOWERS_MODEL_PATH = "/kenney_platformer-kit/Models/GLB format/flowers.glb";

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
 * FlowerRenderer: Renders world flowers using instancing.
 * Receives flowers array and click callback from parent component.
 */
export function FlowerRenderer({
	flowers,
	onFlowerClick,
}: {
	flowers: WorldFlowerState[];
	onFlowerClick?: (event: ThreeEvent<PointerEvent>, flowerId: string, index: number) => void;
}) {
	const flowersModel = useGLTF(FLOWERS_MODEL_PATH);
	const meshRefsMap = useRef<Map<number, InstancedMesh>>(new Map());

	// Extract geometry and material from loaded model
	const flowerMeshSources = useMemo(() => collectInstancedModelMeshes(flowersModel.scene), [flowersModel.scene]);

	// Build instance configurations from flower states
	const flowerInstances = useMemo(() => buildFlowerInstances(flowers), [flowers]);



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

	// Update instance matrices whenever flowers change
	useEffect(() => {
		const dummy = new Object3D();

		meshRefsMap.current.forEach((mesh) => {
			mesh.count = flowerInstances.length;

			for (let idx = 0; idx < flowerInstances.length; idx += 1) {
				const instance = flowerInstances[idx];
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
	}, [flowerInstances]);

	const handlePointerClick = (event: ThreeEvent<PointerEvent>, meshIndex: number) => {
		event.stopPropagation();
		if (flowers[meshIndex] && onFlowerClick) {
			onFlowerClick(event, flowers[meshIndex].id, meshIndex);
		}
	};

	if (flowerInstances.length === 0 || flowerMeshSources.length === 0) {
		return null;
	}

			{flowerMeshSources.map((source, sourceIndex) => (
				<InstancedFlowerLayer
					key={`flower-model:${sourceIndex}`}
					ref={(mesh: InstancedMesh | null) => {
						if (mesh) {
							meshRefsMap.current.set(sourceIndex, mesh);
						}
					}}
					geometry={source.geometry}
					material={source.material}
					instanceCount={flowerInstances.length}
					onPointerDown={(event: ThreeEvent<PointerEvent>) => {
						if (event.instanceId !== undefined) {
							handlePointerClick(event, event.instanceId);
						}
					}}
				/>
			))}
}

/**
 * InstancedFlowerLayer: Individual layer of flower instances
 */
const InstancedFlowerLayer = React.forwardRef<
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
			onPointerDown={onPointerDown}
			frustumCulled={false}
		/>
	);
});

/**
 * Helper: Build instance configurations from flower states
 */
function buildFlowerInstances(flowers: WorldFlowerState[]): InstanceConfig[] {
	return flowers.map((flower) => ({
		position: [toSceneAxis(flower.x), toTerrainSurfaceY(flower.groundY ?? 0) + 0.02, toSceneAxis(flower.y)],
		rotation: [0, (toSceneAxis(flower.x) + toSceneAxis(flower.y)) * 0.05, 0],
		scale: 0.36 * flower.scale,
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

useGLTF.preload(FLOWERS_MODEL_PATH);
