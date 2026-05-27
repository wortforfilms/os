export type LipiDirection = "LTR" | "RTL" | "TTB" | "BTT" | "MIXED";

export type LipiStatus =
  | "ACTIVE"
  | "HISTORICAL"
  | "ENDANGERED"
  | "EXTINCT"
  | "ENCODED"
  | "UNENCODED"
  | "BLOCKED";

export type LipiWave = "WAVE_1_CLASSICAL" | "WAVE_2_REGIONAL" | "WAVE_3_COMMERCIAL" | "EXTENSION";

export interface LipiScriptRecord {
  id: string;
  isoCode: string;
  name: string;
  nativeName?: string;
  direction: LipiDirection;
  family?: string;
  wave?: LipiWave;
  status: LipiStatus;
  unicodeRange?: string;
  region?: string;
  purpose?: string;
  oldestProof?: string;
  extinctionReason?: string;
  creatorType?: string;
  creatorName?: string;
}
