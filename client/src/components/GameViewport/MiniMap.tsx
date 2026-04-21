import { useMemo, useState } from "react";

import type { WorldPlayerState } from "../../types/game";

const RADAR_RADIUS = 50;
const REMOTE_PLAYER_MARGIN = 8;

interface MiniMapProps {
	players: WorldPlayerState[];
	localPlayerId?: string;
	onPlayerClick?: (x: number, z: number) => void;
	onRespawn?: () => void;
}

interface MiniMapBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	width: number;
	height: number;
}

interface MiniMapMarker extends WorldPlayerState {
	isLocal: boolean;
	left: number;
	top: number;
}

interface CoordinateReadout {
	latitudeLabel: string;
	longitudeLabel: string;
}

function clampPercent(value: number): number {
	return Math.min(100, Math.max(0, value));
}

function formatLatitude(value: number): string {
	const rounded = Math.round(value);

	if (rounded === 0) {
		return "0 N";
	}

	return `${Math.abs(rounded)} ${rounded > 0 ? "N" : "S"}`;
}

function formatLongitude(value: number): string {
	const rounded = Math.round(value);

	if (rounded === 0) {
		return "0 E";
	}

	return `${Math.abs(rounded)} ${rounded > 0 ? "E" : "O"}`;
}

function resolveBounds(
	players: WorldPlayerState[],
	localPlayer?: WorldPlayerState,
): MiniMapBounds {
	const anchorX = localPlayer?.x ?? 0;
	const anchorY = localPlayer?.y ?? 0;

	let minX = anchorX - RADAR_RADIUS;
	let maxX = anchorX + RADAR_RADIUS;
	let minY = anchorY - RADAR_RADIUS;
	let maxY = anchorY + RADAR_RADIUS;

	for (const player of players) {
		if (player.id === localPlayer?.id) {
			continue;
		}

		minX = Math.min(minX, player.x - REMOTE_PLAYER_MARGIN);
		maxX = Math.max(maxX, player.x + REMOTE_PLAYER_MARGIN);
		minY = Math.min(minY, player.y - REMOTE_PLAYER_MARGIN);
		maxY = Math.max(maxY, player.y + REMOTE_PLAYER_MARGIN);
	}

	return {
		minX,
		maxX,
		minY,
		maxY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

export function MiniMap({ players, localPlayerId, onPlayerClick, onRespawn }: MiniMapProps) {
	const [collapsed, setCollapsed] = useState(false);
	const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);

	const localPlayer = useMemo(
		() => players.find((player) => player.id === localPlayerId),
		[localPlayerId, players],
	);

	const bounds = useMemo(
		() => resolveBounds(players, localPlayer),
		[localPlayer, players],
	);

	const markers = useMemo<MiniMapMarker[]>(() => {
		return [...players]
			.sort((leftPlayer, rightPlayer) => {
				if (leftPlayer.id === localPlayerId) {
					return -1;
				}

				if (rightPlayer.id === localPlayerId) {
					return 1;
				}

				return leftPlayer.username.localeCompare(rightPlayer.username, "pt-BR");
			})
			.map((player) => ({
				...player,
				isLocal: player.id === localPlayerId,
				left: clampPercent(((player.x - bounds.minX) / bounds.width) * 100),
				top: clampPercent((1 - (player.y - bounds.minY) / bounds.height) * 100),
			}));
	}, [bounds.height, bounds.minX, bounds.minY, bounds.width, localPlayerId, players]);

	const localMarker = markers.find((player) => player.isLocal);
	const nearbyPlayers = markers.filter((player) => !player.isLocal);
	const targetPlayer = nearbyPlayers[0];

	const localCoordinates = useMemo<CoordinateReadout>(() => {
		return {
			latitudeLabel: formatLatitude(localPlayer?.y ?? 0),
			longitudeLabel: formatLongitude(localPlayer?.x ?? 0),
		};
	}, [localPlayer?.x, localPlayer?.y]);

	return (
		<aside
			className={`mini-map${collapsed ? " mini-map--collapsed" : ""}`}
			aria-label="Mini mapa dos jogadores"
		>
			<div className="mini-map__header">
				<div className="mini-map__header-left">
					<span className="mini-map__radar-icon" aria-hidden="true">
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
							<circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" opacity="0.6" />
							<circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
							<circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
							<line x1="10" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.4" opacity="0.9" />
							<circle cx="10" cy="10" r="1.5" fill="currentColor" />
						</svg>
					</span>
				</div>

				<div className="mini-map__header-actions">
					{!collapsed ? (
						<span className="mini-map__bounds">{Math.round(bounds.width)}m</span>
					) : null}

					<button
						type="button"
						className="mini-map__toggle"
						aria-label={collapsed ? "Expandir minimapa" : "Minimizar minimapa"}
						aria-expanded={!collapsed}
						onClick={() => setCollapsed((previous) => !previous)}
					>
						{collapsed ? "▲" : "▼"}
					</button>
				</div>
			</div>

			{!collapsed ? (
				<>
					<div className="mini-map__surface">
						<div className="mini-map__grid" />

						<span className="mini-map__compass mini-map__compass--n">N</span>
						<span className="mini-map__compass mini-map__compass--s">S</span>
						<span className="mini-map__compass mini-map__compass--w">O</span>
						<span className="mini-map__compass mini-map__compass--e">L</span>

						{markers.map((player) =>
							player.isLocal ? (
								<div
									key={player.id}
									className="mini-map__marker mini-map__marker--local"
									style={{ left: `${player.left}%`, top: `${player.top}%` }}
								>
									<span className="mini-map__local-triangle" aria-label="Você" />
								</div>
							) : (
								<button
									key={player.id}
									type="button"
									className={`mini-map__marker mini-map__marker--remote${hoveredPlayerId === player.id ? " mini-map__marker--hovered" : ""}`}
									style={{ left: `${player.left}%`, top: `${player.top}%` }}
									aria-label={`Ir até ${player.username} em lat ${formatLatitude(player.y)} e long ${formatLongitude(player.x)}`}
									onClick={() => onPlayerClick?.(player.x, player.y)}
									onMouseEnter={() => setHoveredPlayerId(player.id)}
									onMouseLeave={() => setHoveredPlayerId(null)}
								>
									<span className="mini-map__dot" />
									<span className="mini-map__dot-pulse" />

									{hoveredPlayerId === player.id ? (
										<span className="mini-map__tooltip">
											<strong>{player.username}</strong>
											<span className="mini-map__tooltip-id">ID: {player.id.slice(0, 6)}</span>
										</span>
									) : null}
								</button>
							),
						)}

						{localMarker && targetPlayer ? (
							<svg className="mini-map__lines" aria-hidden="true">
								<line
									x1={`${localMarker.left}%`}
									y1={`${localMarker.top}%`}
									x2={`${targetPlayer.left}%`}
									y2={`${targetPlayer.top}%`}
									stroke="rgba(255,255,255,0.18)"
									strokeWidth="1"
									strokeDasharray="3 4"
								/>
							</svg>
						) : null}
					</div>

					<div className="mini-map__footer">
						{localPlayer ? (
							<button
								type="button"
								className="mini-map__respawn"
								onClick={() => onRespawn?.()}
							>
								Respawn no encontro
							</button>
						) : null}

						<div className="mini-map__coordinates" aria-label="Coordenadas atuais">
							<span className="mini-map__coord-icon" aria-hidden="true">
								📍
							</span>
							<span>
								{targetPlayer
									? `Lat ${formatLatitude(targetPlayer.y)}, Long ${formatLongitude(targetPlayer.x)}`
									: `Lat ${localCoordinates.latitudeLabel}, Long ${localCoordinates.longitudeLabel}`}
							</span>
						</div>

						<p className="mini-map__summary">
							{nearbyPlayers.length > 0 ? (
								<>
									Procure por{" "}
									{nearbyPlayers.map((player, index) => (
										<button
											key={player.id}
											type="button"
											className="mini-map__name-link"
											onClick={() => onPlayerClick?.(player.x, player.y)}
										>
											{player.username}
											{index < nearbyPlayers.length - 1 ? ", " : "."}
										</button>
									))}
								</>
							) : (
								"Nenhum outro jogador entrou no seu radar ainda."
							)}
						</p>
					</div>
				</>
			) : null}
		</aside>
	);
}
