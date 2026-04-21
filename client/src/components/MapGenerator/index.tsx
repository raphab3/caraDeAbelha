import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { createNoise2D } from "simplex-noise";
import seedrandom from "seedrandom";

import "./styles.css";
import type { MapGeneratorSettings, MapStats, MapTile, TerrainProp, TerrainType } from "./types";

const DEFAULT_SETTINGS: MapGeneratorSettings = {
	seed: "cara-de-abelha",
	mapSize: 50,
	scale: 0.09,
	waterLevel: -0.3,
	mountainLevel: 0.5,
	floraDensity: 0.36,
};

const MIN_THRESHOLD_GAP = 0.05;

interface ControlFieldProps {
	label: string;
	valueLabel: string;
	helperText: string;
	children: ReactNode;
}

interface SliderFieldProps {
	label: string;
	value: number;
	valueLabel: string;
	helperText: string;
	min: number;
	max: number;
	step: number;
	onChange: (nextValue: number) => void;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function getGridOrigin(mapSize: number): number {
	return -Math.floor(mapSize / 2);
}

function getTerrainColor(type: TerrainType): string {
	switch (type) {
		case "water":
			return "#2b7fff";
		case "stone":
			return "#7a7f89";
		default:
			return "#4cb562";
	}
}

function getPropColor(prop: Exclude<TerrainProp, null>): string {
	return prop === "flower" ? "#facc15" : "#166534";
}

function sanitizeSeed(seed: string): string {
	const normalizedSeed = seed.trim() || DEFAULT_SETTINGS.seed;

	return normalizedSeed.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "mapa";
}

function buildMapData(settings: MapGeneratorSettings): MapTile[] {
	const baseSeed = settings.seed.trim() || DEFAULT_SETTINGS.seed;
	const terrainNoise = createNoise2D(seedrandom(baseSeed));
	const floraPlacementNoise = createNoise2D(seedrandom(`${baseSeed}:flora:placement`));
	const floraVariantNoise = createNoise2D(seedrandom(`${baseSeed}:flora:variant`));
	const mapData: MapTile[] = [];
	const origin = getGridOrigin(settings.mapSize);
	const end = origin + settings.mapSize - 1;

	for (let z = origin; z <= end; z += 1) {
		for (let x = origin; x <= end; x += 1) {
			// `simplex-noise` devolve um campo contínuo em [-1, 1].
			// Os thresholds convertem esse relevo contínuo em bandas discretas para água, relva e pedra.
			const elevation = terrainNoise(x * settings.scale, z * settings.scale);
			let type: TerrainType = "grass";
			let y = 0;
			let prop: TerrainProp = null;

			if (elevation < settings.waterLevel) {
				type = "water";
				y = -0.5;
			} else if (elevation > settings.mountainLevel) {
				type = "stone";
				y = 1;
			} else {
				// A segunda passagem de ruído controla densidade e variedade de flora sem quebrar o determinismo da seed.
				const floraChance =
					(floraPlacementNoise(x * settings.scale * 1.85 + 320, z * settings.scale * 1.85 - 320) + 1) / 2;

				if (floraChance >= 1 - settings.floraDensity) {
					const floraVariant = floraVariantNoise(
						x * settings.scale * 2.4 - 760,
						z * settings.scale * 2.4 + 760,
					);

					prop = floraVariant > 0.16 ? "tree" : "flower";
				}
			}

			mapData.push({ x, y, z, type, prop });
		}
	}

	return mapData;
}

function countMapStats(mapData: MapTile[]): MapStats {
	return mapData.reduce<MapStats>(
		(accumulator, tile) => {
			accumulator[tile.type] += 1;

			if (tile.prop === "flower") {
				accumulator.flowers += 1;
				accumulator.flora += 1;
			}

			if (tile.prop === "tree") {
				accumulator.trees += 1;
				accumulator.flora += 1;
			}

			return accumulator;
		},
		{ water: 0, grass: 0, stone: 0, flora: 0, flowers: 0, trees: 0 },
	);
}

function ControlField({ label, valueLabel, helperText, children }: ControlFieldProps) {
	return (
		<label className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/6 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-sm">
			<div className="flex items-start justify-between gap-4">
				<div>
					<span className="block text-sm font-semibold tracking-wide text-slate-50">{label}</span>
					<p className="mt-1 text-xs leading-5 text-slate-300/75">{helperText}</p>
				</div>
				<span className="rounded-full border border-amber-300/20 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">
					{valueLabel}
				</span>
			</div>
			{children}
		</label>
	);
}

function SliderField({
	label,
	value,
	valueLabel,
	helperText,
	min,
	max,
	step,
	onChange,
}: SliderFieldProps) {
	return (
		<ControlField label={label} valueLabel={valueLabel} helperText={helperText}>
			<input
				className="map-generator-slider"
				max={max}
				min={min}
				onChange={(event) => onChange(Number(event.target.value))}
				step={step}
				type="range"
				value={value}
			/>
			<div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-slate-400/80">
				<span>{min}</span>
				<span>{max}</span>
			</div>
		</ControlField>
	);
}

function StatCard({ label, value, accentClass }: { label: string; value: string; accentClass: string }) {
	return (
		<div className="rounded-3xl border border-white/10 bg-slate-950/55 p-4 backdrop-blur-sm">
			<span className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${accentClass}`}>{label}</span>
			<strong className="mt-3 block text-3xl font-semibold text-slate-50">{value}</strong>
		</div>
	);
}

function LegendSwatch({ colorClass, label }: { colorClass: string; label: string }) {
	return (
		<div className="flex items-center gap-3 text-sm text-slate-200/88">
			<span className={`h-3.5 w-3.5 rounded-full ${colorClass}`} aria-hidden="true" />
			<span>{label}</span>
		</div>
	);
}

export default function MapGenerator() {
	const [seed, setSeed] = useState(DEFAULT_SETTINGS.seed);
	const [mapSize, setMapSize] = useState(DEFAULT_SETTINGS.mapSize);
	const [scale, setScale] = useState(DEFAULT_SETTINGS.scale);
	const [waterLevel, setWaterLevel] = useState(DEFAULT_SETTINGS.waterLevel);
	const [mountainLevel, setMountainLevel] = useState(DEFAULT_SETTINGS.mountainLevel);
	const [floraDensity, setFloraDensity] = useState(DEFAULT_SETTINGS.floraDensity);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const canvasFrameRef = useRef<HTMLDivElement>(null);
	const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

	const settings = useMemo<MapGeneratorSettings>(
		() => ({
			seed,
			mapSize,
			scale,
			waterLevel,
			mountainLevel,
			floraDensity,
		}),
		[seed, mapSize, scale, waterLevel, mountainLevel, floraDensity],
	);

	const mapData = useMemo(() => buildMapData(settings), [settings]);
	const stats = useMemo(() => countMapStats(mapData), [mapData]);

	useEffect(() => {
		const frame = canvasFrameRef.current;

		if (!frame || typeof ResizeObserver === "undefined") {
			return undefined;
		}

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];

			if (!entry) {
				return;
			}

			const nextWidth = Math.floor(entry.contentRect.width);
			const nextHeight = Math.floor(entry.contentRect.height);

			setCanvasSize((current) => {
				if (current.width === nextWidth && current.height === nextHeight) {
					return current;
				}

				return { width: nextWidth, height: nextHeight };
			});
		});

		observer.observe(frame);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;

		if (!canvas || canvasSize.width === 0 || canvasSize.height === 0) {
			return;
		}

		const context = canvas.getContext("2d");

		if (!context) {
			return;
		}

		const pixelRatio = window.devicePixelRatio || 1;
		canvas.width = Math.floor(canvasSize.width * pixelRatio);
		canvas.height = Math.floor(canvasSize.height * pixelRatio);
		canvas.style.width = `${canvasSize.width}px`;
		canvas.style.height = `${canvasSize.height}px`;
		context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		context.clearRect(0, 0, canvasSize.width, canvasSize.height);
		context.fillStyle = "#020817";
		context.fillRect(0, 0, canvasSize.width, canvasSize.height);

		const side = Math.min(canvasSize.width, canvasSize.height);
		const offsetX = (canvasSize.width - side) / 2;
		const offsetY = (canvasSize.height - side) / 2;
		const cellSize = side / mapSize;
		const origin = getGridOrigin(mapSize);

		for (const tile of mapData) {
			const xIndex = tile.x - origin;
			const zIndex = tile.z - origin;
			const drawX = offsetX + xIndex * cellSize;
			const drawY = offsetY + zIndex * cellSize;

			context.fillStyle = getTerrainColor(tile.type);
			context.fillRect(drawX, drawY, Math.ceil(cellSize), Math.ceil(cellSize));

			if (tile.prop) {
				context.beginPath();
				context.fillStyle = getPropColor(tile.prop);
				context.arc(
					drawX + cellSize / 2,
					drawY + cellSize / 2,
					Math.max(1.25, cellSize * (tile.prop === "tree" ? 0.34 : 0.22)),
					0,
					Math.PI * 2,
				);
				context.fill();
			}
		}

		context.strokeStyle = "rgba(255,255,255,0.12)";
		context.lineWidth = 1;
		context.strokeRect(offsetX + 0.5, offsetY + 0.5, side - 1, side - 1);
	}, [canvasSize.height, canvasSize.width, mapData, mapSize]);

	const handleWaterLevelChange = (nextValue: number) => {
		const normalizedValue = clamp(nextValue, -1, mountainLevel - MIN_THRESHOLD_GAP);
		setWaterLevel(normalizedValue);
	};

	const handleMountainLevelChange = (nextValue: number) => {
		const normalizedValue = clamp(nextValue, waterLevel + MIN_THRESHOLD_GAP, 1);
		setMountainLevel(normalizedValue);
	};

	const exportMap = () => {
		const mapBlob = new Blob([JSON.stringify(mapData, null, 2)], {
			type: "application/json;charset=utf-8",
		});
		const objectUrl = window.URL.createObjectURL(mapBlob);
		const downloadAnchor = document.createElement("a");

		downloadAnchor.href = objectUrl;
		downloadAnchor.download = `map-${sanitizeSeed(seed)}.json`;
		downloadAnchor.click();
		window.URL.revokeObjectURL(objectUrl);
	};

	return (
		<div className="map-generator-shell min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(250,204,21,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(135deg,_#020617_0%,_#0f172a_48%,_#1e293b_100%)] text-slate-100">
			<main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
				<header className="rounded-[32px] border border-white/10 bg-slate-950/65 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl lg:p-8">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
						<div className="max-w-3xl">
							<p className="text-xs font-semibold uppercase tracking-[0.34em] text-amber-200/78">Ferramenta interna</p>
							<h1 className="mt-3 text-4xl font-semibold tracking-tight text-white lg:text-5xl">Gerador de fases para Cara de Abelha</h1>
							<p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300/82 lg:text-base">
								Ajusta a seed, esculpe o relevo com thresholds e valida a distribuição em 2D antes de exportar o JSON que o servidor Go pode consumir.
							</p>
						</div>

						<div className="flex flex-wrap gap-3">
							<a
								className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/6 px-5 text-sm font-semibold text-slate-100 transition hover:bg-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
								href="/"
							>
								Abrir jogo
							</a>
							<button
								className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-300 px-5 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(250,204,21,0.25)] transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
								onClick={exportMap}
								type="button"
							>
								Exportar Mapa (JSON)
							</button>
						</div>
					</div>
				</header>

				<section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
					<aside className="rounded-[32px] border border-white/10 bg-slate-950/58 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.3)] backdrop-blur-xl lg:sticky lg:top-6 lg:self-start lg:p-5">
						<div className="mb-4 rounded-[28px] border border-emerald-300/16 bg-emerald-400/8 p-4">
							<p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/78">Direção visual</p>
							<p className="mt-2 text-sm leading-6 text-slate-200/86">
								Painel compacto para afinar parâmetros à esquerda, pré-visualização como foco principal à direita e leitura rápida de densidade nos cartões de apoio.
							</p>
						</div>

						<div className="grid gap-4">
							<ControlField
								label="Seed base"
								valueLabel={seed.trim() || DEFAULT_SETTINGS.seed}
								helperText="A mesma seed gera sempre o mesmo relevo e a mesma distribuição de props."
							>
								<input
									className="min-h-12 rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-sm font-medium text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/55 focus:ring-2 focus:ring-amber-300/30"
									onChange={(event) => setSeed(event.target.value)}
									placeholder="Ex: arquipelago-dourado"
									type="text"
									value={seed}
								/>
							</ControlField>

							<SliderField
								label="Tamanho do mapa"
								helperText="Define quantas células são geradas em X e Z."
								max={100}
								min={50}
								onChange={(nextValue) => setMapSize(Math.round(nextValue))}
								step={1}
								value={mapSize}
								valueLabel={`${mapSize}x${mapSize}`}
							/>

							<SliderField
								label="Escala do ruído"
								helperText="Valores menores criam continentes maiores; valores maiores fragmentam o relevo."
								max={0.2}
								min={0.05}
								onChange={setScale}
								step={0.005}
								value={scale}
								valueLabel={scale.toFixed(3)}
							/>

							<SliderField
								label="Nível da água"
								helperText="Tudo abaixo deste threshold vira água com Y em -0.5."
								max={mountainLevel - MIN_THRESHOLD_GAP}
								min={-1}
								onChange={handleWaterLevelChange}
								step={0.05}
								value={waterLevel}
								valueLabel={waterLevel.toFixed(2)}
							/>

							<SliderField
								label="Nível da montanha"
								helperText="Tudo acima deste threshold vira pedra com Y em 1."
								max={1}
								min={waterLevel + MIN_THRESHOLD_GAP}
								onChange={handleMountainLevelChange}
								step={0.05}
								value={mountainLevel}
								valueLabel={mountainLevel.toFixed(2)}
							/>

							<SliderField
								label="Densidade de flora"
								helperText="Controla a probabilidade de flores e árvores aparecerem sobre relva."
								max={1}
								min={0}
								onChange={setFloraDensity}
								step={0.01}
								value={floraDensity}
								valueLabel={`${Math.round(floraDensity * 100)}%`}
							/>
						</div>
					</aside>

					<section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
						<div className="rounded-[32px] border border-white/10 bg-slate-950/58 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.3)] backdrop-blur-xl lg:p-5">
							<div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
								<div>
									<p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-200/74">Canvas 2D</p>
									<h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Leitura topográfica em tempo real</h2>
								</div>
								<p className="max-w-xl text-sm leading-6 text-slate-300/78">
									A pré-visualização é redesenhada sempre que um parâmetro muda para manter o feedback imediato sem custo de render 3D.
								</p>
							</div>

							<div ref={canvasFrameRef} className="map-generator-canvas-frame relative aspect-square min-h-[360px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/80 shadow-inner shadow-black/30 md:min-h-[460px] xl:min-h-[560px]">
								<canvas ref={canvasRef} className="h-full w-full" />

								<div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.28em] text-slate-200/68">
									<span>{mapSize * mapSize} células</span>
									<span>{sanitizeSeed(seed)}</span>
								</div>

								<div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
									<span className="rounded-full border border-white/10 bg-slate-950/72 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200/72">
										Água &lt; {waterLevel.toFixed(2)}
									</span>
									<span className="rounded-full border border-white/10 bg-slate-950/72 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200/72">
										Montanha &gt; {mountainLevel.toFixed(2)}
									</span>
									<span className="rounded-full border border-white/10 bg-slate-950/72 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200/72">
										Flora {Math.round(floraDensity * 100)}%
									</span>
								</div>
							</div>
						</div>

						<div className="grid gap-4">
							<StatCard accentClass="text-sky-200/82" label="Água" value={stats.water.toLocaleString("pt-PT")} />
							<StatCard accentClass="text-emerald-200/82" label="Relva" value={stats.grass.toLocaleString("pt-PT")} />
							<StatCard accentClass="text-slate-300/82" label="Montanha" value={stats.stone.toLocaleString("pt-PT")} />
							<StatCard accentClass="text-amber-200/82" label="Props" value={stats.flora.toLocaleString("pt-PT")} />

							<div className="rounded-[32px] border border-white/10 bg-slate-950/55 p-5 backdrop-blur-sm">
								<p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-300/68">Legenda</p>
								<div className="mt-4 grid gap-3">
									<LegendSwatch colorClass="bg-[#2b7fff]" label="Água" />
									<LegendSwatch colorClass="bg-[#4cb562]" label="Relva" />
									<LegendSwatch colorClass="bg-[#7a7f89]" label="Montanha" />
									<LegendSwatch colorClass="bg-[#facc15]" label={`Flor (${stats.flowers.toLocaleString("pt-PT")})`} />
									<LegendSwatch colorClass="bg-[#166534]" label={`Árvore (${stats.trees.toLocaleString("pt-PT")})`} />
								</div>

								<div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300/82">
									<p className="font-semibold text-slate-100">Formato de saída</p>
									<p className="mt-2">O export gera apenas a lista plana de tiles no formato exigido pelo servidor:</p>
									<code className="mt-3 block rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
										{"{ x, y, z, type, prop }[]"}
									</code>
								</div>
							</div>
						</div>
					</section>
				</section>
			</main>
		</div>
	);
}

export { MapGenerator };