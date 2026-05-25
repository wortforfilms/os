export function getSystemSnapshot() {
  const threads = Math.max(1, Number(process.env.MAATAA_HOST_THREADS ?? 0) || 1);

  return {
    runtime: "node-bridge",
    kernel: "qemu-alpha",
    desktop: "tauri-vite",
    health: "nominal",
    metrics: {
      threads,
      qemuEngine: "netduinoplus2/cortex-m4",
      ipcMode: "local-binary-ring",
    },
  };
}
