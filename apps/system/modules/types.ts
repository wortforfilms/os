export type ModuleStatus = "nominal" | "warning" | "critical" | "offline";

export type SourceFrame = {
  path: string;
  usefulFrames: string[];
  notes: string;
};

export type MetricDatum = {
  label: string;
  value: string;
  status?: ModuleStatus;
};

export type TimelineDatum = {
  label: string;
  detail: string;
  status: ModuleStatus;
};

export type ConsoleLine = {
  ts: string;
  level: "info" | "warn" | "error" | "debug";
  text: string;
};

export type CapsuleDatum = {
  id: number;
  name: string;
  bytes: number;
  cycles: number;
  status: ModuleStatus;
};

export type ProcessDatum = {
  pid: string;
  name: string;
  state: "ready" | "running" | "sleeping" | "blocked";
  ticks: number;
  owner: string;
};

export type MemoryRegion = {
  name: string;
  origin: string;
  size: string;
  used: string;
  role: string;
};

export type UiModuleDefinition = {
  id: string;
  name: string;
  purpose: string;
  sourceFrames: SourceFrame[];
  dataFrames: string[];
  uiElements: string[];
  layout: string[];
};
