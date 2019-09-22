const { terser } = require("rollup-plugin-terser");
const babel = require("rollup-plugin-babel");
const postcss = require("rollup-plugin-postcss");
const cssnano = require("cssnano");
const autoprefixer = require("autoprefixer");

module.exports = {
  input: "src/Chart.js",
  output: {
    file: "dist/bundle.js",
    format: "cjs"
  },
  plugins: [
    terser({
      mangle: {
        toplevel: true
      }
    }),
    postcss({
      extract: true,
      plugins: [cssnano(), autoprefixer()],
      extensions: [".css"]
    }),
    babel({
      exclude: "node_modules/**"
    })
  ]
};
