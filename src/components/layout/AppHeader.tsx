import { Satellite, CircleDot } from "lucide-react";

interface AppHeaderProps {
  title?: string;
  description?: string;
}

function AppHeader({
  title = "Mission Dashboard",
  description = "Plan and simulate satellite maneuvers.",
}: AppHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-8">
      <div>
        <div className="mb-2 flex items-center gap-2 text-blue-400 md:hidden">
          <Satellite className="size-5" />
          <span className="font-semibold">MissionOps</span>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {title}
        </h1>

        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5">
        <CircleDot className="size-3.5 text-blue-400" />
        <span className="text-xs font-medium text-blue-300">
          Simulation Mode
        </span>
      </div>
    </header>
  );
}

export default AppHeader;
