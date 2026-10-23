export const ORBIT_CONFIG = {
  // Demo orbital orientation, in degrees.
  inclinationDeg: 45,
  ascendingNodeDeg: 25,

  // Earth's sidereal rotation rate.
  earthRotationRadPerSecond: 7.292115e-5,

  // Number of points used to render complete orbits.
  orbitSamples: 360,

  // Number of time samples for the spacecraft.
  trajectorySamples: 400,

  // Initial Cesium playback speed.
  defaultSpeed: 120,

  // Visual marker settings.
  satellitePixelSize: 12,

  colors: {
    current: "#3195ff",
    target: "#f59e0b",
    transfer: "#35d9c2",
  },
} as const;

export const PLAYBACK_SPEEDS = [
  { label: "1×", value: 1 },
  { label: "30×", value: 30 },
  { label: "120×", value: 120 },
  { label: "600×", value: 600 },
  { label: "1200×", value: 1200 },
] as const;
