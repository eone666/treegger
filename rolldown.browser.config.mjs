export default {
  input: "src/index.ts",
  platform: "browser",
  output: {
    file: "dist/treegger.browser.min.js",
    format: "esm",
    minify: true
  }
};
