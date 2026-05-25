export function shouldEnterRecovery(validFrame: boolean, health: string): boolean {
  return !validFrame || health === "recovery";
}
