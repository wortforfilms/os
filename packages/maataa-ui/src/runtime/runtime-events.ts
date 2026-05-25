export type RuntimeEvent = {
  type: "boot" | "hydrate" | "recover" | "certification-blocked";
  at: number;
  detail?: string;
};

export function createRuntimeEvent(type: RuntimeEvent["type"], detail?: string): RuntimeEvent {
  return { type, detail, at: Date.now() };
}
