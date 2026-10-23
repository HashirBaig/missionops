import { useState } from "react";
import type { FormEvent } from "react";
import { Play, RotateCcw, Satellite } from "lucide-react";

import { DEFAULT_MISSION, MANEUVER_OPTIONS } from "../constants/mission";

import type { MissionFormValues, ManeuverType } from "../types/mission";

interface MissionPlannerProps {
  onSimulate: (values: MissionFormValues) => void;
}

const inputClassName =
  "w-full rounded-lg border border-white/10 bg-[#091827] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10";

function MissionPlanner({ onSimulate }: MissionPlannerProps) {
  const [form, setForm] = useState<MissionFormValues>({
    ...DEFAULT_MISSION,
  });

  const updateField = <K extends keyof MissionFormValues>(
    field: K,
    value: MissionFormValues[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSimulate(form);
  };

  const handleReset = () => {
    const defaults = { ...DEFAULT_MISSION };
    setForm(defaults);
    onSimulate(defaults);
  };

  return (
    <section className="mission-card h-full p-5 sm:p-6">
      <div className="mb-7 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2.5">
            <Satellite className="size-5 text-blue-400" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-white">
              Mission Planner
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Configure your orbital transfer.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          title="Reset mission"
          aria-label="Reset mission"
        >
          <RotateCcw className="size-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="satelliteName"
            className="text-xs font-medium text-slate-300"
          >
            Satellite Name
          </label>

          <input
            id="satelliteName"
            className={inputClassName}
            value={form.satelliteName}
            onChange={(event) =>
              updateField("satelliteName", event.target.value)
            }
            maxLength={50}
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="currentAltitude"
              className="text-xs font-medium text-slate-300"
            >
              Current Altitude
            </label>

            <div className="relative">
              <input
                id="currentAltitude"
                className={`${inputClassName} pr-12`}
                type="number"
                min={150}
                max={100000}
                step="any"
                value={form.currentAltitudeKm}
                onChange={(event) =>
                  updateField(
                    "currentAltitudeKm",
                    event.target.value === ""
                      ? NaN
                      : Number(event.target.value),
                  )
                }
                required
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                km
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="targetAltitude"
              className="text-xs font-medium text-slate-300"
            >
              Target Altitude
            </label>

            <div className="relative">
              <input
                id="targetAltitude"
                className={`${inputClassName} pr-12`}
                type="number"
                min={150}
                max={100000}
                step="any"
                value={form.targetAltitudeKm}
                onChange={(event) =>
                  updateField(
                    "targetAltitudeKm",
                    event.target.value === ""
                      ? NaN
                      : Number(event.target.value),
                  )
                }
                required
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                km
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="maneuverType"
            className="text-xs font-medium text-slate-300"
          >
            Maneuver Type
          </label>

          <select
            id="maneuverType"
            className={inputClassName}
            value={form.maneuverType}
            onChange={(event) =>
              updateField("maneuverType", event.target.value as ManeuverType)
            }
          >
            {MANEUVER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/10 transition-all hover:bg-blue-400 active:scale-[0.99]"
        >
          <Play className="size-4 fill-current" />
          Run Simulation
        </button>
      </form>

      <p className="mt-5 text-center text-[11px] text-slate-500">
        Idealized two-impulse Hohmann transfer
      </p>
    </section>
  );
}

export default MissionPlanner;
