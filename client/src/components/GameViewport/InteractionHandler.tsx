import { useCallback } from "react";
import type { ThreeEvent } from "@react-three/fiber";

import type { GameSessionState, WorldFlowerState, WorldHiveState } from "../../types/game";

/**
 * InteractionHandler: Manages click events on interactive entities (flowers and hives).
 *
 * Responsibilities:
 * - Validate click distance against player position
 * - Route interaction callbacks to appropriate handlers
 * - Prevent out-of-range interactions
 *
 * Future enhancements:
 * - Support for proximity-based hints
 * - Range particle effects
 * - Extended interaction types (combat, dialogue, quest pickup)
 */

export interface InteractionHandlerProps {
	/** Current game session state with player position */
	gameSession: GameSessionState;

	/** All flower entities in the world */
	flowers: WorldFlowerState[];

	/** All hive entities in the world */
	hives: WorldHiveState[];

	/** Callback when a flower is clicked */
	onFlowerClick?: (flowerId: string, distance: number) => void;

	/** Callback when a hive is clicked */
	onHiveClick?: (hiveId: string, distance: number) => void;

	/** Maximum distance for interaction validation (world units) */
	interactionRadius?: number;
}

const DEFAULT_INTERACTION_RADIUS = 2.5;

/**
 * Calculate distance between player and a world entity
 */
function calculateDistance(playerX: number, playerY: number, entityX: number, entityY: number): number {
	const dx = entityX - playerX;
	const dy = entityY - playerY;
	return Math.hypot(dx, dy);
}

/**
 * Validate if player is within interaction range of an entity
 */
function isWithinInteractionRange(
	playerX: number,
	playerY: number,
	entityX: number,
	entityY: number,
	interactionRadius: number,
): boolean {
	return calculateDistance(playerX, playerY, entityX, entityY) <= interactionRadius;
}

/**
 * Create a handler for flower clicks
 */
export function createFlowerClickHandler(
	gameSession: GameSessionState,
	flowers: WorldFlowerState[],
	interactionRadius: number,
	onFlowerClick?: (flowerId: string, distance: number) => void,
): (event: ThreeEvent<PointerEvent>, flowerId: string, index: number) => void {
	return useCallback(
		(event: ThreeEvent<PointerEvent>, flowerId: string, _index: number) => {
			if (onFlowerClick) {
				event.stopPropagation();
			}

			// Guard: player must be connected
			if (!gameSession.localPlayerId) {
				return;
			}

			// Find the flower being clicked
			const flower = flowers.find((f) => f.id === flowerId);
			if (!flower) {
				return;
			}

			// Find the local player's current position
			const localPlayer = gameSession.players.find((p) => p.id === gameSession.localPlayerId);
			if (!localPlayer) {
				return;
			}

			// Calculate distance
			const distance = calculateDistance(localPlayer.x, localPlayer.y, flower.x, flower.y);

			// Validate distance
			if (!isWithinInteractionRange(localPlayer.x, localPlayer.y, flower.x, flower.y, interactionRadius)) {
				// Out of range: silent fail or show feedback (handled by game loop HUD)
				return;
			}

			// Trigger callback if provided
			if (onFlowerClick) {
				onFlowerClick(flowerId, distance);
			}
		},
		[gameSession.localPlayerId, gameSession.players, flowers, interactionRadius, onFlowerClick],
	);
}

/**
 * Create a handler for hive clicks
 */
export function createHiveClickHandler(
	gameSession: GameSessionState,
	hives: WorldHiveState[],
	interactionRadius: number,
	onHiveClick?: (hiveId: string, distance: number) => void,
): (event: ThreeEvent<PointerEvent>, hiveId: string, index: number) => void {
	return useCallback(
		(event: ThreeEvent<PointerEvent>, hiveId: string, _index: number) => {
			if (onHiveClick) {
				event.stopPropagation();
			}

			// Guard: player must be connected
			if (!gameSession.localPlayerId) {
				return;
			}

			// Find the hive being clicked
			const hive = hives.find((h) => h.id === hiveId);
			if (!hive) {
				return;
			}

			// Find the local player's current position
			const localPlayer = gameSession.players.find((p) => p.id === gameSession.localPlayerId);
			if (!localPlayer) {
				return;
			}

			// Calculate distance
			const distance = calculateDistance(localPlayer.x, localPlayer.y, hive.x, hive.y);

			// Validate distance
			if (!isWithinInteractionRange(localPlayer.x, localPlayer.y, hive.x, hive.y, interactionRadius)) {
				// Out of range: silent fail or show feedback (handled by game loop HUD)
				return;
			}

			// Trigger callback if provided
			if (onHiveClick) {
				onHiveClick(hiveId, distance);
			}
		},
		[gameSession.localPlayerId, gameSession.players, hives, interactionRadius, onHiveClick],
	);
}

/**
 * Hook-style factory: Returns bound click handlers for use in FlowerRenderer and HiveRenderer
 * Usage example:
 *   const handlers = useInteractionHandlers({
 *     gameSession,
 *     flowers,
 *     hives,
 *     onFlowerClick,
 *     onHiveClick,
 *     interactionRadius: 2.5,
 *   });
 */
export function useInteractionHandlers(props: InteractionHandlerProps) {
	const radius = props.interactionRadius ?? DEFAULT_INTERACTION_RADIUS;

	const handleFlowerClick = createFlowerClickHandler(
		props.gameSession,
		props.flowers,
		radius,
		props.onFlowerClick,
	);

	const handleHiveClick = createHiveClickHandler(props.gameSession, props.hives, radius, props.onHiveClick);

	return {
		handleFlowerClick,
		handleHiveClick,
		interactionRadius: radius,
	};
}
