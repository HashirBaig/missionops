import { useCallback, useEffect, useRef, useState } from "react";

import {
  Cartesian2,
  Cartesian3,
  ClockRange,
  Color,
  Entity,
  ImageryLayer,
  TileMapServiceImageryProvider,
  buildModuleUrl,
  JulianDate,
  LabelStyle,
  LagrangePolynomialApproximation,
  NearFarScalar,
  SampledPositionProperty,
  Viewer,
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
  getTransferDuration,
  circularOrbitPeriod,
} from "../services/orbitPropagation";

interface OrbitPreviewProps {
  simulation: MissionSimulation;
}

function OrbitPreview({ simulation }: OrbitPreviewProps) {
  const viewerRef = useRef<Viewer | null>(null);
  const satelliteRef = useRef<Entity | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(
    ORBIT_CONFIG.defaultSpeed,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const transferSeconds = getTransferDuration(
    simulation.currentAltitudeKm,
    simulation.targetAltitudeKm,
  );

  const totalSeconds =
    transferSeconds + circularOrbitPeriod(simulation.targetAltitudeKm);
  const [error, setError] = useState<string | null>(null);

  const startTimeRef = useRef<JulianDate | null>(null);
  const speedRef = useRef(playbackSpeed);

  useEffect(() => {
    speedRef.current = playbackSpeed;
  }, [playbackSpeed]);

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

        // Keep disabled until we confirm all skybox assets work.
        skyBox: false,

        // Keep the atmosphere for the globe's blue edge.
        // skyAtmosphere: true,
      });

      viewer = cesiumViewer;
      viewerRef.current = cesiumViewer;

      cesiumViewer.scene.renderError.addEventListener((_scene, error) => {
        console.error("[MissionOps] Cesium render error:", error);
      });

      console.log("[MissionOps] Viewer created", {
        canvasWidth: cesiumViewer.canvas.width,
        canvasHeight: cesiumViewer.canvas.height,
        globeVisible: cesiumViewer.scene.globe.show,
        renderLoopActive: cesiumViewer.useDefaultRenderLoop,
      });

      // Globe appearance
      cesiumViewer.scene.globe.show = true;
      cesiumViewer.scene.globe.baseColor = Color.fromCssColorString("#102844");

      cesiumViewer.scene.backgroundColor = Color.fromCssColorString("#050d18");

      cesiumViewer.scene.globe.enableLighting = false;

      if (cesiumViewer.scene.skyAtmosphere) {
        cesiumViewer.scene.skyAtmosphere.show = true;
      }

      cesiumViewer.scene.globe.depthTestAgainstTerrain = false;

      // Camera controls
      const controller = cesiumViewer.scene.screenSpaceCameraController;

      controller.enableRotate = true;
      controller.enableZoom = true;
      controller.enableTilt = true;

      // Initial camera position

      cesiumViewer.camera.setView({
        destination: Cartesian3.fromDegrees(
          -40, // Longitude
          20, // Latitude
          20_000_000, // Height above Earth in meters
        ),
        orientation: {
          heading: 0,
          pitch: CesiumMath.toRadians(-90),
          roll: 0,
        },
      });

      // Update elapsed simulation time
      const handleTick = () => {
        if (disposed || cesiumViewer.isDestroyed() || !startTimeRef.current) {
          return;
        }

        const elapsed = JulianDate.secondsDifference(
          cesiumViewer.clock.currentTime,
          startTimeRef.current,
        );

        setElapsedSeconds((previous) => {
          const next = Math.max(0, Math.floor(elapsed));

          return previous === next ? previous : next;
        });
      };

      cesiumViewer.clock.onTick.addEventListener(handleTick);

      setError(null);
      setIsReady(true);

      // React 19 callback-ref cleanup
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

  // Update orbital objects when a new simulation is supplied.
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

    // Current circular orbit.
    const currentOrbit = buildCircularOrbit(simulation.currentAltitudeKm);

    viewer.entities.add({
      id: "current-orbit",
      name: "Current Circular Orbit",
      polyline: {
        positions: [...currentOrbit, currentOrbit[0]],
        width: 2.5,
        material: currentColor,
      },
    });

    // Target circular orbit.
    const targetOrbit = buildCircularOrbit(simulation.targetAltitudeKm);

    viewer.entities.add({
      id: "target-orbit",
      name: "Target Circular Orbit",
      polyline: {
        positions: [...targetOrbit, targetOrbit[0]],
        width: 2.5,
        material: targetColor,
      },
    });

    // Elliptical transfer trajectory.
    const transferPath = buildTransferPath(
      simulation.currentAltitudeKm,
      simulation.targetAltitudeKm,
    );

    viewer.entities.add({
      id: "transfer-path",
      name: "Hohmann Transfer Arc",
      polyline: {
        positions: transferPath,
        width: 2,
        material: transferColor.withAlpha(0.85),
      },
    });

    const trajectory = buildManeuverTrajectory(
      simulation.currentAltitudeKm,
      simulation.targetAltitudeKm,
    );

    setElapsedSeconds(0);

    const start = JulianDate.now();
    const stop = JulianDate.addSeconds(
      start,
      trajectory.totalDuration,
      new JulianDate(),
    );

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

    const satellite = viewer.entities.add({
      id: "mission-satellite",
      name: simulation.satelliteName,
      position,

      point: {
        pixelSize: ORBIT_CONFIG.satellitePixelSize,
        color: Color.WHITE,
        outlineColor: currentColor,
        outlineWidth: 3,
        scaleByDistance: new NearFarScalar(1_000_000, 1.5, 40_000_000, 0.7),
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
        backgroundColor: Color.fromCssColorString("#081321").withAlpha(0.8),
        scaleByDistance: new NearFarScalar(1_000_000, 1, 35_000_000, 0.55),
      },
    });

    satelliteRef.current = satellite;
    startTimeRef.current = start;

    viewer.clock.startTime = JulianDate.clone(start);
    viewer.clock.stopTime = JulianDate.clone(stop);
    viewer.clock.currentTime = JulianDate.clone(start);
    viewer.clock.clockRange = ClockRange.LOOP_STOP;
    viewer.clock.multiplier = speedRef.current;
    viewer.clock.shouldAnimate = true;

    setIsFollowing(false);
    setIsPlaying(true);
  }, [simulation, isReady]);

  const handlePlayPause = () => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const next = !viewer.clock.shouldAnimate;
    viewer.clock.shouldAnimate = next;
    setIsPlaying(next);
  };

  const handleRestart = () => {
    const viewer = viewerRef.current;
    const start = startTimeRef.current;

    if (!viewer || viewer.isDestroyed() || !start) return;

    viewer.clock.currentTime = JulianDate.clone(start);
    viewer.clock.shouldAnimate = true;

    setElapsedSeconds(0);
    setIsPlaying(true);
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

    viewer.camera.flyTo({
      destination: new Cartesian3(12_500_000, -15_000_000, 10_500_000),
      duration: 1.5,
    });
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
    <section className="mission-card relative flex min-h-117.5 flex-col overflow-hidden">
      {/* Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-5 py-4 sm:px-6">
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

      {/* Cesium canvas */}
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

        {/* Orbit legend */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-white/10 bg-[#081321]/85 p-3 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="h-0.5 w-4 bg-[#3195ff]" />
            Current: {simulation.currentAltitudeKm} km
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
            <span className="h-0.5 w-4 bg-[#f59e0b]" />
            Target: {simulation.targetAltitudeKm} km
          </div>

          <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
            <span className="h-0.5 w-4 bg-[#35d9c2]" />
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

        {/* Spacecraft label */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg bg-[#081321]/80 px-3 py-2 text-xs text-slate-300 backdrop-blur-md">
          <Satellite className="size-4 text-blue-400" />
          {simulation.satelliteName}
        </div>
      </div>

      {/* Playback controls */}
      <div className="relative z-10 border-t border-white/6 bg-[#0b1827] px-5 py-4 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-300">{phase}</span>

          <span className="font-mono text-xs text-slate-400">
            T+{Math.round(elapsedSeconds).toLocaleString()}s
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
              aria-label="Restart animation"
            >
              <RotateCcw className="size-4" />
            </button>

            <span className="ml-2 text-xs text-slate-500">
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
