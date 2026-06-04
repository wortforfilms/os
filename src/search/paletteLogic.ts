export function shouldOpenCommandPalette(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey">): boolean {
  return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
}

export type CommandPaletteState = {
  open: boolean;
};

export type CommandPaletteAction =
  | { type: "keyboard"; event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey"> }
  | { type: "close" }
  | { type: "open" };

export function updateCommandPaletteState(state: CommandPaletteState, action: CommandPaletteAction): CommandPaletteState {
  if (action.type === "open") {
    return { open: true };
  }
  if (action.type === "close") {
    return { open: false };
  }
  if (action.event.key === "Escape") {
    return { open: false };
  }
  if (shouldOpenCommandPalette(action.event)) {
    return { open: !state.open };
  }
  return state;
}
