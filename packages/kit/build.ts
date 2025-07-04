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

// Copy Drizzle stuff
// Copy to dist instead of dist/tables because the built files are at the top-level
await $`cp -rL tables/migrations dist`;

await $`mkdir -p dist/node_modules`;

// Copy Sharp to dist
await $`mkdir -p dist/node_modules/@img`;
await $`cp -rL ../../node_modules/@img/sharp-libvips-linux* dist/node_modules/@img`;
await $`cp -rL ../../node_modules/@img/sharp-linux* dist/node_modules/@img`;

// Copy acorn to dist
await $`cp -rL ../../node_modules/acorn dist/node_modules/acorn`;

// Fixes issues with sharp
await $`cp -rL ../../node_modules/detect-libc dist/node_modules/`;

console.log("Build complete!");
