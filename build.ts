import { $ } from "bun";
import ora from "ora";
import { routes } from "~/routes";

const buildSpinner = ora("Building").start();

await $`rm -rf dist && mkdir dist`;

await Bun.build({
    entrypoints: [
        "index.ts",
        "cli/index.ts",
        // Force Bun to include endpoints
        ...Object.values(routes),
    ],
    outdir: "dist",
    target: "bun",
    splitting: true,
    minify: false,
    external: ["unzipit", "acorn"],
}).then((output) => {
    if (!output.success) {
        console.error(output.logs);
        process.exit(1);
    }
});

buildSpinner.text = "Transforming";

// Fix for wrong Bun file resolution, replaces node_modules with ./node_modules inside all dynamic imports
// I apologize for this
await $`sed -i 's|import("node_modules/|import("./node_modules/|g' dist/*.js`;
await $`sed -i 's|import"node_modules/|import"./node_modules/|g' dist/**/*.js`;
// Replace /temp/node_modules with ./node_modules
await $`sed -i 's|/temp/node_modules|./node_modules|g' dist/**/*.js`;
// Replace 'export { toFilter, getLevelFilter, getConsoleSink };' to remove getConsoleSink
// Because Bun duplicates the export and it causes a runtime error
await $`sed -i 's|export { toFilter, getLevelFilter, getConsoleSink };|export { toFilter, getLevelFilter };|g' dist/**/*.js`;
// Delete "var list;"
await $`sed -i 's|var list;||g' dist/**/*.js`;

// Copy Drizzle migrations to dist
await $`cp -r drizzle dist/drizzle`;

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
