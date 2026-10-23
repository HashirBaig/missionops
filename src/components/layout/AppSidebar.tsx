import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Orbit,
  Route,
  Satellite,
  GitCompareArrows,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Planner", path: "/planner", icon: Route },
  { label: "Orbit View", path: "/orbit", icon: Orbit },
  {
    label: "Scenarios",
    path: "/scenarios",
    icon: GitCompareArrows,
  },
];

function AppSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.07] bg-[#081321] md:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/[0.07] px-7">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
            <Satellite className="size-6 text-blue-400" />
          </div>

          <span className="text-xl font-semibold tracking-tight text-white">
            Mission<span className="text-blue-400">Ops</span>
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-2 px-4 py-8">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-500/15 text-blue-400"
                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                  ].join(" ")
                }
              >
                <Icon className="size-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/[0.07] p-6">
          <Satellite className="mb-3 size-7 text-blue-400/70" />
          <p className="text-sm font-medium text-slate-300">
            Plan. Simulate. Explore.
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Satellite maneuver planning made simple.
          </p>
          <span className="mt-4 inline-block rounded-md bg-amber-400/10 px-2 py-1 text-[10px] font-medium tracking-wide text-amber-300">
            SIMULATION ONLY
          </span>
        </div>
      </aside>

      {/* Mobile navigation */}
      <nav className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-2xl border border-white/10 bg-[#0d1c2d]/95 p-2 shadow-2xl backdrop-blur-xl md:hidden">
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                [
                  "flex min-w-16 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] transition-colors",
                  isActive ? "bg-blue-500/15 text-blue-400" : "text-slate-400",
                ].join(" ")
              }
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}

export default AppSidebar;
