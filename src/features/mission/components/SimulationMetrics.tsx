import type { ReactNode } from "react";
import { Gauge, Fuel, Timer } from "lucide-react";

import type { MissionSimulation } from "../types/mission";
import { formatDuration } from "../services/missionSimulator";

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  icon: ReactNode;
  accent: "blue" | "teal" | "violet";
}

const accentStyles = {
  blue: "bg-blue-500/10 text-blue-400",
  teal: "bg-teal-500/10 text-teal-400",
  violet: "bg-violet-500/10 text-violet-400",
};

function MetricCard({ title, value, unit, icon, accent }: MetricCardProps) {
  return (
    <div className="mission-card flex items-center gap-4 p-5">
      <div
        className={`flex size-13 shrink-0 items-center justify-center rounded-xl ${accentStyles[accent]}`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-xs text-slate-400">{title}</p>

        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {value}
          </span>

          {unit && <span className="text-sm text-slate-500">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

interface SimulationMetricsProps {
  simulation: MissionSimulation;
}

function SimulationMetrics({ simulation }: SimulationMetricsProps) {
  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      aria-label="Simulation results"
    >
      <MetricCard
        title="Total Delta-v"
        value={simulation.deltaVms.toFixed(2)}
        unit="m/s"
        icon={<Gauge className="size-6" />}
        accent="blue"
      />

      <MetricCard
        title="Propellant Used"
        value={simulation.propellantUsedKg.toFixed(2)}
        unit="kg"
        icon={<Fuel className="size-6" />}
        accent="teal"
      />

      <MetricCard
        title="Estimated Burn Time"
        value={formatDuration(simulation.burnTimeSeconds)}
        icon={<Timer className="size-6" />}
        accent="violet"
      />
    </section>
  );
}

export default SimulationMetrics;
