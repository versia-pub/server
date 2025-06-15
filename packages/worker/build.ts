import { $, build } from "bun";

console.log("Building...");

await $`rm -rf dist && mkdir dist`;

await build({
    entrypoints: [
        "packages/worker/index.ts",
        // HACK: Include to avoid cyclical import errors
        "packages/config/index.ts",
        "cli/index.ts",
    ],
    outdir: "dist",
    target: "bun",
    splitting: true,
    minify: false,
});

console.log("Copying files...");

// Fix Bun build mistake
await $`sed -i 's/ProxiableUrl, exportedConfig/exportedConfig/g' dist/packages/config/*.js`;

// Copy Drizzle stuff
await $`mkdir -p dist/packages/plugin-kit/tables`;
await $`cp -rL packages/plugin-kit/tables/migrations dist/packages/plugin-kit/tables`;

// Copy Sharp to dist
await $`mkdir -p dist/node_modules/@img`;
await $`cp -rL node_modules/@img/sharp-libvips-linux* dist/node_modules/@img`;
await $`cp -rL node_modules/@img/sharp-linux* dist/node_modules/@img`;

await $`cp -rL node_modules/detect-libc dist/node_modules/`;

console.log("Build complete!");
