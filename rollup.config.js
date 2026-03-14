import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";

export default {
    input: "resources/js/modules/index.js",
    output: {
        file: "resources/js/full-diagram.min.js",
        format: "iife",
        name: "FullDiagram",
        sourcemap: false,
    },
    plugins: [resolve(), commonjs(), terser()],
};
