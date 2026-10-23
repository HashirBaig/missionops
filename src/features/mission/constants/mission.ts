import type {
  ManeuverType,
  MissionFormValues,
  SatelliteConfig,
} from "../types/mission";

export const EARTH = {
  gravitationalParameterKm3s2: 398600.4418,
  radiusKm: 6378.137,
  standardGravityMs2: 9.80665,
} as const;

// Synthetic spacecraft characteristics.
export const DEFAULT_SATELLITE: SatelliteConfig = {
  name: "OPS-1",
  massKg: 1250,
  availablePropellantKg: 320,
  specificImpulseSeconds: 320,
  thrustNewtons: 20,
};

export const DEFAULT_MISSION: MissionFormValues = {
  satelliteName: DEFAULT_SATELLITE.name,
  currentAltitudeKm: 500,
  targetAltitudeKm: 550,
  maneuverType: "orbit-raise",
};

export const MANEUVER_OPTIONS: {
  value: ManeuverType;
  label: string;
}[] = [
  { value: "orbit-raise", label: "Orbit Raise" },
  { value: "orbit-lower", label: "Orbit Lower" },
];

export const ORBIT_COLORS = {
  current: "#3195ff",
  target: "#f59e0b",
  earth: "#2672ba",
} as const;
