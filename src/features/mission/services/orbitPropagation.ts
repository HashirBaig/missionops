import { Cartesian3 } from "cesium";

import { EARTH } from "../constants/mission";
import { ORBIT_CONFIG } from "../constants/orbit";

export interface OrbitPoint {
  xKm: number;
  yKm: number;
  zKm: number;
}

export interface TrajectorySample {
  seconds: number;
  position: Cartesian3;
}

const DEG_TO_RAD = Math.PI / 180;

const MU = EARTH.gravitationalParameterKm3s2;
const EARTH_RADIUS = EARTH.radiusKm;

function rotateOrbitalPlane(xKm: number, yKm: number): OrbitPoint {
  const inclination = ORBIT_CONFIG.inclinationDeg * DEG_TO_RAD;

  const ascendingNode = ORBIT_CONFIG.ascendingNodeDeg * DEG_TO_RAD;

  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  const cosO = Math.cos(ascendingNode);
  const sinO = Math.sin(ascendingNode);

  return {
    xKm: cosO * xKm - sinO * cosI * yKm,
    yKm: sinO * xKm + cosO * cosI * yKm,
    zKm: sinI * yKm,
  };
}

/**
 * Converts a simplified Earth-centered inertial position
 * into an Earth-fixed Cartesian position.
 *
 * Uses a constant Earth rotation rate with a synthetic
 * zero-angle reference at t=0.
 *
 * This is an approximation, not an IAU Earth-orientation
 * or precision ECI-to-ECEF transformation.
 */
function toEarthFixed(position: OrbitPoint, seconds: number): Cartesian3 {
  const theta = ORBIT_CONFIG.earthRotationRadPerSecond * seconds;

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const xKm = cosT * position.xKm + sinT * position.yKm;

  const yKm = -sinT * position.xKm + cosT * position.yKm;

  return new Cartesian3(xKm * 1000, yKm * 1000, position.zKm * 1000);
}

export function circularOrbitPeriod(altitudeKm: number): number {
  const radius = EARTH_RADIUS + altitudeKm;
  return 2 * Math.PI * Math.sqrt(radius ** 3 / MU);
}

export function buildCircularOrbit(
  altitudeKm: number,
  sampleCount = ORBIT_CONFIG.orbitSamples,
): Cartesian3[] {
  const radius = EARTH_RADIUS + altitudeKm;

  return Array.from({ length: sampleCount }, (_, i) => {
    const angle = (i / sampleCount) * 2 * Math.PI;

    const position = rotateOrbitalPlane(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
    );

    // A snapshot at the beginning of the simulation.
    return toEarthFixed(position, 0);
  });
}

/**
 * Solve M = E - e*sin(E) using Newton's method.
 */
function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let eccentricAnomaly = meanAnomaly;

  for (let iteration = 0; iteration < 30; iteration++) {
    const residual =
      eccentricAnomaly -
      eccentricity * Math.sin(eccentricAnomaly) -
      meanAnomaly;

    const derivative = 1 - eccentricity * Math.cos(eccentricAnomaly);

    const delta = residual / derivative;

    eccentricAnomaly -= delta;

    if (Math.abs(delta) < 1e-12) break;
  }

  return eccentricAnomaly;
}

export function getTransferDuration(
  currentAltitudeKm: number,
  targetAltitudeKm: number,
): number {
  const r1 = EARTH_RADIUS + currentAltitudeKm;
  const r2 = EARTH_RADIUS + targetAltitudeKm;
  const a = (r1 + r2) / 2;

  return Math.PI * Math.sqrt(a ** 3 / MU);
}

function getTransferInertialPosition(
  currentAltitudeKm: number,
  targetAltitudeKm: number,
  seconds: number,
): OrbitPoint {
  const r1 = EARTH_RADIUS + currentAltitudeKm;
  const r2 = EARTH_RADIUS + targetAltitudeKm;

  const semiMajorAxis = (r1 + r2) / 2;
  const eccentricity = Math.abs(r2 - r1) / (r1 + r2);

  const meanMotion = Math.sqrt(MU / semiMajorAxis ** 3);

  // Orbit raising starts at perigee.
  // Orbit lowering starts at apogee.
  const startingMeanAnomaly = r2 > r1 ? 0 : Math.PI;

  const meanAnomaly = startingMeanAnomaly + meanMotion * seconds;

  const eccentricAnomaly = solveKepler(meanAnomaly, eccentricity);

  const x = semiMajorAxis * (Math.cos(eccentricAnomaly) - eccentricity);

  const y =
    semiMajorAxis *
    Math.sqrt(1 - eccentricity ** 2) *
    Math.sin(eccentricAnomaly);

  return rotateOrbitalPlane(x, y);
}

/**
 * Generate an animated transfer trajectory followed
 * by one full circular orbit at the target altitude.
 *
 * Transfer burns are treated as instantaneous impulses.
 */
export function buildManeuverTrajectory(
  currentAltitudeKm: number,
  targetAltitudeKm: number,
): {
  samples: TrajectorySample[];
  transferDuration: number;
  totalDuration: number;
} {
  const transferDuration = getTransferDuration(
    currentAltitudeKm,
    targetAltitudeKm,
  );

  const targetPeriod = circularOrbitPeriod(targetAltitudeKm);

  const totalDuration = transferDuration + targetPeriod;

  const samples: TrajectorySample[] = [];

  const isRaise = targetAltitudeKm > currentAltitudeKm;

  const targetRadius = EARTH_RADIUS + targetAltitudeKm;

  const targetStartingAngle = isRaise ? Math.PI : 0;

  const targetMeanMotion = Math.sqrt(MU / targetRadius ** 3);

  for (let i = 0; i <= ORBIT_CONFIG.trajectorySamples; i++) {
    const seconds = (i / ORBIT_CONFIG.trajectorySamples) * totalDuration;

    let inertialPosition: OrbitPoint;

    if (seconds <= transferDuration) {
      inertialPosition = getTransferInertialPosition(
        currentAltitudeKm,
        targetAltitudeKm,
        seconds,
      );
    } else {
      const secondsAfterTransfer = seconds - transferDuration;

      const angle =
        targetStartingAngle + targetMeanMotion * secondsAfterTransfer;

      inertialPosition = rotateOrbitalPlane(
        targetRadius * Math.cos(angle),
        targetRadius * Math.sin(angle),
      );
    }

    samples.push({
      seconds,
      position: toEarthFixed(inertialPosition, seconds),
    });
  }

  return {
    samples,
    transferDuration,
    totalDuration,
  };
}

/**
 * The complete transfer ellipse displayed as a guide.
 * This is an inertial-orbit snapshot, not a moving
 * Earth-fixed ground track.
 */
export function buildTransferPath(
  currentAltitudeKm: number,
  targetAltitudeKm: number,
  sampleCount = 180,
): Cartesian3[] {
  const duration = getTransferDuration(currentAltitudeKm, targetAltitudeKm);

  return Array.from({ length: sampleCount + 1 }, (_, i) => {
    const seconds = (i / sampleCount) * duration;

    const inertialPosition = getTransferInertialPosition(
      currentAltitudeKm,
      targetAltitudeKm,
      seconds,
    );

    return toEarthFixed(inertialPosition, 0);
  });
}
