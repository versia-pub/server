// Delete dist directory
import { rm, cp, mkdir, exists } from "fs/promises";

if (!(await exists("./pages/dist"))) {
	console.log("Please build the Vite server first, or use `bun prod-build`");
	process.exit(1);
}

await rm("./dist", { recursive: true });

await Bun.build({
	entrypoints: ["./index.ts", "./prisma.ts", "./cli.ts"],
	outdir: "./dist",
	target: "bun",
	splitting: true,
	minify: true,
	external: ["bullmq", "@prisma/client"],
});

// Create pages directory
await mkdir("./dist/pages");

// Copy Vite build output to dist
await cp("./pages/dist", "./dist/pages/", {
	recursive: true,
});
