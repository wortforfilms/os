export function resolveAIRuntime(localModels: number): "ready" | "empty" { return localModels > 0 ? "ready" : "empty"; }
