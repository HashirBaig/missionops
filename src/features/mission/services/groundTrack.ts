import { Cartesian3, Cartographic, Math as CesiumMath } from "cesium";

import type { TrajectorySample } from "./orbitPropagation";

export interface GeographicPosition {
  latitude: number;
  longitude: number;
  altitudeKm: number;
}

export interface GroundTrackData {
  segments: Cartesian3[][];
  positions: GeographicPosition[];
}

/**
 * Convert an ECEF Cartesian spacecraft position into
 * geodetic coordinates on the WGS84 ellipsoid.
 */
export function getGeographicPosition(
  position: Cartesian3,
): GeographicPosition {
  const cartographic = Cartographic.fromCartesian(position);

  if (!cartographic) {
    throw new Error("Invalid spacecraft Cartesian position.");
  }

  return {
    latitude: CesiumMath.toDegrees(cartographic.latitude),
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    altitudeKm: cartographic.height / 1000,
  };
}

/**
 * Project the spacecraft onto the reference ellipsoid.
 * The ground point has altitude 0, while the original
 * spacecraft position retains its real orbital altitude.
 */
export function projectToGround(position: Cartesian3): Cartesian3 {
  const cartographic = Cartographic.fromCartesian(position);

  if (!cartographic) {
    throw new Error("Unable to project spacecraft position.");
  }

  return Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    0,
  );
}

/**
 * Build a geographic ground track.
 *
 * A new line segment starts whenever successive
 * longitudes cross the ±180-degree meridian.
 *
 * This prevents Cesium from drawing a misleading
 * line across the whole map at the International
 * Date Line.
 */
export function buildGroundTrack(samples: TrajectorySample[]): GroundTrackData {
  const segments: Cartesian3[][] = [];
  const positions: GeographicPosition[] = [];

  let currentSegment: Cartesian3[] = [];
  let previousLongitude: number | null = null;

  for (const sample of samples) {
    const geo = getGeographicPosition(sample.position);
    const groundPosition = projectToGround(sample.position);

    positions.push(geo);

    const crossesDateLine =
      previousLongitude !== null &&
      Math.abs(geo.longitude - previousLongitude) > 180;

    if (crossesDateLine) {
      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }

      currentSegment = [];
    }

    currentSegment.push(groundPosition);
    previousLongitude = geo.longitude;
  }

  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  return { segments, positions };
}

export function formatLatitude(latitude: number): string {
  return `${Math.abs(latitude).toFixed(3)}° ${latitude >= 0 ? "N" : "S"}`;
}

export function formatLongitude(longitude: number): string {
  return `${Math.abs(longitude).toFixed(3)}° ${longitude >= 0 ? "E" : "W"}`;
}
