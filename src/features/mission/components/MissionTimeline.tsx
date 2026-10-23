import { Clock3 } from "lucide-react";
import type { MissionSimulation } from "../types/mission";
import {
  buildMissionTimeline,
  formatDuration,
} from "../services/missionSimulator";

interface MissionTimelineProps {
  simulation: MissionSimulation;
}

function MissionTimeline({ simulation }: MissionTimelineProps) {
  const steps = buildMissionTimeline(simulation);

  return (
    <section className="mission-card p-5 sm:p-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2.5">
            <Clock3 className="size-5 text-blue-400" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-white">
              Mission Timeline
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Idealized transfer milestones
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-[11px] text-slate-500">Transfer Coast</p>
          <p className="mt-1 text-sm font-medium text-white">
            {formatDuration(simulation.transferTimeSeconds)}
          </p>
        </div>
      </div>

      <div className="relative grid grid-cols-3 gap-2">
        <div className="absolute left-[16.66%] right-[16.66%] top-4 h-px bg-slate-700" />

        {steps.map((step, index) => (
          <div
            key={step.id}
            className="relative z-10 flex flex-col items-center text-center"
          >
            <div
              className={[
                "flex size-8 items-center justify-center rounded-full border text-xs font-semibold",
                index === 0
                  ? "border-blue-400 bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "border-slate-600 bg-[#172739] text-slate-300",
              ].join(" ")}
            >
              {index + 1}
            </div>

            <p className="mt-4 text-xs font-medium text-slate-200 sm:text-sm">
              {step.title}
            </p>

            <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
              {step.description}
            </p>

            <span className="mt-2 text-[10px] text-blue-400/80">
              T+{formatDuration(step.timeSeconds)}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-8 border-t border-white/6 pt-4 text-[11px] leading-5 text-slate-500">
        Timeline represents an impulsive-transfer model. Finite burns and actual
        mission event times are not simulated.
      </p>
    </section>
  );
}

export default MissionTimeline;
