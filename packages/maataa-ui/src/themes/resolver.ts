import { themeRegistry } from "./registry";
import type { ThemeFamily, ThemeTokenSet } from "../types";

export function resolveTheme(family: ThemeFamily = "RUNTIME"): ThemeTokenSet {
  return themeRegistry.find((theme) => theme.family === family) ?? themeRegistry[0];
}
