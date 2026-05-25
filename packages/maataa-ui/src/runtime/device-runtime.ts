export function resolveDeviceClass(width: number): "mobile" | "desktop" {
  return width < 768 ? "mobile" : "desktop";
}
