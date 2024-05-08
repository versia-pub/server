import { $ } from "bun";
import chalk from "chalk";
import ora from "ora";
import { routes } from "~routes";

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
    external: ["bullmq"],
}).then((output) => {
    if (!output.success) {
        console.log(output.logs);
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

// Copy Drizzle migrations to dist
await $`cp -r drizzle dist/drizzle`;

// Copy Sharp to dist
await $`mkdir -p dist/node_modules/@img`;
await $`cp -r node_modules/@img/sharp-libvips-linux-* dist/node_modules/@img`;
await $`cp -r node_modules/@img/sharp-linux-* dist/node_modules/@img`;

// Copy the Bee Movie script from pages
await $`cp beemovie.txt dist/beemovie.txt`;

// Copy package.json
await $`cp package.json dist/package.json`;
// Copy cli/theme.json
await $`cp cli/theme.json dist/cli/theme.json`;

buildSpinner.stop();

console.log(
    `${chalk.green("✓")} Built project. You can now run it with ${chalk.green(
        "bun run dist/index.js",
    )}`,
);
