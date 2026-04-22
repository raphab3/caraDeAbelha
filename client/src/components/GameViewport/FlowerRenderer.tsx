import { Html } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import {
	CylinderGeometry,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Object3D,
	RingGeometry,
	SphereGeometry,
	type BufferGeometry,
	type InstancedMesh,
	type Material,
} from "three";

import type { FlowerInteractionState, WorldFlowerState } from "../../types/game";
import { toSceneAxis, toTerrainSurfaceY } from "./worldSurface";

// ─── Constants ────────────────────────────────────────────────────────────────

const FLOWER_STEM_HEIGHT = 0.28;
const FLOWER_HEAD_Y = 0.14;
const FLOWER_PETAL_RADIUS = 0.14;
const FLOWER_PETAL_SIZE = 0.11;
const FLOWER_CORE_SIZE = 0.09;
const FLOWER_BASE_SCALE = 1.08;
const FLOWER_HIT_RADIUS = 0.24;
const DEFAULT_FLOWER_COLLECT_DURATION_MS = 1150;

const PETAL_LOCAL_OFFSETS: [number, number, number][] = [
	[0, FLOWER_HEAD_Y, FLOWER_PETAL_RADIUS],
	[FLOWER_PETAL_RADIUS, FLOWER_HEAD_Y, 0],
	[0, FLOWER_HEAD_Y, -FLOWER_PETAL_RADIUS],
	[-FLOWER_PETAL_RADIUS, FLOWER_HEAD_Y, 0],
	[FLOWER_PETAL_RADIUS * 0.72, FLOWER_HEAD_Y, FLOWER_PETAL_RADIUS * 0.72],
];

// Server-defined palettes — must match ws_world.go
const PETAL_PALETTE = ["#fff2a1", "#ffd4ef", "#d8ffd0", "#ffe0b2", "#f6f1ff"] as const;
const CORE_PALETTE = ["#8d5519", "#774011", "#5f360f"] as const;

// ─── Instance batch ────────────────────────────────────────────────────────────

interface InstanceBatch {
	positions: Float32Array;
	scales: Float32Array;
	count: number;
}

interface FlowerInstanceData {
	stems: InstanceBatch;
	petalGroups: { color: string; batch: InstanceBatch }[];
	coreGroups: { color: string; batch: InstanceBatch }[];
	hits: InstanceBatch;
	hitIds: string[];
}

