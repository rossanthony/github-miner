module.exports = {
  env: {
    node: true,
    commonjs: true,
    es6: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  plugins: ["@typescript-eslint"],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  parser: "@typescript-eslint/parser",
  rules: {
    "no-console": "off",
    "@typescript-eslint/no-var-requires": "off",
    "@typescript-eslint/camelcase": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-parameter-properties": "off",
    "@typescript-eslint/no-unused-vars": [1, { "argsIgnorePattern": "^_", "varsIgnorePattern": "^ignored?$" }],
    '@typescript-eslint/explicit-member-accessibility': "off",
    '@typescript-eslint/explicit-function-return-type': "off",
  },
};
