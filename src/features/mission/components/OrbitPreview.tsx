import { useCallback, useEffect, useRef, useState } from "react";

import {
  CallbackPositionProperty,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  ClockRange,
  Color,
  Entity,
  ImageryLayer,
  JulianDate,
  LabelStyle,
  LagrangePolynomialApproximation,
  Math as CesiumMath,
  NearFarScalar,
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  Rectangle,
  SampledPositionProperty,
  SceneMode,
  TileMapServiceImageryProvider,
  VelocityOrientationProperty,
  Viewer,
  buildModuleUrl,
} from "cesium";

import "cesium/Build/Cesium/Widgets/widgets.css";
import "./OrbitPreview.css";

import {
  Focus,
  Globe,
  Globe2,
  LocateFixed,
  Map,
  Pause,
  Play,
  RotateCcw,
  Satellite,
} from "lucide-react";

import type { MissionSimulation } from "../types/mission";

import { ORBIT_CONFIG, PLAYBACK_SPEEDS } from "../constants/orbit";

import {
  buildCircularOrbit,
  buildManeuverTrajectory,
  buildTransferPath,
  circularOrbitPeriod,
  getTransferDuration,
} from "../services/orbitPropagation";

import {
  formatMissionTime,
  rotateOrbitPositions,
} from "../services/orbitVisualization";

import {
  buildGroundTrack,
  formatLatitude,
  formatLongitude,
  getGeographicPosition,
  projectToGround,
} from "../services/groundTrack";

import type { GeographicPosition } from "../services/groundTrack";

// -------------------------------------------
// Types
// -------------------------------------------

type OrbitViewMode = "3d" | "ground-track";

interface OrbitPreviewProps {
  simulation: MissionSimulation;
  onTimeChange?: (seconds: number) => void;
}

// -------------------------------------------
// Constants
// -------------------------------------------

const CAMERA_CONFIG = {
  longitude: -40,
  latitude: 20,
  height: 20_000_000,
};

const GROUND_TRACK_RECTANGLE = Rectangle.fromDegrees(-179.5, -80, 179.5, 80);

const SATELLITE_MODEL_URL = "/models/missionops_satellite.glb";

const COLORS = {
  current: Color.fromCssColorString(ORBIT_CONFIG.colors.current),
  target: Color.fromCssColorString(ORBIT_CONFIG.colors.target),
  transfer: Color.fromCssColorString(ORBIT_CONFIG.colors.transfer),
};

// -------------------------------------------
// Camera helper
// -------------------------------------------

function setOverviewCamera(viewer: Viewer, animate = false) {
  const destination = Cartesian3.fromDegrees(
    CAMERA_CONFIG.longitude,
    CAMERA_CONFIG.latitude,
    CAMERA_CONFIG.height,
  );

  const orientation = {
    heading: 0,
    pitch: CesiumMath.toRadians(-90),
    roll: 0,
  };

  if (animate) {
    viewer.camera.flyTo({
      destination,
      orientation,
      duration: 1.3,
    });
  } else {
    viewer.camera.setView({
      destination,
      orientation,
    });
  }
}

// -------------------------------------------
// Component
// -------------------------------------------

