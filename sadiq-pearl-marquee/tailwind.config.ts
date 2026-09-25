import type { Config } from "tailwindcss";

// Palette + type follow the Google Stitch redesign (warm ivory, antique gold,
// Playfair Display + Plus Jakarta Sans).
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#fcf9f5",
          low: "#f6f3ef",
          mid: "#f0edea",
          high: "#ebe8e4",
          highest: "#e5e2de",
        },
        ink: { DEFAULT: "#1c1c1a", soft: "#4e4638", muted: "#645d54" },
        gold: {
          DEFAULT: "#795916",
          container: "#b8914a",
          light: "#ebc074",
          pale: "#ffdea9",
        },
        line: { DEFAULT: "#d2c5b3", strong: "#807667" },
        night: "#31302e",
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        body: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      borderRadius: { DEFAULT: "0.125rem", lg: "0.25rem", xl: "0.5rem" },
      maxWidth: { content: "1320px" },
      transitionTimingFunction: { elegant: "cubic-bezier(0.16, 1, 0.3, 1)" },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "scale-in": "scaleIn 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
    },
  },
  plugins: [],
};
export default config;
