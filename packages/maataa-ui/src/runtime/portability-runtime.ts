export function resolvePortabilityTarget(userAgent = ""): "tauri" | "browser" {
  return userAgent.toLowerCase().includes("tauri") ? "tauri" : "browser";
}
