export function resolveNetworkRuntime(online: boolean): "offline" | "local" {
  return online ? "local" : "offline";
}
