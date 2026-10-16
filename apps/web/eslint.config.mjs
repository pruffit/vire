import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import baseConfig from "@vire/config/eslint/base";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...baseConfig,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
