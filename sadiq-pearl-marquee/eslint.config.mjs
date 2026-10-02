import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next.js recommended flat config (core-web-vitals + TypeScript), no extra style rules.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler rule (eslint-plugin-react-hooks v7). Hero and BookingForm
      // read browser-only values after mount on purpose, to avoid hydration
      // mismatches. Kept visible as a warning until those components are
      // refactored; the React Compiler is not enabled in this project.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
