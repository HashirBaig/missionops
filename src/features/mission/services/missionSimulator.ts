import { DEFAULT_SATELLITE, EARTH } from "../constants/mission";
import type {
  MissionFormValues,
  MissionSimulation,
  MissionTimelineStep,
  SatelliteConfig,
} from "../types/mission";

export function simulateMission(
  form: MissionFormValues,
  satellite: SatelliteConfig = DEFAULT_SATELLITE,
): MissionSimulation {
  const { currentAltitudeKm, targetAltitudeKm, maneuverType, satelliteName } =
    form;

  if (
    !Number.isFinite(currentAltitudeKm) ||
    !Number.isFinite(targetAltitudeKm) ||
    currentAltitudeKm < 150 ||
    targetAltitudeKm < 150
  ) {
    throw new Error("Orbit altitudes must be at least 150 km.");
  }

  if (maneuverType === "orbit-raise" && targetAltitudeKm <= currentAltitudeKm) {
    throw new Error("Target altitude must be higher for an orbit raise.");
  }

  if (maneuverType === "orbit-lower" && targetAltitudeKm >= currentAltitudeKm) {
    throw new Error("Target altitude must be lower for an orbit lower.");
  }

  if (
    satellite.massKg <= 0 ||
    satellite.specificImpulseSeconds <= 0 ||
    satellite.thrustNewtons <= 0 ||
    satellite.availablePropellantKg < 0 ||
    satellite.availablePropellantKg >= satellite.massKg
  ) {
    throw new Error("Invalid spacecraft propulsion configuration.");
  }

  const {
    gravitationalParameterKm3s2: mu,
    radiusKm,
    standardGravityMs2: g0,
  } = EARTH;

  const r1 = radiusKm + currentAltitudeKm;
  const r2 = radiusKm + targetAltitudeKm;

  const semiMajorAxis = (r1 + r2) / 2;

  const circularVelocity1 = Math.sqrt(mu / r1);
  const circularVelocity2 = Math.sqrt(mu / r2);

  const transferVelocity1 = Math.sqrt(mu * (2 / r1 - 1 / semiMajorAxis));

  const transferVelocity2 = Math.sqrt(mu * (2 / r2 - 1 / semiMajorAxis));

  const deltaV1 = Math.abs(transferVelocity1 - circularVelocity1);

  const deltaV2 = Math.abs(circularVelocity2 - transferVelocity2);

  // Convert km/s into m/s.
  const deltaVms = (deltaV1 + deltaV2) * 1000;

  const exhaustVelocity = satellite.specificImpulseSeconds * g0;

  // Ideal rocket equation.
  // massKg is the initial wet mass, including propellant.
  const finalMass = satellite.massKg * Math.exp(-deltaVms / exhaustVelocity);

  const propellantUsedKg = satellite.massKg - finalMass;

  const remainingPropellantKg =
    satellite.availablePropellantKg - propellantUsedKg;

  // Cumulative equivalent burn time assuming constant
  // thrust and Isp. Actual finite burns are not propagated.
  const massFlowRate = satellite.thrustNewtons / exhaustVelocity;

  const burnTimeSeconds = propellantUsedKg / massFlowRate;

  // Ideal half-period transfer coast.
  const transferTimeSeconds =
    Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu);

  return {
    id: crypto.randomUUID(),
    satelliteName: satelliteName.trim(),
    currentAltitudeKm,
    targetAltitudeKm,
    maneuverType,
    deltaVms,
    propellantUsedKg,
    remainingPropellantKg,
    burnTimeSeconds,
    transferTimeSeconds,
    feasible: propellantUsedKg <= satellite.availablePropellantKg,
    simulatedAt: new Date().toISOString(),
  };
}

export function buildMissionTimeline(
  result: MissionSimulation,
): MissionTimelineStep[] {
  return [
    {
      id: "start",
      title: "Start Orbit",
      description: `${result.currentAltitudeKm} km`,
      timeSeconds: 0,
    },
    {
      id: "transfer",
      title: "Transfer",
      description: "Hohmann coast",
      timeSeconds: result.transferTimeSeconds / 2,
    },
    {
      id: "final",
      title: "Final Orbit",
      description: `${result.targetAltitudeKm} km`,
      timeSeconds: result.transferTimeSeconds,
    },
  ];
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";

  const total = Math.round(seconds);

  if (total < 60) return `${total} sec`;

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return remainingSeconds
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  return `${remainingSeconds}s`;
}
