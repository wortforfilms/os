export function getSystemSnapshot() {
  return {
    runtime: "node-bridge",
    kernel: "qemu-alpha",
    desktop: "tauri-vite",
    health: "nominal",
  };
}
