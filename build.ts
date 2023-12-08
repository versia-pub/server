// Delete dist directory
import { rm } from "fs/promises";

await rm("./dist", { recursive: true });

await Bun.build({
	entrypoints: ["./index.ts", "./prisma.ts", "./cli.ts"],
	outdir: "./dist",
	target: "bun",
	splitting: true,
	minify: true,
	external: ["bullmq", "@prisma/client"],
});
