import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Archived components (e.g. src/components/_archive/) are retained
    // for reference and intentionally use @ts-nocheck. They are not
    // imported by live code.
    ignores: ["src/components/_archive/**"],
  },
];

export default eslintConfig;