function buildFlowerInstanceData(flowers: WorldFlowerState[]): FlowerInstanceData {
	const n = flowers.length;
	const stemPos = new Float32Array(n * 3);
	const stemScale = new Float32Array(n);
	const hitPos = new Float32Array(n * 3);
	const hitScale = new Float32Array(n);
	const hitIds: string[] = new Array(n);

	const petalMap = new Map<string, { pos: number[]; sc: number[] }>();
	const coreMap = new Map<string, { pos: number[]; sc: number[] }>();

	for (let i = 0; i < n; i++) {
		const f = flowers[i];
		const gx = toSceneAxis(f.x);
		const gy = toTerrainSurfaceY(f.groundY ?? 0) + 0.02;
		const gz = toSceneAxis(f.y);
		const gs = FLOWER_BASE_SCALE * f.scale;
		const yaw = (gx + gz) * 0.05;
		const cosYaw = Math.cos(yaw);
		const sinYaw = Math.sin(yaw);

		stemPos[i * 3] = gx;
		stemPos[i * 3 + 1] = gy + FLOWER_STEM_HEIGHT * 0.5 * gs;
		stemPos[i * 3 + 2] = gz;
		stemScale[i] = gs;

		hitPos[i * 3] = gx;
		hitPos[i * 3 + 1] = gy + FLOWER_HEAD_Y * gs;
		hitPos[i * 3 + 2] = gz;
		hitScale[i] = gs;
		hitIds[i] = f.id;

		let pg = petalMap.get(f.petalColor);
		if (!pg) { pg = { pos: [], sc: [] }; petalMap.set(f.petalColor, pg); }
		for (const [ox, oy, oz] of PETAL_LOCAL_OFFSETS) {
			const wx = ox * cosYaw + oz * sinYaw;
			const wz = -ox * sinYaw + oz * cosYaw;
			pg.pos.push(gx + wx * gs, gy + oy * gs, gz + wz * gs);
			pg.sc.push(gs);
		}

		let cg = coreMap.get(f.coreColor);
		if (!cg) { cg = { pos: [], sc: [] }; coreMap.set(f.coreColor, cg); }
		cg.pos.push(gx, gy + (FLOWER_HEAD_Y + 0.01) * gs, gz);
		cg.sc.push(gs);
	}

	const toBatch = (pos: number[] | Float32Array, sc: number[] | Float32Array): InstanceBatch => ({
		positions: pos instanceof Float32Array ? pos : new Float32Array(pos),
		scales: sc instanceof Float32Array ? sc : new Float32Array(sc),
		count: sc.length,
	});

	return {
		stems: toBatch(stemPos, stemScale),
		petalGroups: Array.from(petalMap.entries()).map(([color, d]) => ({
			color,
			batch: toBatch(d.pos, d.sc),
		})),
		coreGroups: Array.from(coreMap.entries()).map(([color, d]) => ({
			color,
			batch: toBatch(d.pos, d.sc),
		})),
		hits: toBatch(hitPos, hitScale),
		hitIds,
	};
}

// ─── Instanced layer ───────────────────────────────────────────────────────────

/**
 * useLayoutEffect fires synchronously after React commit, before Three.js RAF.
 * Matrices are set before the first paint — no "identity frame" flash.
 */
function FlowerLayer({
	batch,
	geometry,
	material,
	castShadow = false,
	computeSphere = false,
	onPointerDown,
	onPointerMove,
	onPointerOut,
}: {
	batch: InstanceBatch;
	geometry: BufferGeometry;
	material: Material;
	castShadow?: boolean;
	computeSphere?: boolean;
	onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
	onPointerMove?: (event: ThreeEvent<PointerEvent>) => void;
	onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
}) {
	const meshRef = useRef<InstancedMesh>(null);
	const dummy = useMemo(() => new Object3D(), []);

	useLayoutEffect(() => {
		const mesh = meshRef.current;
		if (!mesh || batch.count === 0) return;

		mesh.count = batch.count;
		for (let i = 0; i < batch.count; i++) {
			dummy.position.set(
				batch.positions[i * 3],
				batch.positions[i * 3 + 1],
				batch.positions[i * 3 + 2],
			);
			dummy.scale.setScalar(batch.scales[i]);
			dummy.rotation.set(0, 0, 0);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
		}

		mesh.instanceMatrix.needsUpdate = true;
		if (computeSphere) {
			mesh.computeBoundingSphere();
		}
	}, [dummy, batch, computeSphere]);

	if (batch.count === 0) return null;

	return (
		<instancedMesh
			ref={meshRef}
			args={[geometry, material, batch.count]}
			castShadow={castShadow}
			frustumCulled={false}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerOut={onPointerOut}
		/>
	);
}

function resolveFlowerDisplayName(flower: WorldFlowerState): string {
	switch (flower.petalColor) {
		case "#fff2a1":
			return "Flor dourada";
		case "#ffd4ef":
			return "Flor rosa";
		case "#d8ffd0":
			return "Flor de menta";
		case "#ffe0b2":
			return "Flor de mel";
		case "#f6f1ff":
			return "Flor lilas";
		default:
			return "Flor silvestre";
	}
}

function getFlowerProgressLabel(isCollecting: boolean): string {
	return isCollecting ? "Retirando polen" : "Alvo ao alcance";
}

// ─── Public component ──────────────────────────────────────────────────────────

