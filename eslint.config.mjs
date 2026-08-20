import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // mobile/ is a separate Expo/React Native project with its own
    // tsconfig and conventions — Next.js's web-specific rules (e.g.
    // next/image enforcement) don't apply there.
    "mobile/**",
  ]),
]);

export default eslintConfig;
