export type ProductionMetric = {
  label: string;
  value: string;
  status: "nominal" | "watch" | "blocked";
};

export type ScheduleItem = {
  day: string;
  unit: string;
  location: string;
  dependency: string;
  risk: "low" | "medium" | "high";
};

export type LedgerLine = {
  code: string;
  label: string;
  budget: number;
  committed: number;
  actual: number;
};

export type VendorRecord = {
  id: string;
  name: string;
  service: string;
  compliance: "ready" | "pending" | "blocked";
};
