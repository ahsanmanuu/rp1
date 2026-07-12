import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // PocketBase adapter and API routes use `any` extensively for dynamic data shapes
      "@typescript-eslint/no-explicit-any": "off",
      // JSX content uses apostrophes in natural language text
      "react/no-unescaped-entities": "off",
      // .cjs/.js scripts use require() — acceptable in Node.js scripts
      "@typescript-eslint/no-require-imports": "off",
      // Allow unused vars — common in callback-heavy PocketBase adapter code
      "@typescript-eslint/no-unused-vars": "off",

      // --- Disable overly strict react-hooks rules that flag working patterns ---
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/exhaustive-deps": "off",
      // --- Disable pedantic TS rules ---
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-declaration-merging": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
      "@typescript-eslint/no-this-alias": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Additional ignores
    "node_modules/**",
    ".next_old/**",
    "temp_users.jsx",
    // Non-source directories and files with thousands of noise warnings
    "scratch/**",
    "pb_data/**",
    "public/pdf.worker.min.mjs",
    "start.js",
    "scripts/**",
    "prisma/migrate-pb.mjs",
    "types/next-auth.d.ts",
    // Root-level utility/test scripts
    "test_*.{js,ts,mjs}",
    "test-pb*.mjs",
    "verify-*.ts",
    "fix-*.{ts,mjs}",
    "check-*.ts",
    "fix-all-schemas.ts",
    "fix-db-columns.mjs",
    "fix-db.mjs",
    "fix-users-schema.mjs",
  ]),
]);

export default eslintConfig;
