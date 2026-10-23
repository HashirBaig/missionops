import { useCallback, useEffect, useRef, useState } from "react";

import {
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
  NearFarScalar,
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  SampledPositionProperty,
  TileMapServiceImageryProvider,
  VelocityOrientationProperty,
  Viewer,
  buildModuleUrl,
  Math as CesiumMath,
} from "cesium";

import "cesium/Build/Cesium/Widgets/widgets.css";
import "./OrbitPreview.css";

import {
  Globe2,
  Pause,
  Play,
  RotateCcw,
  Focus,
  Satellite,
  LocateFixed,
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

interface OrbitPreviewProps {
  simulation: MissionSimulation;
  onTimeChange?: (seconds: number) => void;
}

const CAMERA_DESTINATION = {
  longitude: -40,
  latitude: 20,
  height: 20_000_000,
};

function setOverviewCamera(viewer: Viewer, animate = false) {
  const destination = Cartesian3.fromDegrees(
    CAMERA_DESTINATION.longitude,
    CAMERA_DESTINATION.latitude,
    CAMERA_DESTINATION.height,
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

function OrbitPreview({ simulation, onTimeChange }: OrbitPreviewProps) {
  const viewerRef = useRef<Viewer | null>(null);
  const satelliteRef = useRef<Entity | null>(null);
  const startTimeRef = useRef<JulianDate | null>(null);

  const onTimeChangeRef = useRef(onTimeChange);
  const speedRef = useRef<number>(ORBIT_CONFIG.defaultSpeed);
  const lastReportedSecondRef = useRef(-1);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(
    ORBIT_CONFIG.defaultSpeed,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const transferSeconds = getTransferDuration(
    simulation.currentAltitudeKm,
    simulation.targetAltitudeKm,
  );

  const totalSeconds =
    transferSeconds + circularOrbitPeriod(simulation.targetAltitudeKm);

  useEffect(() => {
    onTimeChangeRef.current = onTimeChange;
  }, [onTimeChange]);

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

        baseLayer: ImageryLayer.fromProviderAsync(
          TileMapServiceImageryProvider.fromUrl(
            buildModuleUrl("Assets/Textures/NaturalEarthII"),
          ),
        ),

        // Avoid the missing skybox-texture problem
        // encountered in the earlier setup.
        skyBox: false,
      });

      viewer = cesiumViewer;
      viewerRef.current = cesiumViewer;

      const scene = cesiumViewer.scene;

      scene.globe.show = true;
      scene.globe.baseColor = Color.fromCssColorString("#102844");
      scene.backgroundColor = Color.fromCssColorString("#050d18");

      scene.globe.enableLighting = false;
      scene.globe.depthTestAgainstTerrain = false;

      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = true;
      }

      const controller = scene.screenSpaceCameraController;

      controller.enableRotate = true;
      controller.enableZoom = true;
      controller.enableTilt = true;

      setOverviewCamera(cesiumViewer);

      // Report simulation time to React once
      // per displayed simulation second.
      const handleTick = () => {
        if (disposed || cesiumViewer.isDestroyed() || !startTimeRef.current) {
          return;
        }

        const elapsed = JulianDate.secondsDifference(
          cesiumViewer.clock.currentTime,
          startTimeRef.current,
        );

        const second = Math.max(0, Math.floor(elapsed));

        if (second === lastReportedSecondRef.current) {
          return;
        }

        lastReportedSecondRef.current = second;

        setElapsedSeconds(second);
        onTimeChangeRef.current?.(second);
      };

      cesiumViewer.clock.onTick.addEventListener(handleTick);

      setError(null);
      setIsReady(true);

      return () => {
        disposed = true;

        cesiumViewer.clock.onTick.removeEventListener(handleTick);

        cesiumViewer.trackedEntity = undefined;

        satelliteRef.current = null;
        startTimeRef.current = null;
        viewerRef.current = null;

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

  // Rebuild orbital geometry only for new simulations.
  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer || !isReady || viewer.isDestroyed()) {
      return;
    }

    viewer.trackedEntity = undefined;
    viewer.entities.removeAll();

    const currentColor = Color.fromCssColorString(ORBIT_CONFIG.colors.current);

    const targetColor = Color.fromCssColorString(ORBIT_CONFIG.colors.target);

    const transferColor = Color.fromCssColorString(
      ORBIT_CONFIG.colors.transfer,
    );

    const start = JulianDate.now();

    const trajectory = buildManeuverTrajectory(
      simulation.currentAltitudeKm,
      simulation.targetAltitudeKm,
    );

    const stop = JulianDate.addSeconds(
      start,
      trajectory.totalDuration,
      new JulianDate(),
    );

    startTimeRef.current = start;
    lastReportedSecondRef.current = -1;

    // Positions at the initial simulation epoch.
    const currentOrbit = buildCircularOrbit(simulation.currentAltitudeKm);

    const targetOrbit = buildCircularOrbit(simulation.targetAltitudeKm);

    const transferArc = buildTransferPath(
      simulation.currentAltitudeKm,
      simulation.targetAltitudeKm,
    );

    const closeOrbit = (positions: Cartesian3[]): Cartesian3[] => [
      ...positions,
      positions[0],
    ];

    // Dynamically rotate orbit lines into the
    // Earth-fixed frame as simulated time advances.
    const createDynamicPositions = (basePositions: Cartesian3[]) =>
      new CallbackProperty((time: JulianDate | undefined) => {
        if (!time) return basePositions;

        const elapsed = JulianDate.secondsDifference(time, start);

        return rotateOrbitPositions(basePositions, elapsed);
      }, false);

    // Current orbit — solid blue glowing line.
    viewer.entities.add({
      id: "current-orbit",
      name: "Current Circular Orbit",
      polyline: {
        positions: createDynamicPositions(closeOrbit(currentOrbit)),
        width: 3.5,
        material: new PolylineGlowMaterialProperty({
          glowPower: 0.15,
          color: currentColor,
        }),
      },
    });

    // Target orbit — dashed orange line.
    viewer.entities.add({
      id: "target-orbit",
      name: "Target Circular Orbit",
      polyline: {
        positions: createDynamicPositions(closeOrbit(targetOrbit)),
        width: 3,
        material: new PolylineDashMaterialProperty({
          color: targetColor,
          dashLength: 18,
        }),
      },
    });

    // Hohmann transfer — teal dashed arc.
    viewer.entities.add({
      id: "transfer-path",
      name: "Hohmann Transfer",
      polyline: {
        positions: createDynamicPositions(transferArc),
        width: 2.5,
        material: new PolylineDashMaterialProperty({
          color: transferColor,
          dashLength: 12,
        }),
      },
    });

    // Satellite trajectory from orbital propagation.
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

    // Model orientation follows instantaneous velocity.
    const orientation = new VelocityOrientationProperty(position);

    const satellite = viewer.entities.add({
      id: "mission-satellite",
      name: simulation.satelliteName,
      position,
      orientation,

      // Local spacecraft model.
      model: {
        uri: "/models/missionops_satellite.glb",
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

    // Configure the Cesium simulation clock.
    viewer.clock.startTime = JulianDate.clone(start);
    viewer.clock.stopTime = JulianDate.clone(stop);
    viewer.clock.currentTime = JulianDate.clone(start);
    viewer.clock.clockRange = ClockRange.LOOP_STOP;
    viewer.clock.multiplier = speedRef.current;
    viewer.clock.shouldAnimate = true;

    setElapsedSeconds(0);
    setIsPlaying(true);
    setIsFollowing(false);

    onTimeChangeRef.current?.(0);
  }, [simulation, isReady]);

  const handlePlayPause = () => {
    const viewer = viewerRef.current;

    if (!viewer || viewer.isDestroyed()) return;

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
    onTimeChangeRef.current?.(0);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    speedRef.current = speed;

    const viewer = viewerRef.current;

    if (!viewer || viewer.isDestroyed()) return;

    viewer.clock.multiplier = speed;
  };

  const handleResetCamera = () => {
    const viewer = viewerRef.current;

    if (!viewer || viewer.isDestroyed()) return;

    viewer.trackedEntity = undefined;
    setIsFollowing(false);

    setOverviewCamera(viewer, true);
  };

  const handleFollowSatellite = () => {
    const viewer = viewerRef.current;
    const satellite = satelliteRef.current;

    if (!viewer || viewer.isDestroyed() || !satellite) {
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

  const progress =
    totalSeconds > 0 ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0;

  const phase = elapsedSeconds < transferSeconds ? "Transfer" : "Target Orbit";

  return (
    <section className="mission-card relative flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2.5">
            <Globe2 className="size-5 text-blue-400" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-white">
              Orbit Visualization
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Interactive 3D maneuver simulation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-teal-400" />

          <span className="text-xs text-slate-400">
            {isPlaying ? "Playing" : "Paused"}
          </span>
        </div>
      </div>

      {/* 3D globe */}
      <div className="relative h-105 w-full overflow-hidden bg-[#050d18]">
        <div ref={initializeCesium} className="mission-cesium-container" />

        {error && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#081321] p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!isReady && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            Loading 3D Earth...
          </div>
        )}

        {/* Legend */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-white/10 bg-[#081321]/85 p-3 backdrop-blur-md">
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
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg bg-[#081321]/85 px-3 py-2 text-xs text-slate-300">
          <Satellite className="size-4 text-blue-400" />
          {simulation.satelliteName}
        </div>
      </div>

      {/* Playback */}
      <div className="border-t border-white/6 bg-[#0b1827] px-5 py-4 sm:px-6">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">{phase}</span>

          <span className="font-mono text-xs text-slate-400">
            T+{formatMissionTime(elapsedSeconds)}
          </span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-blue-500 transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePlayPause}
              className="mission-map-button"
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isPlaying ? "Pause" : "Play"}
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
              aria-label="Restart"
              title="Restart"
            >
              <RotateCcw className="size-4" />
            </button>

            <span className="ml-2 hidden text-xs text-slate-500 sm:block">
              Animated trajectory
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Speed</span>

            <select
              value={playbackSpeed}
              onChange={(event) =>
                handleSpeedChange(Number(event.target.value))
              }
              className="rounded-lg border border-white/10 bg-[#091827] px-2.5 py-2 text-xs text-white outline-none"
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
