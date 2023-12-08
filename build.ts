await Bun.build({
	entrypoints: ["./index.ts"],
	outdir: "./dist",
	target: "bun",
	splitting: true,
	minify: true,
	external: ["bullmq", "@prisma/client"],
});
