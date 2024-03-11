// Delete dist directory
import { rm, cp, mkdir, exists } from "fs/promises";

if (!(await exists("./pages/dist"))) {
	console.log("Please build the Vite server first, or use `bun prod-build`");
	process.exit(1);
}

console.log(`Building at ${process.cwd()}`);

await rm("./dist", { recursive: true });

await mkdir(process.cwd() + "/dist");

//bun build --entrypoints ./index.ts ./prisma.ts ./cli.ts --outdir dist --target bun --splitting --minify --external bullmq,@prisma/client
await Bun.build({
	entrypoints: [
		process.cwd() + "/index.ts",
		process.cwd() + "/prisma.ts",
		// process.cwd() + "/cli.ts",
	],
	outdir: process.cwd() + "/dist",
	target: "bun",
	splitting: true,
	minify: true,
	external: ["bullmq"],
}).then(output => {
	if (!output.success) {
		console.log(output.logs);
	}
});

// Create pages directory
// mkdir ./dist/pages
await mkdir(process.cwd() + "/dist/pages");

// Copy Vite build output to dist
// cp -r ./pages/dist ./dist/pages
await cp(process.cwd() + "/pages/dist", process.cwd() + "/dist/pages/", {
	recursive: true,
});

console.log(`Built!`);
