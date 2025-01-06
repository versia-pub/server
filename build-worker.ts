import { $ } from "bun";
import ora from "ora";

const buildSpinner = ora("Building").start();

await $`rm -rf dist && mkdir dist`;

await Bun.build({
    entrypoints: ["entrypoints/worker/index.ts"],
    outdir: "dist",
    target: "bun",
    splitting: true,
    minify: false,
}).then((output) => {
    if (!output.success) {
        console.error(output.logs);
        throw new Error("Build failed");
    }
});

buildSpinner.text = "Transforming";

// Copy Drizzle migrations to dist
await $`cp -r drizzle dist/drizzle`;

// Copy Sharp to dist
await $`mkdir -p dist/node_modules/@img`;
await $`cp -r node_modules/@img/sharp-libvips-linuxmusl-* dist/node_modules/@img`;
await $`cp -r node_modules/@img/sharp-linuxmusl-* dist/node_modules/@img`;

buildSpinner.stop();
