import type { Config } from "tailwindcss";

const preset = {
  theme: {
    extend: {
      colors: {
        maataa: {
          ink: "#101315",
          field: "#f7f5ee",
          signal: "#0f766e",
          warning: "#b45309",
          critical: "#b91c1c",
        },
      },
      fontFamily: {
        runtime: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular"],
      },
    },
  },
} satisfies Partial<Config>;

export default preset;
