module.exports = {
  root: true,
  env: {
    node: true,
    es2023: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  rules: {
    "@typescript-eslint/no-misused-promises": [
      "error",
      {
        checksVoidReturn: {
          attributes: false,
        },
      }
    ],
    "import/order": [
      "error",
      {
        groups: [["builtin", "external"], ["internal"], ["parent", "sibling", "index"]],
        alphabetize: { order: "asc", caseInsensitive: true },
        "newlines-between": "always",
      }
    ],
  },
};
