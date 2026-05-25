import type { ThemeTokenSet } from "../types";

export function themeToCssVariables(theme: ThemeTokenSet): Record<string, string> {
  return { ...theme.variables };
}
