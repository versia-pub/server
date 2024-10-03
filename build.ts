import { readdir } from "node:fs/promises";
import { $ } from "bun";
import ora from "ora";
import { routes } from "~/routes";

const buildSpinner = ora("Building").start();

await $`rm -rf dist && mkdir dist`;

// Get all directories under the plugins/ directory
const pluginDirs = await readdir("plugins", { withFileTypes: true });

await Bun.build({
    entrypoints: [
        "index.ts",
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
    external: ["unzipit", "acorn"],
}).then((output) => {
    if (!output.success) {
        console.error(output.logs);
        throw new Error("Build failed");
    }
});

buildSpinner.text = "Transforming";

// Copy Drizzle migrations to dist
await $`cp -r drizzle dist/drizzle`;

// Copy plugin manifests
await $`cp plugins/openid/manifest.json dist/plugins/openid/manifest.json`;

// Copy Sharp to dist
await $`mkdir -p dist/node_modules/@img`;
await $`cp -r node_modules/@img/sharp-libvips-linux-* dist/node_modules/@img`;
await $`cp -r node_modules/@img/sharp-linux-* dist/node_modules/@img`;

// Copy unzipit and uzip-module to dist
await $`cp -r node_modules/unzipit dist/node_modules/unzipit`;
await $`cp -r node_modules/uzip-module dist/node_modules/uzip-module`;

// Copy acorn to dist
await $`cp -r node_modules/acorn dist/node_modules/acorn`;

// Copy the Bee Movie script from pages
await $`cp beemovie.txt dist/beemovie.txt`;

// Copy package.json
await $`cp package.json dist/package.json`;
// Copy cli/theme.json
await $`cp cli/theme.json dist/cli/theme.json`;

buildSpinner.stop();
