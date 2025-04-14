import { build } from "bun";
import { $ } from "bun";
import ora from "ora";

const buildSpinner = ora("Building").start();

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

buildSpinner.text = "Transforming";

// Copy Drizzle migrations to dist
await $`cp -rL drizzle dist/drizzle`;

// Copy Sharp to dist
await $`mkdir -p dist/node_modules/@img`;
await $`cp -rL node_modules/@img/sharp-libvips-linux* dist/node_modules/@img`;
await $`cp -rL node_modules/@img/sharp-linux* dist/node_modules/@img`;

await $`cp -rL node_modules/detect-libc dist/node_modules/`;

buildSpinner.stop();
