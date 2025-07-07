import { $, build } from "bun";
import manifest from "./package.json" with { type: "json" };

console.log("Building...");

await $`rm -rf dist && mkdir dist`;

await build({
    entrypoints: Object.values(manifest.exports).map((entry) => entry.import),
    outdir: "dist",
    target: "bun",
    splitting: true,
    minify: true,
    external: [
        ...Object.keys(manifest.dependencies).filter((dep) =>
            dep.startsWith("@versia"),
        ),
        "acorn",
    ],
});

console.log("Copying files...");

await $`mkdir -p dist/node_modules`;

// Copy acorn to dist
await $`cp -rL ../../node_modules/acorn dist/node_modules/acorn`;

console.log("Build complete!");
