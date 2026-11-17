module.exports = {
  testEnvironment: "node",
  resolver: "<rootDir>/tooling/jest-resolver.cjs",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.[cm]?[jt]sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
          target: "es2022",
        },
        module: { type: "commonjs" },
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/prettier/"],
};
