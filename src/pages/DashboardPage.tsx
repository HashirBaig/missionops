import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import AppHeader from "@/components/layout/AppHeader";

import MissionPlanner from "@/features/mission/components/MissionPlanner";
import OrbitPreview from "@/features/mission/components/OrbitPreview";
import SimulationMetrics from "@/features/mission/components/SimulationMetrics";
import MissionTimeline from "@/features/mission/components/MissionTimeline";

import { DEFAULT_MISSION } from "@/features/mission/constants/mission";

import { simulateMission } from "@/features/mission/services/missionSimulator";

import type {
  MissionFormValues,
  MissionSimulation,
} from "@/features/mission/types/mission";

function DashboardPage() {
  const [simulation, setSimulation] = useState<MissionSimulation>(() =>
    simulateMission(DEFAULT_MISSION),
  );

  const [hasSimulated, setHasSimulated] = useState(false);

  // Shared Cesium simulation time.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const handleTimeChange = useCallback((seconds: number) => {
    setElapsedSeconds(seconds);
  }, []);

  const handleSimulate = (values: MissionFormValues) => {
    try {
      const result = simulateMission(values);

      setSimulation(result);
      setHasSimulated(true);
      setElapsedSeconds(0);

      if (result.feasible) {
        toast.success("Simulation completed successfully");
      } else {
        toast.warning("Insufficient propellant for this maneuver");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to simulate this maneuver.",
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#07111e]">
      <AppHeader />

      <main className="mx-auto max-w-[1650px] space-y-5 px-4 py-6 pb-28 sm:px-8 md:pb-10">
        {/* Simulation status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Info className="size-4 text-blue-400" />

            <span>
              {hasSimulated
                ? "Latest simulation results"
                : "Default mission preview"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {simulation.feasible ? (
              <>
                <CheckCircle2 className="size-4 text-teal-400" />
                <span className="text-teal-400">
                  Propellant budget sufficient
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="size-4 text-amber-400" />
                <span className="text-amber-400">Insufficient propellant</span>
              </>
            )}
          </div>
        </div>

        {/* Planner and 3D visualization */}
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[370px_minmax(0,1fr)]">
          <MissionPlanner onSimulate={handleSimulate} />

          <OrbitPreview
            simulation={simulation}
            onTimeChange={handleTimeChange}
          />
        </div>

        {/* Simulation results */}
        <SimulationMetrics simulation={simulation} />

        {/* Synchronized mission timeline */}
        <MissionTimeline
          simulation={simulation}
          elapsedSeconds={elapsedSeconds}
        />

        {/* Disclaimer */}
        <p className="text-center text-[11px] leading-5 text-slate-600">
          MissionOps uses synthetic spacecraft parameters and simplified orbital
          mechanics. Not for operational flight planning.
        </p>
      </main>
    </div>
  );
}

export default DashboardPage;
