module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    project: ["./tsconfig.json", "./tsconfig.spec.json"],
  },
  plugins: ["@typescript-eslint", "jest"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jest/recommended",
  ],
  env: {
    node: true,
    es2021: true,
  },
  ignorePatterns: ["dist/", "node_modules/", "__mocks__/"],

  overrides: [
    {
      files: ["**/*.test.ts", "**/*.spec.ts"],
      env: {
        jest: true,
        node: true,
      },
    },
    {
      files: ["**/__mocks__/**/*.ts"],
      env: {
        node: true,
      },
    },
  ],
};
