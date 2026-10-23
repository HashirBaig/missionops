import { Clock3, Check } from "lucide-react";

import type { MissionSimulation } from "../types/mission";
import { formatMissionTime } from "../services/orbitVisualization";

interface MissionTimelineProps {
  simulation: MissionSimulation;
  elapsedSeconds: number;
}

function MissionTimeline({ simulation, elapsedSeconds }: MissionTimelineProps) {
  const transferDuration = simulation.transferTimeSeconds;

  const midpoint = transferDuration / 2;

  const steps = [
    {
      id: "start",
      title: "Departure",
      description: `${simulation.currentAltitudeKm} km`,
      time: 0,
    },
    {
      id: "transfer",
      title: "Transfer",
      description: "Coast midpoint",
      time: midpoint,
    },
    {
      id: "arrival",
      title: "Arrival",
      description: `${simulation.targetAltitudeKm} km`,
      time: transferDuration,
    },
  ];

  const activeIndex =
    elapsedSeconds >= transferDuration ? 2 : elapsedSeconds >= midpoint ? 1 : 0;

  const transferProgress =
    transferDuration > 0
      ? Math.min(100, (elapsedSeconds / transferDuration) * 100)
      : 0;

  return (
    <section className="mission-card p-5 sm:p-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2.5">
            <Clock3 className="size-5 text-blue-400" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-white">
              Mission Timeline
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              Synchronized with spacecraft animation
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-[11px] text-slate-500">Simulated elapsed time</p>

          <p className="mt-1 font-mono text-sm font-medium text-blue-400">
            {formatMissionTime(elapsedSeconds)}
          </p>
        </div>
      </div>

      {/* Transfer progress */}
      <div className="mb-8">
        <div className="mb-2 flex justify-between text-xs text-slate-500">
          <span>Hohmann transfer</span>

          <span>{Math.round(transferProgress)}%</span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-blue-500 transition-[width] duration-150"
            style={{
              width: `${transferProgress}%`,
            }}
          />
        </div>
      </div>

      {/* Milestones */}
      <div className="relative grid grid-cols-3 gap-2">
        <div className="absolute left-[16.66%] right-[16.66%] top-4 h-px bg-slate-700" />

        <div
          className="absolute left-[16.66%] top-4 h-px bg-blue-500 transition-[width] duration-150"
          style={{
            width: `${transferProgress * (2 / 3)}%`,
            maxWidth: "66.66%",
          }}
        />

        {steps.map((step, index) => {
          const isComplete = index < activeIndex;
          const isActive = index === activeIndex;

          return (
            <div
              key={step.id}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div
                className={[
                  "flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-200",
                  isActive
                    ? "border-blue-400 bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : isComplete
                      ? "border-blue-500 bg-blue-500/20 text-blue-400"
                      : "border-slate-600 bg-[#172739] text-slate-400",
                ].join(" ")}
              >
                {isComplete ? <Check className="size-4" /> : index + 1}
              </div>

              <p
                className={`mt-4 text-xs font-medium sm:text-sm ${
                  isActive ? "text-blue-400" : "text-slate-300"
                }`}
              >
                {step.title}
              </p>

              <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
                {step.description}
              </p>

              <span className="mt-2 font-mono text-[10px] text-slate-500">
                T+{formatMissionTime(step.time)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-4">
        <p className="text-[11px] text-slate-500">
          Idealized impulsive-burn transfer
        </p>

        {elapsedSeconds >= transferDuration && (
          <span className="rounded-full bg-teal-500/10 px-3 py-1 text-[11px] font-medium text-teal-400">
            Transfer complete
          </span>
        )}
      </div>
    </section>
  );
}

export default MissionTimeline;
