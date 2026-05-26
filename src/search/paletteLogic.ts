export function shouldOpenCommandPalette(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey">): boolean {
  return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
}
