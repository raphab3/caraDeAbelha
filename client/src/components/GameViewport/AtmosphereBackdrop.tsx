import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, Color, Float32BufferAttribute, MathUtils, Mesh, MeshBasicMaterial, SphereGeometry } from "three";

const SKY_TOP_COLOR = new Color("#1180ee");
const SKY_UPPER_BAND_COLOR = new Color("#065d9b");
const SKY_HORIZON_COLOR = new Color("#8dcaf5");
const SKY_BOTTOM_COLOR = new Color("#6f9bec");

function buildAtmosphereGeometry() {
	const geometry = new SphereGeometry(1, 48, 32);
	const positions = geometry.getAttribute("position");
	const colors = new Float32Array(positions.count * 3);
	const mixedColor = new Color();

	for (let index = 0; index < positions.count; index += 1) {
		const y = positions.getY(index);
		const normalizedHeight = (y + 1) * 0.5;

		if (normalizedHeight >= 0.72) {
			mixedColor.copy(SKY_UPPER_BAND_COLOR).lerp(SKY_TOP_COLOR, MathUtils.smoothstep(normalizedHeight, 0.72, 1));
		} else if (normalizedHeight >= 0.46) {
			mixedColor.copy(SKY_HORIZON_COLOR).lerp(SKY_UPPER_BAND_COLOR, MathUtils.smoothstep(normalizedHeight, 0.46, 0.72));
		} else {
			mixedColor.copy(SKY_BOTTOM_COLOR).lerp(SKY_HORIZON_COLOR, MathUtils.smoothstep(normalizedHeight, 0.08, 0.46));
		}

		colors[index * 3] = mixedColor.r;
		colors[index * 3 + 1] = mixedColor.g;
		colors[index * 3 + 2] = mixedColor.b;
	}

	geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

	return geometry;
}

export function AtmosphereBackdrop() {
	const meshRef = useRef<Mesh>(null);
	const { camera } = useThree();
	const geometry = useMemo(() => buildAtmosphereGeometry(), []);
	const material = useMemo(
		() =>
			new MeshBasicMaterial({
				color: "#ffffff",
				depthWrite: false,
				fog: false,
				side: BackSide,
				vertexColors: true,
			}),
		[],
	);

	useFrame(() => {
		if (!meshRef.current) {
			return;
		}

		meshRef.current.position.copy(camera.position);
	});

	useEffect(() => {
		return () => {
			geometry.dispose();
			material.dispose();
		};
	}, [geometry, material]);

	return <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={-100} scale={420} />;
}