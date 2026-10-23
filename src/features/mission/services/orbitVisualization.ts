import { Cartesian3 } from "cesium";
import { ORBIT_CONFIG } from "../constants/orbit";

const OMEGA = ORBIT_CONFIG.earthRotationRadPerSecond;

/**
 * Rotate an inertial-orbit snapshot into the
 * simplified Earth-fixed frame at elapsed time t.
 *
 * Matches the constant Earth rotation convention
 * used in orbitPropagation.ts.
 */
export function rotateOrbitPositions(
  positions: readonly Cartesian3[],
  elapsedSeconds: number,
): Cartesian3[] {
  const angle = OMEGA * elapsedSeconds;

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return positions.map((position) => {
    return new Cartesian3(
      cos * position.x + sin * position.y,
      -sin * position.x + cos * position.y,
      position.z,
    );
  });
}

export function formatMissionTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;

  return [hours, minutes, remaining]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
