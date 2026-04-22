import { Html, useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
	CylinderGeometry,
	type BufferGeometry,
	type Material,
	Group,
	InstancedMesh,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	SphereGeometry,
} from "three";

import type { WorldLandmarkState, WorldPropState } from "../../types/game";
import { toSceneAxis, toTerrainSurfaceY } from "./worldSurface";

interface InstancedModelMeshSource {
	geometry: BufferGeometry;
	material: Material;
}

interface InstancedAssetLayerProps {
	assetPath: string;
	props: WorldPropState[];
}

interface InstancedAssetMeshProps {
	geometry: BufferGeometry;
	material: Material;
	props: WorldPropState[];
}

function normalizeAssetPath(assetPath: string): string {
	return assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
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


function InstancedAssetMesh({ geometry, material, props }: InstancedAssetMeshProps) {
	const meshRef = useRef<InstancedMesh>(null);
	const dummy = useMemo(() => new Object3D(), []);

	useLayoutEffect(() => {
		const mesh = meshRef.current;
		if (!mesh) {
			return;
		}

		mesh.count = props.length;
		for (let index = 0; index < props.length; index += 1) {
			const item = props[index];
			dummy.position.set(toSceneAxis(item.x), toTerrainSurfaceY(item.y), toSceneAxis(item.z));
			dummy.rotation.set(0, item.yaw, 0);
			dummy.scale.setScalar(item.scale);
			dummy.updateMatrix();
			mesh.setMatrixAt(index, dummy.matrix);
		}

		mesh.instanceMatrix.needsUpdate = true;
	}, [dummy, props]);

	return (
		<instancedMesh
			ref={meshRef}
			args={[geometry, material, props.length]}
			castShadow
			receiveShadow
			frustumCulled={false}
		/>
	);
}

function InstancedAssetLayer({ assetPath, props }: InstancedAssetLayerProps) {
	const gltf = useGLTF(normalizeAssetPath(assetPath));
	const meshSources = useMemo(() => collectInstancedModelMeshes(gltf.scene), [gltf.scene]);

	return (
		<>
			{meshSources.map((source, index) => (
				<InstancedAssetMesh key={`${assetPath}:${index}`} geometry={source.geometry} material={source.material} props={props} />
			))}
		</>
	);
}

function resolveLandmarkColor(tag?: string): string {
	switch (tag) {
		case "navigation":
			return "#ffe27a";
		case "border":
			return "#95d8ff";
		default:
			return "#ffd2a6";
	}
}

export function StagePropRenderer({ landmarks, props }: { landmarks: WorldLandmarkState[]; props: WorldPropState[] }) {
	const groupedProps = useMemo(() => {
		const groups = new Map<string, WorldPropState[]>();
		for (const item of props) {
			const current = groups.get(item.assetPath) ?? [];
			current.push(item);
			groups.set(item.assetPath, current);
		}
		return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
	}, [props]);
	const beaconGeometry = useMemo(() => new CylinderGeometry(0.08, 0.12, 1.8, 14), []);
	const orbGeometry = useMemo(() => new SphereGeometry(0.22, 18, 18), []);
	const beaconBaseMaterial = useMemo(() => new MeshStandardMaterial({ color: "#6b5a45", roughness: 0.82 }), []);
	const landmarkGlowMaterials = useMemo(
		() => ({
			border: new MeshBasicMaterial({ color: "#95d8ff", transparent: true, opacity: 0.92 }),
			navigation: new MeshBasicMaterial({ color: "#ffe27a", transparent: true, opacity: 0.92 }),
			default: new MeshBasicMaterial({ color: "#ffd2a6", transparent: true, opacity: 0.92 }),
		}),
		[],
	);

	return (
		<group>
			{groupedProps.map(([assetPath, assetProps]) => (
				<InstancedAssetLayer key={assetPath} assetPath={assetPath} props={assetProps} />
			))}

			{landmarks.map((landmark) => {
				const markerColor = resolveLandmarkColor(landmark.tag);
				const beaconGlowMaterial = landmark.tag === "border"
					? landmarkGlowMaterials.border
					: landmark.tag === "navigation"
						? landmarkGlowMaterials.navigation
						: landmarkGlowMaterials.default;
				const sceneX = toSceneAxis(landmark.x);
				const sceneZ = toSceneAxis(landmark.z);
				const baseY = toTerrainSurfaceY(landmark.y);
				return (
					<group key={landmark.id} position={[sceneX, baseY, sceneZ]}>
						<mesh geometry={beaconGeometry} material={beaconBaseMaterial} position={[0, 0.9, 0]} castShadow receiveShadow />
						<mesh geometry={orbGeometry} material={beaconGlowMaterial} position={[0, 2.02, 0]} />
						<Html center distanceFactor={20} position={[0, 2.52, 0]}>
							<div
								style={{
									padding: "4px 8px",
									borderRadius: 999,
									background: "rgba(18, 24, 28, 0.82)",
									border: `1px solid ${markerColor}`,
									color: "#f8f5ea",
									fontSize: 11,
									fontWeight: 700,
									letterSpacing: "0.04em",
									whiteSpace: "nowrap",
								}}
							>
								{landmark.displayName}
							</div>
						</Html>
					</group>
				);
			})}
		</group>
	);
}

for (const assetPath of [
	"/kenney_platformer-kit/Models/GLB format/block-grass-large-tall.glb",
	"/kenney_platformer-kit/Models/GLB format/block-grass-large-slope.glb",
	"/kenney_platformer-kit/Models/GLB format/block-grass-overhang-edge.glb",
	"/kenney_platformer-kit/Models/GLB format/tree-pine.glb",
	"/kenney_platformer-kit/Models/GLB format/flowers.glb",
	"/kenney_platformer-kit/Models/GLB format/rocks.glb",
	"/kenney_platformer-kit/Models/GLB format/fence-broken.glb",
	"/kenney_platformer-kit/Models/GLB format/sign.glb",
	"/kenney_platformer-kit/Models/GLB format/arrows.glb",
]) {
	useGLTF.preload(assetPath);
}
