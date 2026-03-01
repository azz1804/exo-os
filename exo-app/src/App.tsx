import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { StarField } from "./components/scene/StarField";
import { Sidebar } from "./components/layout/Sidebar";
import { Constellation } from "./pages/Constellation";
import { Onboarding } from "./pages/Onboarding";
import { PlanetView } from "./pages/PlanetView";
import { Settings } from "./pages/Settings";
import { useExoStore } from "./lib/store";

export default function App() {
  const location = useLocation();
  const isOnboarded = useExoStore((s) => s.isOnboarded);
  const isHome = location.pathname === "/";
  const isOnboarding = location.pathname === "/onboarding";

  // Redirect to onboarding if not configured yet
  if (!isOnboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-void">
      {/* Star field — always visible */}
      <StarField />

      {/* Sidebar — hidden on constellation home and onboarding */}
      {!isHome && !isOnboarding && <Sidebar />}

      {/* Main content */}
      <main className="relative flex-1 overflow-hidden" style={{ zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/" element={<Constellation />} />
            <Route path="/planet/:id" element={<PlanetView />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}
