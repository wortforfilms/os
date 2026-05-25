import { THEME_FAMILIES } from "../constants";
import type { ThemeTokenSet } from "../types";

export const themeRegistry: readonly ThemeTokenSet[] = THEME_FAMILIES.map((family) => ({
  id: family.toLowerCase(),
  family,
  label: family.replace(/_/g, " "),
  variables: {
    "--maataa-bg": family === "CINEMATIC" ? "#101315" : "#fffdf8",
    "--maataa-fg": family === "CINEMATIC" ? "#f8fafc" : "#101315",
    "--maataa-accent": family === "GOVERNANCE" ? "#b45309" : "#0f766e",
  },
}));
