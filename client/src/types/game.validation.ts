/**
 * Validation tests for game types and message structures.
 * These are compile-time validations that verify type safety.
 * Runtime validation is minimal as TS type safety handles most validation.
 */

import type {
  InteractionResult,
  PlayerProgressState,
  PlayerStatusMessage,
  GameSessionState,
  SkillEffectsMessage,
  ServerMessage,
} from "../types/game";
import { DEFAULT_SKILL_CATALOG } from "../game/skillCatalog";

/**
 * Validates that all required type structures are correctly defined.
 * These tests primarily serve as compile-time checks.
 */
export const validateGameTypes = () => {
  // Validate PlayerProgressState structure
  const testProgress: PlayerProgressState = {
    pollenCarried: 50,
    pollenCapacity: 100,
    honey: 250,
    level: 5,
    xp: 1200,
    skillPoints: 3,
    currentZoneId: "zone_1",
    unlockedZoneIds: ["zone_1", "zone_2"],
    ownedSkillIds: ["skill:impulso"],
    equippedSkills: ["skill:impulso", "", "", ""],
    skillRuntime: [
      { slot: 0, skillId: "skill:impulso", state: "ready", cooldownEndsAt: 0 },
      { slot: 1, skillId: "", state: "ready", cooldownEndsAt: 0 },
      { slot: 2, skillId: "", state: "ready", cooldownEndsAt: 0 },
      { slot: 3, skillId: "", state: "ready", cooldownEndsAt: 0 },
    ],
    skillCatalog: DEFAULT_SKILL_CATALOG,
  };

  console.assert(testProgress.pollenCarried === 50, "PlayerProgressState: pollenCarried mismatch");
  console.assert(testProgress.pollenCapacity === 100, "PlayerProgressState: pollenCapacity mismatch");
  console.assert(testProgress.honey === 250, "PlayerProgressState: honey mismatch");

  // Validate InteractionResult structure
  const testInteraction: InteractionResult = {
    type: "interaction_result",
    action: "collect_flower",
    success: true,
    amount: 25,
    reason: "",
    reasonCode: "",
    timestamp: Date.now(),
  };

  console.assert(testInteraction.type === "interaction_result", "InteractionResult: type mismatch");
  console.assert(testInteraction.action === "collect_flower", "InteractionResult: action mismatch");
  console.assert(testInteraction.success === true, "InteractionResult: success mismatch");

  // Validate PlayerStatusMessage structure
  const testStatusMsg: PlayerStatusMessage = {
    type: "player_status",
    playerId: "p1",
    pollenCarried: 75,
    pollenCapacity: 100,
    honey: 500,
    level: 10,
    xp: 5000,
    skillPoints: 5,
    currentZoneId: "zone_2",
    unlockedZoneIds: ["zone_1", "zone_2", "zone_3"],
    ownedSkillIds: ["skill:impulso", "skill:flor-de-nectar"],
    equippedSkills: ["skill:impulso", "", "skill:flor-de-nectar", ""],
    skillRuntime: [
      { slot: 0, skillId: "skill:impulso", state: "cooldown", cooldownEndsAt: Date.now() + 1200 },
      { slot: 1, skillId: "", state: "ready", cooldownEndsAt: 0 },
      { slot: 2, skillId: "skill:flor-de-nectar", state: "ready", cooldownEndsAt: 0 },
      { slot: 3, skillId: "", state: "ready", cooldownEndsAt: 0 },
    ],
    skillCatalog: DEFAULT_SKILL_CATALOG,
  };

  console.assert(testStatusMsg.type === "player_status", "PlayerStatusMessage: type mismatch");
  console.assert(testStatusMsg.playerId === "p1", "PlayerStatusMessage: playerId mismatch");
  console.assert(testStatusMsg.pollenCarried === 75, "PlayerStatusMessage: pollenCarried mismatch");

  const testSkillEffectsMessage: SkillEffectsMessage = {
    type: "skill_effects",
    effects: [
      {
        id: "skillfx:test",
        ownerPlayerId: "p1",
        skillId: "skill:impulso",
        slot: 0,
        stageId: "stage:starter-basin",
        kind: "dash",
        state: "active",
        fromX: 1,
        fromY: 1,
        toX: 2.4,
        toY: 1,
        directionX: 1,
        directionY: 0,
        durationMs: 420,
        startedAt: Date.now(),
        expiresAt: Date.now() + 420,
      },
    ],
  };

  // Validate GameSessionState includes progress fields
  const testSessionState: GameSessionState = {
    connectionState: "connected",
    localPlayerId: "p1",
    localUsername: "testPlayer",
    stageId: "stage:starter-basin",
    stageName: "Bacia do Primeiro Voo",
    audioBgm: "assets/rpg-adventure.mp3",
    players: [],
    chunks: [],
    props: [],
    landmarks: [],
    centerChunkX: 0,
    centerChunkY: 0,
    renderDistance: 5,
    chunkSize: 100,
    tick: 123,
    playerProgress: testProgress,
    lastInteraction: testInteraction,
    skillEffects: testSkillEffectsMessage.effects,
  };

  console.assert(
    testSessionState.playerProgress?.pollenCarried === 50,
    "GameSessionState: playerProgress mismatch"
  );
  console.assert(
    testSessionState.lastInteraction?.action === "collect_flower",
    "GameSessionState: lastInteraction mismatch"
  );

  // Validate ServerMessage union includes new types
  const statusMsgAsServerMessage: ServerMessage = testStatusMsg;
  const interactionAsServerMessage: ServerMessage = testInteraction;
  const skillEffectsAsServerMessage: ServerMessage = testSkillEffectsMessage;

  console.assert(
    (statusMsgAsServerMessage as PlayerStatusMessage).type === "player_status",
    "ServerMessage union: PlayerStatusMessage not included"
  );
  console.assert(
    (interactionAsServerMessage as InteractionResult).type === "interaction_result",
    "ServerMessage union: InteractionResult not included"
  );
  console.assert(
    (skillEffectsAsServerMessage as SkillEffectsMessage).type === "skill_effects",
    "ServerMessage union: SkillEffectsMessage not included"
  );

  console.log("✓ All game type validations passed");
};

// Run validation on module load
if (typeof window !== "undefined") {
  validateGameTypes();
}

export default validateGameTypes;
