// Delete dist directory
import { $ } from "bun";
import { rawRoutes } from "~routes";

const feOnly = process.argv.includes("--frontend");
const serverOnly = process.argv.includes("--server");

console.log("Building frontend...");

await $`bun fe:build`;

console.log(`Building at ${process.cwd()}`);

await $`rm -rf dist && mkdir dist`;

await Bun.build({
    entrypoints: [
        `${process.cwd()}/index.ts`,
        `${process.cwd()}/cli.ts`,
        // Force Bun to include endpoints
        ...Object.values(rawRoutes),
    ],
    outdir: `${process.cwd()}/dist`,
    target: "bun",
    splitting: true,
    minify: true,
    external: ["bullmq", "frontend"],
}).then((output) => {
    if (!output.success) {
        console.log(output.logs);
    }
});

// Fix for wrong Bun file resolution, replaces node_modules with ./node_modules inside all dynamic imports
// I apologize for this
await $`sed -i 's|import("node_modules/|import("./node_modules/|g' dist/*.js`;

// Copy Drizzle migrations to dist
await $`cp -r drizzle dist/drizzle`;

// Copy Sharp to dist
await $`mkdir -p dist/node_modules/@img`;
await $`cp -r node_modules/@img/sharp-libvips-linux-* dist/node_modules/@img`;
await $`cp -r node_modules/@img/sharp-linux-* dist/node_modules/@img`;

// Copy Nuxt build output to dist
await $`cp -r packages/frontend/.output dist/frontend`;

// Copy the Bee Movie script from pages
await $`cp beemovie.txt dist/beemovie.txt`;

console.log("Built!");
