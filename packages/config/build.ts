import { $, build } from "bun";
import manifest from "./package.json" with { type: "json" };

console.log("Building...");

await $`rm -rf dist && mkdir dist`;

await build({
    entrypoints: Object.values(manifest.exports).map((entry) => entry.import),
    outdir: "dist",
    target: "bun",
    splitting: true,
    minify: true,
    external: [
        ...Object.keys(manifest.dependencies).filter((dep) =>
            dep.startsWith("@versia"),
        ),
    ],
});