export function FlowerRenderer({
	collectDurationMs,
	flowerInteraction,
	flowers,
	onFlowerClick,
	selectedFlowerId,
}: {
	collectDurationMs?: number;
	flowerInteraction?: FlowerInteractionState;
	flowers: WorldFlowerState[];
	onFlowerClick?: (event: ThreeEvent<PointerEvent>, flowerId: string, index: number) => void;
	selectedFlowerId?: string;
}) {
	const [hoveredFlowerId, setHoveredFlowerId] = useState<string>();
	const instanceData = useMemo(() => buildFlowerInstanceData(flowers), [flowers]);
	const selectedFlower = useMemo(
		() => flowers.find((flower) => flower.id === selectedFlowerId),
		[flowers, selectedFlowerId],
	);
	const hoveredFlower = useMemo(
		() => flowers.find((flower) => flower.id === hoveredFlowerId),
		[flowers, hoveredFlowerId],
	);
	const isCollecting = flowerInteraction?.phase === "collecting" && flowerInteraction.flowerId === selectedFlowerId;
	const focusFlower = isCollecting ? selectedFlower : hoveredFlower ?? selectedFlower;
	const focusIds = useMemo(() => {
		const ids = new Set<string>();
		if (selectedFlowerId) {
			ids.add(selectedFlowerId);
		}
		if (hoveredFlowerId) {
			ids.add(hoveredFlowerId);
		}
		return Array.from(ids);
	}, [hoveredFlowerId, selectedFlowerId]);
	const focusFlowers = useMemo(
		() => focusIds.map((id) => flowers.find((flower) => flower.id === id)).filter((flower): flower is WorldFlowerState => Boolean(flower)),
		[flowers, focusIds],
	);

	const stemGeometry = useMemo(() => new CylinderGeometry(0.018, 0.026, FLOWER_STEM_HEIGHT, 8), []);
	const petalGeometry = useMemo(() => new SphereGeometry(FLOWER_PETAL_SIZE, 10, 10), []);
	const coreGeometry = useMemo(() => new SphereGeometry(FLOWER_CORE_SIZE, 12, 12), []);
	const hitGeometry = useMemo(() => new SphereGeometry(FLOWER_HIT_RADIUS, 6, 6), []);
	const selectedHaloGeometry = useMemo(() => new RingGeometry(0.2, 0.28, 28), []);
	const focusAuraGeometry = useMemo(() => new SphereGeometry(0.22, 20, 20), []);

	const stemMaterial = useMemo(() => new MeshStandardMaterial({ color: "#2d8a57", roughness: 0.88 }), []);
	const hitMaterial = useMemo(() => new MeshBasicMaterial({ visible: false }), []);
	const selectedHaloMaterial = useMemo(
		() => new MeshBasicMaterial({ color: "#9affd9", opacity: 0.85, transparent: true }),
		[],
	);
	const hoveredHaloMaterial = useMemo(
		() => new MeshBasicMaterial({ color: "#fff79a", opacity: 0.92, transparent: true }),
		[],
	);
	const focusAuraMaterial = useMemo(
		() => new MeshBasicMaterial({ color: "#fff5ab", opacity: 0.18, transparent: true }),
		[],
	);
	const petalMaterials = useMemo(
		() => new Map<string, MeshStandardMaterial>(PETAL_PALETTE.map((c) => [c, new MeshStandardMaterial({ color: c, roughness: 0.56 })])),
		[],
	);
	const coreMaterials = useMemo(
		() => new Map<string, MeshStandardMaterial>(CORE_PALETTE.map((c) => [c, new MeshStandardMaterial({ color: c, roughness: 0.44 })])),
		[],
	);

	const handleHit = onFlowerClick
		? (event: ThreeEvent<PointerEvent>) => {
				event.stopPropagation();
				const id = event.instanceId;
				if (id == null) return;
				const flowerId = instanceData.hitIds[id];
				if (!flowerId) return;
				setHoveredFlowerId(flowerId);
				onFlowerClick(event, flowerId, id);
			}
		: undefined;
	const handleHoverMove = (event: ThreeEvent<PointerEvent>) => {
		event.stopPropagation();
		const id = event.instanceId;
		if (id == null) {
			return;
		}
		const flowerId = instanceData.hitIds[id];
		if (!flowerId) {
			return;
		}
		setHoveredFlowerId((current) => (current === flowerId ? current : flowerId));
	};
	const handleHoverOut = () => {
		setHoveredFlowerId(undefined);
	};

	if (flowers.length === 0) return null;

	return (
		<group>
			<FlowerLayer batch={instanceData.stems} geometry={stemGeometry} material={stemMaterial} castShadow />

			{instanceData.petalGroups.map(({ color, batch }) => {
				const mat = petalMaterials.get(color);
				if (!mat) return null;
				return (
					<FlowerLayer
						key={`p:${color}`}
						batch={batch}
						geometry={petalGeometry}
						material={mat}
						castShadow
					/>
				);
			})}

			{instanceData.coreGroups.map(({ color, batch }) => {
				const mat = coreMaterials.get(color);
				if (!mat) return null;
				return (
					<FlowerLayer
						key={`c:${color}`}
						batch={batch}
						geometry={coreGeometry}
						material={mat}
						castShadow
					/>
				);
			})}

			{focusFlowers.map((flower) => {
				const isSelected = flower.id === selectedFlowerId;
				const haloMaterial = isSelected ? selectedHaloMaterial : hoveredHaloMaterial;
				const haloColor = isSelected ? "#8effdc" : "#fff59d";
				return (
					<group
						key={`focus:${flower.id}`}
						position={[
							toSceneAxis(flower.x),
							toTerrainSurfaceY(flower.groundY ?? 0) + 0.28 * flower.scale,
							toSceneAxis(flower.y),
						]}
					>
						<mesh geometry={focusAuraGeometry} material={focusAuraMaterial} position={[0, 0.04, 0]} />
						<mesh rotation={[Math.PI / 2, 0, 0]}>
							<primitive attach="geometry" object={selectedHaloGeometry} />
							<primitive attach="material" object={haloMaterial} />
						</mesh>
						<pointLight color={haloColor} distance={1.9} intensity={isSelected ? 1.15 : 0.9} position={[0, 0.08, 0]} />
					</group>
				);
			})}

			{focusFlower ? (
				<group
					position={[
						toSceneAxis(focusFlower.x),
						toTerrainSurfaceY(focusFlower.groundY ?? 0) + 0.92 * focusFlower.scale,
						toSceneAxis(focusFlower.y),
					]}
				>
					<Html center distanceFactor={8} sprite transform>
						<div className={`flower-focus-card${isCollecting ? " flower-focus-card--collecting" : ""}`}>
							<div className="flower-focus-card__title">{resolveFlowerDisplayName(focusFlower)}</div>
							<div className="flower-focus-card__subtitle">{getFlowerProgressLabel(isCollecting)}</div>
							{isCollecting ? (
								<div className="flower-focus-progress" aria-label="Progresso de coleta">
									<div
										key={`${focusFlower.id}:${flowerInteraction?.startedAt ?? 0}`}
										className="flower-focus-progress__fill"
										style={{ animationDuration: `${collectDurationMs ?? DEFAULT_FLOWER_COLLECT_DURATION_MS}ms` }}
									/>
								</div>
							) : null}
						</div>
					</Html>
				</group>
			) : null}

			{handleHit && (
				<FlowerLayer
					batch={instanceData.hits}
					geometry={hitGeometry}
					material={hitMaterial}
					computeSphere
					onPointerDown={handleHit}
					onPointerMove={handleHoverMove}
					onPointerOut={handleHoverOut}
				/>
			)}
		</group>
	);
}
