import { useEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import {
	CylinderGeometry,
	SphereGeometry,
	MeshStandardMaterial,
	MeshBasicMaterial,
	InstancedMesh,
	Object3D,
	type BufferGeometry,
	type Material,
} from "three";

import type { WorldFlowerState } from "../../types/game";
import { toSceneAxis, toTerrainSurfaceY } from "./worldSurface";

// ─── Constants ────────────────────────────────────────────────────────────────
const FLOWER_STEM_HEIGHT = 0.28;
const FLOWER_STEM_Y = -0.02;
const FLOWER_HEAD_Y = 0.14;
const FLOWER_PETAL_RADIUS = 0.14;
const FLOWER_PETAL_SIZE = 0.11;
const FLOWER_CORE_SIZE = 0.09;
const FLOWER_CORE_Y = FLOWER_HEAD_Y + 0.01;

const PETAL_OFFSETS: readonly [number, number, number][] = [
	[0, FLOWER_HEAD_Y, FLOWER_PETAL_RADIUS],
	[FLOWER_PETAL_RADIUS, FLOWER_HEAD_Y, 0],
	[0, FLOWER_HEAD_Y, -FLOWER_PETAL_RADIUS],
	[-FLOWER_PETAL_RADIUS, FLOWER_HEAD_Y, 0],
	[FLOWER_PETAL_RADIUS * 0.72, FLOWER_HEAD_Y, FLOWER_PETAL_RADIUS * 0.72],
];

// ─── Shared module-level geometries and materials (created once) ─────────────
const stemGeometry = new CylinderGeometry(0.018, 0.026, FLOWER_STEM_HEIGHT, 8);
const petalGeometry = new SphereGeometry(FLOWER_PETAL_SIZE, 10, 10);
const coreGeometry = new SphereGeometry(FLOWER_CORE_SIZE, 12, 12);
const hitGeometry = new SphereGeometry(0.24, 6, 6);

const stemMaterial = new MeshStandardMaterial({ color: "#2d8a57", roughness: 0.88 });
const hitMaterial = new MeshBasicMaterial({ visible: false });

const colorMaterialCache = new Map<string, MeshStandardMaterial>();
function getColorMaterial(color: string, roughness: number): MeshStandardMaterial {
	const key = `${color}:${roughness}`;
	let mat = colorMaterialCache.get(key);
	if (!mat) {
		mat = new MeshStandardMaterial({ color, roughness });
		colorMaterialCache.set(key, mat);
	}
	return mat;
}

// ─── Instance data ────────────────────────────────────────────────────────────
interface InstanceLayer {
	positions: Float32Array; // stride-3: x, y, z per instance
	scales: Float32Array;    // uniform scale per instance
	count: number;
}

interface FlowerRenderData {
	stemLayer: InstanceLayer;
	petalLayers: { color: string; layer: InstanceLayer }[];
	coreLayers: { color: string; layer: InstanceLayer }[];
	hitLayer: InstanceLayer;
	flowerIds: string[]; // maps hitLayer instanceId → flower.id
}

function buildFlowerRenderData(flowers: WorldFlowerState[]): FlowerRenderData {
	const n = flowers.length;

	const stemPos = new Float32Array(n * 3);
	const stemScale = new Float32Array(n);
	const hitPos = new Float32Array(n * 3);
	const hitScale = new Float32Array(n);
	const flowerIds: string[] = new Array(n);

	const petalsByColor = new Map<string, { pos: number[]; sc: number[] }>();
	const coresByColor = new Map<string, { pos: number[]; sc: number[] }>();

	for (let i = 0; i < n; i++) {
		const flower = flowers[i];
		const gx = toSceneAxis(flower.x);
		const gy = toTerrainSurfaceY(flower.groundY ?? 0) + 0.02;
		const gz = toSceneAxis(flower.y);
		const gs = 1.65 * flower.scale;
		const yaw = (gx + gz) * 0.05;
		const cosYaw = Math.cos(yaw);
		const sinYaw = Math.sin(yaw);

		// Stem (centered at mid-height in local space)
		stemPos[i * 3] = gx;
		stemPos[i * 3 + 1] = gy + (FLOWER_STEM_Y + FLOWER_STEM_HEIGHT * 0.5) * gs;
		stemPos[i * 3 + 2] = gz;
		stemScale[i] = gs;

		// Hitbox centered at flower head
		hitPos[i * 3] = gx;
		hitPos[i * 3 + 1] = gy + FLOWER_HEAD_Y * gs;
		hitPos[i * 3 + 2] = gz;
		hitScale[i] = gs;
		flowerIds[i] = flower.id;

		// Petals: rotate local offset by yaw around Y axis
		let pg = petalsByColor.get(flower.petalColor);
		if (!pg) {
			pg = { pos: [], sc: [] };
			petalsByColor.set(flower.petalColor, pg);
		}
		for (const [ox, oy, oz] of PETAL_OFFSETS) {
			const wx = ox * cosYaw + oz * sinYaw;
			const wz = -ox * sinYaw + oz * cosYaw;
			pg.pos.push(gx + wx * gs, gy + oy * gs, gz + wz * gs);
			pg.sc.push(gs);
		}

		// Core
		let cg = coresByColor.get(flower.coreColor);
		if (!cg) {
			cg = { pos: [], sc: [] };
			coresByColor.set(flower.coreColor, cg);
		}
		cg.pos.push(gx, gy + FLOWER_CORE_Y * gs, gz);
		cg.sc.push(gs);
	}

	const toLayer = (pos: number[] | Float32Array, sc: number[] | Float32Array): InstanceLayer => ({
		positions: pos instanceof Float32Array ? pos : new Float32Array(pos),
		scales: sc instanceof Float32Array ? sc : new Float32Array(sc),
		count: sc.length,
	});

	return {
		stemLayer: toLayer(stemPos, stemScale),
		petalLayers: Array.from(petalsByColor.entries()).map(([color, d]) => ({
			color,
			layer: toLayer(d.pos, d.sc),
		})),
		coreLayers: Array.from(coresByColor.entries()).map(([color, d]) => ({
			color,
			layer: toLayer(d.pos, d.sc),
		})),
		hitLayer: toLayer(hitPos, hitScale),
		flowerIds,
	};
}

// ─── Instanced layer component ────────────────────────────────────────────────
function FlowerInstancedLayer({
	layer,
	geometry,
	material,
	castShadow = false,
	onPointerDown,
}: {
	layer: InstanceLayer;
	geometry: BufferGeometry;
	material: Material;
	castShadow?: boolean;
	onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}) {
	const meshRef = useRef<InstancedMesh>(null);
	const dummy = useMemo(() => new Object3D(), []);

	useEffect(() => {
		const mesh = meshRef.current;
		if (!mesh || layer.count === 0) return;

		mesh.count = layer.count;
		for (let i = 0; i < layer.count; i++) {
			dummy.position.set(layer.positions[i * 3], layer.positions[i * 3 + 1], layer.positions[i * 3 + 2]);
			dummy.scale.setScalar(layer.scales[i]);
			dummy.rotation.set(0, 0, 0);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
		}
		mesh.instanceMatrix.needsUpdate = true;
	}, [dummy, layer]);

	if (layer.count === 0) return null;

	return (
		<instancedMesh
			ref={meshRef}
			args={[geometry, material, layer.count]}
			castShadow={castShadow}
			frustumCulled={false}
			onPointerDown={onPointerDown}
		/>
	);
}

// ─── Public component ─────────────────────────────────────────────────────────
/**
 * FlowerRenderer draws all world flowers using instanced meshes.
 * 1748 flowers → ~10 draw calls (grouped by color), vs ~14 000 with per-mesh approach.
 * Click detection uses a separate invisible hitbox InstancedMesh;
 * instanceId maps back to flower.id via flowerIds array.
 */
export function FlowerRenderer({
	flowers,
	onFlowerClick,
}: {
	flowers: WorldFlowerState[];
	onFlowerClick?: (event: ThreeEvent<PointerEvent>, flowerId: string, index: number) => void;
}) {
	const renderData = useMemo(() => buildFlowerRenderData(flowers), [flowers]);

	const handleHit = onFlowerClick
		? (event: ThreeEvent<PointerEvent>) => {
				event.stopPropagation();
				const id = event.instanceId;
				if (id == null) return;
				const flowerId = renderData.flowerIds[id];
				if (!flowerId) return;
				onFlowerClick(event, flowerId, id);
			}
		: undefined;

	if (flowers.length === 0) return null;

	return (
		<group>
			{/* Stems */}
			<FlowerInstancedLayer layer={renderData.stemLayer} geometry={stemGeometry} material={stemMaterial} castShadow />

			{/* Petals grouped by color */}
			{renderData.petalLayers.map(({ color, layer }) => (
				<FlowerInstancedLayer
					key={`p:${color}`}
					layer={layer}
					geometry={petalGeometry}
					material={getColorMaterial(color, 0.56)}
					castShadow
				/>
			))}

			{/* Cores grouped by color */}
			{renderData.coreLayers.map(({ color, layer }) => (
				<FlowerInstancedLayer
					key={`c:${color}`}
					layer={layer}
					geometry={coreGeometry}
					material={getColorMaterial(color, 0.44)}
					castShadow
				/>
			))}

			{/* Invisible hitboxes for click interaction */}
			{handleHit && (
				<FlowerInstancedLayer
					layer={renderData.hitLayer}
					geometry={hitGeometry}
					material={hitMaterial}
					onPointerDown={handleHit}
				/>
			)}
		</group>
	);
}
