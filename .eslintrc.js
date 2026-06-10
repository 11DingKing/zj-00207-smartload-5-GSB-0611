module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
  },
  extends: ["eslint:recommended", "prettier"],
  plugins: ["prettier"],
  parserOptions: {
    ecmaVersion: "latest",
  },
  rules: {
    "prettier/prettier": "error",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^next$" }],
    "no-console": "off",
    "no-undef": "error",
    eqeqeq: ["error", "always"],
    "prefer-const": "error",
    "no-var": "error",
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    "build/",
    "*.db",
    "*.db-journal",
    "package-lock.json",
    "prisma/migrations/",
  ],
};
