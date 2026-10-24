export default {
  input: {
    index: "src/index.ts",
    "jsx-runtime": "src/jsx-runtime.ts",
    "jsx-dev-runtime": "src/jsx-dev-runtime.ts"
  },
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "[name].js",
    preserveModules: true,
    preserveModulesRoot: "src",
    cleanDir: true
  }
};
