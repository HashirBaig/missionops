export type ManeuverType = "orbit-raise" | "orbit-lower";

export interface SatelliteConfig {
  name: string;
  massKg: number;
  availablePropellantKg: number;
  specificImpulseSeconds: number;
  thrustNewtons: number;
}

export interface MissionFormValues {
  satelliteName: string;
  currentAltitudeKm: number;
  targetAltitudeKm: number;
  maneuverType: ManeuverType;
}

export interface MissionSimulation {
  id: string;
  satelliteName: string;
  currentAltitudeKm: number;
  targetAltitudeKm: number;
  maneuverType: ManeuverType;
  deltaVms: number;
  propellantUsedKg: number;
  remainingPropellantKg: number;
  burnTimeSeconds: number;
  transferTimeSeconds: number;
  feasible: boolean;
  simulatedAt: string;
}

export interface MissionTimelineStep {
  id: string;
  title: string;
  description: string;
  timeSeconds: number;
}

export interface SimulationMetric {
  id: string;
  label: string;
  value: string;
  unit: string;
}
