"use client";

import * as React from "react";

import type { DemoScenarioKey } from "@/lib/data/demoBundle";

export type DataMode = "mock" | "live";

type DataModeContextValue = {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  scenario: DemoScenarioKey;
  setScenario: (scenario: DemoScenarioKey) => void;
};

const DataModeContext = React.createContext<DataModeContextValue | null>(null);

const INITIAL_MODE: DataMode =
  process.env.NEXT_PUBLIC_USE_MOCKS === "false" ? "live" : "mock";

export function DataModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<DataMode>(INITIAL_MODE);
  const [scenario, setScenario] = React.useState<DemoScenarioKey>("attend");

  const value = React.useMemo(
    () => ({ mode, setMode, scenario, setScenario }),
    [mode, scenario],
  );

  return (
    <DataModeContext.Provider value={value}>
      {children}
    </DataModeContext.Provider>
  );
}

export function useDataMode(): DataModeContextValue {
  const ctx = React.useContext(DataModeContext);
  if (!ctx) {
    throw new Error("useDataMode must be used within a DataModeProvider");
  }
  return ctx;
}
