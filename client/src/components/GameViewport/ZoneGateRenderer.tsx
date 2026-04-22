import { useEffect, useMemo, useRef } from "react";
import type { BufferGeometry, Material } from "three";
import {
	CylinderGeometry,
	DoubleSide,
	InstancedMesh,
	MeshStandardMaterial,
	Object3D,
} from "three";
import React from "react";

import type { MapZone, PlayerProgressState } from "../../types/game";
import { toSceneAxis, toTerrainSurfaceY } from "./worldSurface";

/**
 * ZoneGateRenderer: Renders golden honeycomb gates at zone boundaries.
 * Gates are only rendered for locked zones and fade when unlocked.
 * Uses instancing for performance.
 */

interface GateInstance {
	position: [number, number, number];
	rotation?: [number, number, number];
	scale?: number | [number, number, number];
	opacity: number;
}

interface ZoneGateRendererProps {
	zones?: MapZone[];
	playerProgress?: PlayerProgressState;
	detailFocus?: { x: number; y: number };
}

const GATE_DETAIL_DISTANCE = 32;
const HONEYCOMB_COLOR = "#d4a574";
const HONEYCOMB_EMISSIVE = "#8b6f47";
const GATE_SCALE_BASE = 2.4;
const GATE_HEIGHT = 4.2;

function isWithinDetailRange(
	detailFocus: { x: number; y: number } | undefined,
	worldX: number,
	worldY: number,
	maxDistance: number,
): boolean {
	if (!detailFocus) {
		return true;
	}
	return Math.hypot(worldX - detailFocus.x, worldY - detailFocus.y) <= maxDistance;
}

function buildGateInstances(
	zones: MapZone[] | undefined,
	playerProgress: PlayerProgressState | undefined,
	detailFocus: { x: number; y: number } | undefined,
): GateInstance[] {
	if (!zones || !playerProgress) {
		return [];
	}

	const gates: GateInstance[] = [];
	const unlockedSet = new Set(playerProgress.unlockedZoneIds);

	for (const zone of zones) {
		// Only create gates for locked zones
		if (unlockedSet.has(zone.id)) {
			continue;
		}

		// Calculate gate position at zone boundary (center of boundary line)
		// Place gates along multiple points on the perimeter for better coverage
		const zoneCenterX = (zone.x1 + zone.x2) * 0.5;
		const zoneCenterZ = (zone.z1 + zone.z2) * 0.5;

		if (!isWithinDetailRange(detailFocus, zoneCenterX, zoneCenterZ, GATE_DETAIL_DISTANCE)) {
			continue;
		}

		// Create gates at cardinal boundary positions
		const boundaryX1 = zone.x1;
		const boundaryX2 = zone.x2;
		const boundaryZ1 = zone.z1;
		const boundaryZ2 = zone.z2;

		// West boundary gate
		gates.push({
			position: [
				toSceneAxis(boundaryX1),
				toTerrainSurfaceY(0) + GATE_HEIGHT * 0.5,
				toSceneAxis(zoneCenterZ),
			],
			rotation: [0, Math.PI * 0.5, 0],
			scale: GATE_SCALE_BASE,
			opacity: 0.85,
		});

		// East boundary gate
		gates.push({
			position: [
				toSceneAxis(boundaryX2),
				toTerrainSurfaceY(0) + GATE_HEIGHT * 0.5,
				toSceneAxis(zoneCenterZ),
			],
			rotation: [0, Math.PI * 0.5, 0],
			scale: GATE_SCALE_BASE,
			opacity: 0.85,
		});

		// South boundary gate
		gates.push({
			position: [
				toSceneAxis(zoneCenterX),
				toTerrainSurfaceY(0) + GATE_HEIGHT * 0.5,
				toSceneAxis(boundaryZ1),
			],
			rotation: [0, 0, 0],
			scale: GATE_SCALE_BASE,
			opacity: 0.85,
		});

		// North boundary gate
		gates.push({
			position: [
				toSceneAxis(zoneCenterX),
				toTerrainSurfaceY(0) + GATE_HEIGHT * 0.5,
				toSceneAxis(boundaryZ2),
			],
			rotation: [0, 0, 0],
			scale: GATE_SCALE_BASE,
			opacity: 0.85,
		});
	}

	return gates;
}

/**
 * InstancedGateLayer: Renders a layer of honeycomb gates with instancing.
 * Uses a cylinder geometry rotated to create a hexagonal honeycomb appearance.
 */
const InstancedGateLayer = React.forwardRef<
	InstancedMesh,
	{
		geometry: BufferGeometry;
		material: Material;
		gates: GateInstance[];
	}
>(({ geometry, material, gates }, ref) => {
	useEffect(() => {
		const mesh = ref as React.MutableRefObject<InstancedMesh | null>;
		if (!mesh.current) {
			return;
		}

		const dummy = new Object3D();
		mesh.current.count = gates.length;

		for (let idx = 0; idx < gates.length; idx += 1) {
			const gate = gates[idx];
			dummy.position.set(...gate.position);

			if (gate.rotation) {
				dummy.rotation.set(...gate.rotation);
			} else {
				dummy.rotation.set(0, 0, 0);
			}

			if (typeof gate.scale === "number") {
				dummy.scale.setScalar(gate.scale);
			} else if (gate.scale) {
				dummy.scale.set(...gate.scale);
			} else {
				dummy.scale.set(1, 1, 1);
			}

			dummy.updateMatrix();
			mesh.current.setMatrixAt(idx, dummy.matrix);
		}

		mesh.current.instanceMatrix.needsUpdate = true;
	}, [gates]);

	if (gates.length === 0) {
		return null;
	}

	return (
		<instancedMesh
			ref={ref}
			args={[geometry, material, Math.max(gates.length, 1)]}
			castShadow
			receiveShadow
			frustumCulled={false}
		/>
	);
});

InstancedGateLayer.displayName = "InstancedGateLayer";

export function ZoneGateRenderer({
	zones,
	playerProgress,
	detailFocus,
}: ZoneGateRendererProps) {
	const meshRef = useRef<InstancedMesh>(null);

	// Create honeycomb gate geometry: hexagonal prism
	const gateGeometry = useMemo(() => {
		// Use a cylinder with low segment count for hexagonal appearance
		const geometry = new CylinderGeometry(1, 1, GATE_HEIGHT, 6, 4, false);
		geometry.translate(0, 0, 0);
		return geometry;
	}, []);

	// Create golden honeycomb material with emit for glow
	const gateMaterial = useMemo(() => {
		return new MeshStandardMaterial({
			color: HONEYCOMB_COLOR,
			emissive: HONEYCOMB_EMISSIVE,
			emissiveIntensity: 0.6,
			opacity: 0.7,
			transparent: true,
			side: DoubleSide,
			depthWrite: false,
			roughness: 0.4,
			metalness: 0.2,
		});
	}, []);

	const gateInstances = useMemo(
		() => buildGateInstances(zones, playerProgress, detailFocus),
		[zones, playerProgress, detailFocus?.x, detailFocus?.y],
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (gateGeometry) {
				gateGeometry.dispose();
			}
			if (gateMaterial) {
				gateMaterial.dispose();
			}
		};
	}, [gateGeometry, gateMaterial]);

	if (!zones || !playerProgress || gateInstances.length === 0) {
		return null;
	}

	return (
		<group>
			<InstancedGateLayer
				ref={meshRef}
				geometry={gateGeometry}
				material={gateMaterial}
				gates={gateInstances}
			/>
		</group>
	);
}
