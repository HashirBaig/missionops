import { Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";

import AppSidebar from "@/components/layout/AppSidebar";
import DashboardPage from "@/pages/DashboardPage";
import FeaturePlaceholderPage from "@/pages/FeaturePlaceholderPage";

import "./App.css";

function App() {
  return (
    <div className="app min-h-screen bg-[#07111e]">
      <AppSidebar />

      <div className="min-h-screen md:ml-64">
        <Routes>
          <Route path="/" element={<DashboardPage />} />

          <Route
            path="/planner"
            element={
              <FeaturePlaceholderPage
                title="Mission Planner"
                description="Advanced spacecraft maneuver planning."
              />
            }
          />

          <Route
            path="/orbit"
            element={
              <FeaturePlaceholderPage
                title="Orbit View"
                description="Explore Earth orbits and trajectories."
              />
            }
          />

          <Route
            path="/scenarios"
            element={
              <FeaturePlaceholderPage
                title="Scenario Comparison"
                description="Compare multiple maneuver strategies."
              />
            }
          />

          <Route
            path="*"
            element={
              <FeaturePlaceholderPage
                title="Page Not Found"
                description="The requested page does not exist."
              />
            }
          />
        </Routes>
      </div>

      <Toaster richColors theme="dark" position="bottom-center" />
    </div>
  );
}

export default App;