function OrbitPreview({ simulation, onTimeChange }: OrbitPreviewProps) {
  // Cesium references
  const viewerRef = useRef<Viewer | null>(null);
  const satelliteRef = useRef<Entity | null>(null);

  const startTimeRef = useRef<JulianDate | null>(null);

  const spacecraftPositionRef = useRef<SampledPositionProperty | null>(null);

  // Entity groups
  const orbitEntitiesRef = useRef<Entity[]>([]);
  const groundTrackEntitiesRef = useRef<Entity[]>([]);

  // Callback references
  const onTimeChangeRef = useRef(onTimeChange);

  const speedRef = useRef<number>(ORBIT_CONFIG.defaultSpeed);

  const lastReportedSecondRef = useRef(-1);

  // Current view reference for Cesium callbacks
  const viewModeRef = useRef<OrbitViewMode>("3d");
  const morphingRef = useRef(false);

  // React states
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  const [viewMode, setViewMode] = useState<OrbitViewMode>("3d");

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(
    ORBIT_CONFIG.defaultSpeed,
  );

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [geoPosition, setGeoPosition] = useState<GeographicPosition | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  // Simulation durations
  const transferSeconds = getTransferDuration(
    simulation.currentAltitudeKm,
    simulation.targetAltitudeKm,
  );

  const totalSeconds =
    transferSeconds + circularOrbitPeriod(simulation.targetAltitudeKm);

  // -------------------------------------------
  // Keep callback reference current
  // -------------------------------------------

  useEffect(() => {
    onTimeChangeRef.current = onTimeChange;
  }, [onTimeChange]);

  // -------------------------------------------
  // Initialize Cesium Viewer
  // -------------------------------------------

  const initializeCesium = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;

    let disposed = false;
    let viewer: Viewer | null = null;

    try {
      const cesiumViewer = new Viewer(container, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        sceneModePicker: false,
        infoBox: false,
        selectionIndicator: false,
        requestRenderMode: false,
        shouldAnimate: true,

        // Local Natural Earth imagery
        baseLayer: ImageryLayer.fromProviderAsync(
          TileMapServiceImageryProvider.fromUrl(
            buildModuleUrl("Assets/Textures/NaturalEarthII"),
          ),
        ),

        // Keep disabled because the default
        // skybox caused asset decoding errors.
        skyBox: false,
      });

      viewer = cesiumViewer;
      viewerRef.current = cesiumViewer;

      const scene = cesiumViewer.scene;

      // Globe appearance
      scene.globe.show = true;

      scene.globe.baseColor = Color.fromCssColorString("#102844");

      scene.backgroundColor = Color.fromCssColorString("#050d18");

      scene.globe.enableLighting = false;
      scene.globe.depthTestAgainstTerrain = false;

      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = true;
      }

      // Camera controls
      const controller = scene.screenSpaceCameraController;

      controller.enableRotate = true;
      controller.enableZoom = true;
      controller.enableTilt = true;

      setOverviewCamera(cesiumViewer);

      // -----------------------------------
      // Clock listener
      // -----------------------------------

      const handleTick = () => {
        if (disposed || cesiumViewer.isDestroyed() || !startTimeRef.current) {
          return;
        }

        const currentTime = cesiumViewer.clock.currentTime;

        const elapsed = JulianDate.secondsDifference(
          currentTime,
          startTimeRef.current,
        );

        const second = Math.max(0, Math.floor(elapsed));

        // Avoid redundant React updates.
        if (second === lastReportedSecondRef.current) {
          return;
        }

        lastReportedSecondRef.current = second;

        // Synchronize playback UI
        setElapsedSeconds(second);

        // Synchronize dashboard timeline
        onTimeChangeRef.current?.(second);

        // Calculate current geographic position
        const position = spacecraftPositionRef.current?.getValue(currentTime);

        if (position) {
          const geographic = getGeographicPosition(position);

          setGeoPosition(geographic);
        }
      };

      cesiumViewer.clock.onTick.addEventListener(handleTick);

      // Render error monitoring
      const removeRenderErrorListener = scene.renderError.addEventListener(
        (_scene, renderError) => {
          console.error("[MissionOps] Cesium render error:", renderError);
        },
      );

      setError(null);
      setIsReady(true);

      // -----------------------------------
      // React 19 callback-ref cleanup
      // -----------------------------------

      return () => {
        disposed = true;

        cesiumViewer.clock.onTick.removeEventListener(handleTick);

        removeRenderErrorListener();

        cesiumViewer.trackedEntity = undefined;

        satelliteRef.current = null;
        startTimeRef.current = null;
        spacecraftPositionRef.current = null;

        orbitEntitiesRef.current = [];
        groundTrackEntitiesRef.current = [];

        viewerRef.current = null;
        morphingRef.current = false;

        if (!cesiumViewer.isDestroyed()) {
          cesiumViewer.destroy();
        }

        setIsReady(false);
      };
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to initialize Cesium.",
      );

      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }

      viewerRef.current = null;
    }
  }, []);

  // -------------------------------------------
  // Build orbital simulation entities
  // -------------------------------------------

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer || !isReady || viewer.isDestroyed()) {
      return;
    }

    // Remove old mission objects
    viewer.trackedEntity = undefined;
    viewer.entities.removeAll();

    orbitEntitiesRef.current = [];
    groundTrackEntitiesRef.current = [];
    spacecraftPositionRef.current = null;

    // Generate trajectory
    const trajectory = buildManeuverTrajectory(
      simulation.currentAltitudeKm,
      simulation.targetAltitudeKm,
    );

    const start = JulianDate.now();

    const stop = JulianDate.addSeconds(
      start,
      trajectory.totalDuration,
      new JulianDate(),
    );

    startTimeRef.current = start;
    lastReportedSecondRef.current = -1;

    // -----------------------------------
    // Orbital geometry
    // -----------------------------------

    const currentOrbit = buildCircularOrbit(simulation.currentAltitudeKm);

    const targetOrbit = buildCircularOrbit(simulation.targetAltitudeKm);

    const transferArc = buildTransferPath(
      simulation.currentAltitudeKm,
      simulation.targetAltitudeKm,
    );

    const closeOrbit = (positions: Cartesian3[]): Cartesian3[] => {
      if (positions.length === 0) return [];

      return [...positions, positions[0]];
    };

    // Dynamic Earth-fixed orbit representation
    const createDynamicPositions = (basePositions: Cartesian3[]) =>
      new CallbackProperty((time: JulianDate | undefined) => {
        if (!time) return basePositions;

        const elapsed = JulianDate.secondsDifference(time, start);

        return rotateOrbitPositions(basePositions, elapsed);
      }, false);

    // -----------------------------------
    // Current orbit - glowing blue
    // -----------------------------------

    const currentOrbitEntity = viewer.entities.add({
      id: "current-orbit",
      name: "Current Circular Orbit",

      polyline: {
        positions: createDynamicPositions(closeOrbit(currentOrbit)),

        width: 3.5,

        material: new PolylineGlowMaterialProperty({
          glowPower: 0.15,
          color: COLORS.current,
        }),
      },
    });

    orbitEntitiesRef.current.push(currentOrbitEntity);

    // -----------------------------------
    // Target orbit - dashed orange
    // -----------------------------------

    const targetOrbitEntity = viewer.entities.add({
      id: "target-orbit",
      name: "Target Circular Orbit",

      polyline: {
        positions: createDynamicPositions(closeOrbit(targetOrbit)),

        width: 3,

        material: new PolylineDashMaterialProperty({
          color: COLORS.target,
          dashLength: 18,
        }),
      },
    });

    orbitEntitiesRef.current.push(targetOrbitEntity);

    // -----------------------------------
    // Transfer orbit - dashed teal
    // -----------------------------------

    const transferOrbitEntity = viewer.entities.add({
      id: "transfer-path",
      name: "Hohmann Transfer",

      polyline: {
        positions: createDynamicPositions(transferArc),

        width: 2.5,

        material: new PolylineDashMaterialProperty({
          color: COLORS.transfer,
          dashLength: 12,
        }),
      },
    });

    orbitEntitiesRef.current.push(transferOrbitEntity);

    // -----------------------------------
    // Satellite trajectory
    // -----------------------------------

    const position = new SampledPositionProperty();

    for (const sample of trajectory.samples) {
      const time = JulianDate.addSeconds(
        start,
        sample.seconds,
        new JulianDate(),
      );

      position.addSample(time, sample.position);
    }

    position.setInterpolationOptions({
      interpolationDegree: 2,
      interpolationAlgorithm: LagrangePolynomialApproximation,
    });

    spacecraftPositionRef.current = position;

    const orientation = new VelocityOrientationProperty(position);

    // -----------------------------------
    // 3D Satellite model
    // -----------------------------------

    const satellite = viewer.entities.add({
      id: "mission-satellite",
      name: simulation.satelliteName,

      position,
      orientation,

      model: {
        uri: SATELLITE_MODEL_URL,
        scale: 1,
        minimumPixelSize: 36,
        maximumScale: 200_000,
        runAnimations: true,
      },

      label: {
        text: simulation.satelliteName,
        font: "13px sans-serif",

        style: LabelStyle.FILL_AND_OUTLINE,

        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,

        pixelOffset: new Cartesian2(0, -28),

        showBackground: true,

        backgroundColor: Color.fromCssColorString("#081321").withAlpha(0.85),

        scaleByDistance: new NearFarScalar(1_000_000, 1, 35_000_000, 0.55),
      },
    });

    satelliteRef.current = satellite;
    orbitEntitiesRef.current.push(satellite);

    // -----------------------------------
    // Ground track geometry
    // -----------------------------------

    const groundTrack = buildGroundTrack(trajectory.samples);

    groundTrack.segments.forEach((segment, index) => {
      const entity = viewer.entities.add({
        id: `ground-track-${index}`,
        name: `Ground Track ${index + 1}`,

        show: false,

        polyline: {
          positions: segment,
          width: 3,
          clampToGround: true,

          material: COLORS.transfer.withAlpha(0.95),
        },
      });

      groundTrackEntitiesRef.current.push(entity);
    });

    // -----------------------------------
    // Current sub-satellite position
    // -----------------------------------

    const groundPosition = new CallbackPositionProperty(
      (time: JulianDate | undefined) => {
        if (!time) {
          return undefined;
        }

        const spacecraftPosition = position.getValue(time);

        if (!spacecraftPosition) {
          return undefined;
        }

        return projectToGround(spacecraftPosition);
      },
      false,
    );

    const groundMarker = viewer.entities.add({
      id: "ground-track-marker",

      name: `${simulation.satelliteName} Ground Position`,

      show: false,

      position: groundPosition,

      point: {
        pixelSize: 12,

        color: Color.WHITE,

        outlineColor: COLORS.transfer,
        outlineWidth: 4,

        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },

      label: {
        text: simulation.satelliteName,
        font: "13px sans-serif",

        style: LabelStyle.FILL_AND_OUTLINE,

        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 3,

        pixelOffset: new Cartesian2(0, -24),

        showBackground: true,

        backgroundColor: Color.fromCssColorString("#081321").withAlpha(0.85),
      },
    });

    groundTrackEntitiesRef.current.push(groundMarker);

    // -----------------------------------
    // Initialize geographic coordinates
    // -----------------------------------

    const initialPosition = position.getValue(start);

    if (initialPosition) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGeoPosition(getGeographicPosition(initialPosition));
    }

    // -----------------------------------
    // Configure simulation clock
    // -----------------------------------

    viewer.clock.startTime = JulianDate.clone(start);

    viewer.clock.stopTime = JulianDate.clone(stop);

    viewer.clock.currentTime = JulianDate.clone(start);

    viewer.clock.clockRange = ClockRange.LOOP_STOP;

    viewer.clock.multiplier = speedRef.current;

    viewer.clock.shouldAnimate = true;

    // Apply currently selected view to new entities.
    const show3D = viewModeRef.current === "3d";

    if (viewer && !viewer.isDestroyed()) {
      for (const entity of orbitEntitiesRef.current) {
        const cesiumEntity = viewer.entities.getById(entity.id);

        if (cesiumEntity) {
          cesiumEntity.show = show3D;
        }
      }

      for (const entity of groundTrackEntitiesRef.current) {
        const cesiumEntity = viewer.entities.getById(entity.id);

        if (cesiumEntity) {
          cesiumEntity.show = !show3D;
        }
      }
    }

    // Keep the map in its selected mode.
    setElapsedSeconds(0);
    setIsPlaying(true);
    setIsFollowing(false);

    onTimeChangeRef.current?.(0);
  }, [simulation, isReady]);

  // -------------------------------------------
  // View switching
  // -------------------------------------------

  const handleViewChange = (nextMode: OrbitViewMode) => {
    const viewer = viewerRef.current;

    if (
      !viewer ||
      viewer.isDestroyed() ||
      nextMode === viewModeRef.current ||
      morphingRef.current ||
      viewer.scene.mode === SceneMode.MORPHING
    ) {
      return;
    }

    viewer.trackedEntity = undefined;
    setIsFollowing(false);

    morphingRef.current = true;

    const scene = viewer.scene;

    const removeListener = scene.morphComplete.addEventListener(() => {
      removeListener();

      morphingRef.current = false;

      if (viewer.isDestroyed()) return;

      if (nextMode === "ground-track") {
        viewer.camera.setView({
          destination: GROUND_TRACK_RECTANGLE,
        });
      } else {
        setOverviewCamera(viewer, false);
      }
    });

    viewModeRef.current = nextMode;
    setViewMode(nextMode);

    // Update entity visibility immediately.
    const show3D = nextMode === "3d";

    if (viewer && !viewer.isDestroyed()) {
      for (const entity of orbitEntitiesRef.current) {
        const cesiumEntity = viewer.entities.getById(entity.id);

        if (cesiumEntity) {
          cesiumEntity.show = show3D;
        }
      }

      for (const entity of groundTrackEntitiesRef.current) {
        const cesiumEntity = viewer.entities.getById(entity.id);

        if (cesiumEntity) {
          cesiumEntity.show = !show3D;
        }
      }
    }

    if (nextMode === "ground-track") {
      scene.morphTo2D(1);
    } else {
      scene.morphTo3D(1);
    }
  };

  // -------------------------------------------
  // Playback controls
  // -------------------------------------------

  const handlePlayPause = () => {
    const viewer = viewerRef.current;

    if (!viewer || viewer.isDestroyed()) {
      return;
    }

    const playing = !viewer.clock.shouldAnimate;

    viewer.clock.shouldAnimate = playing;

    setIsPlaying(playing);
  };

  const handleRestart = () => {
    const viewer = viewerRef.current;
    const start = startTimeRef.current;

    if (!viewer || viewer.isDestroyed() || !start) {
      return;
    }

    viewer.clock.currentTime = JulianDate.clone(start);

    viewer.clock.shouldAnimate = true;

    lastReportedSecondRef.current = -1;

    setElapsedSeconds(0);
    setIsPlaying(true);

    const initialPosition = spacecraftPositionRef.current?.getValue(start);

    if (initialPosition) {
      setGeoPosition(getGeographicPosition(initialPosition));
    }

    onTimeChangeRef.current?.(0);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);

    speedRef.current = speed;

    const viewer = viewerRef.current;

    if (!viewer || viewer.isDestroyed()) {
      return;
    }

    viewer.clock.multiplier = speed;
  };

  // -------------------------------------------
  // Camera controls
  // -------------------------------------------

  const handleResetCamera = () => {
    const viewer = viewerRef.current;

    if (!viewer || viewer.isDestroyed() || morphingRef.current) {
      return;
    }

    viewer.trackedEntity = undefined;
    setIsFollowing(false);

    if (viewModeRef.current === "ground-track") {
      viewer.camera.flyTo({
        destination: GROUND_TRACK_RECTANGLE,
        duration: 1.2,
      });
    } else {
      setOverviewCamera(viewer, true);
    }
  };

  const handleFollowSatellite = () => {
    const viewer = viewerRef.current;
    const satellite = satelliteRef.current;

    if (
      !viewer ||
      viewer.isDestroyed() ||
      !satellite ||
      viewModeRef.current !== "3d"
    ) {
      return;
    }

    if (isFollowing) {
      viewer.trackedEntity = undefined;
      setIsFollowing(false);
    } else {
      viewer.trackedEntity = satellite;
      setIsFollowing(true);
    }
  };

  // -------------------------------------------
  // Derived UI state
  // -------------------------------------------

  const progress =
    totalSeconds > 0 ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0;

  const phase = elapsedSeconds < transferSeconds ? "Transfer" : "Target Orbit";

  // -------------------------------------------
  // Render
  // -------------------------------------------

  return (
    <section className="mission-card relative flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/6 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2.5">
            <Globe2 className="size-5 text-blue-400" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-white">
              Orbit Visualization
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Interactive satellite maneuver simulation
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View switcher */}
          <div className="flex items-center rounded-lg border border-white/10 bg-[#081321] p-1">
            <button
              type="button"
              onClick={() => handleViewChange("3d")}
              aria-pressed={viewMode === "3d"}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                viewMode === "3d"
                  ? "bg-blue-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Globe className="size-4" />
              3D Globe
            </button>

            <button
              type="button"
              onClick={() => handleViewChange("ground-track")}
              aria-pressed={viewMode === "ground-track"}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                viewMode === "ground-track"
                  ? "bg-blue-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Map className="size-4" />
              Ground Track
            </button>
          </div>

          {/* Playing status */}
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                isPlaying ? "bg-teal-400" : "bg-amber-400"
              }`}
            />

            <span className="text-xs text-slate-400">
              {isPlaying ? "Playing" : "Paused"}
            </span>
          </div>
        </div>
      </div>

      {/* Cesium visualization */}
      <div className="relative h-105 w-full overflow-hidden bg-[#050d18]">
        <div ref={initializeCesium} className="mission-cesium-container" />

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#081321] p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {!isReady && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Loading Earth visualization...
          </div>
        )}

        {/* Orbit / Ground Track legend */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-white/10 bg-[#081321]/85 p-3 backdrop-blur-md">
          {viewMode === "3d" ? (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="h-0.75 w-5 rounded bg-[#3195ff]" />
                Current: {simulation.currentAltitudeKm} km
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                <span className="w-5 border-t-2 border-dashed border-[#f59e0b]" />
                Target: {simulation.targetAltitudeKm} km
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                <span className="w-5 border-t-2 border-dashed border-[#35d9c2]" />
                Transfer
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="h-0.75 w-5 rounded bg-[#35d9c2]" />
                Projected Ground Track
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                <span className="size-2.5 rounded-full border-2 border-[#35d9c2] bg-white" />
                Sub-satellite Position
              </div>
            </>
          )}
        </div>

        {/* Camera controls */}
        <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleResetCamera}
            title="Reset camera"
            aria-label="Reset camera"
            className="mission-map-button"
          >
            <Focus className="size-4" />
          </button>

          {viewMode === "3d" && (
            <button
              type="button"
              onClick={handleFollowSatellite}
              title="Follow satellite"
              aria-label="Follow satellite"
              aria-pressed={isFollowing}
              className={`mission-map-button ${
                isFollowing ? "mission-map-button-active" : ""
              }`}
            >
              <LocateFixed className="size-4" />
            </button>
          )}
        </div>

        {/* Satellite label */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg bg-[#081321]/85 px-3 py-2 text-xs text-slate-300 backdrop-blur-md">
          <Satellite className="size-4 text-blue-400" />
          {simulation.satelliteName}
        </div>
      </div>

      {/* Ground track geographic information */}
      {viewMode === "ground-track" && (
        <div className="grid grid-cols-1 gap-3 border-t border-white/6 bg-[#0b1827] p-4 sm:grid-cols-3 sm:p-5">
          {/* Latitude */}
          <div className="rounded-xl border border-white/[0.07] bg-[#101f30] px-4 py-3">
            <p className="text-xs text-slate-400">Latitude</p>

            <p className="mt-2 font-mono text-lg font-semibold text-white">
              {geoPosition ? formatLatitude(geoPosition.latitude) : "—"}
            </p>
          </div>

          {/* Longitude */}
          <div className="rounded-xl border border-white/[0.07] bg-[#101f30] px-4 py-3">
            <p className="text-xs text-slate-400">Longitude</p>

            <p className="mt-2 font-mono text-lg font-semibold text-white">
              {geoPosition ? formatLongitude(geoPosition.longitude) : "—"}
            </p>
          </div>

          {/* Satellite altitude */}
          <div className="rounded-xl border border-white/[0.07] bg-[#101f30] px-4 py-3">
            <p className="text-xs text-slate-400">Satellite Altitude</p>

            <p className="mt-2 font-mono text-lg font-semibold text-white">
              {geoPosition ? geoPosition.altitudeKm.toFixed(2) : "—"}

              <span className="ml-2 text-xs font-normal text-slate-500">
                km
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Playback controls */}
      <div className="border-t border-white/6 bg-[#0b1827] px-5 py-4 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-300">{phase}</span>

          <span className="font-mono text-xs text-slate-400">
            T+{formatMissionTime(elapsedSeconds)}
          </span>
        </div>

        {/* Playback progress */}
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-blue-500 transition-[width] duration-150"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          {/* Playback buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePlayPause}
              className="mission-map-button"
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="size-4 fill-current" />
              )}
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="mission-map-button"
              title="Restart"
              aria-label="Restart"
            >
              <RotateCcw className="size-4" />
            </button>

            <span className="ml-2 hidden text-xs text-slate-500 sm:block">
              Animated trajectory
            </span>
          </div>

          {/* Playback speed */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Speed</span>

            <select
              value={playbackSpeed}
              onChange={(event) =>
                handleSpeedChange(Number(event.target.value))
              }
              className="rounded-lg border border-white/10 bg-[#091827] px-2.5 py-2 text-xs text-white outline-none focus:border-blue-500/50"
              aria-label="Playback speed"
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <option key={speed.value} value={speed.value}>
                  {speed.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}

export default OrbitPreview;
