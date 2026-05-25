export function resolveEmotionRuntime(signal: number): "steady" | "alert" {
  return signal > 0.75 ? "alert" : "steady";
}
