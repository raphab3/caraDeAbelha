import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { MathUtils } from "three";
import type { Group, Mesh } from "three";

import type { GameSessionState, WorldPlayerState } from "../../types/game";

interface BeeActorProps {
  player: WorldPlayerState;
  drift: number;
  accentColor: string;
}

function BeeActor({ player, drift, accentColor }: BeeActorProps) {
  const groupRef = useRef<Group>(null);
  const leftWingRef = useRef<Mesh>(null);
  const rightWingRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!groupRef.current || !leftWingRef.current || !rightWingRef.current) {
      return;
    }

    const time = state.clock.elapsedTime + drift;
    const targetX = player.x * 1.35;
    const targetZ = player.y * 1.35;
    const hoverHeight = 0.48 + Math.sin(time * 2.4) * 0.18;

    groupRef.current.position.x = MathUtils.lerp(groupRef.current.position.x, targetX, 0.16);
    groupRef.current.position.y = MathUtils.lerp(groupRef.current.position.y, hoverHeight, 0.18);
    groupRef.current.position.z = MathUtils.lerp(groupRef.current.position.z, targetZ, 0.16);
    groupRef.current.rotation.y = Math.atan2(targetX - groupRef.current.position.x, targetZ - groupRef.current.position.z);
    leftWingRef.current.rotation.z = Math.sin(time * 18) * 0.3;
    rightWingRef.current.rotation.z = -Math.sin(time * 18) * 0.3;
  });

  return (
    <group ref={groupRef} position={[player.x * 1.35, 0.48, player.y * 1.35]}>
      <mesh castShadow>
        <sphereGeometry args={[0.62, 32, 32]} />
        <meshStandardMaterial color={accentColor} metalness={0.05} roughness={0.72} />
      </mesh>

      <mesh castShadow position={[-0.35, 0, 0]}>
        <boxGeometry args={[0.12, 0.9, 1.18]} />
        <meshStandardMaterial color="#23150d" roughness={0.84} />
      </mesh>

      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.12, 0.9, 1.18]} />
        <meshStandardMaterial color="#23150d" roughness={0.84} />
      </mesh>

      <mesh castShadow position={[0.35, 0, 0]}>
        <boxGeometry args={[0.12, 0.9, 1.18]} />
        <meshStandardMaterial color="#23150d" roughness={0.84} />
      </mesh>

      <mesh castShadow position={[0.7, 0, 0]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color="#23150d" roughness={0.84} />
      </mesh>

      <mesh ref={leftWingRef} position={[-0.08, 0.44, -0.3]} rotation={[0.2, 0, 0.15]}>
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshStandardMaterial color="#d9f3ff" transparent opacity={0.74} roughness={0.18} />
      </mesh>

      <mesh ref={rightWingRef} position={[-0.08, 0.44, 0.3]} rotation={[-0.2, 0, -0.15]}>
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshStandardMaterial color="#d9f3ff" transparent opacity={0.74} roughness={0.18} />
      </mesh>
    </group>
  );
}

interface HiveCoreProps {
  players: WorldPlayerState[];
  connectionState: GameSessionState["connectionState"];
}

function HiveCore({ players, connectionState }: HiveCoreProps) {
  const hiveRef = useRef<Group>(null);

  useFrame((state) => {
    if (!hiveRef.current) {
      return;
    }

    hiveRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.25;
  });

  return (
    <group>
      <fog attach="fog" args={["#f9d36d", 10, 26]} />
      <ambientLight intensity={1.1} />
      <directionalLight
        castShadow
        intensity={2.2}
        position={[5, 8, 4]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight intensity={24} color="#ffbf45" distance={12} position={[0, 1.6, 0]} />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.15, 0]}>
        <circleGeometry args={[10, 64]} />
        <meshStandardMaterial color="#5b742d" roughness={0.98} />
      </mesh>

      <group ref={hiveRef} position={[0, -0.15, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[1.55, 2.1, 2.6, 6]} />
          <meshStandardMaterial color="#b9821c" roughness={0.86} />
        </mesh>

        <mesh castShadow position={[0, 0.1, 1.56]}>
          <cylinderGeometry args={[0.3, 0.3, 0.35, 24]} />
          <meshStandardMaterial color="#26170d" roughness={0.92} />
        </mesh>

        <mesh position={[0, 1.7, 0]}>
          <icosahedronGeometry args={[0.48, 0]} />
          <meshStandardMaterial color="#ffd36a" emissive="#ffae00" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {players.map((player, index) => (
        <BeeActor
          key={player.id}
          player={player}
          drift={index * 0.9}
          accentColor={index === 0 ? "#f8c537" : "#ffd86f"}
        />
      ))}

      {connectionState === "disconnected" ? (
        <mesh position={[0, 2.1, 0]}>
          <icosahedronGeometry args={[0.38, 0]} />
          <meshStandardMaterial color="#b24a32" emissive="#ff6b3d" emissiveIntensity={0.8} />
        </mesh>
      ) : null}

      <gridHelper args={[18, 18, "#7e601f", "#cfa33f"]} position={[0, -1.14, 0]} />
    </group>
  );
}

interface GameViewportProps {
  players: WorldPlayerState[];
  connectionState: GameSessionState["connectionState"];
}

export function GameViewport({ players, connectionState }: GameViewportProps) {
  return (
    <Canvas
      camera={{ position: [6.6, 4.2, 7.4], fov: 42 }}
      dpr={[1, 1.6]}
      shadows
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#f7cd4a"]} />
      <HiveCore players={players} connectionState={connectionState} />
    </Canvas>
  );
}