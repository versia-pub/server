// Delete dist directory
import { $ } from "bun";
import { cp, exists, mkdir, rm } from "node:fs/promises";
import { rawRoutes } from "~routes";

if (!(await exists("./pages/dist"))) {
    console.log("Please build the Vite server first, or use `bun prod-build`");
    process.exit(1);
}

console.log(`Building at ${process.cwd()}`);

await rm("./dist", { recursive: true });

await mkdir(`${process.cwd()}/dist`);

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
    external: ["bullmq", "@prisma/client"],
}).then((output) => {
    if (!output.success) {
        console.log(output.logs);
    }
});

// Fix for wrong Bun file resolution, replaces node_modules with ./node_modules inside all dynamic imports
// I apologize for this
await $`sed -i 's|import("node_modules/|import("./node_modules/|g' dist/*.js`;

// Copy generated Prisma client to dist
await $`mkdir -p dist/node_modules/@prisma/client`;
await $`cp -r ${process.cwd()}/node_modules/@prisma/client dist/node_modules/@prisma`;
await $`cp -r ${process.cwd()}/node_modules/.prisma dist/node_modules`;

// Create pages directory
// mkdir ./dist/pages
await mkdir(`${process.cwd()}/dist/pages`);

// Copy Vite build output to dist
// cp -r ./pages/dist ./dist/pages
await cp(`${process.cwd()}/pages/dist`, `${process.cwd()}/dist/pages/`, {
    recursive: true,
});

// Copy the Bee Movie script from pages
await cp(
    `${process.cwd()}/pages/beemovie.txt`,
    `${process.cwd()}/dist/pages/beemovie.txt`,
);

console.log("Built!");
