import { Box3, type Object3D } from "three";

export function resolveModelGroundOffsetY(object: Object3D): number {
	const bounds = new Box3().setFromObject(object);
	if (bounds.isEmpty()) {
		return 0;
	}

	return -bounds.min.y;
}
