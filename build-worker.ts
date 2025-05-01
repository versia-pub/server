import { $, build } from "bun";

console.log("Building...");

await $`rm -rf dist && mkdir dist`;

await build({
    entrypoints: [
        "worker.ts",
        // HACK: Include to avoid cyclical import errors
        "config.ts",
    ],
    outdir: "dist",
    target: "bun",
    splitting: true,
    minify: false,
});

console.log("Copying files...");

// Copy Drizzle migrations to dist
await $`cp -rL drizzle dist/drizzle`;

// Copy Sharp to dist
await $`mkdir -p dist/node_modules/@img`;
await $`cp -rL node_modules/@img/sharp-libvips-linux* dist/node_modules/@img`;
await $`cp -rL node_modules/@img/sharp-linux* dist/node_modules/@img`;

await $`cp -rL node_modules/detect-libc dist/node_modules/`;

console.log("Build complete!");
