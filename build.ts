import process from "node:process";
import { $, build, file, write } from "bun";
import manifest from "./package.json" with { type: "json" };

console.log("Building...");

await $`rm -rf dist && mkdir dist`;

const type = process.argv[2] as "api" | "worker";

if (type !== "api" && type !== "worker") {
    throw new Error("Invalid build type. Use 'api' or 'worker'.");
}

const packages = Object.keys(manifest.dependencies)
    .filter((dep) => dep.startsWith("@versia"))
    .filter((dep) => dep !== "@versia-server/tests");

await build({
    entrypoints: [`./${type}.ts`],
    outdir: "dist",
    target: "bun",
    splitting: true,
    minify: true,
    external: [...packages],
});

console.log("Copying files...");

// Copy each package into dist/node_modules
for (const pkg of packages) {
    const directory = pkg.split("/")[1] || pkg;
    await $`mkdir -p dist/node_modules/${pkg}`;
    // Copy the built package files
    await $`cp -rL packages/${directory}/{dist,package.json} dist/node_modules/${pkg}`;

    // Rewrite package.json "exports" field to point to the dist directory and use .js extension
    const packageJsonPath = `dist/node_modules/${pkg}/package.json`;
    const packageJson = await file(packageJsonPath).json();
    for (const [key, value] of Object.entries(packageJson.exports) as [
        string,
        { import?: string },
    ][]) {
        if (value.import) {
            packageJson.exports[key] = {
                import: value.import
                    .replace("./", "./dist/")
                    .replace(/\.ts$/, ".js"),
            };
        }
    }
    await write(packageJsonPath, JSON.stringify(packageJson, null, 4));
}

console.log("Build complete!");
