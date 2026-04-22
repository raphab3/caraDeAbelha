import { memo } from "react";
import type { ThreeEvent } from "@react-three/fiber";

import type { WorldHiveState } from "../../types/game";
import { toSceneAxis, toTerrainSurfaceY } from "./worldSurface";

const HIVE_BODY_Y = 0.18;
const HIVE_RING_POSITIONS = [0.09, 0.19, 0.29];

/**
 * HiveRenderer renders a readable hive silhouette and glow ring so the
 * deposit point is always visible near the player.
 */
export function HiveRenderer({
	hives,
	onHiveClick,
	selectedHiveId,
}: {
	hives: WorldHiveState[];
	onHiveClick?: (event: ThreeEvent<PointerEvent>, hiveId: string, index: number) => void;
	selectedHiveId?: string;
}) {
	if (hives.length === 0) {
		return null;
	}

	return (
		<group>
			{hives.map((hive, index) => (
				<HiveVisual
					key={hive.id}
					hive={hive}
					index={index}
					isSelected={hive.id === selectedHiveId}
					onHiveClick={onHiveClick}
				/>
			))}
		</group>
	);
}

interface HiveVisualProps {
	hive: WorldHiveState;
	index: number;
	isSelected: boolean;
	onHiveClick?: (event: ThreeEvent<PointerEvent>, hiveId: string, index: number) => void;
}

const HiveVisual = memo(function HiveVisual({ hive, index, isSelected, onHiveClick }: HiveVisualProps) {
	const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
		event.stopPropagation();
		onHiveClick?.(event, hive.id, index);
	};

	return (
		<group
			position={[toSceneAxis(hive.x), toTerrainSurfaceY(hive.groundY ?? 0) + 0.05, toSceneAxis(hive.y)]}
			rotation={[0, (toSceneAxis(hive.x) - toSceneAxis(hive.y)) * 0.03, 0]}
			scale={0.95 * hive.scale}
		>
			<mesh castShadow receiveShadow position={[0, HIVE_BODY_Y, 0]} onPointerDown={handlePointerDown}>
				<cylinderGeometry args={[0.18, 0.28, 0.38, 18]} />
				<meshStandardMaterial color={hive.toneColor} emissive={isSelected ? "#ffe28f" : "#000000"} emissiveIntensity={isSelected ? 0.5 : 0} roughness={0.72} />
			</mesh>

			{HIVE_RING_POSITIONS.map((ringY, ringIndex) => (
				<mesh castShadow key={`${hive.id}:ring:${ringIndex}`} position={[0, ringY, 0]} rotation={[Math.PI / 2, 0, 0]} onPointerDown={handlePointerDown}>
					<torusGeometry args={[0.22, 0.028, 10, 24]} />
					<meshStandardMaterial color="#7a4c16" roughness={0.58} />
				</mesh>
			))}

			<mesh position={[0, 0.44, 0]} onPointerDown={handlePointerDown}>
				<sphereGeometry args={[0.12, 16, 16]} />
				<meshStandardMaterial color={hive.glowColor} emissive={hive.glowColor} emissiveIntensity={isSelected ? 1.7 : 1.2} transparent opacity={0.72} />
			</mesh>

			<mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} onPointerDown={handlePointerDown}>
				<ringGeometry args={[0.28, 0.36, 24]} />
				<meshBasicMaterial color={isSelected ? "#fff1a6" : hive.glowColor} transparent opacity={isSelected ? 0.92 : 0.7} />
			</mesh>

			{isSelected ? (
				<mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
					<ringGeometry args={[0.4, 0.52, 28]} />
					<meshBasicMaterial color="#ffe18b" transparent opacity={0.8} />
				</mesh>
			) : null}
		</group>
	);
});
