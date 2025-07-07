import { $, build } from "bun";
import manifest from "./package.json" with { type: "json" };
import { routes } from "./routes.ts";

console.log("Building...");

await $`rm -rf dist && mkdir dist`;

await build({
    entrypoints: [
        ...Object.values(manifest.exports).map((entry) => entry.import),
        // Force Bun to include endpoints
        ...Object.values(routes),
    ],
    outdir: "dist",
    target: "bun",
    splitting: true,
    minify: true,
    external: [
        ...Object.keys(manifest.dependencies).filter((dep) =>
            dep.startsWith("@versia"),
        ),
        "@bull-board/ui",
        // Excluded because Standard Schema imports those, but the code is never executed
        "@valibot/to-json-schema",
        "effect",
    ],
});

console.log("Copying files...");

await $`mkdir -p dist/node_modules`;

// Copy bull-board to dist
await $`mkdir -p dist/node_modules/@bull-board`;
await $`cp -rL ../../node_modules/@bull-board/ui dist/node_modules/@bull-board/ui`;

console.log("Build complete!");
