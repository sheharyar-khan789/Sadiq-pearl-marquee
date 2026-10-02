import type { Config } from "tailwindcss";

// Sadiq Pearl design tokens: warm ivory, deep espresso, champagne-gold accents.
// Gold is an accent colour; `gold.DEFAULT` is the only gold that is safe for
// small text on light backgrounds (≥5:1). `gold.container` is decorative on
// light backgrounds and text-safe only on espresso.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#fbf8f3",
          low: "#f5efe6",
          mid: "#eee6da",
          high: "#e5dacb",
          highest: "#dccfbc",
        },
        ink: { DEFAULT: "#1e1915", soft: "#4a4039", muted: "#6b6057" },
        gold: {
          DEFAULT: "#7a5a26",
          container: "#b38e55",
          light: "#d9bc86",
          pale: "#f0e2c4",
        },
        espresso: {
          DEFAULT: "#17120f",
          800: "#211a16",
          700: "#2c241e",
          600: "#3a302a",
        },
        line: { DEFAULT: "#e4d9c9", strong: "#b9aa94" },
        night: "#17120f",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      fontSize: {
        eyebrow: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.22em" }],
      },
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.875rem", "2xl": "1.25rem", "3xl": "1.75rem" },
      maxWidth: { content: "1320px" },
      spacing: { 13: "3.25rem", 18: "4.5rem", 22: "5.5rem" },
      transitionDuration: { 400: "400ms", 600: "600ms", 900: "900ms" },
      transitionTimingFunction: { elegant: "cubic-bezier(0.16, 1, 0.3, 1)" },
      boxShadow: {
        soft: "0 1px 2px rgba(30,25,21,0.04), 0 8px 24px -12px rgba(30,25,21,0.12)",
        lift: "0 2px 4px rgba(30,25,21,0.05), 0 24px 48px -24px rgba(30,25,21,0.28)",
        frame: "0 30px 80px -30px rgba(0,0,0,0.65)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        heroZoom: {
          "0%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        // `both` fill keeps elements hidden during their delay (no flicker).
        "fade-up": "fadeUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fadeIn 1.2s ease-out both",
        "hero-zoom": "heroZoom 2.4s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
