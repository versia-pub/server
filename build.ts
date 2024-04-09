// Delete dist directory
import { $ } from "bun";
import { exists, mkdir, rm } from "node:fs/promises";
import { rawRoutes } from "~routes";

console.log("Building frontend...");

await $`bun fe:build`;

console.log(`Building at ${process.cwd()}`);

await $`rm -rf dist && mkdir dist`;

await Bun.build({
    entrypoints: [
        `${process.cwd()}/index.ts`,
        `${process.cwd()}/prisma.ts`,
        `${process.cwd()}/cli.ts`,
        // Force Bun to include endpoints
        ...Object.values(rawRoutes),
    ],
    outdir: `${process.cwd()}/dist`,
    target: "bun",
    splitting: true,
    minify: false,
    external: ["bullmq", "@prisma/client", "frontend"],
}).then((output) => {
    if (!output.success) {
        console.log(output.logs);
    }
});

// Fix for wrong Bun file resolution, replaces node_modules with ./node_modules inside all dynamic imports
// I apologize for this
await $`sed -i 's|import("node_modules/|import("./node_modules/|g' dist/*.js`;

// Copy generated Prisma client to dist
await $`mkdir -p dist/node_modules/@prisma`;
await $`cp -r ${process.cwd()}/node_modules/@prisma dist/node_modules/`;
await $`cp -r ${process.cwd()}/node_modules/.prisma dist/node_modules`;
await $`mkdir -p dist/node_modules/.bin`;
await $`cp -r ${process.cwd()}/node_modules/.bin/prisma dist/node_modules/.bin`;
await $`cp -r ${process.cwd()}/node_modules/prisma dist/node_modules/`;

// Copy Sharp to dist
await $`cp -r ${process.cwd()}/node_modules/sharp/build/ .`;

// Copy Vite build output to dist
await $`cp -r packages/frontend/.output dist/frontend`;

// Copy the Bee Movie script from pages
await $`cp ${process.cwd()}/pages/beemovie.txt dist/beemovie.txt`;

console.log("Built!");
