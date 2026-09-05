import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import baseConfig from "@vire/config/eslint/base";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...baseConfig,
  // public/rnd/stand.js* — бандл esbuild из packages/vireglass (scripts/build-rnd.mjs),
  // не авторский код: как .next/out/build, генерируется и не должен линтиться.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/rnd/stand.*"]),
]);
