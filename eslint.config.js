import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

/**
 * ESLint flat config for the OSS pre-flight workspace (ESM, type:module). A
 * quality gate on top of `tsc -b`; Prettier owns formatting, so
 * `eslint-config-prettier` disables conflicting stylistic rules. Covers both
 * workspace packages (preflight-engine, cli).
 */
export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "packages/cli/eval-corpus/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Codebase conventions (CLAUDE.md): prefer `type`, no enums, no bare `any`.
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "Use a string-literal union instead of an enum.",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  prettier,
);
