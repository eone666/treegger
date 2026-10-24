import { dts } from "rolldown-plugin-dts";

export default {
  input: {
    index: "src/index.ts",
    "jsx-runtime": "src/jsx-runtime.ts",
    "jsx-dev-runtime": "src/jsx-dev-runtime.ts"
  },
  plugins: [dts({ generator: "tsc", tsconfig: "tsconfig.package.json", emitDtsOnly: true })],
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "[name].js"
  }
};
