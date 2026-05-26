export const MSAR_FRAME_MATRIX = Object.freeze({
  MOSF: { magic: "MOSF", bytes: 40, source: "Rust Kernel Scheduler Loop", destination: "KernelDashboard" },
  MOSR: { magic: "MOSR", bytes: 16, source: "Fail-Safe Hardware Interrupter", destination: "RecoveryConsole" },
  MAGV: { magic: "MAGV", bytes: 32, source: "Python Glyph Matrix Parser", destination: "Local Memory Asset Registers" },
  MABS: { magic: "MABS", bytes: 24, source: "AI ThreadPool Batch Runner", destination: "CapsuleRegistry" },
  TLPS: { magic: "TLPS", bytes: 64, source: "Studio Operations Board", destination: "Local Database Persistence Layer" },
  TLPA: { magic: "TLPA", bytes: 48, source: "Local Accounting Ledger", destination: "MCA Regulatory Audit Archives" },
  PEDG: { magic: "PEDG", bytes: 32, source: "Digital Gurukul SPA Interface", destination: "Signed Assessment Exporter" },
} as const);

export type MsarFrameToken = keyof typeof MSAR_FRAME_MATRIX;

export function assertFrameBoundary(token: MsarFrameToken, frame: Uint8Array): void {
  const spec = MSAR_FRAME_MATRIX[token];
  if (frame.byteLength !== spec.bytes) {
    throw new Error(`${token} frame size mismatch: ${frame.byteLength}/${spec.bytes}`);
  }

  const magic = String.fromCharCode(frame[0], frame[1], frame[2], frame[3]);
  if (magic !== spec.magic) {
    throw new Error(`${token} frame magic mismatch: ${magic}`);
  }
}
