import { useEffect, useMemo, useState } from "react";

import styles from "./MiniMap.module.css";
import type { FlowerInteractionState, HiveInteractionState, WorldHiveState, WorldPlayerState } from "../../types/game";

const RADAR_RADIUS = 50;
const REMOTE_PLAYER_MARGIN = 8;

interface MiniMapProps {
	players: WorldPlayerState[];
	hives: WorldHiveState[];
	flowerInteraction?: FlowerInteractionState;
	hiveInteraction?: HiveInteractionState;
	localPlayerId?: string;
	onClearTargets?: () => void;
	onCollectorClick?: (hive: WorldHiveState) => void;
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

interface MiniMapPoi {
	id: string;
	label: string;
	left: number;
	top: number;
}

const COLLECTOR_HIVE_ID = "hive:collector";
const COLLECTOR_HIVE_FALLBACK: WorldHiveState = {
	id: COLLECTOR_HIVE_ID,
	x: 0.5,
	y: 0.5,
	scale: 2.4,
	toneColor: "#d7963a",
	glowColor: "#ffe08a",
};

function cx(...classes: Array<string | false | undefined>): string {
	return classes.filter(Boolean).join(" ");
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
	collectorHive: WorldHiveState | undefined,
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

	if (collectorHive) {
		minX = Math.min(minX, collectorHive.x - REMOTE_PLAYER_MARGIN);
		maxX = Math.max(maxX, collectorHive.x + REMOTE_PLAYER_MARGIN);
		minY = Math.min(minY, collectorHive.y - REMOTE_PLAYER_MARGIN);
		maxY = Math.max(maxY, collectorHive.y + REMOTE_PLAYER_MARGIN);
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

export function MiniMap({ players, hives, flowerInteraction, hiveInteraction, localPlayerId, onClearTargets, onCollectorClick, onPlayerClick, onRespawn }: MiniMapProps) {
	const [collapsed, setCollapsed] = useState(true);
	const [hoveredPlayerId, setHoveredPlayerId] = useState<string | null>(null);
	const collectorHive = useMemo(() => hives.find((hive) => hive.id === COLLECTOR_HIVE_ID) ?? COLLECTOR_HIVE_FALLBACK, [hives]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target instanceof HTMLSelectElement ||
				(target instanceof HTMLElement && target.isContentEditable)
			) {
				return;
			}

			if (event.key.toLowerCase() !== "m") {
				return;
			}

			event.preventDefault();
			setCollapsed((previous) => !previous);
		};

		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	const localPlayer = useMemo(
		() => players.find((player) => player.id === localPlayerId),
		[localPlayerId, players],
	);

	const bounds = useMemo(
		() => resolveBounds(players, collectorHive, localPlayer),
		[collectorHive, localPlayer, players],
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
	const collectorPoi = useMemo<MiniMapPoi>(() => {
		return {
			id: collectorHive.id,
			label: "Colmeia coletora",
			left: clampPercent(((collectorHive.x - bounds.minX) / bounds.width) * 100),
			top: clampPercent((1 - (collectorHive.y - bounds.minY) / bounds.height) * 100),
		};
	}, [bounds.height, bounds.minX, bounds.minY, bounds.width, collectorHive]);
	const flowerPoi = useMemo<MiniMapPoi | undefined>(() => {
		if (!flowerInteraction) {
			return undefined;
		}

		return {
			id: flowerInteraction.flowerId,
			label: flowerInteraction.phase === "collecting" ? "Flor em coleta" : "Flor alvo",
			left: clampPercent(((flowerInteraction.flowerX - bounds.minX) / bounds.width) * 100),
			top: clampPercent((1 - (flowerInteraction.flowerY - bounds.minY) / bounds.height) * 100),
		};
	}, [bounds.height, bounds.minX, bounds.minY, bounds.width, flowerInteraction]);
	const isCollectorTargeted = collectorHive?.id === hiveInteraction?.hiveId;

	return (
		<aside
			className={cx(styles.miniMap, collapsed && styles.collapsed)}
			aria-label="Mini mapa dos jogadores"
		>
			<div className={styles.header}>
				<div className={styles.headerLeft}>
					<span className={styles.radarIcon} aria-hidden="true">
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
							<circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.4" opacity="0.6" />
							<circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
							<circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
							<line x1="10" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.4" opacity="0.9" />
							<circle cx="10" cy="10" r="1.5" fill="currentColor" />
						</svg>
					</span>
				</div>

				<div className={styles.headerActions}>
					{!collapsed ? (
						<span className={styles.bounds}>{Math.round(bounds.width)}m</span>
					) : null}

					<button
						type="button"
						className={styles.toggle}
						aria-label={collapsed ? "Expandir minimapa" : "Minimizar minimapa"}
						aria-keyshortcuts="M"
						aria-expanded={!collapsed}
						onClick={() => setCollapsed((previous) => !previous)}
					>
						{collapsed ? "▲" : "▼"}
					</button>
				</div>
			</div>

			{!collapsed ? (
				<>
					<div className={styles.surface}>
						<div className={styles.grid} />

						<span className={cx(styles.compass, styles.compassN)}>N</span>
						<span className={cx(styles.compass, styles.compassS)}>S</span>
						<span className={cx(styles.compass, styles.compassW)}>O</span>
						<span className={cx(styles.compass, styles.compassE)}>L</span>

						<div
							className={styles.marker}
							style={{ left: `${collectorPoi.left}%`, top: `${collectorPoi.top}%` }}
						>
							<span className={styles.collectorMarker} aria-label={collectorPoi.label} />
						</div>

						{flowerPoi ? (
							<div
								className={styles.marker}
								style={{ left: `${flowerPoi.left}%`, top: `${flowerPoi.top}%` }}
							>
								<span className={cx(styles.flowerMarker, flowerInteraction?.phase === "collecting" && styles.flowerMarkerCollecting)} aria-label={flowerPoi.label} />
							</div>
						) : null}

						{markers.map((player) =>
							player.isLocal ? (
								<div
									key={player.id}
									className={cx(styles.marker, styles.markerLocal)}
									style={{ left: `${player.left}%`, top: `${player.top}%` }}
								>
									<span className={styles.localTriangle} aria-label="Você" />
								</div>
							) : (
								<button
									key={player.id}
									type="button"
									className={cx(styles.marker, styles.markerRemote, hoveredPlayerId === player.id && styles.markerHovered)}
									style={{ left: `${player.left}%`, top: `${player.top}%` }}
									aria-label={`Ir até ${player.username} em lat ${formatLatitude(player.y)} e long ${formatLongitude(player.x)}`}
									onClick={() => onPlayerClick?.(player.x, player.y)}
									onMouseEnter={() => setHoveredPlayerId(player.id)}
									onMouseLeave={() => setHoveredPlayerId(null)}
								>
									<span className={styles.dot} />
									<span className={styles.dotPulse} />

									{hoveredPlayerId === player.id ? (
										<span className={styles.tooltip}>
											<strong>{player.username}</strong>
											<span className={styles.tooltipId}>ID: {player.id.slice(0, 6)}</span>
										</span>
									) : null}
								</button>
							),
						)}

						{localMarker && targetPlayer ? (
							<svg className={styles.lines} aria-hidden="true">
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

					<div className={styles.footer}>
						<div className={styles.actions}>
							{localPlayer ? (
								<button
									type="button"
									className={styles.actionButton}
									aria-label="Voltar para o encontro"
									onClick={() => {
										onClearTargets?.();
										onRespawn?.();
									}}
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
										<path d="M9 14 4 9l5-5" />
										<path d="M20 20a8 8 0 0 0-8-8H4" />
									</svg>
								</button>
							) : null}

							<button
								type="button"
								className={cx(styles.actionButton, isCollectorTargeted && styles.actionButtonActive)}
								aria-label="Ir andando para a colmeia coletora"
								onClick={() => onCollectorClick?.(collectorHive)}
							>
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
									<path d="M7 10c0-3 2.2-5 5-5s5 2 5 5" />
									<path d="M6 10h12" />
									<path d="M8 10v7" />
									<path d="M16 10v7" />
									<path d="M8 17c0 1.7 1.8 3 4 3s4-1.3 4-3" />
								</svg>
							</button>
						</div>

						<div className={styles.coordinates} aria-label="Coordenadas atuais">
							<span className={styles.coordIcon} aria-hidden="true">
								📍
							</span>
							<span>
								{flowerPoi
									? flowerPoi.label
									: targetPlayer
									? `Lat ${formatLatitude(targetPlayer.y)}, Long ${formatLongitude(targetPlayer.x)}`
									: `Lat ${localCoordinates.latitudeLabel}, Long ${localCoordinates.longitudeLabel}`}
							</span>
						</div>

						{collectorPoi ? (
							<div className={cx(styles.coordinates, styles.coordinatesCollector)} aria-label="Ponto de entrega principal">
								<span className={styles.collectorDot} aria-hidden="true" />
								<span>Coletor principal visível</span>
							</div>
						) : null}
					</div>
				</>
			) : null}
		</aside>
	);
}
