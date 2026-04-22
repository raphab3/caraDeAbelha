import { memo } from "react";
import type { ThreeEvent } from "@react-three/fiber";

import type { WorldFlowerState } from "../../types/game";
import { toSceneAxis, toTerrainSurfaceY } from "./worldSurface";

const FLOWER_STEM_HEIGHT = 0.28;
const FLOWER_STEM_Y = -0.02;
const FLOWER_HEAD_Y = 0.14;
const FLOWER_PETAL_RADIUS = 0.14;
const FLOWER_PETAL_SIZE = 0.11;
const FLOWER_CORE_SIZE = 0.09;

const FLOWER_PETAL_OFFSETS: [number, number, number][] = [
	[0, FLOWER_HEAD_Y, FLOWER_PETAL_RADIUS],
	[FLOWER_PETAL_RADIUS, FLOWER_HEAD_Y, 0],
	[0, FLOWER_HEAD_Y, -FLOWER_PETAL_RADIUS],
	[-FLOWER_PETAL_RADIUS, FLOWER_HEAD_Y, 0],
	[FLOWER_PETAL_RADIUS * 0.72, FLOWER_HEAD_Y, FLOWER_PETAL_RADIUS * 0.72],
];

/**
 * FlowerRenderer renders each visible flower as individual procedural meshes.
 * Flowers in the visible chunk window are expected to be pre-filtered to a
 * manageable count (≤ ~200) by InstancedWorldField before being passed here.
 */
export function FlowerRenderer({
	flowers,
	onFlowerClick,
}: {
	flowers: WorldFlowerState[];
	onFlowerClick?: (event: ThreeEvent<PointerEvent>, flowerId: string, index: number) => void;
}) {
	if (flowers.length === 0) {
		return null;
	}

	return (
		<group>
			{flowers.map((flower, index) => (
				<FlowerVisual
					key={flower.id}
					flower={flower}
					index={index}
					onFlowerClick={onFlowerClick}
				/>
			))}
		</group>
	);
}

interface FlowerVisualProps {
	flower: WorldFlowerState;
	index: number;
	onFlowerClick?: (event: ThreeEvent<PointerEvent>, flowerId: string, index: number) => void;
}

const FlowerVisual = memo(function FlowerVisual({ flower, index, onFlowerClick }: FlowerVisualProps) {
	const handlePointerDown = onFlowerClick
		? (event: ThreeEvent<PointerEvent>) => {
				event.stopPropagation();
				onFlowerClick(event, flower.id, index);
			}
		: undefined;

	return (
		<group
			position={[toSceneAxis(flower.x), toTerrainSurfaceY(flower.groundY ?? 0) + 0.02, toSceneAxis(flower.y)]}
			rotation={[0, (toSceneAxis(flower.x) + toSceneAxis(flower.y)) * 0.05, 0]}
			scale={1.65 * flower.scale}
		>
			{/* Stem */}
			<mesh castShadow position={[0, FLOWER_STEM_Y + FLOWER_STEM_HEIGHT * 0.5, 0]} onPointerDown={handlePointerDown}>
				<cylinderGeometry args={[0.018, 0.026, FLOWER_STEM_HEIGHT, 8]} />
				<meshStandardMaterial color="#2d8a57" roughness={0.88} />
			</mesh>

			{/* Petals */}
			{FLOWER_PETAL_OFFSETS.map((offset, petalIndex) => (
				<mesh castShadow key={petalIndex} position={offset} onPointerDown={handlePointerDown}>
					<sphereGeometry args={[FLOWER_PETAL_SIZE, 10, 10]} />
					<meshStandardMaterial color={flower.petalColor} roughness={0.56} />
				</mesh>
			))}

			{/* Core */}
			<mesh castShadow position={[0, FLOWER_HEAD_Y + 0.01, 0]} onPointerDown={handlePointerDown}>
				<sphereGeometry args={[FLOWER_CORE_SIZE, 12, 12]} />
				<meshStandardMaterial color={flower.coreColor} roughness={0.44} />
			</mesh>
		</group>
	);
});

