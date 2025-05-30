import { readdir } from "node:fs/promises";
import { $, build } from "bun";
import { routes } from "~/routes";

console.log("Building...");

await $`rm -rf dist && mkdir dist`;

// Get all directories under the plugins/ directory
const pluginDirs = await readdir("plugins", { withFileTypes: true });

await build({
    entrypoints: [
        "index.ts",
        // HACK: Include to avoid cyclical import errors
        "config.ts",
        "cli/index.ts",
        // Force Bun to include endpoints
        ...Object.values(routes),
        // Include all plugins
        ...pluginDirs
            .filter((dir) => dir.isDirectory())
            .map((dir) => `plugins/${dir.name}/index.ts`),
    ],
    outdir: "dist",
    target: "bun",
    splitting: true,
    minify: false,
    external: ["acorn", "@bull-board/ui"],
});

console.log("Copying files...");

// Copy Drizzle migrations to dist
await $`cp -r drizzle dist/drizzle`;

// Copy plugin manifests
await $`cp plugins/openid/manifest.json dist/plugins/openid/manifest.json`;

await $`mkdir -p dist/node_modules`;

// Copy Sharp to dist
await $`mkdir -p dist/node_modules/@img`;
await $`cp -rL node_modules/@img/sharp-libvips-linux* dist/node_modules/@img`;
await $`cp -rL node_modules/@img/sharp-linux* dist/node_modules/@img`;

// Copy acorn to dist
await $`cp -rL node_modules/acorn dist/node_modules/acorn`;

// Copy bull-board to dist
await $`mkdir -p dist/node_modules/@bull-board`;
await $`cp -rL node_modules/@bull-board/ui dist/node_modules/@bull-board/ui`;

// Copy the Bee Movie script from pages
await $`cp beemovie.txt dist/beemovie.txt`;

// Copy package.json
await $`cp package.json dist/package.json`;

// Fixes issues with sharp
await $`cp -rL node_modules/detect-libc dist/node_modules/`;

console.log("Build complete!");
